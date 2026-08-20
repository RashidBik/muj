import { supabase } from '$lib/client/supabase'
import { createNotification, updateNotificationCount } from './notification-service'
import { addTokens, TokenRewards } from './token-service'
import { trackEvent } from './analytics-service'
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
  views_count: number
  hashtags: string | null
  is_boosted: boolean
  boost_expires_at: string | null
  boost_count: number
  expires_at: string | null
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

export interface ReactionSummary {
  emoji: string
  count: number
  users?: string[]
}

export const REACTION_EMOJIS = ['❤️', '🎉', '😂', '😮', '😢', '😡', '👍', '👏']

// Extract hashtags from text
export function extractHashtags(text: string): string[] {
  const hashtagRegex = /#[\w\u0600-\u06FF]+/g
  const matches = text.match(hashtagRegex)
  return matches ? matches.map(tag => tag.substring(1)) : []
}

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
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) throw error
    if (!data || data.length === 0) return []

    const waveIds = data.map(w => w.id)
    let likedWaveIds = new Set<string>()
    let reactionsMap: Record<string, ReactionSummary[]> = {}
    let userReactionsMap: Record<string, string> = {}

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

    if (userId && reactionsData) {
      reactionsData
        .filter(r => r.user_id === userId)
        .forEach(r => {
          userReactionsMap[r.wave_id] = r.emoji
        })
    }

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
      views_count: wave.views_count || 0,
      hashtags: wave.hashtags || null,
      isLiked: likedWaveIds.has(wave.id),
      reactions: reactionsMap[wave.id] || [],
      userReaction: userReactionsMap[wave.id] || null
    }))
  } catch (error) {
    console.error('خطا در بارگذاری موج‌ها:', error)
    throw error
  }
}

// Create new wave with hashtags and analytics
export async function createWave(
  authorId: string,
  title: string,
  audioUrl: string,
  description?: string,
  hashtags?: string
): Promise<any> {
  try {
    let finalHashtags = hashtags || ''
    if (!hashtags && description) {
      const extracted = extractHashtags(description)
      finalHashtags = extracted.join(' ')
    }

    const { data, error } = await supabase
      .from('waves')
      .insert({
        author_id: authorId,
        title: title,
        audio_url: audioUrl,
        description: description || null,
        hashtags: finalHashtags || null,
        views_count: 0,
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

    // Award tokens for publishing wave
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

    // ✅ Track wave publish event
    try {
      await trackEvent({
        event_type: 'wave_publish',
        event_data: {
          wave_id: data.id,
          title: title,
          duration: data.duration,
          category: data.category,
          duration_category: data.duration_category,
          hashtags: finalHashtags
        }
      }, authorId)
    } catch (analyticsError) {
      console.error('Error tracking wave publish:', analyticsError)
    }

    // Notify followers
    try {
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
        for (const follower of followers) {
          await createNotification(
            follower.follower_id,
            'NEW_WAVE',
            `${actorName} یک موج جدید منتشر کرد: "${title}"${finalHashtags ? ` ${finalHashtags}` : ''}`,
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

// Increment view count
export async function incrementWaveViews(waveId: string): Promise<void> {
  try {
    const { error } = await supabase.rpc('increment_wave_views', { wave_id: waveId })
    if (error) {
      console.error('Error calling increment_wave_views RPC:', error)
      const { error: updateError } = await supabase
        .from('waves')
        .update({ views_count: supabase.sql`views_count + 1` })
        .eq('id', waveId)
      
      if (updateError) {
        console.error('Fallback update error:', updateError)
      }
    }
  } catch (error) {
    console.error('Error incrementing views:', error)
  }
}

// Get wave by ID with view increment
export async function getWaveById(waveId: string, userId?: string): Promise<Wave | null> {
  try {
    await incrementWaveViews(waveId)

    const { data, error } = await supabase
      .from('waves')
      .select(`
        *,
        author:users(
          id,
          name,
          username,
          avatar,
          bio
        )
      `)
      .eq('id', waveId)
      .single()

    if (error) throw error
    
    // ✅ Track wave view
    if (userId) {
      try {
        await trackEvent({
          event_type: 'wave_view',
          event_data: {
            wave_id: waveId,
            author_id: data.author_id,
            title: data.title
          }
        }, userId)
      } catch (analyticsError) {
        console.error('Error tracking wave view:', analyticsError)
      }
    }

    return {
      ...data,
      views_count: data.views_count || 0,
      hashtags: data.hashtags || null
    }
  } catch (error) {
    console.error('Error getting wave:', error)
    return null
  }
}

// Get popular hashtags
export async function getPopularHashtags(limit: number = 10): Promise<{ tag: string; count: number }[]> {
  try {
    const { data, error } = await supabase
      .from('waves')
      .select('hashtags')
      .eq('status', 'PUBLISHED')
      .not('hashtags', 'is', null)

    if (error) throw error

    const hashtagCount: Record<string, number> = {}
    data?.forEach(wave => {
      if (wave.hashtags) {
        const tags = wave.hashtags.split(' ')
        tags.forEach((tag: string) => {
          if (tag.trim()) {
            hashtagCount[tag] = (hashtagCount[tag] || 0) + 1
          }
        })
      }
    })

    return Object.entries(hashtagCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([tag, count]) => ({ tag, count }))
  } catch (error) {
    console.error('Error getting popular hashtags:', error)
    return []
  }
}

// Search waves by hashtag
export async function searchWavesByHashtag(hashtag: string): Promise<Wave[]> {
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
      .ilike('hashtags', `%${hashtag}%`)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error searching by hashtag:', error)
    return []
  }
}

// Toggle like with notification, token, and analytics
export async function toggleLike(waveId: string, userId: string, isLiked: boolean): Promise<boolean> {
  try {
    if (isLiked) {
      const { error } = await supabase
        .from('likes')
        .delete()
        .eq('user_id', userId)
        .eq('wave_id', waveId)
      if (error) throw error

      // ✅ Track unlike
      try {
        await trackEvent({
          event_type: 'unlike',
          event_data: { wave_id: waveId }
        }, userId)
      } catch (analyticsError) {
        console.error('Error tracking unlike:', analyticsError)
      }

      return false
    } else {
      const { error } = await supabase
        .from('likes')
        .insert({ user_id: userId, wave_id: waveId })
      if (error) throw error

      // ✅ Track like
      try {
        await trackEvent({
          event_type: 'like',
          event_data: { wave_id: waveId }
        }, userId)
      } catch (analyticsError) {
        console.error('Error tracking like:', analyticsError)
      }

      // Create notification and token reward
      try {
        const { data: wave } = await supabase
          .from('waves')
          .select('author_id, title')
          .eq('id', waveId)
          .single()

        if (wave && wave.author_id !== userId) {
          const { data: actor } = await supabase
            .from('users')
            .select('name')
            .eq('id', userId)
            .single()

          await createNotification(
            wave.author_id,
            'LIKE',
            `${actor?.name || 'کاربر'} به موج "${wave.title}" لایک کرد`,
            userId,
            waveId
          )

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
      }

      return true
    }
  } catch (error) {
    console.error('خطا در لایک:', error)
    throw error
  }
}

// Delete wave
export async function deleteWave(waveId: string, userId: string): Promise<{ success: boolean; message: string }> {
  try {
    const { data: wave, error: fetchError } = await supabase
      .from('waves')
      .select('author_id, audio_url, cover_image')
      .eq('id', waveId)
      .single()

    if (fetchError) throw fetchError
    if (wave.author_id !== userId) {
      return { success: false, message: 'شما اجازه حذف این موج را ندارید' }
    }

    if (wave.audio_url) {
      const audioPath = wave.audio_url.split('/').pop()
      if (audioPath) {
        await supabase.storage.from('waves').remove([audioPath])
      }
    }

    if (wave.cover_image) {
      const coverPath = wave.cover_image.split('/').pop()
      if (coverPath) {
        await supabase.storage.from('covers').remove([coverPath])
      }
    }

    await supabase.from('reactions').delete().eq('wave_id', waveId)
    await supabase.from('comments').delete().eq('wave_id', waveId)
    await supabase.from('likes').delete().eq('wave_id', waveId)
    await supabase.from('room_messages').delete().eq('wave_id', waveId)

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

// Toggle reaction with analytics
export async function toggleReaction(
  waveId: string,
  userId: string,
  emoji: string
): Promise<{ success: boolean; action: 'added' | 'changed' | 'removed' | null }> {
  try {
    const { data: existing, error: getError } = await supabase
      .from('reactions')
      .select('emoji')
      .eq('user_id', userId)
      .eq('wave_id', waveId)
      .maybeSingle()

    if (getError) throw getError

    let action: 'added' | 'changed' | 'removed' | null = null

    if (existing) {
      if (existing.emoji === emoji) {
        const { error: deleteError } = await supabase
          .from('reactions')
          .delete()
          .eq('user_id', userId)
          .eq('wave_id', waveId)
        
        if (deleteError) throw deleteError
        action = 'removed'
      } else {
        const { error: updateError } = await supabase
          .from('reactions')
          .update({ emoji })
          .eq('user_id', userId)
          .eq('wave_id', waveId)
        
        if (updateError) throw updateError
        action = 'changed'
      }
    } else {
      const { error: insertError } = await supabase
        .from('reactions')
        .insert({ 
          user_id: userId, 
          wave_id: waveId, 
          emoji 
        })
      
      if (insertError) throw insertError
      action = 'added'
    }

    // ✅ Track reaction
    try {
      await trackEvent({
        event_type: 'reaction',
        event_data: {
          wave_id: waveId,
          emoji: emoji,
          action: action
        }
      }, userId)
    } catch (analyticsError) {
      console.error('Error tracking reaction:', analyticsError)
    }

    return { success: true, action }
  } catch (error) {
    console.error('❌ خطا در ریکشن:', error)
    return { success: false, action: null }
  }
}

// Get wave reactions
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

// Get user reaction for a wave
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