<script lang="ts">
  import { onMount } from 'svelte'
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'
  import { supabase } from '$lib/client/supabase'
  import { user } from '$lib/stores/user'
  import CommentList from '$lib/components/comments/CommentList.svelte'
  import AudioPlayer from '$lib/components/waves/AudioPlayer.svelte'
  import Avatar from '$lib/components/ui/Avatar.svelte'
  import { formatDuration, getDurationLabel, getDurationColor } from '$lib/utils/wave-helpers'
import { trackEvent } from '$lib/services/analytics-service'


  let wave = $state<any>(null)
  let loading = $state(true)
  let currentUser = $state<any>(null)
  let error = $state<string | null>(null)

  // اشتراک‌گذاری در store
  $effect(() => {
    const unsubscribe = user.subscribe(value => {
      currentUser = value
    })
    return () => unsubscribe()
  })

  // رفتن به پروفایل نویسنده
  function goToProfile() {
    if (wave?.author?.username) {
      goto(`/profile/${wave.author.username}`)
    }
  }

  // بارگذاری موج
  async function loadWave() {
    loading = true
    error = null

    try {
      const waveId = $page.params.id
      
      const { data, error: fetchError } = await supabase
        .from('waves')
        .select(`
          *,
          author:users(
            id,
            name,
            username,
            avatar,
            bio
          )
        `)
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

  // بارگذاری اولیه
  onMount(async() => {
    loadWave()

     await trackEvent({
    event_type: 'wave_view',
    event_data: { wave_id: wave.id }
  })
  })
</script>

<div class="wave-detail">
  {#if loading}
    <div class="loading">⏳ در حال بارگذاری...</div>
  {:else if error}
    <div class="error">{error}</div>
  {:else if wave}
    <!-- هدر -->
    <div class="header">
      <button class="back-btn" onclick={() => history.back()}>← بازگشت</button>
    </div>

    <!-- اطلاعات موج -->
    <div class="wave-card">
      <!-- کاور -->
      <div class="wave-cover">
        {#if wave.cover_image}
          <img src={wave.cover_image} alt={wave.title} />
        {:else}
          <div class="cover-placeholder">🎵</div>
        {/if}
      </div>

      <div class="wave-info">
        <h1 class="wave-title">{wave.title}</h1>
        
        <div class="wave-meta">
          <!-- ✅ بخش نویسنده با لینک به پروفایل -->
          <div class="wave-author" onclick={goToProfile} style="cursor: pointer;">
            <Avatar src={wave.author?.avatar} size="md" />
            <div>
              <div class="author-name">{wave.author?.name || 'ناشناس'}</div>
              <div class="author-username">@{wave.author?.username}</div>
            </div>
          </div>
          <span 
            class="duration-badge"
            style="background: {getDurationColor(wave.duration_category)}"
          >
            {formatDuration(wave.duration)}
          </span>
        </div>

        <div class="wave-stats">
          <span>❤️ {wave.likes_count || 0}</span>
          <span>💬 {wave.comments_count || 0}</span>
          <span>🔄 {wave.saves_count || 0}</span>
        </div>

        <!-- پلیر صوتی -->
        <AudioPlayer
          audioUrl={wave.audio_url}
          waveId={wave.id}
          title={wave.title}
          coverImage={wave.cover_image}
          authorName={wave.author?.name || 'ناشناس'}
          authorUsername={wave.author?.username}
          autoPlay={false}
        />
      </div>
    </div>

    <!-- نظرات -->
    <CommentList 
      waveId={wave.id} 
      currentUserId={currentUser?.id}
      onCommentAdded={loadWave}
    />
  {/if}
</div>

<style>
  .wave-detail {
    max-width: 600px;
    margin: 0 auto;
    padding: 16px;
  }

  .header {
    margin-bottom: 16px;
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

  .wave-card {
    background: white;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    margin-bottom: 16px;
  }

  .wave-cover {
    position: relative;
    width: 100%;
    padding-top: 56.25%;
    background: #f0f2f5;
    overflow: hidden;
  }

  .wave-cover img {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .cover-placeholder {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 48px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  }

  .wave-info {
    padding: 16px;
  }

  .wave-title {
    margin: 0 0 12px 0;
    font-size: 22px;
    color: #050505;
  }

  .wave-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  .wave-author {
    display: flex;
    align-items: center;
    gap: 12px;
    transition: opacity 0.2s;
  }

  .wave-author:hover {
    opacity: 0.8;
  }

  .author-name {
    font-weight: 600;
    color: #050505;
  }

  .author-username {
    font-size: 13px;
    color: #65676b;
  }

  .duration-badge {
    padding: 4px 12px;
    border-radius: 12px;
    color: white;
    font-size: 14px;
    font-weight: 600;
  }

  .wave-stats {
    display: flex;
    gap: 16px;
    padding: 12px 0;
    border-top: 1px solid #e4e6eb;
    border-bottom: 1px solid #e4e6eb;
    margin-bottom: 12px;
    color: #65676b;
    font-size: 14px;
  }
</style>