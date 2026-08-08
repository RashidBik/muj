import { supabase } from '$lib/client/supabase'

export interface Report {
  id: string
  reporter_id: string
  wave_id: string
  reason: string
  description: string | null
  status: 'PENDING' | 'REVIEWED' | 'RESOLVED' | 'REJECTED'
  created_at: string
  updated_at: string
}

export type ReportReason = 
  | 'SPAM'
  | 'INAPPROPRIATE'
  | 'COPYRIGHT'
  | 'HARASSMENT'
  | 'HATE_SPEECH'
  | 'MISINFORMATION'
  | 'OTHER'

export const REPORT_REASONS: { value: ReportReason; label: string; icon: string }[] = [
  { value: 'SPAM', label: 'هرزنامه', icon: '📧' },
  { value: 'INAPPROPRIATE', label: 'محتوای نامناسب', icon: '🚫' },
  { value: 'COPYRIGHT', label: 'نقض کپی‌رایت', icon: '©️' },
  { value: 'HARASSMENT', label: 'آزار و اذیت', icon: '😤' },
  { value: 'HATE_SPEECH', label: 'گفتار نفرت‌انگیز', icon: '😡' },
  { value: 'MISINFORMATION', label: 'اطلاعات نادرست', icon: '❌' },
  { value: 'OTHER', label: 'سایر موارد', icon: '📝' }
]

// Report a wave
export async function reportWave(
  reporterId: string,
  waveId: string,
  reason: ReportReason,
  description?: string
): Promise<{ success: boolean; message: string }> {
  try {
    // Check if user already reported this wave
    const { data: existing, error: checkError } = await supabase
      .from('reports')
      .select('id')
      .eq('reporter_id', reporterId)
      .eq('wave_id', waveId)
      .maybeSingle()

    if (checkError) throw checkError

    if (existing) {
      return {
        success: false,
        message: 'شما قبلاً این موج را گزارش کرده‌اید'
      }
    }

    // Create report
    const { data, error } = await supabase
      .from('reports')
      .insert({
        reporter_id: reporterId,
        wave_id: waveId,
        reason: reason,
        description: description || null,
        status: 'PENDING'
      })
      .select()
      .single()

    if (error) throw error

    // Create notification for admin (you can implement this later)
    // await createNotification(adminId, 'REPORT', `گزارش جدید: ${reason}`, reporterId, waveId)

    return {
      success: true,
      message: 'گزارش شما با موفقیت ثبت شد. تیم ما بررسی خواهد کرد.'
    }

  } catch (error) {
    console.error('Error reporting wave:', error)
    return {
      success: false,
      message: 'خطا در ثبت گزارش. لطفاً دوباره تلاش کنید.'
    }
  }
}

// Check if user already reported a wave
export async function hasUserReportedWave(userId: string, waveId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('reports')
      .select('id')
      .eq('reporter_id', userId)
      .eq('wave_id', waveId)
      .maybeSingle()

    if (error) throw error
    return !!data
  } catch (error) {
    console.error('Error checking report:', error)
    return false
  }
}

// Get reports for a wave (admin only)
export async function getWaveReports(waveId: string): Promise<Report[]> {
  try {
    const { data, error } = await supabase
      .from('reports')
      .select(`
        *,
        reporter:users(
          id,
          name,
          username,
          avatar
        )
      `)
      .eq('wave_id', waveId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error getting reports:', error)
    return []
  }
}

// Update report status (admin only)
export async function updateReportStatus(
  reportId: string,
  status: 'PENDING' | 'REVIEWED' | 'RESOLVED' | 'REJECTED'
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('reports')
      .update({ 
        status: status,
        updated_at: new Date().toISOString()
      })
      .eq('id', reportId)

    if (error) throw error
    return true
  } catch (error) {
    console.error('Error updating report status:', error)
    return false
  }
}