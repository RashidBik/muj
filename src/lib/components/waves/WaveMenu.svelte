<script lang="ts">
  import {
    Share2,
    Link,
    Download,
    UserPlus,
    UserCheck,
    Flag,
    CheckCircle,
    MoreHorizontal
  } from 'lucide-svelte'

  let {
    show,
    onToggle,
    onShare,
    onCopyLink,
    onDownload,
    onFollow,
    onReport,
    isFollowing,
    isAuthor,
    shareSuccess,
    currentUser
  }: {
    show: boolean
    onToggle: () => void
    onShare: () => void
    onCopyLink: () => void
    onDownload: () => void
    onFollow: () => void
    onReport: () => void
    isFollowing: boolean
    isAuthor: boolean
    shareSuccess: boolean
    currentUser: any
  } = $props()

  function handleClickOutside() {
    if (show) onToggle()
  }
</script>

<div class="menu-wrapper">
  <button class="menu-btn" onclick={onToggle}>
    <MoreHorizontal size={18} />
  </button>
  
  {#if show}
    <div class="menu-dropdown" onclick={(e) => e.stopPropagation()}>
      <button class="menu-item" onclick={onShare}>
        <Share2 size={16} />
        اشتراک‌گذاری
        {#if shareSuccess}
          <CheckCircle size={14} class="success-icon" />
        {/if}
      </button>     
      <button class="menu-item" onclick={onDownload}>
        <Download size={16} />
        دانلود فایل
      </button>
      
      {#if currentUser && !isAuthor}
        <button class="menu-item" onclick={onFollow}>
          {#if isFollowing}
            <UserCheck size={16} />
            لغو دنبال کردن
          {:else}
            <UserPlus size={16} />
            دنبال کردن
          {/if}
        </button>
      {/if}
      
      <div class="menu-divider"></div>
      
      <button class="menu-item report-item" onclick={onReport}>
        <Flag size={16} />
        گزارش
      </button>
    </div>
  {/if}
</div>

{#if show}
  <div class="menu-overlay" onclick={handleClickOutside}></div>
{/if}

<style>
  .menu-wrapper {
    position: relative;
  }

  .menu-btn {
    background: none;
    border: none;
    color: #64748b;
    cursor: pointer;
    padding: 6px;
    border-radius: 50%;
    transition: all 0.2s ease;
  }

  .menu-btn:hover {
    background: #f1f5f9;
    color: #1a1a2e;
  }

  .menu-overlay {
    position: fixed;
    inset: 0;
    z-index: 40;
  }

  .menu-dropdown {
    position: absolute;
    top: 100%;
    right: 0;
    min-width: 200px;
    background: white;
    border-radius: 12px;
    box-shadow: 0 8px 40px rgba(0, 0, 0, 0.15);
    padding: 6px;
    z-index: 50;
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

  .menu-item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 10px 14px;
    border: none;
    background: none;
    border-radius: 8px;
    cursor: pointer;
    font-size: 14px;
    color: #1a1a2e;
    transition: all 0.15s ease;
    font-family: inherit;
  }

  .menu-item:hover {
    background: #f1f5f9;
  }

  .menu-item :global(svg) {
    color: #64748b;
    flex-shrink: 0;
  }

  .menu-item:hover :global(svg) {
    color: #6366f1;
  }

  .menu-divider {
    height: 1px;
    background: #eef2f6;
    margin: 4px 8px;
  }

  .report-item {
    color: #ef4444;
  }

  .report-item :global(svg) {
    color: #ef4444;
  }

  .report-item:hover {
    background: #fef2f2;
  }

  .success-icon {
    color: #10b981 !important;
    margin-right: auto;
  }

  @media (max-width: 640px) {
    .menu-dropdown {
      min-width: 160px;
      right: -10px;
    }
  }
</style>