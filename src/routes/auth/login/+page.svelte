<script lang="ts">
  import { goto } from '$app/navigation'
  import { supabase } from '$lib/client/supabase'
  import { user } from '$lib/stores/user'
  import { session } from '$lib/stores/auth'
  import { onMount } from 'svelte'

  let email = $state('')
  let password = $state('')
  let loading = $state(false)
  let error = $state('')
  let success = $state('')
  let loginStatus = $state('')

  async function handleLogin(e: Event) {
    e.preventDefault() // ✅ Prevent default manually
    error = ''
    success = ''
    loginStatus = ''

    if (!email.trim() || !password) {
      error = 'لطفاً ایمیل و رمز عبور را وارد کنید.'
      return
    }

    loading = true
    loginStatus = 'در حال ورود...'

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      })

      if (authError) throw authError

      if (data.user) {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id, email, name, username, avatar, bio')
          .eq('id', data.user.id)
          .maybeSingle()

        if (userError) throw userError

        if (userData) {
          user.set({
            id: userData.id,
            email: userData.email,
            name: userData.name,
            username: userData.username,
            avatar: userData.avatar,
            bio: userData.bio || ''
          })
          
          if (data.session && typeof window !== 'undefined') {
            localStorage.setItem('sb-session', JSON.stringify(data.session))
            session.set(data.session)
            console.log('✅ Session saved to localStorage from login')
          }
        }

        success = 'خوش آمدید!'
        setTimeout(() => {
          goto('/')
        }, 1000)
      }

    } catch (err: any) {
      console.error('خطا در ورود:', err)
      loginStatus = ''
      if (err.message?.includes('Invalid login credentials')) {
        error = 'ایمیل یا رمز عبور اشتباه است.'
      } else {
        error = err.message || 'خطا در ورود. لطفاً دوباره تلاش کنید.'
      }
    } finally {
      loading = false
      loginStatus = ''
    }
  }

  async function handleGoogleLogin() {
    loading = true
    loginStatus = 'در حال اتصال به گوگل...'
    
    try {
      const { data, error: authError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      })

      if (authError) throw authError
    } catch (err: any) {
      console.error('خطا در ورود با گوگل:', err)
      error = 'خطا در ورود با گوگل. لطفاً دوباره تلاش کنید.'
      loading = false
      loginStatus = ''
    }
  }

  onMount(async () => {
    const { data: { session: existingSession } } = await supabase.auth.getSession()
    if (existingSession?.user) {
      goto('/')
    }
  })
</script>

<div class="auth-page">
  <div class="auth-container">
    <div class="auth-header">
      <h1>🎵 موج</h1>
      <p>به جامعه‌ی صوتی خوش آمدید</p>
    </div>

    <!-- ✅ Use onsubmit (without colon) with runes mode -->
    <form class="auth-form" onsubmit={handleLogin}>
      {#if error}
        <div class="error-message">❌ {error}</div>
      {/if}
      
      {#if success}
        <div class="success-message">✅ {success}</div>
      {/if}

      {#if loginStatus}
        <div class="info-message">⏳ {loginStatus}</div>
      {/if}

      <div class="form-group">
        <label for="login-email">آدرس ایمیل</label>
        <input
          id="login-email"
          type="email"
          placeholder="example@email.com"
          bind:value={email}
          class="form-input"
        />
      </div>

      <div class="form-group">
        <label for="login-password">رمز عبور</label>
        <input
          id="login-password"
          type="password"
          placeholder="رمز عبور خود را وارد کنید"
          bind:value={password}
          class="form-input"
        />
      </div>

      <button
        type="submit"
        class="submit-btn"
        disabled={loading}
      >
        {#if loading}
          ⏳ در حال ورود...
        {:else}
          🔑 ورود
        {/if}
      </button>
    </form>

    <div class="divider">
      <span>یا</span>
    </div>

    <button
      class="google-btn"
      onclick={handleGoogleLogin}
      disabled={loading}
    >
      <svg width="20" height="20" viewBox="0 0 48 48">
        <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
        <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
        <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
        <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
      </svg>
      ورود با گوگل
    </button>

    <div class="auth-footer">
      حساب کاربری ندارید؟
      <a href="/auth/register">ثبت‌نام کنید</a>
    </div>
  </div>
</div>

<style>
  .auth-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #1877f2 0%, #6c5ce7 100%);
    padding: 20px;
  }

  .auth-container {
    background: white;
    border-radius: 16px;
    padding: 40px;
    max-width: 400px;
    width: 100%;
    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
  }

  .auth-header {
    text-align: center;
    margin-bottom: 32px;
  }

  .auth-header h1 {
    font-size: 32px;
    margin: 0;
    color: #050505;
  }

  .auth-header p {
    color: #65676b;
    margin: 8px 0 0 0;
  }

  .auth-form {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .form-group label {
    font-size: 14px;
    font-weight: 600;
    color: #050505;
  }

  .form-input {
    padding: 12px;
    border: 1px solid #d0d7de;
    border-radius: 8px;
    font-size: 15px;
    transition: border-color 0.2s;
  }

  .form-input:focus {
    outline: none;
    border-color: #1877f2;
    box-shadow: 0 0 0 3px rgba(24, 119, 242, 0.1);
  }

  .error-message {
    background: #fee;
    color: #dc3545;
    padding: 10px;
    border-radius: 8px;
    font-size: 14px;
    text-align: center;
  }

  .success-message {
    background: #e7f3ff;
    color: #1877f2;
    padding: 10px;
    border-radius: 8px;
    font-size: 14px;
    text-align: center;
  }

  .info-message {
    background: #fff3cd;
    color: #856404;
    padding: 10px;
    border-radius: 8px;
    font-size: 14px;
    text-align: center;
  }

  .submit-btn {
    background: #1877f2;
    color: white;
    border: none;
    padding: 14px;
    border-radius: 8px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .submit-btn:hover:not(:disabled) {
    background: #1664d8;
  }

  .submit-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .divider {
    display: flex;
    align-items: center;
    margin: 20px 0;
    color: #65676b;
  }

  .divider::before, .divider::after {
    content: '';
    flex: 1;
    border-bottom: 1px solid #e4e6eb;
  }

  .divider span {
    padding: 0 16px;
    font-size: 14px;
  }

  .google-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    width: 100%;
    padding: 12px;
    border: 1px solid #d0d7de;
    border-radius: 8px;
    background: white;
    font-size: 16px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .google-btn:hover:not(:disabled) {
    background: #f7f8fa;
    border-color: #b0b8c0;
  }

  .google-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .auth-footer {
    text-align: center;
    margin-top: 24px;
    padding-top: 16px;
    border-top: 1px solid #e4e6eb;
    color: #65676b;
  }

  .auth-footer a {
    color: #1877f2;
    text-decoration: none;
    font-weight: 600;
  }

  .auth-footer a:hover {
    text-decoration: underline;
  }
</style>