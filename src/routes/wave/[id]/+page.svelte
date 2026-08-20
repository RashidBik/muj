<script lang="ts">
  import { onMount } from 'svelte'
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'
  import { supabase } from '$lib/client/supabase'
  import { user } from '$lib/stores/user'
  import CommentList from '$lib/components/comments/CommentList.svelte'
  import AudioPlayer from '$lib/components/waves/AudioPlayer.svelte'
  import Avatar from '$lib/components/ui/Avatar.svelte'
  import { formatDuration, getDurationLabel, getDurationColor, formatViewCount } from '$lib/utils/wave-helpers'
  import { trackEvent } from '$lib/services/analytics-service'
  import { getWaveById } from '$lib/services/wave-service'

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
      
      // ✅ Use getWaveById which increments views
      const waveData = await getWaveById(waveId, currentUser?.id)
      
      if (!waveData) {
        throw new Error('موج یافت نشد')
      }
      
      wave = waveData

      // ✅ Track view event
      await trackEvent({
        event_type: 'wave_view',
        event_data: { 
          wave_id: wave.id,
          author_id: wave.author_id
        }
      })

    } catch (err) {
      console.error('خطا در بارگذاری موج:', err)
      error = 'موج مورد نظر یافت نشد'
    } finally {
      loading = false
    }
  }

  // بارگذاری اولیه
  onMount(() => {
    loadWave()
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

        <!-- ✅ Display hashtags if present -->
        {#if wave.hashtags}
          <div class="wave-hashtags">
            {#each wave.hashtags.split(' ') as tag}
              {#if tag.trim()}
                <span class="hashtag" onclick={() => goto(`/search?q=%23${tag}`)}>
                  #{tag}
                </span>
              {/if}
            {/each}
          </div>
        {/if}

        <div class="wave-stats">
          <span>❤️ {wave.likes_count || 0}</span>
          <span>💬 {wave.comments_count || 0}</span>
          <span>🔄 {wave.saves_count || 0}</span>
          <span>👁️ {formatViewCount(wave.views_count || 0)}</span>
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
    max-width: 800px;
    margin: 0 auto;
    padding: 20px;
    background: #f5f7fa;
    min-height: 100vh;
  }

  .header {
    margin-bottom: 20px;
  }

  .back-btn {
    background: white;
    border: none;
    padding: 10px 18px;
    border-radius: 10px;
    font-size: 15px;
    font-weight: 500;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0,0,0,0.06);
    transition: all 0.2s ease;
    color: #1a1a2e;
  }

  .back-btn:hover {
    background: #f0f0ff;
    transform: translateX(-4px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  }

  .loading, .error {
    text-align: center;
    padding: 60px 20px;
    background: white;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  }

  .error {
    color: #ef4444;
  }

  .wave-card {
    background: white;
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 4px 20px rgba(0,0,0,0.08);
    margin-bottom: 20px;
  }

  .wave-cover {
    width: 100%;
    height: 280px;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  .wave-cover img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .cover-placeholder {
    font-size: 80px;
    color: rgba(255,255,255,0.3);
  }

  .wave-info {
    padding: 24px;
  }

  .wave-title {
    font-size: 28px;
    font-weight: 700;
    margin: 0 0 16px 0;
    color: #1a1a2e;
  }

  .wave-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    flex-wrap: wrap;
    gap: 12px;
  }

  .wave-author {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .author-name {
    font-weight: 600;
    color: #1a1a2e;
  }

  .author-username {
    font-size: 13px;
    color: #94a3b8;
  }

  .duration-badge {
    padding: 4px 14px;
    border-radius: 20px;
    color: white;
    font-size: 13px;
    font-weight: 600;
  }

  .wave-hashtags {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 12px 0;
  }

  .hashtag {
    padding: 4px 12px;
    background: #f0f0ff;
    color: #6366f1;
    border-radius: 16px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .hashtag:hover {
    background: #6366f1;
    color: white;
    transform: scale(1.05);
  }

  .wave-stats {
    display: flex;
    gap: 20px;
    padding: 12px 0;
    border-top: 1px solid #f1f5f9;
    border-bottom: 1px solid #f1f5f9;
    margin: 12px 0 16px 0;
    color: #64748b;
    font-size: 14px;
  }

  .wave-stats span {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  @media (max-width: 640px) {
    .wave-detail {
      padding: 12px;
    }

    .wave-title {
      font-size: 22px;
    }

    .wave-cover {
      height: 200px;
    }

    .wave-stats {
      flex-wrap: wrap;
      gap: 12px;
    }
  }
</style>