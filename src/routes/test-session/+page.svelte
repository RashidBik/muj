<script lang="ts">
  import { onMount } from 'svelte'
  import { supabase } from '$lib/client/supabase'

  let sessionData = $state<any>(null)
  let cookies = $state('')

  onMount(async () => {
    // Get session
    const { data, error } = await supabase.auth.getSession()
    sessionData = data
    
    // Get cookies
    cookies = document.cookie
    
    console.log('Session:', data)
    console.log('Cookies:', document.cookie)
  })
</script>

<div style="padding: 20px; max-width: 600px; margin: 0 auto;">
  <h1>Session Test</h1>
  
  <div style="background: #f0f2f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
    <h3>Session:</h3>
    <pre style="white-space: pre-wrap; word-break: break-all;">
      {JSON.stringify(sessionData, null, 2)}
    </pre>
  </div>
  
  <div style="background: #f0f2f5; padding: 16px; border-radius: 8px;">
    <h3>Cookies:</h3>
    <pre style="white-space: pre-wrap; word-break: break-all;">
      {cookies || 'No cookies found'}
    </pre>
  </div>
</div>