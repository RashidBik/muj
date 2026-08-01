import { supabase } from '$lib/client/supabase'

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
    // دریافت اطلاعات کاربر
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, email, name, username, bio, avatar, created_at')
      .eq('username', username)
      .maybeSingle()

    if (userError) throw userError
    if (!userData) return null

    const userId = userData.id

    // دریافت تعداد موج‌ها
    const { count: wavesCount, error: wavesError } = await supabase
      .from('waves')
      .select('*', { count: 'exact', head: true })
      .eq('author_id', userId)
      .eq('status', 'PUBLISHED')

    if (wavesError) throw wavesError

    // دریافت تعداد دنبال‌کننده‌ها
    const { count: followersCount, error: followersError } = await supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('following_id', userId)

    if (followersError) throw followersError

    // دریافت تعداد دنبال‌شونده‌ها
    const { count: followingCount, error: followingError } = await supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('follower_id', userId)

    if (followingError) throw followingError

    // بررسی آیا کاربر جاری دنبال می‌کند
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

// دنبال کردن کاربر
export async function followUser(followerId: string, followingId: string): Promise<boolean> {
  try {
    if (followerId === followingId) {
      throw new Error('نمی‌توانید خودتان را دنبال کنید')
    }

    const { error } = await supabase
      .from('follows')
      .insert({
        follower_id: followerId,
        following_id: followingId
      })

    if (error) throw error
    return true
  } catch (error) {
    console.error('خطا در دنبال کردن:', error)
    throw error
  }
}

// لغو دنبال کردن
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