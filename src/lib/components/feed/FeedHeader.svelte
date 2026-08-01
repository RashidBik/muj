<script lang="ts">
  import { goto } from '$app/navigation'
  import { onMount } from 'svelte'
  import type { User } from '$lib/stores/user'
  import { getUnreadCount } from '$lib/services/notification-service'

  let { currentUser, onSignOut }: {
    currentUser: User | null
    onSignOut: () => void
  } = $props()

  let unreadCount = $state(0)

  function goToMyProfile() {
    if (currentUser?.username) {
      goto(`/profile/${currentUser.username}`)
    }
  }



  function goToSearch() {
    goto('/search')
  }

 

  // Load unread count
  async function loadUnreadCount() {
    if (!currentUser) return
    try {
      unreadCount = await getUnreadCount(currentUser.id)
    } catch (error) {
      console.error('Error loading unread count:', error)
    }
  }

  // Listen for notification updates
  onMount(() => {
    loadUnreadCount()

    const handler = (event: CustomEvent) => {
      unreadCount = event.detail
    }

    window.addEventListener('notification-count', handler as EventListener)
    
    return () => {
      window.removeEventListener('notification-count', handler as EventListener)
    }
  })
   function goToNotifications() {
    goto('/notifications')
  }
  // Reload count when user changes
  $effect(() => {
    if (currentUser) {
      loadUnreadCount()
    }
  })
</script>

<div class="header">
  <h1 onclick={() => goto('/')} style="cursor: pointer;">🎵 موج</h1>
  <div class="header-actions">
    {#if currentUser}
      <!-- 🔍 Search -->
      <button class="icon-btn" onclick={goToSearch} title="جستجو">
        🔍
      </button>

            <button class="profile-btn" onclick={goToMyProfile} title="پروفایل من">
        👤 {currentUser.name}
      </button>

           <!-- 🔔 Notifications with badge -->
      <button class="icon-btn notification-btn" onclick={goToNotifications} title="اعلان‌ها">
        🔔
        {#if unreadCount > 0}
          <span class="badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
        {/if}
      </button>

    {:else}
      <a href="/auth/login" class="login-link">ورود</a>
    {/if}
  </div>
</div>

<style>
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 0;
    margin-bottom: 16px;
    border-bottom: 1px solid #e4e6eb;
    flex-wrap: wrap;
    gap: 8px;
  }

  .header h1 {
    font-size: 24px;
    margin: 0;
    color: #050505;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .icon-btn {
    background: none;
    border: none;
    font-size: 20px;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 6px;
    transition: all 0.2s;
    position: relative;
  }

  .icon-btn:hover {
    background: #e7f3ff;
  }

  .notification-btn {
    position: relative;
  }

  .badge {
    position: absolute;
    top: -4px;
    right: -4px;
    background: #dc3545;
    color: white;
    font-size: 10px;
    font-weight: 700;
    min-width: 16px;
    height: 16px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 4px;
  }

  .profile-btn {
    background: none;
    border: none;
    color: #1877f2;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    padding: 6px 12px;
    border-radius: 6px;
    transition: all 0.2s;
  }

  .profile-btn:hover {
    background: #e7f3ff;
  }

  .logout-btn {
    background: #dc3545;
    color: white;
    border: none;
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 13px;
    cursor: pointer;
  }

  .logout-btn:hover {
    background: #c82333;
  }

  .login-link {
    color: #1877f2;
    text-decoration: none;
    font-weight: 600;
  }
</style>