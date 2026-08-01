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

  // Icon imports
  import {
    ArrowLeft,
    User,
    Users,
    Mic,
    Heart,
    MessageCircle,
    Crown,
    TrendingUp,
    Award,
    Clock,
    Edit,
    Share2,
    Coins,
    BarChart3,
    Play,
    Flame,
    CheckCircle,
    Lock,
    UserPlus,
    UserCheck,
    Star,
    Trophy,
    Headphones,
    Sparkles,
    Music,
    Radio,
    Zap,
    Target,
    Diamond,
    Volume2,
    Handshake,
    BookOpen,
    CalendarDays,
    AlertCircle
  } from 'lucide-svelte'

  let profile = $state<Profile | null>(null)
  let waves = $state<any[]>([])
  let loading = $state(true)
  let loadingWaves = $state(true)
  let currentUser = $state<any>(null)
  let isFollowing = $state(false)
  let isTogglingFollow = $state(false)
  let username = $state<string | null>(null)
  let errorMessage = $state<string | null>(null)
  
  // Analytics state
  let activeTab = $state('waves')
  let stats = $state<any>(null)
  let activity = $state<any[]>([])
  let achievements = $state<any[]>([])
  let rank = $state(0)
  let loadingAnalytics = $state(false)

  // Achievement icon mapping
  function getAchievementIcon(icon: string) {
    const iconMap: Record<string, any> = {
      '🎙️': Mic,
      '🏆': Trophy,
      '❤️': Heart,
      '💬': MessageCircle,
      '👥': Users,
      '⭐': Star,
      '💰': Coins,
      '🔥': Flame,
      '🎧': Headphones,
      '🎵': Music,
      '📻': Radio,
      '🌟': Sparkles,
      '👑': Crown,
      '💎': Diamond,
      '🎯': Target,
      '📝': Edit,
      '📚': BookOpen,
      '🔊': Volume2,
      '🤝': Handshake,
      '⚡': Zap,
      '📈': TrendingUp,
      '📊': BarChart3,
    }
    return iconMap[icon] || Award
  }

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

  function goToEditProfile() {
    goto('/profile/edit')
  }

  function goToReferral() {
    goto('/referral')
  }

  const isOwnProfile = $derived(currentUser && profile && currentUser.id === profile.id)

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
      <p>در حال بارگذاری پروفایل...</p>
    </div>
  {:else if errorMessage}
    <div class="error-card">
      <div class="error-icon">
        <AlertCircle size={48} />
      </div>
      <h3>{errorMessage}</h3>
      <button class="back-home-btn" onclick={() => goto('/')}>
        بازگشت به خانه
      </button>
    </div>
  {:else if profile}
    <!-- Profile header -->
    <div class="profile-header">
      <button class="back-btn" onclick={() => history.back()}>
        <ArrowLeft size={20} />
        بازگشت
      </button>
    </div>

    <!-- Profile card -->
    <div class="profile-card">
      <div class="profile-cover">
        <div class="profile-avatar-wrapper">
          <Avatar src={profile.avatar} size="xl" />
          {#if isOwnProfile}
            <button class="avatar-edit-btn" onclick={goToEditProfile}>
              <Edit size={14} />
            </button>
          {/if}
        </div>
      </div>

      <div class="profile-info">
        <div class="profile-name-section">
          <h1 class="profile-name">{profile.name}</h1>
          {#if profile.is_verified}
            <span class="verified-badge" title="تایید شده">
              <CheckCircle size={18} fill="#1877f2" />
            </span>
          {/if}
        </div>
        
        <div class="profile-username">
          <User size={14} />
          @{profile.username}
        </div>
        
        <div class="profile-joined">
          <Clock size={14} />
          عضویت: {formatTime(profile.created_at)}
        </div>
        
        {#if profile.bio}
          <p class="profile-bio">{profile.bio}</p>
        {/if}

        <div class="profile-stats">
          <div class="stat">
            <span class="stat-number">{profile.waves_count || 0}</span>
            <span class="stat-label">
              <Mic size={14} />
              موج
            </span>
          </div>
          <div class="stat">
            <span class="stat-number">{profile.followers_count || 0}</span>
            <span class="stat-label">
              <Users size={14} />
              دنبال‌کننده
            </span>
          </div>
          <div class="stat">
            <span class="stat-number">{profile.following_count || 0}</span>
            <span class="stat-label">
              <UserPlus size={14} />
              دنبال‌شونده
            </span>
          </div>
        </div>

        <div class="profile-actions">
          {#if currentUser && currentUser.id !== profile.id}
            <button 
              class="follow-btn {isFollowing ? 'following' : ''}"
              onclick={toggleFollow}
              disabled={isTogglingFollow}
            >
              {#if isFollowing}
                <UserCheck size={18} />
                دنبال می‌کنید
              {:else}
                <UserPlus size={18} />
                دنبال کردن
              {/if}
            </button>
          {:else if currentUser && currentUser.id === profile.id}
            <button class="action-btn edit-btn" onclick={goToEditProfile}>
              <Edit size={18} />
              ویرایش پروفایل
            </button>
            <button class="action-btn wallet-btn" onclick={goToWallet}>
              <Coins size={18} />
              <TokenBalance />
            </button>
            <button class="action-btn referral-btn" onclick={goToReferral}>
              <Share2 size={18} />
              دعوت دوستان
            </button>
          {/if}
        </div>
      </div>
    </div>

    <DailyReward />

    <!-- Tabs -->
    {#if isOwnProfile}
      <div class="profile-tabs">
        <button 
          class="tab {activeTab === 'waves' ? 'active' : ''}"
          onclick={() => activeTab = 'waves'}
        >
          <Mic size={16} />
          موج‌ها
        </button>
        <button 
          class="tab {activeTab === 'analytics' ? 'active' : ''}"
          onclick={() => activeTab = 'analytics'}
        >
          <BarChart3 size={16} />
          آمار من
        </button>
      </div>
    {/if}

    <!-- Tab Content -->
    {#if activeTab === 'waves' || !isOwnProfile}
      <div class="user-waves">
        <div class="section-header">
          <Mic size={20} />
          <h2 class="section-title">موج‌های منتشرشده</h2>
          <span class="wave-count">{waves.length}</span>
        </div>
        
        {#if loadingWaves}
          <div class="loading-waves">
            <div class="spinner-small"></div>
            در حال بارگذاری موج‌ها...
          </div>
        {:else if waves.length === 0}
          <div class="empty-waves">
            <Mic size={48} />
            <p>هیچ موجی منتشر نشده است</p>
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
          <div class="loading-analytics">
            <div class="spinner-small"></div>
            در حال بارگذاری آمار...
          </div>
        {:else if stats}
          <!-- Rank Badge -->
          <div class="rank-badge">
            <div class="rank-icon">
              <Crown size={32} />
            </div>
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
              <div class="stat-icon"><Mic size={24} /></div>
              <div class="stat-number">{formatNumber(stats.total_waves)}</div>
              <div class="stat-label">موج‌های منتشر شده</div>
            </div>
            <div class="stat-card">
              <div class="stat-icon"><Heart size={24} /></div>
              <div class="stat-number">{formatNumber(stats.total_likes)}</div>
              <div class="stat-label">لایک دریافت شده</div>
            </div>
            <div class="stat-card">
              <div class="stat-icon"><MessageCircle size={24} /></div>
              <div class="stat-number">{formatNumber(stats.total_comments)}</div>
              <div class="stat-label">نظر داده شده</div>
            </div>
            <div class="stat-card">
              <div class="stat-icon"><Users size={24} /></div>
              <div class="stat-number">{formatNumber(stats.total_followers)}</div>
              <div class="stat-label">دنبال‌کننده</div>
            </div>
            <div class="stat-card">
              <div class="stat-icon"><UserPlus size={24} /></div>
              <div class="stat-number">{formatNumber(stats.total_following)}</div>
              <div class="stat-label">دنبال‌شونده</div>
            </div>
            <div class="stat-card">
              <div class="stat-icon"><Share2 size={24} /></div>
              <div class="stat-number">{formatNumber(stats.total_referrals)}</div>
              <div class="stat-label">دعوت‌ها</div>
            </div>
            <div class="stat-card highlight">
              <div class="stat-icon"><Coins size={24} /></div>
              <div class="stat-number">{formatNumber(stats.total_tokens)}</div>
              <div class="stat-label">توکن‌ها</div>
            </div>
            <div class="stat-card">
              <div class="stat-icon"><TrendingUp size={24} /></div>
              <div class="stat-number">{formatNumber(stats.engagement_score)}</div>
              <div class="stat-label">امتیاز تعامل</div>
            </div>
            <div class="stat-card">
              <div class="stat-icon"><Flame size={24} /></div>
              <div class="stat-number">{formatNumber(stats.streak_days)}</div>
              <div class="stat-label">روزهای متوالی</div>
            </div>
            <div class="stat-card">
              <div class="stat-icon"><Play size={24} /></div>
              <div class="stat-number">{formatNumber(stats.waves_played)}</div>
              <div class="stat-label">موج‌های گوش داده</div>
            </div>
          </div>

          <!-- Activity Chart -->
          <div class="activity-section">
            <div class="activity-header">
              <BarChart3 size={20} />
              <h3>فعالیت ۷ روز اخیر</h3>
            </div>
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
                    </div>
                    <div class="bar-wrapper">
                      <div 
                        class="bar bar-likes" 
                        style="height: {(day.likes / getMaxActivity()) * 100}%"
                        title="لایک: {day.likes}"
                      ></div>
                    </div>
                    <div class="bar-wrapper">
                      <div 
                        class="bar bar-comments" 
                        style="height: {(day.comments / getMaxActivity()) * 100}%"
                        title="نظر: {day.comments}"
                      ></div>
                    </div>
                    <div class="bar-wrapper">
                      <div 
                        class="bar bar-plays" 
                        style="height: {(day.plays / getMaxActivity()) * 100}%"
                        title="پخش: {day.plays}"
                      ></div>
                    </div>
                  </div>
                  <div class="activity-date">
                    {format(new Date(day.date), 'EEE', { locale: faIR })}
                  </div>
                </div>
              {/each}
            </div>
            <div class="activity-legend">
              <span><span class="legend-dot waves-dot"></span>موج</span>
              <span><span class="legend-dot likes-dot"></span>لایک</span>
              <span><span class="legend-dot comments-dot"></span>نظر</span>
              <span><span class="legend-dot plays-dot"></span>پخش</span>
            </div>
          </div>

          <!-- Achievements -->
          <div class="achievements-section">
            <div class="achievements-header">
              <Award size={20} />
              <h3>دستاوردها</h3>
              <span class="achievement-count">
                {achievements.filter(a => a.unlocked).length}/{achievements.length}
              </span>
            </div>
            <div class="achievements-grid">
              {#each achievements as achievement (achievement.id)}
                {@const IconComponent = getAchievementIcon(achievement.icon)}
                <div class="achievement-card {achievement.unlocked ? 'unlocked' : 'locked'}">
                  <div class="achievement-icon-wrapper">
                    <IconComponent 
                      size={28} 
                      class={achievement.unlocked ? 'icon-unlocked' : 'icon-locked'}
                    />
                  </div>
                  <div class="achievement-info">
                    <div class="achievement-name">{achievement.name}</div>
                    <div class="achievement-description">{achievement.description}</div>
                  </div>
                  <div class="achievement-status">
                    {#if achievement.unlocked}
                      <CheckCircle size={18} color="#10b981" />
                    {:else}
                      <Lock size={18} color="#94a3b8" />
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
    max-width: 640px;
    margin: 0 auto;
    padding: 16px;
    padding-bottom: 80px;
  }

  /* Loading */
  .loading {
    text-align: center;
    padding: 60px 20px;
    color: #64748b;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 4px solid #e2e8f0;
    border-top-color: #6366f1;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin: 0 auto 16px;
  }

  .spinner-small {
    width: 24px;
    height: 24px;
    border: 3px solid #e2e8f0;
    border-top-color: #6366f1;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin: 0 auto 12px;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Error */
  .error-card {
    text-align: center;
    padding: 60px 20px;
    background: white;
    border-radius: 16px;
    box-shadow: 0 4px 24px rgba(0,0,0,0.06);
  }

  .error-icon :global(svg) {
    color: #ef4444;
    margin-bottom: 16px;
  }

  .error-card h3 {
    margin: 0 0 16px 0;
    color: #1a1a2e;
  }

  .back-home-btn {
    background: #6366f1;
    color: white;
    border: none;
    padding: 10px 24px;
    border-radius: 10px;
    font-size: 16px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .back-home-btn:hover {
    background: #4f46e5;
    transform: translateY(-2px);
  }

  /* Profile Header */
  .profile-header {
    margin-bottom: 16px;
  }

  .back-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    background: none;
    border: none;
    color: #6366f1;
    font-size: 15px;
    font-weight: 500;
    cursor: pointer;
    padding: 8px 12px;
    border-radius: 8px;
    transition: all 0.2s ease;
  }

  .back-btn:hover {
    background: #f1f5f9;
  }

  /* Profile Card */
  .profile-card {
    background: white;
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 4px 24px rgba(0,0,0,0.06);
    margin-bottom: 16px;
  }

  .profile-cover {
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    padding: 32px 24px 0;
    position: relative;
  }

  .profile-avatar-wrapper {
    position: relative;
    display: inline-block;
  }

  .avatar-edit-btn {
    position: absolute;
    bottom: 0;
    right: 0;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: white;
    border: 2px solid white;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  }

  .avatar-edit-btn:hover {
    transform: scale(1.1);
  }

  .avatar-edit-btn :global(svg) {
    color: #6366f1;
  }

  .profile-info {
    padding: 16px 24px 24px;
    text-align: center;
  }

  .profile-name-section {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  .profile-name {
    margin: 0;
    font-size: 24px;
    font-weight: 700;
    color: #1a1a2e;
  }

  .verified-badge :global(svg) {
    color: #1877f2;
  }

  .profile-username {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 15px;
    color: #64748b;
    margin-top: 2px;
  }

  .profile-username :global(svg) {
    color: #94a3b8;
  }

  .profile-joined {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 13px;
    color: #94a3b8;
    margin-top: 2px;
  }

  .profile-joined :global(svg) {
    color: #94a3b8;
  }

  .profile-bio {
    font-size: 15px;
    color: #1a1a2e;
    margin: 12px 0 0;
    padding: 12px 16px;
    background: #f8fafc;
    border-radius: 10px;
  }

  .profile-stats {
    display: flex;
    justify-content: center;
    gap: 32px;
    padding: 12px 0;
    margin: 12px 0;
    border-top: 1px solid #eef2f6;
    border-bottom: 1px solid #eef2f6;
  }

  .stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }

  .stat-number {
    font-size: 20px;
    font-weight: 700;
    color: #1a1a2e;
  }

  .stat-label {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 13px;
    color: #64748b;
  }

  .stat-label :global(svg) {
    color: #94a3b8;
  }

  /* Actions */
  .profile-actions {
    display: flex;
    gap: 10px;
    justify-content: center;
    flex-wrap: wrap;
    margin-top: 8px;
  }

  .follow-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 32px;
    border: none;
    border-radius: 10px;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    background: #6366f1;
    color: white;
    font-family: inherit;
  }

  .follow-btn:hover:not(:disabled) {
    background: #4f46e5;
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(99, 102, 241, 0.3);
  }

  .follow-btn.following {
    background: #f1f5f9;
    color: #1a1a2e;
  }

  .follow-btn.following:hover:not(:disabled) {
    background: #fee2e2;
    color: #ef4444;
  }

  .follow-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .action-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 18px;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    border: none;
    font-family: inherit;
  }

  .action-btn :global(svg) {
    flex-shrink: 0;
  }

  .edit-btn {
    background: #f1f5f9;
    color: #1a1a2e;
  }

  .edit-btn:hover {
    background: #e2e8f0;
  }

  .wallet-btn {
    background: linear-gradient(135deg, #f59e0b, #f97316);
    color: white;
  }

  .wallet-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(245, 158, 11, 0.3);
  }

  .referral-btn {
    background: #10b981;
    color: white;
  }

  .referral-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(16, 185, 129, 0.3);
  }

  /* Tabs */
  .profile-tabs {
    display: flex;
    gap: 8px;
    background: white;
    padding: 8px;
    border-radius: 12px;
    margin-bottom: 16px;
    box-shadow: 0 4px 24px rgba(0,0,0,0.04);
  }

  .tab {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 10px;
    border: none;
    border-radius: 8px;
    background: transparent;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    font-family: inherit;
    color: #64748b;
  }

  .tab :global(svg) {
    color: #94a3b8;
    transition: color 0.2s ease;
  }

  .tab:hover {
    background: #f1f5f9;
  }

  .tab.active {
    background: #6366f1;
    color: white;
  }

  .tab.active :global(svg) {
    color: white;
  }

  /* Waves */
  .user-waves {
    margin-top: 16px;
  }

  .section-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 16px;
  }

  .section-header :global(svg) {
    color: #6366f1;
  }

  .section-title {
    font-size: 18px;
    font-weight: 700;
    margin: 0;
    color: #1a1a2e;
  }

  .wave-count {
    font-size: 13px;
    color: #94a3b8;
    background: #f1f5f9;
    padding: 2px 10px;
    border-radius: 12px;
    margin-right: auto;
  }

  .loading-waves {
    text-align: center;
    padding: 40px 20px;
    background: white;
    border-radius: 12px;
    color: #64748b;
  }

  .empty-waves {
    text-align: center;
    padding: 60px 20px;
    background: white;
    border-radius: 12px;
    color: #94a3b8;
  }

  .empty-waves :global(svg) {
    color: #cbd5e1;
    margin-bottom: 12px;
  }

  .waves-grid {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  /* Analytics */
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
    color: #64748b;
  }

  .rank-badge {
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    color: white;
    padding: 20px 24px;
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    box-shadow: 0 4px 20px rgba(99, 102, 241, 0.3);
  }

  .rank-icon :global(svg) {
    color: #ffd700;
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
    box-shadow: 0 4px 24px rgba(0,0,0,0.04);
    transition: all 0.2s ease;
  }

  .stat-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 32px rgba(0,0,0,0.08);
  }

  .stat-card.highlight {
    background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    color: white;
  }

  .stat-icon :global(svg) {
    color: #6366f1;
    margin-bottom: 4px;
  }

  .stat-card.highlight .stat-icon :global(svg) {
    color: white;
  }

  .stat-number {
    font-size: 20px;
    font-weight: 700;
    color: #1a1a2e;
  }

  .stat-card.highlight .stat-number {
    color: white;
  }

  .stat-label {
    font-size: 12px;
    color: #64748b;
    margin-top: 2px;
  }

  .stat-card.highlight .stat-label {
    color: rgba(255,255,255,0.8);
  }

  /* Activity */
  .activity-section {
    background: white;
    padding: 20px;
    border-radius: 12px;
    box-shadow: 0 4px 24px rgba(0,0,0,0.04);
  }

  .activity-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 16px;
  }

  .activity-header :global(svg) {
    color: #6366f1;
  }

  .activity-header h3 {
    margin: 0;
    font-size: 16px;
    color: #1a1a2e;
  }

  .activity-chart {
    display: flex;
    justify-content: space-around;
    align-items: flex-end;
    gap: 4px;
    height: 140px;
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
    gap: 3px;
    align-items: flex-end;
    height: 100px;
    justify-content: center;
    width: 100%;
  }

  .bar-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex: 1;
    height: 100px;
    justify-content: flex-end;
  }

  .bar {
    width: 100%;
    max-width: 12px;
    border-radius: 4px 4px 0 0;
    min-height: 4px;
    transition: height 0.3s ease;
  }

  .bar-waves { background: #6366f1; }
  .bar-likes { background: #ef4444; }
  .bar-comments { background: #10b981; }
  .bar-plays { background: #f59e0b; }

  .activity-date {
    font-size: 11px;
    color: #94a3b8;
    margin-top: 6px;
    font-weight: 500;
  }

  .activity-legend {
    display: flex;
    justify-content: center;
    gap: 16px;
    margin-top: 12px;
    font-size: 12px;
    color: #64748b;
  }

  .legend-dot {
    display: inline-block;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    margin-right: 4px;
    vertical-align: middle;
  }

  .waves-dot { background: #6366f1; }
  .likes-dot { background: #ef4444; }
  .comments-dot { background: #10b981; }
  .plays-dot { background: #f59e0b; }

  /* Achievements */
  .achievements-section {
    background: white;
    padding: 20px;
    border-radius: 12px;
    box-shadow: 0 4px 24px rgba(0,0,0,0.04);
  }

  .achievements-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 16px;
  }

  .achievements-header :global(svg) {
    color: #6366f1;
  }

  .achievements-header h3 {
    margin: 0;
    font-size: 16px;
    color: #1a1a2e;
  }

  .achievement-count {
    font-size: 12px;
    color: #94a3b8;
    background: #f1f5f9;
    padding: 2px 10px;
    border-radius: 12px;
    margin-right: auto;
  }

  .achievements-grid {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .achievement-card {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px 18px;
    border-radius: 12px;
    background: #f8fafc;
    transition: all 0.2s ease;
    border: 1px solid transparent;
  }

  .achievement-card.unlocked {
    background: #f0fdf4;
    border-color: #86efac;
  }

  .achievement-card.locked {
    opacity: 0.6;
    background: #f8fafc;
    border-color: #e2e8f0;
  }

  .achievement-card:hover {
    transform: translateX(4px);
  }

  .achievement-card.unlocked:hover {
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.15);
  }

  .achievement-icon-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    flex-shrink: 0;
    background: #f1f5f9;
    transition: all 0.3s ease;
  }

  .achievement-card.unlocked .achievement-icon-wrapper {
    background: #d1fae5;
  }

  .icon-unlocked {
    color: #10b981;
  }

  .icon-locked {
    color: #94a3b8;
  }

  .achievement-info {
    flex: 1;
  }

  .achievement-name {
    font-weight: 600;
    color: #1a1a2e;
    font-size: 14px;
  }

  .achievement-description {
    font-size: 13px;
    color: #64748b;
  }

  .achievement-status {
    flex-shrink: 0;
  }

  /* Responsive */
  @media (max-width: 640px) {
    .profile-page {
      padding: 12px;
      padding-bottom: 60px;
    }

    .profile-cover {
      padding: 24px 16px 0;
    }

    .profile-info {
      padding: 12px 16px 16px;
    }

    .profile-name {
      font-size: 20px;
    }

    .profile-stats {
      gap: 16px;
    }

    .stat-number {
      font-size: 18px;
    }

    .profile-actions {
      gap: 8px;
    }

    .action-btn {
      padding: 8px 14px;
      font-size: 13px;
    }

    .stats-grid {
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
    }

    .stat-card {
      padding: 12px;
    }

    .stat-number {
      font-size: 16px;
    }

    .activity-chart {
      height: 100px;
    }

    .activity-bars {
      height: 70px;
    }

    .bar-wrapper {
      height: 70px;
    }

    .bar {
      max-width: 8px;
    }

    .activity-date {
      font-size: 9px;
    }

    .achievement-card {
      padding: 12px 14px;
    }

    .achievement-icon-wrapper {
      width: 36px;
      height: 36px;
    }

    .achievement-icon-wrapper :global(svg) {
      width: 20px;
      height: 20px;
    }

    .achievement-name {
      font-size: 13px;
    }

    .achievement-description {
      font-size: 12px;
    }
  }

  @media (max-width: 400px) {
    .stats-grid {
      grid-template-columns: repeat(2, 1fr);
    }

    .profile-stats {
      gap: 12px;
    }

    .profile-actions {
      flex-direction: column;
      align-items: stretch;
    }

    .action-btn {
      justify-content: center;
    }

    .follow-btn {
      justify-content: center;
    }
  }
</style>