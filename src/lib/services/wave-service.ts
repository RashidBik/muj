import { supabase } from '$lib/client/supabase'
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

// ✅ دریافت ریکشن‌های یک موج (گروه‌بندی شده)
export async function getWaveReactions(waveId: string): Promise<ReactionSummary[]> {
  try {
    const { data, error } = await supabase
      .from('reactions')
      .select('emoji')
      .eq('wave_id', waveId)

    if (error) throw error

    // گروه‌بندی و شمارش
    const summary: Record<string, ReactionSummary> = {}
    data?.forEach(r => {
      if (!summary[r.emoji]) {
        summary[r.emoji] = { emoji: r.emoji, count: 0 }
      }
      summary[r.emoji].count++
    })

    // مرتب‌سازی بر اساس تعداد (بیشترین اول)
    return Object.values(summary).sort((a, b) => b.count - a.count)
  } catch (error) {
    console.error('خطا در دریافت ریکشن‌ها:', error)
    return []
  }
}

// ✅ دریافت ریکشن کاربر برای یک موج (برای نمایش در UI)
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

// ✅ تابع toggleLike قبلی
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
      return true
    }
  } catch (error) {
    console.error('خطا در لایک:', error)
    throw error
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