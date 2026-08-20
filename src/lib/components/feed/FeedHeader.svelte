<script lang="ts">
  import { goto } from '$app/navigation'
  import { onMount, onDestroy } from 'svelte'
  import type { User } from '$lib/stores/user'
  import { getUnreadCount } from '$lib/services/notification-service'
  import { getUserConversations } from '$lib/services/chat-service'

  // Icon imports - renamed UserIcon to avoid conflict
  import {
    Waves,
    Search,
    User as UserIcon,
    Bell,
    LogOut,
    LogIn,
    Settings,
    Home,
    Menu,
    Sparkles,
    MessageCircleIcon
  } from 'lucide-svelte'

  let { currentUser, onSignOut }: {
    currentUser: User | null
    onSignOut: () => void
  } = $props()

  let unreadCount = $state(0)
  let chatUnreadCount = $state(0)
  let isMenuOpen = $state(false)

  function goToMyProfile() {
    if (currentUser?.username) {
      goto(`/profile/${currentUser.username}`)
    }
  }

  function goToSearch() {
    goto('/search')
  }

  function goToNotifications() {
    goto('/notification')
  }

  function goToChat() {
    goto('/chat')
  }

  function goToHome() {
    goto('/')
  }

  function toggleMenu() {
    isMenuOpen = !isMenuOpen
  }

  async function loadUnreadCount() {
    if (!currentUser) return
    try {
      // دریافت تعداد اعلان‌ها
      unreadCount = await getUnreadCount(currentUser.id)
      
      // دریافت تعداد پیام‌های خوانده نشده از چت
      const convs = await getUserConversations(currentUser.id)
      chatUnreadCount = convs.reduce((acc, c) => acc + (c.unread_count || 0), 0)
    } catch (error) {
      console.error('Error loading unread count:', error)
    }
  }

  // ✅ Listen for chat unread count updates
  function handleChatUnreadUpdate(event: CustomEvent) {
    chatUnreadCount = event.detail
  }

  // ✅ Listen for new messages
  function handleNewMessage(event: CustomEvent) {
    // Reload unread count when new message arrives
    loadUnreadCount()
  }

  onMount(() => {
    loadUnreadCount()

    // Listen for notification count updates
    const notificationHandler = (event: CustomEvent) => {
      unreadCount = event.detail
    }
    window.addEventListener('notification-count', notificationHandler as EventListener)

    // ✅ Listen for chat unread count updates
    const chatUnreadHandler = (event: CustomEvent) => {
      chatUnreadCount = event.detail
    }
    window.addEventListener('chat-unread-count', chatUnreadHandler as EventListener)

    // ✅ Listen for new messages
    const newMessageHandler = (event: CustomEvent) => {
      handleNewMessage(event)
    }
    window.addEventListener('new-message', newMessageHandler as EventListener)
    
    return () => {
      window.removeEventListener('notification-count', notificationHandler as EventListener)
      window.removeEventListener('chat-unread-count', chatUnreadHandler as EventListener)
      window.removeEventListener('new-message', newMessageHandler as EventListener)
    }
  })

  $effect(() => {
    if (currentUser) {
      loadUnreadCount()
    }
  })
</script>

<!-- Rest of your template remains the same -->
<!-- ... -->
<div class="sticky-topbar">
  <!-- Main Header -->
  <header class="header">
    <div class="header-left">
      <!-- Logo -->
      <div class="logo" onclick={goToHome}>
        <Waves size={28} />
        <span class="logo-text">موج</span>
        <span class="logo-badge">Beta</span>
      </div>
    </div>

    <div class="header-right">
      {#if currentUser}
        <!-- Search Button -->
        <button class="icon-btn search-btn" onclick={goToSearch} title="جستجو">
          <Search size={20} />
          <span class="btn-label">جستجو</span>
        </button>

        <span class="profile-name">{currentUser.name}</span>
      {:else}
        <!-- Guest Actions -->
        <button class="login-btn" onclick={() => goto('/auth/login')}>
          <LogIn size={18} />
          <span>ورود</span>
        </button>
        <button class="signup-btn" onclick={() => goto('/auth/register')}>
          <Sparkles size={18} />
          <span>ثبت نام</span>
        </button>
      {/if}
    </div>
  </header>

  <!-- Bottom Navigation Bar -->
  <div class="topbar-center flex items-center justify-between w-full px-4 py-2 bg-white border-b border-gray-200 ">
    <!-- Home Button -->
    <button 
      class="icon-btn relative flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors duration-200" 
      onclick={goToHome} 
      title="خانه"
    >
      <Home size={24} color="#6366f1" class="text-gray-700" />
    </button>
 
    <!-- Messages Button -->
    <button 
      class="icon-btn active relative flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors duration-200" 
      onclick={goToChat} 
      title="پیام‌ها"
    >
      <MessageCircleIcon size={24} class="text-gray-700" />
      {#if unreadCount > 0}
        <span class="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5 border-2 border-white">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      {/if}
    </button>
  
    <!-- Notifications Button -->
    <button 
      class="icon-btn relative flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors duration-200" 
      onclick={goToNotifications} 
      title="اعلان‌ها"
    >
      <Bell size={24} class="text-gray-700" />
      {#if unreadCount > 0}
        <span class="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5 border-2 border-white">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      {/if}
    </button>

    <!-- Profile Button -->
    <button 
      class="icon-btn relative flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors duration-200" 
      onclick={goToMyProfile} 
      title="پروفایل"
    >
      <UserIcon size={24} class="text-gray-700" />
    </button>
  </div>
</div>

<style>
  /* Fixed sticky container */
  .sticky-topbar {
    position: sticky;
    top: 0;
    z-index: 100;
    background: white;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 20px;
    background: #ffffff;
    /* border-bottom: 1px solid #eef2f6; */
    /* backdrop-filter: blur(12px); */
    background: rgba(255, 255, 255, 0.92);
    transition: box-shadow 0.3s ease;
  }

  .header:hover {
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
  }

  .header-left {
    display: flex;
    align-items: center;
  }

  .logo {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    padding: 4px 8px;
    border-radius: 8px;
    user-select: none;
  }

  .logo:hover {
    background: #f8fafc;
  }

  .logo :global(svg) {
    color: #6366f1;
  }

  .logo-text {
    font-size: 22px;
    font-weight: 800;
    color: #1a1a2e;
    letter-spacing: -0.5px;
  }

  .logo-badge {
    font-size: 8px;
    font-weight: 700;
    color: white;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    padding: 2px 8px;
    border-radius: 10px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-right: -4px;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  /* Icon Buttons */
  .icon-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    background: none;
    border: none;
    padding: 8px 12px;
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.2s ease;
    color: #475569;
    font-family: inherit;
    position: relative;
  }

  .icon-btn :global(svg) {
    color: #64748b;
    transition: color 0.2s ease;
  }

  .icon-btn:hover {
    background: #f1f5f9;
  }

  .icon-btn:hover :global(svg) {
    color: #6366f1;
  }

  .icon-btn:active {
    transform: scale(0.95);
  }

  .btn-label {
    font-size: 13px;
    font-weight: 500;
    color: #475569;
  }

  .search-btn {
    background: #f1f5f9;
    border-radius: 10px;
    padding: 8px 16px;
  }

  .search-btn:hover {
    background: #e2e8f0;
  }

  .search-btn :global(svg) {
    color: #94a3b8;
  }

  /* Notification Badge */
  .notification-btn {
    position: relative;
  }

  .badge {
    position: absolute;
    top: 2px;
    right: 2px;
    background: #ef4444;
    color: white;
    font-size: 10px;
    font-weight: 700;
    min-width: 18px;
    height: 18px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 5px;
    border: 2px solid white;
    box-shadow: 0 2px 8px rgba(239, 68, 68, 0.3);
  }

  /* Profile Dropdown */
  .profile-dropdown {
    position: relative;
  }

  .profile-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    background: none;
    border: none;
    padding: 6px 12px 6px 6px;
    border-radius: 50px;
    cursor: pointer;
    transition: all 0.2s ease;
    font-family: inherit;
  }

  .profile-btn:hover {
    background: #f1f5f9;
  }

  .profile-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    flex-shrink: 0;
  }

  .profile-avatar :global(svg) {
    color: white;
  }

  .avatar-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .profile-name {
    font-size: 14px;
    font-weight: 600;
    color: #1a1a2e;
    max-width: 100px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .dropdown-arrow {
    font-size: 10px;
    color: #94a3b8;
    transition: transform 0.2s ease;
  }

  .profile-btn:hover .dropdown-arrow {
    transform: rotate(180deg);
  }

  /* Dropdown Menu */
  .dropdown-overlay {
    position: fixed;
    inset: 0;
    z-index: 98;
  }

  .dropdown-menu {
    position: absolute;
    top: calc(100% + 8px);
    left: 0;
    min-width: 200px;
    background: white;
    border-radius: 12px;
    box-shadow: 0 8px 40px rgba(0, 0, 0, 0.12);
    padding: 6px;
    z-index: 99;
    animation: slideDown 0.2s ease;
    border: 1px solid #f1f5f9;
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-8px) scale(0.98);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .dropdown-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s ease;
    font-size: 14px;
    font-weight: 500;
    color: #1a1a2e;
  }

  .dropdown-item :global(svg) {
    color: #64748b;
  }

  .dropdown-item:hover {
    background: #f1f5f9;
  }

  .dropdown-item:hover :global(svg) {
    color: #6366f1;
  }

  .dropdown-divider {
    height: 1px;
    background: #eef2f6;
    margin: 4px 8px;
  }

  .logout-item {
    color: #ef4444;
  }

  .logout-item :global(svg) {
    color: #ef4444;
  }

  .logout-item:hover {
    background: #fef2f2;
  }

  /* Auth Buttons */
  .login-btn,
  .signup-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 18px;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    border: none;
    font-family: inherit;
  }

  .login-btn {
    background: transparent;
    color: #6366f1;
  }

  .login-btn:hover {
    background: #f1f5f9;
  }

  .signup-btn {
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    color: white;
    box-shadow: 0 2px 12px rgba(99, 102, 241, 0.3);
  }

  .signup-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 20px rgba(99, 102, 241, 0.4);
  }

  .signup-btn:active {
    transform: scale(0.95);
  }

  /* Topbar Center - Bottom Navigation */
  .topbar-center {
    background: white;
    border-bottom: 1px solid #eef2f6;
  }

  /* Responsive */
  @media (max-width: 768px) {
    .header {
      padding: 10px 16px;
    }

    .logo-text {
      font-size: 18px;
    }

    .logo-badge {
      display: none;
    }

    .logo :global(svg) {
      width: 24px;
      height: 24px;
    }

    .btn-label {
      display: none;
    }

    .search-btn {
      padding: 8px 10px;
    }

    .profile-name {
      max-width: 60px;
      font-size: 13px;
    }

    .signup-btn {
      padding: 6px 14px;
      font-size: 13px;
    }

    .signup-btn span {
      display: none;
    }

    .login-btn span {
      display: none;
    }

    .topbar-center {
      padding: 8px 12px;
    }

    .topbar-center .icon-btn {
      padding: 6px 8px;
    }

    .topbar-center .icon-btn :global(svg) {
      width: 20px;
      height: 20px;
    }
  }

  @media (max-width: 480px) {
    .header {
      padding: 8px 12px;
    }

    .logo-text {
      font-size: 16px;
    }

    .profile-name {
      display: none;
    }

    .dropdown-arrow {
      display: none;
    }

    .profile-btn {
      padding: 4px;
    }

    .profile-avatar {
      width: 28px;
      height: 28px;
    }

    .icon-btn {
      padding: 6px 8px;
    }

    .icon-btn :global(svg) {
      width: 18px;
      height: 18px;
    }

    .badge {
      min-width: 16px;
      height: 16px;
      font-size: 8px;
      top: 0;
      right: 0;
    }

    .dropdown-menu {
      min-width: 160px;
      left: auto;
      right: 0;
    }

    .topbar-center {
      padding: 6px 8px;
    }

    .topbar-center .icon-btn {
      padding: 4px 6px;
    }

    .topbar-center .icon-btn :global(svg) {
      width: 18px;
      height: 18px;
    }

    .topbar-center .absolute {
      min-width: 16px !important;
      height: 16px !important;
      font-size: 8px !important;
      top: -2px !important;
      right: -2px !important;
    }
  }
</style>