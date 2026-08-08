import { supabase } from '$lib/client/supabase'
import { spendTokens, getTokenBalance, addTokens } from './token-service'
import { trackEvent } from './analytics-service'

export interface BoostPlan {
  id: string
  name: string
  duration_hours: number
  price: number
  description: string
  icon: string
}

export const BOOST_PLANS: BoostPlan[] = [
  {
    id: 'boost_12h',
    name: 'بوست ۱۲ ساعته',
    duration_hours: 12,
    price: 180,
    description: 'موج شما به مدت ۱۲ ساعت در بالای فید نمایش داده می‌شود',
    icon: '⚡'
  },
  {
    id: 'boost_24h',
    name: 'بوست ۲۴ ساعته',
    duration_hours: 24,
    price: 350,
    description: 'موج شما به مدت ۲۴ ساعت در بالای فید نمایش داده می‌شود',
    icon: '🔥'
  },
  {
    id: 'boost_weekly',
    name: 'بوست یک هفته‌ای',
    duration_hours: 168,
    price: 1200,
    description: 'موج شما به مدت یک هفته در بالای فید نمایش داده می‌شود',
    icon: '📅'
  },
  {
    id: 'boost_monthly',
    name: 'بوست یک ماهه',
    duration_hours: 720,
    price: 4000,
    description: 'موج شما به مدت یک ماه در بالای فید نمایش داده می‌شود',
    icon: '🌟'
  }
]

// دریافت بوست‌های فعال کاربر
export async function getUserActiveBoosts(userId: string): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('wave_boosts')
      .select(`
        *,
        wave:waves(id, title, audio_url)
      `)
      .eq('user_id', userId)
      .gt('expires_at', new Date().toISOString())
      .order('expires_at', { ascending: true })

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error getting user boosts:', error)
    return []
  }
}

// اعمال بوست روی موج
export async function applyBoost(
  userId: string,
  waveId: string,
  planId: string
): Promise<{ success: boolean; message: string }> {
  try {
    // پیدا کردن پلن
    const plan = BOOST_PLANS.find(p => p.id === planId)
    if (!plan) {
      return { success: false, message: 'پلن بوست معتبر نیست' }
    }

    // بررسی موجودی
    const balance = await getTokenBalance(userId)
    if (balance < plan.price) {
      return { 
        success: false, 
        message: `موجودی کافی نیست. نیاز به ${plan.price.toLocaleString()} توکن دارید. موجودی: ${balance.toLocaleString()} توکن` 
      }
    }

    // بررسی مالکیت موج
    const { data: wave, error: waveError } = await supabase
      .from('waves')
      .select('author_id, is_boosted, boost_expires_at')
      .eq('id', waveId)
      .single()

    if (waveError) throw waveError

    if (wave.author_id !== userId) {
      return { success: false, message: 'شما نمی‌توانید موج دیگران را بوست کنید' }
    }

    // بررسی بوست فعال
    if (wave.is_boosted && wave.boost_expires_at && new Date(wave.boost_expires_at) > new Date()) {
      return { success: false, message: 'این موج در حال حاضر بوست شده است' }
    }

    // پرداخت توکن
    const spent = await spendTokens(
      userId,
      plan.price,
      'BOOST_WAVE',
      `بوست ${plan.name} برای موج: ${waveId}`,
      waveId
    )

    if (!spent) {
      return { success: false, message: 'خطا در پرداخت توکن' }
    }

    // محاسبه زمان انقضا
    const expiresAt = new Date(Date.now() + plan.duration_hours * 60 * 60 * 1000)

    // اعمال بوست
    const { error: boostError } = await supabase
      .from('waves')
      .update({
        is_boosted: true,
        boost_expires_at: expiresAt.toISOString(),
        boost_count: (wave.boost_count || 0) + 1,
        boost_plan: planId,
        boosted_at: new Date().toISOString()
      })
      .eq('id', waveId)

    if (boostError) throw boostError

    // ثبت بوست در جدول جداگانه
    await supabase
      .from('wave_boosts')
      .insert({
        user_id: userId,
        wave_id: waveId,
        plan_id: planId,
        price: plan.price,
        duration_hours: plan.duration_hours,
        expires_at: expiresAt.toISOString()
      })

    // ثبت رویداد
    await trackEvent({
      event_type: 'boost_wave',
      event_data: {
        wave_id: waveId,
        plan_id: planId,
        plan_name: plan.name,
        price: plan.price,
        duration_hours: plan.duration_hours
      }
    }, userId)

    // بررسی بوست رایگان ماهانه
    await checkFreeMonthlyBoost(userId)

    return { 
      success: true, 
      message: `✅ موج با موفقیت ${plan.name} شد! تا ${plan.duration_hours} ساعت در بالای فید نمایش داده می‌شود.` 
    }

  } catch (error) {
    console.error('Error applying boost:', error)
    return { success: false, message: 'خطا در اعمال بوست. لطفاً دوباره تلاش کنید.' }
  }
}

// بررسی بوست رایگان ماهانه
async function checkFreeMonthlyBoost(userId: string): Promise<void> {
  try {
    // بررسی اینکه آیا کاربر امسال بوست رایگان گرفته
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)

    const { data: boosts, error } = await supabase
      .from('wave_boosts')
      .select('id')
      .eq('user_id', userId)
      .eq('is_free', true)
      .gte('created_at', startOfMonth.toISOString())
      .lte('created_at', endOfMonth.toISOString())

    if (error) throw error

    // اگر کاربر هنوز بوست رایگان امسال نگرفته
    if (!boosts || boosts.length === 0) {
      // اعطای بوست رایگان
      const freeBoostPlan = BOOST_PLANS.find(p => p.id === 'boost_24h')
      if (freeBoostPlan) {
        // اعمال بوست رایگان روی جدیدترین موج کاربر
        const { data: latestWave } = await supabase
          .from('waves')
          .select('id')
          .eq('author_id', userId)
          .eq('status', 'PUBLISHED')
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (latestWave) {
          const expiresAt = new Date(Date.now() + freeBoostPlan.duration_hours * 60 * 60 * 1000)

          await supabase
            .from('waves')
            .update({
              is_boosted: true,
              boost_expires_at: expiresAt.toISOString(),
              boost_count: (latestWave.boost_count || 0) + 1,
              boost_plan: 'free_monthly',
              boosted_at: new Date().toISOString()
            })
            .eq('id', latestWave.id)

          await supabase
            .from('wave_boosts')
            .insert({
              user_id: userId,
              wave_id: latestWave.id,
              plan_id: 'free_monthly',
              price: 0,
              duration_hours: freeBoostPlan.duration_hours,
              expires_at: expiresAt.toISOString(),
              is_free: true
            })

          // پاداش توکن برای دریافت بوست رایگان
          await addTokens(
            userId,
            10,
            'FREE_BOOST_BONUS',
            'پاداش دریافت بوست رایگان ماهانه'
          )

          await trackEvent({
            event_type: 'free_boost_earned',
            event_data: {
              wave_id: latestWave.id,
              month: now.getMonth() + 1,
              year: now.getFullYear()
            }
          }, userId)
        }
      }
    }
  } catch (error) {
    console.error('Error checking free monthly boost:', error)
  }
}

// دریافت تاریخچه بوست‌های کاربر
export async function getUserBoostHistory(
  userId: string,
  limit: number = 20
): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('wave_boosts')
      .select(`
        *,
        wave:waves(id, title)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error getting boost history:', error)
    return []
  }
}