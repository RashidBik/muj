<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { supabase } from '$lib/client/supabase'
  import { user } from '$lib/stores/user'
  import { updateProfile } from '$lib/services/profile-service'

  let currentUser = $state<any>(null)
  let name = $state('')
  let bio = $state('')
  let loading = $state(false)
  let error = $state('')
  let success = $state('')

  // اشتراک‌گذاری در store کاربر
  $effect(() => {
    const unsubscribe = user.subscribe(value => {
      console.log('📢 کاربر در ویرایش:', value)
      currentUser = value
      if (value) {
        name = value.name || ''
        bio = value.bio || ''
      }
    })
    return () => unsubscribe()
  })

  async function handleUpdate() {
    if (!currentUser) {
      error = 'لطفاً ابتدا وارد شوید.'
      setTimeout(() => goto('/auth/login'), 1500)
      return
    }

    if (!name.trim()) {
      error = 'لطفاً نام خود را وارد کنید.'
      return
    }

    loading = true
    error = ''
    success = ''

    try {
      await updateProfile(currentUser.id, {
        name: name.trim(),
        bio: bio.trim() || null
      })

      // به‌روزرسانی store کاربر
      user.set({
        ...currentUser,
        name: name.trim(),
        bio: bio.trim() || null
      })

      success = '✅ پروفایل با موفقیت به‌روزرسانی شد!'
      
      setTimeout(() => {
        goto(`/profile/${currentUser.username}`)
      }, 2000)

    } catch (err) {
      console.error('خطا در به‌روزرسانی:', err)
      error = 'خطا در به‌روزرسانی پروفایل'
    } finally {
      loading = false
    }
  }

  onMount(() => {
    console.log('🔄 صفحه ویرایش پروفایل')
    // اگر کاربر وارد نشده، به صفحه ورود برود
    const unsubscribe = user.subscribe(value => {
      if (!value) {
        goto('/auth/login')
      }
    })
    return () => unsubscribe()
  })
</script>

<div class="edit-profile-page">
  <div class="edit-profile-container">
    <div class="header">
      <button class="back-btn" onclick={() => history.back()}>← بازگشت</button>
      <h1>✏️ ویرایش پروفایل</h1>
    </div>

    <form class="edit-form" onsubmit={handleUpdate}>
      {#if error}
        <div class="error-message">❌ {error}</div>
      {/if}
      
      {#if success}
        <div class="success-message">✅ {success}</div>
      {/if}

      <div class="form-group">
        <label for="name">نام و نام خانوادگی</label>
        <input
          id="name"
          type="text"
          placeholder="نام خود را وارد کنید"
          bind:value={name}
          class="form-input"
        />
      </div>

      <div class="form-group">
        <label for="bio">بیوگرافی</label>
        <textarea
          id="bio"
          placeholder="درباره خود بنویسید..."
          bind:value={bio}
          class="form-textarea"
          maxlength="150"
        />
        <div class="char-count">{bio.length}/150</div>
      </div>

      <button
        type="submit"
        class="submit-btn"
        disabled={loading}
      >
        {#if loading}
          ⏳ در حال به‌روزرسانی...
        {:else}
          💾 ذخیره تغییرات
        {/if}
      </button>
    </form>
  </div>
</div>

<style>
  .edit-profile-page {
    min-height: 100vh;
    background: #f0f2f5;
    padding: 16px;
  }

  .edit-profile-container {
    max-width: 500px;
    margin: 0 auto;
    background: white;
    border-radius: 12px;
    padding: 24px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }

  .header {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 24px;
  }

  .header h1 {
    font-size: 20px;
    margin: 0;
    color: #050505;
  }

  .back-btn {
    background: none;
    border: none;
    color: #1877f2;
    font-size: 16px;
    cursor: pointer;
    padding: 8px;
  }

  .back-btn:hover {
    background: #f0f2f5;
    border-radius: 8px;
  }

  .edit-form {
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

  .form-textarea {
    padding: 12px;
    border: 1px solid #d0d7de;
    border-radius: 8px;
    font-size: 15px;
    min-height: 100px;
    resize: vertical;
    font-family: inherit;
    transition: border-color 0.2s;
  }

  .form-textarea:focus {
    outline: none;
    border-color: #1877f2;
    box-shadow: 0 0 0 3px rgba(24, 119, 242, 0.1);
  }

  .char-count {
    text-align: right;
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
  }

  .submit-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
</style>