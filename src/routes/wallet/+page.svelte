<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { supabase } from '$lib/client/supabase'
  import { user } from '$lib/stores/user'
  import { session } from '$lib/stores/auth'
  import { 
    getTokenBalance, 
    getTokenTransactions,
    TokenRewards,
  } from '$lib/services/token-service'
  import type { TokenTransaction } from '$lib/services/token-service'
  import { formatDistanceToNow } from 'date-fns'
  import { faIR } from 'date-fns/locale'

  // Icon imports
  import {
    ArrowLeft,
    Wallet,
    Coins,
    Rocket,
    Gift,
    TrendingUp,
    TrendingDown,
    Award,
    Mic,
    Heart,
    MessageCircle,
    Users,
    CalendarDays,
    Sparkles,
    Flame,
    Crown,
    Zap,
    Send,
    Plus,
    Minus,
    Clock,
    AlertCircle,
    BarChart3,
    Target,
    CheckCircle,
    List,
    Filter,
    ThumbsUp,
    ThumbsDown
  } from 'lucide-svelte'

  let currentUser = $state<any>(null)
  let balance = $state(0)
  let transactions = $state<TokenTransaction[]>([])
  let loading = $state(true)
  let activeTab = $state('all')

  // Transaction icon mapping
  function getTransactionIcon(type: string) {
    const iconMap: Record<string, any> = {
      'WELCOME_BONUS': Gift,
      'DAILY_REWARD': CalendarDays,
      'WAVE_PUBLISH': Mic,
      'LIKE_RECEIVED': Heart,
      'COMMENT_RECEIVED': MessageCircle,
      'REFERRAL': Users,
      'BOOST_WAVE': Rocket,
      'GIFT': Gift,
      'SPEND': Send
    }
    return iconMap[type] || Coins
  }

  function getTransactionColor(type: string): string {
    const colorMap: Record<string, string> = {
      'WELCOME_BONUS': '#10b981',
      'DAILY_REWARD': '#10b981',
      'WAVE_PUBLISH': '#6366f1',
      'LIKE_RECEIVED': '#ef4444',
      'COMMENT_RECEIVED': '#f59e0b',
      'REFERRAL': '#8b5cf6',
      'BOOST_WAVE': '#f97316',
      'GIFT': '#ec4899',
      'SPEND': '#ef4444'
    }
    return colorMap[type] || '#64748b'
  }

  function getTransactionLabel(type: string): string {
    const labels: Record<string, string> = {
      'WELCOME_BONUS': 'پاداش خوش‌آمدگویی',
      'DAILY_REWARD': 'پاداش روزانه',
      'WAVE_PUBLISH': 'انتشار موج',
      'LIKE_RECEIVED': 'لایک دریافت شده',
      'COMMENT_RECEIVED': 'نظر دریافت شده',
      'REFERRAL': 'دعوت دوست',
      'BOOST_WAVE': 'تقویت موج',
      'GIFT': 'هدیه',
      'SPEND': 'خرج کردن'
    }
    return labels[type] || type
  }

  onMount(async () => {
    console.log('💰 Wallet page mounted')
    
    try {
      const { data: { session: userSession } } = await supabase.auth.getSession()
      
      if (!userSession?.user) {
        console.log('❌ No session, redirecting to login')
        goto('/auth/login')
        return
      }

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, email, name, username, avatar, bio')
        .eq('id', userSession.user.id)
        .maybeSingle()

      if (userError || !userData) {
        console.error('Error fetching user:', userError)
        goto('/')
        return
      }

      currentUser = userData
      
      await loadWallet(userData.id)
      
    } catch (error) {
      console.error('Error in wallet page:', error)
      goto('/')
    } finally {
      loading = false
    }
  })

  async function loadWallet(userId: string) {
    loading = true
    try {
      balance = await getTokenBalance(userId)
      transactions = await getTokenTransactions(userId, 50)
      console.log(`💰 Balance: ${balance}, Transactions: ${transactions.length}`)
    } catch (error) {
      console.error('Error loading wallet:', error)
    } finally {
      loading = false
    }
  }

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

  const filteredTransactions = transactions.filter(t => {
    if (activeTab === 'earn') return t.amount > 0
    if (activeTab === 'spend') return t.amount < 0
    return true
  })

  // Get stats
  const totalEarned = transactions.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0)
  const totalSpent = transactions.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0)
</script>

<div class="wallet-page">
  <div class="wallet-container">
    <!-- Header -->
    <div class="header">
      <button class="back-btn" onclick={() => history.back()}>
        <ArrowLeft size={20} />
        بازگشت
      </button>
      <h1>
        <Wallet size={22} />
        کیف پول
      </h1>
    </div>

    <!-- Balance Card -->
    <div class="balance-card">
      <div class="balance-icon">
        <Coins size={48} />
      </div>
      <div class="balance-info">
        <div class="balance-label">موجودی کل</div>
        <div class="balance-amount">
          {#if loading}
            <span class="loading-text">...</span>
          {:else}
            {balance.toLocaleString()} <span class="token-label">توکن</span>
          {/if}
        </div>
        {#if !loading && balance === 0}
          <div class="empty-balance-note">
            <Sparkles size={14} />
            با فعالیت‌های روزانه توکن جمع کنید!
          </div>
        {/if}
      </div>
    </div>

    <!-- Quick Stats -->
    {#if !loading && transactions.length > 0}
      <div class="quick-stats">
        <div class="stat-item">
          <div class="stat-icon earn-icon"><TrendingUp size={16} /></div>
          <div class="stat-info">
            <span class="stat-label">مجموع دریافتی</span>
            <span class="stat-value positive">+{totalEarned.toLocaleString()}</span>
          </div>
        </div>
        <div class="stat-divider"></div>
        <div class="stat-item">
          <div class="stat-icon spend-icon"><TrendingDown size={16} /></div>
          <div class="stat-info">
            <span class="stat-label">مجموع خرج شده</span>
            <span class="stat-value negative">-{totalSpent.toLocaleString()}</span>
          </div>
        </div>
      </div>
    {/if}

    <!-- Quick Actions -->
    <div class="quick-actions">
      <button class="action-btn boost-btn" onclick={() => alert('Coming soon: Boost a wave!')}>
        <Rocket size={18} />
        تقویت موج (۳۰ توکن)
      </button>
      <button class="action-btn gift-btn" onclick={() => alert('Coming soon: Send gift!')}>
        <Gift size={18} />
        ارسال هدیه
      </button>
    </div>

    <!-- Transactions -->
    <div class="transactions-section">
      <div class="section-header">
        <div class="section-title">
          <List size={20} />
          <h2>تراکنش‌ها</h2>
          <span class="tx-count">{filteredTransactions.length}</span>
        </div>
        <div class="tabs">
          <button 
            class="tab {activeTab === 'all' ? 'active' : ''}" 
            onclick={() => activeTab = 'all'}
          >
            همه
          </button>
          <button 
            class="tab {activeTab === 'earn' ? 'active' : ''}" 
            onclick={() => activeTab = 'earn'}
          >
            <TrendingUp size={14} />
            دریافتی
          </button>
          <button 
            class="tab {activeTab === 'spend' ? 'active' : ''}" 
            onclick={() => activeTab = 'spend'}
          >
            <TrendingDown size={14} />
            خرج شده
          </button>
        </div>
      </div>

      {#if loading}
        <div class="loading">
          <div class="spinner-small"></div>
          در حال بارگذاری...
        </div>
      {:else if filteredTransactions.length === 0}
        <div class="empty">
          <Coins size={48} />
          <p>هنوز تراکنشی انجام نشده است</p>
          <span class="empty-hint">با انتشار موج یا دریافت لایک شروع کنید!</span>
        </div>
      {:else}
        <div class="transactions-list">
          {#each filteredTransactions as tx (tx.id)}
            {@const IconComponent = getTransactionIcon(tx.type)}
            {@const iconColor = getTransactionColor(tx.type)}
            <div class="transaction-item {tx.amount > 0 ? 'earn' : 'spend'}">
              <div class="tx-icon-wrapper" style="background: {iconColor}20;">
                <IconComponent size={20} color={iconColor} />
              </div>
              <div class="tx-info">
                <div class="tx-label">{getTransactionLabel(tx.type)}</div>
                <div class="tx-time">
                  <Clock size={12} />
                  {formatTime(tx.created_at)}
                </div>
              </div>
              <div class="tx-amount {tx.amount > 0 ? 'positive' : 'negative'}">
                {tx.amount > 0 ? '+' : ''}{tx.amount}
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <!-- How to earn tokens -->
    <div class="earn-info">
      <div class="earn-header">
        <Target size={20} />
        <h3>چگونه توکن جمع کنیم؟</h3>
      </div>
      <div class="earn-grid">
        <div class="earn-item">
          <span class="earn-label">
            <Mic size={14} />
            انتشار موج
          </span>
          <span class="earn-value">+{TokenRewards.PUBLISH_WAVE}</span>
        </div>
        <div class="earn-item">
          <span class="earn-label">
            <Heart size={14} />
            لایک دریافت شده
          </span>
          <span class="earn-value">+{TokenRewards.LIKE_RECEIVED}</span>
        </div>
        <div class="earn-item">
          <span class="earn-label">
            <MessageCircle size={14} />
            نظر دریافت شده
          </span>
          <span class="earn-value">+{TokenRewards.COMMENT_RECEIVED}</span>
        </div>
        <div class="earn-item">
          <span class="earn-label">
            <Users size={14} />
            دعوت دوست
          </span>
          <span class="earn-value">+{TokenRewards.REFERRAL}</span>
        </div>
        <div class="earn-item highlight">
          <span class="earn-label">
            <CalendarDays size={14} />
            پاداش روزانه
          </span>
          <span class="earn-value">+{TokenRewards.DAILY_LOGIN}</span>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .wallet-page {
    min-height: 100vh;
    background: #f0f2f5;
    padding: 16px;
  }

  .wallet-container {
    max-width: 640px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  /* Header */
  .header {
    display: flex;
    align-items: center;
    gap: 16px;
    background: white;
    padding: 14px 20px;
    border-radius: 12px;
    box-shadow: 0 1px 4px rgba(0,0,0,0.04);
  }

  .header h1 {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 20px;
    font-weight: 700;
    margin: 0;
    color: #1a1a2e;
  }

  .header h1 :global(svg) {
    color: #6366f1;
  }

  .back-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    background: none;
    border: none;
    color: #6366f1;
    font-size: 15px;
    font-weight: 500;
    cursor: pointer;
    padding: 8px 12px;
    border-radius: 8px;
    transition: all 0.2s ease;
  }

  .back-btn:hover {
    background: #f1f5f9;
  }

  /* Balance Card */
  .balance-card {
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    color: white;
    padding: 28px 24px;
    border-radius: 16px;
    display: flex;
    align-items: center;
    gap: 20px;
    box-shadow: 0 4px 20px rgba(99, 102, 241, 0.3);
    transition: transform 0.3s ease;
  }

  .balance-card:hover {
    transform: translateY(-2px);
  }

  .balance-icon :global(svg) {
    color: rgba(255,255,255,0.9);
  }

  .balance-info {
    flex: 1;
  }

  .balance-label {
    font-size: 14px;
    opacity: 0.8;
    font-weight: 500;
  }

  .balance-amount {
    font-size: 32px;
    font-weight: 700;
    display: flex;
    align-items: baseline;
    gap: 6px;
  }

  .token-label {
    font-size: 16px;
    font-weight: 500;
    opacity: 0.8;
  }

  .empty-balance-note {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    background: rgba(255,255,255,0.15);
    border-radius: 8px;
    margin-top: 8px;
    font-size: 13px;
  }

  .loading-text {
    opacity: 0.5;
  }

  /* Quick Stats */
  .quick-stats {
    display: flex;
    background: white;
    border-radius: 12px;
    padding: 12px 20px;
    box-shadow: 0 1px 4px rgba(0,0,0,0.04);
    align-items: center;
  }

  .stat-item {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
  }

  .stat-icon {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .earn-icon {
    background: #d1fae5;
  }

  .earn-icon :global(svg) {
    color: #10b981;
  }

  .spend-icon {
    background: #fee2e2;
  }

  .spend-icon :global(svg) {
    color: #ef4444;
  }

  .stat-info {
    display: flex;
    flex-direction: column;
  }

  .stat-label {
    font-size: 12px;
    color: #94a3b8;
  }

  .stat-value {
    font-size: 15px;
    font-weight: 700;
  }

  .stat-value.positive {
    color: #10b981;
  }

  .stat-value.negative {
    color: #ef4444;
  }

  .stat-divider {
    width: 1px;
    height: 30px;
    background: #e2e8f0;
  }

  /* Quick Actions */
  .quick-actions {
    display: flex;
    gap: 12px;
  }

  .action-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px 16px;
    border: none;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    font-family: inherit;
  }

  .boost-btn {
    background: #fef3c7;
    color: #92400e;
  }

  .boost-btn:hover {
    background: #fde68a;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(245, 158, 11, 0.2);
  }

  .gift-btn {
    background: #fce7f3;
    color: #831843;
  }

  .gift-btn:hover {
    background: #fbcfe8;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(236, 72, 153, 0.2);
  }

  /* Transactions */
  .transactions-section {
    background: white;
    border-radius: 12px;
    padding: 16px 20px;
    box-shadow: 0 1px 4px rgba(0,0,0,0.04);
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    flex-wrap: wrap;
    gap: 8px;
  }

  .section-title {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .section-title :global(svg) {
    color: #6366f1;
  }

  .section-title h2 {
    margin: 0;
    font-size: 17px;
    font-weight: 700;
    color: #1a1a2e;
  }

  .tx-count {
    font-size: 12px;
    color: #94a3b8;
    background: #f1f5f9;
    padding: 2px 10px;
    border-radius: 12px;
  }

  .tabs {
    display: flex;
    gap: 6px;
  }

  .tab {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 14px;
    border: none;
    border-radius: 8px;
    background: #f1f5f9;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    font-family: inherit;
    color: #64748b;
  }

  .tab :global(svg) {
    color: #94a3b8;
  }

  .tab:hover {
    background: #e2e8f0;
  }

  .tab.active {
    background: #6366f1;
    color: white;
  }

  .tab.active :global(svg) {
    color: white;
  }

  .loading, .empty {
    text-align: center;
    padding: 40px 20px;
    color: #64748b;
  }

  .empty :global(svg) {
    color: #cbd5e1;
    margin-bottom: 12px;
  }

  .empty p {
    margin: 0 0 4px 0;
    font-weight: 500;
  }

  .empty-hint {
    font-size: 13px;
    color: #94a3b8;
  }

  .transactions-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 400px;
    overflow-y: auto;
  }

  .transactions-list::-webkit-scrollbar {
    width: 4px;
  }

  .transactions-list::-webkit-scrollbar-track {
    background: #f1f5f9;
    border-radius: 2px;
  }

  .transactions-list::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 2px;
  }

  .transaction-item {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 12px 16px;
    border-radius: 10px;
    background: #f8fafc;
    transition: all 0.2s ease;
  }

  .transaction-item:hover {
    background: #f1f5f9;
    transform: translateX(4px);
  }

  .tx-icon-wrapper {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .tx-info {
    flex: 1;
  }

  .tx-label {
    font-weight: 600;
    color: #1a1a2e;
    font-size: 14px;
  }

  .tx-time {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: #94a3b8;
    margin-top: 2px;
  }

  .tx-time :global(svg) {
    color: #94a3b8;
  }

  .tx-amount {
    font-size: 16px;
    font-weight: 700;
  }

  .tx-amount.positive {
    color: #10b981;
  }

  .tx-amount.negative {
    color: #ef4444;
  }

  /* Earn Info */
  .earn-info {
    background: white;
    border-radius: 12px;
    padding: 16px 20px;
    box-shadow: 0 1px 4px rgba(0,0,0,0.04);
  }

  .earn-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 12px;
  }

  .earn-header :global(svg) {
    color: #6366f1;
  }

  .earn-header h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 700;
    color: #1a1a2e;
  }

  .earn-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .earn-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 14px;
    background: #f8fafc;
    border-radius: 8px;
    font-size: 13px;
    transition: all 0.2s ease;
  }

  .earn-item:hover {
    background: #f1f5f9;
  }

  .earn-item.highlight {
    background: #eff6ff;
    border: 1px solid #bfdbfe;
  }

  .earn-label {
    display: flex;
    align-items: center;
    gap: 6px;
    color: #1a1a2e;
    font-weight: 500;
  }

  .earn-label :global(svg) {
    color: #6366f1;
  }

  .earn-value {
    font-weight: 700;
    color: #10b981;
  }

  /* Spinner */
  .spinner-small {
    width: 24px;
    height: 24px;
    border: 3px solid #e2e8f0;
    border-top-color: #6366f1;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin: 0 auto 12px;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Responsive */
  @media (max-width: 640px) {
    .wallet-page {
      padding: 12px;
    }

    .balance-card {
      padding: 20px 16px;
    }

    .balance-amount {
      font-size: 26px;
    }

    .quick-stats {
      padding: 10px 16px;
      flex-direction: column;
      gap: 8px;
    }

    .stat-divider {
      width: 100%;
      height: 1px;
    }

    .quick-actions {
      flex-direction: column;
    }

    .earn-grid {
      grid-template-columns: 1fr;
    }

    .section-header {
      flex-direction: column;
      align-items: stretch;
    }

    .tabs {
      justify-content: stretch;
    }

    .tab {
      flex: 1;
      justify-content: center;
    }

    .transaction-item {
      padding: 10px 12px;
    }
  }

  @media (max-width: 400px) {
    .balance-amount {
      font-size: 22px;
    }

    .tx-label {
      font-size: 13px;
    }

    .tx-amount {
      font-size: 14px;
    }
  }
</style>