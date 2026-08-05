<script lang="ts">
  import { goto } from '$app/navigation'
  import { onMount } from 'svelte'
  import { supabase } from '$lib/client/supabase'
  import { user } from '$lib/stores/user'
  import Avatar from '$lib/components/ui/Avatar.svelte'
  import { formatDuration, getDurationLabel, getDurationColor } from '$lib/utils/wave-helpers'
  import { boostWave, getTokenBalance } from '$lib/services/token-service'
  import type { WaveWithLike } from '$lib/services/wave-service'
  import AudioPlayer from './AudioPlayer.svelte'
  import { toggleReaction, getWaveReactions, getUserReaction } from '$lib/services/wave-service'
  import ReactionPicker from '$lib/components/ui/ReactionPicker.svelte'
  import { followUser, unfollowUser } from '$lib/services/profile-service'

  // Icon imports
  import {
    Heart,
    MessageCircle,
    Share2,
    Users,
    Clock,
    Flame,
    Rocket,
    UserPlus,
    UserCheck,
    Eye,
    Smile,
    Frown,
    AlertCircle,
    X,
    Send,
    ChevronLeft,
    Download
  } from 'lucide-svelte'

  let { 
    wave,
    currentUserId,
    onLike,
    showDelete = false 
  }: {
    wave: WaveWithLike
    currentUserId: string | null
    onLike: (waveId: string) => void
  } = $props()

  let isLiking = $state(false)
  let isBoosting = $state(false)
  let showBoostModal = $state(false)
  let userBalance = $state(0)
  let boostMessage = $state('')
  let boostSuccess = $state(false)
  let isPlaying = $state(false)
  let isFollowing = $state(false)
  let isTogglingFollow = $state(false)

  let waveReactions = $derived(wave.reactions || [])
  let userReaction = $derived(wave.userReaction || null)

  // Comment state
  let showCommentInput = $state(false)
  let commentText = $state('')
  let isSubmitting = $state(false)
  let currentUser = $state<any>(null)

  // Comments modal state
  let showCommentsModal = $state(false)
  let allComments = $state<any[]>([])
  let loadingAllComments = $state(false)

  // Real comments from database
  let comments = $state<any[]>([])
  let loadingComments = $state(false)

  // Check if wave is boosted
  const isBoosted = wave.is_boosted && 
    wave.boost_expires_at && 
    new Date(wave.boost_expires_at) > new Date()

  // Subscribe to user
  $effect(() => {
    const unsubscribe = user.subscribe(value => {
      currentUser = value
    })
    return () => unsubscribe()
  })

  async function loadFollowStatus() {
    if (!currentUserId || !wave.author_id) return
    
    try {
      const { data } = await supabase
        .from('follows')
        .select('*')
        .eq('follower_id', currentUserId)
        .eq('following_id', wave.author_id)
        .maybeSingle()
      
      isFollowing = !!data
    } catch (err) {
      console.error('Error loading follow status:', err)
    }
  }

  async function toggleFollow() {
    if (!currentUser) {
      goto('/auth/login')
      return
    }

    if (isTogglingFollow) return
    isTogglingFollow = true

    try {
      if (isFollowing) {
        const result = await unfollowUser(currentUser.id, wave.author_id)
        if (result) {
          isFollowing = false
        }
      } else {
        const result = await followUser(currentUser.id, wave.author_id)
        if (result) {
          isFollowing = true
        }
      }
    } catch (error) {
      console.error('Error toggling follow:', error)
      alert('خطا در عملیات. لطفاً دوباره تلاش کنید.')
    } finally {
      isTogglingFollow = false
    }
  }

  // ✅ دانلود فایل صوتی
  async function downloadAudio() {
    if (!wave.audio_url) {
      alert('فایل صوتی موجود نیست')
      return
    }

    try {
      // دریافت فایل از URL
      const response = await fetch(wave.audio_url)
      const blob = await response.blob()
      
      // ایجاد لینک دانلود
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${wave.title || 'wave'}.mp3`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error downloading audio:', error)
      alert('خطا در دانلود فایل. لطفاً دوباره تلاش کنید.')
    }
  }

  // Load user balance
  onMount(async () => {
    if (currentUserId) {
      userBalance = await getTokenBalance(currentUserId)
    }
    await loadComments()
    await loadFollowStatus()
  })

  // Load real comments from database
  async function loadComments() {
    if (!wave.id) return
    loadingComments = true
    
    try {
      const { data, error } = await supabase
        .from('comments')
        .select(`
          content,
          user:users(
            id,
            name,
            username,
            avatar
          )
        `)
        .eq('wave_id', wave.id)
        .order('created_at', { ascending: false })
        .limit(10)

      if (error) throw error

      comments = data && data.length > 0 
        ? data.map(comment => ({
            text: comment.content,
            direction: /^[a-zA-Z0-9\s.,!?@#$%^&*()_+=\-`~]+$/.test(comment.content) ? 'rtl' : 'ltr',
            user: comment.user
          }))
        : []

    } catch (err) {
      console.error('Error loading comments:', err)
      comments = []
    } finally {
      loadingComments = false
    }
  }

  async function handleReaction(emoji: string) {
    if (!currentUser) {
      goto('/auth/login')
      return
    }

    if (isLiking) return
    isLiking = true

    try {
      const result = await toggleReaction(wave.id, currentUser.id, emoji)
      
      if (result.success) {
        if (result.action === 'removed') {
          wave.userReaction = null
          const idx = wave.reactions.findIndex(r => r.emoji === emoji)
          if (idx !== -1) {
            wave.reactions[idx].count--
            if (wave.reactions[idx].count <= 0) {
              wave.reactions.splice(idx, 1)
            }
          }
        } else if (result.action === 'added') {
          wave.userReaction = emoji
          const existing = wave.reactions.find(r => r.emoji === emoji)
          if (existing) {
            existing.count++
          } else {
            wave.reactions.push({ emoji, count: 1 })
          }
        } else if (result.action === 'changed') {
          const oldEmoji = wave.userReaction
          wave.userReaction = emoji
          
          if (oldEmoji) {
            const oldIdx = wave.reactions.findIndex(r => r.emoji === oldEmoji)
            if (oldIdx !== -1) {
              wave.reactions[oldIdx].count--
              if (wave.reactions[oldIdx].count <= 0) {
                wave.reactions.splice(oldIdx, 1)
              }
            }
          }
          
          const newIdx = wave.reactions.findIndex(r => r.emoji === emoji)
          if (newIdx !== -1) {
            wave.reactions[newIdx].count++
          } else {
            wave.reactions.push({ emoji, count: 1 })
          }
        }
        
        wave = { ...wave }
      }
    } catch (err) {
      console.error('Error reacting:', err)
      alert('خطا در ثبت ریکشن. لطفاً دوباره تلاش کنید.')
    } finally {
      isLiking = false
    }
  }

  // Load all comments for modal
  async function loadAllComments() {
    if (!wave.id) return
    loadingAllComments = true
    
    try {
      const { data, error } = await supabase
        .from('comments')
        .select(`
          id,
          content,
          created_at,
          user:users(
            id,
            name,
            username,
            avatar
          )
        `)
        .eq('wave_id', wave.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      allComments = data || []
    } catch (err) {
      console.error('Error loading all comments:', err)
      allComments = []
    } finally {
      loadingAllComments = false
    }
  }

  // Open comments modal
  async function openCommentsModal() {
    showCommentsModal = true
    await loadAllComments()
  }

  // Close comments modal
  function closeCommentsModal() {
    showCommentsModal = false
    allComments = []
  }

  // Submit comment
  async function submitComment() {
    if (!currentUser) {
      goto('/auth/login')
      return
    }

    const trimmed = commentText.trim()
    if (!trimmed || isSubmitting) return

    isSubmitting = true

    try {
      const { data, error } = await supabase
        .from('comments')
        .insert({
          content: trimmed,
          wave_id: wave.id,
          author_id: currentUser.id
        })
        .select(`
          *,
          user:users(
            id,
            name,
            username,
            avatar
          )
        `)
        .single()

      if (error) throw error

      const newComment = {
        text: data.content,
        direction: /^[a-zA-Z0-9\s.,!?@#$%^&*()_+=\-`~]+$/.test(data.content) ? 'rtl' : 'ltr',
        user: data.user
      }
      comments = [newComment, ...comments]
      
      if (showCommentsModal) {
        allComments = [data, ...allComments]
      }
      
      commentText = ''
      showCommentInput = false

    } catch (err) {
      console.error('Error posting comment:', err)
      alert('خطا در ارسال نظر. لطفاً دوباره تلاش کنید.')
    } finally {
      isSubmitting = false
    }
  }

  function toggleCommentInput() {
    if (!currentUser) {
      goto('/auth/login')
      return
    }
    showCommentInput = !showCommentInput
    if (!showCommentInput) {
      commentText = ''
    }
  }

  function goToProfile(username?: string) {
    if (username) {
      goto(`/profile/${username}`)
    } else if (wave.author?.username) {
      goto(`/profile/${wave.author.username}`)
    }
  }

  function goToWaveDetail() {
    goto(`/wave/${wave.id}`)
  }

  function emitDelete() {
    const event = new CustomEvent('delete', { detail: { waveId: wave.id } })
    window.dispatchEvent(event)
  }

  function togglePlay() {
    isPlaying = !isPlaying
    if (isPlaying) {
      const event = new CustomEvent('wave-play', { detail: { waveId: wave.id } })
      window.dispatchEvent(event)
    }
  }

  async function handleBoost() {
    if (!currentUserId) {
      goto('/auth/login')
      return
    }

    if (isBoosting) return
    isBoosting = true
    boostMessage = ''
    boostSuccess = false

    try {
      const result = await boostWave(currentUserId, wave.id)
      
      if (result.success) {
        boostSuccess = true
        wave.is_boosted = true
        wave.boost_expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        wave.boost_count = (wave.boost_count || 0) + 1
        userBalance = userBalance - 30
        boostMessage = result.message
        
        setTimeout(() => {
          showBoostModal = false
          boostMessage = ''
        }, 3000)
      } else {
        boostMessage = result.message
      }
    } catch (error) {
      console.error('Error boosting wave:', error)
      boostMessage = 'خطا در تقویت موج. لطفاً دوباره تلاش کنید.'
    } finally {
      isBoosting = false
    }
  }

  function formatNumber(num: number): string {
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K'
    }
    return num.toString()
  }

  function formatTime(date: string): string {
    try {
      const now = new Date()
      const commentDate = new Date(date)
      const diffMs = now.getTime() - commentDate.getTime()
      const diffMins = Math.floor(diffMs / 60000)
      const diffHours = Math.floor(diffMs / 3600000)
      const diffDays = Math.floor(diffMs / 86400000)

      if (diffMins < 1) return 'لحظاتی پیش'
      if (diffMins < 60) return `${diffMins} دقیقه پیش`
      if (diffHours < 24) return `${diffHours} ساعت پیش`
      if (diffDays < 7) return `${diffDays} روز پیش`
      return commentDate.toLocaleDateString('fa-IR')
    } catch {
      return 'چندی پیش'
    }
  }

  // ✅ نمایش زمان باقی‌مانده برای موج با نمایش روز
  function getTimeRemaining(expiresAt: string | null): string {
    if (!expiresAt) return 'نامحدود'
    
    const now = new Date()
    const expire = new Date(expiresAt)
    const diff = expire.getTime() - now.getTime()
    
    if (diff <= 0) return 'منقضی شده'
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    
    if (days > 0) {
      return `${days} days ${hours} hours`
    }
    if (hours > 0) {
      return `${hours} hours ${minutes} minutes`
    }
    return `${minutes} minutes`
  }

  // ✅ فرمت زمان به صورت "مدت زمان پیش" (برای نظرات و موارد دیگر)
  function formatTimeAgo(date: string): string {
    try {
      const now = new Date()
      const created = new Date(date)
      const diffMs = now.getTime() - created.getTime()
      const diffMins = Math.floor(diffMs / 60000)
      const diffHours = Math.floor(diffMs / 3600000)
      const diffDays = Math.floor(diffMs / 86400000)
      const diffMonths = Math.floor(diffDays / 30)
      const diffYears = Math.floor(diffDays / 365)

      if (diffMins < 1) return 'لحظاتی پیش'
      if (diffMins < 60) return `${diffMins} دقیقه پیش`
      if (diffHours < 24) return `${diffHours} ساعت پیش`
      if (diffDays < 7) return `${diffDays} روز پیش`
      if (diffDays < 30) return `${diffDays} روز پیش`
      if (diffMonths < 12) return `${diffMonths} ماه پیش`
      return `${diffYears} سال پیش`
    } catch {
      return 'چندی پیش'
    }
  }
</script>

<div class="wave-card">
  <!-- Wave Cover / Thumbnail -->
  <div class="wave-cover">
    <AudioPlayer
      audioUrl={wave.audio_url}
      waveId={wave.id}
      title={wave.title}
      coverImage={wave.cover_image || '/default-cover.jpg'}
      autoPlay={false}
    />
  </div>

  <!-- Wave Info -->
  <div class="wave-info">
    <div class="wave-header">
     <div class="wave-title-section">
    <h3 class="wave-title" onclick={goToWaveDetail}>{wave.title}</h3>
    <div class="wave-meta-tags">
      <span class="wave-category">{wave.category}</span>
      <span class="wave-category ">{formatNumber(wave.likes_count || 0)} reactions</span>
      <span class="wave-category ">{formatNumber(wave.comments_count || 0)} comments</span>
      <span class="wave-category">{formatNumber(wave.views_count || 0)} views</span>
      <!-- ✅ نمایش زمان باقی‌مانده برای موج -->
      {#if wave.expires_at}
        <span class="wave-category expires-badge">
          ⏱️ {getTimeRemaining(wave.expires_at)}
        </span>
      {/if}
      {#if wave.hashtags}
        <span class="wave-category">#{wave.hashtags || '#'}</span>
      {/if}
    </div>
  </div>
      
      <div class="wave-actions-top">
          {#if showDelete}
            <button class="action-btn delete-btn" onclick={() => emitDelete()}>
              <Trash2 size={16} />
              حذف
            </button>
          {/if}
        <div class="wave-actions">
          <button class="action-btn comment-btn" onclick={toggleCommentInput}>
            <MessageCircle size={16} />
            <span class="stat-item"> {formatNumber(wave.comments_count || 0)}</span>
          </button>
          <button class="action-btn share-btn" onclick={() => {
            navigator.clipboard?.writeText(`${window.location.origin}/wave/${wave.id}`)
            alert('✅ لینک کپی شد!')
          }}>
            <Share2 size={16} />
            <span class="stat-item">{formatNumber(wave.saves_count || 0)}</span>
          </button>
          <button class="action-btn room-btn" onclick={() => goto(`/room/${wave.id}`)}>
            <Users size={16} />
            اتاق
          </button>
          <!-- ✅ دکمه دانلود -->
          <button class="action-btn download-btn" onclick={downloadAudio} title="دانلود فایل صوتی">
            <Download size={16} />
          </button>
        </div>
      </div>
    </div>

    <!-- Comment Input (toggles) -->
    {#if showCommentInput}
      <div class="comment-input-wrapper">
        <div class="comment-input">
          <textarea
            placeholder="نظر خود را بنویسید..."
            bind:value={commentText}
            rows="3"
            disabled={isSubmitting}
            onkeydown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                submitComment()
              }
            }}
          />
          <button
            class="send-btn"
            onclick={submitComment}
            disabled={!commentText.trim() || isSubmitting}
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    {/if}

    <div class="wave-meta">
      <div class="wave-author">
        <Avatar src={wave.author?.avatar} size="sm" />
        <span class="author-name" onclick={() => goToProfile(wave.author?.username)}>{wave.author?.name || 'ناشناس'}</span>
        <!-- ✅ دکمه فالو فقط در صورتی نمایش داده شود که کاربر خودش نباشد -->
        {#if currentUser && currentUser.id !== wave.author_id}
          <button class="follow-btn {isFollowing ? 'following' : ''}" onclick={(e) => {
            e.stopPropagation()
            toggleFollow()
          }}>
            {#if isFollowing}
              <UserCheck size={14} />
            {:else}
              <UserPlus size={14} />
            {/if}
          </button>
        {/if}
      </div>
      
<div class="wave-stats">
  <div class="reaction-section">
  <ReactionPicker
    currentReaction={userReaction}
    onSelect={(emoji) => handleReaction(emoji)}
  />
  
  {#if waveReactions.length > 0}
    <div class="reaction-summary">
      {#each waveReactions as reaction (reaction.emoji)}
        <button 
          class="reaction-badge {userReaction === reaction.emoji ? 'user-reacted' : ''}"
          onclick={() => handleReaction(reaction.emoji)}
        >
          {reaction.emoji} {reaction.count}
        </button>
      {/each}
    </div>
  {/if}
  </div>
</div>
    </div>

    <!-- Real Comments Marquee - Clickable -->
    {#if !loadingComments && comments.length > 0}
      <div class="comments-marquee" onclick={openCommentsModal}>
        <div class="marquee-container">
          <!-- LTR comments track -->
          <div class="marquee-track ltr-track">
            {#each comments.filter(c => c.direction === 'ltr') as comment, index}
              <span class="comment-item ltr-text">
                <span class="comment-user">{comment.user?.name || 'ناشناس'}:</span>
                <span class="comment-text">{comment.text}</span>
                {#if index < comments.filter(c => c.direction === 'ltr').length - 1}
                  <span class="comment-separator">•</span>
                {/if}
              </span>
            {/each}
            <!-- Duplicate for seamless loop -->
            {#each comments.filter(c => c.direction === 'ltr') as comment, index}
              <span class="comment-item ltr-text">
                <span class="comment-user">{comment.user?.name || 'ناشناس'}:</span>
                <span class="comment-text">{comment.text}</span>
                {#if index < comments.filter(c => c.direction === 'ltr').length - 1}
                  <span class="comment-separator">•</span>
                {/if}
              </span>
            {/each}
          </div>
        </div>
        
        <div class="marquee-container">
          <!-- RTL comments track -->
          <div class="marquee-track rtl-track" dir="rtl">
            {#each comments.filter(c => c.direction === 'rtl') as comment, index}
              <span class="comment-item rtl-text">
                <span class="comment-user">{comment.user?.name || 'ناشناس'}:</span>
                <span class="comment-text">{comment.text}</span>
                {#if index < comments.filter(c => c.direction === 'rtl').length - 1}
                  <span class="comment-separator">•</span>
                {/if}
              </span>
            {/each}
            <!-- Duplicate for seamless loop -->
            {#each comments.filter(c => c.direction === 'rtl') as comment, index}
              <span class="comment-item rtl-text">
                <span class="comment-user">{comment.user?.name || 'ناشناس'}:</span>
                <span class="comment-text">{comment.text}</span>
                {#if index < comments.filter(c => c.direction === 'rtl').length - 1}
                  <span class="comment-separator">•</span>
                {/if}
              </span>
            {/each}
          </div>
        </div>
        
        <div class="comments-view-all">
          مشاهده همه نظرات
        </div>
      </div>
    {/if}
  </div>
</div>

<!-- Comments Modal -->
{#if showCommentsModal}
  <div class="modal-overlay" onclick={closeCommentsModal}>
    <div class="modal-content comments-modal" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <button class="modal-back-btn" onclick={closeCommentsModal}>
          <ChevronLeft size={24} />
        </button>
        <h3>نظرات</h3>
        <button class="modal-close" onclick={closeCommentsModal}>
          <X size={20} />
        </button>
      </div>
      
      <div class="comments-list">
        {#if loadingAllComments}
          <div class="comments-loading">
            <div class="spinner-small"></div>
            در حال بارگذاری نظرات...
          </div>
        {:else if allComments.length === 0}
          <div class="no-comments">
            <MessageCircle size={48} />
            <p>هنوز نظری وجود ندارد</p>
            <span>اولین نفری باشید که نظر می‌دهد</span>
          </div>
        {:else}
          {#each allComments as comment (comment.id)}
            <div class="comment-item-full">
              <div class="comment-avatar" onclick={() => goToProfile(comment.user?.username)}>
                {#if comment.user?.avatar}
                  <img src={comment.user.avatar} alt={comment.user.name} />
                {:else}
                  <div class="avatar-placeholder">
                    {comment.user?.name?.charAt(0) || '?'}
                  </div>
                {/if}
              </div>
              <div class="comment-content">
                <div class="comment-header">
                  <span class="comment-author" onclick={() => goToProfile(comment.user?.username)}>
                    {comment.user?.name || 'ناشناس'}
                  </span>
                  <span class="comment-time">{formatTime(comment.created_at)}</span>
                </div>
                <p class="comment-body-text">{comment.content}</p>
              </div>
            </div>
          {/each}
        {/if}
      </div>
    </div>
  </div>
{/if}

<!-- Boost Modal -->
{#if showBoostModal}
  <div class="modal-overlay" onclick={() => showBoostModal = false}>
    <div class="modal-content" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <Rocket size={24} />
        <h3>تقویت موج</h3>
        <button class="modal-close" onclick={() => showBoostModal = false}>
          <X size={20} />
        </button>
      </div>
      
      <p>با تقویت این موج، آن را به مدت ۲۴ ساعت در بالای صفحه نمایش می‌دهیم.</p>
      
      <div class="modal-balance">
        <span>موجودی شما</span>
        <span class="balance-amount">{userBalance.toLocaleString()} توکن</span>
      </div>
      
      <div class="modal-cost">
        <span>هزینه تقویت</span>
        <span class="cost-amount">۳۰ توکن</span>
      </div>

      {#if boostMessage}
        <div class="modal-message {boostSuccess ? 'success' : 'error'}">
          {boostMessage}
        </div>
      {/if}

      {#if userBalance < 30 && !boostSuccess}
        <div class="insufficient-balance">
          <AlertCircle size={16} />
          موجودی شما کافی نیست. برای افزایش موجودی، موج منتشر کنید یا لایک دریافت کنید.
        </div>
      {/if}

      <div class="modal-actions">
        <button class="cancel-btn" onclick={() => showBoostModal = false}>
          انصراف
        </button>
        <button 
          class="confirm-btn" 
          onclick={handleBoost}
          disabled={isBoosting || userBalance < 30}
        >
          {#if isBoosting}
            <span class="spinner-small"></span>
            در حال پردازش...
          {:else}
            تقویت موج
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .wave-card {
    background: white;
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 2px 12px rgba(0,0,0,0.08);
    margin-bottom: 16px;
    transition: transform 0.2s, box-shadow 0.2s;
    position: relative;
  }
 .delete-btn {
    background: #fee2e2;
    color: #ef4444;
  }

  .delete-btn:hover {
    background: #fecaca;
  }

  /* ✅ دکمه دانلود */
  .download-btn {
    background: #e0e7ff;
    color: #4f46e5;
  }

  .download-btn:hover {
    background: #c7d2fe;
  }
  
  .wave-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 20px rgba(0,0,0,0.12);
  }

  /* Cover */
  .wave-cover {
    position: relative;
    width: 100%;
    padding-top: 56.25%;
    background: #f0f2f5;
    overflow: hidden;
    cursor: pointer;
  }

  .wave-cover :global(.audio-player) {
    position: absolute;
    inset: 0;
  }

  /* Info */
  .wave-info {
    padding: 14px 16px 16px;
  }

  .wave-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 8px;
  }

  .wave-title-section {
    flex: 1;
    min-width: 0;
  }

  .wave-title {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: #050505;
    cursor: pointer;
    display: -webkit-box;
    -webkit-line-clamp: 1;
    -webkit-box-orient: vertical;
    overflow: hidden;
    line-height: 1.3;
  }

  .wave-title:hover {
    color: #1877f2;
  }

  .wave-category {
    font-size: 11px;
    color: #65676b;
    background: #f0f2f5;
    padding: 2px 10px;
    border-radius: 12px;
    display: inline-block;
    margin-top: 2px;
  }

  /* ✅ استایل ویژه برای تایمر باقی‌مانده */
  .expires-badge {
    background: #fef3c7 !important;
    color: #92400e !important;
    font-weight: 600;
  }

  .wave-actions-top {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .wave-actions {
    display: flex;
    gap: 8px;
  }

  .action-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 12px;
    border: none;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    font-family: inherit;
  }

  .action-btn:hover:not(:disabled) {
    transform: scale(1.02);
  }

  .action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .comment-btn {
    background: #f0f2f5;
    color: #050505;
  }

  .comment-btn:hover {
    background: #e7f3ff;
    color: #1877f2;
  }

  .share-btn {
    background: #f0f2f5;
    color: #050505;
  }

  .share-btn:hover {
    background: #e8f5e9;
    color: #10b981;
  }

  .room-btn {
    background: #10b981;
    color: white;
  }

  .room-btn:hover {
    background: #059669;
  }

  .like-btn {
    background: none;
    border: none;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    padding: 4px 10px;
    border-radius: 20px;
    transition: all 0.2s;
    color: #65676b;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .like-btn:hover:not(:disabled) {
    background: #fce4ec;
  }

  .like-btn.liked {
    color: #dc3545;
  }

  .like-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Meta */
  .wave-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    flex-wrap: wrap;
    gap: 4px;
  }

  .wave-author {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    transition: opacity 0.2s;
  }

  .wave-author:hover {
    opacity: 0.8;
  }

  .author-name {
    font-weight: 500;
    font-size: 13px;
    color: #050505;
  }

  .follow-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 2px 10px;
    border: none;
    border-radius: 12px;
    background: #eef2ff;
    color: #6366f1;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    font-family: inherit;
  }

  .follow-btn:hover {
    background: #c7d2fe;
  }

  .follow-btn.following {
    background: #f1f5f9;
    color: #64748b;
  }

  .follow-btn.following:hover {
    background: #fee2e2;
    color: #ef4444;
  }

  .wave-stats {
    display: flex;
    gap: 12px;
    font-size: 13px;
    color: #65676b;
    align-items: center;
  }
/* Reaction Section */
.reaction-section {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.reaction-summary {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.reaction-badge {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px 10px;
  border-radius: 16px;
  background: #f1f5f9;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 2px solid transparent;
}

.reaction-badge:hover {
  background: #e2e8f0;
  transform: scale(1.05);
}

.reaction-badge.user-reacted {
  border-color: #6366f1;
  background: #eef2ff;
}
  .wave-stats span {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .stat-item {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  /* Comment Input */
  .comment-input-wrapper {
    padding: 8px 0 12px 0;
    border-bottom: 1px solid #f0f2f5;
    margin-bottom: 8px;
  }

  .comment-input {
    display: flex;
    gap: 8px;
    align-items: flex-end;
  }

  .comment-input textarea {
    flex: 1;
    padding: 8px 12px;
    border: 1px solid #d0d7de;
    border-radius: 8px;
    font-size: 13px;
    font-family: inherit;
    resize: none;
    min-height: 60px;
    transition: border-color 0.2s;
    background: #fafbfc;
    color: #050505;
  }

  .comment-input textarea:focus {
    outline: none;
    border-color: #1877f2;
    background: white;
    box-shadow: 0 0 0 3px rgba(24, 119, 242, 0.1);
  }

  .comment-input textarea::placeholder {
    color: #94a3b8;
  }

  .comment-input textarea:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .send-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    background: #1877f2;
    border: none;
    color: white;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    cursor: pointer;
    transition: all 0.2s ease;
    flex-shrink: 0;
    align-self: flex-end;
    margin-bottom: 2px;
  }

  .send-btn:hover:not(:disabled) {
    background: #1664d8;
    transform: scale(1.05);
  }

  .send-btn:active:not(:disabled) {
    transform: scale(0.95);
  }

  .send-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* Real Comments Marquee - Clickable */
  .comments-marquee {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px 0;
    border-top: 1px solid #f0f2f5;
    border-bottom: 1px solid #f0f2f5;
    margin-top: 8px;
    overflow: hidden;
    cursor: pointer;
    transition: background 0.2s;
    position: relative;
  }

  .comments-marquee:hover {
    background: #f8f9fa;
  }

  .comments-view-all {
    text-align: center;
    font-size: 12px;
    color: #6366f1;
    font-weight: 500;
    padding-top: 4px;
    border-top: 1px dashed #e2e8f0;
    margin-top: 4px;
  }

  .comments-view-all:hover {
    color: #4f46e5;
  }

  .marquee-container {
    overflow: hidden;
    padding: 2px 0;
  }

  .marquee-track {
    display: inline-flex;
    white-space: nowrap;
    gap: 8px;
    padding: 0 16px;
    font-size: 13px;
    color: #475569;
    align-items: center;
  }

  .ltr-track {
    animation: marqueeLTR 20s linear infinite;
  }

  @keyframes marqueeLTR {
    0% { transform: translateX(0); }
    100% { transform: translateX(-50%); }
  }

  .rtl-track {
    animation: marqueeRTL 20s linear infinite;
  }

  @keyframes marqueeRTL {
    0% { transform: translateX(0); }
    100% { transform: translateX(50%); }
  }

  .ltr-track:hover,
  .rtl-track:hover {
    animation-play-state: paused;
  }

  .comment-item {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .comment-user {
    color: #6366f1;
    font-weight: 600;
  }

  .comment-text {
    color: #1a1a2e;
  }

  .comment-separator {
    color: #cbd5e1;
  }

  .ltr-text {
    direction: ltr;
  }

  .rtl-text {
    direction: rtl;
  }

  /* Comments Modal */
  .comments-modal {
    max-width: 500px !important;
    max-height: 80vh !important;
    display: flex;
    flex-direction: column;
    padding: 0 !important;
    overflow: hidden;
  }

  .comments-modal .modal-header {
    padding: 16px 20px;
    border-bottom: 1px solid #f0f2f5;
    flex-shrink: 0;
    margin-bottom: 0;
  }

  .modal-back-btn {
    background: none;
    border: none;
    color: #64748b;
    cursor: pointer;
    padding: 4px;
    border-radius: 50%;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .modal-back-btn:hover {
    background: #f1f5f9;
    color: #1a1a2e;
  }

  .comments-list {
    flex: 1;
    overflow-y: auto;
    padding: 16px 20px;
  }

  .comments-list::-webkit-scrollbar {
    width: 4px;
  }

  .comments-list::-webkit-scrollbar-track {
    background: #f1f5f9;
    border-radius: 2px;
  }

  .comments-list::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 2px;
  }

  .no-comments {
    text-align: center;
    padding: 60px 20px;
    color: #94a3b8;
  }

  .no-comments :global(svg) {
    color: #cbd5e1;
    margin-bottom: 12px;
  }

  .no-comments p {
    margin: 0 0 4px 0;
    font-weight: 500;
    color: #64748b;
  }

  .no-comments span {
    font-size: 13px;
    color: #94a3b8;
  }

  .comment-item-full {
    display: flex;
    gap: 12px;
    padding: 12px 0;
    border-bottom: 1px solid #f1f5f9;
  }

  .comment-item-full:last-child {
    border-bottom: none;
  }

  .comment-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    overflow: hidden;
    flex-shrink: 0;
    cursor: pointer;
  }

  .comment-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .avatar-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    color: white;
    font-size: 18px;
    font-weight: 600;
  }

  .comment-content {
    flex: 1;
    min-width: 0;
  }

  .comment-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 2px;
  }

  .comment-author {
    font-weight: 600;
    font-size: 14px;
    color: #1a1a2e;
    cursor: pointer;
    transition: color 0.2s;
  }

  .comment-author:hover {
    color: #6366f1;
  }

  .comment-time {
    font-size: 12px;
    color: #94a3b8;
    flex-shrink: 0;
  }

  .comment-body-text {
    margin: 0;
    font-size: 14px;
    color: #1a1a2e;
    line-height: 1.6;
    word-wrap: break-word;
  }

  .comments-loading {
    text-align: center;
    padding: 40px 20px;
    color: #94a3b8;
  }

  .spinner-small {
    display: inline-block;
    width: 24px;
    height: 24px;
    border: 3px solid #e2e8f0;
    border-top-color: #6366f1;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin-bottom: 8px;
  }

  /* Modal */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.6);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    animation: fadeIn 0.2s ease;
    padding: 16px;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .modal-content {
    background: white;
    border-radius: 20px;
    padding: 24px;
    max-width: 400px;
    width: 100%;
    animation: slideUp 0.3s ease;
    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
  }

  @keyframes slideUp {
    from { transform: translateY(20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }

  .modal-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
  }

  .modal-header h3 {
    margin: 0;
    flex: 1;
    font-size: 18px;
    font-weight: 700;
    color: #1a1a2e;
  }

  .modal-close {
    background: none;
    border: none;
    color: #94a3b8;
    cursor: pointer;
    padding: 4px;
    border-radius: 50%;
    transition: all 0.2s ease;
  }

  .modal-close:hover {
    background: #f1f5f9;
  }

  .modal-content > p {
    color: #64748b;
    margin: 0 0 16px 0;
    font-size: 14px;
    line-height: 1.6;
  }

  .modal-balance, .modal-cost {
    display: flex;
    justify-content: space-between;
    padding: 10px 16px;
    background: #f8fafc;
    border-radius: 10px;
    margin-bottom: 8px;
    font-size: 14px;
  }

  .balance-amount {
    font-weight: 700;
    color: #10b981;
  }

  .cost-amount {
    font-weight: 700;
    color: #ef4444;
  }

  .modal-message {
    padding: 12px 16px;
    border-radius: 10px;
    margin: 12px 0;
    text-align: center;
    font-size: 14px;
    font-weight: 500;
  }

  .modal-message.success {
    background: #d1fae5;
    color: #065f46;
  }

  .modal-message.error {
    background: #fee2e2;
    color: #991b1b;
  }

  .modal-actions {
    display: flex;
    gap: 12px;
    margin-top: 16px;
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

  .cancel-btn:hover {
    background: #f1f5f9;
  }

  .confirm-btn {
    flex: 2;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px;
    border: none;
    border-radius: 10px;
    background: linear-gradient(135deg, #f59e0b, #d97706);
    color: white;
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
    transition: all 0.2s ease;
  }

  .confirm-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(245, 158, 11, 0.3);
  }

  .confirm-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }

  .insufficient-balance {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    background: #fef2f2;
    border-radius: 10px;
    font-size: 13px;
    color: #dc2626;
    margin: 12px 0;
  }

  .spinner-small {
    display: inline-block;
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Mobile */
  @media (max-width: 480px) {
    .wave-title {
      font-size: 14px;
    }

    .action-btn {
      font-size: 12px;
      padding: 4px 8px;
    }

    .wave-actions {
      gap: 4px;
    }

    .wave-stats {
      gap: 6px;
      font-size: 12px;
    }

    .marquee-track {
      font-size: 11px;
      padding: 0 8px;
    }

    .comment-user {
      font-size: 11px;
    }

    .comment-text {
      font-size: 11px;
    }

    .comment-input textarea {
      font-size: 12px;
      padding: 6px 10px;
      min-height: 50px;
    }

    .send-btn {
      width: 32px;
      height: 32px;
    }

    .send-btn :global(svg) {
      width: 16px;
      height: 16px;
    }

    .comments-modal {
      max-height: 90vh !important;
      border-radius: 16px !important;
    }

    .comments-modal .modal-header {
      padding: 12px 16px;
    }

    .comments-list {
      padding: 12px 16px;
    }

    .comment-item-full {
      padding: 10px 0;
    }

    .comment-avatar {
      width: 32px;
      height: 32px;
    }

    .comment-author {
      font-size: 13px;
    }

    .comment-body-text {
      font-size: 13px;
    }
  }
</style>