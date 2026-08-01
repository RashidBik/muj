<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { user } from '$lib/stores/user'
  import { 
    getUserStats, 
    getUserActivity, 
    getUserAchievements,
    getUserRank 
  } from '$lib/services/user-analytics-service'
  import { format } from 'date-fns'
  import { faIR } from 'date-fns/locale'

  let currentUser = $state<any>(null)
  let stats = $state<any>(null)
  let activity = $state<any[]>([])
  let achievements = $state<any[]>([])
  let rank = $state(0)
  let loading = $state(true)
  let error = $state<string | null>(null)
  let selectedPeriod = $state('week') // 'week', 'month', 'all'

  // Subscribe to user store
  $effect(() => {
    const unsubscribe = user.subscribe(value => {
      currentUser = value
    })
    return () => unsubscribe()
  })

  async function loadAnalytics() {
    if (!currentUser) {
      goto('/auth/login')
      return
    }

    loading = true
    error = null
    
    try {
      const [statsData, activityData, achievementsData, rankData] = await Promise.all([
        getUserStats(currentUser.id),
        getUserActivity(currentUser.id),
        getUserAchievements(currentUser.id),
        getUserRank(currentUser.id)
      ])

      stats = statsData
      activity = activityData
      achievements = achievementsData
      rank = rankData
      
    } catch (err) {
      console.error('Error loading analytics:', err)
      error = 'خطا در بارگذاری آمار'
    } finally {
      loading = false
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

  onMount(() => {
    loadAnalytics()
  })

  // Reload when user changes
  $effect(() => {
    if (currentUser) {
      loadAnalytics()
    }
  })
</script>

<div class="analytics-page">
  <div class="analytics-container">
    <!-- Header -->
    <div class="header">
      <button class="back-btn" onclick={() => history.back()}>← بازگشت</button>
      <h1>📊 آمار من</h1>
    </div>

    {#if loading}
      <div class="loading">⏳ در حال بارگذاری...</div>
    {:else if error}
      <div class="error-box">❌ {error}</div>
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
</div>

<style>
  .analytics-page {
    min-height: 100vh;
    background: #f0f2f5;
    padding: 16px;
  }

  .analytics-container {
    max-width: 600px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .header {
    display: flex;
    align-items: center;
    gap: 12px;
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

  .loading {
    text-align: center;
    padding: 40px;
    color: #65676b;
  }

  .error-box {
    background: #fee;
    color: #dc3545;
    padding: 16px;
    border-radius: 8px;
    text-align: center;
  }

  /* Rank Badge */
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

  /* Stats Grid */
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

  /* Activity Chart */
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

  /* Achievements */
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