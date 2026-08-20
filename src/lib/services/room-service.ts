import { supabase } from '$lib/client/supabase'
import { createNotification } from './notification-service'
import type { User } from '$lib/stores/user'

export interface RoomMessage {
  id: string
  content: string | null
  wave_id: string
  author_id: string
  audio_url?: string | null
  duration?: number | null
  is_audio?: boolean
  is_pinned: boolean
  created_at: string
  author?: {
    id: string
    name: string
    username: string
    avatar: string | null
  }
}

export interface RoomAudioMessage {
  id: string
  audio_url: string
  duration: number
  wave_id: string
  author_id: string
  created_at: string
  author?: {
    id: string
    name: string
    username: string
    avatar: string | null
  }
}

// Get all room messages (text + audio combined)
export async function getRoomMessages(waveId: string): Promise<RoomMessage[]> {
  try {
    // Get text messages
    const { data: textMessages, error: textError } = await supabase
      .from('room_messages')
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
      .order('created_at', { ascending: true })
      .limit(100)

    if (textError) throw textError

    // Get audio messages
    const { data: audioMessages, error: audioError } = await supabase
      .from('room_audio_messages')
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
      .order('created_at', { ascending: true })
      .limit(50)

    if (audioError) throw audioError

    // Combine and sort by created_at
    const allMessages: RoomMessage[] = []

    // Add text messages with is_audio: false
    if (textMessages) {
      allMessages.push(...textMessages.map(msg => ({
        ...msg,
        is_audio: false,
        audio_url: null,
        duration: null
      })))
    }

    // Add audio messages with is_audio: true
    if (audioMessages) {
      allMessages.push(...audioMessages.map(msg => ({
        id: msg.id,
        content: null,
        wave_id: msg.wave_id,
        author_id: msg.author_id,
        audio_url: msg.audio_url,
        duration: msg.duration,
        is_audio: true,
        is_pinned: false,
        created_at: msg.created_at,
        author: msg.author
      })))
    }

    // Sort by created_at
    allMessages.sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )

    return allMessages
  } catch (error) {
    console.error('Error loading room messages:', error)
    throw error
  }
}

// Get only audio messages
export async function getRoomAudioMessages(waveId: string): Promise<RoomAudioMessage[]> {
  try {
    const { data, error } = await supabase
      .from('room_audio_messages')
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
      .order('created_at', { ascending: true })
      .limit(50)

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error loading audio messages:', error)
    throw error
  }
}

// Send text message with notification
export async function sendRoomMessage(
  waveId: string,
  authorId: string,
  content: string
): Promise<RoomMessage> {
  try {
    const { data, error } = await supabase
      .from('room_messages')
      .insert({
        content: content.trim(),
        wave_id: waveId,
        author_id: authorId,
        is_pinned: false
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

    // ✅ NOTIFY WAVE AUTHOR (if not the sender)
    try {
      const { data: wave } = await supabase
        .from('waves')
        .select('author_id, title')
        .eq('id', waveId)
        .single()

      const { data: actor } = await supabase
        .from('users')
        .select('name')
        .eq('id', authorId)
        .single()

      if (wave && wave.author_id !== authorId) {
        await createNotification(
          wave.author_id,
          'ROOM_MESSAGE',
          `${actor?.name || 'کاربر'} در اتاق "${wave.title}" پیام داد`,
          authorId,
          waveId,
          undefined,
          waveId
        )
      }
    } catch (notifError) {
      console.error('Error creating room message notification:', notifError)
    }

    return {
      ...data,
      is_audio: false,
      audio_url: null,
      duration: null
    }
  } catch (error) {
    console.error('Error sending message:', error)
    throw error
  }
}

// Send audio message with notification
export async function sendRoomAudioMessage(
  waveId: string,
  authorId: string,
  audioUrl: string,
  duration: number
): Promise<RoomAudioMessage> {
  try {
    // Check limit of 50 audio messages
    const { count, error: countError } = await supabase
      .from('room_audio_messages')
      .select('*', { count: 'exact', head: true })
      .eq('wave_id', waveId)

    if (countError) throw countError

    if (count && count >= 50) {
      throw new Error('محدودیت ۵۰ پیام صوتی در این اتاق تکمیل شده است')
    }

    const { data, error } = await supabase
      .from('room_audio_messages')
      .insert({
        audio_url: audioUrl,
        duration: duration,
        wave_id: waveId,
        author_id: authorId
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

    // ✅ NOTIFY WAVE AUTHOR (if not the sender)
    try {
      const { data: wave } = await supabase
        .from('waves')
        .select('author_id, title')
        .eq('id', waveId)
        .single()

      const { data: actor } = await supabase
        .from('users')
        .select('name')
        .eq('id', authorId)
        .single()

      if (wave && wave.author_id !== authorId) {
        await createNotification(
          wave.author_id,
          'ROOM_MESSAGE',
          `${actor?.name || 'کاربر'} یک پیام صوتی در اتاق "${wave.title}" ارسال کرد`,
          authorId,
          waveId,
          undefined,
          waveId
        )
      }
    } catch (notifError) {
      console.error('Error creating audio message notification:', notifError)
    }

    return data
  } catch (error) {
    console.error('Error sending audio message:', error)
    throw error
  }
}

// Send audio message and return as RoomMessage (for compatibility)
export async function sendAudioMessage(
  waveId: string,
  authorId: string,
  audioUrl: string,
  duration: number
): Promise<RoomMessage> {
  const result = await sendRoomAudioMessage(waveId, authorId, audioUrl, duration)
  return {
    id: result.id,
    content: null,
    wave_id: result.wave_id,
    author_id: result.author_id,
    audio_url: result.audio_url,
    duration: result.duration,
    is_audio: true,
    is_pinned: false,
    created_at: result.created_at,
    author: result.author
  }
}

// Pin a message
export async function pinRoomMessage(
  messageId: string,
  isPinned: boolean
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('room_messages')
      .update({ is_pinned: isPinned })
      .eq('id', messageId)

    if (error) throw error
    return true
  } catch (error) {
    console.error('Error pinning message:', error)
    throw error
  }
}

// Delete message
export async function deleteRoomMessage(
  messageId: string,
  userId: string
): Promise<boolean> {
  try {
    // Check if user is the author
    const { data: message, error: fetchError } = await supabase
      .from('room_messages')
      .select('author_id')
      .eq('id', messageId)
      .single()

    if (fetchError) throw fetchError
    if (message.author_id !== userId) {
      throw new Error('شما اجازه حذف این پیام را ندارید')
    }

    const { error } = await supabase
      .from('room_messages')
      .delete()
      .eq('id', messageId)

    if (error) throw error
    return true
  } catch (error) {
    console.error('Error deleting message:', error)
    throw error
  }
}

// Clear all messages in a room
export async function clearRoomMessages(
  waveId: string,
  userId: string
): Promise<boolean> {
  try {
    // Check if user is the room owner or admin (you can customize this)
    // For now, we'll allow the wave author to clear messages
    const { data: wave, error: waveError } = await supabase
      .from('waves')
      .select('author_id')
      .eq('id', waveId)
      .single()

    if (waveError) throw waveError
    
    if (wave.author_id !== userId) {
      throw new Error('شما اجازه پاک کردن پیام‌های این اتاق را ندارید')
    }

    // Delete all text messages
    const { error: textError } = await supabase
      .from('room_messages')
      .delete()
      .eq('wave_id', waveId)

    if (textError) throw textError

    // Delete all audio messages
    const { error: audioError } = await supabase
      .from('room_audio_messages')
      .delete()
      .eq('wave_id', waveId)

    if (audioError) throw audioError

    return true
  } catch (error) {
    console.error('Error clearing messages:', error)
    throw error
  }
}

// Get audio message count
export async function getAudioMessageCount(waveId: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('room_audio_messages')
      .select('*', { count: 'exact', head: true })
      .eq('wave_id', waveId)

    if (error) throw error
    return count || 0
  } catch (error) {
    console.error('Error getting audio count:', error)
    return 0
  }
}