import { supabase } from '$lib/client/supabase'

export interface Notification {
  id: string
  user_id: string
  type: 'LIKE' | 'COMMENT' | 'FOLLOW' | 'ROOM_MESSAGE'
  message: string
  actor_id: string
  wave_id: string | null
  comment_id: string | null
  is_read: boolean
  created_at: string
  actor?: {
    id: string
    name: string
    username: string
    avatar: string | null
  }
  wave?: {
    id: string
    title: string
  }
}

// Get user notifications
export async function getNotifications(
  userId: string,
  limit: number = 20
): Promise<Notification[]> {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select(`
        *,
        actor:users!actor_id(
          id,
          name,
          username,
          avatar
        ),
        wave:waves(
          id,
          title
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error getting notifications:', error)
    return []
  }
}

// Get unread count
export async function getUnreadCount(userId: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false)

    if (error) throw error
    return count || 0
  } catch (error) {
    console.error('Error getting unread count:', error)
    return 0
  }
}

// Mark notification as read
export async function markAsRead(notificationId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId)

    if (error) throw error
    return true
  } catch (error) {
    console.error('Error marking notification as read:', error)
    return false
  }
}

// Mark all as read
export async function markAllAsRead(userId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false)

    if (error) throw error
    return true
  } catch (error) {
    console.error('Error marking all as read:', error)
    return false
  }
}

// Create notification (called from server/API)
export async function createNotification(
  userId: string,
  type: string,
  message: string,
  actorId: string,
  waveId?: string,
  commentId?: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        type: type,
        message: message,
        actor_id: actorId,
        wave_id: waveId || null,
        comment_id: commentId || null
      })

    if (error) throw error
    return true
  } catch (error) {
    console.error('Error creating notification:', error)
    return false
  }
}