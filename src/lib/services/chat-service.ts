import { supabase } from '$lib/client/supabase'
import type { User } from '$lib/stores/user'

export interface Message {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  is_read: boolean
  read_at: string | null
  created_at: string
  sender?: {
    id: string
    name: string
    username: string
    avatar: string | null
  }
}

export interface Conversation {
  id: string
  created_at: string
  updated_at: string
  participants: User[]
  last_message?: Message
  unread_count?: number
}

// دریافت یا ایجاد مکالمه بین دو کاربر
export async function getOrCreateConversation(user1Id: string, user2Id: string): Promise<string> {
  try {
    const { data, error } = await supabase
      .rpc('get_or_create_conversation', {
        user1_id: user1Id,
        user2_id: user2Id
      })

    if (error) throw error
    return data
  } catch (error) {
    console.error('Error getting/creating conversation:', error)
    throw error
  }
}

// دریافت لیست مکالمات کاربر
export async function getUserConversations(userId: string): Promise<Conversation[]> {
  try {
    // دریافت مکالمات کاربر
    const { data: conversations, error: convError } = await supabase
      .from('conversation_participants')
      .select(`
        conversation_id,
        conversations:conversation_id (
          id,
          created_at,
          updated_at
        )
      `)
      .eq('user_id', userId)
      .order('conversations(updated_at)', { ascending: false })

    if (convError) throw convError
    if (!conversations || conversations.length === 0) return []

    const convIds = conversations.map(c => c.conversation_id)

    // دریافت شرکت‌کنندگان هر مکالمه
    const { data: participants, error: partError } = await supabase
      .from('conversation_participants')
      .select(`
        conversation_id,
        user:users(
          id,
          name,
          username,
          avatar
        )
      `)
      .in('conversation_id', convIds)
      .neq('user_id', userId)

    if (partError) throw partError

    // دریافت آخرین پیام هر مکالمه
    const { data: lastMessages, error: msgError } = await supabase
      .from('messages')
      .select(`
        *,
        sender:users(
          id,
          name,
          username,
          avatar
        )
      `)
      .in('conversation_id', convIds)
      .order('created_at', { ascending: false })
      .limit(1)

    if (msgError) throw msgError

    // دریافت تعداد پیام‌های خوانده نشده
    const { data: unreadData, error: unreadError } = await supabase
      .from('messages')
      .select('conversation_id', { count: 'exact' })
      .in('conversation_id', convIds)
      .eq('is_read', false)
      .neq('sender_id', userId)

    if (unreadError) throw unreadError

    // گروه‌بندی پیام‌های خوانده نشده
    const unreadCounts: Record<string, number> = {}
    unreadData?.forEach((msg: any) => {
      unreadCounts[msg.conversation_id] = (unreadCounts[msg.conversation_id] || 0) + 1
    })

    // ساخت لیست مکالمات
    const result: Conversation[] = conversations.map(conv => {
      const convData = conv.conversations
      const convParticipants = participants
        ?.filter(p => p.conversation_id === conv.conversation_id)
        .map(p => p.user) || []

      const lastMsg = lastMessages?.find(m => m.conversation_id === conv.conversation_id)

      return {
        id: conv.conversation_id,
        created_at: convData.created_at,
        updated_at: convData.updated_at,
        participants: convParticipants as User[],
        last_message: lastMsg,
        unread_count: unreadCounts[conv.conversation_id] || 0
      }
    })

    return result
  } catch (error) {
    console.error('Error getting conversations:', error)
    return []
  }
}

// دریافت پیام‌های یک مکالمه
export async function getConversationMessages(
  conversationId: string,
  limit: number = 50,
  offset: number = 0
): Promise<Message[]> {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select(`
        *,
        sender:users(
          id,
          name,
          username,
          avatar
        )
      `)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error
    return data?.reverse() || []
  } catch (error) {
    console.error('Error getting messages:', error)
    return []
  }
}

// ارسال پیام
export async function sendMessage(
  conversationId: string,
  senderId: string,
  content: string
): Promise<Message | null> {
  try {
    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: senderId,
        content: content.trim()
      })
      .select(`
        *,
        sender:users(
          id,
          name,
          username,
          avatar
        )
      `)
      .single()

    if (error) throw error

    // به‌روزرسانی زمان آخرین فعالیت مکالمه
    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId)

    return data
  } catch (error) {
    console.error('Error sending message:', error)
    return null
  }
}

// علامت‌گذاری پیام‌ها به عنوان خوانده شده
export async function markMessagesAsRead(conversationId: string, userId: string): Promise<void> {
  try {
    await supabase
      .from('messages')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .neq('sender_id', userId)
      .eq('is_read', false)
  } catch (error) {
    console.error('Error marking messages as read:', error)
  }
}

// دریافت آخرین فعالیت کاربران (برای وضعیت آنلاین)
// In lib/services/chat-service.ts

// دریافت آخرین فعالیت کاربران (برای وضعیت آنلاین)
export async function getUsersStatus(userIds: string[]): Promise<Record<string, boolean>> {
  try {
    // If no userIds, return empty object
    if (!userIds || userIds.length === 0) {
      return {}
    }

    // Check if the column exists first, if not, use a different approach
    // For now, let's just return all as offline or use a simpler approach
    const status: Record<string, boolean> = {}
    
    // Option 1: If you have a 'last_seen' or 'updated_at' column instead
    // Try to get user data
    const { data, error } = await supabase
      .from('users')
      .select('id, updated_at')
      .in('id', userIds)

    if (error) {
      console.error('Error getting users status:', error)
      // If column doesn't exist, mark all as offline
      userIds.forEach(id => {
        status[id] = false
      })
      return status
    }

    const now = new Date()
    data?.forEach(user => {
      if (user.updated_at) {
        const lastActive = new Date(user.updated_at)
        const diff = now.getTime() - lastActive.getTime()
        status[user.id] = diff < 5 * 60 * 1000 // 5 دقیقه
      } else {
        status[user.id] = false
      }
    })

    return status
  } catch (error) {
    console.error('Error getting users status:', error)
    // Return all as offline
    const status: Record<string, boolean> = {}
    userIds.forEach(id => {
      status[id] = false
    })
    return status
  }
}