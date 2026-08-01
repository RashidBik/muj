<script lang="ts">
  import { onMount } from 'svelte'
  import { getComments, addComment, deleteComment } from '$lib/services/comment-service'
  import type { Comment } from '$lib/services/comment-service'
  import Avatar from '$lib/components/ui/Avatar.svelte'
  import { formatDistanceToNow } from 'date-fns'
  import { faIR } from 'date-fns/locale'

  let { 
    waveId,
    currentUserId,
    onCommentAdded
  }: {
    waveId: string
    currentUserId: string | null
    onCommentAdded?: () => void
  } = $props()

  let comments = $state<Comment[]>([])
  let loading = $state(true)
  let newComment = $state('')
  let isSubmitting = $state(false)
  let replyingTo = $state<string | null>(null)
  let replyContent = $state('')

  // بارگذاری نظرات
  async function loadComments() {
    loading = true
    try {
      comments = await getComments(waveId, currentUserId || undefined)
    } catch (error) {
      console.error('خطا در بارگذاری نظرات:', error)
    } finally {
      loading = false
    }
  }

  // ارسال نظر
  async function handleAddComment(parentId?: string) {
    if (!currentUserId) {
      alert('لطفاً ابتدا وارد شوید.')
      return
    }

    const content = parentId ? replyContent : newComment
    if (!content.trim()) return

    isSubmitting = true
    try {
      const newCommentData = await addComment(
        waveId,
        currentUserId,
        content,
        parentId
      )

      if (parentId) {
        // به‌روزرسانی ریپلای‌ها
        const parentIndex = comments.findIndex(c => c.id === parentId)
        if (parentIndex !== -1) {
          if (!comments[parentIndex].replies) {
            comments[parentIndex].replies = []
          }
          comments[parentIndex].replies = [
            ...comments[parentIndex].replies!,
            newCommentData
          ]
          comments = [...comments]
        }
        replyContent = ''
        replyingTo = null
      } else {
        // به‌روزرسانی لیست نظرات
        comments = [newCommentData, ...comments]
        newComment = ''
      }

      if (onCommentAdded) onCommentAdded()

    } catch (error) {
      console.error('خطا در ارسال نظر:', error)
      alert('خطا در ارسال نظر. لطفاً دوباره تلاش کنید.')
    } finally {
      isSubmitting = false
    }
  }

  // حذف نظر
  async function handleDeleteComment(commentId: string) {
    if (!currentUserId) return
    if (!confirm('آیا مطمئن هستید که می‌خواهید این نظر را حذف کنید؟')) return

    try {
      await deleteComment(commentId, currentUserId)
      comments = comments.filter(c => c.id !== commentId)
      comments = [...comments]
    } catch (error) {
      console.error('خطا در حذف نظر:', error)
      alert('خطا در حذف نظر')
    }
  }

  // فرمت زمان
  function formatTime(date: string): string {
    try {
      return formatDistanceToNow(new Date(date), { 
        addSuffix: true,
        locale: faIR
      })
    } catch {
      return 'چندی پیش'
    }
  }

  // بارگذاری اولیه
  onMount(() => {
    loadComments()
  })
</script>

<div class="comments-section">
  <h3 class="comments-title">💬 نظرات ({comments.length})</h3>

  <!-- فرم ارسال نظر -->
  {#if currentUserId}
    <div class="comment-input-wrapper">
      <Avatar src={null} size="sm" />
      <div class="comment-input-group">
        <input
          type="text"
          class="comment-input"
          placeholder="نظر خود را بنویسید..."
          bind:value={newComment}
          onkeydown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleAddComment()
            }
          }}
          disabled={isSubmitting}
        />
        <button 
          class="send-btn"
          onclick={() => handleAddComment()}
          disabled={!newComment.trim() || isSubmitting}
        >
          {isSubmitting ? '⏳' : '📤'}
        </button>
      </div>
    </div>
  {:else}
    <div class="login-prompt">
      <a href="/auth/login">وارد شوید</a> تا بتوانید نظر دهید
    </div>
  {/if}

  <!-- لیست نظرات -->
  {#if loading}
    <div class="loading-comments">⏳ در حال بارگذاری نظرات...</div>
  {:else if comments.length === 0}
    <div class="empty-comments">هنوز نظری ثبت نشده است. اولین نفر باشید! 💬</div>
  {:else}
    <div class="comments-list">
      {#each comments as comment (comment.id)}
        <div class="comment-item">
          <!-- نظر اصلی -->
          <div class="comment">
            <Avatar src={comment.author?.avatar} size="sm" />
            <div class="comment-content">
              <!-- در بخش comment -->
              <div class="comment-header">
                <!-- ✅ نام نویسنده با لینک به پروفایل -->
                <span 
                  class="comment-author" 
                  onclick={() => goto(`/profile/${comment.author?.username}`)}
                  style="cursor: pointer;"
                >
                  {comment.author?.name || 'ناشناس'}
                </span>
                <span class="comment-time">{formatTime(comment.created_at)}</span>
                {#if currentUserId && comment.author_id === currentUserId}
                  <button 
                    class="delete-btn"
                    onclick={() => handleDeleteComment(comment.id)}
                    title="حذف نظر"
                  >
                    🗑️
                  </button>
                {/if}
              </div>

              <!-- در بخش reply -->
              <div class="reply-header">
                <span 
                  class="reply-author"
                  onclick={() => goto(`/profile/${reply.author?.username}`)}
                  style="cursor: pointer;"
                >
                  {reply.author?.name || 'ناشناس'}
                </span>
                <span class="reply-time">{formatTime(reply.created_at)}</span>
                {#if currentUserId && reply.author_id === currentUserId}
                  <button 
                    class="delete-btn"
                    onclick={() => handleDeleteComment(reply.id)}
                    title="حذف پاسخ"
                  >
                    🗑️
                  </button>
                {/if}
              </div>
              <p class="comment-text">{comment.content}</p>
              <div class="comment-actions">
                <button 
                  class="reply-btn"
                  onclick={() => {
                    replyingTo = replyingTo === comment.id ? null : comment.id
                    replyContent = ''
                  }}
                >
                  💬 پاسخ
                </button>
                <span class="comment-likes">❤️ {comment.likes_count || 0}</span>
              </div>

              <!-- فرم پاسخ -->
              {#if replyingTo === comment.id}
                <div class="reply-input-wrapper">
                  <input
                    type="text"
                    class="reply-input"
                    placeholder="پاسخ خود را بنویسید..."
                    bind:value={replyContent}
                    onkeydown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleAddComment(comment.id)
                      }
                    }}
                    disabled={isSubmitting}
                  />
                  <button 
                    class="send-reply-btn"
                    onclick={() => handleAddComment(comment.id)}
                    disabled={!replyContent.trim() || isSubmitting}
                  >
                    ارسال
                  </button>
                </div>
              {/if}
            </div>
          </div>

          <!-- ریپلای‌ها -->
          {#if comment.replies && comment.replies.length > 0}
            <div class="replies">
              {#each comment.replies as reply (reply.id)}
                <div class="reply-item">
                  <Avatar src={reply.author?.avatar} size="sm" />
                  <div class="reply-content">
                    <div class="reply-header">
                      <span class="reply-author">{reply.author?.name || 'ناشناس'}</span>
                      <span class="reply-time">{formatTime(reply.created_at)}</span>
                      {#if currentUserId && reply.author_id === currentUserId}
                        <button 
                          class="delete-btn"
                          onclick={() => handleDeleteComment(reply.id)}
                          title="حذف پاسخ"
                        >
                          🗑️
                        </button>
                      {/if}
                    </div>
                    <p class="reply-text">{reply.content}</p>
                    <div class="reply-actions">
                      <span class="reply-likes">❤️ {reply.likes_count || 0}</span>
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .comments-section {
    background: white;
    border-radius: 12px;
    padding: 16px;
    margin-top: 16px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }

  .comments-title {
    margin: 0 0 16px 0;
    font-size: 18px;
    color: #050505;
  }

  .comment-input-wrapper {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
    padding: 12px;
    background: #f7f8fa;
    border-radius: 8px;
  }

  .comment-input-group {
    flex: 1;
    display: flex;
    gap: 8px;
  }

  .comment-input {
    flex: 1;
    border: none;
    background: white;
    padding: 8px 12px;
    border-radius: 20px;
    font-size: 14px;
    outline: none;
  }

  .comment-input:focus {
    box-shadow: 0 0 0 2px #1877f2;
  }

  .send-btn {
    background: #1877f2;
    color: white;
    border: none;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .send-btn:hover:not(:disabled) {
    background: #1664d8;
  }

  .send-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .login-prompt {
    text-align: center;
    padding: 16px;
    background: #f7f8fa;
    border-radius: 8px;
    color: #65676b;
    margin-bottom: 16px;
  }

  .login-prompt a {
    color: #1877f2;
    text-decoration: none;
    font-weight: 600;
  }

  .loading-comments, .empty-comments {
    text-align: center;
    padding: 20px;
    color: #65676b;
  }

  .comments-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .comment-item {
    border-bottom: 1px solid #e4e6eb;
    padding-bottom: 12px;
  }

  .comment-item:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }

  .comment {
    display: flex;
    gap: 12px;
  }

  .comment-content {
    flex: 1;
  }

  .comment-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
    flex-wrap: wrap;
  }

  .comment-author {
    font-weight: 600;
    color: #050505;
    font-size: 14px;
  }

  .comment-time {
    font-size: 12px;
    color: #65676b;
  }

  .comment-text {
    margin: 0 0 8px 0;
    font-size: 14px;
    color: #050505;
    word-wrap: break-word;
  }

  .comment-actions {
    display: flex;
    gap: 12px;
    align-items: center;
  }

  .reply-btn {
    background: none;
    border: none;
    color: #65676b;
    cursor: pointer;
    font-size: 13px;
    padding: 4px 8px;
    border-radius: 4px;
    transition: all 0.2s;
  }

  .reply-btn:hover {
    background: #f0f2f5;
    color: #1877f2;
  }

  .comment-likes {
    font-size: 13px;
    color: #65676b;
  }

  .delete-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 12px;
    color: #65676b;
    padding: 2px 4px;
    border-radius: 4px;
    transition: all 0.2s;
  }

  .delete-btn:hover {
    background: #fee;
    color: #dc3545;
  }

  .reply-input-wrapper {
    display: flex;
    gap: 8px;
    margin-top: 8px;
    padding: 8px;
    background: #f7f8fa;
    border-radius: 8px;
  }

  .reply-input {
    flex: 1;
    border: none;
    background: white;
    padding: 8px 12px;
    border-radius: 20px;
    font-size: 14px;
    outline: none;
  }

  .reply-input:focus {
    box-shadow: 0 0 0 2px #1877f2;
  }

  .send-reply-btn {
    background: #1877f2;
    color: white;
    border: none;
    padding: 6px 16px;
    border-radius: 20px;
    cursor: pointer;
    font-size: 13px;
  }

  .send-reply-btn:hover:not(:disabled) {
    background: #1664d8;
  }

  .send-reply-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .replies {
    margin-top: 12px;
    padding-left: 48px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .reply-item {
    display: flex;
    gap: 12px;
    background: #f7f8fa;
    padding: 12px;
    border-radius: 8px;
  }

  .reply-content {
    flex: 1;
  }

  .reply-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
    flex-wrap: wrap;
  }

  .reply-author {
    font-weight: 600;
    color: #050505;
    font-size: 13px;
  }

  .reply-time {
    font-size: 11px;
    color: #65676b;
  }

  .reply-text {
    margin: 0 0 6px 0;
    font-size: 14px;
    color: #050505;
    word-wrap: break-word;
  }

  .reply-actions {
    display: flex;
    gap: 12px;
  }

  .reply-likes {
    font-size: 12px;
    color: #65676b;
  }
</style>