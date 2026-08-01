import { supabase } from '$lib/client/supabase'
import { createNotification } from './notification-service'

export async function toggleLike(userId: string, waveId: string, isLiked: boolean): Promise<boolean> {
  try {
    // ... existing like logic ...

    // If liked, create notification for wave author
    if (!isLiked) {
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
    }

    return true
  } catch (error) {
    console.error('Error toggling like:', error)
    return false
  }
}