import { supabase } from '$lib/client/supabase'
import { trackEvent } from './analytics-service'

export interface UserStats {
  total_waves: number
  total_likes: number
  total_comments: number
  total_followers: number
  total_following: number
  total_referrals: number
  total_tokens: number
  engagement_score: number
  streak_days: number
  waves_played: number
}

export interface UserActivity {
  date: string
  waves: number
  likes: number
  comments: number
  plays: number
}

export interface Achievement {
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

    // ✅ Get likes count - likes RECEIVED by the user (on their waves)
    // First get all waves by this user
    const { data: userWaves } = await supabase
      .from('waves')
      .select('id')
      .eq('author_id', userId)
      .eq('status', 'PUBLISHED')

    let likesCount = 0
    if (userWaves && userWaves.length > 0) {
      const waveIds = userWaves.map(w => w.id)
      const { count } = await supabase
        .from('likes')
        .select('*', { count: 'exact', head: true })
        .in('wave_id', waveIds)
      likesCount = count || 0
    }

    // Get comments count - comments made BY the user
    const { count: commentsCount } = await supabase
      .from('comments')
      .select('*', { count: 'exact', head: true })
      .eq('author_id', userId)

    // Get followers count
    const { count: followersCount } = await supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('following_id', userId)

    // Get following count
    const { count: followingCount } = await supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('follower_id', userId)

    // Get referrals count
    const { count: referralsCount } = await supabase
      .from('referrals')
      .select('*', { count: 'exact', head: true })
      .eq('referrer_id', userId)

    // Get token balance
    const { data: tokenData } = await supabase
      .from('user_tokens')
      .select('balance')
      .eq('user_id', userId)
      .single()

    // Get engagement score from user_engagement
    const { data: engagementData } = await supabase
      .from('user_engagement')
      .select('score')
      .eq('user_id', userId)
      .single()

    // Get streak days
    const { data: streakData } = await supabase
      .from('user_streaks')
      .select('days')
      .eq('user_id', userId)
      .single()

    // Get waves played
    const { data: playedData } = await supabase
      .from('user_plays')
      .select('count')
      .eq('user_id', userId)
      .single()

    return {
      total_waves: wavesCount || 0,
      total_likes: likesCount || 0,
      total_comments: commentsCount || 0,
      total_followers: followersCount || 0,
      total_following: followingCount || 0,
      total_referrals: referralsCount || 0,
      total_tokens: tokenData?.balance || 0,
      engagement_score: engagementData?.score || 0,
      streak_days: streakData?.days || 0,
      waves_played: playedData?.count || 0
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
      engagement_score: 0,
      streak_days: 0,
      waves_played: 0
    }
  }
}

// Get user activity (daily)
export async function getUserActivity(
  userId: string,
  days: number = 7
): Promise<UserActivity[]> {
  try {
    const { data, error } = await supabase
      .from('user_activity_daily')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: true })
      .limit(days)

    if (error) throw error

    // Fill in missing days
    const result: Record<string, UserActivity> = {}
    const now = new Date()
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now)
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]
      result[dateStr] = {
        date: dateStr,
        waves: 0,
        likes: 0,
        comments: 0,
        plays: 0
      }
    }

    data?.forEach((day: any) => {
      if (result[day.date]) {
        result[day.date] = {
          date: day.date,
          waves: day.waves || 0,
          likes: day.likes || 0,
          comments: day.comments || 0,
          plays: day.plays || 0
        }
      }
    })

    return Object.values(result)
  } catch (error) {
    console.error('Error getting user activity:', error)
    return []
  }
}

// Get user achievements
export async function getUserAchievements(userId: string): Promise<Achievement[]> {
  try {
    const { data, error } = await supabase
      .from('achievements')
      .select(`
        id,
        name,
        description,
        icon,
        user_achievements!left(
          unlocked,
          unlocked_at
        )
      `)
      .order('created_at', { ascending: true })

    if (error) throw error

    return data?.map((a: any) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      icon: a.icon,
      unlocked: a.user_achievements?.[0]?.unlocked || false,
      unlocked_at: a.user_achievements?.[0]?.unlocked_at || null
    })) || []
  } catch (error) {
    console.error('Error getting user achievements:', error)
    return []
  }
}

// Get user rank
export async function getUserRank(userId: string): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, engagement_score')
      .order('engagement_score', { ascending: false })

    if (error) throw error

    const rank = data.findIndex((u: any) => u.id === userId) + 1
    return rank || 0
  } catch (error) {
    console.error('Error getting user rank:', error)
    return 0
  }
}

// Track user activity
export async function trackUserActivity(
  userId: string,
  activityType: string,
  details?: Record<string, any>
): Promise<void> {
  try {
    await trackEvent({
      event_type: activityType as any,
      event_data: details
    }, userId)
  } catch (error) {
    console.error('Error tracking user activity:', error)
  }
}

// Get user engagement metrics
export async function getUserEngagement(userId: string) {
  try {
    const { data, error } = await supabase
      .from('user_events')
      .select('event_type, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) throw error

    const events = data || []
    const scores: Record<string, number> = {
      'wave_publish': 10,
      'comment': 5,
      'like': 2,
      'share': 8,
      'wave_view': 1,
      'wave_play': 1,
    }

    let totalScore = 0
    events.forEach(event => {
      totalScore += scores[event.event_type] || 1
    })

    return {
      total_events: events.length,
      engagement_score: totalScore,
      last_active: events[0]?.created_at || null,
      event_breakdown: events.reduce((acc, e) => {
        acc[e.event_type] = (acc[e.event_type] || 0) + 1
        return acc
      }, {} as Record<string, number>)
    }
  } catch (error) {
    console.error('Error getting user engagement:', error)
    return null
  }
}