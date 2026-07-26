<script lang="ts">
  // استفاده از $props به جای export let
  let { 
    src = null, 
    alt = 'User avatar', 
    size = 'md', 
    online = false, 
    story = false 
  }: {
    src?: string | null
    alt?: string
    size?: 'sm' | 'md' | 'lg' | 'xl'
    online?: boolean
    story?: boolean
  } = $props()

  // استفاده از تابع برای مقداردهی پویا (رفع warning state_referenced_locally)
  function getSizePx() {
    const sizes = {
      sm: 32,
      md: 40,
      lg: 56,
      xl: 80
    }
    return sizes[size] || 40
  }

  const sizePx = getSizePx()
</script>

<div class="avatar-container" style="--size: {sizePx}px">
  <div class="avatar {story ? 'story-ring' : ''}">
    {#if src}
      <img {src} {alt} loading="lazy" />
    {:else}
      <div class="placeholder">
        <!-- آیکون پیش‌فرض با تگ بسته شده -->
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      </div>
    {/if}
  </div>
  
  {#if online}
    <div class="online-badge"></div>
  {/if}
</div>

<style>
  .avatar-container {
    position: relative;
    width: var(--size);
    height: var(--size);
    flex-shrink: 0;
  }

  .avatar {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    overflow: hidden;
    background: #e4e6eb;
  }

  .avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .story-ring {
    padding: 3px;
    border-radius: 50%;
    background: linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366);
  }

  .story-ring img {
    border-radius: 50%;
    border: 3px solid white;
  }

  .online-badge {
    position: absolute;
    bottom: 0;
    right: 0;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #31a24c;
    border: 2px solid white;
  }

  .placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    background: #e4e6eb;
    color: #8a8d91;
  }
</style>