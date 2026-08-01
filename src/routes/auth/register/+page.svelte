<script lang="ts">
  import { goto } from '$app/navigation'
  import { supabase } from '$lib/client/supabase'
  import { user } from '$lib/stores/user'
  import { onMount } from 'svelte'
  import { initializeUserTokens } from '$lib/services/token-service'
  import { processReferral } from '$lib/services/referral-service'

  let email = $state('')
  let password = $state('')
  let name = $state('')
  let username = $state('')
  let confirmPassword = $state('')
  let loading = $state(false)
  let error = $state('')
  let success = $state('')
  let referralCode = $state('')

  // Check URL params for referral code
  onMount(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const ref = urlParams.get('ref')
    if (ref) {
      referralCode = ref
      // Optional: Show a message that you're using a referral
      console.log('Referral code detected:', ref)
    }
  })

  function validateForm(): boolean {
    if (!name.trim()) {
      error = 'لطفاً نام خود را وارد کنید.'
      return false
    }
    if (!username.trim()) {
      error = 'لطفاً نام کاربری را وارد کنید.'
      return false
    }
    if (username.length < 3) {
      error = 'نام کاربری حداقل ۳ کاراکتر باید باشد.'
      return false
    }
    if (!email.trim()) {
      error = 'لطفاً ایمیل را وارد کنید.'
      return false
    }
    if (!password) {
      error = 'لطفاً رمز عبور را وارد کنید.'
      return false
    }
    if (password.length < 6) {
      error = 'رمز عبور حداقل ۶ کاراکتر باید باشد.'
      return false
    }
    if (password !== confirmPassword) {
      error = 'رمز عبور و تکرار آن مطابقت ندارند.'
      return false
    }
    return true
  }

  async function handleRegister(e: Event) {
    e.preventDefault()
    error = ''
    success = ''
    
    if (!validateForm()) return

    loading = true

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: name.trim(),
            username: username.trim().toLowerCase().replace(/\s/g, '_'),
          }
        }
      })

      if (authError) throw authError

      if (authData.user) {
        const { error: insertError } = await supabase
          .from('users')
          .insert({
            id: authData.user.id,
            email: email,
            name: name.trim(),
            username: username.trim().toLowerCase().replace(/\s/g, '_'),
            bio: '',
            avatar: null
          })

        if (insertError) throw insertError
        await initializeUserTokens(authData.user.id)
        await supabase
          .from('user_scores')
          .insert({
            user_id: authData.user.id,
            total_score: 10,
            daily_score: 0,
            weekly_score: 0,
            streak_days: 0
          })

        // ✅ Process referral if code exists
        if (referralCode) {
          try {
            await processReferral(referralCode, authData.user.id)
            console.log('Referral processed successfully')
          } catch (referralError) {
            // Log error but don't stop registration
            console.error('Referral processing failed:', referralError)
          }
        }

        const { data: newUser, error: fetchError } = await supabase
          .from('users')
          .select('id, email, name, username, avatar, bio')
          .eq('id', authData.user.id)
          .maybeSingle()

        if (fetchError) throw fetchError

        if (newUser) {
          user.set({
            id: newUser.id,
            email: newUser.email,
            name: newUser.name,
            username: newUser.username,
            avatar: newUser.avatar,
            bio: newUser.bio || ''
          })
        }

        success = 'ثبت‌نام با موفقیت انجام شد!'
        
        setTimeout(() => {
          goto('/')
        }, 2000)
      }

    } catch (err: any) {
      console.error('خطا در ثبت‌نام:', err)
      if (err.message?.includes('already registered')) {
        error = 'این ایمیل قبلاً ثبت‌نام کرده است.'
      } else if (err.message?.includes('username')) {
        error = 'این نام کاربری قبلاً گرفته شده است.'
      } else {
        error = err.message || 'خطا در ثبت‌نام. لطفاً دوباره تلاش کنید.'
      }
    } finally {
      loading = false
    }
  }

  // ✅ اصلاح onMount - فقط در صورتی که کاربر واقعاً لاگین است، هدایت کند
  onMount(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      // فقط اگر session معتبر و کاربر کامل وجود داشت، هدایت کن
      if (session?.user) {
        // بررسی کنید که کاربر در جدول users وجود دارد
        const { data: userData } = await supabase
          .from('users')
          .select('id')
          .eq('id', session.user.id)
          .maybeSingle()
        
        if (userData) {
          goto('/')
        }
      }
    } catch (err) {
      // اگر خطایی رخ داد، در صفحه ثبت‌نام بمان
      console.error('خطا در بررسی session:', err)
    }
  })
</script>

<!-- بقیه HTML مثل قبل -->

<div class="auth-page">
  <div class="auth-container">
    <!-- لوگو و عنوان -->
    <div class="auth-header">
      <h1>🎵 موج</h1>
      <p>به جامعه‌ی صوتی بپیوندید</p>
      {#if referralCode}
        <div class="referral-banner">
          🎁 ثبت‌نام با کد دعوت!
        </div>
      {/if}
    </div>

    <!-- فرم ثبت‌نام -->
    <form class="auth-form" onsubmit={handleRegister}>
      {#if error}
        <div class="error-message">❌ {error}</div>
      {/if}
      
      {#if success}
        <div class="success-message">✅ {success}</div>
      {/if}

  <div class="form-group">
  <label for="name-input">نام و نام خانوادگی</label>
  <input
    id="name-input"
    type="text"
    placeholder="مثلاً: علی محمدی"
    bind:value={name}
    class="form-input"
  />
</div>

<div class="form-group">
  <label for="username-input">نام کاربری</label>
  <input
    id="username-input"
    type="text"
    placeholder="مثلاً: alirezawaves"
    bind:value={username}
    class="form-input"
  />
  <small class="hint">فقط حروف انگلیسی، اعداد و زیرخط</small>
</div>

<div class="form-group">
  <label for="email-input">آدرس ایمیل</label>
  <input
    id="email-input"
    type="email"
    placeholder="example@email.com"
    bind:value={email}
    class="form-input"
  />
</div>

<div class="form-group">
  <label for="password-input">رمز عبور</label>
  <input
    id="password-input"
    type="password"
    placeholder="حداقل ۶ کاراکتر"
    bind:value={password}
    class="form-input"
  />
</div>

<div class="form-group">
  <label for="confirm-password-input">تکرار رمز عبور</label>
  <input
    id="confirm-password-input"
    type="password"
    placeholder="رمز را دوباره وارد کنید"
    bind:value={confirmPassword}
    class="form-input"
  />
</div>

      <!-- Hidden input for referral code -->
      <input type="hidden" bind:value={referralCode} />

      <button
        type="submit"
        class="submit-btn"
        disabled={loading}
      >
        {#if loading}
          ⏳ در حال ثبت‌نام...
        {:else}
          📝 ثبت‌نام
        {/if}
      </button>
    </form>

    <!-- لینک به ورود -->
    <div class="auth-footer">
      قبلاً ثبت‌نام کردید؟
      <a href="/auth/login">وارد شوید</a>
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

  .referral-banner {
    margin-top: 12px;
    background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    color: white;
    padding: 8px 16px;
    border-radius: 20px;
    display: inline-block;
    font-size: 14px;
    font-weight: 600;
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.05);
    }
    100% {
      transform: scale(1);
    }
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

  .hint {
    font-size: 12px;
    color: #65676b;
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
    margin-top: 8px;
  }

  .submit-btn:hover:not(:disabled) {
    background: #1664d8;
    transform: translateY(-1px);
  }

  .submit-btn:disabled {
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