<script lang="ts">
  import { onMount } from 'svelte'
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'
  import { supabase } from '$lib/client/supabase'
  import { user } from '$lib/stores/user'
  import { trackEvent } from '$lib/services/analytics-service'
  
  // Icon imports
  import {
    Mic,
    User,
    Clock,
    Heart,
    MessageCircle,
    Share2,
    Play,
    Pause,
    Volume2,
    VolumeX,
    X,
    Eye,
    Send
  } from 'lucide-svelte'

  let currentUser = $state<any>(null)
  let wave = $state<any>(null)
  let loading = $state(true)
  let error = $state<string | null>(null)
  let isPlaying = $state(false)
  let isLiked = $state(false)
  let likesCount = $state(0)
  let isMuted = $state(false)
  let progress = $state(0)
  let audioElement = $state<HTMLAudioElement | null>(null)
  let isLiking = $state(false)
  let showComments = $state(false)
  let comments = $state<any[]>([])
  let commentText = $state('')
  let isCommenting = $state(false)

  // Subscribe to user
  $effect(() => {
    const unsubscribe = user.subscribe(value => {
      currentUser = value
    })
    return () => unsubscribe()
  })

  onMount(async () => {
    const storyId = $page.params.id
    
    try {
      // Fetch wave data
      const { data: waveData, error: waveError } = await supabase
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
        .eq('id', storyId)
        .single()

      if (waveError || !waveData) {
        error = 'موج مورد نظر یافت نشد'
        loading = false
        return
      }

      wave = waveData
      likesCount = wave.likes_count || 0

      // Check if user liked this wave
      if (currentUser) {
        const { data: likeData } = await supabase
          .from('likes')
          .select('id')
          .eq('wave_id', wave.id)
          .eq('user_id', currentUser.id)
          .maybeSingle()
        
        isLiked = !!likeData
      }

      // Load comments
      await loadComments()

      // Track view
      await trackEvent({
        event_type: 'wave_view',
        event_data: { 
          wave_id: wave.id,
          duration_category: wave.duration_category
        }
      })

      // Initialize audio
      if (wave.audio_url) {
        const audio = new Audio(wave.audio_url)
        audio.preload = 'metadata'
        audioElement = audio

        audio.addEventListener('timeupdate', () => {
          if (audio.duration) {
            progress = (audio.currentTime / audio.duration) * 100
          }
        })

        audio.addEventListener('ended', () => {
          isPlaying = false
          progress = 0
        })
      }

    } catch (err) {
      console.error('Error loading story:', err)
      error = 'خطا در بارگذاری موج'
    } finally {
      loading = false
    }
  })

  async function loadComments() {
    if (!wave) return
    
    const { data } = await supabase
      .from('comments')
      .select(`
        *,
        user:users(
          id,
          name,
          username,
          avatar
        )
      `)
      .eq('wave_id', wave.id)
      .order('created_at', { ascending: false })
    
    comments = data || []
  }

  function togglePlay() {
    if (!audioElement) return

    if (isPlaying) {
      audioElement.pause()
    } else {
      audioElement.play().catch(() => {
        // Auto-play blocked, user needs to click
      })
    }
    isPlaying = !isPlaying
  }

  function toggleMute() {
    if (!audioElement) return
    audioElement.muted = !isMuted
    isMuted = !isMuted
  }

  async function toggleLike() {
    if (!currentUser) {
      goto('/auth/login')
      return
    }

    if (isLiking) return
    isLiking = true

    try {
      // Toggle like using the wave service
      const { data: existingLike } = await supabase
        .from('likes')
        .select('id')
        .eq('wave_id', wave.id)
        .eq('user_id', currentUser.id)
        .maybeSingle()

      if (existingLike) {
        // Unlike
        await supabase
          .from('likes')
          .delete()
          .eq('id', existingLike.id)
        
        await supabase
          .from('waves')
          .update({ likes_count: (wave.likes_count || 1) - 1 })
          .eq('id', wave.id)
        
        isLiked = false
        likesCount = likesCount - 1
        wave.likes_count = (wave.likes_count || 1) - 1
      } else {
        // Like
        await supabase
          .from('likes')
          .insert({
            wave_id: wave.id,
            user_id: currentUser.id
          })
        
        await supabase
          .from('waves')
          .update({ likes_count: (wave.likes_count || 0) + 1 })
          .eq('id', wave.id)
        
        isLiked = true
        likesCount = likesCount + 1
        wave.likes_count = (wave.likes_count || 0) + 1
      }
    } catch (err) {
      console.error('Error toggling like:', err)
    } finally {
      isLiking = false
    }
  }

  async function submitComment() {
    if (!currentUser) {
      goto('/auth/login')
      return
    }

    if (!commentText.trim() || isCommenting) return
    isCommenting = true

    try {
      const { data, error: commentError } = await supabase
        .from('comments')
        .insert({
          wave_id: wave.id,
          user_id: currentUser.id,
          content: commentText.trim()
        })
        .select()
        .single()

      if (commentError) throw commentError

      // Add comment with user data
      comments = [{
        ...data,
        user: {
          id: currentUser.id,
          name: currentUser.name,
          username: currentUser.username,
          avatar: currentUser.avatar
        }
      }, ...comments]

      commentText = ''
      
      await trackEvent({
        event_type: 'wave_comment',
        event_data: { wave_id: wave.id }
      })

    } catch (err) {
      console.error('Error posting comment:', err)
      alert('خطا در ارسال نظر')
    } finally {
      isCommenting = false
    }
  }

  function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${String(secs).padStart(2, '0')}`
  }

  function goToProfile(username: string) {
    goto(`/profile/${username}`)
  }

  function goBack() {
    if (window.history.length > 1) {
      history.back()
    } else {
      goto('/')
    }
  }

  // Cleanup audio on unmount
  $effect(() => {
    return () => {
      if (audioElement) {
        audioElement.pause()
        audioElement.src = ''
      }
    }
  })
</script>

<svelte:head>
  <title>{wave?.title || 'موج کوتاه'} | موج</title>
</svelte:head>

<div class="story-viewer">
  {#if loading}
    <div class="loading">
      <div class="spinner"></div>
      <p>در حال بارگذاری...</p>
    </div>
  {:else if error}
    <div class="error-container">
      <div class="error-icon">
        <X size={48} />
      </div>
      <h3>{error}</h3>
      <button class="back-btn" onclick={goBack}>بازگشت</button>
    </div>
  {:else if wave}
    <!-- Background with blur -->
    <div class="story-background">
      {#if wave.cover_image}
        <img src={wave.cover_image} alt="" class="bg-image" />
      {:else}
        <div class="bg-gradient"></div>
      {/if}
      <div class="bg-overlay"></div>
    </div>

    <!-- Content -->
    <div class="story-content">
      <!-- Header -->
      <div class="story-header">
        <button class="close-btn" onclick={goBack}>
          <X size={24} />
        </button>
        <button class="share-btn" onclick={() => {
          if (navigator.share) {
            navigator.share({ url: window.location.href })
          }
        }}>
          <Share2 size={20} />
        </button>
      </div>

      <!-- Main Content -->
      <div class="story-main">
        <!-- Author Info -->
        <div class="author-section" onclick={() => goToProfile(wave.author?.username)}>
          <div class="author-avatar">
            {#if wave.author?.avatar}
              <img src={wave.author.avatar} alt={wave.author.name} />
            {:else}
              <User size={24} />
            {/if}
          </div>
          <div class="author-info">
            <span class="author-name">{wave.author?.name || 'ناشناس'}</span>
            <span class="author-username">@{wave.author?.username}</span>
          </div>
          <div class="author-badge">
            {#if wave.duration_category === 'SHORT'}
              <span class="badge short">کوتاه</span>
            {:else if wave.duration_category === 'LONG'}
              <span class="badge long">بلند</span>
            {:else}
              <span class="badge medium">متوسط</span>
            {/if}
          </div>
        </div>

        <!-- Wave Content -->
        <div class="wave-content">
          <h2 class="wave-title">{wave.title}</h2>
          
          {#if wave.description}
            <p class="wave-description">{wave.description}</p>
          {/if}

          <!-- Audio Player -->
          <div class="audio-player">
            <div class="player-controls">
              <button class="play-btn" onclick={togglePlay}>
                {#if isPlaying}
                  <Pause size={32} />
                {:else}
                  <Play size={32} />
                {/if}
              </button>
              <div class="player-info">
                <div class="progress-bar" onclick={(e) => {
                  if (!audioElement) return
                  const rect = e.currentTarget.getBoundingClientRect()
                  const x = (e.clientX - rect.left) / rect.width
                  audioElement.currentTime = x * audioElement.duration
                }}>
                  <div class="progress-fill" style="width: {progress}%"></div>
                </div>
                <div class="time-display">
                  <span>{formatDuration(audioElement?.currentTime || 0)}</span>
                  <span>/</span>
                  <span>{formatDuration(wave.duration || 0)}</span>
                </div>
              </div>
              <button class="mute-btn" onclick={toggleMute}>
                {#if isMuted}
                  <VolumeX size={20} />
                {:else}
                  <Volume2 size={20} />
                {/if}
              </button>
            </div>
          </div>

          <!-- Actions -->
          <div class="action-bar">
            <button class="action-btn like-btn {isLiked ? 'liked' : ''}" onclick={toggleLike}>
              <Heart size={22} fill={isLiked ? '#ef4444' : 'none'} />
              <span class="action-count">{likesCount}</span>
            </button>
            <button class="action-btn comment-btn" onclick={() => showComments = !showComments}>
              <MessageCircle size={22} />
              <span class="action-count">{comments.length}</span>
            </button>
            <button class="action-btn view-btn">
              <Eye size={22} />
              <span class="action-count">{wave.views_count || 0}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Comments Section -->
      <div class="comments-section {showComments ? 'open' : ''}">
        <div class="comments-header">
          <h3>
            <MessageCircle size={18} />
            نظرات ({comments.length})
          </h3>
          <button class="close-comments" onclick={() => showComments = false}>
            <X size={18} />
          </button>
        </div>

        <!-- Comment Input -->
        {#if currentUser}
          <div class="comment-input">
            <div class="comment-avatar-small">
              {#if currentUser.avatar}
                <img src={currentUser.avatar} alt={currentUser.name} />
              {:else}
                <User size={16} />
              {/if}
            </div>
            <input
              type="text"
              placeholder="نظر خود را بنویسید..."
              bind:value={commentText}
              onkeydown={(e) => {
                if (e.key === 'Enter') submitComment()
              }}
            />
            <button class="send-btn" onclick={submitComment} disabled={!commentText.trim() || isCommenting}>
              <Send size={18} />
            </button>
          </div>
        {:else}
          <div class="login-prompt" onclick={() => goto('/auth/login')}>
            <span>برای نوشتن نظر وارد شوید</span>
          </div>
        {/if}

        <!-- Comments List -->
        <div class="comments-list">
          {#if comments.length === 0}
            <div class="no-comments">
              <MessageCircle size={32} />
              <p>هنوز نظری وجود ندارد</p>
              <span>اولین نفری باشید که نظر می‌دهد</span>
            </div>
          {:else}
            {#each comments as comment (comment.id)}
              <div class="comment-item">
                <div class="comment-avatar" onclick={() => goToProfile(comment.user?.username)}>
                  {#if comment.user?.avatar}
                    <img src={comment.user.avatar} alt={comment.user.name} />
                  {:else}
                    <User size={16} />
                  {/if}
                </div>
                <div class="comment-body">
                  <div class="comment-user" onclick={() => goToProfile(comment.user?.username)}>
                    <span class="comment-name">{comment.user?.name || 'ناشناس'}</span>
                    <span class="comment-username">@{comment.user?.username}</span>
                  </div>
                  <p class="comment-text">{comment.content}</p>
                  <span class="comment-time">
                    {new Date(comment.created_at).toLocaleString('fa-IR')}
                  </span>
                </div>
              </div>
            {/each}
          {/if}
        </div>
      </div>

      <!-- Bottom progress indicator -->
      <div class="story-progress">
        <div class="progress-track">
          <div class="progress-fill" style="width: {progress}%"></div>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .story-viewer {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #0a0a0f;
    font-family: inherit;
  }

  /* Background */
  .story-background {
    position: absolute;
    inset: 0;
    overflow: hidden;
  }

  .bg-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
    filter: blur(60px) brightness(0.4);
    transform: scale(1.2);
  }

  .bg-gradient {
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, #1a1a2e 0%, #0a0a0f 100%);
  }

  .bg-overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      180deg,
      rgba(0, 0, 0, 0.3) 0%,
      rgba(0, 0, 0, 0.6) 50%,
      rgba(0, 0, 0, 0.8) 100%
    );
  }

  /* Content */
  .story-content {
    position: relative;
    z-index: 10;
    width: 100%;
    max-width: 480px;
    height: 100vh;
    max-height: 900px;
    display: flex;
    flex-direction: column;
    padding: 20px;
    color: white;
  }

  /* Header */
  .story-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0 20px;
    flex-shrink: 0;
  }

  .close-btn {
    background: rgba(255, 255, 255, 0.1);
    border: none;
    color: white;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    backdrop-filter: blur(12px);
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.2);
    transform: scale(1.05);
  }

  .share-btn {
    background: rgba(255, 255, 255, 0.1);
    border: none;
    color: white;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    backdrop-filter: blur(12px);
  }

  .share-btn:hover {
    background: rgba(255, 255, 255, 0.2);
    transform: scale(1.05);
  }

  /* Main Content */
  .story-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 20px;
    min-height: 0;
  }

  /* Author */
  .author-section {
    display: flex;
    align-items: center;
    gap: 12px;
    cursor: pointer;
    padding: 8px 12px;
    border-radius: 12px;
    transition: all 0.2s ease;
    background: rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(8px);
    flex-shrink: 0;
  }

  .author-section:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .author-avatar {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    overflow: hidden;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .author-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .author-avatar :global(svg) {
    color: white;
  }

  .author-info {
    flex: 1;
    min-width: 0;
  }

  .author-name {
    display: block;
    font-size: 15px;
    font-weight: 600;
  }

  .author-username {
    display: block;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.6);
  }

  .author-badge {
    flex-shrink: 0;
  }

  .badge {
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .badge.short {
    background: #10b981;
    color: white;
  }

  .badge.medium {
    background: #f59e0b;
    color: white;
  }

  .badge.long {
    background: #6366f1;
    color: white;
  }

  /* Wave Content */
  .wave-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 16px;
  }

  .wave-title {
    font-size: 28px;
    font-weight: 700;
    margin: 0;
    text-shadow: 0 2px 20px rgba(0, 0, 0, 0.3);
    line-height: 1.3;
  }

  .wave-description {
    font-size: 16px;
    color: rgba(255, 255, 255, 0.8);
    margin: 0;
    line-height: 1.6;
    text-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
  }

  /* Audio Player */
  .audio-player {
    background: rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(16px);
    border-radius: 16px;
    padding: 20px;
    margin-top: 8px;
    border: 1px solid rgba(255, 255, 255, 0.05);
  }

  .player-controls {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .play-btn {
    background: white;
    border: none;
    color: #1a1a2e;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    flex-shrink: 0;
  }

  .play-btn:hover {
    transform: scale(1.05);
    box-shadow: 0 4px 20px rgba(255, 255, 255, 0.2);
  }

  .play-btn:active {
    transform: scale(0.95);
  }

  .player-info {
    flex: 1;
    min-width: 0;
  }

  .progress-bar {
    width: 100%;
    height: 4px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 2px;
    cursor: pointer;
    position: relative;
    transition: height 0.2s ease;
  }

  .progress-bar:hover {
    height: 6px;
  }

  .progress-fill {
    height: 100%;
    background: white;
    border-radius: 2px;
    transition: width 0.1s linear;
    position: relative;
  }

  .progress-fill::after {
    content: '';
    position: absolute;
    right: -4px;
    top: -4px;
    width: 12px;
    height: 12px;
    background: white;
    border-radius: 50%;
    opacity: 0;
    transition: opacity 0.2s ease;
  }

  .progress-bar:hover .progress-fill::after {
    opacity: 1;
  }

  .time-display {
    display: flex;
    justify-content: space-between;
    margin-top: 6px;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.6);
    font-variant-numeric: tabular-nums;
  }

  .mute-btn {
    background: rgba(255, 255, 255, 0.1);
    border: none;
    color: white;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    flex-shrink: 0;
  }

  .mute-btn:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  /* Action Bar */
  .action-bar {
    display: flex;
    gap: 24px;
    justify-content: center;
    padding: 8px 0;
  }

  .action-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.8);
    cursor: pointer;
    padding: 8px 16px;
    border-radius: 12px;
    transition: all 0.2s ease;
    font-family: inherit;
    font-size: 14px;
  }

  .action-btn:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .action-btn :global(svg) {
    transition: all 0.2s ease;
  }

  .action-count {
    font-weight: 600;
  }

  .like-btn.liked {
    color: #ef4444;
  }

  .like-btn.liked :global(svg) {
    color: #ef4444;
  }

  /* Comments Section */
  .comments-section {
    position: fixed;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%) translateY(100%);
    width: 100%;
    max-width: 480px;
    max-height: 60vh;
    background: rgba(20, 20, 30, 0.95);
    backdrop-filter: blur(20px);
    border-radius: 20px 20px 0 0;
    padding: 20px;
    transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    display: flex;
    flex-direction: column;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
  }

  .comments-section.open {
    transform: translateX(-50%) translateY(0);
  }

  .comments-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    flex-shrink: 0;
  }

  .comments-header h3 {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: 16px;
    font-weight: 600;
  }

  .close-comments {
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.6);
    cursor: pointer;
    padding: 4px;
    border-radius: 50%;
    transition: all 0.2s ease;
  }

  .close-comments:hover {
    background: rgba(255, 255, 255, 0.1);
    color: white;
  }

  .comment-input {
    display: flex;
    align-items: center;
    gap: 10px;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 12px;
    padding: 4px 4px 4px 12px;
    flex-shrink: 0;
    margin-bottom: 12px;
  }

  .comment-avatar-small {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    overflow: hidden;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .comment-avatar-small img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .comment-avatar-small :global(svg) {
    color: white;
  }

  .comment-input input {
    flex: 1;
    background: none;
    border: none;
    color: white;
    padding: 10px 0;
    font-size: 14px;
    outline: none;
    font-family: inherit;
  }

  .comment-input input::placeholder {
    color: rgba(255, 255, 255, 0.4);
  }

  .send-btn {
    background: #6366f1;
    border: none;
    color: white;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    flex-shrink: 0;
  }

  .send-btn:hover:not(:disabled) {
    transform: scale(1.05);
    background: #4f46e5;
  }

  .send-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .login-prompt {
    text-align: center;
    padding: 12px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 10px;
    cursor: pointer;
    color: rgba(255, 255, 255, 0.6);
    transition: all 0.2s ease;
    margin-bottom: 12px;
    flex-shrink: 0;
  }

  .login-prompt:hover {
    background: rgba(255, 255, 255, 0.1);
    color: white;
  }

  .comments-list {
    flex: 1;
    overflow-y: auto;
    padding-right: 4px;
  }

  .comments-list::-webkit-scrollbar {
    width: 4px;
  }

  .comments-list::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 2px;
  }

  .comments-list::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 2px;
  }

  .no-comments {
    text-align: center;
    padding: 40px 20px;
    color: rgba(255, 255, 255, 0.4);
  }

  .no-comments :global(svg) {
    color: rgba(255, 255, 255, 0.15);
    margin-bottom: 12px;
  }

  .no-comments p {
    margin: 0 0 4px 0;
    font-weight: 500;
  }

  .no-comments span {
    font-size: 13px;
  }

  .comment-item {
    display: flex;
    gap: 10px;
    padding: 10px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }

  .comment-item:last-child {
    border-bottom: none;
  }

  .comment-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    overflow: hidden;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    cursor: pointer;
  }

  .comment-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .comment-avatar :global(svg) {
    color: white;
  }

  .comment-body {
    flex: 1;
    min-width: 0;
  }

  .comment-user {
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }

  .comment-name {
    font-weight: 600;
    font-size: 13px;
  }

  .comment-username {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.4);
  }

  .comment-text {
    margin: 4px 0;
    font-size: 14px;
    line-height: 1.5;
    word-wrap: break-word;
  }

  .comment-time {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.3);
  }

  /* Progress */
  .story-progress {
    padding: 20px 0 0;
    flex-shrink: 0;
  }

  .progress-track {
    width: 100%;
    height: 3px;
    background: rgba(255, 255, 255, 0.15);
    border-radius: 2px;
    overflow: hidden;
  }

  .story-progress .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #6366f1, #8b5cf6);
    border-radius: 2px;
    transition: width 0.1s linear;
  }

  /* Loading & Error */
  .loading {
    text-align: center;
    color: white;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 4px solid rgba(255, 255, 255, 0.1);
    border-top-color: #6366f1;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin: 0 auto 16px;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .error-container {
    text-align: center;
    color: white;
  }

  .error-icon :global(svg) {
    color: #ef4444;
    margin-bottom: 16px;
  }

  .error-container h3 {
    margin: 0 0 20px 0;
  }

  .error-container .back-btn {
    background: #6366f1;
    border: none;
    color: white;
    padding: 10px 32px;
    border-radius: 10px;
    font-size: 16px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .error-container .back-btn:hover {
    background: #4f46e5;
    transform: scale(1.02);
  }

  /* Responsive */
  @media (max-width: 640px) {
    .story-content {
      padding: 16px;
      max-height: 100vh;
    }

    .wave-title {
      font-size: 24px;
    }

    .play-btn {
      width: 48px;
      height: 48px;
    }

    .play-btn :global(svg) {
      width: 24px;
      height: 24px;
    }

    .action-bar {
      gap: 12px;
    }

    .action-btn {
      padding: 6px 12px;
      font-size: 13px;
    }

    .comments-section {
      max-height: 70vh;
      padding: 16px;
    }
  }

  @media (max-width: 400px) {
    .wave-title {
      font-size: 20px;
    }

    .author-section {
      padding: 6px 10px;
    }

    .author-avatar {
      width: 36px;
      height: 36px;
    }

    .audio-player {
      padding: 14px;
    }

    .action-bar {
      gap: 8px;
    }

    .action-btn {
      padding: 4px 10px;
      font-size: 12px;
    }

    .action-btn :global(svg) {
      width: 18px;
      height: 18px;
    }
  }
</style>