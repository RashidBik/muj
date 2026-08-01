<script lang="ts">
  import { onMount } from 'svelte'
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'
  import { supabase } from '$lib/client/supabase'
  import { user } from '$lib/stores/user'
  import Avatar from '$lib/components/ui/Avatar.svelte'
  import WaveCard from '$lib/components/waves/WaveCard.svelte'
  import TokenBalance from '$lib/components/token/TokenBalance.svelte'
  import { 
    getProfile, 
    getUserWaves, 
    followUser, 
    unfollowUser 
  } from '$lib/services/profile-service'
  import { 
    getUserStats, 
    getUserActivity, 
    getUserAchievements,
    getUserRank 
  } from '$lib/services/user-analytics-service'
  import type { Profile } from '$lib/services/profile-service'
  import { formatDistanceToNow } from 'date-fns'
  import { faIR } from 'date-fns/locale'
  import { format } from 'date-fns'
    import DailyReward from '$lib/components/gaming/DailyReward.svelte'


  let profile = $state<Profile | null>(null)
  let waves = $state<any[]>([])
  let loading = $state(true)
  let loadingWaves = $state(true)
  let currentUser = $state<any>(null)
  // let { onSignOut }: {onSignOut: () => void } = $props()
  let isFollowing = $state(false)
  let isTogglingFollow = $state(false)
  let username = $state<string | null>(null)
  let errorMessage = $state<string | null>(null)
  
  // ✅ Analytics state
  let activeTab = $state('waves') // 'waves', 'analytics'
  let stats = $state<any>(null)
  let activity = $state<any[]>([])
  let achievements = $state<any[]>([])
  let rank = $state(0)
  let loadingAnalytics = $state(false)

  // Subscribe to user store
  $effect(() => {
    const unsubscribe = user.subscribe(value => {
      currentUser = value
    })
    return () => unsubscribe()
  })

  async function loadProfile() {
    loading = true
    errorMessage = null
    
    try {
      username = $page.params.username
      
      if (!username) {
        errorMessage = 'نام کاربری معتبر نیست'
        loading = false
        return
      }

      const profileData = await getProfile(username, currentUser?.id)
      
      if (!profileData) {
        errorMessage = 'کاربری با این نام کاربری یافت نشد'
        loading = false
        setTimeout(() => goto('/'), 2000)
        return
      }

      profile = profileData
      isFollowing = profileData.is_following || false
      
      await loadUserWaves(profileData.id)
      
      // ✅ Load analytics if this is the current user's profile
      if (currentUser && currentUser.id === profileData.id) {
        await loadAnalytics(profileData.id)
      }
      
    } catch (error) {
      console.error('Error loading profile:', error)
      errorMessage = 'خطا در بارگذاری پروفایل'
    } finally {
      loading = false
    }
  }

  async function loadUserWaves(userId: string) {
    loadingWaves = true
    try {
      const userWaves = await getUserWaves(userId)
      waves = userWaves
    } catch (error) {
      console.error('Error loading user waves:', error)
    } finally {
      loadingWaves = false
    }
  }

  // ✅ Load analytics data
  async function loadAnalytics(userId: string) {
    loadingAnalytics = true
    try {
      const [statsData, activityData, achievementsData, rankData] = await Promise.all([
        getUserStats(userId),
        getUserActivity(userId),
        getUserAchievements(userId),
        getUserRank(userId)
      ])

      stats = statsData
      activity = activityData
      achievements = achievementsData
      rank = rankData
      
    } catch (error) {
      console.error('Error loading analytics:', error)
    } finally {
      loadingAnalytics = false
    }
  }

  async function toggleFollow() {
    if (!currentUser) {
      goto('/auth/login')
      return
    }

    if (isTogglingFollow || !profile) return
    isTogglingFollow = true

    try {
      if (isFollowing) {
        await unfollowUser(currentUser.id, profile.id)
        isFollowing = false
        if (profile) {
          profile.followers_count = (profile.followers_count || 1) - 1
        }
      } else {
        await followUser(currentUser.id, profile.id)
        isFollowing = true
        if (profile) {
          profile.followers_count = (profile.followers_count || 0) + 1
        }
      }
    } catch (error) {
      console.error('Error toggling follow:', error)
      alert('خطا در عملیات. لطفاً دوباره تلاش کنید.')
    } finally {
      isTogglingFollow = false
    }
  }

  function formatTime(date: string): string {
    try {
      return formatDistanceToNow(new Date(date), { 
        addSuffix: true,
        locale: faIR
      })
    } catch {
      return 'چندی پیش'
    }
  }

  function formatNumber(num: number): string {
    return num.toLocaleString('fa-IR')
  }

  function getMaxActivity() {
    if (!activity || activity.length === 0) return 1
    const max = Math.max(
      ...activity.map(d => Math.max(d.waves, d.likes, d.comments, d.plays))
    )
    return max || 1
  }



    function goToWallet() {
    goto('/wallet')
  }
  // Check if viewing own profile
  const isOwnProfile = $derived(currentUser && profile && currentUser.id === profile.id)

  // Reload when user changes or route changes
  $effect(() => {
    if (currentUser) {
      loadProfile()
    }
  })
</script>

<div class="profile-page">
  {#if loading}
    <div class="loading">
      <div class="spinner"></div>
      <p>⏳ در حال بارگذاری پروفایل...</p>
    </div>
  {:else if errorMessage}
    <div class="error-card">
      <div class="error-icon">❌</div>
      <h3>{errorMessage}</h3>
      <button class="back-home-btn" onclick={() => goto('/')}>بازگشت به خانه</button>
    </div>
  {:else if profile}
    <!-- Profile header -->
    <div class="profile-header">
      <button class="back-btn" onclick={() => history.back()}>← بازگشت</button>
    </div>

    <!-- Profile info -->
    <div class="profile-card">
      <div class="profile-avatar">
        <Avatar src={profile.avatar} size="xl" />
      </div>

      <div class="profile-info">
        <h1 class="profile-name">{profile.name} | {formatTime(profile.created_at)}</h1>
        <div class="profile-username">@{profile.username}</div>
        
        {#if profile.bio}
          <p class="profile-bio">{profile.bio}</p>
        {/if}

        <div class="profile-stats">
          <div class="stat">
            <span class="stat-number">{profile.waves_count || 0}</span>
            <span class="stat-label">موج</span>
          </div>
          <div class="stat">
            <span class="stat-number">{profile.followers_count || 0}</span>
            <span class="stat-label">دنبال‌کننده</span>
          </div>
          <div class="stat">
            <span class="stat-number">{profile.following_count || 0}</span>
            <span class="stat-label">دنبال‌شونده</span>
          </div>
        </div>

        <div class="profile-actions">
          {#if currentUser && currentUser.id !== profile.id}
            <button 
              class="follow-btn {isFollowing ? 'following' : ''}"
              onclick={toggleFollow}
              disabled={isTogglingFollow}
            >
              {isFollowing ? '✅ دنبال می‌کنید' : '➕ دنبال کردن'}
            </button>
          {:else if currentUser && currentUser.id === profile.id}
            <button class="edit-btn" onclick={() => goto('/profile/edit')}>
              ✏️ ویرایش پروفایل
            </button>
            <button class="edit-btn" onclick={goToWallet}>
                <TokenBalance />
            </button>
            <button class="referral-btn" onclick={() => goto('/referral')}>
              👥 دعوت دوستان
            </button>
          {/if}
        </div>

      </div>
    </div>
  <DailyReward />
    <!-- ✅ Tabs -->
    {#if isOwnProfile}
      <div class="profile-tabs">
        <button 
          class="tab {activeTab === 'waves' ? 'active' : ''}"
          onclick={() => activeTab = 'waves'}
        >
          📋 موج‌ها
        </button>
        <button 
          class="tab {activeTab === 'analytics' ? 'active' : ''}"
          onclick={() => activeTab = 'analytics'}
        >
          📊 آمار من
        </button>
      </div>
    {/if}

    <!-- Tab Content -->
    {#if activeTab === 'waves' || !isOwnProfile}
      <!-- User's waves -->
      <div class="user-waves">
        <h2 class="section-title">📋 موج‌های منتشرشده</h2>
        
        {#if loadingWaves}
          <div class="loading-waves">⏳ در حال بارگذاری موج‌ها...</div>
        {:else if waves.length === 0}
          <div class="empty-waves">
            <p>هیچ موجی منتشر نشده است 🌊</p>
          </div>
        {:else}
          <div class="waves-grid">
            {#each waves as wave (wave.id)}
              <WaveCard 
                wave={wave} 
                currentUserId={currentUser?.id} 
                onLike={() => {}} 
              />
            {/each}
          </div>
        {/if}
      </div>
    {:else if activeTab === 'analytics' && isOwnProfile}
      <!-- Analytics Section -->
      <div class="analytics-section">
        {#if loadingAnalytics}
          <div class="loading-analytics">⏳ در حال بارگذاری آمار...</div>
        {:else if stats}
          <!-- Rank Badge -->
          <div class="rank-badge">
            <span class="rank-icon">🏆</span>
            <div class="rank-info">
              <div class="rank-number">#{rank}</div>
              <div class="rank-label">رتبه شما در بین همه کاربران</div>
            </div>
            <div class="rank-progress">
              <div 
                class="rank-progress-bar" 
                style="width: {Math.min(100, (1 / (rank || 1)) * 100)}%"
              ></div>
            </div>
          </div>

          <!-- Stats Grid -->
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-icon">🎵</div>
              <div class="stat-number">{formatNumber(stats.total_waves)}</div>
              <div class="stat-label">موج‌های منتشر شده</div>
            </div>
            <div class="stat-card">
              <div class="stat-icon">❤️</div>
              <div class="stat-number">{formatNumber(stats.total_likes)}</div>
              <div class="stat-label">لایک دریافت شده</div>
            </div>
            <div class="stat-card">
              <div class="stat-icon">💬</div>
              <div class="stat-number">{formatNumber(stats.total_comments)}</div>
              <div class="stat-label">نظر داده شده</div>
            </div>
            <div class="stat-card">
              <div class="stat-icon">👥</div>
              <div class="stat-number">{formatNumber(stats.total_followers)}</div>
              <div class="stat-label">دنبال‌کننده</div>
            </div>
            <div class="stat-card">
              <div class="stat-icon">👤</div>
              <div class="stat-number">{formatNumber(stats.total_following)}</div>
              <div class="stat-label">دنبال‌شونده</div>
            </div>
            <div class="stat-card">
              <div class="stat-icon">👥</div>
              <div class="stat-number">{formatNumber(stats.total_referrals)}</div>
              <div class="stat-label">دعوت‌ها</div>
            </div>
            <div class="stat-card highlight">
              <div class="stat-icon">💰</div>
              <div class="stat-number">{formatNumber(stats.total_tokens)}</div>
              <div class="stat-label">توکن‌ها</div>
            </div>
            <div class="stat-card">
              <div class="stat-icon">🎯</div>
              <div class="stat-number">{formatNumber(stats.engagement_score)}</div>
              <div class="stat-label">امتیاز تعامل</div>
            </div>
            <div class="stat-card">
              <div class="stat-icon">🔥</div>
              <div class="stat-number">{formatNumber(stats.streak_days)}</div>
              <div class="stat-label">روزهای متوالی</div>
            </div>
            <div class="stat-card">
              <div class="stat-icon">🎧</div>
              <div class="stat-number">{formatNumber(stats.waves_played)}</div>
              <div class="stat-label">موج‌های گوش داده</div>
            </div>
          </div>

          <!-- Activity Chart -->
          <div class="activity-section">
            <h3>📈 فعالیت ۷ روز اخیر</h3>
            <div class="activity-chart">
              {#each activity as day (day.date)}
                <div class="activity-column">
                  <div class="activity-bars">
                    <div class="bar-wrapper">
                      <div 
                        class="bar bar-waves" 
                        style="height: {(day.waves / getMaxActivity()) * 100}%"
                        title="موج: {day.waves}"
                      ></div>
                      <span class="bar-label">موج</span>
                    </div>
                    <div class="bar-wrapper">
                      <div 
                        class="bar bar-likes" 
                        style="height: {(day.likes / getMaxActivity()) * 100}%"
                        title="لایک: {day.likes}"
                      ></div>
                      <span class="bar-label">لایک</span>
                    </div>
                    <div class="bar-wrapper">
                      <div 
                        class="bar bar-comments" 
                        style="height: {(day.comments / getMaxActivity()) * 100}%"
                        title="نظر: {day.comments}"
                      ></div>
                      <span class="bar-label">نظر</span>
                    </div>
                    <div class="bar-wrapper">
                      <div 
                        class="bar bar-plays" 
                        style="height: {(day.plays / getMaxActivity()) * 100}%"
                        title="پخش: {day.plays}"
                      ></div>
                      <span class="bar-label">پخش</span>
                    </div>
                  </div>
                  <div class="activity-date">
                    {format(new Date(day.date), 'EEE', { locale: faIR })}
                  </div>
                </div>
              {/each}
            </div>
          </div>

          <!-- Achievements -->
          <div class="achievements-section">
            <h3>🏅 دستاوردها</h3>
            <div class="achievements-grid">
              {#each achievements as achievement (achievement.id)}
                <div class="achievement-card {achievement.unlocked ? 'unlocked' : 'locked'}">
                  <div class="achievement-icon">{achievement.icon}</div>
                  <div class="achievement-info">
                    <div class="achievement-name">{achievement.name}</div>
                    <div class="achievement-description">{achievement.description}</div>
                  </div>
                  <div class="achievement-status">
                    {#if achievement.unlocked}
                      ✅
                    {:else}
                      🔒
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    {/if}
  {/if}
</div>

<style>
  .profile-page {
    max-width: 600px;
    margin: 0 auto;
    padding: 16px;
    padding-bottom: 80px;
  }

  .profile-header {
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

  .loading {
    text-align: center;
    padding: 60px 20px;
    color: #65676b;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 4px solid #e4e6eb;
    border-top-color: #1877f2;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin: 0 auto 16px;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .error-card {
    text-align: center;
    padding: 60px 20px;
    background: white;
    border-radius: 12px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }

  .error-icon {
    font-size: 48px;
    margin-bottom: 16px;
  }

  .error-card h3 {
    margin: 0 0 16px 0;
    color: #050505;
  }

  .back-home-btn {
    background: #1877f2;
    color: white;
    border: none;
    padding: 10px 24px;
    border-radius: 8px;
    font-size: 16px;
    cursor: pointer;
  }

  .back-home-btn:hover {
    background: #1664d8;
  }

  .profile-card {
    background: white;
    border-radius: 12px;
    padding: 24px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    text-align: center;
    margin-bottom: 16px;
  }

  .profile-avatar {
    display: flex;
    justify-content: center;
    margin-bottom: 16px;
  }

  .profile-name {
    margin: 0 0 4px 0;
    font-size: 24px;
    color: #050505;
  }

  .profile-username {
    font-size: 16px;
    color: #65676b;
    margin-bottom: 12px;
  }

  .profile-bio {
    font-size: 15px;
    color: #050505;
    margin: 0 0 16px 0;
    padding: 12px;
    background: #f7f8fa;
    border-radius: 8px;
  }

  .profile-stats {
    display: flex;
    justify-content: center;
    gap: 32px;
    padding: 16px 0;
    border-top: 1px solid #e4e6eb;
    border-bottom: 1px solid #e4e6eb;
    margin-bottom: 16px;
  }

  .stat {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .stat-number {
    font-size: 20px;
    font-weight: 700;
    color: #050505;
  }

  .stat-label {
    font-size: 13px;
    color: #65676b;
  }

  .profile-actions {
    display: flex;
    gap: 12px;
    justify-content: center;
    flex-wrap: wrap;
    margin-bottom: 12px;
  }

  .follow-btn {
    padding: 10px 32px;
    border: none;
    border-radius: 8px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    background: #1877f2;
    color: white;
  }

  .follow-btn:hover:not(:disabled) {
    background: #1664d8;
    transform: scale(1.05);
  }

  .follow-btn.following {
    background: #e4e6eb;
    color: #050505;
  }

  .follow-btn.following:hover:not(:disabled) {
    background: #dc3545;
    color: white;
  }

  .follow-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .edit-btn {
    padding: 10px 24px;
    border: 1px solid #d0d7de;
    border-radius: 8px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    background: white;
    color: #050505;
  }

  .edit-btn:hover {
    background: #f0f2f5;
  }

  .referral-btn {
    padding: 10px 24px;
    border: 1px solid #10b981;
    border-radius: 8px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    background: white;
    color: #10b981;
  }

  .referral-btn:hover {
    background: #10b981;
    color: white;
  }

  .profile-joined {
    font-size: 13px;
    color: #65676b;
  }

  /* ✅ Tabs */
  .profile-tabs {
    display: flex;
    gap: 8px;
    background: white;
    padding: 8px;
    border-radius: 12px;
    margin-bottom: 16px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }

  .tab {
    flex: 1;
    padding: 10px;
    border: none;
    border-radius: 8px;
    background: transparent;
    font-size: 14px;
    font-weight: 600;
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

  .user-waves {
    margin-top: 16px;
  }

  .section-title {
    font-size: 18px;
    margin: 0 0 16px 0;
    color: #050505;
  }

  .loading-waves, .empty-waves {
    text-align: center;
    padding: 40px 20px;
    background: white;
    border-radius: 12px;
    color: #65676b;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }

  .waves-grid {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  /* ✅ Analytics Styles */
  .analytics-section {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .loading-analytics {
    text-align: center;
    padding: 40px;
    background: white;
    border-radius: 12px;
    color: #65676b;
  }

  .rank-badge {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 20px;
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
  }

  .rank-icon {
    font-size: 32px;
  }

  .rank-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .rank-number {
    font-size: 32px;
    font-weight: 700;
  }

  .rank-label {
    font-size: 14px;
    opacity: 0.8;
  }

  .rank-progress {
    width: 100%;
    height: 4px;
    background: rgba(255,255,255,0.3);
    border-radius: 2px;
    overflow: hidden;
  }

  .rank-progress-bar {
    height: 100%;
    background: #ffd700;
    border-radius: 2px;
    transition: width 0.5s ease;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
    gap: 12px;
  }

  .stat-card {
    background: white;
    padding: 16px;
    border-radius: 12px;
    text-align: center;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    transition: transform 0.2s;
  }

  .stat-card:hover {
    transform: translateY(-2px);
  }

  .stat-card.highlight {
    background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    color: white;
  }

  .stat-icon {
    font-size: 24px;
    margin-bottom: 4px;
  }

  .stat-number {
    font-size: 20px;
    font-weight: 700;
    color: #050505;
  }

  .stat-card.highlight .stat-number {
    color: white;
  }

  .stat-label {
    font-size: 12px;
    color: #65676b;
  }

  .stat-card.highlight .stat-label {
    color: rgba(255,255,255,0.8);
  }

  .activity-section {
    background: white;
    padding: 20px;
    border-radius: 12px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }

  .activity-section h3 {
    margin: 0 0 16px 0;
    font-size: 16px;
    color: #050505;
  }

  .activity-chart {
    display: flex;
    justify-content: space-around;
    align-items: flex-end;
    gap: 4px;
    height: 160px;
    padding-top: 8px;
  }

  .activity-column {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex: 1;
    height: 100%;
  }

  .activity-bars {
    display: flex;
    gap: 4px;
    align-items: flex-end;
    height: 120px;
    justify-content: center;
    width: 100%;
  }

  .bar-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    flex: 1;
    height: 120px;
    justify-content: flex-end;
  }

  .bar {
    width: 100%;
    max-width: 16px;
    border-radius: 4px 4px 0 0;
    min-height: 4px;
    transition: height 0.3s ease;
  }

  .bar-waves {
    background: #1877f2;
  }

  .bar-likes {
    background: #dc3545;
  }

  .bar-comments {
    background: #10b981;
  }

  .bar-plays {
    background: #f59e0b;
  }

  .bar-label {
    font-size: 8px;
    color: #65676b;
  }

  .activity-date {
    font-size: 11px;
    color: #65676b;
    margin-top: 4px;
    font-weight: 500;
  }

  .achievements-section {
    background: white;
    padding: 20px;
    border-radius: 12px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }

  .achievements-section h3 {
    margin: 0 0 16px 0;
    font-size: 16px;
    color: #050505;
  }

  .achievements-grid {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .achievement-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    border-radius: 8px;
    background: #f7f8fa;
    transition: all 0.2s;
  }

  .achievement-card.unlocked {
    background: #e8f5e9;
    border-left: 4px solid #10b981;
  }

  .achievement-card.locked {
    opacity: 0.6;
  }

  .achievement-icon {
    font-size: 28px;
    flex-shrink: 0;
  }

  .achievement-info {
    flex: 1;
  }

  .achievement-name {
    font-weight: 600;
    color: #050505;
    font-size: 14px;
  }

  .achievement-description {
    font-size: 13px;
    color: #65676b;
  }

  .achievement-status {
    font-size: 18px;
  }
</style>