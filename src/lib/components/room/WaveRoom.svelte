<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { supabase } from '$lib/client/supabase'
  import { user } from '$lib/stores/user'
  import Avatar from '$lib/components/ui/Avatar.svelte'
  import { 
    getRoomMessages, 
    sendRoomMessage, 
    getAudioMessageCount,
    type RoomMessage 
  } from '$lib/services/room-service'
  import { formatDistanceToNow } from 'date-fns'
  import { faIR } from 'date-fns/locale'

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
  let isRecording = $state(false)
  let mediaRecorder: MediaRecorder | null = null
  let audioChunks: Blob[] = []
  let recordingTime = $state(0)

  // اشتراک‌گذاری در store کاربر
  $effect(() => {
    const unsubscribe = user.subscribe(value => {
      currentUser = value
    })
    return () => unsubscribe()
  })

  // دریافت پیام‌ها
  async function loadMessages() {
    loading = true
    try {
      messages = await getRoomMessages(waveId)
      audioCount = await getAudioMessageCount(waveId)
    } catch (error) {
      console.error('خطا در دریافت پیام‌ها:', error)
    } finally {
      loading = false
    }
  }

  // ارسال پیام
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
      
      // اسکرول به پایین
      setTimeout(() => {
        const container = document.querySelector('.messages-container')
        if (container) {
          container.scrollTop = container.scrollHeight
        }
      }, 100)

    } catch (error) {
      console.error('خطا در ارسال پیام:', error)
      alert('خطا در ارسال پیام')
    } finally {
      isSubmitting = false
    }
  }

  // شروع ضبط صوتی
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

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' })
        // TODO: آپلود فایل صوتی به Supabase Storage
        // و ارسال پیام صوتی
        stream.getTracks().forEach(track => track.stop())
        recordingTime = 0
        isRecording = false
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

  function stopRecording() {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop()
      isRecording = false
    }
  }

  // فرمت زمان
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

  // اتصال به WebSocket برای پیام‌های زنده
  let subscription: any = null

  function setupRealtime() {
    subscription = supabase
      .channel(`room:${waveId}`)
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
          // دریافت اطلاعات نویسنده
          supabase
            .from('users')
            .select('id, name, username, avatar')
            .eq('id', newMsg.author_id)
            .single()
            .then(({ data }) => {
              if (data) {
                messages = [...messages, { ...newMsg, author: data }]
                // اسکرول به پایین
                setTimeout(() => {
                  const container = document.querySelector('.messages-container')
                  if (container) {
                    container.scrollTop = container.scrollHeight
                  }
                }, 100)
              }
            })
        }
      )
      .subscribe()
  }

  // بارگذاری اولیه
  onMount(async () => {
    await loadMessages()
    setupRealtime()
  })

  onDestroy(() => {
    if (subscription) {
      supabase.removeChannel(subscription)
    }
  })
</script>

<div class="wave-room">
  <!-- هدر اتاق -->
  <div class="room-header">
    <h3>🏠 اتاق: {waveTitle}</h3>
    <div class="room-info">
      <span>👥 {onlineUsers} نفر آنلاین</span>
      <span>🎤 {audioCount}/50 پیام صوتی</span>
    </div>
  </div>

  <!-- پیام‌ها -->
  <div class="messages-container">
    {#if loading}
      <div class="loading">⏳ در حال بارگذاری پیام‌ها...</div>
    {:else if messages.length === 0}
      <div class="empty">هنوز پیامی ارسال نشده است. اولین نفر باشید! 💬</div>
    {:else}
      {#each messages as message (message.id)}
        <div class="message-item {message.author_id === currentUser?.id ? 'own' : ''}">
          <Avatar src={message.author?.avatar} size="sm" />
          <div class="message-content">
 <!-- در بخش message -->
<div class="message-header">
  <span 
    class="message-author"
    onclick={() => goto(`/profile/${message.author?.username}`)}
    style="cursor: pointer;"
  >
    {message.author?.name || 'ناشناس'}
  </span>
  <span class="message-time">{formatTime(message.created_at)}</span>
  {#if message.is_pinned}
    <span class="pinned-badge">📌</span>
  {/if}
</div>
            <p class="message-text">{message.content}</p>
          </div>
        </div>
      {/each}
    {/if}
  </div>

  <!-- Input ارسال پیام -->
  {#if currentUser}
    <div class="message-input-wrapper">
      <button 
        class="record-btn {isRecording ? 'recording' : ''}" 
        onclick={isRecording ? stopRecording : startRecording}
        title={isRecording ? 'توقف ضبط' : 'ضبط پیام صوتی'}
      >
        {isRecording ? '⏹️' : '🎤'}
      </button>
      
      {#if isRecording}
        <span class="recording-indicator">
          🔴 {recordingTime}s
        </span>
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
        disabled={isSubmitting}
      />
      
      <button 
        class="send-btn"
        onclick={handleSendMessage}
        disabled={!newMessage.trim() || isSubmitting}
      >
        {isSubmitting ? '⏳' : '📤'}
      </button>
    </div>
  {:else}
    <div class="login-prompt">
      <a href="/auth/login">وارد شوید</a> تا بتوانید در اتاق پیام دهید
    </div>
  {/if}
</div>

<style>
  .wave-room {
    background: white;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    height: 500px;
    display: flex;
    flex-direction: column;
  }

  .room-header {
    padding: 16px;
    border-bottom: 1px solid #e4e6eb;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
  }

  .room-header h3 {
    margin: 0;
    font-size: 18px;
    color: #050505;
  }

  .room-info {
    display: flex;
    gap: 12px;
    font-size: 13px;
    color: #65676b;
  }

  .messages-container {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .messages-container::-webkit-scrollbar {
    width: 6px;
  }

  .messages-container::-webkit-scrollbar-track {
    background: #f0f2f5;
  }

  .messages-container::-webkit-scrollbar-thumb {
    background: #d0d7de;
    border-radius: 3px;
  }

  .loading, .empty {
    text-align: center;
    padding: 40px 20px;
    color: #65676b;
  }

  .message-item {
    display: flex;
    gap: 12px;
    max-width: 80%;
  }

  .message-item.own {
    align-self: flex-end;
    flex-direction: row-reverse;
  }

  .message-item.own .message-content {
    background: #e7f3ff;
    border-radius: 12px 12px 4px 12px;
  }

  .message-content {
    background: #f0f2f5;
    padding: 8px 12px;
    border-radius: 12px 12px 12px 4px;
    flex: 1;
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
    color: #050505;
  }

  .message-time {
    font-size: 11px;
    color: #65676b;
  }

  .pinned-badge {
    font-size: 12px;
  }

  .message-text {
    margin: 0;
    font-size: 14px;
    color: #050505;
    word-wrap: break-word;
  }

  .message-input-wrapper {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    border-top: 1px solid #e4e6eb;
    background: #f7f8fa;
  }

  .record-btn {
    background: none;
    border: none;
    font-size: 20px;
    cursor: pointer;
    padding: 8px;
    border-radius: 50%;
    transition: all 0.2s;
  }

  .record-btn:hover {
    background: #e4e6eb;
  }

  .record-btn.recording {
    background: #fee;
    color: #dc3545;
    animation: pulse 1s infinite;
  }

  @keyframes pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.1); }
  }

  .recording-indicator {
    font-size: 14px;
    color: #dc3545;
    font-weight: 600;
  }

  .message-input {
    flex: 1;
    border: none;
    background: white;
    padding: 8px 16px;
    border-radius: 20px;
    font-size: 14px;
    outline: none;
  }

  .message-input:focus {
    box-shadow: 0 0 0 2px #1877f2;
  }

  .send-btn {
    background: #1877f2;
    color: white;
    border: none;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .send-btn:hover:not(:disabled) {
    background: #1664d8;
  }

  .send-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .login-prompt {
    text-align: center;
    padding: 16px;
    background: #f7f8fa;
    color: #65676b;
  }

  .login-prompt a {
    color: #1877f2;
    text-decoration: none;
    font-weight: 600;
  }
</style>