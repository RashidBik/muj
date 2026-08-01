// import { supabase } from './supabase'

// export const ScoreActions = {
//   DAILY_LOGIN: 10,
//   PUBLISH_WAVE: 50,
//   LIKE_WAVE: 5,
//   COMMENT_WAVE: 10,
//   SHARE_WAVE: 15,
//   REFERRAL: 100,
//   DAILY_STREAK_BONUS: 20,
// } as const

// export type ScoreAction = keyof typeof ScoreActions

// export async function addScore(userId: string, action: ScoreAction) {
//   try {
//     const points = ScoreActions[action]
    
//     // استفاده از RPC برای افزایش امتیاز
//     const { error } = await supabase.rpc('increment_score', {
//       user_id_param: userId,
//       points_param: points,
//       reason_param: action
//     })

//     if (error) throw error

//     return { success: true, points }
//   } catch (error) {
//     console.error('خطا در افزودن امتیاز:', error)
//     return { success: false, points: 0 }
//   }
// }

// export async function getDailyReward(userId: string) {
//   try {
//     const today = new Date().toISOString().split('T')[0]
    
//     // بررسی اینکه امروز پاداش گرفته شده؟
//     const { data, error } = await supabase
//       .from('daily_rewards')
//       .select('*')
//       .eq('user_id', userId)
//       .eq('reward_date', today)
//       .single()

//     if (data) {
//       return { 
//         claimed: true, 
//         message: 'امروز پاداش گرفتید!',
//         points: data.amount 
//       }
//     }

//     // اضافه کردن پاداش
//     const points = 10 // مقدار پایه
//     const { error: insertError } = await supabase
//       .from('daily_rewards')
//       .insert({
//         user_id: userId,
//         amount: points,
//         reward_date: today,
//         claimed: true
//       })

//     if (insertError) throw insertError

//     // افزودن امتیاز به حساب کاربر
//     await addScore(userId, 'DAILY_LOGIN')
    
//     return { 
//       claimed: true, 
//       points,
//       message: 'پاداش روزانه دریافت شد!' 
//     }

//   } catch (error) {
//     console.error('خطا در دریافت پاداش روزانه:', error)
//     return { 
//       claimed: false, 
//       message: 'خطا در دریافت پاداش' 
//     }
//   }
// }

// export async function getUserScore(userId: string) {
//   try {
//     const { data, error } = await supabase
//       .from('user_scores')
//       .select('*')
//       .eq('user_id', userId)
//       .single()

//     if (error) throw error
//     return data
//   } catch (error) {
//     console.error('خطا در دریافت امتیاز:', error)
//     return null
//   }
// }