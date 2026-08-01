<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { user } from '$lib/stores/user'
  import Avatar from '$lib/components/ui/Avatar.svelte'
  import { 
    getReferralCode, 
    createReferralCode,
    getReferralStats,
    getReferrals,
    getReferralLink 
  } from '$lib/services/referral-service'
  import { formatDistanceToNow } from 'date-fns'
  import { faIR } from 'date-fns/locale'

  let currentUser = $state<any>(null)
  let referralCode = $state<string | null>(null)
  let stats = $state({ total_referrals: 0, total_rewards: 0, pending_rewards: 0 })
  let referrals = $state<any[]>([])
  let loading = $state(true)
  let copied = $state(false)
  let link = $state('')

  // Subscribe to user store
  $effect(() => {
    const unsubscribe = user.subscribe(value => {
      currentUser = value
    })
    return () => unsubscribe()
  })

  // Load referral data
  async function loadReferralData() {
    if (!currentUser) {
      goto('/auth/login')
      return
    }

    loading = true
    try {
      // Get or create referral code
      let code = await getReferralCode(currentUser.id)
      if (!code) {
        code = await createReferralCode(currentUser.id)
      }
      referralCode = code
      
      if (code) {
        link = getReferralLink(code)
      }

      // Get stats and list
      const [statsData, referralsData] = await Promise.all([
        getReferralStats(currentUser.id),
        getReferrals(currentUser.id)
      ])

      stats = statsData
      referrals = referralsData

    } catch (error) {
      console.error('Error loading referral data:', error)
    } finally {
      loading = false
    }
  }

  // Copy referral link
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link)
      copied = true
      setTimeout(() => copied = false, 3000)
    } catch (error) {
      console.error('Error copying link:', error)
      // Fallback
      const input = document.createElement('input')
      input.value = link
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
      copied = true
      setTimeout(() => copied = false, 3000)
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

  // Initial load
  onMount(() => {
    loadReferralData()
  })

  // Reload when user changes
  $effect(() => {
    if (currentUser) {
      loadReferralData()
    }
  })
</script>

<div class="referral-page">
  <div class="referral-container">
    <!-- Header -->
    <div class="header">
      <button class="back-btn" onclick={() => history.back()}>← بازگشت</button>
      <h1>👥 دعوت دوستان</h1>
    </div>

    {#if loading}
      <div class="loading">⏳ در حال بارگذاری...</div>
    {:else if currentUser}
      <!-- Stats -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon">👥</div>
          <div class="stat-number">{stats.total_referrals}</div>
          <div class="stat-label">تعداد دعوت‌ها</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">💰</div>
          <div class="stat-number">{stats.total_rewards}</div>
          <div class="stat-label">توکن کسب شده</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">⏳</div>
          <div class="stat-number">{stats.pending_rewards}</div>
          <div class="stat-label">توکن در انتظار</div>
        </div>
      </div>

      <!-- Referral Code -->
      <div class="code-section">
        <h3>🔑 کد دعوت شما</h3>
        <div class="code-display">
          <span class="code">{referralCode || '---'}</span>
          <button class="copy-btn" onclick={copyLink}>
            {copied ? '✅ کپی شد' : '📋 کپی'}
          </button>
        </div>
        <p class="code-hint">این کد را با دوستان خود به اشتراک بگذارید</p>
      </div>

      <!-- Share Options -->
      <div class="share-section">
        <h3>📤 اشتراک‌گذاری</h3>
        <div class="share-buttons">
          <button class="share-btn whatsapp" onclick={() => window.open(`https://wa.me/?text=${encodeURIComponent('به موج بپیوندید! از کد دعوت من استفاده کنید: ' + link)}`, '_blank')}>
            💬 واتساپ
          </button>
          <button class="share-btn telegram" onclick={() => window.open(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent('به موج بپیوندید! 🎵')}`, '_blank')}>
            ✈️ تلگرام
          </button>
          <button class="share-btn twitter" onclick={() => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent('به موج بپیوندید! از کد دعوت من استفاده کنید 🎵')}&url=${encodeURIComponent(link)}`, '_blank')}>
            🐦 توییتر
          </button>
        </div>
        <div class="share-link">
          <input type="text" value={link} readonly class="link-input" />
          <button class="copy-link-btn" onclick={copyLink}>
            {copied ? '✅' : '📋'}
          </button>
        </div>
      </div>

      <!-- Referral List -->
      <div class="referrals-section">
        <h3>📋 دوستان دعوت شده</h3>
        {#if referrals.length === 0}
          <div class="empty-referrals">
            <div class="empty-icon">👥</div>
            <p>هنوز کسی را دعوت نکردید</p>
            <p class="empty-hint">اولین دوست خود را دعوت کنید و ۵۰ توکن جایزه بگیرید!</p>
          </div>
        {:else}
          <div class="referrals-list">
            {#each referrals as referral (referral.id)}
              <div class="referral-item">
                <Avatar src={referral.referred?.avatar} size="sm" />
                <div class="referral-info">
                  <div class="referral-name">
                    {referral.referred?.name || 'کاربر ناشناس'}
                  </div>
                  <div class="referral-username">
                    @{referral.referred?.username}
                  </div>
                </div>
                <div class="referral-date">
                  {formatTime(referral.created_at)}
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <!-- How it works -->
      <div class="how-it-works">
        <h3>🎯 چگونه کار می‌کند؟</h3>
        <div class="steps">
          <div class="step">
            <span class="step-number">۱</span>
            <span class="step-text">کد دعوت خود را با دوستان به اشتراک بگذارید</span>
          </div>
          <div class="step">
            <span class="step-number">۲</span>
            <span class="step-text">دوستان شما با کد دعوت ثبت‌نام می‌کنند</span>
          </div>
          <div class="step">
            <span class="step-number">۳</span>
            <span class="step-text">شما ۵۰ توکن جایزه دریافت می‌کنید!</span>
          </div>
          <div class="step">
            <span class="step-number">۴</span>
            <span class="step-text">دوستان شما نیز ۱۰ توکن هدیه می‌گیرند</span>
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .referral-page {
    min-height: 100vh;
    background: #f0f2f5;
    padding: 16px;
  }

  .referral-container {
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
  }

  .header h1 {
    font-size: 20px;
    margin: 0;
    color: #050505;
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

  .loading {
    text-align: center;
    padding: 40px;
    color: #65676b;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
  }

  .stat-card {
    background: white;
    padding: 16px;
    border-radius: 12px;
    text-align: center;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }

  .stat-icon {
    font-size: 24px;
    margin-bottom: 4px;
  }

  .stat-number {
    font-size: 24px;
    font-weight: 700;
    color: #050505;
  }

  .stat-label {
    font-size: 12px;
    color: #65676b;
  }

  .code-section {
    background: white;
    padding: 20px;
    border-radius: 12px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }

  .code-section h3 {
    margin: 0 0 12px 0;
    font-size: 16px;
    color: #050505;
    text-align: center;
  }

  .code-display {
    display: flex;
    gap: 12px;
    align-items: center;
  }

  .code {
    flex: 1;
    padding: 12px;
    background: #f0f2f5;
    border-radius: 8px;
    font-size: 20px;
    font-weight: 700;
    font-family: monospace;
    text-align: center;
    color: #050505;
    letter-spacing: 2px;
  }

  .copy-btn {
    padding: 12px 20px;
    background: #1877f2;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s;
    font-weight: 600;
  }

  .copy-btn:hover {
    background: #1664d8;
  }

  .code-hint {
    text-align: center;
    color: #65676b;
    font-size: 13px;
    margin: 8px 0 0 0;
  }

  .share-section {
    background: white;
    padding: 20px;
    border-radius: 12px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }

  .share-section h3 {
    margin: 0 0 12px 0;
    font-size: 16px;
    color: #050505;
  }

  .share-buttons {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    margin-bottom: 12px;
  }

  .share-btn {
    padding: 10px;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    color: white;
  }

  .share-btn:hover {
    transform: scale(1.02);
  }

  .share-btn.whatsapp {
    background: #25D366;
  }

  .share-btn.telegram {
    background: #0088cc;
  }

  .share-btn.twitter {
    background: #1DA1F2;
  }

  .share-link {
    display: flex;
    gap: 8px;
  }

  .link-input {
    flex: 1;
    padding: 10px;
    border: 1px solid #d0d7de;
    border-radius: 8px;
    font-size: 13px;
    background: #f7f8fa;
    color: #050505;
    font-family: monospace;
  }

  .copy-link-btn {
    padding: 10px 16px;
    background: #e4e6eb;
    border: none;
    border-radius: 8px;
    font-size: 16px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .copy-link-btn:hover {
    background: #d8dadf;
  }

  .referrals-section {
    background: white;
    padding: 20px;
    border-radius: 12px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }

  .referrals-section h3 {
    margin: 0 0 12px 0;
    font-size: 16px;
    color: #050505;
  }

  .empty-referrals {
    text-align: center;
    padding: 30px 20px;
    color: #65676b;
  }

  .empty-icon {
    font-size: 40px;
    margin-bottom: 8px;
  }

  .empty-hint {
    font-size: 13px;
    color: #1877f2;
  }

  .referrals-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .referral-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    background: #f7f8fa;
    border-radius: 8px;
  }

  .referral-info {
    flex: 1;
  }

  .referral-name {
    font-weight: 600;
    color: #050505;
  }

  .referral-username {
    font-size: 13px;
    color: #65676b;
  }

  .referral-date {
    font-size: 12px;
    color: #65676b;
  }

  .how-it-works {
    background: white;
    padding: 20px;
    border-radius: 12px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }

  .how-it-works h3 {
    margin: 0 0 12px 0;
    font-size: 16px;
    color: #050505;
  }

  .steps {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .step {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .step-number {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: #1877f2;
    color: white;
    border-radius: 50%;
    font-size: 14px;
    font-weight: 700;
    flex-shrink: 0;
  }

  .step-text {
    color: #050505;
    font-size: 14px;
  }
</style>