<script lang="ts">
  import { goto } from '$app/navigation'
  import { supabase } from '$lib/client/supabase'
  import { user } from '$lib/stores/user'
  import { onMount } from 'svelte'
  import { trackEvent } from '$lib/services/analytics-service'


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

  // دسته‌بندی‌ها
  const categories = [
    { value: 'NEWS', label: '📰 اخبار' },
    { value: 'EDUCATION', label: '📚 آموزش' },
    { value: 'MUSIC', label: '🎵 موسیقی' },
    { value: 'AUDIOBOOK', label: '📖 کتاب صوتی' },
    { value: 'STORY', label: '📖 داستان' },
    { value: 'FREE', label: '🎯 آزاد' }
  ]

  // اشتراک‌گذاری در store کاربر
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
      }

      mediaRecorder.start()
      isRecording = true
      recordingTime = 0

      // تایمر برای نمایش زمان
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

  // انتخاب فایل صوتی
  function handleAudioUpload(event: Event) {
    const input = event.target as HTMLInputElement
    if (input.files && input.files.length > 0) {
      audioFile = input.files[0]
    }
  }

  // انتخاب تصویر کاور
  function handleCoverUpload(event: Event) {
    const input = event.target as HTMLInputElement
    if (input.files && input.files.length > 0) {
      coverFile = input.files[0]
    }
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
      // ۱. آپلود فایل صوتی به Supabase Storage
      const audioFileName = `${Date.now()}_${audioFile.name}`
      const { data: audioData, error: audioError } = await supabase.storage
        .from('waves')
        .upload(audioFileName, audioFile)

      if (audioError) throw audioError

      const audioUrl = supabase.storage.from('waves').getPublicUrl(audioFileName).data.publicUrl

      // ۲. آپلود تصویر کاور (اختیاری)
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

      // ۳. محاسبه مدت زمان (با استفاده از Audio API)
      let duration = 0
      try {
        const audioElement = new Audio()
        const url = URL.createObjectURL(audioFile)
        await new Promise((resolve) => {
          audioElement.src = url
          audioElement.onloadedmetadata = () => {
            duration = Math.floor(audioElement.duration)
            resolve(null)
          }
        })
        URL.revokeObjectURL(url)
      } catch (e) {
        // اگر نتونست مدت زمان رو محاسبه کنه، از مقدار پیش‌فرض استفاده کنه
        duration = 60
      }

      // ۴. تعیین دسته‌بندی مدت زمان
      let durationCategory = 'MEDIUM'
      if (duration < 60) durationCategory = 'SHORT'
      else if (duration > 240) durationCategory = 'LONG'

      // ۵. ذخیره در دیتابیس
      const { data: waveData, error: waveError } = await supabase
        .from('waves')
        .insert({
          title: title.trim(),
          audio_url: audioUrl,
          cover_image: coverUrl,
          duration: duration,
          duration_category: durationCategory,
          category: category,
          author_id: currentUser.id
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
          duration_category: durationCategory
        }
      })

      // ۶. هدایت به صفحه موج جدید
      goto(`/wave/${waveData.id}`)

    } catch (error) {
      console.error('خطا در انتشار موج:', error)
      alert('متأسفانه خطایی رخ داد. لطفاً دوباره تلاش کنید.')
    } finally {
      isUploading = false
    }
  }

  // تبدیل ثانیه به فرمت دقیقه:ثانیه
  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  // بررسی وجود کاربر
  onMount(() => {
    if (!currentUser) {
      // فعلاً کاربر تستی بسازیم
      // در مرحله بعد با احراز هویت واقعی جایگزین می‌شود
    }
  })
</script>

<div class="create-wave-page">
  <div class="container">
    <!-- هدر -->
    <div class="header">
      <button class="back-btn" onclick={() => goto('/')}>← بازگشت</button>
      <h1>موج جدید</h1>
      <div></div>
    </div>

    <!-- بخش ضبط صدا -->
    <div class="section">
      <h3>🎙️ ضبط صدا</h3>
      <div class="recording-area">
        {#if !audioFile}
          <div class="record-buttons">
            {#if !isRecording}
              <button class="record-btn" onclick={startRecording}>
                🔴 شروع ضبط
              </button>
            {:else}
              <div class="recording-indicator">
                <span class="blink">🔴</span>
                <span class="time">{formatTime(recordingTime)}</span>
                <button class="stop-btn" onclick={stopRecording}>
                  ⏹️ توقف
                </button>
              </div>
            {/if}
          </div>

          <div class="divider">یا</div>

          <div class="upload-area">
            <label class="upload-btn" for="audio-upload">
              📁 انتخاب فایل صوتی
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
            ✅ {audioFile.name}
            <button class="remove-btn" onclick={() => audioFile = null}>
              ✖️
            </button>
          </div>
        {/if}
      </div>
    </div>

    <!-- تصویر کاور -->
    <div class="section">
      <h3>🖼️ تصویر کاور</h3>
      <div class="cover-area">
        {#if coverFile}
          <div class="cover-preview">
            <img src={URL.createObjectURL(coverFile)} alt="کاور" />
            <button class="remove-btn" onclick={() => coverFile = null}>
              ✖️
            </button>
          </div>
        {:else}
          <label class="upload-btn" for="cover-upload">
            📷 انتخاب تصویر
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
      <h3>📝 اطلاعات موج</h3>
      <input
        type="text"
        class="title-input"
        placeholder="عنوان موج را وارد کنید..."
        bind:value={title}
        maxlength="60"
      />
      <div class="char-count">{title.length}/60</div>

      <select class="category-select" bind:value={category}>
        {#each categories as cat}
          <option value={cat.value}>{cat.label}</option>
        {/each}
      </select>
    </div>

    <!-- دکمه انتشار -->
    <button
      class="publish-btn"
      onclick={publishWave}
      disabled={!audioFile || !title.trim() || isUploading}
    >
      {#if isUploading}
        در حال انتشار...
      {:else}
        📤 انتشار موج
      {/if}
    </button>
  </div>
</div>

<style>
  .create-wave-page {
    min-height: 100vh;
    background: #f0f2f5;
    padding: 16px;
  }

  .container {
    max-width: 600px;
    margin: 0 auto;
    background: white;
    border-radius: 12px;
    padding: 20px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 24px;
    padding-bottom: 12px;
    border-bottom: 1px solid #e4e6eb;
  }

  .header h1 {
    font-size: 20px;
    margin: 0;
    color: #050505;
  }

  .back-btn {
    background: none;
    border: none;
    color: #1877f2;
    font-size: 16px;
    cursor: pointer;
    padding: 8px;
  }

  .back-btn:hover {
    background: #f0f2f5;
    border-radius: 8px;
  }

  .section {
    margin-bottom: 24px;
  }

  .section h3 {
    font-size: 16px;
    margin: 0 0 12px 0;
    color: #65676b;
  }

  .recording-area {
    background: #f7f8fa;
    border-radius: 8px;
    padding: 16px;
    text-align: center;
  }

  .record-btn {
    background: #dc3545;
    color: white;
    border: none;
    padding: 12px 24px;
    border-radius: 8px;
    font-size: 16px;
    cursor: pointer;
  }

  .record-btn:hover {
    background: #c82333;
  }

  .recording-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
  }

  .blink {
    animation: blink 1s infinite;
  }

  @keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
  }

  .time {
    font-size: 24px;
    font-weight: bold;
    color: #050505;
  }

  .stop-btn {
    background: #6c757d;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 8px;
    cursor: pointer;
  }

  .stop-btn:hover {
    background: #5a6268;
  }

  .divider {
    margin: 12px 0;
    color: #65676b;
    font-size: 14px;
  }

  .upload-area {
    margin-top: 8px;
  }

  .upload-btn {
    display: inline-block;
    background: #e4e6eb;
    color: #050505;
    padding: 10px 20px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 14px;
  }

  .upload-btn:hover {
    background: #d8dadf;
  }

  .hidden {
    display: none;
  }

  .file-selected {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 12px;
    background: #e7f3ff;
    border-radius: 8px;
    color: #1877f2;
  }

  .remove-btn {
    background: none;
    border: none;
    color: #65676b;
    cursor: pointer;
    font-size: 18px;
    padding: 0 4px;
  }

  .remove-btn:hover {
    color: #dc3545;
  }

  .cover-area {
    background: #f7f8fa;
    border-radius: 8px;
    padding: 16px;
    text-align: center;
    min-height: 100px;
  }

  .cover-preview {
    position: relative;
    display: inline-block;
  }

  .cover-preview img {
    max-width: 200px;
    max-height: 150px;
    border-radius: 8px;
    object-fit: cover;
  }

  .cover-preview .remove-btn {
    position: absolute;
    top: -8px;
    right: -8px;
    background: white;
    border-radius: 50%;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 1px 3px rgba(0,0,0,0.2);
  }

  .title-input {
    width: 100%;
    padding: 12px;
    border: 1px solid #d0d7de;
    border-radius: 8px;
    font-size: 16px;
    margin-bottom: 4px;
  }

  .title-input:focus {
    outline: none;
    border-color: #1877f2;
  }

  .char-count {
    text-align: right;
    font-size: 12px;
    color: #65676b;
  }

  .category-select {
    width: 100%;
    padding: 12px;
    border: 1px solid #d0d7de;
    border-radius: 8px;
    font-size: 16px;
    margin-top: 8px;
    background: white;
  }

  .category-select:focus {
    outline: none;
    border-color: #1877f2;
  }

  .publish-btn {
    width: 100%;
    background: #1877f2;
    color: white;
    border: none;
    padding: 14px;
    border-radius: 8px;
    font-size: 18px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
  }

  .publish-btn:hover:not(:disabled) {
    background: #1664d8;
  }

  .publish-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
</style>