<script lang="ts">
  import { goto } from '$app/navigation'
  import Avatar from '$lib/components/ui/Avatar.svelte'
  import type { User } from '$lib/stores/user'

  let { currentUser }: { currentUser: User | null } = $props()
</script>

<div class="create-wave-box">
  <button >
    <Avatar src={currentUser?.avatar ?? null} size="md" />
  </button>
  <button 
    class="create-input" 
    onclick={() => goto('/wave/create')}
    disabled={!currentUser}
  >
    {#if currentUser}
      موج جدید... 🎙️
    {:else}
      برای انتشار موج، وارد شوید 🔑
    {/if}
  </button>
</div>

<style>
  .create-wave-box {
    display: flex;
    align-items: center;
    gap: 12px;
    background: white;
    padding: 12px 16px;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    margin-bottom: 16px;
  }

  .create-input {
    flex: 1;
    border: none;
    background: #f0f2f5;
    padding: 10px 16px;
    border-radius: 20px;
    font-size: 15px;
    color: #65676b;
    cursor: pointer;
    text-align: right;
    transition: all 0.2s;
  }

  .create-input:hover:not(:disabled) {
    background: #e4e6eb;
  }

  .create-input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
</style>