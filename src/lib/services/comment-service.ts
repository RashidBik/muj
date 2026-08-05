import { supabase } from '$lib/client/supabase'
import { createNotification } from './notification-service'

export interface Comment {
  id: string
  content: string
  wave_id: string
  author_id: string
  parent_id: string | null
  likes_count: number
  created_at: string
  updated_at: string
  author?: {
    id: string
    name: string
    username: string
    avatar: string | null
  }
  replies?: Comment[]
  isLiked?: boolean
}

export interface CommentStats {
  total: number
  lastCommentAt: string | null
}

/**
 * Get comments for a wave with replies and like status
 */
export async function getComments(waveId: string, userId?: string): Promise<Comment[]> {
  try {
    // Get main comments (without replies)
    const { data, error } = await supabase
      .from('comments')
      .select(`
        *,
        author:users(
          id,
          name,
          username,
          avatar
        )
      `)
      .eq('wave_id', waveId)
      .is('parent_id', null)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) throw error

    if (!data || data.length === 0) {
      return []
    }

    // Get replies for each comment
    const commentsWithReplies = await Promise.all(
      data.map(async (comment) => {
        const { data: replies, error: repliesError } = await supabase
          .from('comments')
          .select(`
            *,
            author:users(
              id,
              name,
              username,
              avatar
            )
          `)
          .eq('parent_id', comment.id)
          .order('created_at', { ascending: true })

        if (repliesError) throw repliesError

        // Check if user liked this comment
        let isLiked = false
        if (userId) {
          const { data: likeData } = await supabase
            .from('comment_likes')
            .select('id')
            .eq('comment_id', comment.id)
            .eq('user_id', userId)
            .maybeSingle()
          isLiked = !!likeData
        }

        return {
          ...comment,
          replies: replies || [],
          isLiked
        }
      })
    )

    return commentsWithReplies
  } catch (error) {
    console.error('Error loading comments:', error)
    throw error
  }
}

/**
 * Get comment count for a wave
 */
export async function getCommentCount(waveId: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('comments')
      .select('id', { count: 'exact', head: true })
      .eq('wave_id', waveId)

    if (error) throw error
    return count || 0
  } catch (error) {
    console.error('Error getting comment count:', error)
    return 0
  }
}

/**
 * Add a new comment with notification
 */
export async function addComment(
  waveId: string,
  authorId: string,
  content: string,
  parentId?: string
): Promise<Comment> {
  try {
    // Validate content
    const trimmedContent = content.trim()
    if (!trimmedContent) {
      throw new Error('متن نظر نمی‌تواند خالی باشد')
    }
    if (trimmedContent.length < 2) {
      throw new Error('متن نظر باید حداقل ۲ کاراکتر باشد')
    }
    if (trimmedContent.length > 500) {
      throw new Error('متن نظر نمی‌تواند بیشتر از ۵۰۰ کاراکتر باشد')
    }

    const { data, error } = await supabase
      .from('comments')
      .insert({
        content: trimmedContent,
        wave_id: waveId,
        author_id: authorId,
        parent_id: parentId || null
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

    // Update wave's comments count
    await supabase.rpc('increment_wave_comments', { wave_id: waveId })

    // ✅ CREATE NOTIFICATIONS
    try {
      // Get wave details
      const { data: wave } = await supabase
        .from('waves')
        .select('author_id, title')
        .eq('id', waveId)
        .single()

      // Get comment author details
      const { data: actor } = await supabase
        .from('users')
        .select('name')
        .eq('id', authorId)
        .single()

      const actorName = actor?.name || 'کاربر'
      const shortContent = trimmedContent.length > 50 
        ? trimmedContent.substring(0, 50) + '...' 
        : trimmedContent

      // Notification for wave author
      if (wave && wave.author_id !== authorId) {
        await createNotification(
          wave.author_id,
          'COMMENT',
          `${actorName} به موج "${wave.title}" نظر داد: "${shortContent}"`,
          authorId,
          waveId,
          data.id
        )
      }

      // If replying to a comment, notify the parent comment author
      if (parentId) {
        const { data: parentComment } = await supabase
          .from('comments')
          .select('author_id')
          .eq('id', parentId)
          .single()

        if (parentComment && parentComment.author_id !== authorId) {
          await createNotification(
            parentComment.author_id,
            'COMMENT',
            `${actorName} به نظر شما در موج "${wave?.title || ''}" پاسخ داد`,
            authorId,
            waveId,
            data.id
          )
        }
      }
    } catch (notifError) {
      console.error('Error creating comment notification:', notifError)
      // Don't fail the comment if notification fails
    }

    return data
  } catch (error) {
    console.error('Error adding comment:', error)
    throw error
  }
}

/**
 * Delete a comment (only if user is the author)
 */
export async function deleteComment(commentId: string, userId: string): Promise<boolean> {
  try {
    // Check if user is the author
    const { data: comment, error: fetchError } = await supabase
      .from('comments')
      .select('author_id, wave_id')
      .eq('id', commentId)
      .single()

    if (fetchError) throw fetchError
    if (comment.author_id !== userId) {
      throw new Error('شما اجازه حذف این نظر را ندارید')
    }

    // Delete the comment
    const { error } = await supabase
      .from('comments')
      .delete()
      .eq('id', commentId)

    if (error) throw error

    // Update wave's comments count
    await supabase.rpc('decrement_wave_comments', { wave_id: comment.wave_id })

    return true
  } catch (error) {
    console.error('Error deleting comment:', error)
    throw error
  }
}

/**
 * Toggle like on a comment with notification
 */
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

/**
 * Subscribe to new comments in real-time
 */
export function subscribeToComments(
  waveId: string,
  callback: (comment: Comment) => void
): () => void {
  const subscription = supabase
    .channel(`comments:${waveId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'comments',
        filter: `wave_id=eq.${waveId}`
      },
      async (payload) => {
        // Fetch the full comment with author data
        const { data, error } = await supabase
          .from('comments')
          .select(`
            *,
            author:users(
              id,
              name,
              username,
              avatar
            )
          `)
          .eq('id', payload.new.id)
          .single()

        if (!error && data) {
          callback(data)
        }
      }
    )
    .subscribe()

  return () => {
    subscription.unsubscribe()
  }
}

/**
 * Get comment stats for a wave
 */
export async function getCommentStats(waveId: string): Promise<CommentStats> {
  try {
    const { data, error } = await supabase
      .from('comments')
      .select('created_at')
      .eq('wave_id', waveId)
      .order('created_at', { ascending: false })
      .limit(1)

    if (error) throw error

    return {
      total: await getCommentCount(waveId),
      lastCommentAt: data && data.length > 0 ? data[0].created_at : null
    }
  } catch (error) {
    console.error('Error getting comment stats:', error)
    return {
      total: 0,
      lastCommentAt: null
    }
  }
}