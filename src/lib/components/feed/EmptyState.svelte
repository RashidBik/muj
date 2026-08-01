<script lang="ts">
  import { goto } from '$app/navigation'
  import type { User } from '$lib/stores/user'

  let { currentUser }: { currentUser: User | null } = $props()
</script>

<div class="empty">
  <div class="empty-icon">🌊</div>
  <h3>هیچ موجی وجود ندارد!</h3>
  <p>اولین موج را منتشر کن و شروع کن به موج‌سازی 🚀</p>
  {#if currentUser}
    <button class="create-first-btn" onclick={() => goto('/wave/create')}>
      🎙️ انتشار اولین موج
    </button>
  {:else}
    <p>برای انتشار موج، ابتدا <a href="/auth/login">وارد شوید</a></p>
  {/if}
</div>

<style>
  .empty {
    text-align: center;
    padding: 60px 20px;
    background: white;
    border-radius: 12px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }

  .empty-icon {
    font-size: 64px;
    margin-bottom: 16px;
  }

  .empty h3 {
    margin: 0 0 8px 0;
    color: #050505;
  }

  .empty p {
    color: #65676b;
    margin: 0 0 16px 0;
  }

  .create-first-btn {
    background: #1877f2;
    color: white;
    border: none;
    padding: 12px 24px;
    border-radius: 8px;
    font-size: 16px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .create-first-btn:hover {
    background: #1664d8;
  }
</style>