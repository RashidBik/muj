import { supabase } from '$lib/client/supabase'
import { createNotification, updateNotificationCount } from './notification-service'
import { addTokens, TokenRewards } from './token-service'
import type { User } from '$lib/stores/user'

export interface Wave {
  id: string
  title: string
  audio_url: string
  cover_image: string | null
  duration: number
  duration_category: string
  category: string
  status: string
  author_id: string
  created_at: string
  likes_count: number
  comments_count: number
  saves_count: number
  author?: {
    id: string
    name: string
    username: string
    avatar: string | null
  }
  isLiked?: boolean
  reactions?: ReactionSummary[]
  userReaction?: string | null
}

export interface WaveWithLike extends Wave {
  isLiked: boolean
}

// ✅ نوع ریکشن
export interface ReactionSummary {
  emoji: string
  count: number
  users?: string[]
}

// ✅ ریکشن‌های پیش‌فرض
export const REACTION_EMOJIS = ['❤️', '🎉', '😂', '😮', '😢', '😡', '👍', '👏']

export async function loadWaves(userId?: string): Promise<WaveWithLike[]> {
  try {
    const now = new Date().toISOString()
    
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
      .eq('status', 'PUBLISHED')
      .or(`expires_at.is.null,expires_at.gt.${now}`) // ✅ فقط موج‌های معتبر
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) throw error
    if (!data || data.length === 0) return []

    const waveIds = data.map(w => w.id)
    let likedWaveIds = new Set<string>()
    let reactionsMap: Record<string, ReactionSummary[]> = {}
    let userReactionsMap: Record<string, string> = {}

    // ✅ دریافت ریکشن‌ها
    const { data: reactionsData } = await supabase
      .from('reactions')
      .select('wave_id, emoji, user_id')
      .in('wave_id', waveIds)

    if (reactionsData) {
      reactionsData.forEach(r => {
        if (!reactionsMap[r.wave_id]) reactionsMap[r.wave_id] = []
        const existing = reactionsMap[r.wave_id].find(s => s.emoji === r.emoji)
        if (existing) {
          existing.count++
          if (r.user_id) existing.users?.push(r.user_id)
        } else {
          reactionsMap[r.wave_id].push({ emoji: r.emoji, count: 1, users: r.user_id ? [r.user_id] : [] })
        }
      })
    }

    // ✅ ریکشن کاربر فعلی
    if (userId && reactionsData) {
      reactionsData
        .filter(r => r.user_id === userId)
        .forEach(r => {
          userReactionsMap[r.wave_id] = r.emoji
        })
    }

    // ✅ لایک‌ها (برای سازگاری با عقب)
    if (userId) {
      const { data: likesData } = await supabase
        .from('likes')
        .select('wave_id')
        .eq('user_id', userId)
        .in('wave_id', waveIds)
      likedWaveIds = new Set(likesData?.map(l => l.wave_id) || [])
    }

    return data.map(wave => ({
      ...wave,
      isLiked: likedWaveIds.has(wave.id),
      reactions: reactionsMap[wave.id] || [],
      userReaction: userReactionsMap[wave.id] || null
    }))
  } catch (error) {
    console.error('خطا در بارگذاری موج‌ها:', error)
    throw error
  }
}

// ✅ Create new wave with notifications and token rewards
export async function createWave(
  authorId: string,
  title: string,
  audioUrl: string,
  description?: string
): Promise<any> {
  try {
    const { data, error } = await supabase
      .from('waves')
      .insert({
        author_id: authorId,
        title: title,
        audio_url: audioUrl,
        description: description || null,
        status: 'PUBLISHED'
      })
      .select(`
        *,
        author:users(
          id,
          name,
          username,
          avatar
        )
      `)
      .single()

    if (error) throw error

    // ✅ Award tokens for publishing wave
    try {
      await addTokens(
        authorId,
        TokenRewards.PUBLISH_WAVE,
        'PUBLISH_WAVE',
        `انتشار موج "${title}"`,
        data.id
      )
    } catch (tokenError) {
      console.error('Error awarding tokens:', tokenError)
    }

    // ✅ NOTIFY FOLLOWERS ABOUT NEW POST
    try {
      // Get all followers of the author
      const { data: followers } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('following_id', authorId)

      const { data: actor } = await supabase
        .from('users')
        .select('name')
        .eq('id', authorId)
        .single()

      if (followers && followers.length > 0) {
        const actorName = actor?.name || 'کاربر'
        // Send notification to each follower
        for (const follower of followers) {
          await createNotification(
            follower.follower_id,
            'NEW_WAVE',
            `${actorName} یک موج جدید منتشر کرد: "${title}"`,
            authorId,
            data.id
          )
        }
      }
    } catch (notifError) {
      console.error('Error creating new wave notification:', notifError)
    }

    return data
  } catch (error) {
    console.error('Error creating wave:', error)
    throw error
  }
}

// ✅ تابع مدیریت ریکشن (فقط یک ریکشن مجاز)
export async function toggleReaction(
  waveId: string,
  userId: string,
  emoji: string
): Promise<{ success: boolean; action: 'added' | 'changed' | 'removed' | null }> {
  try {
    // ✅ بررسی ریکشن قبلی کاربر برای این موج
    const { data: existing, error: getError } = await supabase
      .from('reactions')
      .select('emoji')
      .eq('user_id', userId)
      .eq('wave_id', waveId)
      .maybeSingle()

    if (getError) throw getError

    // ✅ اگر کاربر قبلاً ریکشن داشته
    if (existing) {
      // اگر همان ریکشن رو زده → حذفش کن (un-reaction)
      if (existing.emoji === emoji) {
        const { error: deleteError } = await supabase
          .from('reactions')
          .delete()
          .eq('user_id', userId)
          .eq('wave_id', waveId)
        
        if (deleteError) throw deleteError
        return { success: true, action: 'removed' }
      } else {
        // اگر ریکشن جدیدی زده → ریکشن قبلی رو با جدید جایگزین کن
        const { error: updateError } = await supabase
          .from('reactions')
          .update({ emoji })
          .eq('user_id', userId)
          .eq('wave_id', waveId)
        
        if (updateError) throw updateError
        return { success: true, action: 'changed' }
      }
    } else {
      // ✅ ریکشن جدید
      const { error: insertError } = await supabase
        .from('reactions')
        .insert({ 
          user_id: userId, 
          wave_id: waveId, 
          emoji 
        })
      
      if (insertError) throw insertError
      return { success: true, action: 'added' }
    }
  } catch (error) {
    console.error('❌ خطا در ریکشن:', error)
    return { success: false, action: null }
  }
}

// ✅ دریافت ریکشن‌های یک موج
export async function getWaveReactions(waveId: string): Promise<ReactionSummary[]> {
  try {
    const { data, error } = await supabase
      .from('reactions')
      .select('emoji')
      .eq('wave_id', waveId)

    if (error) throw error

    const summary: Record<string, ReactionSummary> = {}
    data?.forEach(r => {
      if (!summary[r.emoji]) {
        summary[r.emoji] = { emoji: r.emoji, count: 0 }
      }
      summary[r.emoji].count++
    })

    return Object.values(summary).sort((a, b) => b.count - a.count)
  } catch (error) {
    console.error('خطا در دریافت ریکشن‌ها:', error)
    return []
  }
}

// ✅ دریافت ریکشن کاربر برای یک موج
export async function getUserReaction(waveId: string, userId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('reactions')
      .select('emoji')
      .eq('user_id', userId)
      .eq('wave_id', waveId)
      .maybeSingle()
    
    if (error) throw error
    return data?.emoji || null
  } catch (error) {
    console.error('خطا در دریافت ریکشن کاربر:', error)
    return null
  }
}

// ✅ تابع toggleLike با notification و token
export async function toggleLike(waveId: string, userId: string, isLiked: boolean): Promise<boolean> {
  try {
    if (isLiked) {
      const { error } = await supabase
        .from('likes')
        .delete()
        .eq('user_id', userId)
        .eq('wave_id', waveId)
      if (error) throw error
      return false
    } else {
      const { error } = await supabase
        .from('likes')
        .insert({ user_id: userId, wave_id: waveId })
      if (error) throw error

      // ✅ CREATE NOTIFICATION AND TOKEN REWARD FOR WAVE AUTHOR
      try {
        // Get wave author
        const { data: wave } = await supabase
          .from('waves')
          .select('author_id, title')
          .eq('id', waveId)
          .single()

        if (wave && wave.author_id !== userId) {
          // Get actor info
          const { data: actor } = await supabase
            .from('users')
            .select('name')
            .eq('id', userId)
            .single()

          // Create notification
          await createNotification(
            wave.author_id,
            'LIKE',
            `${actor?.name || 'کاربر'} به موج "${wave.title}" لایک کرد`,
            userId,
            waveId
          )

          // Award tokens to wave author for receiving like
          await addTokens(
            wave.author_id,
            TokenRewards.LIKE_RECEIVED,
            'LIKE_RECEIVED',
            `دریافت لایک برای موج "${wave.title}"`,
            waveId
          )
        }
      } catch (notifError) {
        console.error('Error creating like notification/token:', notifError)
        // Don't fail the like if notification fails
      }

      return true
    }
  } catch (error) {
    console.error('خطا در لایک:', error)
    throw error
  }
}

// ✅ تابع حذف موج
export async function deleteWave(waveId: string, userId: string): Promise<{ success: boolean; message: string }> {
  try {
    // بررسی اینکه کاربر صاحب موج است
    const { data: wave, error: fetchError } = await supabase
      .from('waves')
      .select('author_id, audio_url, cover_image')
      .eq('id', waveId)
      .single()

    if (fetchError) throw fetchError
    if (wave.author_id !== userId) {
      return { success: false, message: 'شما اجازه حذف این موج را ندارید' }
    }

    // حذف فایل صوتی از Storage
    if (wave.audio_url) {
      const audioPath = wave.audio_url.split('/').pop()
      if (audioPath) {
        await supabase.storage.from('waves').remove([audioPath])
      }
    }

    // حذف تصویر کاور از Storage
    if (wave.cover_image) {
      const coverPath = wave.cover_image.split('/').pop()
      if (coverPath) {
        await supabase.storage.from('covers').remove([coverPath])
      }
    }

    // حذف ریکشن‌های مرتبط
    await supabase
      .from('reactions')
      .delete()
      .eq('wave_id', waveId)

    // حذف کامنت‌های مرتبط
    await supabase
      .from('comments')
      .delete()
      .eq('wave_id', waveId)

    // حذف لایک‌های مرتبط
    await supabase
      .from('likes')
      .delete()
      .eq('wave_id', waveId)

    // حذف پیام‌های اتاق مرتبط
    await supabase
      .from('room_messages')
      .delete()
      .eq('wave_id', waveId)

    // حذف خود موج
    const { error: deleteError } = await supabase
      .from('waves')
      .delete()
      .eq('id', waveId)

    if (deleteError) throw deleteError

    return { success: true, message: 'موج با موفقیت حذف شد' }
  } catch (error) {
    console.error('خطا در حذف موج:', error)
    return { success: false, message: 'خطا در حذف موج. لطفاً دوباره تلاش کنید.' }
  }
}

export async function getWaveCount(): Promise<number> {
  const { count, error } = await supabase
    .from('waves')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'PUBLISHED')
  if (error) throw error
  return count || 0
}