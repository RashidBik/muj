<script lang="ts">
  import { onMount } from 'svelte'
  import { user } from '$lib/stores/user'
  import { getUserAdStats, watchAd } from '$lib/services/ad-service'
  import { Play, Coins, TrendingUp, Clock } from 'lucide-svelte'

  let currentUser = $state<any>(null)
  let stats = $state<any>({ total_watched: 0, tokens_earned: 0, today_watched: 0, next_reward_at: 10 })
  let loading = $state(true)
  let isWatching = $state(false)
  let message = $state('')

  $effect(() => {
    const unsubscribe = user.subscribe(value => {
      currentUser = value
      if (value) {
        loadStats(value.id)
      }
    })
    return () => unsubscribe()
  })

  async function loadStats(userId: string) {
    loading = true
    try {
      stats = await getUserAdStats(userId)
    } catch (error) {
      console.error('Error loading ad stats:', error)
    } finally {
      loading = false
    }
  }

  async function handleWatchAd() {
    if (!currentUser || isWatching) return

    isWatching = true
    message = ''

    try {
      // Simulate ad watching (3 seconds)
      await new Promise(resolve => setTimeout(resolve, 3000))

      const result = await watchAd(currentUser.id)
      
      if (result.success) {
        message = result.message
        await loadStats(currentUser.id)
        
        if (result.earned_token) {
          // Emit event for balance update
          window.dispatchEvent(new CustomEvent('token-updated'))
        }
      } else {
        message = result.message
      }
    } catch (error) {
      console.error('Error watching ad:', error)
      message = 'خطا در تماشای تبلیغ'
    } finally {
      isWatching = false
      setTimeout(() => message = '', 5000)
    }
  }
</script>

{#if currentUser}
  <div class="ad-reward">
    <div class="ad-header">
      <div class="ad-title">
        <Play size={18} />
        <span>تماشای تبلیغات و دریافت توکن</span>
      </div>
      <span class="ad-badge">هر ۱۰ تبلیغ = ۱ توکن</span>
    </div>

    {#if loading}
      <div class="ad-loading">⏳ در حال بارگذاری...</div>
    {:else}
      <div class="ad-stats">
        <div class="ad-stat">
          <span class="stat-icon">📺</span>
          <div>
            <div class="stat-number">{stats.today_watched}</div>
            <div class="stat-label">امروز</div>
          </div>
        </div>
        <div class="ad-stat">
          <span class="stat-icon">📊</span>
          <div>
            <div class="stat-number">{stats.total_watched}</div>
            <div class="stat-label">کل تماشا</div>
          </div>
        </div>
        <div class="ad-stat">
          <span class="stat-icon">💰</span>
          <div>
            <div class="stat-number">{stats.tokens_earned}</div>
            <div class="stat-label">توکن کسب شده</div>
          </div>
        </div>
        <div class="ad-stat">
          <span class="stat-icon">🎯</span>
          <div>
            <div class="stat-number">{stats.next_reward_at}</div>
            <div class="stat-label">تا توکن بعدی</div>
          </div>
        </div>
      </div>

      <button 
        class="watch-ad-btn" 
        onclick={handleWatchAd}
        disabled={isWatching}
      >
        {#if isWatching}
          <span class="spinner-small"></span>
          در حال پخش تبلیغ...
        {:else}
          <Play size={18} />
          تماشای تبلیغ
        {/if}
      </button>

      {#if message}
        <div class="ad-message {message.includes('تبریک') ? 'success' : 'info'}">
          {message}
        </div>
      {/if}
    {/if}
  </div>
{/if}

<style>
  .ad-reward {
    background: white;
    border-radius: 12px;
    padding: 16px;
    margin-bottom: 16px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  }

  .ad-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    flex-wrap: wrap;
    gap: 8px;
  }

  .ad-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 15px;
    font-weight: 600;
    color: #1a1a2e;
  }

  .ad-title :global(svg) {
    color: #6366f1;
  }

  .ad-badge {
    font-size: 11px;
    color: #6366f1;
    background: #eef2ff;
    padding: 4px 12px;
    border-radius: 12px;
    font-weight: 600;
  }

  .ad-loading {
    text-align: center;
    padding: 12px;
    color: #94a3b8;
  }

  .ad-stats {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    margin-bottom: 12px;
  }

  .ad-stat {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px;
    background: #f8fafc;
    border-radius: 8px;
  }

  .stat-icon {
    font-size: 20px;
  }

  .stat-number {
    font-size: 18px;
    font-weight: 700;
    color: #1a1a2e;
    line-height: 1.2;
  }

  .stat-label {
    font-size: 11px;
    color: #94a3b8;
  }

  .watch-ad-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    padding: 12px;
    border: none;
    border-radius: 10px;
    background: linear-gradient(135deg, #f59e0b, #f97316);
    color: white;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .watch-ad-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(245, 158, 11, 0.3);
  }

  .watch-ad-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }

  .watch-ad-btn :global(svg) {
    color: white;
  }

  .spinner-small {
    display: inline-block;
    width: 18px;
    height: 18px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .ad-message {
    margin-top: 10px;
    padding: 10px 14px;
    border-radius: 8px;
    font-size: 14px;
    text-align: center;
  }

  .ad-message.success {
    background: #ecfdf5;
    color: #10b981;
    border: 1px solid #86efac;
  }

  .ad-message.info {
    background: #eff6ff;
    color: #3b82f6;
    border: 1px solid #93c5fd;
  }

  @media (max-width: 640px) {
    .ad-stats {
      grid-template-columns: repeat(2, 1fr);
    }

    .ad-stat {
      padding: 8px;
    }

    .stat-number {
      font-size: 16px;
    }
  }
</style>