<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import Avatar from '$lib/components/ui/Avatar.svelte'
  import { supabase } from '$lib/client/supabase'
  import { user } from '$lib/stores/user'
  
  // استفاده از $state برای stateهای محلی
  let waves = $state<any[]>([])
  let loading = $state(true)
  let currentUser = $state<any>(null)

  // استفاده از $effect برای واکنش به تغییرات store
  $effect(() => {
    const unsubscribe = user.subscribe(value => {
      currentUser = value
    })
    return () => unsubscribe()
  })

  // تابع بارگذاری موج‌ها
  async function loadWaves() {
    loading = true
    const { data, error } = await supabase
      .from('waves')
      .select(`
        *,
        author:users(name, username, avatar)
      `)
      .order('created_at', { ascending: false })
      .limit(20)

    if (data) {
      waves = data
    }
    loading = false
  }

  // بارگذاری اولیه
  onMount(() => {
    loadWaves()
  })
</script>

<div class="feed">
  <!-- استوری‌ها (فعلاً کامنت) -->
  <!-- <Stories /> -->
  
  <!-- دکمه موج جدید -->
  <div class="create-wave-box">
    <Avatar src={currentUser?.avatar ?? null} size="md" />
    <button class="create-input" on:click={() => goto('/wave/create')}>
      موج جدید... 🎙️
    </button>
  </div>

  <!-- لیست موج‌ها -->
  {#if loading}
    <div class="loading">در حال بارگذاری...</div>
  {:else if waves.length === 0}
    <div class="empty">هیچ موجی وجود ندارد. اولین موج را منتشر کن! 🚀</div>
  {:else}
    {#each waves as wave (wave.id)}
      <!-- <WaveCard {wave} /> -->
      <div class="wave-placeholder">
        <h3>{wave.title}</h3>
        <p>نویسنده: {wave.author?.name}</p>
        <p>مدت زمان: {wave.duration} ثانیه</p>
        <p>❤️ {wave.likes_count} | 💬 {wave.comments_count}</p>
      </div>
    {/each}
  {/if}
</div>

<style>
  .feed {
    max-width: 600px;
    margin: 0 auto;
    padding: 16px;
  }

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

  .create-input:hover {
    background: #e4e6eb;
  }

  .loading {
    text-align: center;
    padding: 40px;
    color: #65676b;
  }

  .empty {
    text-align: center;
    padding: 60px 20px;
    color: #65676b;
    font-size: 18px;
  }

  .wave-placeholder {
    background: white;
    padding: 16px;
    border-radius: 8px;
    margin-bottom: 12px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }

  .wave-placeholder h3 {
    margin: 0 0 8px 0;
    color: #050505;
  }
</style>