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
}

export interface WaveWithLike extends Wave {
  isLiked: boolean
}

export async function loadWaves(userId?: string): Promise<WaveWithLike[]> {
  try {
    // دریافت موج‌ها
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

    if (!data || data.length === 0) {
      return []
    }

    // اگر کاربر وارد شده، بررسی لایک‌ها
    if (userId) {
      const waveIds = data.map(w => w.id)
      const { data: likesData } = await supabase
        .from('likes')
        .select('wave_id')
        .eq('user_id', userId)
        .in('wave_id', waveIds)

      const likedWaveIds = new Set(likesData?.map(l => l.wave_id) || [])

      return data.map(wave => ({
        ...wave,
        isLiked: likedWaveIds.has(wave.id)
      }))
    }

    return data
  } catch (error) {
    console.error('خطا در بارگذاری موج‌ها:', error)
    throw error
  }
}

export async function toggleLike(waveId: string, userId: string, isLiked: boolean): Promise<boolean> {
  try {
    if (isLiked) {
      // لغو لایک
      const { error } = await supabase
        .from('likes')
        .delete()
        .eq('user_id', userId)
        .eq('wave_id', waveId)

      if (error) throw error
      return false
    } else {
      // لایک کردن
      const { error } = await supabase
        .from('likes')
        .insert({
          user_id: userId,
          wave_id: waveId
        })

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