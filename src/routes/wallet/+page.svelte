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

  let currentUser = $state<any>(null)
  let balance = $state(0)
  let transactions = $state<TokenTransaction[]>([])
  let loading = $state(true)
  let activeTab = $state('all')

  onMount(async () => {
    console.log('💰 Wallet page mounted')
    
    try {
      // Check if user is logged in
      const { data: { session: userSession } } = await supabase.auth.getSession()
      
      if (!userSession?.user) {
        console.log('❌ No session, redirecting to login')
        goto('/auth/login')
        return
      }

      // Get user data
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
      
      // Load wallet data
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

  function getTransactionIcon(type: string): string {
    const icons: Record<string, string> = {
      'WELCOME_BONUS': '🎁',
      'DAILY_REWARD': '🎁',
      'WAVE_PUBLISH': '📤',
      'LIKE_RECEIVED': '❤️',
      'COMMENT_RECEIVED': '💬',
      'REFERRAL': '👥',
      'BOOST_WAVE': '🚀',
      'GIFT': '🎁',
      'SPEND': '💸'
    }
    return icons[type] || '🪙'
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

  const filteredTransactions = transactions.filter(t => {
    if (activeTab === 'earn') return t.amount > 0
    if (activeTab === 'spend') return t.amount < 0
    return true
  })
</script>

<div class="wallet-page">
  <div class="wallet-container">
    <!-- Header -->
    <div class="header">
      <button class="back-btn" onclick={() => history.back()}>← بازگشت</button>
      <h1>👛 کیف پول</h1>
    </div>

    <!-- Balance Card -->
    <div class="balance-card">
      <div class="balance-icon">🪙</div>
      <div class="balance-info">
        <div class="balance-label">موجودی کل</div>
        <div class="balance-amount">
          {#if loading}
            <span class="loading-text">...</span>
          {:else}
            {balance.toLocaleString()} توکن
          {/if}
        </div>
        {#if !loading && balance === 0}
          <div class="empty-balance-note">
            💡 با فعالیت‌های روزانه توکن جمع کنید!
          </div>
        {/if}
      </div>
    </div>

    <!-- Quick Actions -->
    <div class="quick-actions">
      <button class="action-btn" onclick={() => alert('Coming soon: Boost a wave!')}>
        🚀 تقویت موج (۳۰ توکن)
      </button>
      <button class="action-btn" onclick={() => alert('Coming soon: Send gift!')}>
        🎁 ارسال هدیه
      </button>
    </div>

    <!-- Transactions -->
    <div class="transactions-section">
      <div class="section-header">
        <h2>📋 تراکنش‌ها</h2>
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
            📈 دریافتی
          </button>
          <button 
            class="tab {activeTab === 'spend' ? 'active' : ''}" 
            onclick={() => activeTab = 'spend'}
          >
            📉 خرج شده
          </button>
        </div>
      </div>

      {#if loading}
        <div class="loading">⏳ در حال بارگذاری...</div>
      {:else if filteredTransactions.length === 0}
        <div class="empty">
          <div class="empty-icon">📭</div>
          <p>هنوز تراکنشی انجام نشده است</p>
        </div>
      {:else}
        <div class="transactions-list">
          {#each filteredTransactions as tx (tx.id)}
            <div class="transaction-item {tx.amount > 0 ? 'earn' : 'spend'}">
              <div class="tx-icon">{getTransactionIcon(tx.type)}</div>
              <div class="tx-info">
                <div class="tx-label">{getTransactionLabel(tx.type)}</div>
                <div class="tx-time">{formatTime(tx.created_at)}</div>
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
      <h3>🎯 چگونه توکن جمع کنیم؟</h3>
      <div class="earn-grid">
        <div class="earn-item">
          <span>📝 انتشار موج</span>
          <span>+{TokenRewards.PUBLISH_WAVE}</span>
        </div>
        <div class="earn-item">
          <span>❤️ لایک دریافت شده</span>
          <span>+{TokenRewards.LIKE_RECEIVED}</span>
        </div>
        <div class="earn-item">
          <span>💬 نظر دریافت شده</span>
          <span>+{TokenRewards.COMMENT_RECEIVED}</span>
        </div>
        <div class="earn-item">
          <span>👥 دعوت دوست</span>
          <span>+{TokenRewards.REFERRAL}</span>
        </div>
        <div class="earn-item">
          <span>🎁 پاداش روزانه</span>
          <span>+{TokenRewards.DAILY_LOGIN}</span>
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
    max-width: 600px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .header {
    display: flex;
    align-items: center;
    gap: 16px;
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

  .balance-card {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 24px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    gap: 16px;
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
  }

  .balance-icon {
    font-size: 40px;
  }

  .balance-info {
    flex: 1;
  }

  .balance-label {
    font-size: 14px;
    opacity: 0.8;
  }

  .balance-amount {
    font-size: 28px;
    font-weight: 700;
  }

  .empty-balance-note {
    text-align: center;
    padding: 8px;
    background: rgba(255,255,255,0.2);
    border-radius: 8px;
    margin-top: 8px;
    font-size: 13px;
  }

  .loading-text {
    opacity: 0.5;
  }

  .quick-actions {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }

  .action-btn {
    flex: 1;
    min-width: 120px;
    padding: 12px 16px;
    background: white;
    border: 1px solid #d0d7de;
    border-radius: 8px;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s;
    font-family: inherit;
  }

  .action-btn:hover {
    background: #f0f2f5;
    border-color: #1877f2;
  }

  .transactions-section {
    background: white;
    border-radius: 12px;
    padding: 16px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    flex-wrap: wrap;
    gap: 8px;
  }

  .section-header h2 {
    margin: 0;
    font-size: 18px;
    color: #050505;
  }

  .tabs {
    display: flex;
    gap: 8px;
  }

  .tab {
    padding: 6px 12px;
    border: none;
    border-radius: 6px;
    background: #f0f2f5;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .tab:hover {
    background: #e4e6eb;
  }

  .tab.active {
    background: #1877f2;
    color: white;
  }

  .loading, .empty {
    text-align: center;
    padding: 40px 20px;
    color: #65676b;
  }

  .empty-icon {
    font-size: 40px;
    margin-bottom: 8px;
  }

  .transactions-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 400px;
    overflow-y: auto;
  }

  .transaction-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    border-radius: 8px;
    background: #f7f8fa;
    transition: all 0.2s;
  }

  .transaction-item:hover {
    background: #f0f2f5;
  }

  .tx-icon {
    font-size: 24px;
  }

  .tx-info {
    flex: 1;
  }

  .tx-label {
    font-weight: 500;
    color: #050505;
  }

  .tx-time {
    font-size: 12px;
    color: #65676b;
  }

  .tx-amount {
    font-size: 16px;
    font-weight: 700;
  }

  .tx-amount.positive {
    color: #10b981;
  }

  .tx-amount.negative {
    color: #dc3545;
  }

  .earn-info {
    background: white;
    border-radius: 12px;
    padding: 16px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }

  .earn-info h3 {
    margin: 0 0 12px 0;
    font-size: 16px;
    color: #050505;
  }

  .earn-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .earn-item {
    display: flex;
    justify-content: space-between;
    padding: 8px 12px;
    background: #f7f8fa;
    border-radius: 6px;
    font-size: 13px;
  }

  .earn-item span:last-child {
    font-weight: 600;
    color: #10b981;
  }
</style>