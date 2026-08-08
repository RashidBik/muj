<script lang="ts">
  import { goto } from '$app/navigation'
  import { supabase } from '$lib/client/supabase'
  import { user } from '$lib/stores/user'
  import { onMount } from 'svelte'
  import { trackEvent } from '$lib/services/analytics-service'
  import { extractHashtags } from '$lib/services/wave-service'
  
  // Icon imports
  import { 
    ArrowLeft, 
    Mic, 
    Square, 
    Upload, 
    Image, 
    Music, 
    X, 
    Send,
    Clock,
    CheckCircle,
    AlertCircle,
    Play,
    StopCircle,
    FolderOpen,
    Trash2,
    Hash
  } from 'lucide-svelte'

  // حالت‌های فرم
  let title = $state('')
  let category = $state('FREE')
  let audioFile = $state<File | null>(null)
  let coverFile = $state<File | null>(null)
  let isRecording = $state(false)
  let isUploading = $state(false)
  let recordingTime = $state(0)
  let mediaRecorder: MediaRecorder | null = null
  let audioChunks: Blob[] = []
  let currentUser: any = null
  
  // ✅ Hashtag state
  let hashtags = $state('')
  let showHashtagInput = $state(false)
  let audioDuration = $state(0)
  let isLongWave = $state(false)

  // دسته‌بندی‌ها
  const categories = [
    { value: 'NEWS', label: 'اخبار', icon: '📰' },
    { value: 'EDUCATION', label: 'آموزش', icon: '📚' },
    { value: 'MUSIC', label: 'موسیقی', icon: '🎵' },
    { value: 'AUDIOBOOK', label: 'کتاب صوتی', icon: '📖' },
    { value: 'STORY', label: 'داستان', icon: '📖' },
    { value: 'FREE', label: 'آزاد', icon: '🎯' }
  ]

  $effect(() => {
    const unsubscribe = user.subscribe(value => {
      currentUser = value
    })
    return () => unsubscribe()
  })

  // شروع ضبط
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaRecorder = new MediaRecorder(stream)
      audioChunks = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' })
        audioFile = new File([audioBlob], 'recording.webm', { type: 'audio/webm' })
        recordingTime = 0
        isRecording = false
        stream.getTracks().forEach(track => track.stop())
        
        // ✅ Get duration after recording
        getAudioDuration(audioFile)
      }

      mediaRecorder.start()
      isRecording = true
      recordingTime = 0

      const timer = setInterval(() => {
        if (isRecording) {
          recordingTime++
        } else {
          clearInterval(timer)
        }
      }, 1000)

    } catch (error) {
      console.error('خطا در دسترسی به میکروفون:', error)
      alert('لطفاً دسترسی به میکروفون را فعال کنید.')
    }
  }

  // توقف ضبط
  function stopRecording() {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop()
      isRecording = false
    }
  }

  function handleAudioUpload(event: Event) {
    const input = event.target as HTMLInputElement
    if (input.files && input.files.length > 0) {
      audioFile = input.files[0]
      getAudioDuration(audioFile)
    }
  }

  // ✅ Get audio duration
  function getAudioDuration(file: File) {
    try {
      const audioElement = new Audio()
      const url = URL.createObjectURL(file)
      audioElement.src = url
      audioElement.onloadedmetadata = () => {
        audioDuration = Math.floor(audioElement.duration)
        // ✅ Show hashtag input only for waves > 30 seconds
        isLongWave = audioDuration >= 30
        showHashtagInput = isLongWave
        URL.revokeObjectURL(url)
      }
    } catch (e) {
      console.error('Error getting duration:', e)
      audioDuration = 60
      isLongWave = true
      showHashtagInput = true
    }
  }

  function handleCoverUpload(event: Event) {
    const input = event.target as HTMLInputElement
    if (input.files && input.files.length > 0) {
      coverFile = input.files[0]
    }
  }

  // ✅ Extract hashtags from input
  function extractHashtagsFromInput(text: string): string[] {
    const hashtagRegex = /#[\w\u0600-\u06FF]+/g
    const matches = text.match(hashtagRegex)
    return matches ? matches.map(tag => tag.substring(1)) : []
  }

  // ✅ Clean hashtags input
  function cleanHashtags(input: string): string {
    // Extract all hashtags and join with space
    const tags = extractHashtagsFromInput(input)
    return tags.join(' ')
  }

  // انتشار موج
  async function publishWave() {
    if (!currentUser) {
      alert('لطفاً ابتدا وارد شوید.')
      goto('/auth/login')
      return
    }

    if (!title.trim()) {
      alert('لطفاً عنوان موج را وارد کنید.')
      return
    }

    if (!audioFile) {
      alert('لطفاً یک فایل صوتی ضبط یا آپلود کنید.')
      return
    }

    isUploading = true

    try {
      const audioFileName = `${Date.now()}_${audioFile.name}`
      const { data: audioData, error: audioError } = await supabase.storage
        .from('waves')
        .upload(audioFileName, audioFile)

      if (audioError) throw audioError

      const audioUrl = supabase.storage.from('waves').getPublicUrl(audioFileName).data.publicUrl

      let coverUrl = null
      if (coverFile) {
        const coverFileName = `cover_${Date.now()}_${coverFile.name}`
        const { data: coverData, error: coverError } = await supabase.storage
          .from('covers')
          .upload(coverFileName, coverFile)

        if (!coverError) {
          coverUrl = supabase.storage.from('covers').getPublicUrl(coverFileName).data.publicUrl
        }
      }

      let duration = audioDuration || 0

      // ✅ دسته‌بندی بر اساس مدت زمان
      let durationCategory = 'MEDIUM'
      let expiresAt = null
      const now = new Date()

      if (duration < 30) {
        durationCategory = 'SHORT'
        expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()
      } else if (duration < 240) {
        durationCategory = 'MEDIUM'
        expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
      } else {
        durationCategory = 'LONG'
        expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
      }

      // ✅ Process hashtags (only for waves > 30 seconds)
      let finalHashtags = null
      if (isLongWave && hashtags.trim()) {
        finalHashtags = cleanHashtags(hashtags)
      }

      const { data: waveData, error: waveError } = await supabase
        .from('waves')
        .insert({
          title: title.trim(),
          audio_url: audioUrl,
          cover_image: coverUrl,
          duration: duration,
          duration_category: durationCategory,
          category: category,
          author_id: currentUser.id,
          expires_at: expiresAt,
          hashtags: finalHashtags, // ✅ Add hashtags
          views_count: 0 // Initialize views
        })
        .select()
        .single()

      if (waveError) throw waveError

      await trackEvent({
        event_type: 'wave_publish',
        event_data: {
          wave_id: waveData.id,
          duration: duration,
          category: category,
          duration_category: durationCategory,
          hashtags: finalHashtags
        }
      })

      // هدایت به صفحه اصلی
      goto(`/`)

    } catch (error) {
      console.error('خطا در انتشار موج:', error)
      alert('متأسفانه خطایی رخ داد. لطفاً دوباره تلاش کنید.')
    } finally {
      isUploading = false
    }
  }

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  // ✅ Format duration label
  function getDurationLabel(seconds: number): string {
    if (seconds < 30) return '⏱️ استوری (کمتر از ۳۰ ثانیه)'
    if (seconds < 240) return '🎵 موج (۳۰ ثانیه تا ۴ دقیقه)'
    return '🎙️ موج بلند (بیش از ۴ دقیقه)'
  }

  // ✅ Get duration color
  function getDurationColor(seconds: number): string {
    if (seconds < 30) return '#10b981'
    if (seconds < 240) return '#f59e0b'
    return '#ef4444'
  }

  onMount(() => {
    // Initialize if needed
  })
</script>

<div class="create-wave-page">
  <div class="container">
    <!-- هدر -->
    <div class="header">
      <button class="back-btn" onclick={() => goto('/')}>
        <ArrowLeft size={20} />
        <span>بازگشت</span>
      </button>
      <h1>
        <Mic size={24} />
        موج جدید
      </h1>
      <div></div>
    </div>

    <!-- بخش ضبط صدا -->
    <div class="section">
      <div class="section-header">
        <Mic size={18} />
        <h3>ضبط صدا</h3>
      </div>
      
      <div class="recording-area">
        {#if !audioFile}
          <div class="record-buttons">
            {#if !isRecording}
              <button class="record-btn" onclick={startRecording}>
                <Mic size={20} />
                شروع ضبط
              </button>
            {:else}
              <div class="recording-indicator">
                <div class="recording-status">
                  <span class="recording-dot"></span>
                  <span class="recording-label">در حال ضبط</span>
                </div>
                <span class="time">
                  <Clock size={16} />
                  {formatTime(recordingTime)}
                </span>
                <button class="stop-btn" onclick={stopRecording}>
                  <Square size={18} />
                  توقف
                </button>
              </div>
            {/if}
          </div>

          <div class="divider">
            <span>یا</span>
          </div>

          <div class="upload-area">
            <label class="upload-btn" for="audio-upload">
              <FolderOpen size={18} />
              انتخاب فایل صوتی
            </label>
            <input
              id="audio-upload"
              type="file"
              accept="audio/*"
              onchange={handleAudioUpload}
              class="hidden"
            />
          </div>
        {:else}
          <div class="file-selected">
            <div class="file-info">
              <Music size={20} />
              <span class="file-name">{audioFile.name}</span>
              <span class="file-size">({(audioFile.size / 1024 / 1024).toFixed(2)} MB)</span>
            </div>
            <button class="remove-btn" onclick={() => {
              audioFile = null
              showHashtagInput = false
              isLongWave = false
              audioDuration = 0
            }}>
              <X size={18} />
            </button>
          </div>
          
          <!-- ✅ Duration info -->
          {#if audioDuration > 0}
            <div class="duration-info" style="border-color: {getDurationColor(audioDuration)}">
              <span class="duration-label">📊 مدت زمان: {formatTime(audioDuration)}</span>
              <span class="duration-type" style="color: {getDurationColor(audioDuration)}">
                {getDurationLabel(audioDuration)}
              </span>
            </div>
          {/if}
        {/if}
      </div>
    </div>

    <!-- تصویر کاور -->
    <div class="section">
      <div class="section-header">
        <Image size={18} />
        <h3>تصویر کاور</h3>
      </div>
      
      <div class="cover-area">
        {#if coverFile}
          <div class="cover-preview">
            <img src={URL.createObjectURL(coverFile)} alt="کاور" />
            <button class="remove-btn cover-remove" onclick={() => coverFile = null}>
              <X size={16} />
            </button>
          </div>
        {:else}
          <label class="upload-btn cover-upload" for="cover-upload">
            <Image size={20} />
            انتخاب تصویر
            <span class="upload-hint">(اختیاری)</span>
          </label>
          <input
            id="cover-upload"
            type="file"
            accept="image/*"
            onchange={handleCoverUpload}
            class="hidden"
          />
        {/if}
      </div>
    </div>

    <!-- عنوان و دسته‌بندی -->
    <div class="section">
      <div class="section-header">
        <Music size={18} />
        <h3>اطلاعات موج</h3>
      </div>
      
      <div class="title-field">
        <input
          type="text"
          class="title-input"
          placeholder="عنوان موج را وارد کنید..."
          bind:value={title}
          maxlength="60"
        />
        <div class={`char-count ${title.length > 50 ? 'char-warning' : ''}`}>
          {title.length}/60
        </div>
      </div>

      <div class="category-field">
        <select class="category-select" bind:value={category}>
          {#each categories as cat}
            <option value={cat.value}>
              {cat.icon} {cat.label}
            </option>
          {/each}
        </select>
      </div>
    </div>

    <!-- ✅ Hashtag Input (only for waves > 30 seconds) -->
    {#if showHashtagInput}
      <div class="section hashtag-section">
        <div class="section-header">
          <Hash size={18} />
          <h3>هشتگ‌ها</h3>
          <span class="badge-optional">اختیاری</span>
        </div>
        
        <div class="hashtag-field">
          <input
            type="text"
            class="hashtag-input"
            placeholder="مثال: #موزیک #آموزش #سرگرمی"
            bind:value={hashtags}
            maxlength="100"
          />
          <div class="hashtag-hint">
            <span>هشتگ‌ها را با # جدا کنید</span>
            <span class="hashtag-count">{hashtags.split('#').filter(t => t.trim()).length - 1 || 0}</span>
          </div>
        </div>
        
        <!-- Live preview of hashtags -->
        {#if hashtags.trim()}
          <div class="hashtag-preview">
            {#each hashtags.split(' ') as tag}
              {#if tag.trim()}
                <span class="preview-tag">
                  {tag.startsWith('#') ? tag : '#' + tag}
                </span>
              {/if}
            {/each}
          </div>
        {/if}
        
        <div class="hashtag-info">
          <AlertCircle size={14} />
          <span>هشتگ‌ها به کشف شدن موج شما کمک می‌کنند</span>
        </div>
      </div>
    {/if}

    <!-- دکمه انتشار -->
    <button
      class="publish-btn"
      onclick={publishWave}
      disabled={!audioFile || !title.trim() || isUploading}
    >
      {#if isUploading}
        <span class="spinner"></span>
        در حال انتشار...
      {:else}
        <Send size={20} />
        انتشار موج
      {/if}
    </button>
  </div>
</div>

<style>
  /* Reset and base */
  .create-wave-page {
    min-height: 100vh;
    background: linear-gradient(135deg, #f5f7fa 0%, #e9edf5 100%);
    padding: 20px;
  }

  .container {
    max-width: 640px;
    margin: 0 auto;
    background: #ffffff;
    border-radius: 16px;
    padding: 28px;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
    transition: box-shadow 0.3s ease;
  }

  .container:hover {
    box-shadow: 0 8px 40px rgba(0, 0, 0, 0.12);
  }

  /* Header */
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 28px;
    padding-bottom: 16px;
    border-bottom: 2px solid #f0f2f5;
  }

  .header h1 {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 22px;
    font-weight: 700;
    margin: 0;
    color: #1a1a2e;
  }

  .header h1 :global(svg) {
    color: #6366f1;
  }

  .back-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    background: none;
    border: none;
    color: #6366f1;
    font-size: 15px;
    font-weight: 500;
    cursor: pointer;
    padding: 8px 12px;
    border-radius: 8px;
    transition: all 0.2s ease;
  }

  .back-btn:hover {
    background: #f0f0ff;
    transform: translateX(-2px);
  }

  .back-btn :global(svg) {
    transition: transform 0.2s ease;
  }

  .back-btn:hover :global(svg) {
    transform: translateX(-4px);
  }

  /* Sections */
  .section {
    margin-bottom: 28px;
  }

  .section-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
  }

  .section-header :global(svg) {
    color: #6366f1;
  }

  .section-header h3 {
    font-size: 15px;
    font-weight: 600;
    margin: 0;
    color: #374151;
  }

  .badge-optional {
    font-size: 11px;
    font-weight: 500;
    color: #94a3b8;
    background: #f1f5f9;
    padding: 2px 10px;
    border-radius: 10px;
  }

  /* Recording Area */
  .recording-area {
    background: #f8fafc;
    border-radius: 12px;
    padding: 20px;
    text-align: center;
    border: 2px dashed #e2e8f0;
    transition: border-color 0.3s ease;
  }

  .recording-area:hover {
    border-color: #c7d2fe;
  }

  .record-btn {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    background: #ef4444;
    color: white;
    border: none;
    padding: 14px 32px;
    border-radius: 10px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
  }

  .record-btn:hover {
    background: #dc2626;
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(239, 68, 68, 0.4);
  }

  .record-btn:active {
    transform: translateY(0);
  }

  .recording-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 20px;
    flex-wrap: wrap;
  }

  .recording-status {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .recording-dot {
    width: 12px;
    height: 12px;
    background: #ef4444;
    border-radius: 50%;
    animation: pulse 1s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(0.8); }
  }

  .recording-label {
    font-size: 14px;
    font-weight: 600;
    color: #ef4444;
  }

  .time {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 24px;
    font-weight: 700;
    color: #1a1a2e;
    font-variant-numeric: tabular-nums;
  }

  .time :global(svg) {
    color: #6366f1;
  }

  .stop-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: #64748b;
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .stop-btn:hover {
    background: #475569;
    transform: scale(1.02);
  }

  .divider {
    display: flex;
    align-items: center;
    margin: 16px 0;
    color: #94a3b8;
    font-size: 13px;
  }

  .divider::before,
  .divider::after {
    content: '';
    flex: 1;
    height: 1px;
    background: #e2e8f0;
  }

  .divider span {
    padding: 0 16px;
    font-weight: 500;
  }

  .upload-area {
    margin-top: 4px;
  }

  .upload-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: #ffffff;
    color: #1a1a2e;
    padding: 12px 24px;
    border-radius: 10px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    border: 2px solid #e2e8f0;
    transition: all 0.2s ease;
  }

  .upload-btn:hover {
    border-color: #6366f1;
    background: #f8fafc;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.15);
  }

  .hidden {
    display: none;
  }

  /* File selected */
  .file-selected {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 18px;
    background: #eef2ff;
    border-radius: 10px;
    border: 2px solid #c7d2fe;
    margin-bottom: 12px;
  }

  .file-info {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
  }

  .file-info :global(svg) {
    color: #6366f1;
    flex-shrink: 0;
  }

  .file-name {
    font-weight: 500;
    color: #1a1a2e;
    word-break: break-all;
  }

  .file-size {
    font-size: 12px;
    color: #64748b;
  }

  .remove-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    color: #64748b;
    cursor: pointer;
    padding: 4px;
    border-radius: 6px;
    transition: all 0.2s ease;
  }

  .remove-btn:hover {
    background: #fee2e2;
    color: #ef4444;
  }

  /* ✅ Duration info */
  .duration-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border: 2px solid #e2e8f0;
    border-radius: 10px;
    background: #fafbfc;
  }

  .duration-label {
    font-size: 14px;
    font-weight: 500;
    color: #1a1a2e;
  }

  .duration-type {
    font-size: 13px;
    font-weight: 600;
  }

  /* Cover Area */
  .cover-area {
    background: #f8fafc;
    border-radius: 12px;
    padding: 20px;
    text-align: center;
    min-height: 120px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px dashed #e2e8f0;
    transition: border-color 0.3s ease;
  }

  .cover-area:hover {
    border-color: #c7d2fe;
  }

  .cover-upload {
    flex-direction: column;
    gap: 6px;
    padding: 20px 32px;
  }

  .cover-upload :global(svg) {
    color: #6366f1;
  }

  .upload-hint {
    font-size: 12px;
    color: #94a3b8;
  }

  .cover-preview {
    position: relative;
    display: inline-block;
  }

  .cover-preview img {
    max-width: 180px;
    max-height: 140px;
    border-radius: 10px;
    object-fit: cover;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .cover-remove {
    position: absolute;
    top: -10px;
    right: -10px;
    background: white;
    border-radius: 50%;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    border: none;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .cover-remove:hover {
    background: #fee2e2;
    color: #ef4444;
    transform: scale(1.1);
  }

  /* Title and Category */
  .title-field {
    position: relative;
  }

  .title-input {
    width: 100%;
    padding: 14px 16px;
    border: 2px solid #e2e8f0;
    border-radius: 10px;
    font-size: 16px;
    transition: all 0.2s ease;
    background: #fafbfc;
  }

  .title-input:focus {
    outline: none;
    border-color: #6366f1;
    background: white;
    box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.1);
  }

  .title-input::placeholder {
    color: #94a3b8;
  }

  .char-count {
    text-align: right;
    font-size: 12px;
    color: #94a3b8;
    margin-top: 4px;
    transition: color 0.2s ease;
  }

  .char-warning {
    color: #f59e0b;
  }

  .category-field {
    margin-top: 12px;
  }

  .category-select {
    width: 100%;
    padding: 14px 16px;
    border: 2px solid #e2e8f0;
    border-radius: 10px;
    font-size: 16px;
    background: #fafbfc;
    transition: all 0.2s ease;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%236366f1' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: left 14px center;
    padding-right: 40px;
  }

  .category-select:focus {
    outline: none;
    border-color: #6366f1;
    background-color: white;
    box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.1);
  }

  /* ✅ Hashtag styles */
  .hashtag-section {
    background: #f8fafc;
    padding: 16px;
    border-radius: 12px;
    border: 2px solid #e2e8f0;
  }

  .hashtag-field {
    position: relative;
  }

  .hashtag-input {
    width: 100%;
    padding: 12px 16px;
    border: 2px solid #e2e8f0;
    border-radius: 10px;
    font-size: 15px;
    transition: all 0.2s ease;
    background: white;
    font-family: inherit;
  }

  .hashtag-input:focus {
    outline: none;
    border-color: #6366f1;
    box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.1);
  }

  .hashtag-input::placeholder {
    color: #94a3b8;
  }

  .hashtag-hint {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    color: #94a3b8;
    margin-top: 6px;
  }

  .hashtag-count {
    font-weight: 600;
    color: #6366f1;
  }

  .hashtag-preview {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 8px;
    padding: 8px;
    background: white;
    border-radius: 8px;
    min-height: 30px;
  }

  .preview-tag {
    padding: 2px 10px;
    background: #eef2ff;
    color: #6366f1;
    border-radius: 12px;
    font-size: 13px;
    font-weight: 500;
  }

  .hashtag-info {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 8px;
    font-size: 12px;
    color: #94a3b8;
  }

  .hashtag-info :global(svg) {
    color: #6366f1;
    flex-shrink: 0;
  }

  /* Publish Button */
  .publish-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    width: 100%;
    background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
    color: white;
    border: none;
    padding: 16px;
    border-radius: 12px;
    font-size: 18px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 4px 16px rgba(99, 102, 241, 0.35);
  }

  .publish-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 8px 28px rgba(99, 102, 241, 0.45);
  }

  .publish-btn:active:not(:disabled) {
    transform: translateY(0);
  }

  .publish-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }

  .publish-btn :global(svg) {
    color: white;
  }

  /* Spinner for loading state */
  .spinner {
    display: inline-block;
    width: 20px;
    height: 20px;
    border: 3px solid rgba(255, 255, 255, 0.3);
    border-radius: 50%;
    border-top-color: white;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Responsive Design */
  @media (max-width: 640px) {
    .container {
      padding: 16px;
    }

    .header h1 {
      font-size: 18px;
    }

    .header h1 :global(svg) {
      width: 20px;
      height: 20px;
    }

    .recording-indicator {
      gap: 12px;
    }

    .time {
      font-size: 20px;
    }

    .publish-btn {
      font-size: 16px;
      padding: 14px;
    }

    .hashtag-section {
      padding: 12px;
    }
  }
</style>