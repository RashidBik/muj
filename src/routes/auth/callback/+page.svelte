<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { supabase } from '$lib/client/supabase'
  import { user } from '$lib/stores/user'
  import { session } from '$lib/stores/auth' // ✅ Import session store

  let status = $state('در حال ورود...')
  let error = $state('')

  onMount(async () => {
    try {
      console.log('🔐 Callback page mounted')
      
      // دریافت session از Supabase
      const { data: { session: supabaseSession }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError) {
        console.error('Session error:', sessionError)
        throw sessionError
      }

      console.log('🔐 Session received:', supabaseSession?.user?.email || 'No session')

      if (!supabaseSession?.user) {
        status = '❌ کاربر پیدا نشد'
        setTimeout(() => goto('/auth/login'), 2000)
        return
      }

      const userId = supabaseSession.user.id
      
      // ✅ Save session to localStorage and store
      if (typeof window !== 'undefined') {
        localStorage.setItem('sb-session', JSON.stringify(supabaseSession))
        session.set(supabaseSession)
        console.log('✅ Session saved to localStorage')
      }
      
      // دریافت کاربر از دیتابیس
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, email, name, username, avatar, bio')
        .eq('id', userId)
        .maybeSingle()

      if (userError) {
        console.error('User fetch error:', userError)
        status = '❌ خطا در دریافت اطلاعات'
        throw userError
      }

      // اگر کاربر وجود نداشت، ثبت‌نام می‌کنیم
      if (!userData) {
        console.log('📝 Creating new user...')
        
        const newUser = {
          id: userId,
          email: supabaseSession.user.email,
          name: supabaseSession.user.user_metadata?.name || supabaseSession.user.email?.split('@')[0] || 'کاربر',
          username: (supabaseSession.user.user_metadata?.name || supabaseSession.user.email?.split('@')[0] || 'user') + '_' + Math.random().toString(36).slice(2, 6),
          avatar: supabaseSession.user.user_metadata?.avatar_url || null,
          bio: ''
        }

        const { data: insertedUser, error: insertError } = await supabase
          .from('users')
          .insert(newUser)
          .select('id, email, name, username, avatar, bio')
          .maybeSingle()

        if (insertError) {
          console.error('Insert error:', insertError)
          throw insertError
        }

        // ایجاد امتیاز اولیه
        await supabase
          .from('user_scores')
          .insert({
            user_id: userId,
            total_score: 10,
            daily_score: 0,
            weekly_score: 0,
            streak_days: 0
          })

        if (insertedUser) {
          user.set({
            id: insertedUser.id,
            email: insertedUser.email,
            name: insertedUser.name,
            username: insertedUser.username,
            avatar: insertedUser.avatar,
            bio: insertedUser.bio || ''
          })
          status = '✅ ثبت‌نام و ورود موفق!'
          console.log('✅ User created and logged in:', insertedUser.username)
        }
      } else {
        // کاربر وجود دارد
        console.log('✅ User found:', userData.username)
        user.set({
          id: userData.id,
          email: userData.email,
          name: userData.name,
          username: userData.username,
          avatar: userData.avatar,
          bio: userData.bio || ''
        })
        status = '✅ ورود موفق!'
      }

      // ✅ Verify session is saved
      const storedSession = localStorage.getItem('sb-session')
      console.log('📦 Stored session:', storedSession ? '✅ Yes' : '❌ No')

      // هدایت به صفحه اصلی
      setTimeout(() => {
        goto('/')
      }, 1000)

    } catch (err: any) {
      console.error('❌ Error in callback:', err)
      error = err.message || 'خطا در ورود'
      status = '❌ خطا در ورود'
      setTimeout(() => {
        goto('/auth/login')
      }, 3000)
    }
  })
</script>

<div class="callback-page">
  <div class="callback-container">
    <div class="spinner"></div>
    <p>{status}</p>
    {#if error}
      <p class="error">{error}</p>
    {/if}
  </div>
</div>

<style>
  .callback-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: white;
  }

  .callback-container {
    text-align: center;
  }

  .spinner {
    width: 50px;
    height: 50px;
    border: 4px solid #e4e6eb;
    border-top-color: #1877f2;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin: 0 auto 16px;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .callback-container p {
    font-size: 18px;
    color: #050505;
  }

  .error {
    color: #dc3545;
    font-size: 14px;
    margin-top: 8px;
  }
</style>