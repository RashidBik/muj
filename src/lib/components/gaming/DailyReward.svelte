<script lang="ts">
  import { onMount } from 'svelte'
  import { user } from '$lib/stores/user'
  import { getDailyReward } from '$lib/client/score-client'

  let rewardStatus = $state<{ claimed: boolean; points?: number; message?: string } | null>(null)
  let loading = $state(false)
  let currentUser = $state<any>(null)

  // Get user from store
  onMount(() => {
    const unsubscribe = user.subscribe(value => {
      currentUser = value
    })
    return () => unsubscribe()
  })

  // Check reward when user changes
  $effect(() => {
    if (currentUser) {
      checkReward()
    }
  })

  async function checkReward() {
    if (!currentUser) return
    loading = true
    try {
      const result = await getDailyReward(currentUser.id)
      rewardStatus = result
    } catch (error) {
      console.error('Error checking reward:', error)
    } finally {
      loading = false
    }
  }

  async function claimReward() {
    if (!currentUser) return
    loading = true
    try {
      const result = await getDailyReward(currentUser.id)
      rewardStatus = result
    } catch (error) {
      console.error('Error claiming reward:', error)
    } finally {
      loading = false
    }
  }
</script>

{#if currentUser}
  <div class="daily-reward">
    {#if loading}
      <div class="loading">⏳</div>
    {:else if rewardStatus?.claimed}
      <div class="claimed">
        ✅ پاداش روزانه: {rewardStatus.points} امتیاز
      </div>
    {:else}
      <button class="claim-btn" onclick={claimReward}>
        🎁 دریافت پاداش روزانه
      </button>
    {/if}
  </div>
{/if}

<style>
  .daily-reward {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 12px 20px;
    border-radius: 12px;
    text-align: center;
    margin: 8px 0 16px 0;
    box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
  }

  .claim-btn {
    background: #ffd700;
    color: #050505;
    border: none;
    padding: 10px 24px;
    border-radius: 8px;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.2s;
    font-size: 16px;
  }

  .claim-btn:hover {
    transform: scale(1.05);
    box-shadow: 0 2px 12px rgba(255, 215, 0, 0.4);
  }

  .claimed {
    font-weight: bold;
    font-size: 16px;
  }

  .loading {
    animation: pulse 1s infinite;
    font-size: 20px;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }
</style>