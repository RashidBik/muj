import { supabase } from '$lib/client/supabase'

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

export async function getComments(waveId: string, userId?: string): Promise<Comment[]> {
  try {
    // دریافت نظرات اصلی (بدون ریپلای)
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

    // دریافت ریپلای‌ها برای هر نظر
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

        return {
          ...comment,
          replies: replies || [],
          isLiked: false // بعداً پیاده‌سازی می‌شود
        }
      })
    )

    return commentsWithReplies
  } catch (error) {
    console.error('خطا در دریافت نظرات:', error)
    throw error
  }
}

export async function addComment(
  waveId: string,
  authorId: string,
  content: string,
  parentId?: string
): Promise<Comment> {
  try {
    const { data, error } = await supabase
      .from('comments')
      .insert({
        content: content.trim(),
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
    return data
  } catch (error) {
    console.error('خطا در افزودن نظر:', error)
    throw error
  }
}

export async function deleteComment(commentId: string, userId: string): Promise<boolean> {
  try {
    // بررسی اینکه کاربر نویسنده نظر است
    const { data: comment, error: fetchError } = await supabase
      .from('comments')
      .select('author_id')
      .eq('id', commentId)
      .single()

    if (fetchError) throw fetchError
    if (comment.author_id !== userId) {
      throw new Error('شما اجازه حذف این نظر را ندارید')
    }

    const { error } = await supabase
      .from('comments')
      .delete()
      .eq('id', commentId)

    if (error) throw error
    return true
  } catch (error) {
    console.error('خطا در حذف نظر:', error)
    throw error
  }
}