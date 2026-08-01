<script lang="ts">
  import { goto } from '$app/navigation'
  import { onMount } from 'svelte'
  import Avatar from '$lib/components/ui/Avatar.svelte'
  import { formatDuration, getDurationLabel, getDurationColor } from '$lib/utils/wave-helpers'
  import { boostWave, getTokenBalance } from '$lib/services/token-service'
  import type { WaveWithLike } from '$lib/services/wave-service'
  import AudioPlayer from './AudioPlayer.svelte'

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
    X
  } from 'lucide-svelte'

  let { 
    wave,
    currentUserId,
    onLike
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

  let comments = $state([
    { text: 'این موج عالیه!', direction: 'ltr' },
    { text: 'موج بعدی کی منتشر میشه؟', direction: 'ltr' },
    { text: 'صدای فوق‌العاده‌ای داره!', direction: 'ltr' },
    { text: 'thats really great', direction: 'rtl' },
    { text: 'I like the way goooooooo and here is the complete comment for your test', direction: 'rtl' },
  ])

  // Check if wave is boosted
  const isBoosted = wave.is_boosted && 
    wave.boost_expires_at && 
    new Date(wave.boost_expires_at) > new Date()

  // Load user balance
  onMount(async () => {
    if (currentUserId) {
      userBalance = await getTokenBalance(currentUserId)
    }
  })

  async function handleLike() {
    if (isLiking) return
    isLiking = true
    await onLike(wave.id)
    isLiking = false
  }

  function goToProfile() {
    if (wave.author?.username) {
      goto(`/profile/${wave.author.username}`)
    }
  }

  function goToWaveDetail() {
    goto(`/wave/${wave.id}`)
  }

  function toggleFollow() {
    isFollowing = !isFollowing
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
        <div class="">
          <span class="wave-category">{wave.category}</span>
          <span class="wave-category">3k likes</span>
          <span class="wave-category">90k views</span>
          <span class="wave-category">3mo ago</span>
          <span class="wave-category">#Emotional</span>
        </div>
      </div>
      
      <div class="wave-actions-top">
        <div class="wave-actions">
          <button class="action-btn comment-btn" onclick={() => goto(`/wave/${wave.id}`)}>
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
        </div>
      </div>
    </div>

    <div class="wave-meta">
      <div class="wave-author">
        <Avatar src={wave.author?.avatar} size="sm" />
        <span class="author-name" onclick={goToProfile}>{wave.author?.name || 'ناشناس'}</span>
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
      </div>
      
      <div class="wave-stats">
        <button 
          class="like-btn {wave.isLiked ? 'liked' : ''}" 
          onclick={handleLike}
          disabled={isLiking}
        >
          <Heart size={16} fill={wave.isLiked ? '#ef4444' : 'none'} />
          <span>{formatNumber(wave.likes_count || 0)}</span>
        </button>
        <span>
          <Smile size={16} />
          999
        </span>
        <span>
          <Frown size={16} />
          10
        </span>
        <span>
          <Flame size={16} color="#f59e0b" />
          1
        </span>
      </div>
    </div>

    <!-- Action Buttons -->
    <div class="comments-marquee">
      <div class="marquee-container">
        <!-- LTR comments track -->
        <div class="marquee-track ltr-track">
          {#each comments.filter(c => c.direction === 'ltr') as comment, index}
            <span class="comment-item ltr-text">
              {comment.text}
            </span>
            {#if index < comments.filter(c => c.direction === 'ltr').length - 1}
              <span class="comment-separator">•</span>
            {/if}
          {/each}
          <!-- Duplicate for seamless loop -->
          {#each comments.filter(c => c.direction === 'ltr') as comment, index}
            <span class="comment-item ltr-text">
              {comment.text}
            </span>
            {#if index < comments.filter(c => c.direction === 'ltr').length - 1}
              <span class="comment-separator">•</span>
            {/if}
          {/each}
        </div>
      </div>
      
      <div class="marquee-container">
        <!-- RTL comments track -->
        <div class="marquee-track rtl-track" dir="rtl">
          {#each comments.filter(c => c.direction === 'rtl') as comment, index}
            <span class="comment-item rtl-text">
              {comment.text}
            </span>
            {#if index < comments.filter(c => c.direction === 'rtl').length - 1}
              <span class="comment-separator">•</span>
            {/if}
          {/each}
          <!-- Duplicate for seamless loop -->
          {#each comments.filter(c => c.direction === 'rtl') as comment, index}
            <span class="comment-item rtl-text">
              {comment.text}
            </span>
            {#if index < comments.filter(c => c.direction === 'rtl').length - 1}
              <span class="comment-separator">•</span>
            {/if}
          {/each}
        </div>
      </div>
    </div>
  </div>
</div>

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

  /* Comments Marquee */
  .comments-marquee {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px 0;
    border-top: 1px solid #f0f2f5;
    border-bottom: 1px solid #f0f2f5;
    margin-top: 8px;
    overflow: hidden;
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
    gap: 8px;
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
  }
</style>