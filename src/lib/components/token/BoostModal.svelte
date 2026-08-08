<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { X, Rocket, Zap, Flame, Calendar, Star } from 'lucide-svelte'
  import { BOOST_PLANS } from '$lib/services/boost-service'

  let {
    show,
    onClose,
    onBoost,
    userBalance,
    isProcessing
  }: {
    show: boolean
    onClose: () => void
    onBoost: (planId: string) => void
    userBalance: number
    isProcessing: boolean
  } = $props()

  let selectedPlan = $state<string | null>(null)

  function getPlanIcon(planId: string) {
    const icons: Record<string, any> = {
      'boost_12h': Zap,
      'boost_24h': Flame,
      'boost_weekly': Calendar,
      'boost_monthly': Star
    }
    return icons[planId] || Rocket
  }

    function formatNumber(num: number): string {
    if (num === undefined || num === null) return '0'
    return num.toLocaleString('fa-IR')
  }

  function getPlanColor(planId: string) {
    const colors: Record<string, string> = {
      'boost_12h': '#f59e0b',
      'boost_24h': '#ef4444',
      'boost_weekly': '#8b5cf6',
      'boost_monthly': '#ec4899'
    }
    return colors[planId] || '#6366f1'
  }

  function handleSelect(planId: string) {
    selectedPlan = planId
  }

  function handleBoost() {
    if (selectedPlan) {
      onBoost(selectedPlan)
    }
  }
</script>

{#if show}
  <div class="modal-overlay" onclick={onClose}>
    <div class="modal-content" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <div class="header-icon">
          <Rocket size={28} />
        </div>
        <h3>تقویت موج</h3>
        <button class="modal-close" onclick={onClose}>
          <X size={20} />
        </button>
      </div>

      <p class="modal-description">
        موج خود را تقویت کنید تا در بالای فید نمایش داده شود و بازدید بیشتری دریافت کند.
      </p>

      <div class="balance-info">
        <span>موجودی شما:</span>
        <span class="balance-amount">{formatNumber(userBalance)} توکن</span>
      </div>

      <div class="plans-grid">
        {#each BOOST_PLANS as plan (plan.id)}
          {@const Icon = getPlanIcon(plan.id)}
          {@const color = getPlanColor(plan.id)}
          <div 
            class="plan-card {selectedPlan === plan.id ? 'selected' : ''}"
            style="border-color: {selectedPlan === plan.id ? color : 'transparent'}"
            onclick={() => handleSelect(plan.id)}
          >
            <div class="plan-icon" style="background: {color}">
              <Icon size={24} color="white" />
            </div>
            <div class="plan-info">
              <div class="plan-name">{plan.name}</div>
              <div class="plan-duration">{plan.duration_hours} ساعت</div>
            </div>
            <div class="plan-price">
              <span class="price-amount">{formatNumber(plan.price)}</span>
              <span class="price-label">توکن</span>
            </div>
            <div class="plan-select">
              <input 
                type="radio" 
                name="boostPlan" 
                value={plan.id}
                checked={selectedPlan === plan.id}
                onchange={() => handleSelect(plan.id)}
              />
            </div>
          </div>
        {/each}
      </div>

      <div class="modal-actions">
        <button class="cancel-btn" onclick={onClose} disabled={isProcessing}>
          انصراف
        </button>
        <button 
          class="boost-btn" 
          onclick={handleBoost}
          disabled={!selectedPlan || isProcessing || userBalance < (BOOST_PLANS.find(p => p.id === selectedPlan)?.price || 0)}
        >
          {#if isProcessing}
            <span class="spinner-small"></span>
            در حال پردازش...
          {:else}
            <Rocket size={18} />
            تقویت موج
          {/if}
        </button>
      </div>

      {#if selectedPlan && userBalance < (BOOST_PLANS.find(p => p.id === selectedPlan)?.price || 0)}
        <div class="insufficient-balance">
          ⚠️ موجودی کافی نیست. برای افزایش موجودی، تسک‌های روزانه را انجام دهید یا تبلیغات مشاهده کنید.
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 16px;
    animation: fadeIn 0.2s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .modal-content {
    background: white;
    border-radius: 20px;
    padding: 24px;
    max-width: 480px;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
    animation: slideUp 0.3s ease;
  }

  @keyframes slideUp {
    from {
      transform: translateY(20px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  .modal-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid #f1f5f9;
  }

  .header-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: #eef2ff;
  }

  .header-icon :global(svg) {
    color: #6366f1;
  }

  .modal-header h3 {
    margin: 0;
    font-size: 20px;
    font-weight: 700;
    color: #1a1a2e;
    flex: 1;
  }

  .modal-close {
    background: #f1f5f9;
    border: none;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    color: #64748b;
  }

  .modal-close:hover {
    background: #e2e8f0;
  }

  .modal-description {
    color: #64748b;
    font-size: 14px;
    margin-bottom: 16px;
    line-height: 1.6;
  }

  .balance-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background: #f8fafc;
    border-radius: 10px;
    margin-bottom: 16px;
    font-size: 14px;
    color: #64748b;
  }

  .balance-amount {
    font-weight: 700;
    color: #1a1a2e;
    font-size: 18px;
  }

  .plans-grid {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 20px;
  }

  .plan-card {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px 18px;
    border-radius: 12px;
    border: 2px solid #e2e8f0;
    cursor: pointer;
    transition: all 0.2s ease;
    background: #fafbfc;
  }

  .plan-card:hover {
    background: #f1f5f9;
    transform: translateX(4px);
  }

  .plan-card.selected {
    background: #f0f0ff;
    border-color: #6366f1;
  }

  .plan-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .plan-info {
    flex: 1;
  }

  .plan-name {
    font-weight: 600;
    color: #1a1a2e;
    font-size: 15px;
  }

  .plan-duration {
    font-size: 13px;
    color: #64748b;
  }

  .plan-price {
    text-align: center;
  }

  .price-amount {
    font-size: 18px;
    font-weight: 700;
    color: #1a1a2e;
  }

  .price-label {
    font-size: 12px;
    color: #94a3b8;
    margin-left: 2px;
  }

  .plan-select input[type="radio"] {
    width: 18px;
    height: 18px;
    accent-color: #6366f1;
    cursor: pointer;
  }

  .modal-actions {
    display: flex;
    gap: 12px;
  }

  .cancel-btn {
    flex: 1;
    padding: 12px;
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

  .cancel-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .boost-btn {
    flex: 2;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px;
    border: none;
    border-radius: 10px;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    color: white;
    cursor: pointer;
    font-size: 15px;
    font-weight: 600;
    transition: all 0.2s ease;
  }

  .boost-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(99, 102, 241, 0.3);
  }

  .boost-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }

  .insufficient-balance {
    margin-top: 12px;
    padding: 12px 16px;
    background: #fef2f2;
    border-radius: 10px;
    font-size: 13px;
    color: #dc2626;
    border: 1px solid #fca5a5;
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

  @media (max-width: 640px) {
    .modal-content {
      padding: 16px;
      margin: 8px;
    }

    .plan-card {
      padding: 12px 14px;
    }

    .plan-icon {
      width: 36px;
      height: 36px;
    }

    .plan-icon :global(svg) {
      width: 20px;
      height: 20px;
    }
  }
</style>