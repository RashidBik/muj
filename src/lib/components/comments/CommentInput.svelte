<script lang="ts">
  import { goto } from '$app/navigation'
  import { user } from '$lib/stores/user'
  import { addComment } from '$lib/services/comment-service'
  import { Send } from 'lucide-svelte'

  let {
    waveId,
    onCommentAdded,
    parentId = null,
    placeholder = 'نظر خود را بنویسید...',
    autoFocus = false
  }: {
    waveId: string
    onCommentAdded?: (comment: any) => void
    parentId?: string | null
    placeholder?: string
    autoFocus?: boolean
  } = $props()

  let currentUser = $state<any>(null)
  let commentText = $state('')
  let isSubmitting = $state(false)
  let error = $state<string | null>(null)

  // Subscribe to user
  $effect(() => {
    const unsubscribe = user.subscribe(value => {
      currentUser = value
    })
    return () => unsubscribe()
  })

  async function submitComment() {
    if (!currentUser) {
      goto('/auth/login')
      return
    }

    const trimmed = commentText.trim()
    if (!trimmed || isSubmitting) return

    isSubmitting = true
    error = null

    try {
      const newComment = await addComment(
        waveId,
        currentUser.id,
        trimmed,
        parentId || undefined
      )

      commentText = ''
      if (onCommentAdded) {
        onCommentAdded(newComment)
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'خطا در ارسال نظر'
      console.error('Error submitting comment:', err)
    } finally {
      isSubmitting = false
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submitComment()
    }
  }
</script>

<div class="comment-input-wrapper">
  {#if error}
    <div class="error-message">{error}</div>
  {/if}

  <div class="comment-input">
    <input
      type="text"
      placeholder={placeholder}
      bind:value={commentText}
      onkeydown={handleKeyDown}
      disabled={!currentUser || isSubmitting}
      autofocus={autoFocus}
    />
    <button
      class="send-btn"
      onclick={submitComment}
      disabled={!commentText.trim() || !currentUser || isSubmitting}
    >
      <Send size={18} />
    </button>
  </div>

  {#if !currentUser}
    <div class="login-prompt" onclick={() => goto('/auth/login')}>
      برای نوشتن نظر وارد شوید
    </div>
  {/if}
</div>

<style>
  .comment-input-wrapper {
    width: 100%;
  }

  .error-message {
    color: #ef4444;
    font-size: 12px;
    margin-bottom: 6px;
  }

  .comment-input {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 12px;
    padding: 4px 4px 4px 14px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    transition: border-color 0.2s ease;
  }

  .comment-input:focus-within {
    border-color: rgba(99, 102, 241, 0.4);
  }

  .comment-input input {
    flex: 1;
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.9);
    padding: 10px 0;
    font-size: 14px;
    outline: none;
    font-family: inherit;
  }

  .comment-input input::placeholder {
    color: rgba(255, 255, 255, 0.4);
  }

  .comment-input input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .send-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    background: #6366f1;
    border: none;
    color: white;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    cursor: pointer;
    transition: all 0.2s ease;
    flex-shrink: 0;
  }

  .send-btn:hover:not(:disabled) {
    background: #4f46e5;
    transform: scale(1.05);
  }

  .send-btn:active:not(:disabled) {
    transform: scale(0.95);
  }

  .send-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .login-prompt {
    text-align: center;
    padding: 10px;
    background: rgba(255, 255, 255, 0.04);
    border-radius: 10px;
    cursor: pointer;
    color: rgba(255, 255, 255, 0.5);
    font-size: 13px;
    transition: all 0.2s ease;
    margin-top: 8px;
  }

  .login-prompt:hover {
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.7);
  }
</style>