<script lang="ts">
  import { onMount } from 'svelte'
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'
  import { supabase } from '$lib/client/supabase'
  import WaveRoom from '$lib/components/room/WaveRoom.svelte'

  let wave = $state<any>(null)
  let loading = $state(true)
  let error = $state<string | null>(null)

  async function loadWave() {
    loading = true
    error = null

    try {
      const waveId = $page.params.id
      
      const { data, error: fetchError } = await supabase
        .from('waves')
        .select('id, title, author_id')
        .eq('id', waveId)
        .single()

      if (fetchError) throw fetchError
      wave = data

    } catch (err) {
      console.error('خطا در بارگذاری موج:', err)
      error = 'موج مورد نظر یافت نشد'
    } finally {
      loading = false
    }
  }

  onMount(() => {
    loadWave()
  })
</script>

<div class="room-page">
  <div class="header">
    <button class="back-btn" onclick={() => history.back()}>← بازگشت</button>
    <h1>🎧 اتاق موج</h1>
  </div>

  {#if loading}
    <div class="loading">⏳ در حال بارگذاری...</div>
  {:else if error}
    <div class="error">{error}</div>
  {:else if wave}
    <WaveRoom 
      waveId={wave.id}
      waveTitle={wave.title}
      authorId={wave.author_id}
    />
  {/if}
</div>

<style>
  .room-page {
    max-width: 600px;
    margin: 0 auto;
    padding: 16px;
  }

  .header {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 16px;
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

  .loading, .error {
    text-align: center;
    padding: 60px 20px;
    color: #65676b;
  }

  .error {
    color: #dc3545;
  }
</style>