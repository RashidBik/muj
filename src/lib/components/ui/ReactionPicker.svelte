<script lang="ts">
  import { REACTION_EMOJIS } from '$lib/services/wave-service'

  let { 
    onSelect,
    currentReaction,
    position = 'bottom'
  }: {
    onSelect: (emoji: string) => void
    currentReaction?: string | null
    position?: 'top' | 'bottom'
  } = $props()

  let isOpen = $state(false)

  function handleSelect(emoji: string) {
    onSelect(emoji)
    isOpen = false
  }

  function togglePicker() {
    isOpen = !isOpen
  }

  // ✅ تابع برای جلوگیری از انتشار رویداد به بیرون
  function handlePopupClick(e: MouseEvent) {
    e.stopPropagation()
  }
</script>

<div class="reaction-picker">
  <button 
    class="reaction-trigger {currentReaction ? 'has-reaction' : ''}" 
    onclick={togglePicker}
    class:active={isOpen}
  >
    {#if currentReaction}
      <span class="selected-emoji">{currentReaction}</span>
    {:else}
      <span class="placeholder-emoji">😊</span>
    {/if}
  </button>

  {#if isOpen}
    <!-- ✅ استفاده از onclick به جای on:click -->
    <div class="reaction-popup {position}" onclick={handlePopupClick}>
      <div class="reaction-column">
        {#each REACTION_EMOJIS as emoji}
          <button
            class="reaction-option {currentReaction === emoji ? 'selected' : ''}"
            onclick={() => handleSelect(emoji)}
          >
            <span class="reaction-emoji">{emoji}</span>
            <span class="reaction-label">
              {#if emoji === '❤️'}
              {:else if emoji === '🎉'}
              {:else if emoji === '😂'}
              {:else if emoji === '😮'}
              {:else if emoji === '😢'}
              {:else if emoji === '😡'}
              {:else if emoji === '👍'}
              {:else if emoji === '👏'}
              {:else}{emoji}
              {/if}
            </span>
          </button>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .reaction-picker {
    position: relative;
    display: inline-block;
  }

  .reaction-trigger {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border: none;
    border-radius: 50%;
    background: transparent;
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 18px;
    
  }

  .reaction-trigger:hover {
    background: #f1f5f9;
  }

  .reaction-trigger.has-reaction {
    background: #eef2ff;
  }

  .reaction-trigger.active {
    background: #eef2ff;
    box-shadow: 0 0 0 2px #6366f1;
  }

  .selected-emoji {
    font-size: 18px;
  }

  .placeholder-emoji {
    font-size: 18px;
    opacity: 0.5;
  }

  .reaction-popup {
    direction: rtl;
    position: absolute;
    /* bottom: -20%; */
    z-index: 50;
    background: white;
    border-radius: 16px;
    /* padding: 8px 4px; */
    box-shadow: 0 8px 32px rgba(0,0,0,0.15);
    border: 1px solid #f1f5f9;
    min-width: 200px;
    animation: popIn 0.2s ease;
  }

  .reaction-popup.bottom {
    top: calc(100% + -18px);
    /* left: 50%; */
    transform: translateX(-90%);
  }

  .reaction-popup.top {
    /* bottom: calc(100% + 18px);
    left: 50%;
    transform: translateX(-50%); */
  }

  @keyframes popIn {
    from {
      opacity: 0;
      transform: translateX(-90%) scale(0.9);
    }
    to {
      opacity: 1;
      transform: translateX(-90%) scale(1);
    }
  }

  .reaction-column {
    display: flex;
    /* flex-direction: column; */
    gap: 2px;
  }

  .reaction-option {
    display: flex;
    align-items: center;
    /* gap: 2px; */
    /* width: 100%; */
    padding: 0px 6px;
    border: none;
    border-radius: 10px;
    background: transparent;
    cursor: pointer;
    transition: all 0.15s ease;
    text-align: left;
  }

  .reaction-option:hover {
    background: #f1f5f9;
    transform: scale(1.02);
  }

  .reaction-option.selected {
    background: #eef2ff;
    box-shadow: inset 0 0 0 2px #6366f1;
  }

  .reaction-option:active {
    transform: scale(0.95);
  }

  .reaction-emoji {
    font-size: 24px;
    /* padding: 4px; */
    flex-shrink: 0;
  }

  .reaction-label {
    font-size: 14px;
    color: #1a1a2e;
    font-weight: 500;
  }

  .reaction-option.selected .reaction-label {
    color: #6366f1;
  }
</style>