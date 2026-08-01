<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { supabase } from '$lib/client/supabase'
  import { user } from '$lib/stores/user'
  import Avatar from '$lib/components/ui/Avatar.svelte'
  import WaveCard from '$lib/components/waves/WaveCard.svelte'
  import LoadingSpinner from '$lib/components/ui/LoadingSpinner.svelte'

  let searchQuery = $state('')
  let searchType = $state('all') // 'all', 'waves', 'users'
  let results = $state<any[]>([])
  let loading = $state(false)
  let currentUser = $state<any>(null)
  let hasSearched = $state(false)
  let error = $state<string | null>(null)

  // Search types
  const searchTypes = [
    { value: 'all', label: 'همه' },
    { value: 'waves', label: 'موج‌ها' },
    { value: 'users', label: 'کاربران' }
  ]

  // Subscribe to user store
  $effect(() => {
    const unsubscribe = user.subscribe(value => {
      currentUser = value
    })
    return () => unsubscribe()
  })

  // ✅ Perform search
  async function performSearch() {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      error = 'لطفاً حداقل ۲ کاراکتر وارد کنید'
      return
    }

    loading = true
    hasSearched = true
    error = null
    results = []

    try {
      const query = searchQuery.trim()

      if (searchType === 'all' || searchType === 'waves') {
        // Search waves
        const { data: wavesData, error: wavesError } = await supabase
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
          .or(`title.ilike.%${query}%,category.ilike.%${query}%`)
          .order('created_at', { ascending: false })
          .limit(10)

        if (wavesError) throw wavesError

        // Add like status
        if (currentUser && wavesData) {
          const waveIds = wavesData.map(w => w.id)
          const { data: likesData } = await supabase
            .from('likes')
            .select('wave_id')
            .eq('user_id', currentUser.id)
            .in('wave_id', waveIds)
          
          const likedWaveIds = new Set(likesData?.map(l => l.wave_id) || [])
          
          results = wavesData.map(wave => ({
            ...wave,
            type: 'wave',
            isLiked: likedWaveIds.has(wave.id)
          }))
        } else {
          results = wavesData?.map(wave => ({
            ...wave,
            type: 'wave',
            isLiked: false
          })) || []
        }
      }

      if (searchType === 'all' || searchType === 'users') {
        // Search users
        const { data: usersData, error: usersError } = await supabase
          .from('users')
          .select('id, name, username, avatar, bio')
          .or(`name.ilike.%${query}%,username.ilike.%${query}%`)
          .limit(10)

        if (usersError) throw usersError

        // Add type and isFollowing status
        const usersWithType = usersData?.map(user => ({
          ...user,
          type: 'user',
          isFollowing: false // Will be checked later
        })) || []

        // Check if current user is following any of these users
        if (currentUser && usersWithType.length > 0) {
          const userIds = usersWithType.map(u => u.id)
          const { data: followsData } = await supabase
            .from('follows')
            .select('following_id')
            .eq('follower_id', currentUser.id)
            .in('following_id', userIds)
          
          const followingIds = new Set(followsData?.map(f => f.following_id) || [])
          
          usersWithType.forEach(user => {
            user.isFollowing = followingIds.has(user.id)
          })
        }

        // Merge results
        if (searchType === 'all') {
          results = [...results, ...usersWithType]
        } else {
          results = usersWithType
        }
      }

      // Sort results: waves first, then users
      results.sort((a, b) => {
        if (a.type === 'wave' && b.type === 'user') return -1
        if (a.type === 'user' && b.type === 'wave') return 1
        return 0
      })

    } catch (err) {
      console.error('Search error:', err)
      error = 'خطا در جستجو. لطفاً دوباره تلاش کنید.'
    } finally {
      loading = false
    }
  }

  // Follow user
  async function handleFollow(userId: string) {
    if (!currentUser) {
      goto('/auth/login')
      return
    }

    try {
      const userIndex = results.findIndex(r => r.id === userId && r.type === 'user')
      if (userIndex === -1) return

      const user = results[userIndex]

      if (user.isFollowing) {
        // Unfollow
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', currentUser.id)
          .eq('following_id', userId)

        if (error) throw error
        results[userIndex] = { ...user, isFollowing: false }
      } else {
        // Follow
        const { error } = await supabase
          .from('follows')
          .insert({
            follower_id: currentUser.id,
            following_id: userId
          })

        if (error) throw error
        results[userIndex] = { ...user, isFollowing: true }
      }
      
      results = [...results]

    } catch (err) {
      console.error('Error following:', err)
      alert('خطا در دنبال کردن. لطفاً دوباره تلاش کنید.')
    }
  }

  // Like wave (from search results)
  async function handleLike(waveId: string) {
    if (!currentUser) {
      goto('/auth/login')
      return
    }

    try {
      const waveIndex = results.findIndex(r => r.id === waveId && r.type === 'wave')
      if (waveIndex === -1) return

      const wave = results[waveIndex]
      
      if (wave.isLiked) {
        const { error } = await supabase
          .from('likes')
          .delete()
          .eq('user_id', currentUser.id)
          .eq('wave_id', waveId)

        if (error) throw error
        results[waveIndex] = { 
          ...wave, 
          isLiked: false, 
          likes_count: (wave.likes_count || 1) - 1 
        }
      } else {
        const { error } = await supabase
          .from('likes')
          .insert({
            user_id: currentUser.id,
            wave_id: waveId
          })

        if (error) throw error
        results[waveIndex] = { 
          ...wave, 
          isLiked: true, 
          likes_count: (wave.likes_count || 0) + 1 
        }
      }
      
      results = [...results]

    } catch (err) {
      console.error('Error liking:', err)
      alert('خطا در لایک کردن')
    }
  }

  // Handle Enter key
  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      performSearch()
    }
  }

  // Clear search
  function clearSearch() {
    searchQuery = ''
    results = []
    hasSearched = false
    error = null
  }
</script>

<div class="search-page">
  <div class="search-container">
    <!-- Header -->
    <div class="header">
      <button class="back-btn" onclick={() => history.back()}>← بازگشت</button>
      <h1>🔍 جستجو</h1>
    </div>

    <!-- Search Input -->
    <div class="search-box">
      <span class="search-icon">🔍</span>
      <input
        type="text"
        class="search-input"
        placeholder="جستجوی موج‌ها، کاربران، دسته‌بندی..."
        bind:value={searchQuery}
        onkeydown={handleKeyDown}
      />
      {#if searchQuery}
        <button class="clear-btn" onclick={clearSearch}>✖</button>
      {/if}
      <button class="search-btn" onclick={performSearch} disabled={loading}>
        {#if loading}⏳{:else}جستجو{/if}
      </button>
    </div>

    <!-- Search Type Tabs -->
    <div class="search-tabs">
      {#each searchTypes as type}
        <button
          class="tab {searchType === type.value ? 'active' : ''}"
          onclick={() => { searchType = type.value; if (hasSearched) performSearch(); }}
        >
          {type.label}
        </button>
      {/each}
    </div>

    <!-- Results -->
    {#if error}
      <div class="error-box">❌ {error}</div>
    {/if}

    {#if loading}
      <LoadingSpinner />
    {:else if hasSearched && results.length === 0}
      <div class="empty">
        <div class="empty-icon">🔍</div>
        <h3>نتیجه‌ای یافت نشد</h3>
        <p>سعی کنید با کلمات دیگر جستجو کنید</p>
      </div>
    {:else if results.length > 0}
      <div class="results">
        {#each results as item (item.id)}
          {#if item.type === 'wave'}
            <!-- Wave Result -->
            <div class="result-item wave-item">
              <WaveCard 
                wave={item} 
                currentUserId={currentUser?.id} 
                onLike={handleLike}
              />
            </div>
          {:else if item.type === 'user'}
            <!-- User Result -->
            <div class="result-item user-item">
              <div class="user-info" onclick={() => goto(`/profile/${item.username}`)}>
                <Avatar src={item.avatar} size="md" />
                <div>
                  <div class="user-name">{item.name}</div>
                  <div class="user-username">@{item.username}</div>
                  {#if item.bio}
                    <div class="user-bio">{item.bio}</div>
                  {/if}
                </div>
              </div>
              {#if currentUser && currentUser.id !== item.id}
                <button 
                  class="follow-btn {item.isFollowing ? 'following' : ''}"
                  onclick={() => handleFollow(item.id)}
                >
                  {item.isFollowing ? '✅ دنبال می‌کنید' : '➕ دنبال کردن'}
                </button>
              {/if}
            </div>
          {/if}
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .search-page {
    min-height: 100vh;
    background: #f0f2f5;
    padding: 16px;
  }

  .search-container {
    max-width: 600px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .header {
    display: flex;
    align-items: center;
    gap: 16px;
    background: white;
    padding: 16px;
    border-radius: 12px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
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

  .search-box {
    display: flex;
    align-items: center;
    gap: 12px;
    background: white;
    padding: 8px 16px;
    border-radius: 12px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }

  .search-icon {
    font-size: 20px;
  }

  .search-input {
    flex: 1;
    border: none;
    padding: 8px 0;
    font-size: 16px;
    outline: none;
    font-family: inherit;
  }

  .clear-btn {
    background: none;
    border: none;
    color: #65676b;
    cursor: pointer;
    font-size: 16px;
    padding: 4px 8px;
  }

  .clear-btn:hover {
    color: #dc3545;
  }

  .search-btn {
    background: #1877f2;
    color: white;
    border: none;
    padding: 8px 20px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .search-btn:hover:not(:disabled) {
    background: #1664d8;
  }

  .search-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .search-tabs {
    display: flex;
    gap: 8px;
    background: white;
    padding: 8px;
    border-radius: 12px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }

  .tab {
    flex: 1;
    padding: 8px;
    border: none;
    border-radius: 8px;
    background: transparent;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    font-family: inherit;
  }

  .tab:hover {
    background: #f0f2f5;
  }

  .tab.active {
    background: #1877f2;
    color: white;
  }

  .error-box {
    background: #fee;
    color: #dc3545;
    padding: 16px;
    border-radius: 8px;
    text-align: center;
  }

  .empty {
    text-align: center;
    padding: 60px 20px;
    background: white;
    border-radius: 12px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }

  .empty-icon {
    font-size: 48px;
    margin-bottom: 16px;
  }

  .empty h3 {
    margin: 0 0 8px 0;
    color: #050505;
  }

  .empty p {
    color: #65676b;
    margin: 0;
  }

  .results {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .result-item {
    background: white;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }

  .user-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px;
  }

  .user-info {
    display: flex;
    align-items: center;
    gap: 12px;
    cursor: pointer;
    flex: 1;
  }

  .user-info:hover .user-name {
    color: #1877f2;
  }

  .user-name {
    font-weight: 600;
    color: #050505;
  }

  .user-username {
    font-size: 13px;
    color: #65676b;
  }

  .user-bio {
    font-size: 13px;
    color: #65676b;
    margin-top: 4px;
  }

  .follow-btn {
    padding: 6px 16px;
    border: none;
    border-radius: 6px;
    background: #1877f2;
    color: white;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s;
    font-family: inherit;
    white-space: nowrap;
  }

  .follow-btn:hover:not(:disabled) {
    background: #1664d8;
  }

  .follow-btn.following {
    background: #e4e6eb;
    color: #050505;
  }

  .follow-btn.following:hover:not(:disabled) {
    background: #dc3545;
    color: white;
  }
</style>