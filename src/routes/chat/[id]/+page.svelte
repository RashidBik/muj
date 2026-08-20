<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { goto } from '$app/navigation'
  import { page } from '$app/stores'
  import { supabase } from '$lib/client/supabase'
  import { user } from '$lib/stores/user'
  import Avatar from '$lib/components/ui/Avatar.svelte'
  import { 
    getConversationMessages, 
    sendMessage, 
    markMessagesAsRead,
    getUsersStatus,
    getUserConversations
  } from '$lib/services/chat-service'
  import type { Message } from '$lib/services/chat-service'
  import { formatDistanceToNow } from 'date-fns'
  import { faIR } from 'date-fns/locale'

  // Icon imports
  import {
    ArrowLeft,
    Phone,
    Video,
    MoreHorizontal,
    Send,
    User,
    Check,
    CheckCheck,
    Mic,
    Image,
    Smile,
    X,
    MessageCircle
  } from 'lucide-svelte'

  let conversationId = $state('')
  let messages = $state<Message[]>([])
  let newMessage = $state('')
  let loading = $state(true)
  let currentUser = $state<any>(null)
  let otherUser = $state<any>(null)
  let isOnline = $state(false)
  let isSending = $state(false)
  let messagesEnd: HTMLDivElement | null = null
  let hasMarkedRead = $state(false)
  let subscription: any = null

  // اشتراک‌گذاری در store کاربر
  $effect(() => {
    const unsubscribe = user.subscribe(value => {
      currentUser = value
    })
    return () => unsubscribe()
  })

  // ✅ دریافت اطلاعات مکالمه
  async function loadChat() {
    if (!currentUser) {
      goto('/auth/login')
      return
    }

    conversationId = $page.params.id
    loading = true
    hasMarkedRead = false

    try {
      // دریافت پیام‌ها
      const msgs = await getConversationMessages(conversationId)
      messages = msgs

      // دریافت شرکت‌کنندگان
      const { data: participants } = await supabase
        .from('conversation_participants')
        .select(`
          user:users(
            id,
            name,
            username,
            avatar
          )
        `)
        .eq('conversation_id', conversationId)
        .neq('user_id', currentUser.id)
        .single()

      if (participants) {
        otherUser = participants.user
        
        // بررسی وضعیت آنلاین
        try {
          const status = await getUsersStatus([otherUser.id])
          isOnline = status[otherUser.id] || false
        } catch (error) {
          console.warn('Could not get user status:', error)
          isOnline = false
        }
      }

      // ✅ علامت‌گذاری پیام‌ها به عنوان خوانده شده
      await markMessagesAsRead(conversationId, currentUser.id)
      hasMarkedRead = true

      // ✅ به‌روزرسانی تعداد پیام‌های خوانده نشده در هدر
      await updateGlobalUnreadCount()

      // اسکرول به پایین
      setTimeout(scrollToBottom, 100)

    } catch (error) {
      console.error('Error loading chat:', error)
    } finally {
      loading = false
    }
  }

  // ✅ به‌روزرسانی تعداد کل پیام‌های خوانده نشده
  async function updateGlobalUnreadCount() {
    if (!currentUser) return
    
    try {
      const convs = await getUserConversations(currentUser.id)
      const totalUnread = convs.reduce((acc, c) => acc + (c.unread_count || 0), 0)
      
      // ارسال رویداد برای به‌روزرسانی هدر
      window.dispatchEvent(new CustomEvent('chat-unread-count', { 
        detail: totalUnread 
      }))
    } catch (error) {
      console.error('Error updating unread count:', error)
    }
  }

  // ✅ ارسال پیام
  async function handleSendMessage() {
    if (!currentUser || !newMessage.trim() || isSending) return

    isSending = true
    const content = newMessage.trim()
    newMessage = ''

    try {
      const sentMessage = await sendMessage(conversationId, currentUser.id, content)
      if (sentMessage) {
        messages = [...messages, sentMessage]
        setTimeout(scrollToBottom, 100)
        
        // ✅ به‌روزرسانی تعداد پیام‌های خوانده نشده
        await updateGlobalUnreadCount()
      }
    } catch (error) {
      console.error('Error sending message:', error)
      newMessage = content // بازگرداندن پیام در صورت خطا
    } finally {
      isSending = false
    }
  }

  // ✅ اسکرول به پایین
  function scrollToBottom() {
    if (messagesEnd) {
      messagesEnd.scrollIntoView({ behavior: 'smooth' })
    }
  }

  // ✅ فرمت زمان
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

  // ✅ وضعیت پیام
  function getMessageStatus(message: Message): string {
    if (message.sender_id !== currentUser?.id) return ''
    return message.is_read ? 'خوانده شده ✓✓' : 'ارسال شده ✓'
  }

  // ✅ پیاده‌سازی Realtime
  function setupRealtime() {
    if (!conversationId) return

    // Clean up existing subscription if any
    if (subscription) {
      supabase.removeChannel(subscription)
      subscription = null
    }

    subscription = supabase
      .channel(`chat:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        async (payload) => {
          // دریافت پیام جدید با اطلاعات کاربر
          const { data, error } = await supabase
            .from('messages')
            .select(`
              *,
              sender:users(
                id,
                name,
                username,
                avatar
              )
            `)
            .eq('id', payload.new.id)
            .single()

          if (!error && data) {
            // ✅ اضافه کردن پیام به لیست
            messages = [...messages, data]
            setTimeout(scrollToBottom, 100)

            // ✅ علامت‌گذاری به عنوان خوانده شده اگر کاربر گیرنده باشد
            if (data.sender_id !== currentUser?.id) {
              await markMessagesAsRead(conversationId, currentUser.id)
              
              // ✅ به‌روزرسانی تعداد پیام‌های خوانده نشده
              await updateGlobalUnreadCount()
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        async (payload) => {
          // ✅ به‌روزرسانی وضعیت پیام‌ها (وقتی خوانده می‌شوند)
          const updatedMessage = payload.new as Message
          if (updatedMessage.is_read) {
            // به‌روزرسانی پیام در لیست
            const index = messages.findIndex(m => m.id === updatedMessage.id)
            if (index !== -1) {
              messages[index] = { ...messages[index], is_read: true, read_at: updatedMessage.read_at }
              // Force reactivity
              messages = [...messages]
            }
          }
        }
      )
      .subscribe()
  }

  // ✅ بارگذاری اولیه
  onMount(() => {
    loadChat()
    setupRealtime()

    return () => {
      if (subscription) {
        supabase.removeChannel(subscription)
        subscription = null
      }
    }
  })

  // ✅ واکنش به تغییرات کاربر
  $effect(() => {
    if (currentUser && conversationId) {
      loadChat()
      setupRealtime()
    }
  })

  // ✅ مدیریت کلید Enter
  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  // ✅ نمایش تاریخ به صورت فارسی
  function formatMessageDate(date: string): string {
    try {
      const msgDate = new Date(date)
      const now = new Date()
      const isToday = msgDate.toDateString() === now.toDateString()
      const isYesterday = msgDate.toDateString() === new Date(now.setDate(now.getDate() - 1)).toDateString()
      
      if (isToday) return 'امروز'
      if (isYesterday) return 'دیروز'
      return formatDistanceToNow(msgDate, { locale: faIR })
    } catch {
      return 'چندی پیش'
    }
  }

  // ✅ نمایش تاریخ به صورت کامل
  function formatFullDate(date: string): string {
    try {
      return new Date(date).toLocaleDateString('fa-IR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return ''
    }
  }

  // ✅ گروه‌بندی پیام‌ها بر اساس تاریخ
  function groupMessagesByDate(msgList: Message[]) {
    const groups: { [key: string]: Message[] } = {}
    
    msgList.forEach(msg => {
      const date = new Date(msg.created_at).toDateString()
      if (!groups[date]) {
        groups[date] = []
      }
      groups[date].push(msg)
    })
    
    return groups
  }
</script>

<div class="chat-page">
  <div class="chat-container">
    <!-- Header -->
    <div class="chat-header">
      <button class="back-btn" onclick={() => goto('/chat')}>
        <ArrowLeft size={22} />
      </button>
      <div class="header-info" onclick={() => otherUser && goto(`/profile/${otherUser.username}`)}>
        <Avatar src={otherUser?.avatar} size="sm" />
        <div>
          <span class="user-name">{otherUser?.name || 'کاربر'}</span>
          <span class="user-status">
            {#if isOnline}
              <span class="online-dot-small"></span>
              آنلاین
            {:else}
              <span class="offline-dot-small"></span>
              آفلاین
            {/if}
          </span>
        </div>
      </div>
      <button class="more-btn">
        <MoreHorizontal size={22} />
      </button>
    </div>

    <!-- Messages -->
    <div class="messages-container">
      {#if loading}
        <div class="loading">⏳ در حال بارگذاری پیام‌ها...</div>
      {:else if messages.length === 0}
        <div class="empty-chat">
          <MessageCircle size={48} />
          <h3>هنوز پیامی ارسال نشده است</h3>
          <p>اولین پیام را ارسال کنید</p>
        </div>
      {:else}
        <div class="messages-list">
          {#each messages as message (message.id)}
            {@const isOwn = message.sender_id === currentUser?.id}
            <div class="message-item {isOwn ? 'own' : 'other'}">
              {#if !isOwn}
                <Avatar src={message.sender?.avatar} size="sm" />
              {/if}
              <div class="message-bubble {isOwn ? 'own-bubble' : 'other-bubble'}">
                <p class="message-text">{message.content}</p>
                <div class="message-meta">
                  <span class="message-time">{formatTime(message.created_at)}</span>
                  {#if isOwn}
                    <span class="message-status" title={message.is_read ? 'خوانده شده' : 'ارسال شده'}>
                      {#if message.is_read}
                        <CheckCheck size={14} class="read-status" />
                      {:else}
                        <Check size={14} class="sent-status" />
                      {/if}
                    </span>
                  {/if}
                </div>
              </div>
            </div>
          {/each}
          <div bind:this={messagesEnd}></div>
        </div>
      {/if}
    </div>

    <!-- Input -->
    <div class="chat-input-wrapper">
      <button class="input-btn">
        <Image size={20} />
      </button>
      <button class="input-btn">
        <Mic size={20} />
      </button>
      <input
        type="text"
        class="chat-input"
        placeholder="پیام خود را بنویسید..."
        bind:value={newMessage}
        onkeydown={handleKeyDown}
        disabled={isSending}
      />
      <button 
        class="send-btn"
        onclick={handleSendMessage}
        disabled={!newMessage.trim() || isSending}
      >
        {#if isSending}
          <span class="spinner-small"></span>
        {:else}
          <Send size={20} />
        {/if}
      </button>
    </div>
  </div>
</div>

<style>
  .chat-page {
    height: 100vh;
    max-height: 100vh;
    display: flex;
    flex-direction: column;
    background: #f0f2f5;
    padding: 0;
    position: fixed;
    inset: 0;
    z-index: 100;
  }

  .chat-container {
    max-width: 600px;
    width: 100%;
    margin: 0 auto;
    height: 100%;
    display: flex;
    flex-direction: column;
    background: white;
  }

  /* Header */
  .chat-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: white;
    border-bottom: 1px solid #f1f5f9;
    flex-shrink: 0;
  }

  .back-btn {
    background: none;
    border: none;
    color: #6366f1;
    cursor: pointer;
    padding: 4px;
    border-radius: 8px;
    transition: all 0.2s ease;
  }

  .back-btn:hover {
    background: #f0f0ff;
  }

  .header-info {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: 1;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 8px;
    transition: all 0.2s ease;
  }

  .header-info:hover {
    background: #f8fafc;
  }

  .user-name {
    font-weight: 600;
    font-size: 15px;
    color: #1a1a2e;
  }

  .user-status {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: #94a3b8;
  }

  .online-dot-small {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #10b981;
    display: inline-block;
  }

  .offline-dot-small {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #94a3b8;
    display: inline-block;
  }

  .more-btn {
    background: none;
    border: none;
    color: #64748b;
    cursor: pointer;
    padding: 4px;
    border-radius: 8px;
    transition: all 0.2s ease;
  }

  .more-btn:hover {
    background: #f1f5f9;
  }

  /* Messages */
  .messages-container {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    background: #f8fafc;
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

  .loading {
    text-align: center;
    padding: 40px;
    color: #94a3b8;
  }

  .empty-chat {
    text-align: center;
    padding: 60px 20px;
    color: #94a3b8;
  }

  .empty-chat :global(svg) {
    color: #cbd5e1;
    margin-bottom: 16px;
  }

  .empty-chat h3 {
    margin: 0 0 8px 0;
    color: #1a1a2e;
  }

  .empty-chat p {
    color: #94a3b8;
    margin: 0;
  }

  .messages-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex: 1;
  }

  .message-item {
    display: flex;
    gap: 8px;
    max-width: 85%;
  }

  .message-item.own {
    align-self: flex-end;
    flex-direction: row-reverse;
  }

  .message-item.other {
    align-self: flex-start;
  }

  .message-bubble {
    padding: 10px 14px;
    border-radius: 16px;
    max-width: 100%;
    position: relative;
    word-wrap: break-word;
  }

  .own-bubble {
    background: #6366f1;
    color: white;
    border-bottom-right-radius: 4px;
  }

  .other-bubble {
    background: white;
    color: #1a1a2e;
    border-bottom-left-radius: 4px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  }

  .message-text {
    margin: 0;
    font-size: 15px;
    line-height: 1.5;
  }

  .message-meta {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 4px;
    margin-top: 4px;
    font-size: 11px;
    opacity: 0.7;
  }

  .own-bubble .message-meta {
    color: rgba(255,255,255,0.7);
  }

  .other-bubble .message-meta {
    color: #94a3b8;
  }

  .message-status {
    display: flex;
    align-items: center;
  }

  .read-status {
    color: #10b981;
  }

  .sent-status {
    color: #94a3b8;
  }

  /* Input */
  .chat-input-wrapper {
    display: flex;
    align-items: flex-end;
    gap: 8px;
    padding: 12px 16px;
    background: white;
    border-top: 1px solid #f1f5f9;
    flex-shrink: 0;
  }

  .input-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    color: #94a3b8;
    cursor: pointer;
    padding: 8px;
    border-radius: 50%;
    transition: all 0.2s ease;
  }

  .input-btn:hover {
    background: #f1f5f9;
    color: #6366f1;
  }

  .chat-input {
    flex: 1;
    padding: 10px 14px;
    border: 1px solid #e2e8f0;
    border-radius: 24px;
    font-size: 15px;
    font-family: inherit;
    outline: none;
    transition: all 0.2s ease;
    resize: none;
    background: #f8fafc;
    min-height: 20px;
    max-height: 120px;
  }

  .chat-input:focus {
    border-color: #6366f1;
    background: white;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
  }

  .chat-input::placeholder {
    color: #94a3b8;
  }

  .send-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    background: #6366f1;
    border: none;
    color: white;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    cursor: pointer;
    transition: all 0.2s ease;
    flex-shrink: 0;
  }

  .send-btn:hover:not(:disabled) {
    background: #4f46e5;
    transform: scale(1.05);
  }

  .send-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }

  .spinner-small {
    display: inline-block;
    width: 20px;
    height: 20px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Mobile */
  @media (max-width: 640px) {
    .chat-page {
      padding: 0;
    }

    .chat-header {
      padding: 10px 14px;
    }

    .messages-container {
      padding: 12px;
    }

    .chat-input-wrapper {
      padding: 10px 14px;
    }

    .message-item {
      max-width: 90%;
    }
  }
</style>