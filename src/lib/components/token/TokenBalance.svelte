<script lang="ts">
  import { onMount } from 'svelte'
  import { user } from '$lib/stores/user'
  import { getTokenBalance } from '$lib/services/token-service'

  let balance = $state(0)
  let loading = $state(true)
  let currentUser = $state<any>(null)

  onMount(() => {
    const unsubscribe = user.subscribe(async (value) => {
      currentUser = value
      if (value) {
        await loadBalance(value.id)
      }
    })
    return () => unsubscribe()
  })

  async function loadBalance(userId: string) {
    loading = true
    try {
      balance = await getTokenBalance(userId)
    } catch (error) {
      console.error('Error loading balance:', error)
    } finally {
      loading = false
    }
  }
</script>

{#if currentUser}
  <div class="token-balance">
    <div class="token-icon">🪙</div>
    <div class="token-info">
      <div class="token-label">توکن‌های شما</div>
      <div class="token-amount">
        {#if loading}
          <span class="loading-text">...</span>
        {:else}
          {balance.toLocaleString()}
        {/if}
      </div>
    </div>
    <!-- ✅ Remove the button that was causing navigation -->
  </div>
{/if}

<style>
  .token-balance {
    display: flex;
    align-items: center;
    gap: 8px;
    background: #f0f2f5;
    padding: 6px 12px;
    border-radius: 8px;
    transition: all 0.2s;
  }

  .token-balance:hover {
    background: #e4e6eb;
  }

  .token-icon {
    font-size: 20px;
  }

  .token-info {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .token-label {
    font-size: 12px;
    color: #65676b;
  }

  .token-amount {
    font-size: 16px;
    font-weight: 700;
    color: #050505;
    min-width: 30px;
  }

  .loading-text {
    opacity: 0.5;
  }
</style>