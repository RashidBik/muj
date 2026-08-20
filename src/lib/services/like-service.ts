import { supabase } from '$lib/client/supabase'
import { createNotification } from './notification-service'
import { addTokens, TokenRewards } from './token-service'
import { trackEvent } from './analytics-service'

export async function toggleLike(userId: string, waveId: string, isLiked: boolean): Promise<boolean> {
  try {
    if (isLiked) {
      // Unlike
      const { error } = await supabase
        .from('likes')
        .delete()
        .eq('user_id', userId)
        .eq('wave_id', waveId)

      if (error) throw error

      // ✅ Track unlike
      await trackEvent({
        event_type: 'unlike',
        event_data: { wave_id: waveId }
      }, userId)

      return false
    } else {
      // Like
      const { error } = await supabase
        .from('likes')
        .insert({
          user_id: userId,
          wave_id: waveId
        })

      if (error) throw error

      // ✅ Track like for analytics
      await trackEvent({
        event_type: 'like',
        event_data: { 
          wave_id: waveId,
          user_id: userId
        }
      }, userId)

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
      }

      return true
    }
  } catch (error) {
    console.error('Error toggling like:', error)
    return false
  }
}