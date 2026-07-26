import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '$env/static/private'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// نوع‌های دیتابیس (بعداً از supabase generate می‌گیریم)
export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          name: string
          username: string
          bio: string | null
          avatar: string | null
          created_at: string
        }
        Insert: {
          id?: string
          email: string
          name: string
          username: string
          bio?: string | null
          avatar?: string | null
        }
      }
      waves: {
        Row: {
          id: string
          title: string
          audio_url: string
          cover_image: string | null
          duration: number
          category: string
          author_id: string
          created_at: string
          likes_count: number
          comments_count: number
        }
        Insert: {
          id?: string
          title: string
          audio_url: string
          cover_image?: string | null
          duration: number
          category: string
          author_id: string
        }
      }
      // ... بقیه جدول‌ها
    }
  }
}