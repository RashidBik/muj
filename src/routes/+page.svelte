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
  import { getWaveRoute } from '$lib/utils/wave-helpers'

  // Icon imports
  import {
    Home,
    Compass,
    Bell,
    User,
    Plus,
    Mic,
    Clock,
    Flame,
    X,
    RefreshCw,
    Filter,
    Layers,
    TrendingUp,
    Radio,
    Music,
    BookOpen,
    Newspaper,
    Sparkles,
    Play,
    Headphones,
    Zap
  } from 'lucide-svelte'

  let waves = $state<any[]>([])
  let shortWaves = $state<any[]>([])
  let loading = $state(true)
  let currentUser = $state<any>(null)
  let error = $state<string | null>(null)
  let isLiking = $state<Set<string>>(new Set())
  let boostedWaves = $state<any[]>([])
  let showBoosted = $state(true)

  const categories = [
    { value: 'ALL', label: 'همه', icon: Layers },
    { value: 'NEWS', label: 'اخبار', icon: Newspaper },
    { value: 'EDUCATION', label: 'آموزش', icon: BookOpen },
    { value: 'MUSIC', label: 'موسیقی', icon: Music },
    { value: 'AUDIOBOOK', label: 'کتاب صوتی', icon: Headphones },
    { value: 'STORY', label: 'داستان', icon: Sparkles },
    { value: 'FREE', label: 'آزاد', icon: Radio }
  ]
  let selectedCategory = $state('ALL')

  $effect(() => {
    const unsubscribe = user.subscribe(value => {
      currentUser = value
    })
    return () => unsubscribe()
  })

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

  async function handleSignOut() {
    try {
      await signOut()
      user.set(null)
      goto('/auth/login')
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  async function loadBoostedWaves() {
    try {
      boostedWaves = await getBoostedWaves()
    } catch (error) {
      console.error('Error loading boosted waves:', error)
    }
  }

  async function handleLoadWaves() {
  loading = true
  error = null

  try {
    await loadBoostedWaves()

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

    const allWaves = data || []
    
    // ✅ دریافت ریکشن‌ها
    if (allWaves.length > 0) {
      const waveIds = allWaves.map(w => w.id)
      
      // دریافت همه ریکشن‌ها
      const { data: reactionsData } = await supabase
        .from('reactions')
        .select('wave_id, emoji, user_id')
        .in('wave_id', waveIds)

      console.log('📊 Reactions data:', reactionsData) // برای دیباگ

      // دریافت لایک‌ها
      const { data: likesData } = currentUser 
        ? await supabase
            .from('likes')
            .select('wave_id')
            .eq('user_id', currentUser.id)
            .in('wave_id', waveIds)
        : { data: [] }

      const likedWaveIds = new Set(likesData?.map(l => l.wave_id) || [])
      
      // ✅ گروه‌بندی ریکشن‌ها
      const reactionsMap: Record<string, any[]> = {}
      const userReactionsMap: Record<string, string> = {}
      
      reactionsData?.forEach(r => {
        // گروه‌بندی بر اساس موج
        if (!reactionsMap[r.wave_id]) reactionsMap[r.wave_id] = []
        const existing = reactionsMap[r.wave_id].find(s => s.emoji === r.emoji)
        if (existing) {
          existing.count++
        } else {
          reactionsMap[r.wave_id].push({ emoji: r.emoji, count: 1 })
        }
        
        // ریکشن کاربر فعلی
        if (currentUser && r.user_id === currentUser.id) {
          userReactionsMap[r.wave_id] = r.emoji
        }
      })

      console.log('📊 Reactions map:', reactionsMap) // برای دیباگ
      console.log('📊 User reactions map:', userReactionsMap) // برای دیباگ

      // ✅ تفکیک موج‌های کوتاه و معمولی
      shortWaves = allWaves.filter(w => w.duration < 30)
      const regularWaves = allWaves.filter(w => w.duration >= 30)
  
  waves = regularWaves.map(wave => ({
  ...wave,
  isLiked: likedWaveIds.has(wave.id),
  reactions: reactionsMap[wave.id] || [],
  userReaction: userReactionsMap[wave.id] || null
}))

      shortWaves = shortWaves.map(wave => ({
        ...wave,
        isLiked: likedWaveIds.has(wave.id),
        reactions: reactionsMap[wave.id] || [],
        userReaction: userReactionsMap[wave.id] || null
      }))

      console.log('✅ Waves with reactions:', waves.length)
      console.log('✅ Short waves with reactions:', shortWaves.length)

    } else {
      waves = []
      shortWaves = []
    }

  } catch (err) {
    console.error('❌ Error loading waves:', err)
    error = 'خطا در بارگذاری موج‌ها'
  } finally {
    loading = false
  }
}

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

  $effect(() => {
    if (currentUser) {
      handleLoadWaves()
    }
  })

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

  function handleWaveClick(waveId: string, duration: number) {
      const route = getWaveRoute(waveId, duration)
      goto(route)
    }
</script>

<div class="feed">
  <FeedHeader {currentUser} onSignOut={handleSignOut} />

  <!-- Stories Section -->
  {#if shortWaves.length > 0}
    <div class="stories-section">
      <div class="stories-header">
        <div class="stories-title">
          <Zap size={18} />
          <span>موج‌های کوتاه</span>
        </div>
        <span class="stories-count">{shortWaves.length} مورد</span>
      </div>

      <div class="stories-scroll">
        <!-- Create Story Button - goes to create page -->
        <div class="story-item create-story" onclick={() => goto('/wave/create')}>
          <div class="story-avatar create-avatar">
            <Avatar src={currentUser?.avatar} size="lg" />
            <div class="create-plus">
              <Plus size={14} />
            </div>
          </div>
          <span class="story-name">موج جدید</span>
        </div>

        <!-- Short Waves as Stories -->
        {#each shortWaves as wave (wave.id)}
          <div class="story-item" onclick={() => handleWaveClick(wave.id, wave.duration)}>
            <div class="story-avatar" style="background: {wave.cover_image ? 'none' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'};">
              {#if wave.cover_image}
                <img src={wave.cover_image} alt={wave.title} class="story-cover" />
              {:else}
                <Mic size={28} color="white" />
              {/if}
              <div class="story-ring"></div>
            </div>
            <span class="story-name">{wave.author?.name || 'ناشناس'}</span>
            <span class="story-duration">
              <Clock size={10} />
              {Math.floor(wave.duration)}s
            </span>
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
          <cat.icon size={16} />
          {cat.label}
        </button>
      {/each}
    </div>
  </div>

  <!-- Boosted Waves Section -->
  {#if boostedWaves.length > 0 && showBoosted}
    <div class="boosted-section">
      <div class="boosted-header">
        <div class="boosted-title">
          <Flame size={18} />
          <h3>موج‌های داغ</h3>
        </div>
        <button class="hide-boosted" onclick={() => showBoosted = false}>
          <X size={16} />
        </button>
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
      <div class="error-content">
        <AlertCircle size={20} />
        <span>{error}</span>
      </div>
      <button class="retry-btn" onclick={handleLoadWaves}>
        <RefreshCw size={16} />
        تلاش مجدد
      </button>
    </div>
  {/if}

  {#if loading}
    <LoadingSpinner />
  {:else if waves.length === 0 && shortWaves.length === 0}
    <EmptyState {currentUser} />
  {:else}
    <!-- In your feed page where you render WaveCard -->
    {#each waves as wave (wave.id)}
      <WaveCard 
        wave={wave} 
        currentUserId={currentUser?.id} 
        onLike={handleLike}
        on:play={() => handleWavePlay(wave.id)}
      />
    {/each}
  {/if}

  <!-- Floating Action Button -->
  <button class="fab-create" onclick={() => goto('/wave/create')}>
    <Mic size={22} />
    <span class="fab-text">موج جدید</span>
  </button>
</div>

<style>
  .feed {
    max-width: 640px;
    margin: 0 auto;
    padding: 16px;
    padding-bottom: 100px;
  }

  /* Stories Section */
  .stories-section {
    background: white;
    border-radius: 16px;
    padding: 16px 0 12px;
    margin-bottom: 16px;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
    border: 1px solid #f0f2f5;
  }

  .stories-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 16px 12px;
  }

  .stories-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 15px;
    font-weight: 600;
    color: #1a1a2e;
  }

  .stories-title :global(svg) {
    color: #6366f1;
  }

  .stories-count {
    font-size: 12px;
    color: #94a3b8;
    background: #f1f5f9;
    padding: 2px 10px;
    border-radius: 12px;
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
    transition: all 0.2s ease;
    flex-shrink: 0;
  }

  .story-item:hover {
    transform: translateY(-4px);
  }

  .story-avatar {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f1f5f9;
    overflow: hidden;
    flex-shrink: 0;
  }

  .story-cover {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .story-ring {
    position: absolute;
    inset: -3px;
    border-radius: 50%;
    border: 3px solid #6366f1;
    animation: ringPulse 2s ease-in-out infinite;
  }

  @keyframes ringPulse {
    0%, 100% {
      border-color: #6366f1;
      transform: scale(1);
    }
    50% {
      border-color: #8b5cf6;
      transform: scale(1.05);
    }
  }

  .story-item.create-story .story-ring {
    border-color: transparent;
    animation: none;
  }

  .create-avatar {
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    position: relative;
  }

  .create-plus {
    position: absolute;
    bottom: -2px;
    right: -2px;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: #6366f1;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid white;
  }

  .story-name {
    font-size: 11px;
    color: #475569;
    text-align: center;
    max-width: 64px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 500;
  }

  .story-duration {
    display: flex;
    align-items: center;
    gap: 3px;
    font-size: 10px;
    color: #94a3b8;
  }

  .story-duration :global(svg) {
    color: #94a3b8;
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
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border: 1.5px solid #e2e8f0;
    border-radius: 24px;
    background: white;
    color: #64748b;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    font-family: inherit;
    flex-shrink: 0;
  }

  .category-btn :global(svg) {
    color: #94a3b8;
    transition: color 0.2s ease;
  }

  .category-btn:hover {
    background: #f8fafc;
    border-color: #6366f1;
    transform: translateY(-1px);
  }

  .category-btn.active {
    background: #6366f1;
    color: white;
    border-color: #6366f1;
    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
  }

  .category-btn.active :global(svg) {
    color: white;
  }

  .category-btn.active:hover {
    background: #4f46e5;
  }

  /* Boosted Section */
  .boosted-section {
    margin-bottom: 16px;
  }

  .boosted-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 16px;
    background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
    border-radius: 12px;
    margin-bottom: 12px;
  }

  .boosted-title {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .boosted-title :global(svg) {
    color: #f59e0b;
  }

  .boosted-title h3 {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    color: #92400e;
  }

  .hide-boosted {
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    color: #92400e;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 6px;
    transition: all 0.2s ease;
  }

  .hide-boosted:hover {
    background: rgba(0, 0, 0, 0.05);
  }

  /* Error Box */
  .error-box {
    background: #fef2f2;
    border: 1px solid #fecaca;
    color: #dc2626;
    padding: 16px 20px;
    border-radius: 12px;
    margin-bottom: 16px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .error-content {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .error-content :global(svg) {
    flex-shrink: 0;
  }

  .retry-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 20px;
    background: #dc2626;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .retry-btn:hover {
    background: #b91c1c;
    transform: scale(1.02);
  }

  /* Floating Action Button */
  .fab-create {
    position: fixed;
    bottom: 24px;
    right: 24px;
    display: flex;
    align-items: center;
    gap: 10px;
    background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
    color: white;
    border: none;
    padding: 14px 24px;
    border-radius: 50px;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 4px 20px rgba(99, 102, 241, 0.4);
    transition: all 0.3s ease;
    z-index: 100;
    font-family: inherit;
  }

  .fab-create :global(svg) {
    color: white;
  }

  .fab-create:hover {
    transform: translateY(-3px) scale(1.02);
    box-shadow: 0 8px 32px rgba(99, 102, 241, 0.5);
  }

  .fab-create:active {
    transform: scale(0.95);
  }

  .fab-text {
    font-size: 14px;
  }

  /* Mobile Responsive */
  @media (max-width: 640px) {
    .feed {
      padding: 12px;
      padding-bottom: 80px;
    }

    .fab-create {
      padding: 12px 18px;
      bottom: 16px;
      right: 16px;
    }

    .fab-text {
      font-size: 13px;
    }

    .fab-create :global(svg) {
      width: 20px;
      height: 20px;
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

    .category-btn {
      font-size: 12px;
      padding: 6px 14px;
    }

    .category-btn :global(svg) {
      width: 14px;
      height: 14px;
    }
  }

  @media (max-width: 380px) {
    .story-item {
      min-width: 52px;
    }

    .story-avatar {
      width: 48px;
      height: 48px;
    }

    .create-plus {
      width: 20px;
      height: 20px;
    }

    .create-plus :global(svg) {
      width: 12px;
      height: 12px;
    }
  }
</style>