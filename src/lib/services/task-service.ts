import { supabase } from '$lib/client/supabase'
import { addTokens, getTokenBalance } from './token-service'
import { trackEvent } from './analytics-service'

export interface Task {
  id: string
  name: string
  description: string
  icon: string
  reward: number
  type: 'daily' | 'weekly' | 'monthly' | 'one_time'
  requirement: number
  requirement_type: 'reactions' | 'comments' | 'room_share' | 'room_message' | 'story' | 'active_minutes' | 'ads_watched'
  max_completions?: number
}

export interface UserTaskProgress {
  user_id: string
  task_id: string
  progress: number
  completed: boolean
  completed_at: string | null
  last_updated: string
}

// لیست تسک‌های روزانه
export const DAILY_TASKS: Task[] = [
  {
    id: 'daily_reactions',
    name: 'واکنش‌های روزانه',
    description: '۱۰ واکنش به موج‌های مختلف بدهید',
    icon: '❤️',
    reward: 1,
    type: 'daily',
    requirement: 10,
    requirement_type: 'reactions'
  },
  {
    id: 'daily_comments',
    name: 'نظرات روزانه',
    description: '۱۰ نظر مفید بنویسید',
    icon: '💬',
    reward: 1,
    type: 'daily',
    requirement: 10,
    requirement_type: 'comments'
  },
  {
    id: 'daily_room_share',
    name: 'حضور در اتاق',
    description: 'در یک اتاق شرکت کنید',
    icon: '🏠',
    reward: 1,
    type: 'daily',
    requirement: 1,
    requirement_type: 'room_share'
  },
  {
    id: 'daily_room_message',
    name: 'پیام در اتاق',
    description: 'یک پیام در اتاق ارسال کنید',
    icon: '📨',
    reward: 1,
    type: 'daily',
    requirement: 1,
    requirement_type: 'room_message'
  },
  {
    id: 'daily_story',
    name: 'استوری',
    description: 'یک استوری منتشر کنید',
    icon: '📖',
    reward: 1,
    type: 'daily',
    requirement: 1,
    requirement_type: 'story'
  },
  {
    id: 'daily_active',
    name: 'فعالیت روزانه',
    description: 'نیم ساعت در اپلیکیشن فعال باشید',
    icon: '⏱️',
    reward: 1,
    type: 'daily',
    requirement: 30,
    requirement_type: 'active_minutes'
  }
]

// تسک‌های ماهانه
export const MONTHLY_TASKS: Task[] = [
  {
    id: 'monthly_boost',
    name: 'بوست رایگان ماهانه',
    description: 'یک بوست رایگان برای موج خود دریافت کنید',
    icon: '🚀',
    reward: 1,
    type: 'monthly',
    requirement: 1,
    requirement_type: 'boost'
  }
]

// تسک‌های یکبار مصرف
export const ONE_TIME_TASKS: Task[] = [
  {
    id: 'first_wave',
    name: 'اولین موج',
    description: 'اولین موج خود را منتشر کنید',
    icon: '🌊',
    reward: 10,
    type: 'one_time',
    requirement: 1,
    requirement_type: 'wave_publish'
  },
  {
    id: 'first_follower',
    name: 'اولین دنبال‌کننده',
    description: 'اولین دنبال‌کننده را دریافت کنید',
    icon: '👤',
    reward: 5,
    type: 'one_time',
    requirement: 1,
    requirement_type: 'follower'
  },
  {
    id: 'first_like',
    name: 'اولین لایک',
    description: 'اولین لایک را دریافت کنید',
    icon: '❤️',
    reward: 5,
    type: 'one_time',
    requirement: 1,
    requirement_type: 'like_received'
  }
]

// دریافت وضعیت تسک‌های کاربر
export async function getUserTasks(userId: string): Promise<{
  daily: (Task & { progress: number; completed: boolean })[]
  monthly: (Task & { progress: number; completed: boolean })[]
  one_time: (Task & { progress: number; completed: boolean })[]
}> {
  try {
    // دریافت پیشرفت تسک‌های کاربر
    const { data: progressData, error } = await supabase
      .from('user_task_progress')
      .select('*')
      .eq('user_id', userId)

    if (error) throw error

    const progressMap = new Map<string, UserTaskProgress>()
    progressData?.forEach(p => {
      progressMap.set(p.task_id, p)
    })

    // ترکیب تسک‌ها با پیشرفت
    const daily = DAILY_TASKS.map(task => {
      const progress = progressMap.get(task.id)
      return {
        ...task,
        progress: progress?.progress || 0,
        completed: progress?.completed || false
      }
    })

    const monthly = MONTHLY_TASKS.map(task => {
      const progress = progressMap.get(task.id)
      return {
        ...task,
        progress: progress?.progress || 0,
        completed: progress?.completed || false
      }
    })

    const one_time = ONE_TIME_TASKS.map(task => {
      const progress = progressMap.get(task.id)
      return {
        ...task,
        progress: progress?.progress || 0,
        completed: progress?.completed || false
      }
    })

    return { daily, monthly, one_time }
  } catch (error) {
    console.error('Error getting user tasks:', error)
    return { daily: [], monthly: [], one_time: [] }
  }
}

// به‌روزرسانی پیشرفت تسک
export async function updateTaskProgress(
  userId: string,
  taskId: string,
  increment: number = 1
): Promise<boolean> {
  try {
    // دریافت تسک
    const allTasks = [...DAILY_TASKS, ...MONTHLY_TASKS, ...ONE_TIME_TASKS]
    const task = allTasks.find(t => t.id === taskId)
    if (!task) return false

    // دریافت پیشرفت فعلی
    const { data: existing, error: getError } = await supabase
      .from('user_task_progress')
      .select('*')
      .eq('user_id', userId)
      .eq('task_id', taskId)
      .maybeSingle()

    if (getError) throw getError

    let newProgress = (existing?.progress || 0) + increment
    let completed = false

    // بررسی تسک‌های یکبار مصرف
    if (task.type === 'one_time' && existing?.completed) {
      return true // قبلاً تکمیل شده
    }

    // بررسی تکمیل
    if (newProgress >= task.requirement) {
      newProgress = task.requirement
      completed = true

      // اعطای پاداش
      await addTokens(
        userId,
        task.reward,
        'TASK_COMPLETED',
        `پاداش تکمیل تسک: ${task.name}`,
        taskId
      )

      // ثبت رویداد
      await trackEvent({
        event_type: 'task_completed',
        event_data: {
          task_id: taskId,
          task_name: task.name,
          reward: task.reward
        }
      }, userId)
    }

    // به‌روزرسانی یا درج
    if (existing) {
      const { error: updateError } = await supabase
        .from('user_task_progress')
        .update({
          progress: newProgress,
          completed: completed,
          completed_at: completed ? new Date().toISOString() : existing.completed_at,
          last_updated: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('task_id', taskId)

      if (updateError) throw updateError
    } else {
      const { error: insertError } = await supabase
        .from('user_task_progress')
        .insert({
          user_id: userId,
          task_id: taskId,
          progress: newProgress,
          completed: completed,
          completed_at: completed ? new Date().toISOString() : null
        })

      if (insertError) throw insertError
    }

    return true
  } catch (error) {
    console.error('Error updating task progress:', error)
    return false
  }
}

// ریست تسک‌های روزانه
export async function resetDailyTasks(userId: string): Promise<void> {
  try {
    const today = new Date().toISOString().split('T')[0]
    
    // دریافت تسک‌های روزانه کاربر
    const { data: tasks, error } = await supabase
      .from('user_task_progress')
      .select('*')
      .eq('user_id', userId)
      .in('task_id', DAILY_TASKS.map(t => t.id))

    if (error) throw error

    // ریست کردن تسک‌هایی که امروز ریست نشده‌اند
    for (const task of tasks || []) {
      if (task.last_updated && new Date(task.last_updated).toISOString().split('T')[0] !== today) {
        await supabase
          .from('user_task_progress')
          .update({
            progress: 0,
            completed: false,
            last_updated: new Date().toISOString()
          })
          .eq('user_id', userId)
          .eq('task_id', task.task_id)
      }
    }
  } catch (error) {
    console.error('Error resetting daily tasks:', error)
  }
}