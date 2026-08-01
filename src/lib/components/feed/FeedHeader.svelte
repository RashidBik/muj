<script lang="ts">
  import { goto } from '$app/navigation'
  import { onMount } from 'svelte'
  import type { User } from '$lib/stores/user'
  import { getUnreadCount } from '$lib/services/notification-service'

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
    Sparkles
  } from 'lucide-svelte'

  let { currentUser, onSignOut }: {
    currentUser: User | null
    onSignOut: () => void
  } = $props()

  let unreadCount = $state(0)
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
    goto('/notifications')
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
      unreadCount = await getUnreadCount(currentUser.id)
    } catch (error) {
      console.error('Error loading unread count:', error)
    }
  }

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

  $effect(() => {
    if (currentUser) {
      loadUnreadCount()
    }
  })
</script>

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

      <!-- Notifications Button -->
      <button class="icon-btn notification-btn" onclick={goToNotifications} title="اعلان‌ها">
        <Bell size={20} />
        {#if unreadCount > 0}
          <span class="badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
        {/if}
        <span class="btn-label">اعلان‌ها</span>
      </button>

      <!-- Profile Dropdown -->
      <div class="profile-dropdown">
        <button class="profile-btn" onclick={toggleMenu} title="پروفایل من">
          <div class="profile-avatar">
            {#if currentUser.avatar}
              <img src={currentUser.avatar} alt={currentUser.name} class="avatar-img" />
            {:else}
              <UserIcon size={20} />
            {/if}
          </div>
          <span class="profile-name">{currentUser.name}</span>
          <span class="dropdown-arrow">▾</span>
        </button>

        <!-- Dropdown Menu -->
        {#if isMenuOpen}
          <div class="dropdown-menu">
            <div class="dropdown-item" onclick={goToMyProfile}>
              <UserIcon size={16} />
              <span>پروفایل من</span>
            </div>
            <div class="dropdown-item" onclick={goToHome}>
              <Home size={16} />
              <span>خانه</span>
            </div>
            <div class="dropdown-divider"></div>
            <div class="dropdown-item logout-item" onclick={onSignOut}>
              <LogOut size={16} />
              <span>خروج</span>
            </div>
          </div>
        {/if}
      </div>
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

<!-- Click outside to close dropdown -->
{#if isMenuOpen}
  <div class="dropdown-overlay" onclick={() => isMenuOpen = false}></div>
{/if}

<style>
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 20px;
    background: #ffffff;
    border-bottom: 1px solid #eef2f6;
    position: sticky;
    top: 0;
    z-index: 100;
    backdrop-filter: blur(12px);
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
  }
</style>