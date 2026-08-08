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
  import { reportWave, REPORT_REASONS } from '$lib/services/report-service'
  
  // ✅ Import extracted components
  import WaveMenu from './WaveMenu.svelte'
  import WaveReportModal from './WaveReportModal.svelte'
  import { trackEvent } from '$lib/services/analytics-service'

  import { BOOST_PLANS, applyBoost } from '$lib/services/boost-service'
  import BoostModal from '$lib/components/token/BoostModal.svelte'



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
    Download,
    Flag,
    Trash2,
    MoreHorizontal,
    Link,
    Copy,
    Check,
    CheckCircle
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

  // ✅ Menu state
  let showMenu = $state(false)
  let showReportModal = $state(false)
  let selectedReason = $state<string>('')
  let reportDescription = $state('')
  let isReporting = $state(false)
  let reportSuccess = $state(false)
  let reportMessage = $state('')
  let shareSuccess = $state(false)

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
          // ✅ Track unfollow
          await trackEvent({
            event_type: 'unfollow',
            event_data: {
              following_id: wave.author_id,
              following_name: wave.author?.name
            }
          }, currentUser.id)
        }
      } else {
        const result = await followUser(currentUser.id, wave.author_id)
        if (result) {
          isFollowing = true
          // ✅ Track follow
          await trackEvent({
            event_type: 'follow',
            event_data: {
              following_id: wave.author_id,
              following_name: wave.author?.name
            }
          }, currentUser.id)
        }
      }
    } catch (error) {
      console.error('Error toggling follow:', error)
      alert('خطا در عملیات. لطفاً دوباره تلاش کنید.')
    } finally {
      isTogglingFollow = false
    }
  }

  // ✅ Share functionality with analytics
  async function handleShare() {
    const url = `${window.location.origin}/wave/${wave.id}`
    const text = `🎵 ${wave.title} - ${wave.author?.name || 'کاربر'} در موج 🌊`
    
    try {
      // Try Web Share API first (mobile)
      if (navigator.share) {
        await navigator.share({
          title: wave.title,
          text: text,
          url: url
        })
        // ✅ Track share
        await trackShare()
        return
      }

      // Fallback: Copy to clipboard
      await navigator.clipboard.writeText(`${text}\n${url}`)
      shareSuccess = true
      setTimeout(() => shareSuccess = false, 3000)
      
      // Track share
      await trackShare()
      
    } catch (error) {
      // User cancelled share
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('Error sharing:', error)
        // Fallback copy
        try {
          await navigator.clipboard.writeText(`${text}\n${url}`)
          shareSuccess = true
          setTimeout(() => shareSuccess = false, 3000)
          await trackShare()
        } catch (clipError) {
          console.error('Clipboard error:', clipError)
        }
      }
    }
  }

  // ✅ Track share with analytics
  async function trackShare() {
    try {
      // Update saves count
      const { error } = await supabase
        .from('waves')
        .update({ saves_count: (wave.saves_count || 0) + 1 })
        .eq('id', wave.id)
      
      if (!error) {
        wave.saves_count = (wave.saves_count || 0) + 1
        wave = { ...wave }
      }
      
      // ✅ Track share event
      if (currentUserId) {
        await trackEvent({
          event_type: 'share',
          event_data: {
            wave_id: wave.id,
            wave_title: wave.title,
            author_id: wave.author_id
          }
        }, currentUserId)
      }
    } catch (error) {
      console.error('Error tracking share:', error)
    }
  }

  // ✅ Copy link to clipboard with analytics
  async function copyLink() {
    const url = `${window.location.origin}/wave/${wave.id}`
    try {
      await navigator.clipboard.writeText(url)
      shareSuccess = true
      setTimeout(() => shareSuccess = false, 3000)
      showMenu = false
      
      // ✅ Track copy link
      if (currentUserId) {
        await trackEvent({
          event_type: 'share',
          event_data: {
            wave_id: wave.id,
            method: 'copy_link'
          }
        }, currentUserId)
      }
    } catch (error) {
      console.error('Error copying link:', error)
    }
  }

  // ✅ Download audio with analytics
  async function downloadAudio() {
    if (!wave.audio_url) {
      alert('فایل صوتی موجود نیست')
      return
    }

    try {
      const response = await fetch(wave.audio_url)
      const blob = await response.blob()
      
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${wave.title || 'wave'}.mp3`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      
      // ✅ Track download
      if (currentUserId) {
        await trackEvent({
          event_type: 'wave_download',
          event_data: {
            wave_id: wave.id,
            wave_title: wave.title
          }
        }, currentUserId)
      }
    } catch (error) {
      console.error('Error downloading audio:', error)
      alert('خطا در دانلود فایل. لطفاً دوباره تلاش کنید.')
    }
  }

  // Toggle menu
  function toggleMenu() {
    showMenu = !showMenu
  }

  // Load user balance
  onMount(async () => {
    if (currentUserId) {
      userBalance = await getTokenBalance(currentUserId)
    }
    await loadComments()
    await loadFollowStatus()
    
    // ✅ Track wave view
    if (currentUserId && wave.id) {
      await trackEvent({
        event_type: 'wave_view',
        event_data: {
          wave_id: wave.id,
          author_id: wave.author_id,
          title: wave.title,
          category: wave.category
        }
      }, currentUserId)
    }
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
          // ✅ Track reaction
          await trackEvent({
            event_type: 'reaction_added',
            event_data: {
              wave_id: wave.id,
              emoji: emoji
            }
          }, currentUser.id)
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
          // ✅ Track reaction change
          await trackEvent({
            event_type: 'reaction_changed',
            event_data: {
              wave_id: wave.id,
              from_emoji: oldEmoji,
              to_emoji: emoji
            }
          }, currentUser.id)
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
    
    // ✅ Track comments view
    if (currentUserId) {
      await trackEvent({
        event_type: 'comments_view',
        event_data: {
          wave_id: wave.id
        }
      }, currentUserId)
    }
  }

  // Close comments modal
  function closeCommentsModal() {
    showCommentsModal = false
    allComments = []
  }

  // Submit comment with analytics
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

      // ✅ Track comment
      await trackEvent({
        event_type: 'comment',
        event_data: {
          wave_id: wave.id,
          comment_id: data.id,
          parent_id: data.parent_id || null
        }
      }, currentUser.id)

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

async function handleBoost(planId: string) {
  if (!currentUserId) {
    goto('/auth/login')
    return
  }

  if (isBoosting) return
  isBoosting = true
  boostMessage = ''
  boostSuccess = false

  try {
    const result = await applyBoost(currentUserId, wave.id, planId)
    
    if (result.success) {
      boostSuccess = true
      boostMessage = result.message
      
      // به‌روزرسانی موج
      const plan = BOOST_PLANS.find(p => p.id === planId)
      wave.is_boosted = true
      wave.boost_expires_at = new Date(Date.now() + (plan?.duration_hours || 24) * 60 * 60 * 1000).toISOString()
      wave.boost_count = (wave.boost_count || 0) + 1
      
      // به‌روزرسانی موجودی
      userBalance = await getTokenBalance(currentUserId)
      
      // ثبت رویداد
      await trackEvent({
        event_type: 'boost_wave',
        event_data: {
          wave_id: wave.id,
          plan_id: planId,
          plan_name: plan?.name
        }
      }, currentUserId)
      
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
</script>

<!-- Rest of the HTML remains exactly the same -->
<div class="wave-card">
  <!-- Wave Cover -->
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
          <span class="wave-category">{formatNumber(wave.likes_count || 0)} reactions</span>
          <span class="wave-category">{formatNumber(wave.comments_count || 0)} comments</span>
          <span class="wave-category">👁️ {formatNumber(wave.views_count || 0)} views</span>
          {#if wave.expires_at}
            <span class="wave-category expires-badge">
              ⏱️ {getTimeRemaining(wave.expires_at)}
            </span>
          {/if}
          {#if wave.hashtags}
            <span class="wave-category hashtag">#{wave.hashtags}</span>
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
        
        <!-- ✅ Menu Component -->
        <WaveMenu
          show={showMenu}
          onToggle={toggleMenu}
          onShare={handleShare}
          onCopyLink={copyLink}
          onDownload={downloadAudio}
          onFollow={toggleFollow}
          onReport={() => {
            showReportModal = true
            showMenu = false
          }}
          isFollowing={isFollowing}
          isAuthor={currentUser?.id === wave.author_id}
          shareSuccess={shareSuccess}
          currentUser={currentUser}
        />
        
        <div class="wave-actions">
          <button class="action-btn comment-btn" onclick={toggleCommentInput}>
            <MessageCircle size={16} />
            <span class="stat-item"> {formatNumber(wave.comments_count || 0)}</span>
          </button>
          <button class="action-btn share-btn" onclick={handleShare}>
            <Share2 size={16} />
            <span class="stat-item">{formatNumber(wave.saves_count || 0)}</span>
          </button>
          <button class="action-btn room-btn" onclick={() => goto(`/room/${wave.id}`)}>
            <Users size={16} />
            اتاق
          </button>
          <!-- <button class="action-btn download-btn" onclick={downloadAudio} title="دانلود فایل صوتی">
            <Download size={16} />
          </button> -->
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

    <!-- Real Comments Marquee -->
    {#if !loadingComments && comments.length > 0}
      <div class="comments-marquee" onclick={openCommentsModal}>
        <div class="marquee-container">
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

<!-- ✅ Report Modal Component -->
<WaveReportModal
  show={showReportModal}
  waveId={wave.id}
  currentUserId={currentUserId}
  onClose={() => {
    showReportModal = false
    selectedReason = ''
    reportDescription = ''
    reportMessage = ''
  }}
/>
<BoostModal
  show={showBoostModal}
  onClose={() => showBoostModal = false}
  onBoost={handleBoost}
  userBalance={userBalance}
  isProcessing={isBoosting}
/>

<style>
  /* All existing styles remain exactly the same */
  
  .wave-card {
    background: white;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    transition: all 0.2s ease;
    margin-bottom: 12px;
  }

  .wave-card:hover {
    box-shadow: 0 4px 16px rgba(0,0,0,0.12);
  }

  .wave-cover {
    width: 100%;
    aspect-ratio: 16/9;
    background: #1a1a2e;
    position: relative;
    overflow: hidden;
  }

  .wave-info {
    padding: 14px 16px;
  }

  .wave-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 8px;
    margin-bottom: 8px;
  }

  .wave-title-section {
    flex: 1;
    min-width: 0;
  }

  .wave-title {
    margin: 0 0 4px 0;
    font-size: 16px;
    font-weight: 600;
    color: #1a1a2e;
    cursor: pointer;
    transition: color 0.2s ease;
  }

  .wave-title:hover {
    color: #6366f1;
  }

  .wave-meta-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 8px;
    font-size: 12px;
    color: #64748b;
  }

  .wave-category {
    padding: 2px 8px;
    background: #f1f5f9;
    border-radius: 12px;
    font-size: 11px;
  }

  .expires-badge {
    background: #fef3c7;
    color: #d97706;
  }

  .hashtag {
    background: #eef2ff;
    color: #6366f1;
  }

  .wave-actions-top {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .wave-actions {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .action-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 10px;
    background: none;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-size: 13px;
    color: #64748b;
    transition: all 0.2s ease;
    font-family: inherit;
  }

  .action-btn:hover {
    background: #f1f5f9;
    color: #1a1a2e;
  }

  .stat-item {
    font-size: 12px;
  }

  .delete-btn {
    color: #ef4444;
  }

  .delete-btn:hover {
    background: #fef2f2;
    color: #dc2626;
  }

  .comment-btn:hover {
    color: #6366f1;
  }

  .share-btn:hover {
    color: #10b981;
  }

  .room-btn:hover {
    color: #8b5cf6;
  }

  .download-btn:hover {
    color: #3b82f6;
  }

  .comment-input-wrapper {
    margin: 8px 0 12px 0;
  }

  .comment-input {
    display: flex;
    gap: 8px;
    align-items: flex-end;
  }

  .comment-input textarea {
    flex: 1;
    padding: 8px 12px;
    border: 2px solid #e2e8f0;
    border-radius: 10px;
    font-size: 14px;
    font-family: inherit;
    resize: vertical;
    min-height: 50px;
    transition: all 0.2s ease;
    background: #fafbfc;
  }

  .comment-input textarea:focus {
    outline: none;
    border-color: #6366f1;
    background: white;
    box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.1);
  }

  .send-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    background: #6366f1;
    color: white;
    border: none;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    cursor: pointer;
    transition: all 0.2s ease;
    flex-shrink: 0;
  }

  .send-btn:hover:not(:disabled) {
    background: #4f46e5;
    transform: scale(1.05);
  }

  .send-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .wave-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin: 8px 0;
    flex-wrap: wrap;
    gap: 8px;
  }

  .wave-author {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .author-name {
    font-size: 14px;
    font-weight: 600;
    color: #1a1a2e;
    cursor: pointer;
  }

  .author-name:hover {
    color: #6366f1;
  }

  .follow-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    background: #6366f1;
    color: white;
    border: none;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .follow-btn:hover {
    background: #4f46e5;
    transform: scale(1.05);
  }

  .follow-btn.following {
    background: #e2e8f0;
    color: #64748b;
  }

  .follow-btn.following:hover {
    background: #fecaca;
    color: #ef4444;
  }

  .wave-stats {
    display: flex;
    align-items: center;
    gap: 8px;
  }

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
    padding: 2px 8px;
    background: #f1f5f9;
    border: 2px solid transparent;
    border-radius: 16px;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .reaction-badge:hover {
    background: #e2e8f0;
    transform: scale(1.05);
  }

  .reaction-badge.user-reacted {
    border-color: #6366f1;
    background: #eef2ff;
  }

  .comments-marquee {
    margin-top: 12px;
    padding: 8px;
    background: #f8fafc;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .comments-marquee:hover {
    background: #f1f5f9;
  }

  .marquee-container {
    overflow: hidden;
    position: relative;
    height: 24px;
  }

  .marquee-track {
    display: inline-flex;
    white-space: nowrap;
    animation: marquee 20s linear infinite;
  }

  .ltr-track {
    direction: ltr;
  }

  .rtl-track {
    direction: rtl;
  }

  @keyframes marquee {
    0% { transform: translateX(0); }
    100% { transform: translateX(-50%); }
  }

  .comment-item {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 0 12px;
    font-size: 13px;
  }

  .comment-user {
    font-weight: 600;
    color: #1a1a2e;
  }

  .comment-text {
    color: #64748b;
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

  .comments-view-all {
    text-align: center;
    font-size: 12px;
    color: #6366f1;
    padding-top: 4px;
    border-top: 1px solid #e2e8f0;
    margin-top: 4px;
  }

  /* Comments Modal */
  .comments-modal {
    max-width: 600px !important;
  }

  .modal-back-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    color: #64748b;
    cursor: pointer;
    padding: 4px;
    border-radius: 8px;
    transition: all 0.2s ease;
  }

  .modal-back-btn:hover {
    background: #f1f5f9;
    color: #1a1a2e;
  }

  .comments-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
    max-height: 60vh;
    overflow-y: auto;
    padding: 4px 0;
  }

  .comments-list::-webkit-scrollbar {
    width: 4px;
  }

  .comments-list::-webkit-scrollbar-track {
    background: transparent;
  }

  .comments-list::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 2px;
  }

  .comments-loading {
    text-align: center;
    padding: 40px;
    color: #94a3b8;
  }

  .no-comments {
    text-align: center;
    padding: 40px 20px;
    color: #94a3b8;
  }

  .no-comments :global(svg) {
    color: #cbd5e1;
    margin-bottom: 12px;
  }

  .no-comments p {
    margin: 0 0 4px 0;
    color: #1a1a2e;
    font-weight: 600;
  }

  .no-comments span {
    font-size: 13px;
  }

  .comment-item-full {
    display: flex;
    gap: 12px;
    padding: 12px;
    background: #f8fafc;
    border-radius: 10px;
  }

  .comment-avatar {
    width: 36px;
    height: 36px;
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
    background: #6366f1;
    color: white;
    font-weight: 600;
    font-size: 14px;
  }

  .comment-content {
    flex: 1;
    min-width: 0;
  }

  .comment-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 4px;
    flex-wrap: wrap;
    gap: 4px;
  }

  .comment-author {
    font-weight: 600;
    font-size: 14px;
    color: #1a1a2e;
    cursor: pointer;
  }

  .comment-author:hover {
    color: #6366f1;
  }

  .comment-time {
    font-size: 12px;
    color: #94a3b8;
  }

  .comment-body-text {
    margin: 0;
    font-size: 14px;
    color: #1a1a2e;
    word-wrap: break-word;
  }

  .spinner-small {
    display: inline-block;
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Modal overlay */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 20px;
    animation: fadeIn 0.2s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(20px) scale(0.98);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .modal-content {
    background: white;
    border-radius: 16px;
    padding: 24px;
    max-width: 560px;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
    animation: slideUp 0.3s ease;
  }

  .modal-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid #f1f5f9;
  }

  .modal-header :global(svg) {
    color: #6366f1;
  }

  .modal-header h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 700;
    color: #1a1a2e;
    flex: 1;
  }

  .modal-close {
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f1f5f9;
    border: none;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    cursor: pointer;
    transition: all 0.2s ease;
    color: #64748b;
  }

  .modal-close:hover {
    background: #e2e8f0;
    color: #1a1a2e;
  }

  .modal-balance, .modal-cost {
    display: flex;
    justify-content: space-between;
    padding: 8px 0;
    font-size: 14px;
    color: #64748b;
  }

  .balance-amount, .cost-amount {
    font-weight: 600;
    color: #1a1a2e;
  }

  .cost-amount {
    color: #ef4444;
  }

  .insufficient-balance {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    background: #fef2f2;
    border-radius: 8px;
    color: #dc2626;
    font-size: 13px;
    margin: 12px 0;
  }

  .insufficient-balance :global(svg) {
    flex-shrink: 0;
    color: #ef4444;
  }

  .modal-actions {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
    margin-top: 16px;
  }

  .cancel-btn {
    padding: 10px 20px;
    background: #f1f5f9;
    border: none;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    color: #64748b;
  }

  .cancel-btn:hover {
    background: #e2e8f0;
  }

  .confirm-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 10px 24px;
    background: #6366f1;
    color: white;
    border: none;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .confirm-btn:hover:not(:disabled) {
    background: #4f46e5;
    transform: scale(1.02);
  }

  .confirm-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .modal-message {
    padding: 10px 14px;
    border-radius: 8px;
    font-size: 14px;
    margin: 12px 0;
  }

  .modal-message.success {
    background: #ecfdf5;
    color: #10b981;
    border: 1px solid #a7f3d0;
  }

  .modal-message.error {
    background: #fef2f2;
    color: #ef4444;
    border: 1px solid #fca5a5;
  }

  @media (max-width: 640px) {
    .wave-info {
      padding: 12px;
    }

    .wave-title {
      font-size: 15px;
    }

    .wave-meta-tags {
      font-size: 10px;
    }

    .wave-actions {
      gap: 2px;
    }

    .action-btn {
      padding: 4px 8px;
      font-size: 12px;
    }

    .action-btn :global(svg) {
      width: 14px;
      height: 14px;
    }

    .modal-content {
      padding: 16px;
    }
  }
</style>