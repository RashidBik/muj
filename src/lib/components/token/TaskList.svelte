<script lang="ts">
  import { onMount } from 'svelte'
  import { user } from '$lib/stores/user'
  import { getUserTasks, resetDailyTasks } from '$lib/services/task-service'
  import { CheckCircle, Lock, Clock, Award, RefreshCw } from 'lucide-svelte'

  let currentUser = $state<any>(null)
  let tasks = $state<any>({ daily: [], monthly: [], one_time: [] })
  let loading = $state(true)
  let refreshing = $state(false)

  $effect(() => {
    const unsubscribe = user.subscribe(value => {
      currentUser = value
      if (value) {
        loadTasks(value.id)
      }
    })
    return () => unsubscribe()
  })

  async function loadTasks(userId: string) {
    loading = true
    try {
      tasks = await getUserTasks(userId)
    } catch (error) {
      console.error('Error loading tasks:', error)
    } finally {
      loading = false
    }
  }

  async function handleResetDaily() {
    if (!currentUser || refreshing) return
    refreshing = true
    try {
      await resetDailyTasks(currentUser.id)
      await loadTasks(currentUser.id)
    } catch (error) {
      console.error('Error resetting daily tasks:', error)
    } finally {
      refreshing = false
    }
  }

  function getTaskIcon(type: string) {
    const icons: Record<string, string> = {
      daily: '📅',
      weekly: '📆',
      monthly: '🌙',
      one_time: '⭐'
    }
    return icons[type] || '📋'
  }

  function formatProgress(current: number, required: number): string {
    const percentage = Math.min((current / required) * 100, 100)
    return `${Math.round(percentage)}%`
  }
</script>

{#if currentUser}
  <div class="tasks-section">
    <div class="tasks-header">
      <div class="header-left">
        <Award size={20} />
        <h3>تسک‌های روزانه</h3>
        <span class="task-count">
          {tasks.daily?.filter(t => t.completed).length || 0}/{tasks.daily?.length || 0}
        </span>
      </div>
      <button class="refresh-btn" onclick={handleResetDaily} disabled={refreshing}>
        <RefreshCw size={16} class={refreshing ? 'spin' : ''} />
      </button>
    </div>

    {#if loading}
      <div class="loading-tasks">⏳ در حال بارگذاری...</div>
    {:else}
      <div class="tasks-grid">
        {#each tasks.daily as task (task.id)}
          <div class="task-card {task.completed ? 'completed' : ''}">
            <div class="task-icon">{task.icon}</div>
            <div class="task-info">
              <div class="task-name">{task.name}</div>
              <div class="task-description">{task.description}</div>
              <div class="task-progress">
                <div class="progress-bar">
                  <div 
                    class="progress-fill" 
                    style="width: {Math.min((task.progress / task.requirement) * 100, 100)}%"
                  ></div>
                </div>
                <span class="progress-text">
                  {task.progress}/{task.requirement}
                </span>
              </div>
            </div>
            <div class="task-status">
              {#if task.completed}
                <CheckCircle size={20} color="#10b981" />
                <span class="reward-badge">+{task.reward} توکن</span>
              {:else}
                <Clock size={18} color="#94a3b8" />
              {/if}
            </div>
          </div>
        {/each}
      </div>

      <!-- Monthly Tasks -->
      {#if tasks.monthly?.length > 0}
        <div class="monthly-tasks">
          <div class="monthly-header">
            <span>🌙</span>
            <h4>تسک‌های ماهانه</h4>
          </div>
          <div class="monthly-grid">
            {#each tasks.monthly as task (task.id)}
              <div class="task-card mini {task.completed ? 'completed' : ''}">
                <span class="task-icon">{task.icon}</span>
                <span class="task-name">{task.name}</span>
                {#if task.completed}
                  <CheckCircle size={16} color="#10b981" />
                {:else}
                  <Lock size={16} color="#94a3b8" />
                {/if}
              </div>
            {/each}
          </div>
        </div>
      {/if}
    {/if}
  </div>
{/if}

<style>
  .tasks-section {
    background: white;
    border-radius: 12px;
    padding: 16px;
    margin-bottom: 16px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  }

  .tasks-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .header-left :global(svg) {
    color: #6366f1;
  }

  .header-left h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 700;
    color: #1a1a2e;
  }

  .task-count {
    font-size: 12px;
    color: #94a3b8;
    background: #f1f5f9;
    padding: 2px 10px;
    border-radius: 12px;
  }

  .refresh-btn {
    background: none;
    border: none;
    color: #94a3b8;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 6px;
    transition: all 0.2s ease;
  }

  .refresh-btn:hover:not(:disabled) {
    background: #f1f5f9;
    color: #6366f1;
  }

  .refresh-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .spin {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .loading-tasks {
    text-align: center;
    padding: 20px;
    color: #94a3b8;
    font-size: 14px;
  }

  .tasks-grid {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .task-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: #f8fafc;
    border-radius: 10px;
    transition: all 0.2s ease;
    border: 1px solid transparent;
  }

  .task-card:hover {
    background: #f1f5f9;
  }

  .task-card.completed {
    background: #f0fdf4;
    border-color: #86efac;
  }

  .task-icon {
    font-size: 24px;
    flex-shrink: 0;
  }

  .task-info {
    flex: 1;
    min-width: 0;
  }

  .task-name {
    font-weight: 600;
    color: #1a1a2e;
    font-size: 14px;
  }

  .task-description {
    font-size: 13px;
    color: #64748b;
  }

  .task-progress {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 4px;
  }

  .progress-bar {
    flex: 1;
    height: 4px;
    background: #e2e8f0;
    border-radius: 2px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: #6366f1;
    border-radius: 2px;
    transition: width 0.3s ease;
  }

  .task-card.completed .progress-fill {
    background: #10b981;
  }

  .progress-text {
    font-size: 12px;
    color: #94a3b8;
    min-width: 30px;
  }

  .task-status {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;
  }

  .reward-badge {
    font-size: 11px;
    font-weight: 600;
    color: #10b981;
  }

  /* Monthly Tasks */
  .monthly-tasks {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid #f1f5f9;
  }

  .monthly-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }

  .monthly-header h4 {
    margin: 0;
    font-size: 14px;
    color: #64748b;
  }

  .monthly-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .task-card.mini {
    padding: 8px 14px;
    gap: 8px;
    font-size: 13px;
  }

  .task-card.mini .task-icon {
    font-size: 18px;
  }

  .task-card.mini .task-name {
    font-size: 13px;
  }

  @media (max-width: 640px) {
    .task-card {
      padding: 10px 12px;
    }

    .task-card.mini {
      padding: 6px 10px;
    }
  }
</style>