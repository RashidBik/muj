<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { supabase, signOut } from '$lib/client/supabase'
  import { user } from '$lib/stores/user'
  import Avatar from '$lib/components/ui/Avatar.svelte'
  import WaveCard from '$lib/components/waves/WaveCard.svelte'
  import FeedHeader from '$lib/components/feed/FeedHeader.svelte'
  import EmptyState from '$lib/components/feed/EmptyState.svelte'
  import LoadingSpinner from '$lib/components/ui/LoadingSpinner.svelte'
  import { loadWaves, toggleLike } from '$lib/services/wave-service'
  import type { WaveWithLike } from '$lib/services/wave-service'
  import { getBoostedWaves } from '$lib/services/token-service'
  import { trackEvent } from '$lib/services/analytics-service'

  
  let waves = $state<any[]>([])
  let shortWaves = $state<any[]>([]) // ✅ Short waves (stories)
  let loading = $state(true)
  let currentUser = $state<any>(null)
  let error = $state<string | null>(null)
  let isLiking = $state<Set<string>>(new Set())
  let boostedWaves = $state<any[]>([])
  let showBoosted = $state(true)
  
  // Category filter state
  const categories = [
    { value: 'ALL', label: 'همه', icon: '🌊' },
    { value: 'NEWS', label: 'اخبار', icon: '📰' },
    { value: 'EDUCATION', label: 'آموزش', icon: '📚' },
    { value: 'MUSIC', label: 'موسیقی', icon: '🎵' },
    { value: 'AUDIOBOOK', label: 'کتاب صوتی', icon: '📖' },
    { value: 'STORY', label: 'داستان', icon: '📖' },
    { value: 'FREE', label: 'آزاد', icon: '🎯' }
  ]
  let selectedCategory = $state('ALL')

  // Subscribe to user store
  $effect(() => {
    const unsubscribe = user.subscribe(value => {
      currentUser = value
    })
    return () => unsubscribe()
  })

  // Like function
  async function handleLike(waveId: string) {
    if (!currentUser) {
      goto('/auth/login')
      return
    }

    if (isLiking.has(waveId)) return
    isLiking.add(waveId)

    try {
      const waveIndex = waves.findIndex(w => w.id === waveId)
      if (waveIndex === -1) return

      const wave = waves[waveIndex]
      const newLikeStatus = await toggleLike(waveId, currentUser.id, wave.isLiked || false)

      waves[waveIndex] = {
        ...wave,
        isLiked: newLikeStatus,
        likes_count: wave.likes_count + (newLikeStatus ? 1 : -1)
      }
      waves = [...waves]

    } catch (err) {
      console.error('Error liking:', err)
      alert('خطا در لایک کردن. لطفاً دوباره تلاش کنید.')
    } finally {
      isLiking.delete(waveId)
    }
  }

  // Sign out
  async function handleSignOut() {
    try {
      await signOut()
      user.set(null)
      goto('/auth/login')
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  // Load boosted waves
  async function loadBoostedWaves() {
    try {
      boostedWaves = await getBoostedWaves()
    } catch (error) {
      console.error('Error loading boosted waves:', error)
    }
  }

  // ✅ Load function with short waves
  async function handleLoadWaves() {
    loading = true
    error = null
    
    try {
      // Load boosted waves
      await loadBoostedWaves()

      // Load all waves
      let query = supabase
        .from('waves')
        .select(`
          *,
          author:users(
            id,
            name,
            username,
            avatar
          )
        `)
        .eq('status', 'PUBLISHED')
        .eq('is_boosted', false)
        .order('created_at', { ascending: false })
        .limit(30)

      if (selectedCategory !== 'ALL') {
        query = query.eq('category', selectedCategory)
      }

      const { data, error: fetchError } = await query
      if (fetchError) throw fetchError

      // ✅ Split waves: short waves (SHORT duration) go to stories
      const allWaves = data || []
      shortWaves = allWaves.filter(w => w.duration_category === 'SHORT')
      const regularWaves = allWaves.filter(w => w.duration_category !== 'SHORT')

      // Add like status if user is logged in
      if (currentUser && allWaves.length > 0) {
        const waveIds = allWaves.map(w => w.id)
        const { data: likesData } = await supabase
          .from('likes')
          .select('wave_id')
          .eq('user_id', currentUser.id)
          .in('wave_id', waveIds)
        
        const likedWaveIds = new Set(likesData?.map(l => l.wave_id) || [])
        
        waves = regularWaves.map(wave => ({
          ...wave,
          isLiked: likedWaveIds.has(wave.id)
        }))
        
        // Update short waves with like status
        shortWaves = shortWaves.map(wave => ({
          ...wave,
          isLiked: likedWaveIds.has(wave.id)
        }))
      } else {
        waves = regularWaves
      }
      
      console.log('✅ Waves loaded:', waves.length, 'Short waves:', shortWaves.length)
      
    } catch (err) {
      console.error('❌ Error loading waves:', err)
      error = 'خطا در بارگذاری موج‌ها'
    } finally {
      loading = false
    }
  }

  // Handle category change
  function handleCategoryChange(category: string) {
    selectedCategory = category
    handleLoadWaves()
  }

  function handleWavePlay(waveId: string) {
    trackEvent({
      event_type: 'wave_play',
      event_data: { wave_id: waveId }
    })
  }

  // Reload waves when user changes
  $effect(() => {
    if (currentUser) {
      handleLoadWaves()
    }
  })

  // Initial load
  onMount(async () => {
    try {
      const { data: { user: supabaseUser } } = await supabase.auth.getUser()
      
      if (supabaseUser) {
        const { data: userData } = await supabase
          .from('users')
          .select('id, email, name, username, avatar, bio')
          .eq('id', supabaseUser.id)
          .maybeSingle()
        
        if (userData) {
          user.set({
            id: userData.id,
            email: userData.email,
            name: userData.name,
            username: userData.username,
            avatar: userData.avatar,
            bio: userData.bio || ''
          })
        }
      }
    } catch (err) {
      console.error('Error checking user:', err)
    }
    
    await handleLoadWaves()
  })
</script>

<div class="feed">
  <FeedHeader {currentUser} onSignOut={handleSignOut} />


  <!-- ✅ Short Waves as Stories (like Facebook) -->
  {#if shortWaves.length > 0}
    <div class="stories-section">
      <div class="stories-scroll">
        <!-- Create Story Button -->
        <div class="story-item create-story" onclick={() => goto('/wave/create')}>
          <div class="story-avatar create-avatar">
            <Avatar src={currentUser?.avatar} size="lg" />
            <div class="create-plus">+</div>
          </div>
          <span class="story-name">موج کوتاه</span>
        </div>

        <!-- Short Waves as Stories -->
        {#each shortWaves as wave (wave.id)}
          <div class="story-item" onclick={() => goto(`/wave/${wave.id}`)}>
            <div class="story-avatar" style="background: {wave.cover_image ? 'none' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'};">
              {#if wave.cover_image}
                <img src={wave.cover_image} alt={wave.title} class="story-cover" />
              {:else}
                <span class="story-emoji">🎵</span>
              {/if}
              <!-- Unread indicator -->
              <div class="story-ring"></div>
            </div>
            <span class="story-name">{wave.author?.name || 'ناشناس'}</span>
            <span class="story-duration">⏱️ {Math.floor(wave.duration)}s</span>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Category Filter -->
  <div class="category-filter">
    <div class="category-scroll">
      {#each categories as cat}
        <button
          class="category-btn {selectedCategory === cat.value ? 'active' : ''}"
          onclick={() => handleCategoryChange(cat.value)}
        >
          {cat.icon} {cat.label}
        </button>
      {/each}
    </div>
  </div>

  <!-- Boosted Waves Section -->
  {#if boostedWaves.length > 0 && showBoosted}
    <div class="boosted-section">
      <div class="boosted-header">
        <h3>🚀 موج‌های تقویت شده</h3>
        <button class="hide-boosted" onclick={() => showBoosted = false}>✖</button>
      </div>
      {#each boostedWaves as wave (wave.id)}
        <WaveCard 
          {wave} 
          currentUserId={currentUser?.id} 
          onLike={handleLike}
        />
      {/each}
    </div>
  {/if}

  {#if error}
    <div class="error-box">
      ❌ {error}
      <button class="retry-btn" onclick={handleLoadWaves}>تلاش مجدد</button>
    </div>
  {/if}

  {#if loading}
    <LoadingSpinner />
  {:else if waves.length === 0 && shortWaves.length === 0}
    <EmptyState {currentUser} />
  {:else}
    {#each waves as wave (wave.id)}
      <WaveCard 
        {wave} 
        currentUserId={currentUser?.id} 
        onLike={handleLike}
        on:play={() => handleWavePlay(wave.id)}
      />
    {/each}
  {/if}

  <!-- ✅ Floating Create Button (Bottom) -->
  <button class="fab-create" onclick={() => goto('/wave/create')}>
    <span class="fab-icon">🎙️</span>
    <span class="fab-text">موج جدید</span>
  </button>
</div>

<style>
  .feed {
    max-width: 600px;
    margin: 0 auto;
    padding: 16px;
    padding-bottom: 100px;
  }

  /* ✅ Stories Section - Like Facebook Stories */
  .stories-section {
    background: white;
    border-radius: 12px;
    padding: 12px 0;
    margin-bottom: 16px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    overflow: hidden;
  }

  .stories-scroll {
    display: flex;
    gap: 12px;
    padding: 0 16px;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
  }

  .stories-scroll::-webkit-scrollbar {
    display: none;
  }

  .story-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    min-width: 72px;
    cursor: pointer;
    transition: transform 0.2s;
    flex-shrink: 0;
  }

  .story-item:hover {
    transform: scale(1.05);
  }

  .story-avatar {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f0f2f5;
    overflow: hidden;
  }

  .story-cover {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .story-emoji {
    font-size: 28px;
  }

  .story-ring {
    position: absolute;
    inset: -3px;
    border-radius: 50%;
    border: 3px solid #1877f2;
    animation: ringPulse 2s infinite;
  }

  @keyframes ringPulse {
    0%, 100% { border-color: #1877f2; }
    50% { border-color: #6c5ce7; }
  }

  .story-item.create-story .story-ring {
    border-color: transparent;
  }

  .create-avatar {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    position: relative;
  }

  .create-plus {
    position: absolute;
    bottom: -2px;
    right: -2px;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: #1877f2;
    color: white;
    font-size: 16px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid white;
  }

  .story-name {
    font-size: 11px;
    color: #65676b;
    text-align: center;
    max-width: 64px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .story-duration {
    font-size: 9px;
    color: #8a8d91;
  }

  /* Error Box */
  .error-box {
    background: #fee;
    color: #dc3545;
    padding: 16px;
    border-radius: 8px;
    margin-bottom: 16px;
    text-align: center;
  }

  .retry-btn {
    margin-top: 8px;
    padding: 6px 16px;
    background: #dc3545;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
  }

  .retry-btn:hover {
    background: #c82333;
  }

  /* Category Filter */
  .category-filter {
    margin-bottom: 16px;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
  }

  .category-filter::-webkit-scrollbar {
    display: none;
  }

  .category-scroll {
    display: flex;
    gap: 8px;
    padding: 4px 0;
    white-space: nowrap;
  }

  .category-btn {
    padding: 8px 16px;
    border: 1px solid #d0d7de;
    border-radius: 20px;
    background: white;
    color: #65676b;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s;
    font-family: inherit;
    flex-shrink: 0;
  }

  .category-btn:hover {
    background: #f0f2f5;
    border-color: #1877f2;
  }

  .category-btn.active {
    background: #1877f2;
    color: white;
    border-color: #1877f2;
  }

  .category-btn.active:hover {
    background: #1664d8;
  }

  /* Boosted Section */
  .boosted-section {
    margin-bottom: 16px;
  }

  .boosted-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    border-radius: 8px;
    color: white;
    margin-bottom: 12px;
  }

  .boosted-header h3 {
    margin: 0;
    font-size: 16px;
  }

  .hide-boosted {
    background: none;
    border: none;
    color: white;
    cursor: pointer;
    font-size: 16px;
    padding: 4px 8px;
  }

  .hide-boosted:hover {
    background: rgba(255,255,255,0.2);
    border-radius: 4px;
  }

  /* ✅ Floating Create Button (Bottom Right) */
  .fab-create {
    position: fixed;
    bottom: 24px;
    right: 24px;
    display: flex;
    align-items: center;
    gap: 10px;
    background: linear-gradient(135deg, #1877f2 0%, #6c5ce7 100%);
    color: white;
    border: none;
    padding: 14px 24px;
    border-radius: 50px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 4px 16px rgba(24, 119, 242, 0.4);
    transition: all 0.3s ease;
    z-index: 100;
    font-family: inherit;
  }

  .fab-create:hover {
    transform: scale(1.05);
    box-shadow: 0 6px 24px rgba(24, 119, 242, 0.5);
  }

  .fab-create:active {
    transform: scale(0.95);
  }

  .fab-icon {
    font-size: 24px;
  }

  .fab-text {
    font-size: 15px;
  }

  /* Mobile Responsive */
  @media (max-width: 480px) {
    .fab-create {
      padding: 12px 18px;
      bottom: 16px;
      right: 16px;
    }

    .fab-text {
      font-size: 13px;
    }

    .fab-icon {
      font-size: 20px;
    }

    .story-item {
      min-width: 60px;
    }

    .story-avatar {
      width: 56px;
      height: 56px;
    }

    .story-name {
      font-size: 10px;
    }
  }
</style>