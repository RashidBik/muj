import { supabase } from '$lib/client/supabase'
import { createNotification } from './notification-service'

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

      // ✅ CREATE NOTIFICATION FOR WAVE AUTHOR
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

          await createNotification(
            wave.author_id,
            'LIKE',
            `${actor?.name || 'کاربر'} به موج "${wave.title}" لایک کرد`,
            userId,
            waveId
          )
        }
      } catch (notifError) {
        console.error('Error creating like notification:', notifError)
        // Don't fail the like if notification fails
      }

      return true
    }
  } catch (error) {
    console.error('Error toggling like:', error)
    return false
  }
}

// Add comment like notification
export async function toggleCommentLike(commentId: string, userId: string): Promise<boolean> {
  try {
    // Check if user already liked
    const { data: existingLike, error: checkError } = await supabase
      .from('comment_likes')
      .select('id')
      .eq('comment_id', commentId)
      .eq('user_id', userId)
      .maybeSingle()

    if (checkError) throw checkError

    if (existingLike) {
      // Unlike
      const { error: deleteError } = await supabase
        .from('comment_likes')
        .delete()
        .eq('id', existingLike.id)

      if (deleteError) throw deleteError

      await supabase.rpc('decrement_comment_likes', { comment_id: commentId })
      return false
    } else {
      // Like
      const { error: insertError } = await supabase
        .from('comment_likes')
        .insert({
          comment_id: commentId,
          user_id: userId
        })

      if (insertError) throw insertError

      await supabase.rpc('increment_comment_likes', { comment_id: commentId })

      // ✅ CREATE NOTIFICATION FOR COMMENT AUTHOR
      try {
        // Get comment author and wave info
        const { data: comment } = await supabase
          .from('comments')
          .select(`
            author_id,
            wave_id,
            waves:wave_id (title)
          `)
          .eq('id', commentId)
          .single()

        if (comment && comment.author_id !== userId) {
          const { data: actor } = await supabase
            .from('users')
            .select('name')
            .eq('id', userId)
            .single()

          await createNotification(
            comment.author_id,
            'LIKE',
            `${actor?.name || 'کاربر'} به نظر شما در موج "${comment.waves?.title || ''}" لایک کرد`,
            userId,
            comment.wave_id,
            commentId
          )
        }
      } catch (notifError) {
        console.error('Error creating comment like notification:', notifError)
      }

      return true
    }
  } catch (error) {
    console.error('Error toggling comment like:', error)
    throw error
  }
}