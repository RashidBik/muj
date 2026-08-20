<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { user } from '$lib/stores/user'
  import { 
    getTokenBalance, 
    getTokenTransactions,
    transferTokens 
  } from '$lib/services/token-service'
  import { getUserAdStats } from '$lib/services/ad-service'
  import { getUserActiveBoosts } from '$lib/services/boost-service'
  import { Coins, Send, History, TrendingUp, TrendingDown, Clock, ArrowUpRight, ArrowDownRight, Users, Eye, Rocket, ArrowLeft } from 'lucide-svelte'
import Wallet from '$lib/components/token/Wallet.svelte'

  let currentUser = $state<any>(null)
  let balance = $state(0)
  let transactions = $state<any[]>([])
  let adStats = $state<any>(null)
  let activeBoosts = $state<any[]>([])
  let loading = $state(true)
  let showTransfer = $state(false)
  let transferAmount = $state('')
  let transferTo = $state('')
  let transferMessage = $state('')
  let isTransferring = $state(false)

  $effect(() => {
    const unsubscribe = user.subscribe(value => {
      currentUser = value
      if (value) {
        loadWalletData(value.id)
      }
    })
    return () => unsubscribe()
  })

  async function loadWalletData(userId: string) {
    loading = true
    try {
      const [balanceData, transactionsData, adStatsData, boostsData] = await Promise.all([
        getTokenBalance(userId),
        getTokenTransactions(userId, 20),
        getUserAdStats(userId),
        getUserActiveBoosts(userId)
      ])

      balance = balanceData
      transactions = transactionsData
      adStats = adStatsData
      activeBoosts = boostsData
    } catch (error) {
      console.error('Error loading wallet data:', error)
    } finally {
      loading = false
    }
  }

  async function handleTransfer() {
    if (!currentUser) return

    const amount = parseInt(transferAmount)
    if (isNaN(amount) || amount < 10) {
      transferMessage = 'حداقل مقدار انتقال ۱۰ توکن است'
      return
    }

    if (amount > balance) {
      transferMessage = 'موجودی کافی نیست'
      return
    }

    if (!transferTo.trim()) {
      transferMessage = 'لطفاً نام کاربری گیرنده را وارد کنید'
      return
    }

    isTransferring = true
    transferMessage = ''

    try {
      // پیدا کردن کاربر گیرنده
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('username', transferTo.trim())
        .maybeSingle()

      if (userError || !userData) {
        transferMessage = 'کاربر مورد نظر یافت نشد'
        isTransferring = false
        return
      }

      if (userData.id === currentUser.id) {
        transferMessage = 'نمی‌توانید به خودتان توکن انتقال دهید'
        isTransferring = false
        return
      }

      const result = await transferTokens(
        currentUser.id,
        userData.id,
        amount,
        `انتقال توکن به ${transferTo}`
      )

      if (result.success) {
        transferMessage = result.message
        await loadWalletData(currentUser.id)
        setTimeout(() => {
          showTransfer = false
          transferAmount = ''
          transferTo = ''
          transferMessage = ''
        }, 3000)
      } else {
        transferMessage = result.message
      }
    } catch (error) {
      console.error('Error transferring tokens:', error)
      transferMessage = 'خطا در انتقال توکن'
    } finally {
      isTransferring = false
    }
  }

  function getTransactionIcon(type: string) {
    const icons: Record<string, any> = {
      'WELCOME_BONUS': Coins,
      'PUBLISH_WAVE': TrendingUp,
      'LIKE_RECEIVED': TrendingUp,
      'COMMENT_RECEIVED': TrendingUp,
      'REFERRAL': Users,
      'DAILY_LOGIN': Clock,
      'DAILY_STREAK': TrendingUp,
      'BOOST_WAVE': Rocket,
      'TASK_COMPLETED': TrendingUp,
      'AD_REWARD': Eye,
      'TRANSFER_SENT': ArrowUpRight,
      'TRANSFER_RECEIVED': ArrowDownRight,
    }
    return icons[type] || Coins
  }

  function getTransactionColor(type: string): string {
    const colors: Record<string, string> = {
      'WELCOME_BONUS': '#10b981',
      'PUBLISH_WAVE': '#10b981',
      'LIKE_RECEIVED': '#10b981',
      'COMMENT_RECEIVED': '#10b981',
      'REFERRAL': '#10b981',
      'DAILY_LOGIN': '#10b981',
      'DAILY_STREAK': '#10b981',
      'TASK_COMPLETED': '#10b981',
      'AD_REWARD': '#10b981',
      'TRANSFER_RECEIVED': '#10b981',
      'BOOST_WAVE': '#ef4444',
      'TRANSFER_SENT': '#ef4444',
    }
    return colors[type] || '#64748b'
  }

  function getTransactionLabel(type: string): string {
    const labels: Record<string, string> = {
      'WELCOME_BONUS': 'پاداش خوش‌آمدگویی',
      'PUBLISH_WAVE': 'انتشار موج',
      'LIKE_RECEIVED': 'دریافت لایک',
      'COMMENT_RECEIVED': 'دریافت نظر',
      'REFERRAL': 'دعوت دوست',
      'DAILY_LOGIN': 'ورود روزانه',
      'DAILY_STREAK': 'رکورد روزانه',
      'BOOST_WAVE': 'تقویت موج',
      'TASK_COMPLETED': 'تکمیل تسک',
      'AD_REWARD': 'پاداش تبلیغات',
      'TRANSFER_SENT': 'انتقال توکن',
      'TRANSFER_RECEIVED': 'دریافت توکن',
    }
    return labels[type] || type
  }

  function formatDate(date: string): string {
    try {
      return new Date(date).toLocaleDateString('fa-IR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return 'چندی پیش'
    }
  }

  function goBack() {
    history.back()
  }
</script>
<Wallet />
<div class="wallet-page">
  <div class="wallet-container">
    <!-- Header -->
    <div class="header">
      <button class="back-btn" onclick={goBack}>
        <ArrowLeft size={20} />
        بازگشت
      </button>
      <h1>کیف پول</h1>
      <div></div>
    </div>

    {#if loading}
      <div class="loading">
        <div class="spinner"></div>
        <p>در حال بارگذاری...</p>
      </div>
    {:else}
      <!-- Balance Card -->
      <div class="balance-card">
        <div class="balance-icon">
          <Coins size={32} />
        </div>
        <div class="balance-info">
          <div class="balance-label">موجودی شما</div>
          <div class="balance-amount">{balance.toLocaleString('fa-IR')}</div>
          <div class="balance-sub">توکن</div>
        </div>
      </div>

      <!-- Quick Stats -->
      <div class="quick-stats">
        <div class="stat-item">
          <span class="stat-value">{transactions.filter(t => t.amount > 0).length}</span>
          <span class="stat-label">دریافتی‌ها</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">{transactions.filter(t => t.amount < 0).length}</span>
          <span class="stat-label">پرداخت‌ها</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">{activeBoosts.length}</span>
          <span class="stat-label">بوست‌های فعال</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">{adStats?.tokens_earned || 0}</span>
          <span class="stat-label">توکن از تبلیغات</span>
        </div>
      </div>

      <!-- Actions -->
      <div class="actions">
        <button class="action-btn transfer-btn" onclick={() => showTransfer = !showTransfer}>
          <Send size={18} />
          انتقال توکن
        </button>
        <button class="action-btn history-btn" onclick={() => document.getElementById('transactions')?.scrollIntoView({ behavior: 'smooth' })}>
          <History size={18} />
          تاریخچه
        </button>
      </div>

      <!-- Transfer Form -->
      {#if showTransfer}
        <div class="transfer-form">
          <h4>انتقال توکن</h4>
          <p class="transfer-hint">حداقل ۱۰ توکن - فقط به کاربران دیگر</p>
          
          <div class="form-group">
            <label>نام کاربری گیرنده</label>
            <input
              type="text"
              placeholder="نام کاربری را وارد کنید..."
              bind:value={transferTo}
              disabled={isTransferring}
            />
          </div>
          
          <div class="form-group">
            <label>مقدار توکن</label>
            <input
              type="number"
              placeholder="مقدار توکن..."
              bind:value={transferAmount}
              min="10"
              max={balance}
              disabled={isTransferring}
            />
            <span class="max-hint">حداکثر: {balance.toLocaleString('fa-IR')}</span>
          </div>

          {#if transferMessage}
            <div class="transfer-message {transferMessage.includes('✅') ? 'success' : 'error'}">
              {transferMessage}
            </div>
          {/if}

          <div class="form-actions">
            <button class="cancel-btn" onclick={() => {
              showTransfer = false
              transferAmount = ''
              transferTo = ''
              transferMessage = ''
            }} disabled={isTransferring}>
              انصراف
            </button>
            <button class="submit-btn" onclick={handleTransfer} disabled={isTransferring}>
              {#if isTransferring}
                <span class="spinner-small"></span>
                در حال انتقال...
              {:else}
                انتقال توکن
              {/if}
            </button>
          </div>
        </div>
      {/if}

      <!-- Active Boosts -->
      {#if activeBoosts.length > 0}
        <div class="active-boosts">
          <h3>🚀 بوست‌های فعال</h3>
          <div class="boosts-list">
            {#each activeBoosts as boost (boost.id)}
              <div class="boost-item">
                <div class="boost-icon">🚀</div>
                <div class="boost-info">
                  <div class="boost-title">{boost.wave?.title || 'موج'}</div>
                  <div class="boost-duration">
                    تا {new Date(boost.expires_at).toLocaleDateString('fa-IR')}
                  </div>
                </div>
                <div class="boost-status">
                  <span class="status-badge active">فعال</span>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Transactions -->
      <div id="transactions" class="transactions-section">
        <div class="section-header">
          <History size={20} />
          <h3>تاریخچه تراکنش‌ها</h3>
          <span class="tx-count">{transactions.length}</span>
        </div>

        {#if transactions.length === 0}
          <div class="empty-transactions">
            <Coins size={48} />
            <p>هیچ تراکنشی وجود ندارد</p>
            <span>با فعالیت در اپلیکیشن توکن جمع‌آوری کنید</span>
          </div>
        {:else}
          <div class="transactions-list">
            {#each transactions as tx (tx.id)}
              {@const Icon = getTransactionIcon(tx.type)}
              {@const color = getTransactionColor(tx.type)}
              {@const isPositive = tx.amount > 0}
              <div class="transaction-item">
                <div class="tx-icon" style="background: {color}20; color: {color}">
                  <Icon size={18} />
                </div>
                <div class="tx-info">
                  <div class="tx-type">{getTransactionLabel(tx.type)}</div>
                  <div class="tx-date">{formatDate(tx.created_at)}</div>
                </div>
                <div class="tx-amount {isPositive ? 'positive' : 'negative'}">
                  {isPositive ? '+' : ''}{tx.amount.toLocaleString('fa-IR')}
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/if}
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

  /* Header */
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: white;
    padding: 16px 20px;
    border-radius: 12px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  }

  .header h1 {
    font-size: 20px;
    font-weight: 700;
    margin: 0;
    color: #1a1a2e;
  }

  .back-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    background: none;
    border: none;
    color: #6366f1;
    font-size: 14px;
    cursor: pointer;
    padding: 6px 10px;
    border-radius: 8px;
    transition: all 0.2s ease;
  }

  .back-btn:hover {
    background: #f1f5f9;
  }

  /* Loading */
  .loading {
    text-align: center;
    padding: 60px 20px;
    background: white;
    border-radius: 12px;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 4px solid #e2e8f0;
    border-top-color: #6366f1;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin: 0 auto 16px;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Balance Card */
  .balance-card {
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    border-radius: 16px;
    padding: 24px;
    display: flex;
    align-items: center;
    gap: 20px;
    color: white;
    box-shadow: 0 4px 20px rgba(99, 102, 241, 0.3);
  }

  .balance-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 56px;
    height: 56px;
    background: rgba(255,255,255,0.2);
    border-radius: 50%;
  }

  .balance-icon :global(svg) {
    color: white;
  }

  .balance-info {
    flex: 1;
  }

  .balance-label {
    font-size: 14px;
    opacity: 0.8;
  }

  .balance-amount {
    font-size: 32px;
    font-weight: 700;
    line-height: 1.2;
  }

  .balance-sub {
    font-size: 13px;
    opacity: 0.7;
  }

  /* Quick Stats */
  .quick-stats {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    background: white;
    padding: 12px;
    border-radius: 12px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  }

  .stat-item {
    text-align: center;
  }

  .stat-value {
    display: block;
    font-size: 18px;
    font-weight: 700;
    color: #1a1a2e;
  }

  .stat-label {
    font-size: 11px;
    color: #94a3b8;
  }

  /* Actions */
  .actions {
    display: flex;
    gap: 12px;
  }

  .action-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 14px;
    border: none;
    border-radius: 10px;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .action-btn :global(svg) {
    flex-shrink: 0;
  }

  .transfer-btn {
    background: #6366f1;
    color: white;
  }

  .transfer-btn:hover {
    background: #4f46e5;
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(99, 102, 241, 0.3);
  }

  .history-btn {
    background: #f1f5f9;
    color: #1a1a2e;
  }

  .history-btn:hover {
    background: #e2e8f0;
  }

  /* Transfer Form */
  .transfer-form {
    background: white;
    padding: 20px;
    border-radius: 12px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    animation: slideDown 0.3s ease;
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .transfer-form h4 {
    margin: 0 0 4px 0;
    font-size: 18px;
    color: #1a1a2e;
  }

  .transfer-hint {
    font-size: 13px;
    color: #94a3b8;
    margin: 0 0 16px 0;
  }

  .form-group {
    margin-bottom: 12px;
  }

  .form-group label {
    display: block;
    font-size: 13px;
    font-weight: 600;
    color: #1a1a2e;
    margin-bottom: 4px;
  }

  .form-group input {
    width: 100%;
    padding: 10px 14px;
    border: 2px solid #e2e8f0;
    border-radius: 10px;
    font-size: 15px;
    transition: all 0.2s ease;
  }

  .form-group input:focus {
    outline: none;
    border-color: #6366f1;
    box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.1);
  }

  .max-hint {
    display: block;
    text-align: right;
    font-size: 12px;
    color: #94a3b8;
    margin-top: 4px;
  }

  .transfer-message {
    padding: 10px 14px;
    border-radius: 8px;
    font-size: 14px;
    margin: 12px 0;
  }

  .transfer-message.success {
    background: #ecfdf5;
    color: #10b981;
    border: 1px solid #86efac;
  }

  .transfer-message.error {
    background: #fef2f2;
    color: #ef4444;
    border: 1px solid #fca5a5;
  }

  .form-actions {
    display: flex;
    gap: 12px;
  }

  .cancel-btn {
    flex: 1;
    padding: 10px;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    background: white;
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
    color: #64748b;
    transition: all 0.2s ease;
  }

  .cancel-btn:hover:not(:disabled) {
    background: #f1f5f9;
  }

  .submit-btn {
    flex: 2;
    padding: 10px;
    border: none;
    border-radius: 10px;
    background: #6366f1;
    color: white;
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
    transition: all 0.2s ease;
  }

  .submit-btn:hover:not(:disabled) {
    background: #4f46e5;
    transform: translateY(-2px);
  }

  .submit-btn:disabled, .cancel-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .spinner-small {
    display: inline-block;
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  /* Active Boosts */
  .active-boosts {
    background: white;
    padding: 16px;
    border-radius: 12px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  }

  .active-boosts h3 {
    margin: 0 0 12px 0;
    font-size: 16px;
    color: #1a1a2e;
  }

  .boosts-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .boost-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
    background: #f8fafc;
    border-radius: 8px;
  }

  .boost-icon {
    font-size: 24px;
  }

  .boost-info {
    flex: 1;
  }

  .boost-title {
    font-weight: 600;
    color: #1a1a2e;
    font-size: 14px;
  }

  .boost-duration {
    font-size: 12px;
    color: #94a3b8;
  }

  .status-badge {
    font-size: 11px;
    font-weight: 600;
    padding: 4px 12px;
    border-radius: 12px;
  }

  .status-badge.active {
    background: #ecfdf5;
    color: #10b981;
  }

  /* Transactions */
  .transactions-section {
    background: white;
    padding: 16px;
    border-radius: 12px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  }

  .section-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 16px;
  }

  .section-header :global(svg) {
    color: #6366f1;
  }

  .section-header h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 700;
    color: #1a1a2e;
    flex: 1;
  }

  .tx-count {
    font-size: 12px;
    color: #94a3b8;
    background: #f1f5f9;
    padding: 2px 10px;
    border-radius: 12px;
  }

  .empty-transactions {
    text-align: center;
    padding: 40px 20px;
    color: #94a3b8;
  }

  .empty-transactions :global(svg) {
    color: #cbd5e1;
    margin-bottom: 12px;
  }

  .empty-transactions p {
    margin: 0 0 4px 0;
    color: #1a1a2e;
    font-weight: 600;
  }

  .empty-transactions span {
    font-size: 13px;
  }

  .transactions-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-height: 400px;
    overflow-y: auto;
  }

  .transaction-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
    background: #f8fafc;
    border-radius: 8px;
    transition: all 0.2s ease;
  }

  .transaction-item:hover {
    background: #f1f5f9;
  }

  .tx-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .tx-info {
    flex: 1;
  }

  .tx-type {
    font-weight: 600;
    color: #1a1a2e;
    font-size: 14px;
  }

  .tx-date {
    font-size: 12px;
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

  @media (max-width: 640px) {
    .wallet-page {
      padding: 12px;
    }

    .quick-stats {
      grid-template-columns: repeat(2, 1fr);
      gap: 4px;
    }

    .balance-amount {
      font-size: 24px;
    }

    .balance-card {
      padding: 16px;
    }

    .actions {
      flex-direction: column;
    }
  }
</style>