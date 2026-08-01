import { supabase } from '$lib/client/supabase'

export interface ReferralStats {
  total_referrals: number
  total_rewards: number
  pending_rewards: number
}

export interface Referral {
  id: string
  referrer_id: string
  referred_id: string
  reward_claimed: boolean
  created_at: string
  referred?: {
    id: string
    name: string
    username: string
    avatar: string | null
  }
}

// Get user's referral code
export async function getReferralCode(userId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('referral_codes')
      .select('code')
      .eq('user_id', userId)
      .single()

    if (error) throw error
    return data?.code || null
  } catch (error) {
    console.error('Error getting referral code:', error)
    return null
  }
}

// Create referral code (if doesn't exist)
export async function createReferralCode(userId: string): Promise<string | null> {
  try {
    // Check if code exists
    const existing = await getReferralCode(userId)
    if (existing) return existing

    // Generate new code
    const { data, error } = await supabase
      .rpc('generate_referral_code')
      .single()

    if (error) throw error

    // Save code
    const { data: insertData, error: insertError } = await supabase
      .from('referral_codes')
      .insert({
        user_id: userId,
        code: data
      })
      .select('code')
      .single()

    if (insertError) throw insertError
    return insertData?.code || null

  } catch (error) {
    console.error('Error creating referral code:', error)
    return null
  }
}

// Get referral stats
export async function getReferralStats(userId: string): Promise<ReferralStats> {
  try {
    const { data, error } = await supabase
      .rpc('get_referral_stats', {
        user_id_param: userId
      })

    if (error) throw error
    return data || { total_referrals: 0, total_rewards: 0, pending_rewards: 0 }
  } catch (error) {
    console.error('Error getting referral stats:', error)
    return { total_referrals: 0, total_rewards: 0, pending_rewards: 0 }
  }
}

// Get referral list
export async function getReferrals(userId: string): Promise<Referral[]> {
  try {
    const { data, error } = await supabase
      .from('referrals')
      .select(`
        *,
        referred:users!referred_id(
          id,
          name,
          username,
          avatar
        )
      `)
      .eq('referrer_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error getting referrals:', error)
    return []
  }
}

// Process referral (call when user signs up with referral code)
export async function processReferral(
  referrerCode: string,
  referredUserId: string
): Promise<{ success: boolean; message: string }> {
  try {
    // Get referrer by code
    const { data: referrer, error: codeError } = await supabase
      .from('referral_codes')
      .select('user_id')
      .eq('code', referrerCode)
      .single()

    if (codeError || !referrer) {
      return { success: false, message: 'کد دعوت نامعتبر است.' }
    }

    // Check if already referred
    const { data: existing, error: checkError } = await supabase
      .from('referrals')
      .select('id')
      .eq('referred_id', referredUserId)
      .maybeSingle()

    if (existing) {
      return { success: false, message: 'این کاربر قبلاً دعوت شده است.' }
    }

    // Process referral
    const { error } = await supabase
      .rpc('process_referral', {
        referrer_id_param: referrer.user_id,
        referred_id_param: referredUserId
      })

    if (error) throw error

    return { 
      success: true, 
      message: '✅ دعوت با موفقیت ثبت شد! ۵۰ توکن دریافت کردید.' 
    }

  } catch (error) {
    console.error('Error processing referral:', error)
    return { success: false, message: 'خطا در ثبت دعوت. لطفاً دوباره تلاش کنید.' }
  }
}

// Copy referral link to clipboard
export function getReferralLink(code: string): string {
  const baseUrl = window.location.origin
  return `${baseUrl}/auth/register?ref=${code}`
}