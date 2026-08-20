<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { incrementWaveViews } from '$lib/services/wave-service'
  import { trackWavePlay } from '$lib/services/analytics-service'
  import { user } from '$lib/stores/user'
  
  // Icon imports
  import {
    Play,
    Pause,
    Minus,
    Plus,
    Zap,
    Activity,
    Music
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
  
  // ✅ User state for analytics
  let currentUser = $state<any>(null)
  
  // Track if view has been counted
  let viewCounted = $state(false)
  let playCount = $state(0)
  
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

  // Size constants
  const WIDTH = 600
  const HEIGHT = 120

  // ✅ Subscribe to user store
  $effect(() => {
    const unsubscribe = user.subscribe(value => {
      currentUser = value
    })
    return () => unsubscribe()
  })

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

  // ✅ Increment view when audio is played
  async function incrementView() {
    if (viewCounted) return
    if (!waveId) return
    
    try {
      await incrementWaveViews(waveId)
      viewCounted = true
      playCount++
      console.log(`🎵 View counted for wave ${waveId} (${playCount} plays)`)

      const event = new CustomEvent('wave-viewed', { 
        detail: { waveId, playCount } 
      })
      window.dispatchEvent(event)
      
    } catch (error) {
      console.error('Error incrementing view:', error)
    }
  }

  // ✅ Track wave play for analytics
  async function trackPlay() {
    if (!currentUser?.id || !waveId) return
    
    try {
      await trackWavePlay(waveId, currentUser.id)
      console.log(`📊 Tracked play for wave ${waveId} by user ${currentUser.id}`)
    } catch (error) {
      console.error('Error tracking wave play:', error)
    }
  }

  // Initialize canvas
  onMount(() => {
    if (canvas) {
      canvas.width = WIDTH
      canvas.height = HEIGHT
      ctx = canvas.getContext('2d')
      drawEmptyState()
    }
    
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

      // ✅ Track play events
      audioElement.addEventListener('play', () => {
        // Count view (only once per session)
        if (!autoPlay || playCount > 0) {
          incrementView()
        }
        
        // Track analytics
        trackPlay()
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
      ctx.clearRect(0, 0, WIDTH, HEIGHT)
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
    ctx.clearRect(0, 0, WIDTH, HEIGHT)
    
    // Draw subtle baseline
    ctx.beginPath()
    ctx.moveTo(20, HEIGHT / 2)
    ctx.lineTo(WIDTH - 20, HEIGHT / 2)
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'
    ctx.lineWidth = 1
    ctx.stroke()
    
    // Draw subtle center dots
    for (let x = 40; x < WIDTH - 20; x += 20) {
      ctx.beginPath()
      ctx.arc(x, HEIGHT / 2, 1.5, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(255,255,255,0.05)'
      ctx.fill()
    }
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
    
    // Calculate average frequency
    let sum = 0
    for (let i = 0; i < dataArray.length; i++) sum += dataArray[i]
    const avg = sum / dataArray.length
    const freqDisplay = Math.round(20 + (avg / 255) * 80)
    if (freqLabel) freqLabel.textContent = `${freqDisplay} Hz`
    
    ctx.clearRect(0, 0, WIDTH, HEIGHT)
    
    const barCount = 64
    const barWidth = (WIDTH - 40) / barCount
    const maxHeight = HEIGHT - 30
    const baseline = HEIGHT / 2
    
    // Draw background gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT)
    gradient.addColorStop(0, 'rgba(99, 102, 241, 0.03)')
    gradient.addColorStop(0.5, 'rgba(99, 102, 241, 0.01)')
    gradient.addColorStop(1, 'rgba(99, 102, 241, 0.03)')
    ctx.fillStyle = gradient
    ctx.fillRect(20, 10, WIDTH - 40, HEIGHT - 20)
    
    // Draw frequency bars
    for (let i = 0; i < barCount; i++) {
      const dataIndex = Math.floor((i / barCount) * dataArray.length)
      const value = dataArray[dataIndex] || 0
      const norm = Math.max(0.02, value / 255)
      
      // Calculate bar height (positive and negative)
      const barHeight = norm * maxHeight
      const x = 20 + i * barWidth
      const barWidthActual = Math.max(2, barWidth - 2)
      
      // Draw positive bar (upward)
      const positiveGradient = ctx.createLinearGradient(0, baseline, 0, baseline - barHeight)
      const hue = (i * 3 + 200) % 360
      positiveGradient.addColorStop(0, `hsla(${hue}, 80%, 60%, 0.6)`)
      positiveGradient.addColorStop(1, `hsla(${hue}, 80%, 60%, 0.9)`)
      
      ctx.fillStyle = positiveGradient
      ctx.shadowColor = `hsla(${hue}, 80%, 60%, 0.2)`
      ctx.shadowBlur = 8
      ctx.beginPath()
      ctx.roundRect(x, baseline - barHeight, barWidthActual, barHeight, 2)
      ctx.fill()
      
      // Draw negative bar (downward)
      const negativeGradient = ctx.createLinearGradient(0, baseline, 0, baseline + barHeight * 0.6)
      negativeGradient.addColorStop(0, `hsla(${hue + 30}, 70%, 50%, 0.3)`)
      negativeGradient.addColorStop(1, `hsla(${hue + 30}, 70%, 50%, 0.1)`)
      
      ctx.fillStyle = negativeGradient
      ctx.shadowBlur = 0
      ctx.beginPath()
      ctx.roundRect(x, baseline, barWidthActual, barHeight * 0.6, 2)
      ctx.fill()
    }
    
    // Draw center line with glow
    ctx.shadowColor = 'rgba(99, 102, 241, 0.3)'
    ctx.shadowBlur = 10
    ctx.beginPath()
    ctx.moveTo(20, baseline)
    ctx.lineTo(WIDTH - 20, baseline)
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.15)'
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.shadowBlur = 0
    
    // Draw border glow
    ctx.beginPath()
    ctx.roundRect(20, 10, WIDTH - 40, HEIGHT - 20, 8)
    ctx.strokeStyle = 'rgba(255,255,255,0.05)'
    ctx.lineWidth = 1
    ctx.stroke()
    
    animationId = requestAnimationFrame(drawVisualizer)
  }

  // Polyfill for roundRect if needed
  if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
      if (r > w/2) r = w/2
      if (r > h/2) r = h/2
      this.moveTo(x + r, y)
      this.lineTo(x + w - r, y)
      this.quadraticCurveTo(x + w, y, x + w, y + r)
      this.lineTo(x + w, y + h - r)
      this.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
      this.lineTo(x + r, y + h)
      this.quadraticCurveTo(x, y + h, x, y + h - r)
      this.lineTo(x, y + r)
      this.quadraticCurveTo(x, y, x + r, y)
      return this
    }
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
    if (e.target?.tagName === 'INPUT' || e.target?.tagName === 'TEXTAREA') return
    
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
  <!-- Background with cover image or default gradient -->
  <div class="background-layer">
    {#if coverImage}
      <img 
        src={coverImage} 
        alt={title}
        class="cover-background"
        loading="lazy"
      />
      <div class="cover-overlay"></div>
    {:else}
      <div class="default-background">
        <div class="default-background-gradient"></div>
        <div class="default-pattern"></div>
        <Music class="default-icon" size={48} />
      </div>
    {/if}
  </div>

  <div class="controll-container">
    <div class="visualizer-wrapper">
      <canvas 
        bind:this={canvas} 
        class="visualizer-canvas"
        onclick={togglePlay}
        width="600" 
        height="120"
      ></canvas>
      
      <button 
        class="play-toggle-btn" 
        onclick={(e) => { e.stopPropagation(); togglePlay() }}
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {#if isPlaying}
          <Pause size={20} />
        {:else}
          <Play size={20} />
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
        
        <div class="freq-display">
          <Zap size={12} />
          <span class="freq-value" bind:this={freqLabel}>0 Hz</span>
        </div>
        
        <div class="status-display">
          <Activity size={12} />
          <span class="status-value" bind:this={statusLabel}>ready</span>
        </div>
      </div>
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
    overflow: hidden;
  }

  /* Background Layer */
  .background-layer {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 0;
  }

  .cover-background {
    width: 100%;
    height: 100%;
    object-fit: cover;
    filter: blur(20px) brightness(0.4);
    transform: scale(1.1);
  }

  .cover-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(15, 23, 42, 0.6);
    backdrop-filter: blur(8px);
  }

  /* Default Background */
  .default-background {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  .default-background-gradient {
    position: absolute;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background: 
      radial-gradient(circle at 20% 50%, rgba(99, 102, 241, 0.15) 0%, transparent 50%),
      radial-gradient(circle at 80% 50%, rgba(56, 189, 248, 0.1) 0%, transparent 50%),
      radial-gradient(circle at 50% 80%, rgba(244, 114, 182, 0.08) 0%, transparent 50%);
    animation: gradientShift 15s ease-in-out infinite alternate;
  }

  @keyframes gradientShift {
    0% { transform: rotate(0deg) scale(1); }
    50% { transform: rotate(180deg) scale(1.2); }
    100% { transform: rotate(360deg) scale(1); }
  }

  .default-pattern {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-image: 
      radial-gradient(circle at 20% 50%, rgba(255,255,255,0.03) 1px, transparent 1px),
      radial-gradient(circle at 80% 50%, rgba(255,255,255,0.02) 1px, transparent 1px);
    background-size: 60px 60px;
    background-position: 0 0, 30px 30px;
    opacity: 0.5;
  }

  .default-icon {
    position: relative;
    z-index: 1;
    color: rgba(255,255,255,0.06);
    width: 80px;
    height: 80px;
    animation: iconPulse 4s ease-in-out infinite;
  }

  @keyframes iconPulse {
    0%, 100% { opacity: 0.06; transform: scale(1) rotate(0deg); }
    50% { opacity: 0.12; transform: scale(1.1) rotate(5deg); }
  }

  /* Main Content */
  .controll-container {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: clamp(0.5rem, 1.5vh, 1rem);
    padding: clamp(0.5rem, 2vh, 1.5rem);
    width: 100%;
    max-width: 650px;
  }

  .visualizer-wrapper {
    position: relative;
    width: 100%;
    max-width: 600px;
    margin: 0 auto;
  }

  .visualizer-wrapper::before {
    content: '';
    position: absolute;
    inset: -8px;
    border-radius: 12px;
    background: linear-gradient(135deg, #38bdf8, #818cf8, #f472b6);
    opacity: 0.1;
    filter: blur(16px);
    z-index: -1;
    animation: softPulse 3s ease-in-out infinite alternate;
  }

  @keyframes softPulse {
    0% { opacity: 0.08; transform: scale(0.98); }
    100% { opacity: 0.15; transform: scale(1.02); }
  }

  .visualizer-canvas {
    display: block;
    width: 100%;
    height: auto;
    aspect-ratio: 600/120;
    border-radius: 8px;
    background: radial-gradient(ellipse at center, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.9));
    box-shadow: 0 8px 32px -8px rgba(0,0,0,0.6);
    cursor: pointer;
    transition: filter 0.2s;
  }

  .visualizer-canvas:active {
    filter: brightness(1.05);
  }

  .play-toggle-btn {
    position: absolute;
    top: 50%;
    left: 12px;
    transform: translateY(-50%);
    width: clamp(32px, 6vw, 44px);
    height: clamp(32px, 6vw, 44px);
    border-radius: 50%;
    border: none;
    background: rgba(255,255,255,0.12);
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
    transform: translateY(-50%) scale(1.1);
    background: rgba(255,255,255,0.2);
  }

  .play-toggle-btn :global(svg) {
    width: clamp(14px, 3vw, 20px);
    height: clamp(14px, 3vw, 20px);
  }

  .controls {
    width: 100%;
    max-width: 600px;
    display: flex;
    flex-direction: column;
    gap: clamp(0.3rem, 0.8vh, 0.6rem);
  }

  .controls-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: clamp(0.3rem, 0.5vw, 0.6rem);
  }

  .speed-control {
    display: flex;
    align-items: center;
    gap: clamp(0.1rem, 0.3vw, 0.3rem);
    background: rgba(255,255,255,0.06);
    backdrop-filter: blur(4px);
    border: 1px solid rgba(255,255,255,0.08);
    padding: clamp(0.1rem, 0.3vh, 0.3rem) clamp(0.3rem, 0.5vw, 0.6rem);
    border-radius: 9999px;
  }

  .speed-label {
    color: rgba(255,255,255,0.5);
    font-size: clamp(0.4rem, 0.8vw, 0.55rem);
    font-weight: 600;
    letter-spacing: 0.05em;
    margin-right: clamp(0.05rem, 0.2vw, 0.15rem);
  }

  .speed-btn {
    width: clamp(18px, 3vw, 26px);
    height: clamp(18px, 3vw, 26px);
    border-radius: 50%;
    border: none;
    background: rgba(255,255,255,0.1);
    color: rgba(255,255,255,0.7);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .speed-btn:hover {
    background: rgba(255,255,255,0.2);
  }

  .speed-btn:active {
    transform: scale(0.9);
  }

  .speed-btn :global(svg) {
    width: clamp(8px, 1.5vw, 14px);
    height: clamp(8px, 1.5vw, 14px);
  }

  .speed-display {
    color: rgba(255,255,255,0.9);
    font-family: monospace;
    font-size: clamp(0.5rem, 1vw, 0.7rem);
    width: clamp(28px, 5vw, 38px);
    text-align: center;
  }

  .speed-dot {
    width: clamp(3px, 0.6vw, 5px);
    height: clamp(3px, 0.6vw, 5px);
    border-radius: 9999px;
    background: #4ade80;
    transition: all 0.2s;
  }

  .speed-dot.inactive {
    background: #475569;
    opacity: 0.4;
  }

  .freq-display, .status-display {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    background: rgba(255,255,255,0.04);
    padding: 0.2rem 0.6rem;
    border-radius: 9999px;
    border: 1px solid rgba(255,255,255,0.05);
  }

  .freq-display :global(svg), .status-display :global(svg) {
    width: clamp(10px, 1.5vw, 14px);
    height: clamp(10px, 1.5vw, 14px);
    opacity: 0.5;
    color: rgba(255,255,255,0.5);
  }

  .freq-value, .status-value {
    color: rgba(255,255,255,0.6);
    font-size: clamp(0.35rem, 0.7vw, 0.5rem);
    font-family: monospace;
    letter-spacing: 0.02em;
  }

  /* Mobile */
  @media (max-width: 480px) {
    .controll-container {
      gap: 0.4rem;
      padding: 0.5rem;
    }

    .play-toggle-btn {
      left: 8px;
      width: 28px;
      height: 28px;
    }

    .play-toggle-btn :global(svg) {
      width: 12px;
      height: 12px;
    }

    .controls-row {
      gap: 0.2rem;
    }

    .speed-control {
      padding: 0.1rem 0.3rem;
    }

    .speed-btn {
      width: 16px;
      height: 16px;
    }

    .speed-btn :global(svg) {
      width: 8px;
      height: 8px;
    }

    .speed-display {
      font-size: 0.4rem;
      width: 22px;
    }

    .freq-display, .status-display {
      padding: 0.1rem 0.4rem;
    }

    .freq-value, .status-value {
      font-size: 0.3rem;
    }

    .default-icon {
      width: 48px;
      height: 48px;
    }
  }

  /* Extra small phones */
  @media (max-width: 360px) {
    .play-toggle-btn {
      width: 24px;
      height: 24px;
    }

    .play-toggle-btn :global(svg) {
      width: 10px;
      height: 10px;
    }

    .default-icon {
      width: 32px;
      height: 32px;
    }
  }

  /* Landscape phones */
  @media (max-height: 500px) and (orientation: landscape) {
    .controll-container {
      flex-direction: row;
      gap: 0.5rem;
      padding: 0.3rem 0.8rem;
      max-width: 90vw;
    }

    .visualizer-wrapper {
      max-width: 400px;
    }

    .play-toggle-btn {
      width: 24px;
      height: 24px;
    }

    .play-toggle-btn :global(svg) {
      width: 12px;
      height: 12px;
    }

    .controls {
      max-width: 200px;
    }

    .controls-row {
      flex-direction: column;
      gap: 0.15rem;
    }

    .default-icon {
      width: 32px;
      height: 32px;
    }
  }
</style>