<script lang="ts">
  import { goto } from '$app/navigation'
  import { onMount } from 'svelte'
  import Avatar from '$lib/components/ui/Avatar.svelte'
  import { formatDuration, getDurationLabel, getDurationColor } from '$lib/utils/wave-helpers'
  import { boostWave, getTokenBalance } from '$lib/services/token-service'
  import type { WaveWithLike } from '$lib/services/wave-service'
	import AudioPlayer from './AudioPlayer.svelte';

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

  let comments = $state([
    { text: 'این موج عالیه!', direction: 'ltr' },
    { text: 'موج بعدی کی منتشر میشه؟', direction: 'ltr' },
    { text: 'صدای فوق‌العاده‌ای داره!', direction: 'ltr' },
     { text: 'thats really great', direction: 'rtl' },
    { text: 'I like the way goooooooo and here is the complete comment for your test', direction: 'rtl' },


  ]);
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

  // Toggle play state
  function togglePlay() {
    isPlaying = !isPlaying
    // Dispatch play event to parent
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
  // authorName={wave.author?. || 'ناشناس'}
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
        💬  <span class="stat-item"> {formatNumber(wave.comments_count || 0)}</span>
      </button>
      <button class="action-btn share-btn" onclick={() => {
        navigator.clipboard?.writeText(`${window.location.origin}/wave/${wave.id}`)
        alert('✅ لینک کپی شد!')
      }}>
        🔗 <span class="stat-item">{formatNumber(wave.saves_count || 0)}</span>
      </button>
      <button class="action-btn room-btn" onclick={() => goto(`/room/${wave.id}`)}>
         اتاق
      </button>
    </div>
      </div>
    </div>

    <div class="wave-meta">
      <div class="wave-author" >
        <Avatar src={wave.author?.avatar} size="sm" />
        <span class="author-name" onclick={goToProfile}>{wave.author?.name || 'ناشناس'}</span>
        <button class="text-blue-500">Follow</button>
      </div>
      
      <div class="wave-stats">
       
             <button 
          class="like-btn {wave.isLiked ? 'liked' : ''}" >
          <!-- {wave.isLiked ? '❤️' : '🤍'} {formatNumber(wave.likes_count || 0)} -->
               
           <span >
              ❤️10k
           </span>
           <span >
             😂999
           </span>
           <span >
             😮10
           </span>
           <span >
             😢9
           </span>
           <span >
              🔥1
           </span>
        </button>
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
    </div>
  </div>
</div>
  </div>
</div>

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
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    gap: 8px;
  }

  .cover-emoji {
    font-size: 48px;
  }

  .cover-title {
    color: white;
    font-size: 16px;
    font-weight: 600;
    text-shadow: 0 2px 8px rgba(0,0,0,0.3);
    padding: 0 20px;
    text-align: center;
  }

  /* Duration Badge */
  .duration-badge {
    position: absolute;
    bottom: 12px;
    right: 12px;
    padding: 4px 12px;
    border-radius: 12px;
    color: white;
    font-size: 12px;
    font-weight: 600;
    background: rgba(0,0,0,0.6);
    backdrop-filter: blur(4px);
  }

  /* Play Button Overlay */
  .play-overlay {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 56px;
    height: 56px;
    border-radius: 50%;
    border: none;
    background: rgba(255,255,255,0.9);
    backdrop-filter: blur(8px);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
    box-shadow: 0 4px 16px rgba(0,0,0,0.2);
  }

  .play-overlay:hover {
    transform: translate(-50%, -50%) scale(1.1);
    background: white;
  }

  .play-icon {
    font-size: 24px;
    margin-left: 2px;
  }

  .play-icon.pause {
    margin-left: 0;
  }

  /* Boost Badge */
  .boost-badge {
    position: absolute;
    top: 12px;
    right: 12px;
    font-size: 20px;
    filter: drop-shadow(0 2px 8px rgba(245, 87, 108, 0.4));
    animation: boostPulse 2s infinite;
  }

  @keyframes boostPulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.2); }
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

  .like-btn {
    background: none;
    border: none;
    font-size: 15px;
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

  .author-username {
    font-size: 12px;
    color: #65676b;
  }

  .wave-stats {
    display: flex;
    gap: 12px;
    font-size: 13px;
    color: #65676b;
  }

  .stat-item {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .boost-count {
    color: #f5576c;
    font-weight: 600;
  }

  /* Actions */
  .wave-actions {
    display: flex;
    gap: 8px;
    padding-top: 12px;
    border-top: 1px solid #f0f2f5;
  }

  .action-btn {
    flex: 1;
    padding: 8px 12px;
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

  .boost-action {
    background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    color: white;
  }

  .boost-action:hover {
    opacity: 0.9;
  }

  /* Modal */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    animation: fadeIn 0.2s;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .modal-content {
    background: white;
    border-radius: 16px;
    padding: 24px;
    max-width: 400px;
    width: 90%;
    max-height: 90vh;
    overflow-y: auto;
    animation: slideUp 0.3s ease;
  }

  @keyframes slideUp {
    from { transform: translateY(20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }

  .modal-content h3 {
    margin: 0 0 8px 0;
    color: #050505;
    text-align: center;
  }

  .modal-content > p {
    color: #65676b;
    text-align: center;
    margin-bottom: 20px;
  }

  .modal-balance, .modal-cost {
    display: flex;
    justify-content: space-between;
    padding: 8px 12px;
    background: #f7f8fa;
    border-radius: 6px;
    margin-bottom: 8px;
    font-size: 14px;
  }

  .balance-amount {
    font-weight: 700;
    color: #10b981;
  }

  .cost-amount {
    font-weight: 700;
    color: #dc3545;
  }

  .modal-message {
    padding: 12px;
    border-radius: 8px;
    margin: 12px 0;
    text-align: center;
    font-size: 14px;
  }

  .modal-message.success {
    background: #e8f5e9;
    color: #10b981;
  }

  .modal-message.error {
    background: #fee;
    color: #dc3545;
  }

  .modal-actions {
    display: flex;
    gap: 12px;
    margin-top: 16px;
  }

  .cancel-btn {
    flex: 1;
    padding: 10px;
    border: 1px solid #d0d7de;
    border-radius: 8px;
    background: white;
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
  }

  .cancel-btn:hover {
    background: #f0f2f5;
  }

  .confirm-btn {
    flex: 2;
    padding: 10px;
    border: none;
    border-radius: 8px;
    background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    color: white;
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
    transition: all 0.2s;
  }

  .confirm-btn:hover:not(:disabled) {
    transform: scale(1.02);
  }

  .confirm-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .insufficient-balance {
    text-align: center;
    font-size: 12px;
    color: #dc3545;
    margin-top: 12px;
  }
  /* Alternative marquee styles */
  .ltr-track {
    animation: marqueeScrollLTR 20s linear infinite;
  }

  @keyframes marqueeScrollLTR {
    0% { transform: translateX(0); }
    100% { transform: translateX(-50%); }
  }

  .rtl-track {
    animation: marqueeScrollRTL 20s linear infinite;
  }

  @keyframes marqueeScrollRTL {
    0% { transform: translateX(0); }
    100% { transform: translateX(50%); }
  }

  .ltr-track:hover,
  .rtl-track:hover {
    animation-play-state: paused;
  }
  /* Mobile */
  @media (max-width: 480px) {
    .wave-title {
      font-size: 14px;
    }

    .play-overlay {
      width: 44px;
      height: 44px;
    }

    .play-icon {
      font-size: 18px;
    }

    .action-btn {
      font-size: 12px;
      padding: 6px 10px;
    }

    .wave-actions {
      gap: 6px;
    }
  }
</style>