<script lang="ts">
  import { onMount, onDestroy } from 'svelte'

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
  
  // Oscillators for visualization
  let oscillators: OscillatorNode[] = []
  let oscillatorGains: GainNode[] = []
  
  // Playback state
  let isPlaying = $state(false)
  let isLoading = $state(false)
  let animationId: number | null = null
  
  // Speed/pitch control
  let speedFactor = $state(1.0)
  const MIN_SPEED = 0.4
  const MAX_SPEED = 2.5
  let baseFrequencies = [110, 220, 165] // A2, A3, E3
  
  // Canvas ref
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  
  // DOM refs for labels
  let freqLabel: HTMLElement | null = null
  let statusLabel: HTMLElement | null = null
  let pitchLabel: HTMLElement | null = null
  let speedDisplay: HTMLElement | null = null
  let speedDot: HTMLElement | null = null

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

  // Initialize canvas
  onMount(() => {
    if (canvas) {
      canvas.width = SIZE
      canvas.height = SIZE
      ctx = canvas.getContext('2d')
      drawEmptyState()
    }
  })

  // Cleanup on destroy
  onDestroy(() => {
    if (audioCtx) {
      audioCtx.close()
    }
    if (animationId) {
      cancelAnimationFrame(animationId)
    }
    oscillators.forEach(o => {
      try { o.stop(); o.disconnect() } catch(e) {}
    })
    oscillatorGains.forEach(g => {
      try { g.disconnect() } catch(e) {}
    })
  })

  // Initialize audio context
  function initAudio() {
    if (audioCtx) return audioCtx
    try {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
      analyser = audioCtx.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.7
      
      gainNode = audioCtx.createGain()
      gainNode.gain.value = 0.22
      
      analyser.connect(gainNode)
      gainNode.connect(audioCtx.destination)
      
      dataArray = new Uint8Array(analyser.frequencyBinCount)
      return audioCtx
    } catch (err) {
      console.warn('WebAudio not supported', err)
      return null
    }
  }

  // Build oscillators
  function buildOscillators() {
    if (!audioCtx) return
    
    oscillators.forEach(o => { 
      try { o.stop(); o.disconnect() } catch(e) {} 
    })
    oscillatorGains.forEach(g => { 
      try { g.disconnect() } catch(e) {} 
    })
    oscillators = []
    oscillatorGains = []

    const types = ['sine', 'sine', 'sawtooth']
    const freqs = baseFrequencies.map(f => f * speedFactor)
    const gains = [0.5, 0.35, 0.2]
    const detunes = [-2, 3, -1]

    for (let i = 0; i < 3; i++) {
      const osc = audioCtx.createOscillator()
      osc.type = types[i] as OscillatorType
      osc.frequency.value = freqs[i]
      osc.detune.value = detunes[i]
      
      const g = audioCtx.createGain()
      g.gain.value = gains[i]
      
      osc.connect(g)
      g.connect(analyser!)
      
      osc.start(0)
      
      oscillators.push(osc)
      oscillatorGains.push(g)
    }
  }

  // Update pitch
  function updatePitch() {
    if (!oscillators.length) return
    const freqs = baseFrequencies.map(f => f * speedFactor)
    oscillators.forEach((osc, idx) => {
      if (idx < freqs.length) {
        osc.frequency.setTargetAtTime(freqs[idx], audioCtx!.currentTime, 0.05)
      }
    })
    updatePitchLabel()
    if (speedDisplay) speedDisplay.textContent = speedFactor.toFixed(1) + '×'
    if (speedDot) {
      if (Math.abs(speedFactor - 1.0) < 0.01) {
        speedDot.className = 'speed-dot inactive'
      } else {
        speedDot.className = 'speed-dot'
      }
    }
  }

  // Update UI labels
  function updatePitchLabel() {
    if (!pitchLabel) return
    const detune = (speedFactor - 1.0) * 100
    pitchLabel.textContent = `🎵 pitch: ${speedFactor.toFixed(2)}× (${detune > 0 ? '+' : ''}${Math.round(detune)}¢)`
  }

  // Start visualizer
  function startVisualizer() {
    if (isPlaying) return
    
    const ctxAudio = initAudio()
    if (!ctxAudio) {
      alert('WebAudio not available')
      return
    }
    
    if (ctxAudio.state === 'suspended') {
      ctxAudio.resume().then(() => {
        buildOscillators()
        updatePitch()
        isPlaying = true
        updateUI(true)
        drawVisualizer()
      }).catch(err => console.warn('resume error', err))
      return
    }
    
    if (oscillators.length === 0) buildOscillators()
    updatePitch()
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
    oscillators.forEach(o => { 
      try { o.stop(); o.disconnect() } catch(e) {} 
    })
    oscillators = []
    oscillatorGains.forEach(g => { 
      try { g.disconnect() } catch(e) {} 
    })
    oscillatorGains = []
    if (audioCtx) {
      audioCtx.close().then(() => {
        audioCtx = null
        analyser = null
      }).catch(() => {})
    }
    if (statusLabel) statusLabel.textContent = '⏸ stopped'
  }

  // Update UI
  function updateUI(playing: boolean) {
    if (statusLabel) {
      statusLabel.textContent = playing ? '▶ playing' : '⏸ stopped'
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
    if (freqLabel) freqLabel.textContent = `⚡ ${freqDisplay} Hz`
    
    const center = SIZE/2
    const maxRadius = SIZE/2 - 20
    const barCount = 64
    const angleStep = (Math.PI * 2) / barCount
    const halfBarWidth = (angleStep * 0.7) / 2
    
    ctx.clearRect(0, 0, SIZE, SIZE)
    
    // Subtle glow
    const gradient = ctx.createRadialGradient(center, center, 0, center, center, maxRadius)
    gradient.addColorStop(0, 'rgba(99, 102, 241, 0.08)')
    gradient.addColorStop(1, 'rgba(15, 23, 42, 0)')
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.arc(center, center, maxRadius, 0, Math.PI * 2)
    ctx.fill()
    
    // Draw bars
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
    
    // Center dot
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
    if (isPlaying && oscillators.length > 0) {
      updatePitch()
    } else {
      updatePitchLabel()
      if (speedDisplay) speedDisplay.textContent = speedFactor.toFixed(1) + '×'
      if (speedDot) {
        if (Math.abs(speedFactor - 1.0) < 0.01) {
          speedDot.className = 'speed-dot inactive'
        } else {
          speedDot.className = 'speed-dot'
        }
      }
    }
  }

  // Shift pitch
  function shiftPitch(direction: number) {
    const factor = direction > 0 ? 1.25 : 0.8
    baseFrequencies = baseFrequencies.map(f => {
      let newF = f * factor
      if (newF < 40) newF = 40
      if (newF > 800) newF = 800
      return Math.round(newF)
    })
    if (isPlaying && oscillators.length > 0) {
      oscillators.forEach(o => { try { o.stop(); o.disconnect() } catch(e) {} })
      oscillatorGains.forEach(g => { try { g.disconnect() } catch(e) {} })
      oscillators = []
      oscillatorGains = []
      buildOscillators()
      updatePitch()
    } else {
      const avgFreq = baseFrequencies.reduce((a,b) => a+b, 0) / baseFrequencies.length
      if (pitchLabel) pitchLabel.textContent = `🎵 pitch: ${Math.round(avgFreq)} Hz base`
    }
    if (isPlaying) updatePitchLabel()
    else {
      const avgFreq = baseFrequencies.reduce((a,b) => a+b, 0) / baseFrequencies.length
      if (pitchLabel) pitchLabel.textContent = `🎵 pitch: ${Math.round(avgFreq)} Hz base`
    }
  }

  // Keyboard shortcuts
  function handleKeyDown(e: KeyboardEvent) {
    if (e.target?.tagName === 'INPUT') return
    if (e.key === ' ' || e.key === 'Space') { 
      e.preventDefault() 
      togglePlay() 
    }
    if (e.key === 'ArrowRight') { 
      e.preventDefault() 
      shiftPitch(1) 
    }
    if (e.key === 'ArrowLeft') { 
      e.preventDefault() 
      shiftPitch(-1) 
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
 <div></div>
  <div class="controll-container">

        <div class="visualizer-wrapper">
    <canvas 
      bind:this={canvas} 
      class="visualizer-canvas"
      onclick={togglePlay}
      width="500" 
      height="500"
    ></canvas>
    
    <!-- Play/Pause overlay button -->
    <button 
      class="play-toggle-btn" 
      onclick={(e) => { e.stopPropagation(); togglePlay() }}
      aria-label={isPlaying ? 'Pause' : 'Play'}
    >
      {#if isPlaying}
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="white">
          <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
        </svg>
      {:else}
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="white">
          <path d="M8 5v14l11-7z" />
        </svg>
      {/if}
    </button>
  </div>

  <!-- Controls -->
  <div class="controls">
    <div class="controls-row">
      <!-- Backward -->
      <button class="control-btn" onclick={() => shiftPitch(-1)} title="Skip backward (change pitch down)">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z"/>
        </svg>
      </button>

      <!-- Play/Stop -->
      <button class="control-btn play-btn" onclick={() => togglePlay()}>
        {#if isPlaying}
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
          </svg>
          <span>Stop</span>
        {:else}
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
          <span>Play</span>
        {/if}
      </button>

      <!-- Forward -->
      <button class="control-btn" onclick={() => shiftPitch(1)} title="Skip forward (change pitch up)">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M13 6v12l8.5-6L13 6zM4 18l8.5-6L4 6v12z"/>
        </svg>
      </button>

      <!-- Speed control -->
      <div class="speed-control">
        <span class="speed-label">SPEED</span>
        <button class="speed-btn" onclick={() => changeSpeed(-0.1)}>−</button>
        <span class="speed-display" bind:this={speedDisplay}>1.0×</span>
        <button class="speed-btn" onclick={() => changeSpeed(0.1)}>+</button>
        <span class="speed-dot inactive" bind:this={speedDot}></span>
      </div>
    </div>

    <!-- Info labels -->
    <div class="info-labels">
      <span class="badge" bind:this={freqLabel}>⚡ 44 Hz</span>
      <span class="badge" bind:this={statusLabel}>⏸ stopped</span>
      <span class="badge" bind:this={pitchLabel}>🎵 pitch: 0</span>
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
    align-items: space-between;
    justify-content: space-between;
    background: rgba(15, 23, 42, 0.75);
    backdrop-filter: blur(12px);
  }
  .controll-container {
    display: flex;
    flex-direction: column;
    padding-top: 1rem;
  }

  .visualizer-wrapper {
    position: relative;
    width: min(16vw, 60vh, 350px);
    aspect-ratio: 1/1;
    margin: 0 auto;
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
    width: 56px;
    height: 56px;
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
  }

  .play-toggle-btn:hover {
    transform: translate(-50%, -50%) scale(1.1);
    background: rgba(255,255,255,0.25);
  }

  .controls {
    margin-top: 1rem;
    width: 100%;
    max-width: 400px;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .controls-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }

  .control-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border-radius: 9999px;
    border: 1px solid rgba(255,255,255,0.15);
    background: rgba(255,255,255,0.08);
    backdrop-filter: blur(4px);
    color: rgba(255,255,255,0.8);
    cursor: pointer;
    transition: all 0.15s ease;
    font-size: 0.875rem;
    font-weight: 500;
  }

  .control-btn:hover {
    background: rgba(255,255,255,0.16);
    transform: scale(1.05);
  }

  .control-btn:active {
    transform: scale(0.92);
  }

  .play-btn {
    background: linear-gradient(135deg, #4f46e5, #7c3aed);
    padding: 0.5rem 1.5rem;
    box-shadow: 0 4px 14px rgba(79, 70, 229, 0.4);
    color: white;
    border: none;
  }

  .play-btn:hover {
    transform: scale(1.04);
    box-shadow: 0 8px 20px rgba(79, 70, 229, 0.6);
  }

  .play-btn:active {
    transform: scale(0.94);
  }

  .speed-control {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    background: rgba(255,255,255,0.06);
    backdrop-filter: blur(4px);
    border: 1px solid rgba(255,255,255,0.08);
    padding: 0.25rem 0.5rem;
    border-radius: 9999px;
  }

  .speed-label {
    color: rgba(255,255,255,0.5);
    font-size: 0.625rem;
    font-weight: 600;
    letter-spacing: 0.05em;
    margin-right: 0.25rem;
  }

  .speed-btn {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: none;
    background: rgba(255,255,255,0.1);
    color: rgba(255,255,255,0.7);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    font-size: 0.875rem;
    transition: all 0.15s ease;
  }

  .speed-btn:hover {
    background: rgba(255,255,255,0.2);
  }

  .speed-display {
    color: rgba(255,255,255,0.9);
    font-family: monospace;
    font-size: 0.75rem;
    width: 40px;
    text-align: center;
  }

  .speed-dot {
    width: 6px;
    height: 6px;
    border-radius: 9999px;
    background: #4ade80;
    transition: all 0.2s;
  }

  .speed-dot.inactive {
    background: #475569;
    opacity: 0.4;
  }

  .info-labels {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }

  .badge {
    background: rgba(255,255,255,0.06);
    backdrop-filter: blur(4px);
    border: 1px solid rgba(255,255,255,0.08);
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    color: rgba(255,255,255,0.5);
    font-size: 0.625rem;
    white-space: nowrap;
  }

  /* Responsive */
  @media (max-width: 480px) {
    .visualizer-wrapper {
      width: min(70vw, 70vh, 280px);
    }

    .play-toggle-btn {
      width: 44px;
      height: 44px;
    }

    .play-toggle-btn svg {
      width: 20px;
      height: 20px;
    }

    .control-btn {
      font-size: 0.75rem;
      padding: 0.375rem 0.75rem;
    }

    .play-btn {
      padding: 0.375rem 1rem;
    }

    .speed-control {
      padding: 0.125rem 0.375rem;
    }

    .speed-btn {
      width: 24px;
      height: 24px;
      font-size: 0.75rem;
    }

    .speed-display {
      font-size: 0.625rem;
      width: 32px;
    }

    .badge {
      font-size: 0.5rem;
      padding: 0.125rem 0.5rem;
    }
  }
</style>