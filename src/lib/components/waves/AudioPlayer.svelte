<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { supabase } from '$lib/client/supabase'
  
  // Icon imports
  import {
    Play,
    Pause,
    Minus,
    Plus,
    Zap,
    Activity
  } from 'lucide-svelte'

  let {
    audioUrl,
    waveId,
    title = 'Unknown Track',
    coverImage = '',
    autoPlay = false
  }: {
    audioUrl: string
    waveId: string
    title?: string
    coverImage?: string
    autoPlay?: boolean
  } = $props()

  // Audio context state
  let audioCtx: AudioContext | null = null
  let analyser: AnalyserNode | null = null
  let dataArray: Uint8Array | null = null
  let gainNode: GainNode | null = null
  
  // Actual audio element for playback
  let audioElement: HTMLAudioElement | null = null
  let audioSource: MediaElementAudioSourceNode | null = null
  
  // Playback state
  let isPlaying = $state(false)
  let animationId: number | null = null
  let isAudioLoaded = $state(false)
  
  // Speed control
  let speedFactor = $state(1.0)
  const MIN_SPEED = 0.4
  const MAX_SPEED = 2.5
  
  // Canvas ref
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  
  // DOM refs for labels
  let freqLabel: HTMLElement | null = null
  let statusLabel: HTMLElement | null = null
  let speedDisplay: HTMLElement | null = null
  let speedDot: HTMLElement | null = null

  // Real comments from database
  let comments = $state<any[]>([])
  let commentsLoaded = $state(false)

  // Size constants
  const SIZE = 500

  // Expose play/pause control to parent
  export function togglePlay() {
    if (isPlaying) {
      stopVisualizer()
    } else {
      startVisualizer()
    }
  }

  // Expose methods for parent
  export function play() {
    if (!isPlaying) startVisualizer()
  }

  export function pause() {
    if (isPlaying) stopVisualizer()
  }

  // Load real comments
  async function loadComments() {
    if (!waveId) return
    
    try {
      const { data, error } = await supabase
        .from('comments')
        .select(`
          content,
          user:users(
            name,
            username,
            avatar
          )
        `)
        .eq('wave_id', waveId)
        .order('created_at', { ascending: false })
        .limit(10)

      if (error) throw error

      if (data && data.length > 0) {
        comments = data
      } else {
        // Fallback comments if none exist
        comments = [
          { content: 'اولین نفری باشید که نظر می‌دهد!', user: { name: 'سیستم' } }
        ]
      }
      commentsLoaded = true
    } catch (err) {
      console.error('Error loading comments:', err)
      comments = [
        { content: 'نظری برای این موج ثبت نشده است', user: { name: 'سیستم' } }
      ]
    }
  }

  // Initialize canvas
  onMount(() => {
    if (canvas) {
      canvas.width = SIZE
      canvas.height = SIZE
      ctx = canvas.getContext('2d')
      drawEmptyState()
    }
    
    // Load real comments
    loadComments()
    
    // Initialize audio element with the actual audio URL
    if (audioUrl) {
      audioElement = new Audio(audioUrl)
      audioElement.crossOrigin = 'anonymous'
      audioElement.preload = 'metadata'
      
      audioElement.addEventListener('loadedmetadata', () => {
        isAudioLoaded = true
        if (statusLabel) statusLabel.textContent = 'ready'
      })
      
      audioElement.addEventListener('error', () => {
        console.error('Error loading audio')
        if (statusLabel) statusLabel.textContent = 'error'
      })
      
      audioElement.addEventListener('ended', () => {
        stopVisualizer()
      })
    }
  })

  // Cleanup on destroy
  onDestroy(() => {
    if (audioElement) {
      audioElement.pause()
      audioElement.src = ''
    }
    if (audioCtx) {
      audioCtx.close()
    }
    if (animationId) {
      cancelAnimationFrame(animationId)
    }
  })

  // Initialize audio context with audio element
  function initAudio() {
    if (audioCtx) return audioCtx
    if (!audioElement) {
      console.warn('No audio element')
      return null
    }
    
    try {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
      
      audioSource = audioCtx.createMediaElementSource(audioElement)
      
      analyser = audioCtx.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.7
      
      gainNode = audioCtx.createGain()
      gainNode.gain.value = 1.0
      
      audioSource.connect(analyser)
      analyser.connect(gainNode)
      gainNode.connect(audioCtx.destination)
      
      dataArray = new Uint8Array(analyser.frequencyBinCount)
      
      return audioCtx
    } catch (err) {
      console.warn('WebAudio not supported', err)
      return null
    }
  }

  // Start visualizer
  function startVisualizer() {
    if (isPlaying) return
    if (!audioElement || !audioUrl) {
      console.warn('No audio URL')
      return
    }
    
    const ctxAudio = initAudio()
    if (!ctxAudio) {
      alert('WebAudio not available')
      return
    }
    
    if (ctxAudio.state === 'suspended') {
      ctxAudio.resume().then(() => {
        if (audioElement) {
          audioElement.currentTime = 0
          audioElement.play().catch(err => console.warn('Play error', err))
        }
        isPlaying = true
        updateUI(true)
        drawVisualizer()
      }).catch(err => console.warn('resume error', err))
      return
    }
    
    if (audioElement) {
      audioElement.currentTime = 0
      audioElement.play().catch(err => console.warn('Play error', err))
    }
    isPlaying = true
    updateUI(true)
    drawVisualizer()
  }

  // Stop visualizer
  function stopVisualizer() {
    if (!isPlaying) return
    isPlaying = false
    updateUI(false)
    if (animationId) {
      cancelAnimationFrame(animationId)
      animationId = null
    }
    if (ctx) {
      ctx.clearRect(0, 0, SIZE, SIZE)
      drawEmptyState()
    }
    if (audioElement) {
      audioElement.pause()
    }
    if (audioCtx) {
      audioCtx.close().then(() => {
        audioCtx = null
        analyser = null
        audioSource = null
      }).catch(() => {})
    }
    if (statusLabel) statusLabel.textContent = 'stopped'
  }

  // Update UI
  function updateUI(playing: boolean) {
    if (statusLabel) {
      statusLabel.textContent = playing ? 'playing' : 'stopped'
    }
  }

  // Draw empty state
  function drawEmptyState() {
    if (!ctx) return
    const center = SIZE/2
    const radius = SIZE/2 - 10
    ctx.clearRect(0, 0, SIZE, SIZE)
    ctx.beginPath()
    ctx.arc(center, center, radius * 0.25, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(center, center, 4, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255,255,255,0.1)'
    ctx.fill()
  }

  // Main draw loop
  function drawVisualizer() {
    if (!isPlaying) {
      if (animationId) { 
        cancelAnimationFrame(animationId)
        animationId = null 
      }
      return
    }
    if (!analyser || !dataArray || !ctx) {
      animationId = requestAnimationFrame(drawVisualizer)
      return
    }
    
    analyser.getByteFrequencyData(dataArray)
    
    let sum = 0
    for (let i = 0; i < dataArray.length; i++) sum += dataArray[i]
    const avg = sum / dataArray.length
    const freqDisplay = Math.round(20 + (avg / 255) * 80)
    if (freqLabel) freqLabel.textContent = `${freqDisplay} Hz`
    
    const center = SIZE/2
    const maxRadius = SIZE/2 - 20
    const barCount = 64
    const angleStep = (Math.PI * 2) / barCount
    const halfBarWidth = (angleStep * 0.7) / 2
    
    ctx.clearRect(0, 0, SIZE, SIZE)
    
    const gradient = ctx.createRadialGradient(center, center, 0, center, center, maxRadius)
    gradient.addColorStop(0, 'rgba(99, 102, 241, 0.08)')
    gradient.addColorStop(1, 'rgba(15, 23, 42, 0)')
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.arc(center, center, maxRadius, 0, Math.PI * 2)
    ctx.fill()
    
    for (let i = 0; i < barCount; i++) {
      const dataIndex = Math.floor((i / barCount) * dataArray.length)
      const value = dataArray[dataIndex] || 0
      const norm = Math.max(0.03, value / 255)
      const innerRadius = 20 + (1 - norm) * 50
      const outerRadius = 20 + norm * (maxRadius - 25)
      const angle = i * angleStep - Math.PI/2
      
      ctx.beginPath()
      ctx.arc(center, center, outerRadius, angle - halfBarWidth, angle + halfBarWidth)
      ctx.arc(center, center, innerRadius, angle + halfBarWidth, angle - halfBarWidth, true)
      ctx.closePath()
      
      const hue = (i * 5 + 200) % 360
      const lightness = 50 + norm * 40
      const saturation = 80 + norm * 20
      ctx.fillStyle = `hsl(${hue}, ${saturation}%, ${lightness}%)`
      ctx.shadowColor = `hsla(${hue}, 80%, 60%, 0.25)`
      ctx.shadowBlur = 15
      ctx.fill()
      ctx.shadowBlur = 0
      ctx.strokeStyle = 'rgba(255,255,255,0.06)'
      ctx.lineWidth = 0.8
      ctx.stroke()
    }
    
    const grad2 = ctx.createRadialGradient(center-10, center-10, 5, center, center, 50)
    grad2.addColorStop(0, 'rgba(255,255,255,0.08)')
    grad2.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = grad2
    ctx.beginPath()
    ctx.arc(center, center, 50, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(center, center, 5, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255,255,255,0.15)'
    ctx.fill()
    
    ctx.beginPath()
    ctx.arc(center, center, maxRadius-2, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'
    ctx.lineWidth = 2
    ctx.stroke()
    
    animationId = requestAnimationFrame(drawVisualizer)
  }

  // Speed controls
  function changeSpeed(delta: number) {
    let newSpeed = speedFactor + delta
    newSpeed = Math.min(MAX_SPEED, Math.max(MIN_SPEED, newSpeed))
    if (newSpeed === speedFactor) return
    speedFactor = newSpeed
    if (speedDisplay) speedDisplay.textContent = speedFactor.toFixed(1) + '×'
    if (isPlaying && audioElement) {
      audioElement.playbackRate = speedFactor
    }
    if (speedDot) {
      if (Math.abs(speedFactor - 1.0) < 0.01) {
        speedDot.className = 'speed-dot inactive'
      } else {
        speedDot.className = 'speed-dot'
      }
    }
  }

  // Keyboard shortcuts
  function handleKeyDown(e: KeyboardEvent) {
    if (e.target?.tagName === 'INPUT') return
    if (e.key === ' ' || e.key === 'Space') { 
      e.preventDefault() 
      togglePlay() 
    }
    if (e.key === 'ArrowUp') { 
      e.preventDefault() 
      changeSpeed(0.1) 
    }
    if (e.key === 'ArrowDown') { 
      e.preventDefault() 
      changeSpeed(-0.1) 
    }
  }

  onMount(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  })
</script>

<div class="audio-player-container">
  <div class="controll-container">
    <div class="visualizer-wrapper">
      <canvas 
        bind:this={canvas} 
        class="visualizer-canvas"
        onclick={togglePlay}
        width="500" 
        height="500"
      ></canvas>
      
      <button 
        class="play-toggle-btn" 
        onclick={(e) => { e.stopPropagation(); togglePlay() }}
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {#if isPlaying}
          <Pause size={28} />
        {:else}
          <Play size={28} />
        {/if}
      </button>
    </div>

    <div class="controls">
      <div class="controls-row">
        <div class="speed-control">
          <span class="speed-label">SPEED</span>
          <button class="speed-btn" onclick={() => changeSpeed(-0.1)}>
            <Minus size={14} />
          </button>
          <span class="speed-display" bind:this={speedDisplay}>1.0×</span>
          <button class="speed-btn" onclick={() => changeSpeed(0.1)}>
            <Plus size={14} />
          </button>
          <span class="speed-dot inactive" bind:this={speedDot}></span>
        </div>
      </div>
      
      <!-- Real comments marquee - LARGER TEXT -->
      {#if comments.length > 0}
        <div class="comments-marquee">
          <div class="marquee-track">
            {#each comments as comment, index}
              <span class="comment-item">
                <span class="comment-user">{comment.user?.name || 'ناشناس'}:</span>
                <span class="comment-text">{comment.content}</span>
                {#if index < comments.length - 1}
                  <span class="comment-separator">•</span>
                {/if}
              </span>
            {/each}
            <!-- Duplicate for seamless loop -->
            {#each comments as comment, index}
              <span class="comment-item">
                <span class="comment-user">{comment.user?.name || 'ناشناس'}:</span>
                <span class="comment-text">{comment.content}</span>
                {#if index < comments.length - 1}
                  <span class="comment-separator">•</span>
                {/if}
              </span>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .audio-player-container {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(15, 23, 42, 0.75);
    backdrop-filter: blur(12px);
  }

  .controll-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: clamp(0.5rem, 2vh, 1rem);
    padding: clamp(0.5rem, 2vh, 1rem);
    width: 100%;
    max-width: 450px;
    height: 100%;
    max-height: 600px;
  }

  .visualizer-wrapper {
    position: relative;
    width: clamp(140px, min(40vw, 40vh), 280px);
    aspect-ratio: 1/1;
    margin: 0 auto;
    flex-shrink: 0;
  }

  .visualizer-wrapper::after {
    content: '';
    position: absolute;
    inset: -8px;
    border-radius: 9999px;
    background: linear-gradient(145deg, #38bdf8, #818cf8, #f472b6);
    opacity: 0.2;
    filter: blur(12px);
    z-index: -1;
    animation: softPulse 3s ease-in-out infinite alternate;
  }

  @keyframes softPulse {
    0% { opacity: 0.15; transform: scale(0.98); }
    100% { opacity: 0.3; transform: scale(1.02); }
  }

  .visualizer-canvas {
    display: block;
    width: 100%;
    height: 100%;
    border-radius: 9999px;
    background: radial-gradient(circle at center, #1e293b, #0f172a);
    box-shadow: 0 20px 40px -10px rgba(0,0,0,0.8);
    cursor: pointer;
    transition: filter 0.2s;
  }

  .visualizer-canvas:active {
    filter: brightness(1.1);
  }

  .play-toggle-btn {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: clamp(40px, 10vw, 52px);
    height: clamp(40px, 10vw, 52px);
    border-radius: 50%;
    border: none;
    background: rgba(255,255,255,0.15);
    backdrop-filter: blur(8px);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
    box-shadow: 0 4px 16px rgba(0,0,0,0.3);
    color: white;
  }

  .play-toggle-btn:hover {
    transform: translate(-50%, -50%) scale(1.1);
    background: rgba(255,255,255,0.25);
  }

  .play-toggle-btn :global(svg) {
    width: clamp(18px, 5vw, 28px);
    height: clamp(18px, 5vw, 28px);
  }

  .controls {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: clamp(0.3rem, 1vh, 0.6rem);
    flex-shrink: 0;
  }

  .controls-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: clamp(0.2rem, 0.5vw, 0.4rem);
  }

  .speed-control {
    display: flex;
    align-items: center;
    gap: clamp(0.1rem, 0.3vw, 0.2rem);
    background: rgba(255,255,255,0.06);
    backdrop-filter: blur(4px);
    border: 1px solid rgba(255,255,255,0.08);
    padding: clamp(0.1rem, 0.3vh, 0.2rem) clamp(0.2rem, 0.5vw, 0.4rem);
    border-radius: 9999px;
    flex-shrink: 0;
  }

  .speed-label {
    color: rgba(255,255,255,0.5);
    font-size: clamp(0.4rem, 1vw, 0.55rem);
    font-weight: 600;
    letter-spacing: 0.05em;
    margin-right: clamp(0.05rem, 0.2vw, 0.15rem);
  }

  .speed-btn {
    width: clamp(16px, 4vw, 24px);
    height: clamp(16px, 4vw, 24px);
    border-radius: 50%;
    border: none;
    background: rgba(255,255,255,0.1);
    color: rgba(255,255,255,0.7);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
    flex-shrink: 0;
  }

  .speed-btn:hover {
    background: rgba(255,255,255,0.2);
  }

  .speed-btn:active {
    transform: scale(0.9);
  }

  .speed-btn :global(svg) {
    width: clamp(8px, 2vw, 14px);
    height: clamp(8px, 2vw, 14px);
  }

  .speed-display {
    color: rgba(255,255,255,0.9);
    font-family: monospace;
    font-size: clamp(0.45rem, 1.2vw, 0.7rem);
    width: clamp(24px, 6vw, 36px);
    text-align: center;
    flex-shrink: 0;
  }

  .speed-dot {
    width: clamp(3px, 0.8vw, 5px);
    height: clamp(3px, 0.8vw, 5px);
    border-radius: 9999px;
    background: #4ade80;
    transition: all 0.2s;
    flex-shrink: 0;
  }

  .speed-dot.inactive {
    background: #475569;
    opacity: 0.4;
  }

  /* Real Comments Marquee - LARGER TEXT */
  .comments-marquee {
    width: 100%;
    overflow: hidden;
    padding: clamp(6px, 1vh, 10px) 0;
    background: rgba(255,255,255,0.04);
    border-radius: 8px;
    border: 1px solid rgba(255,255,255,0.04);
    flex-shrink: 0;
  }

  .marquee-track {
    display: inline-flex;
    white-space: nowrap;
    gap: clamp(12px, 2vw, 20px);
    padding: 0 clamp(12px, 2vw, 20px);
    font-size: clamp(0.85rem, 2.5vw, 1.1rem);
    color: rgba(255,255,255,0.6);
    align-items: center;
    animation: marqueeScroll 30s linear infinite;
  }

  .marquee-track:hover {
    animation-play-state: paused;
  }

  @keyframes marqueeScroll {
    0% { transform: translateX(0); }
    100% { transform: translateX(-50%); }
  }

  .comment-item {
    display: inline-flex;
    align-items: center;
    gap: clamp(6px, 1vw, 10px);
  }

  .comment-user {
    color: rgba(255,255,255,0.9);
    font-weight: 700;
    font-size: clamp(0.85rem, 2.5vw, 1.1rem);
  }

  .comment-text {
    color: rgba(255,255,255,0.7);
    font-size: clamp(0.85rem, 2.5vw, 1.1rem);
  }

  .comment-separator {
    color: rgba(255,255,255,0.15);
    font-size: clamp(0.85rem, 2.5vw, 1.1rem);
  }

  /* Mobile - Keep text readable */
  @media (max-width: 480px) {
    .controll-container {
      max-height: 100vh;
      gap: 0.4rem;
      padding: 0.5rem;
    }

    .visualizer-wrapper {
      width: clamp(120px, 35vw, 160px);
    }

    .play-toggle-btn {
      width: clamp(32px, 8vw, 40px);
      height: clamp(32px, 8vw, 40px);
    }

    .play-toggle-btn :global(svg) {
      width: clamp(14px, 4vw, 20px);
      height: clamp(14px, 4vw, 20px);
    }

    .speed-control {
      padding: 0.1rem 0.2rem;
    }

    .speed-btn {
      width: 14px;
      height: 14px;
      min-width: 14px;
      min-height: 14px;
    }

    .speed-btn :global(svg) {
      width: 7px;
      height: 7px;
    }

    .speed-display {
      font-size: 0.4rem;
      width: 20px;
      min-width: 20px;
    }

    .speed-label {
      font-size: 0.35rem;
    }

    .speed-dot {
      width: 3px;
      height: 3px;
    }

    .comments-marquee {
      padding: 4px 0;
    }

    .marquee-track {
      font-size: clamp(0.7rem, 2vw, 0.85rem);
      gap: 8px;
      padding: 0 10px;
      animation-duration: 25s;
    }

    .comment-user {
      font-size: clamp(0.7rem, 2vw, 0.85rem);
    }

    .comment-text {
      font-size: clamp(0.7rem, 2vw, 0.85rem);
    }

    .comment-separator {
      font-size: clamp(0.7rem, 2vw, 0.85rem);
    }
  }

  /* Extra small phones */
  @media (max-width: 360px) {
    .visualizer-wrapper {
      width: clamp(80px, 30vw, 110px);
    }

    .play-toggle-btn {
      width: clamp(28px, 7vw, 32px);
      height: clamp(28px, 7vw, 32px);
    }

    .play-toggle-btn :global(svg) {
      width: clamp(12px, 3vw, 16px);
      height: clamp(12px, 3vw, 16px);
    }

    .marquee-track {
      font-size: clamp(0.6rem, 1.8vw, 0.7rem);
      animation-duration: 20s;
    }

    .comment-user {
      font-size: clamp(0.6rem, 1.8vw, 0.7rem);
    }

    .comment-text {
      font-size: clamp(0.6rem, 1.8vw, 0.7rem);
    }
  }

  /* Landscape phones */
  @media (max-height: 500px) and (orientation: landscape) {
    .controll-container {
      flex-direction: row;
      gap: 0.5rem;
      padding: 0.3rem 0.8rem;
      max-height: 100vh;
    }

    .visualizer-wrapper {
      width: clamp(80px, 20vh, 120px);
    }

    .play-toggle-btn {
      width: 28px;
      height: 28px;
    }

    .play-toggle-btn :global(svg) {
      width: 14px;
      height: 14px;
    }

    .controls {
      max-width: 200px;
      gap: 0.2rem;
    }

    .controls-row {
      gap: 0.15rem;
    }

    .comments-marquee {
      padding: 2px 0;
    }

    .marquee-track {
      font-size: clamp(0.5rem, 1.5vw, 0.6rem);
      animation-duration: 15s;
      gap: 4px;
      padding: 0 6px;
    }

    .comment-user {
      font-size: clamp(0.5rem, 1.5vw, 0.6rem);
    }

    .comment-text {
      font-size: clamp(0.5rem, 1.5vw, 0.6rem);
    }

    .comment-separator {
      font-size: clamp(0.5rem, 1.5vw, 0.6rem);
    }
  }
</style>