import { supabase } from '$lib/client/supabase'
import { addTokens, getTokenBalance } from './token-service'
import { trackEvent } from './analytics-service'

// آمار تبلیغات کاربر
export async function getUserAdStats(userId: string): Promise<{
  total_watched: number
  tokens_earned: number
  today_watched: number
  next_reward_at: number
}> {
  try {
    // دریافت تعداد تبلیغات امروز
    const today = new Date().toISOString().split('T')[0]
    const { count: todayCount, error: todayError } = await supabase
      .from('ad_watches')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('watched_at', today)

    if (todayError) throw todayError

    // دریافت کل تبلیغات
    const { count: totalCount, error: totalError } = await supabase
      .from('ad_watches')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)

    if (totalError) throw totalError

    // دریافت کل توکن‌های کسب شده از تبلیغات
    const { data: transactions, error: transError } = await supabase
      .from('token_transactions')
      .select('amount')
      .eq('user_id', userId)
      .eq('type', 'AD_REWARD')

    if (transError) throw transError

    const totalEarned = transactions?.reduce((sum, t) => sum + t.amount, 0) || 0

    // محاسبه چند تبلیغ تا توکن بعدی
    const nextRewardAt = 10 - (todayCount || 0) % 10

    return {
      total_watched: totalCount || 0,
      tokens_earned: totalEarned,
      today_watched: todayCount || 0,
      next_reward_at: nextRewardAt || 10
    }
  } catch (error) {
    console.error('Error getting user ad stats:', error)
    return {
      total_watched: 0,
      tokens_earned: 0,
      today_watched: 0,
      next_reward_at: 10
    }
  }
}

// ثبت تماشای تبلیغات
export async function watchAd(userId: string): Promise<{
  success: boolean
  earned_token: boolean
  token_amount: number
  message: string
}> {
  try {
    // ثبت تماشا
    const { error: insertError } = await supabase
      .from('ad_watches')
      .insert({
        user_id: userId,
        watched_at: new Date().toISOString()
      })

    if (insertError) throw insertError

    // دریافت تعداد تبلیغات امروز
    const today = new Date().toISOString().split('T')[0]
    const { count, error: countError } = await supabase
      .from('ad_watches')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('watched_at', today)

    if (countError) throw countError

    // هر ۱۰ تبلیغ یک توکن
    const watchCount = count || 0
    const earnedToken = watchCount % 10 === 0
    const tokenAmount = earnedToken ? 1 : 0

    if (earnedToken) {
      // اعطای توکن
      await addTokens(
        userId,
        tokenAmount,
        'AD_REWARD',
        `پاداش تماشای ${watchCount} تبلیغ`,
        `ad_${Date.now()}`
      )

      // ثبت رویداد
      await trackEvent({
        event_type: 'ad_watched',
        event_data: {
          total_watched: watchCount,
          token_earned: tokenAmount
        }
      }, userId)
    }

    return {
      success: true,
      earned_token: earnedToken,
      token_amount: tokenAmount,
      message: earnedToken 
        ? `🎉 تبریک! ${tokenAmount} توکن دریافت کردید!` 
        : `${10 - (watchCount % 10)} تبلیغ دیگر تا دریافت توکن بعدی`
    }
  } catch (error) {
    console.error('Error watching ad:', error)
    return {
      success: false,
      earned_token: false,
      token_amount: 0,
      message: 'خطا در ثبت تبلیغ. لطفاً دوباره تلاش کنید.'
    }
  }
}