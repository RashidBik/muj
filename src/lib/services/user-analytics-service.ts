import { supabase } from '$lib/client/supabase'
import { browser } from '$app/environment'

export interface UserStats {
  total_waves: number
  total_likes: number
  total_comments: number
  total_followers: number
  total_following: number
  total_referrals: number
  total_tokens: number
  waves_played: number
  engagement_score: number
  streak_days: number
  last_active: string | null
}

export interface UserActivity {
  date: string
  waves: number
  likes: number
  comments: number
  plays: number
}

export interface UserAchievement {
  id: string
  name: string
  description: string
  icon: string
  unlocked: boolean
  unlocked_at: string | null
}

// Get user stats
export async function getUserStats(userId: string): Promise<UserStats> {
  try {
    // Get waves count
    const { count: wavesCount } = await supabase
      .from('waves')
      .select('*', { count: 'exact', head: true })
      .eq('author_id', userId)
      .eq('status', 'PUBLISHED')

    // Get likes received
    const { count: likesCount } = await supabase
      .from('likes')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)

    // Get comments count
    const { count: commentsCount } = await supabase
      .from('comments')
      .select('*', { count: 'exact', head: true })
      .eq('author_id', userId)

    // Get followers
    const { count: followersCount } = await supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('following_id', userId)

    // Get following
    const { count: followingCount } = await supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('follower_id', userId)

    // Get referrals
    const { count: referralsCount } = await supabase
      .from('referrals')
      .select('*', { count: 'exact', head: true })
      .eq('referrer_id', userId)

    // Get tokens
    const { data: tokens } = await supabase
      .from('user_tokens')
      .select('balance')
      .eq('user_id', userId)
      .maybeSingle()

    // Get user events for engagement score
    const { data: events } = await supabase
      .from('user_events')
      .select('event_type')
      .eq('user_id', userId)

    // Calculate engagement score
    const scores: Record<string, number> = {
      'wave_publish': 10,
      'comment': 5,
      'like': 2,
      'share': 8,
      'wave_view': 1,
      'wave_play': 1,
      'follow': 3,
      'referral': 15,
      'boost_wave': 5,
      'room_message': 1
    }

    let engagementScore = 0
    let wavesPlayed = 0
    events?.forEach(event => {
      engagementScore += scores[event.event_type] || 0
      if (event.event_type === 'wave_play') wavesPlayed++
    })

    // Get streak days from user_scores
    const { data: userScore } = await supabase
      .from('user_scores')
      .select('streak_days, last_active_at')
      .eq('user_id', userId)
      .maybeSingle()

    return {
      total_waves: wavesCount || 0,
      total_likes: likesCount || 0,
      total_comments: commentsCount || 0,
      total_followers: followersCount || 0,
      total_following: followingCount || 0,
      total_referrals: referralsCount || 0,
      total_tokens: tokens?.balance || 0,
      waves_played: wavesPlayed,
      engagement_score: engagementScore,
      streak_days: userScore?.streak_days || 0,
      last_active: userScore?.last_active_at || null
    }
  } catch (error) {
    console.error('Error getting user stats:', error)
    return {
      total_waves: 0,
      total_likes: 0,
      total_comments: 0,
      total_followers: 0,
      total_following: 0,
      total_referrals: 0,
      total_tokens: 0,
      waves_played: 0,
      engagement_score: 0,
      streak_days: 0,
      last_active: null
    }
  }
}

// Get user activity (last 7 days)
export async function getUserActivity(userId: string): Promise<UserActivity[]> {
  try {
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const { data: events } = await supabase
      .from('user_events')
      .select('event_type, created_at')
      .eq('user_id', userId)
      .gte('created_at', sevenDaysAgo.toISOString())

    // Group by date
    const activityMap: Record<string, UserActivity> = {}
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]
      activityMap[dateStr] = {
        date: dateStr,
        waves: 0,
        likes: 0,
        comments: 0,
        plays: 0
      }
    }

    events?.forEach(event => {
      const dateStr = event.created_at.split('T')[0]
      if (activityMap[dateStr]) {
        switch (event.event_type) {
          case 'wave_publish':
            activityMap[dateStr].waves++
            break
          case 'like':
          case 'unlike':
            activityMap[dateStr].likes++
            break
          case 'comment':
            activityMap[dateStr].comments++
            break
          case 'wave_play':
            activityMap[dateStr].plays++
            break
        }
      }
    })

    return Object.values(activityMap)
  } catch (error) {
    console.error('Error getting user activity:', error)
    return []
  }
}

// Get user achievements
export async function getUserAchievements(userId: string): Promise<UserAchievement[]> {
  try {
    const stats = await getUserStats(userId)
    
    const achievements: UserAchievement[] = [
      {
        id: 'first_wave',
        name: 'اولین موج',
        description: 'اولین موج خود را منتشر کردید',
        icon: '🎙️',
        unlocked: stats.total_waves >= 1,
        unlocked_at: null
      },
      {
        id: 'wave_master',
        name: 'استاد موج',
        description: '۵۰ موج منتشر کردید',
        icon: '🏆',
        unlocked: stats.total_waves >= 50,
        unlocked_at: null
      },
      {
        id: 'popular',
        name: 'محبوب',
        description: '۱۰۰ لایک دریافت کردید',
        icon: '❤️',
        unlocked: stats.total_likes >= 100,
        unlocked_at: null
      },
      {
        id: 'commentator',
        name: 'نظر دهنده',
        description: '۵۰ نظر دادید',
        icon: '💬',
        unlocked: stats.total_comments >= 50,
        unlocked_at: null
      },
      {
        id: 'influencer',
        name: 'تاثیرگذار',
        description: '۵۰ دنبال‌کننده دارید',
        icon: '👥',
        unlocked: stats.total_followers >= 50,
        unlocked_at: null
      },
      {
        id: 'referral_star',
        name: 'ستاره دعوت',
        description: '۱۰ دوست را دعوت کردید',
        icon: '⭐',
        unlocked: stats.total_referrals >= 10,
        unlocked_at: null
      },
      {
        id: 'token_rich',
        name: 'توکن دار',
        description: '۱۰۰۰ توکن جمع کردید',
        icon: '💰',
        unlocked: stats.total_tokens >= 1000,
        unlocked_at: null
      },
      {
        id: 'streak_7',
        name: 'هفته فعال',
        description: '۷ روز متوالی فعال بودید',
        icon: '🔥',
        unlocked: stats.streak_days >= 7,
        unlocked_at: null
      },
      {
        id: 'active_listener',
        name: 'شنونده فعال',
        description: '۱۰۰ موج را گوش دادید',
        icon: '🎧',
        unlocked: stats.waves_played >= 100,
        unlocked_at: null
      }
    ]

    return achievements
  } catch (error) {
    console.error('Error getting user achievements:', error)
    return []
  }
}

// Get user rank
export async function getUserRank(userId: string): Promise<number> {
  try {
    // Get all users with their engagement scores
    const { data: users } = await supabase
      .from('users')
      .select('id')

    if (!users) return 0

    // Get scores for all users
    const scores = await Promise.all(
      users.map(async (user) => {
        const stats = await getUserStats(user.id)
        return { user_id: user.id, score: stats.engagement_score }
      })
    )

    // Sort by score descending
    scores.sort((a, b) => b.score - a.score)

    // Find user's rank
    const rank = scores.findIndex(u => u.user_id === userId) + 1
    return rank || 0
  } catch (error) {
    console.error('Error getting user rank:', error)
    return 0
  }
}