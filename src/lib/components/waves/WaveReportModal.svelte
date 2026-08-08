<script lang="ts">
  import { goto } from '$app/navigation'
  import { reportWave, REPORT_REASONS } from '$lib/services/report-service'
  import { Flag, X } from 'lucide-svelte'

  let {
    show,
    waveId,
    currentUserId,
    onClose
  }: {
    show: boolean
    waveId: string
    currentUserId: string | null
    onClose: () => void
  } = $props()

  let selectedReason = $state<string>('')
  let reportDescription = $state('')
  let isReporting = $state(false)
  let reportSuccess = $state(false)
  let reportMessage = $state('')

  async function handleReport() {
    if (!currentUserId) {
      goto('/auth/login')
      return
    }

    if (!selectedReason) {
      alert('لطفاً دلیل گزارش را انتخاب کنید')
      return
    }

    isReporting = true
    reportMessage = ''

    try {
      const result = await reportWave(
        currentUserId,
        waveId,
        selectedReason as any,
        reportDescription || undefined
      )

      if (result.success) {
        reportSuccess = true
        reportMessage = result.message
        setTimeout(() => {
          onClose()
          reportSuccess = false
          selectedReason = ''
          reportDescription = ''
        }, 2000)
      } else {
        reportMessage = result.message
      }
    } catch (error) {
      console.error('Error reporting:', error)
      reportMessage = 'خطا در ثبت گزارش. لطفاً دوباره تلاش کنید.'
    } finally {
      isReporting = false
    }
  }

  function handleClose() {
    if (!isReporting) {
      onClose()
      selectedReason = ''
      reportDescription = ''
      reportMessage = ''
    }
  }
</script>

{#if show}
  <div class="modal-overlay" onclick={handleClose}>
    <div class="modal-content" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <Flag size={24} />
        <h3>گزارش موج</h3>
        <button class="modal-close" onclick={handleClose}>
          <X size={20} />
        </button>
      </div>
      
      <p class="report-description">
        اگر این موج محتوای نامناسب یا غیرقانونی دارد، لطفاً دلیل آن را مشخص کنید.
      </p>
      
      <div class="report-reasons">
        {#each REPORT_REASONS as reason}
          <label class="report-reason">
            <input
              type="radio"
              name="reportReason"
              value={reason.value}
              checked={selectedReason === reason.value}
              onchange={() => selectedReason = reason.value}
            />
            <span class="reason-icon">{reason.icon}</span>
            <span class="reason-label">{reason.label}</span>
          </label>
        {/each}
      </div>
      
      <div class="report-description-field">
        <textarea
          placeholder="توضیحات بیشتر (اختیاری)..."
          bind:value={reportDescription}
          rows="3"
          disabled={isReporting}
        />
      </div>
      
      {#if reportMessage}
        <div class="report-message {reportSuccess ? 'success' : 'error'}">
          {reportMessage}
        </div>
      {/if}
      
      <div class="modal-actions">
        <button class="cancel-btn" onclick={handleClose} disabled={isReporting}>
          انصراف
        </button>
        <button 
          class="report-submit-btn" 
          onclick={handleReport}
          disabled={!selectedReason || isReporting}
        >
          {#if isReporting}
            <span class="spinner-small"></span>
            در حال ارسال...
          {:else}
            ارسال گزارش
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 20px;
    animation: fadeIn 0.2s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(20px) scale(0.98);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .modal-content {
    background: white;
    border-radius: 16px;
    padding: 24px;
    max-width: 480px;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
    animation: slideUp 0.3s ease;
  }

  .modal-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid #f1f5f9;
  }

  .modal-header :global(svg) {
    color: #6366f1;
  }

  .modal-header h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 700;
    color: #1a1a2e;
    flex: 1;
  }

  .modal-close {
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f1f5f9;
    border: none;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    cursor: pointer;
    transition: all 0.2s ease;
    color: #64748b;
  }

  .modal-close:hover {
    background: #e2e8f0;
    color: #1a1a2e;
  }

  .report-description {
    color: #64748b;
    font-size: 14px;
    margin-bottom: 16px;
    padding: 12px 16px;
    background: #f8fafc;
    border-radius: 8px;
  }

  .report-reasons {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 16px;
  }

  .report-reason {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    background: #f8fafc;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    border: 2px solid transparent;
  }

  .report-reason:hover {
    background: #f1f5f9;
  }

  .report-reason input[type="radio"] {
    width: 16px;
    height: 16px;
    accent-color: #6366f1;
    cursor: pointer;
    flex-shrink: 0;
  }

  .report-reason:has(input:checked) {
    border-color: #6366f1;
    background: #f0f0ff;
  }

  .reason-icon {
    font-size: 18px;
  }

  .reason-label {
    font-size: 14px;
    color: #1a1a2e;
  }

  .report-description-field textarea {
    width: 100%;
    padding: 12px;
    border: 2px solid #e2e8f0;
    border-radius: 10px;
    font-size: 14px;
    font-family: inherit;
    resize: vertical;
    transition: all 0.2s ease;
    background: #fafbfc;
  }

  .report-description-field textarea:focus {
    outline: none;
    border-color: #6366f1;
    background: white;
    box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.1);
  }

  .report-description-field textarea::placeholder {
    color: #94a3b8;
  }

  .report-message {
    padding: 10px 14px;
    border-radius: 8px;
    font-size: 14px;
    margin-bottom: 12px;
  }

  .report-message.success {
    background: #ecfdf5;
    color: #10b981;
    border: 1px solid #a7f3d0;
  }

  .report-message.error {
    background: #fef2f2;
    color: #ef4444;
    border: 1px solid #fca5a5;
  }

  .modal-actions {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
    margin-top: 16px;
  }

  .cancel-btn {
    padding: 10px 20px;
    background: #f1f5f9;
    border: none;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    color: #64748b;
  }

  .cancel-btn:hover:not(:disabled) {
    background: #e2e8f0;
  }

  .cancel-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .report-submit-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 10px 24px;
    background: #ef4444;
    color: white;
    border: none;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .report-submit-btn:hover:not(:disabled) {
    background: #dc2626;
    transform: scale(1.02);
  }

  .report-submit-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .spinner-small {
    display: inline-block;
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  @media (max-width: 640px) {
    .modal-content {
      padding: 16px;
    }

    .report-reason {
      padding: 8px 12px;
    }
  }
</style>