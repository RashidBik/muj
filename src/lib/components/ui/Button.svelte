<script lang="ts">
  export let variant: 'primary' | 'secondary' | 'outline' = 'primary'
  export let size: 'sm' | 'md' | 'lg' = 'md'
  export let disabled = false
  export let type: 'button' | 'submit' = 'button'
  export let fullWidth = false
</script>

<button
  {type}
  {disabled}
  class="button {variant} {size} {fullWidth ? 'full-width' : ''}"
>
  <slot />
</button>

<style>
  .button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    font-family: inherit;
  }

  .button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Primary */
  .primary {
    background: #1877f2;
    color: white;
  }
  .primary:hover:not(:disabled) {
    background: #1664d8;
  }

  /* Secondary */
  .secondary {
    background: #e4e6eb;
    color: #050505;
  }
  .secondary:hover:not(:disabled) {
    background: #d8dadf;
  }

  /* Outline */
  .outline {
    background: transparent;
    color: #1877f2;
    border: 1px solid #1877f2;
  }
  .outline:hover:not(:disabled) {
    background: #e7f3ff;
  }

  /* Sizes */
  .sm {
    padding: 6px 12px;
    font-size: 13px;
  }
  .md {
    padding: 10px 20px;
    font-size: 15px;
  }
  .lg {
    padding: 14px 28px;
    font-size: 17px;
  }

  .full-width {
    width: 100%;
  }
</style>