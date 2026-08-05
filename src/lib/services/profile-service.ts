import { supabase } from '$lib/client/supabase'
import { createNotification } from './notification-service'
import type { User } from '$lib/stores/user'

export interface Profile {
  id: string
  email: string
  name: string
  username: string
  bio: string | null
  avatar: string | null
  created_at: string
  waves_count?: number
  followers_count?: number
  following_count?: number
  is_following?: boolean
}

// دریافت اطلاعات پروفایل
export async function getProfile(username: string, currentUserId?: string): Promise<Profile | null> {
  try {
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, email, name, username, bio, avatar, created_at')
      .eq('username', username)
      .maybeSingle()

    if (userError) throw userError
    if (!userData) return null

    const userId = userData.id

    const { count: wavesCount, error: wavesError } = await supabase
      .from('waves')
      .select('*', { count: 'exact', head: true })
      .eq('author_id', userId)
      .eq('status', 'PUBLISHED')

    if (wavesError) throw wavesError

    const { count: followersCount, error: followersError } = await supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('following_id', userId)

    if (followersError) throw followersError

    const { count: followingCount, error: followingError } = await supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('follower_id', userId)

    if (followingError) throw followingError

    let isFollowing = false
    if (currentUserId && currentUserId !== userId) {
      const { data: followData, error: followError } = await supabase
        .from('follows')
        .select('*')
        .eq('follower_id', currentUserId)
        .eq('following_id', userId)
        .maybeSingle()

      if (!followError && followData) {
        isFollowing = true
      }
    }

    return {
      ...userData,
      waves_count: wavesCount || 0,
      followers_count: followersCount || 0,
      following_count: followingCount || 0,
      is_following: isFollowing
    }
  } catch (error) {
    console.error('خطا در دریافت پروفایل:', error)
    throw error
  }
}

// دریافت موج‌های کاربر
export async function getUserWaves(userId: string): Promise<any[]> {
  try {
    const { data, error } = await supabase
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
      .eq('author_id', userId)
      .eq('status', 'PUBLISHED')
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('خطا در دریافت موج‌های کاربر:', error)
    throw error
  }
}

// ✅ دنبال کردن کاربر - با اعلان
export async function followUser(followerId: string, followingId: string): Promise<boolean> {
  try {
    if (followerId === followingId) {
      throw new Error('نمی‌توانید خودتان را دنبال کنید')
    }

    // Check if already following
    const { data: existing, error: checkError } = await supabase
      .from('follows')
      .select('*')
      .eq('follower_id', followerId)
      .eq('following_id', followingId)
      .maybeSingle()

    if (checkError) throw checkError
    if (existing) {
      throw new Error('از قبل دنبال می‌کنید')
    }

    // Start transaction
    const { error: followError } = await supabase
      .from('follows')
      .insert({
        follower_id: followerId,
        following_id: followingId
      })

    if (followError) throw followError

    // ✅ Create notification for the person being followed
    const { data: actorData } = await supabase
      .from('users')
      .select('name, username')
      .eq('id', followerId)
      .single()

    const actorName = actorData?.name || 'کاربر'
    
    await createNotification(
      followingId, // user_id (person receiving notification)
      'FOLLOW', // type
      `${actorName} شما را دنبال کرد`, // message
      followerId // actor_id (who followed)
    )

    // ✅ Update unread count for header
    updateNotificationCount(followingId)

    return true
  } catch (error) {
    console.error('خطا در دنبال کردن:', error)
    throw error
  }
}

// ✅ لغو دنبال کردن
export async function unfollowUser(followerId: string, followingId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('follows')
      .delete()
      .eq('follower_id', followerId)
      .eq('following_id', followingId)

    if (error) throw error
    return true
  } catch (error) {
    console.error('خطا در لغو دنبال کردن:', error)
    throw error
  }
}

// به‌روزرسانی پروفایل
export async function updateProfile(
  userId: string,
  updates: { name?: string; bio?: string; avatar?: string }
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('users')
      .update({
        name: updates.name,
        bio: updates.bio,
        avatar: updates.avatar,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)

    if (error) throw error
    return true
  } catch (error) {
    console.error('خطا در به‌روزرسانی پروفایل:', error)
    throw error
  }
}

// ✅ دریافت لیست فالووینگ‌ها
export async function getFollowing(userId: string): Promise<any[]> {
  try {
    console.log('📥 Getting following for user:', userId)
    
    if (!userId) {
      console.warn('⚠️ No userId provided')
      return []
    }

    const { data: followData, error: followError } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', userId)

    if (followError) {
      console.error('❌ Error getting follow data:', followError)
      return []
    }

    console.log('📊 Follow data:', followData)

    if (!followData || followData.length === 0) {
      console.log('ℹ️ No following found')
      return []
    }

    const followingIds = followData.map(f => f.following_id)
    console.log('📊 Following IDs:', followingIds)

    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, name, username, avatar, bio')
      .in('id', followingIds)

    if (usersError) {
      console.error('❌ Error getting users:', usersError)
      return []
    }

    console.log('✅ Following users:', users)
    return users || []

  } catch (error) {
    console.error('❌ Error getting following:', error)
    return []
  }
}

// ✅ دریافت لیست فالوورها
export async function getFollowers(userId: string): Promise<any[]> {
  try {
    console.log('📥 Getting followers for user:', userId)
    
    if (!userId) {
      console.warn('⚠️ No userId provided')
      return []
    }

    const { data: followData, error: followError } = await supabase
      .from('follows')
      .select('follower_id')
      .eq('following_id', userId)

    if (followError) {
      console.error('❌ Error getting follow data:', followError)
      return []
    }

    console.log('📊 Follow data:', followData)

    if (!followData || followData.length === 0) {
      console.log('ℹ️ No followers found')
      return []
    }

    const followerIds = followData.map(f => f.follower_id)
    console.log('📊 Follower IDs:', followerIds)

    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, name, username, avatar, bio')
      .in('id', followerIds)

    if (usersError) {
      console.error('❌ Error getting users:', usersError)
      return []
    }

    console.log('✅ Followers users:', users)
    return users || []

  } catch (error) {
    console.error('❌ Error getting followers:', error)
    return []
  }
}

// ✅ Helper function to update notification count
async function updateNotificationCount(userId: string) {
  try {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false)

    if (!error && count !== null) {
      window.dispatchEvent(new CustomEvent('notification-count', { 
        detail: count 
      }))
    }
  } catch (error) {
    console.error('Error updating notification count:', error)
  }
}