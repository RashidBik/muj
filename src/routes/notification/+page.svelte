<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { supabase } from '$lib/client/supabase'
  import { user } from '$lib/stores/user'
  import Avatar from '$lib/components/ui/Avatar.svelte'
  import { 
    getNotifications, 
    markAsRead, 
    markAllAsRead 
  } from '$lib/services/notification-service'
  import type { Notification } from '$lib/services/notification-service'
  import { formatDistanceToNow } from 'date-fns'
  import { faIR } from 'date-fns/locale'

  let notifications = $state<Notification[]>([])
  let loading = $state(true)
  let currentUser = $state<any>(null)
  let error = $state<string | null>(null)

  // Subscribe to user store
  $effect(() => {
    const unsubscribe = user.subscribe(value => {
      currentUser = value
    })
    return () => unsubscribe()
  })

  // Load notifications
  async function loadNotifications() {
    if (!currentUser) {
      goto('/auth/login')
      return
    }

    loading = true
    error = null
    
    try {
      notifications = await getNotifications(currentUser.id)
      console.log('📬 Notifications loaded:', notifications.length)
    } catch (err) {
      console.error('Error loading notifications:', err)
      error = 'خطا در بارگذاری اعلان‌ها'
    } finally {
      loading = false
    }
  }

  // Handle notification click
 async function handleNotificationClick(notification: Notification) {
  // Mark as read
  if (!notification.is_read) {
    await markAsRead(notification.id)
    notification.is_read = true
    notifications = [...notifications]
  }

  // Navigate based on type
  if (notification.room_id) {
    goto(`/room/${notification.room_id}`)
  } else if (notification.wave_id) {
    goto(`/wave/${notification.wave_id}`)
  } else if (notification.type === 'FOLLOW') {
    const actor = notification.actor
    if (actor?.username) {
      goto(`/profile/${actor.username}`)
    }
  }
}

  // Mark all as read
  async function handleMarkAllRead() {
    if (!currentUser) return
    
    try {
      await markAllAsRead(currentUser.id)
      notifications = notifications.map(n => ({ ...n, is_read: true }))
      notifications = [...notifications]
    } catch (err) {
      console.error('Error marking all as read:', err)
    }
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

  // Get notification icon
 function getNotificationIcon(type: string): string {
  const icons: Record<string, string> = {
    'LIKE': '❤️',
    'COMMENT': '💬',
    'FOLLOW': '👤',
    'ROOM_JOIN': '🚪',
    'ROOM_MESSAGE': '🏠',
    'NEW_WAVE': '🌊',
    'TOKEN_EARNED': '💰'
  }
  return icons[type] || '🔔'
}

  // Setup realtime subscription
  let subscription: any = null

  function setupRealtime() {
    if (!currentUser) return

    subscription = supabase
      .channel(`notifications:${currentUser.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${currentUser.id}`
        },
        async (payload) => {
          // Get full notification with actor info
          const { data, error } = await supabase
            .from('notifications')
            .select(`
              *,
              actor:users!actor_id(
                id,
                name,
                username,
                avatar
              ),
              wave:waves(
                id,
                title
              )
            `)
            .eq('id', payload.new.id)
            .single()

          if (!error && data) {
            notifications = [data, ...notifications]
            notifications = [...notifications]
            
            // Update unread count in header
            updateUnreadCount()
          }
        }
      )
      .subscribe()
  }

  // Update unread count (for header)
  function updateUnreadCount() {
    const unread = notifications.filter(n => !n.is_read).length
    // Dispatch event for header
    window.dispatchEvent(new CustomEvent('notification-count', { 
      detail: unread 
    }))
  }

  // Initial load
  onMount(async () => {
    await loadNotifications()
    setupRealtime()
    updateUnreadCount()

    return () => {
      if (subscription) {
        supabase.removeChannel(subscription)
      }
    }
  })

  // Listen for route changes to update count
  $effect(() => {
    if (notifications.length > 0) {
      updateUnreadCount()
    }
  })
</script>

<div class="notifications-page">
  <div class="notifications-container">
    <!-- Header -->
    <div class="header">
      <button class="back-btn" onclick={() => history.back()}>← بازگشت</button>
      <h1>🔔 اعلان‌ها</h1>
      {#if notifications.some(n => !n.is_read)}
        <button class="mark-all-btn" onclick={handleMarkAllRead}>
          همه را خوانده شد
        </button>
      {/if}
    </div>

    <!-- Loading -->
    {#if loading}
      <div class="loading">⏳ در حال بارگذاری...</div>
    {:else if error}
      <div class="error-box">❌ {error}</div>
    {:else if notifications.length === 0}
      <div class="empty">
        <div class="empty-icon">🔔</div>
        <h3>هیچ اعلانی وجود ندارد</h3>
        <p>وقتی کسی با شما تعامل کند، اینجا نمایش داده می‌شود</p>
      </div>
    {:else}
      <!-- Notifications List -->
      <div class="notifications-list">
        {#each notifications as notification (notification.id)}
          <div 
            class="notification-item {notification.is_read ? '' : 'unread'}"
            onclick={() => handleNotificationClick(notification)}
          >
            <div class="notification-icon">
              {getNotificationIcon(notification.type)}
            </div>
            <div class="notification-content">
              <div class="notification-header">
                <div class="notification-actor">
                  <Avatar src={notification.actor?.avatar} size="sm" />
                  <span class="actor-name">{notification.actor?.name || 'کاربر'}</span>
                </div>
                <span class="notification-time">{formatTime(notification.created_at)}</span>
              </div>
              <p class="notification-message">{notification.message}</p>
              {#if notification.wave}
                <div class="notification-wave">
                  🎵 {notification.wave.title}
                </div>
              {/if}
              {#if !notification.is_read}
                <div class="unread-dot">●</div>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .notifications-page {
    min-height: 100vh;
    background: #f0f2f5;
    padding: 16px;
  }

  .notifications-container {
    max-width: 600px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .header {
    display: flex;
    align-items: center;
    gap: 12px;
    background: white;
    padding: 16px;
    border-radius: 12px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    flex-wrap: wrap;
  }

  .header h1 {
    font-size: 20px;
    margin: 0;
    color: #050505;
    flex: 1;
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

  .mark-all-btn {
    background: none;
    border: none;
    color: #1877f2;
    font-size: 14px;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 4px;
  }

  .mark-all-btn:hover {
    background: #e7f3ff;
  }

  .loading {
    text-align: center;
    padding: 40px;
    color: #65676b;
  }

  .error-box {
    background: #fee;
    color: #dc3545;
    padding: 16px;
    border-radius: 8px;
    text-align: center;
  }

  .empty {
    text-align: center;
    padding: 60px 20px;
    background: white;
    border-radius: 12px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }

  .empty-icon {
    font-size: 48px;
    margin-bottom: 16px;
  }

  .empty h3 {
    margin: 0 0 8px 0;
    color: #050505;
  }

  .empty p {
    color: #65676b;
    margin: 0;
  }

  .notifications-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .notification-item {
    display: flex;
    gap: 12px;
    padding: 16px;
    background: white;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    position: relative;
  }

  .notification-item:hover {
    transform: translateX(4px);
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  }

  .notification-item.unread {
    background: #f0f7ff;
    border-left: 4px solid #1877f2;
  }

  .notification-icon {
    font-size: 24px;
    flex-shrink: 0;
    margin-top: 4px;
  }

  .notification-content {
    flex: 1;
    min-width: 0;
  }

  .notification-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 4px;
    flex-wrap: wrap;
    gap: 4px;
  }

  .notification-actor {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .actor-name {
    font-weight: 600;
    color: #050505;
  }

  .notification-time {
    font-size: 12px;
    color: #65676b;
  }

  .notification-message {
    margin: 0 0 4px 0;
    color: #050505;
    font-size: 14px;
  }

  .notification-wave {
    font-size: 13px;
    color: #65676b;
    padding: 4px 8px;
    background: #f0f2f5;
    border-radius: 4px;
    display: inline-block;
    margin-top: 4px;
  }

  .unread-dot {
    position: absolute;
    top: 16px;
    right: 16px;
    color: #1877f2;
    font-size: 12px;
    animation: pulse 1.5s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }
</style>