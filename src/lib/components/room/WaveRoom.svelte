<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { goto } from '$app/navigation'
  import { supabase } from '$lib/client/supabase'
  import { user } from '$lib/stores/user'
  import Avatar from '$lib/components/ui/Avatar.svelte'
  import { 
    getRoomMessages, 
    sendRoomMessage, 
    sendAudioMessage,
    getAudioMessageCount,
    deleteRoomMessage,
    clearRoomMessages,
    type RoomMessage 
  } from '$lib/services/room-service'
  import { formatDistanceToNow } from 'date-fns'
  import { faIR } from 'date-fns/locale'

  // Icon imports
  import {
    Users,
    Mic,
    Send,
    X,
    Clock,
    Pin,
    User,
    LogIn,
    ChevronLeft,
    StopCircle,
    Radio,
    FileAudio,
    MessageCircle,
    Play,
    Pause,
    Trash2,
    Check,
    CheckCheck,
    MoreHorizontal,
    AlertTriangle,
    Trash,
    SquareX
  } from 'lucide-svelte'

  let { 
    waveId,
    waveTitle,
    authorId
  }: {
    waveId: string
    waveTitle: string
    authorId: string
  } = $props()

  let messages = $state<RoomMessage[]>([])
  let newMessage = $state('')
  let loading = $state(true)
  let isSubmitting = $state(false)
  let currentUser = $state<any>(null)
  let onlineUsers = $state<number>(0)
  let audioCount = $state<number>(0)
  
  // Recording state
  let isRecording = $state(false)
  let mediaRecorder: MediaRecorder | null = null
  let audioChunks: Blob[] = []
  let recordingTime = $state(0)
  let recordingTimer: any = null
  let isUploading = $state(false)
  
  // Audio playback state
  let playingAudioId = $state<string | null>(null)
  let audioElements: Map<string, HTMLAudioElement> = new Map()
  let audioProgress = $state<Map<string, number>>(new Map())
  let audioDurations = $state<Map<string, number>>(new Map())

  // Message management state
  let showDeleteModal = $state(false)
  let messageToDelete = $state<RoomMessage | null>(null)
  let isDeleting = $state(false)
  let showClearModal = $state(false)
  let isClearing = $state(false)
  let showMenu = $state<string | null>(null)

  // Subscribe to user store
  $effect(() => {
    const unsubscribe = user.subscribe(value => {
      currentUser = value
    })
    return () => unsubscribe()
  })

  // Get messages
  async function loadMessages() {
    loading = true
    try {
      messages = await getRoomMessages(waveId)
      audioCount = await getAudioMessageCount(waveId)
    } catch (error) {
      console.error('Error loading messages:', error)
    } finally {
      loading = false
    }
  }

  // Send text message
  async function handleSendMessage() {
    if (!currentUser) {
      alert('لطفاً ابتدا وارد شوید.')
      return
    }

    if (!newMessage.trim()) return

    isSubmitting = true
    try {
      const newMsg = await sendRoomMessage(
        waveId,
        currentUser.id,
        newMessage
      )
      messages = [...messages, newMsg]
      newMessage = ''
      
      setTimeout(() => {
        const container = document.querySelector('.messages-container')
        if (container) {
          container.scrollTop = container.scrollHeight
        }
      }, 100)

    } catch (error) {
      console.error('Error sending message:', error)
      alert('خطا در ارسال پیام')
    } finally {
      isSubmitting = false
    }
  }

  // Delete a single message
  async function handleDeleteMessage() {
    if (!messageToDelete || !currentUser) return
    if (messageToDelete.author_id !== currentUser.id) {
      alert('شما اجازه حذف این پیام را ندارید')
      return
    }

    isDeleting = true
    try {
      await deleteRoomMessage(messageToDelete.id, currentUser.id)
      messages = messages.filter(m => m.id !== messageToDelete.id)
      showDeleteModal = false
      messageToDelete = null
      showMenu = null
    } catch (error) {
      console.error('Error deleting message:', error)
      alert('خطا در حذف پیام')
    } finally {
      isDeleting = false
    }
  }

  // Clear all messages
  async function handleClearMessages() {
    if (!currentUser) return
    
    isClearing = true
    try {
      await clearRoomMessages(waveId, currentUser.id)
      messages = []
      showClearModal = false
    } catch (error) {
      console.error('Error clearing messages:', error)
      alert('خطا در پاک کردن پیام‌ها')
    } finally {
      isClearing = false
    }
  }

  // Toggle menu
  function toggleMenu(messageId: string) {
    if (showMenu === messageId) {
      showMenu = null
    } else {
      showMenu = messageId
    }
  }

  // Open delete modal
  function openDeleteModal(message: RoomMessage) {
    if (message.author_id !== currentUser?.id) {
      alert('شما اجازه حذف این پیام را ندارید')
      return
    }
    messageToDelete = message
    showDeleteModal = true
    showMenu = null
  }

  // Open clear modal
  function openClearModal() {
    if (messages.length === 0) {
      alert('هیچ پیامی برای پاک کردن وجود ندارد')
      return
    }
    showClearModal = true
    showMenu = null
  }

  // Start audio recording
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      })
      
      mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      })
      audioChunks = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' })
        await uploadAudioMessage(audioBlob)
        stream.getTracks().forEach(track => track.stop())
        recordingTime = 0
        isRecording = false
        if (recordingTimer) {
          clearInterval(recordingTimer)
          recordingTimer = null
        }
      }

      mediaRecorder.start(1000)
      isRecording = true
      recordingTime = 0

      recordingTimer = setInterval(() => {
        if (isRecording) {
          recordingTime++
        } else {
          clearInterval(recordingTimer)
          recordingTimer = null
        }
      }, 1000)

    } catch (error) {
      console.error('Error accessing microphone:', error)
      alert('لطفاً دسترسی به میکروفون را فعال کنید.')
    }
  }

  // Upload audio message
  async function uploadAudioMessage(audioBlob: Blob) {
    if (!currentUser) {
      alert('لطفاً ابتدا وارد شوید.')
      return
    }

    isUploading = true
    try {
      const fileName = `${Date.now()}_${currentUser.id}.webm`
      const filePath = `room_audio/${waveId}/${fileName}`

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('room_audio')
        .upload(filePath, audioBlob, {
          contentType: 'audio/webm',
          cacheControl: '3600'
        })

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage
        .from('room_audio')
        .getPublicUrl(filePath)

      const audioUrl = urlData.publicUrl

      const newMsg = await sendAudioMessage(
        waveId,
        currentUser.id,
        audioUrl,
        recordingTime
      )
      
      messages = [...messages, newMsg]
      
      setTimeout(() => {
        const container = document.querySelector('.messages-container')
        if (container) {
          container.scrollTop = container.scrollHeight
        }
      }, 100)

    } catch (error) {
      console.error('Error uploading audio:', error)
      alert('خطا در ارسال پیام صوتی. لطفاً دوباره تلاش کنید.')
    } finally {
      isUploading = false
    }
  }

  function stopRecording() {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop()
      isRecording = false
      if (recordingTimer) {
        clearInterval(recordingTimer)
        recordingTimer = null
      }
    }
  }

  function cancelRecording() {
    if (mediaRecorder && isRecording) {
      mediaRecorder.onstop = () => {
        audioChunks = []
        isRecording = false
        recordingTime = 0
        if (recordingTimer) {
          clearInterval(recordingTimer)
          recordingTimer = null
        }
      }
      mediaRecorder.stop()
    }
  }

  // Toggle audio playback
  function toggleAudioPlayback(messageId: string, audioUrl: string) {
    if (playingAudioId === messageId) {
      const audio = audioElements.get(messageId)
      if (audio) {
        audio.pause()
        audio.currentTime = 0
      }
      playingAudioId = null
      audioProgress.set(messageId, 0)
      return
    }

    if (playingAudioId) {
      const prevAudio = audioElements.get(playingAudioId)
      if (prevAudio) {
        prevAudio.pause()
        prevAudio.currentTime = 0
      }
    }

    let audio = audioElements.get(messageId)
    if (!audio) {
      audio = new Audio(audioUrl)
      audioElements.set(messageId, audio)
      
      audio.addEventListener('timeupdate', () => {
        if (audio.duration) {
          const progress = (audio.currentTime / audio.duration) * 100
          audioProgress.set(messageId, progress)
        }
      })
      
      audio.addEventListener('ended', () => {
        playingAudioId = null
        audioProgress.set(messageId, 0)
      })
      
      audio.addEventListener('loadedmetadata', () => {
        audioDurations.set(messageId, audio.duration)
      })
    }

    audio.play().catch(err => console.warn('Play error:', err))
    playingAudioId = messageId
  }

  // Format time
  function formatTime(date: string): string {
    try {
      return formatDistanceToNow(new Date(date), { 
        addSuffix: true,
        locale: faIR
      })
    } catch {
      return 'چندی پیش'
    }
  }

  function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${String(secs).padStart(2, '0')}`
  }

  // Scroll to bottom
  function scrollToBottom() {
    setTimeout(() => {
      const container = document.querySelector('.messages-container')
      if (container) {
        container.scrollTop = container.scrollHeight
      }
    }, 100)
  }

  // Connect to WebSocket for real-time messages
  let subscription: any = null

  function setupRealtime() {
    // Subscribe to text messages
    const textSubscription = supabase
      .channel(`room_text:${waveId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'room_messages',
          filter: `wave_id=eq.${waveId}`
        },
        (payload) => {
          const newMsg = payload.new as RoomMessage
          supabase
            .from('users')
            .select('id, name, username, avatar')
            .eq('id', newMsg.author_id)
            .single()
            .then(({ data }) => {
              if (data) {
                messages = [...messages, { 
                  ...newMsg, 
                  author: data,
                  is_audio: false,
                  audio_url: null,
                  duration: null
                }]
                scrollToBottom()
              }
            })
        }
      )
      .subscribe()

    // Subscribe to audio messages
    const audioSubscription = supabase
      .channel(`room_audio:${waveId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'room_audio_messages',
          filter: `wave_id=eq.${waveId}`
        },
        (payload) => {
          const newMsg = payload.new
          supabase
            .from('users')
            .select('id, name, username, avatar')
            .eq('id', newMsg.author_id)
            .single()
            .then(({ data }) => {
              if (data) {
                const audioMessage: RoomMessage = {
                  id: newMsg.id,
                  content: null,
                  wave_id: newMsg.wave_id,
                  author_id: newMsg.author_id,
                  audio_url: newMsg.audio_url,
                  duration: newMsg.duration,
                  is_audio: true,
                  is_pinned: false,
                  created_at: newMsg.created_at,
                  author: data
                }
                messages = [...messages, audioMessage]
                scrollToBottom()
              }
            })
        }
      )
      .subscribe()

    subscription = [textSubscription, audioSubscription]
  }

  // Initial load
  onMount(async () => {
    await loadMessages()
    setupRealtime()
  })

  onDestroy(() => {
    if (subscription) {
      if (Array.isArray(subscription)) {
        subscription.forEach(sub => supabase.removeChannel(sub))
      } else {
        supabase.removeChannel(subscription)
      }
    }
    audioElements.forEach((audio) => {
      audio.pause()
      audio.src = ''
    })
    audioElements.clear()
    if (recordingTimer) {
      clearInterval(recordingTimer)
    }
  })
</script>

<div class="wave-room">
  <!-- Room Header -->
  <div class="room-header">
    <div class="room-header-left">
      <button class="back-btn" onclick={() => goto(`/wave/${waveId}`)}>
        <ChevronLeft size={20} />
      </button>
      <div class="room-title">
        <Radio size={18} />
        <h3>{waveTitle}</h3>
        <span class="message-count">{messages.length}</span>
      </div>
    </div>
    <div class="room-info">
      <span class="info-item">
        <Users size={14} />
        {onlineUsers} نفر
      </span>
      <span class="info-item">
        <FileAudio size={14} />
        {audioCount}/50
      </span>
      {#if messages.length > 0 && currentUser}
        <button class="clear-btn" onclick={openClearModal} title="پاک کردن همه پیام‌ها">
          <Trash size={14} />
        </button>
      {/if}
    </div>
  </div>

  <!-- Messages -->
  <div class="messages-container">
    {#if loading}
      <div class="loading">
        <div class="spinner"></div>
        <span>در حال بارگذاری پیام‌ها...</span>
      </div>
    {:else if messages.length === 0}
      <div class="empty">
        <MessageCircle size={48} />
        <p>هنوز پیامی ارسال نشده است</p>
        <span>اولین نفر باشید!</span>
      </div>
    {:else}
      {#each messages as message (message.id)}
        <div class="message-item {message.author_id === currentUser?.id ? 'own' : ''}">
          <Avatar src={message.author?.avatar} size="sm" />
          <div class="message-content">
            <div class="message-header">
              <span 
                class="message-author"
                onclick={() => goto(`/profile/${message.author?.username}`)}
              >
                {message.author?.name || 'ناشناس'}
              </span>
              <span class="message-time">
                <Clock size={12} />
                {formatTime(message.created_at)}
              </span>
              {#if message.is_pinned}
                <span class="pinned-badge">
                  <Pin size={12} />
                </span>
              {/if}
              
              <!-- More options button (only for own messages) -->
              {#if message.author_id === currentUser?.id}
                <div class="message-options">
                  <button 
                    class="options-btn" 
                    onclick={(e) => {
                      e.stopPropagation()
                      toggleMenu(message.id)
                    }}
                    title="بیشتر"
                  >
                    <MoreHorizontal size={14} />
                  </button>
                  
                  {#if showMenu === message.id}
                    <div class="dropdown-menu">
                      <button 
                        class="dropdown-item delete-item" 
                        onclick={() => openDeleteModal(message)}
                      >
                        <Trash2 size={16} />
                        حذف پیام
                      </button>
                    </div>
                  {/if}
                </div>
              {/if}
            </div>
            
            {#if message.audio_url}
              <!-- Audio Message -->
              <div class="audio-message">
                <button 
                  class="play-audio-btn {playingAudioId === message.id ? 'playing' : ''}"
                  onclick={() => toggleAudioPlayback(message.id, message.audio_url!)}
                >
                  {#if playingAudioId === message.id}
                    <Pause size={18} />
                  {:else}
                    <Play size={18} />
                  {/if}
                </button>
                <div class="audio-progress-wrapper">
                  <div class="audio-progress-bar">
                    <div 
                      class="audio-progress-fill" 
                      style="width: {audioProgress.get(message.id) || 0}%"
                    ></div>
                  </div>
                  <span class="audio-duration">
                    {formatDuration(message.duration || 0)}
                  </span>
                </div>
              </div>
            {:else}
              <!-- Text Message -->
              <p class="message-text">{message.content}</p>
            {/if}
          </div>
        </div>
      {/each}
    {/if}
  </div>

  <!-- Message Input -->
  {#if currentUser}
    <div class="message-input-wrapper">
      <button 
        class="record-btn {isRecording ? 'recording' : ''}" 
        onclick={isRecording ? stopRecording : startRecording}
        title={isRecording ? 'توقف ضبط' : 'ضبط پیام صوتی'}
        disabled={isUploading}
      >
        {#if isRecording}
          <StopCircle size={20} />
        {:else}
          <Mic size={20} />
        {/if}
      </button>
      
      {#if isRecording}
        <div class="recording-indicator">
          <span class="recording-dot"></span>
          <span class="recording-time">{formatDuration(recordingTime)}</span>
          <button class="cancel-record" onclick={cancelRecording}>
            <X size={16} />
          </button>
        </div>
      {:else if isUploading}
        <div class="uploading-indicator">
          <div class="spinner-small"></div>
          <span>در حال ارسال...</span>
        </div>
      {/if}

      <input
        type="text"
        class="message-input"
        placeholder="پیام خود را بنویسید..."
        bind:value={newMessage}
        onkeydown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSendMessage()
          }
        }}
        disabled={isSubmitting || isRecording || isUploading}
      />
      
      <button 
        class="send-btn"
        onclick={handleSendMessage}
        disabled={!newMessage.trim() || isSubmitting || isRecording || isUploading}
      >
        {#if isSubmitting}
          <div class="spinner-small"></div>
        {:else}
          <Send size={18} />
        {/if}
      </button>
    </div>
  {:else}
    <div class="login-prompt">
      <LogIn size={16} />
      <a href="/auth/login">وارد شوید</a>
      <span>تا بتوانید در اتاق پیام دهید</span>
    </div>
  {/if}
</div>

<!-- Delete Message Modal -->
{#if showDeleteModal}
  <div class="modal-overlay" onclick={() => { showDeleteModal = false; messageToDelete = null; }}>
    <div class="modal-content" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <AlertTriangle size={24} color="#ef4444" />
        <h3>حذف پیام</h3>
        <button class="modal-close" onclick={() => { showDeleteModal = false; messageToDelete = null; }}>
          <X size={20} />
        </button>
      </div>
      
      <div class="modal-body">
        <p>آیا از حذف این پیام اطمینان دارید؟</p>
        <p class="modal-message-preview">
          "{messageToDelete?.audio_url ? 'پیام صوتی' : messageToDelete?.content}"
        </p>
        <p class="modal-warning">این عمل قابل بازگشت نیست.</p>
      </div>

      <div class="modal-actions">
        <button class="cancel-btn" onclick={() => { showDeleteModal = false; messageToDelete = null; }}>
          انصراف
        </button>
        <button 
          class="confirm-btn delete-confirm" 
          onclick={handleDeleteMessage}
          disabled={isDeleting}
        >
          {#if isDeleting}
            <span class="spinner-small"></span>
            در حال حذف...
          {:else}
            <Trash2 size={16} />
            حذف
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Clear Messages Modal -->
{#if showClearModal}
  <div class="modal-overlay" onclick={() => showClearModal = false}>
    <div class="modal-content" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <SquareX size={24} color="#ef4444" />
        <h3>پاک کردن همه پیام‌ها</h3>
        <button class="modal-close" onclick={() => showClearModal = false}>
          <X size={20} />
        </button>
      </div>
      
      <div class="modal-body">
        <p>آیا از پاک کردن همه پیام‌های این اتاق اطمینان دارید؟</p>
        <p class="modal-warning">
          <AlertTriangle size={16} />
          این عمل {messages.length} پیام را به طور کامل حذف می‌کند و قابل بازگشت نیست.
        </p>
      </div>

      <div class="modal-actions">
        <button class="cancel-btn" onclick={() => showClearModal = false}>
          انصراف
        </button>
        <button 
          class="confirm-btn clear-confirm" 
          onclick={handleClearMessages}
          disabled={isClearing}
        >
          {#if isClearing}
            <span class="spinner-small"></span>
            در حال پاک کردن...
          {:else}
            <Trash size={16} />
            پاک کردن همه
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .wave-room {
    background: white;
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 2px 12px rgba(0,0,0,0.06);
    height: 500px;
    display: flex;
    flex-direction: column;
    border: 1px solid #f1f5f9;
  }

  /* Header */
  .room-header {
    padding: 14px 16px;
    border-bottom: 1px solid #f1f5f9;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    background: #fafbfc;
    flex-shrink: 0;
  }

  .room-header-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .back-btn {
    background: none;
    border: none;
    color: #64748b;
    cursor: pointer;
    padding: 4px;
    border-radius: 8px;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .back-btn:hover {
    background: #f1f5f9;
    color: #1a1a2e;
  }

  .room-title {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .room-title :global(svg) {
    color: #6366f1;
  }

  .room-header h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: #1a1a2e;
  }

  .message-count {
    font-size: 11px;
    color: #94a3b8;
    background: #f1f5f9;
    padding: 2px 8px;
    border-radius: 12px;
  }

  .room-info {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .info-item {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: #94a3b8;
  }

  .info-item :global(svg) {
    color: #94a3b8;
  }

  .clear-btn {
    background: none;
    border: none;
    color: #94a3b8;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 6px;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .clear-btn:hover {
    background: #fee2e2;
    color: #ef4444;
  }

  /* Messages Container */
  .messages-container {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    background: #fafbfc;
  }

  .messages-container::-webkit-scrollbar {
    width: 4px;
  }

  .messages-container::-webkit-scrollbar-track {
    background: transparent;
  }

  .messages-container::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 2px;
  }

  .loading, .empty {
    text-align: center;
    padding: 40px 20px;
    color: #94a3b8;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .empty p {
    margin: 0;
    font-weight: 500;
    color: #64748b;
  }

  .empty span {
    font-size: 13px;
    color: #94a3b8;
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid #e2e8f0;
    border-top-color: #6366f1;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  /* Message Item */
  .message-item {
    display: flex;
    gap: 10px;
    max-width: 85%;
    animation: fadeIn 0.3s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .message-item.own {
    align-self: flex-end;
    flex-direction: row-reverse;
  }

  .message-item.own .message-content {
    background: #eef2ff;
    border-radius: 12px 12px 4px 12px;
  }

  .message-content {
    background: white;
    padding: 10px 14px;
    border-radius: 12px 12px 12px 4px;
    flex: 1;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    border: 1px solid #f1f5f9;
    position: relative;
  }

  .message-item.own .message-content {
    border-color: #c7d2fe;
  }

  .message-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
    flex-wrap: wrap;
  }

  .message-author {
    font-weight: 600;
    font-size: 13px;
    color: #1a1a2e;
    cursor: pointer;
    transition: color 0.2s;
  }

  .message-author:hover {
    color: #6366f1;
  }

  .message-time {
    display: flex;
    align-items: center;
    gap: 3px;
    font-size: 11px;
    color: #94a3b8;
  }

  .message-time :global(svg) {
    color: #94a3b8;
  }

  .pinned-badge {
    display: flex;
    align-items: center;
  }

  .pinned-badge :global(svg) {
    color: #f59e0b;
  }

  .message-text {
    margin: 0;
    font-size: 14px;
    color: #1a1a2e;
    word-wrap: break-word;
    line-height: 1.5;
  }

  /* Message Options */
  .message-options {
    position: relative;
    margin-right: auto;
  }

  .options-btn {
    background: none;
    border: none;
    color: #94a3b8;
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 4px;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .options-btn:hover {
    background: #f1f5f9;
    color: #1a1a2e;
  }

  .dropdown-menu {
    position: absolute;
    top: 100%;
    right: 0;
    background: white;
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.12);
    border: 1px solid #f1f5f9;
    min-width: 150px;
    padding: 4px;
    z-index: 10;
    animation: slideDown 0.2s ease;
  }

  @keyframes slideDown {
    from { opacity: 0; transform: translateY(-8px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .dropdown-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border: none;
    background: none;
    width: 100%;
    cursor: pointer;
    border-radius: 6px;
    font-size: 13px;
    font-family: inherit;
    transition: all 0.15s;
    color: #1a1a2e;
  }

  .dropdown-item:hover {
    background: #f1f5f9;
  }

  .dropdown-item.delete-item {
    color: #ef4444;
  }

  .dropdown-item.delete-item:hover {
    background: #fee2e2;
  }

  /* Audio Message */
  .audio-message {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 4px 0;
    min-width: 180px;
  }

  .play-audio-btn {
    background: #6366f1;
    border: none;
    color: white;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
    flex-shrink: 0;
  }

  .play-audio-btn:hover {
    background: #4f46e5;
    transform: scale(1.05);
  }

  .play-audio-btn.playing {
    background: #ef4444;
  }

  .play-audio-btn.playing:hover {
    background: #dc2626;
  }

  .audio-progress-wrapper {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .audio-progress-bar {
    flex: 1;
    height: 4px;
    background: #e2e8f0;
    border-radius: 2px;
    overflow: hidden;
    cursor: pointer;
  }

  .audio-progress-fill {
    height: 100%;
    background: #6366f1;
    border-radius: 2px;
    transition: width 0.1s linear;
  }

  .play-audio-btn.playing .audio-progress-fill {
    background: #ef4444;
  }

  .audio-duration {
    font-size: 12px;
    color: #94a3b8;
    font-variant-numeric: tabular-nums;
    min-width: 32px;
    text-align: center;
  }

  /* Input */
  .message-input-wrapper {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    border-top: 1px solid #f1f5f9;
    background: white;
    flex-shrink: 0;
  }

  .record-btn {
    background: none;
    border: none;
    color: #64748b;
    cursor: pointer;
    padding: 8px;
    border-radius: 50%;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .record-btn:hover:not(:disabled) {
    background: #f1f5f9;
    color: #1a1a2e;
  }

  .record-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .record-btn.recording {
    background: #fee2e2;
    color: #ef4444;
    animation: pulse 1.5s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.08); }
  }

  .recording-indicator {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 12px 4px 8px;
    background: #fef2f2;
    border-radius: 20px;
    border: 1px solid #fecaca;
    flex-shrink: 0;
  }

  .recording-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #ef4444;
    animation: blink 1s ease-in-out infinite;
  }

  @keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }

  .recording-time {
    font-size: 14px;
    font-weight: 600;
    color: #ef4444;
    font-variant-numeric: tabular-nums;
    min-width: 40px;
  }

  .cancel-record {
    background: none;
    border: none;
    color: #94a3b8;
    cursor: pointer;
    padding: 4px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }

  .cancel-record:hover {
    background: #f1f5f9;
    color: #ef4444;
  }

  .uploading-indicator {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: #94a3b8;
    padding: 4px 12px;
    background: #f8fafc;
    border-radius: 20px;
    border: 1px solid #e2e8f0;
    flex-shrink: 0;
  }

  .message-input {
    flex: 1;
    border: 1px solid #e2e8f0;
    background: #f8fafc;
    padding: 8px 16px;
    border-radius: 24px;
    font-size: 14px;
    outline: none;
    transition: all 0.2s;
    font-family: inherit;
    color: #1a1a2e;
    min-width: 0;
  }

  .message-input:focus {
    border-color: #6366f1;
    background: white;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
  }

  .message-input::placeholder {
    color: #94a3b8;
  }

  .message-input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .send-btn {
    background: #6366f1;
    color: white;
    border: none;
    width: 38px;
    height: 38px;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
    flex-shrink: 0;
  }

  .send-btn:hover:not(:disabled) {
    background: #4f46e5;
    transform: scale(1.05);
  }

  .send-btn:active:not(:disabled) {
    transform: scale(0.95);
  }

  .send-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    transform: none;
  }

  .send-btn :global(svg) {
    color: white;
  }

  .spinner-small {
    width: 18px;
    height: 18px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Login Prompt */
  .login-prompt {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 14px 16px;
    background: #f8fafc;
    border-top: 1px solid #f1f5f9;
    color: #94a3b8;
    font-size: 13px;
    flex-shrink: 0;
  }

  .login-prompt :global(svg) {
    color: #94a3b8;
  }

  .login-prompt a {
    color: #6366f1;
    text-decoration: none;
    font-weight: 600;
    transition: color 0.2s;
  }

  .login-prompt a:hover {
    color: #4f46e5;
  }

  /* Modals */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.6);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    animation: fadeIn 0.2s ease;
    padding: 16px;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .modal-content {
    background: white;
    border-radius: 20px;
    padding: 24px;
    max-width: 420px;
    width: 100%;
    animation: slideUp 0.3s ease;
    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
  }

  @keyframes slideUp {
    from { transform: translateY(20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }

  .modal-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
  }

  .modal-header h3 {
    margin: 0;
    flex: 1;
    font-size: 18px;
    font-weight: 700;
    color: #1a1a2e;
  }

  .modal-close {
    background: none;
    border: none;
    color: #94a3b8;
    cursor: pointer;
    padding: 4px;
    border-radius: 50%;
    transition: all 0.2s ease;
  }

  .modal-close:hover {
    background: #f1f5f9;
  }

  .modal-body {
    margin-bottom: 20px;
  }

  .modal-body p {
    margin: 8px 0;
    color: #475569;
    font-size: 15px;
  }

  .modal-message-preview {
    padding: 12px;
    background: #f8fafc;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
    color: #1a1a2e !important;
    font-weight: 500;
  }

  .modal-warning {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #ef4444 !important;
    font-size: 13px !important;
    padding: 8px 12px;
    background: #fef2f2;
    border-radius: 8px;
    margin-top: 12px !important;
  }

  .modal-actions {
    display: flex;
    gap: 12px;
  }

  .cancel-btn {
    flex: 1;
    padding: 12px;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    background: white;
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
    color: #64748b;
    transition: all 0.2s ease;
  }

  .cancel-btn:hover {
    background: #f1f5f9;
  }

  .confirm-btn {
    flex: 2;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px;
    border: none;
    border-radius: 10px;
    color: white;
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
    transition: all 0.2s ease;
  }

  .confirm-btn.delete-confirm {
    background: #ef4444;
  }

  .confirm-btn.delete-confirm:hover:not(:disabled) {
    background: #dc2626;
    transform: scale(1.02);
  }

  .confirm-btn.clear-confirm {
    background: #ef4444;
  }

  .confirm-btn.clear-confirm:hover:not(:disabled) {
    background: #dc2626;
    transform: scale(1.02);
  }

  .confirm-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }

  /* Responsive */
  @media (max-width: 480px) {
    .wave-room {
      height: 400px;
      border-radius: 12px;
    }

    .room-header {
      padding: 10px 12px;
    }

    .room-header h3 {
      font-size: 14px;
    }

    .room-info {
      gap: 8px;
    }

    .info-item {
      font-size: 11px;
    }

    .messages-container {
      padding: 12px;
    }

    .message-item {
      max-width: 92%;
    }

    .message-content {
      padding: 8px 12px;
    }

    .message-author {
      font-size: 12px;
    }

    .message-text {
      font-size: 13px;
    }

    .message-input-wrapper {
      padding: 8px 12px;
    }

    .message-input {
      font-size: 13px;
      padding: 6px 12px;
    }

    .send-btn {
      width: 34px;
      height: 34px;
    }

    .send-btn :global(svg) {
      width: 16px;
      height: 16px;
    }

    .record-btn {
      padding: 6px;
    }

    .record-btn :global(svg) {
      width: 18px;
      height: 18px;
    }

    .audio-message {
      min-width: 140px;
    }

    .play-audio-btn {
      width: 30px;
      height: 30px;
    }

    .play-audio-btn :global(svg) {
      width: 14px;
      height: 14px;
    }

    .recording-indicator {
      padding: 2px 8px 2px 6px;
    }

    .recording-time {
      font-size: 12px;
      min-width: 32px;
    }

    .modal-content {
      padding: 16px;
      margin: 16px;
    }

    .dropdown-menu {
      right: -8px;
      min-width: 130px;
    }
  }
</style>