import { supabase } from '$lib/client/supabase'

export interface TokenBalance {
  balance: number
  total_earned: number
  total_spent: number
}

export interface TokenTransaction {
  id: string
  user_id: string
  type: string
  amount: number
  description: string
  reference_id: string | null
  created_at: string
}

// Get user token balance - FIXED
export async function getTokenBalance(userId: string): Promise<number> {
  try {
    // Use the RPC function for cleaner query
    const { data, error } = await supabase
      .rpc('get_token_balance', {
        user_id_param: userId
      })

    if (error) {
      console.error('RPC error:', error)
      // Fallback to direct query
      const { data: directData, error: directError } = await supabase
        .from('user_tokens')
        .select('balance')
        .eq('user_id', userId)
        .maybeSingle()

      if (directError) {
        console.error('Direct query error:', directError)
        return 0
      }

      return directData?.balance || 0
    }

    return data || 0
  } catch (error) {
    console.error('Error getting token balance:', error)
    return 0
  }
}

// Get token transactions - FIXED
export async function getTokenTransactions(
  userId: string,
  limit: number = 20
): Promise<TokenTransaction[]> {
  try {
    const { data, error } = await supabase
      .from('token_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error getting transactions:', error)
    return []
  }
}

// Add tokens (earn) - FIXED
export async function addTokens(
  userId: string,
  amount: number,
  type: string,
  description?: string,
  referenceId?: string
): Promise<boolean> {
  try {
    const { error } = await supabase.rpc('add_tokens', {
      user_id_param: userId,
      amount_param: amount,
      type_param: type,
      description_param: description || null,
      reference_id_param: referenceId || null
    })

    if (error) {
      console.error('Add tokens error:', error)
      return false
    }
    return true
  } catch (error) {
    console.error('Error adding tokens:', error)
    return false
  }
}

// Spend tokens - FIXED
export async function spendTokens(
  userId: string,
  amount: number,
  type: string,
  description?: string,
  referenceId?: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('spend_tokens', {
      user_id_param: userId,
      amount_param: amount,
      type_param: type,
      description_param: description || null,
      reference_id_param: referenceId || null
    })

    if (error) {
      console.error('Spend tokens error:', error)
      return false
    }
    return data || false
  } catch (error) {
    console.error('Error spending tokens:', error)
    return false
  }
}

// Initialize user tokens - FIXED
export async function initializeUserTokens(userId: string): Promise<boolean> {
  try {
    // Check if user already has tokens
    const { data: existing } = await supabase
      .from('user_tokens')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle()

    if (existing) {
      return true // Already has tokens
    }

    // Insert new token record
    const { error } = await supabase
      .from('user_tokens')
      .insert({
        user_id: userId,
        balance: 10 // Starting bonus
      })

    if (error) throw error
    
    // Add welcome bonus transaction
    await supabase
      .from('token_transactions')
      .insert({
        user_id: userId,
        type: 'WELCOME_BONUS',
        amount: 10,
        description: 'پاداش خوش‌آمدگویی'
      })

    return true
  } catch (error) {
    console.error('Error initializing tokens:', error)
    return false
  }
}

// Token reward types
export const TokenRewards = {
  DAILY_LOGIN: 10,
  PUBLISH_WAVE: 25,
  LIKE_RECEIVED: 2,
  COMMENT_RECEIVED: 3,
  REFERRAL: 50,
  WAVE_BOOST: 15,
  DAILY_STREAK: 20,
  WELCOME_BONUS: 10,
} as const

// Token spend types
export const TokenSpends = {
  BOOST_WAVE: 30,
  GIFT_TO_USER: 10,
  UNLOCK_FEATURE: 50,
} as const

// ✅ Add boost wave function
export async function boostWave(
  userId: string,
  waveId: string
): Promise<{ success: boolean; message: string }> {
  try {
    // Check if user has enough tokens
    const balance = await getTokenBalance(userId)
    
    if (balance < TokenSpends.BOOST_WAVE) {
      return { 
        success: false, 
        message: `توکن کافی نیست. نیاز به ${TokenSpends.BOOST_WAVE} توکن دارید.` 
      }
    }

    // Check if wave is already boosted
    const { data: wave, error: waveError } = await supabase
      .from('waves')
      .select('is_boosted, boost_expires_at, author_id')
      .eq('id', waveId)
      .single()

    if (waveError) throw waveError

    if (wave.is_boosted && wave.boost_expires_at && new Date(wave.boost_expires_at) > new Date()) {
      return { 
        success: false, 
        message: 'این موج در حال حاضر تقویت شده است.' 
      }
    }

    // Check if user is the author
    if (wave.author_id !== userId) {
      return { 
        success: false, 
        message: 'شما نمی‌توانید موج دیگران را تقویت کنید.' 
      }
    }

    // Spend tokens
    const spent = await spendTokens(
      userId,
      TokenSpends.BOOST_WAVE,
      'BOOST_WAVE',
      `تقویت موج: ${waveId}`
    )

    if (!spent) {
      return { 
        success: false, 
        message: 'خطا در پرداخت توکن. لطفاً دوباره تلاش کنید.' 
      }
    }

    // Boost the wave (24 hours)
    const { error: boostError } = await supabase
      .from('waves')
      .update({
        is_boosted: true,
        boost_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        boost_count: (wave.boost_count || 0) + 1
      })
      .eq('id', waveId)

    if (boostError) throw boostError

    return { 
      success: true, 
      message: '✅ موج با موفقیت تقویت شد! برای ۲۴ ساعت در بالای فید نمایش داده می‌شود.' 
    }

  } catch (error) {
    console.error('Error boosting wave:', error)
    return { 
      success: false, 
      message: 'خطا در تقویت موج. لطفاً دوباره تلاش کنید.' 
    }
  }
}

// ✅ Get boosted waves (for feed)
export async function getBoostedWaves(): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('waves')
      .select(`
        *,
        author:users(
          id,
          name,
          username,
          avatar
        )
      `)
      .eq('is_boosted', true)
      .gt('boost_expires_at', new Date().toISOString())
      .order('boost_count', { ascending: false })
      .limit(5)

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error getting boosted waves:', error)
    return []
  }
}