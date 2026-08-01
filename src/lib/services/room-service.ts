import { supabase } from '$lib/client/supabase'
import type { User } from '$lib/stores/user'

export interface RoomMessage {
  id: string
  content: string
  wave_id: string
  author_id: string
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

// دریافت پیام‌های متنی اتاق
export async function getRoomMessages(waveId: string): Promise<RoomMessage[]> {
  try {
    const { data, error } = await supabase
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

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('خطا در دریافت پیام‌های اتاق:', error)
    throw error
  }
}

// دریافت پیام‌های صوتی اتاق
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
    console.error('خطا در دریافت پیام‌های صوتی:', error)
    throw error
  }
}

// ارسال پیام متنی
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
    return data
  } catch (error) {
    console.error('خطا در ارسال پیام:', error)
    throw error
  }
}

// ارسال پیام صوتی
export async function sendRoomAudioMessage(
  waveId: string,
  authorId: string,
  audioUrl: string,
  duration: number
): Promise<RoomAudioMessage> {
  try {
    // بررسی محدودیت ۵۰ پیام صوتی
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
    return data
  } catch (error) {
    console.error('خطا در ارسال پیام صوتی:', error)
    throw error
  }
}

// پین کردن پیام
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
    console.error('خطا در پین کردن پیام:', error)
    throw error
  }
}

// حذف پیام
export async function deleteRoomMessage(
  messageId: string,
  userId: string
): Promise<boolean> {
  try {
    // بررسی اینکه کاربر نویسنده پیام است
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
    console.error('خطا در حذف پیام:', error)
    throw error
  }
}

// دریافت تعداد پیام‌های صوتی
export async function getAudioMessageCount(waveId: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('room_audio_messages')
      .select('*', { count: 'exact', head: true })
      .eq('wave_id', waveId)

    if (error) throw error
    return count || 0
  } catch (error) {
    console.error('خطا در دریافت تعداد پیام‌های صوتی:', error)
    return 0
  }
}