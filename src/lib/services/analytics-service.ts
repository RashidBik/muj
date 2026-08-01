import { supabase } from '$lib/client/supabase'
import { browser } from '$app/environment'

export type EventType = 
  | 'page_view'
  | 'wave_view'
  | 'wave_play'
  | 'wave_publish'
  | 'like'
  | 'unlike'
  | 'comment'
  | 'follow'
  | 'unfollow'
  | 'share'
  | 'search'
  | 'login'
  | 'logout'
  | 'register'
  | 'boost_wave'
  | 'referral'
  | 'room_join'
  | 'room_message'

export interface AnalyticsEvent {
  event_type: EventType
  event_data?: Record<string, any>
  page_url?: string
  referrer?: string
  session_id?: string
}

export interface DailyStats {
  date: string
  metric_name: string
  metric_value: number
}

export interface AnalyticsSummary {
  total_users: number
  total_waves: number
  total_likes: number
  total_comments: number
  total_referrals: number
  daily_active_users: number
  weekly_active_users: number
  monthly_active_users: number
}

// Track an event
export async function trackEvent(
  event: AnalyticsEvent,
  userId?: string
): Promise<boolean> {
  try {
    if (!browser) return false

    // Get user ID from store if not provided
    let userIdParam = userId
    if (!userIdParam) {
      const { data: { user } } = await supabase.auth.getUser()
      userIdParam = user?.id
    }

    if (!userIdParam) return false

    const sessionId = getSessionId()
    
    // Get page info
    const pageUrl = event.page_url || window.location.pathname
    const referrer = event.referrer || document.referrer || null

    // Track event using RPC
    const { error } = await supabase.rpc('track_event', {
      user_id_param: userIdParam,
      event_type_param: event.event_type,
      event_data_param: event.event_data || null,
      page_url_param: pageUrl,
      referrer_param: referrer,
      user_agent_param: navigator.userAgent,
      ip_address_param: null, // Will be handled by server
      session_id_param: sessionId
    })

    if (error) throw error

    // Update daily stats
    await updateDailyStats(event.event_type)
    
    return true
  } catch (error) {
    console.error('Error tracking event:', error)
    return false
  }
}

// Update daily stats
export async function updateDailyStats(metricName: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .rpc('update_daily_stats', {
        metric_name_param: metricName,
        increment_param: 1
      })

    if (error) throw error
    return true
  } catch (error) {
    console.error('Error updating daily stats:', error)
    return false
  }
}

// Get session ID (persistent for the session)
function getSessionId(): string {
  if (!browser) return ''
  
  let sessionId = sessionStorage.getItem('analytics_session_id')
  if (!sessionId) {
    sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9)
    sessionStorage.setItem('analytics_session_id', sessionId)
  }
  return sessionId
}

// Get analytics summary
export async function getAnalyticsSummary(
  days: number = 30
): Promise<AnalyticsSummary> {
  try {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    
    const { data, error } = await supabase
      .rpc('get_analytics_summary', {
        start_date: startDate.toISOString().split('T')[0],
        end_date: new Date().toISOString().split('T')[0]
      })

    if (error) throw error

    // Get active users
    const { data: activeUsers } = await supabase
      .from('user_events')
      .select('user_id')
      .gte('created_at', startDate.toISOString())

    const uniqueUsers = new Set(activeUsers?.map(u => u.user_id) || [])
    
    // Get total counts
    const { count: totalUsers } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })

    const { count: totalWaves } = await supabase
      .from('waves')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'PUBLISHED')

    const { count: totalLikes } = await supabase
      .from('likes')
      .select('*', { count: 'exact', head: true })

    const { count: totalComments } = await supabase
      .from('comments')
      .select('*', { count: 'exact', head: true })

    const { count: totalReferrals } = await supabase
      .from('referrals')
      .select('*', { count: 'exact', head: true })

    // Daily, weekly, monthly active users
    const now = new Date()
    const daily = new Date(now)
    daily.setDate(daily.getDate() - 1)
    
    const weekly = new Date(now)
    weekly.setDate(weekly.getDate() - 7)
    
    const monthly = new Date(now)
    monthly.setDate(monthly.getDate() - 30)

    const { data: dailyActive } = await supabase
      .from('user_events')
      .select('user_id')
      .gte('created_at', daily.toISOString())

    const { data: weeklyActive } = await supabase
      .from('user_events')
      .select('user_id')
      .gte('created_at', weekly.toISOString())

    const { data: monthlyActive } = await supabase
      .from('user_events')
      .select('user_id')
      .gte('created_at', monthly.toISOString())

    return {
      total_users: totalUsers || 0,
      total_waves: totalWaves || 0,
      total_likes: totalLikes || 0,
      total_comments: totalComments || 0,
      total_referrals: totalReferrals || 0,
      daily_active_users: new Set(dailyActive?.map(u => u.user_id) || []).size,
      weekly_active_users: new Set(weeklyActive?.map(u => u.user_id) || []).size,
      monthly_active_users: new Set(monthlyActive?.map(u => u.user_id) || []).size,
    }
  } catch (error) {
    console.error('Error getting analytics summary:', error)
    return {
      total_users: 0,
      total_waves: 0,
      total_likes: 0,
      total_comments: 0,
      total_referrals: 0,
      daily_active_users: 0,
      weekly_active_users: 0,
      monthly_active_users: 0,
    }
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

    // Calculate engagement score
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