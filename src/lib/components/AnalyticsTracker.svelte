<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { page } from '$app/stores'
  import { browser } from '$app/environment'
  import { trackEvent } from '$lib/services/analytics-service'

  let currentPath = $state('')
  let trackTimer: NodeJS.Timeout | null = null

  // Track page view
  async function trackPageView() {
    if (!browser) return
    
    const path = $page.url.pathname
    if (path === currentPath) return
    
    currentPath = path
    
    // Track page view event
    await trackEvent({
      event_type: 'page_view',
      page_url: path,
      event_data: {
        full_url: $page.url.href,
        search: $page.url.search
      }
    })
  }

  // Track user session
  function trackSessionStart() {
    if (!browser) return
    
    // Check if this is a new session (first page load)
    const sessionStart = sessionStorage.getItem('analytics_session_start')
    if (!sessionStart) {
      sessionStorage.setItem('analytics_session_start', Date.now().toString())
      
      // Track session start
      setTimeout(() => {
        trackEvent({
          event_type: 'login', // or 'visit' for non-logged in
          event_data: {
            session_type: 'start',
            time: new Date().toISOString()
          }
        })
      }, 1000)
    }
  }

  onMount(() => {
    if (!browser) return
    
    // Track initial page view
    trackPageView()
    trackSessionStart()
    
    // Track page changes
    const unsubscribe = page.subscribe(() => {
      trackPageView()
    })
    
    // Track when user leaves the page
    const handleBeforeUnload = () => {
      trackEvent({
        event_type: 'logout',
        event_data: {
          session_type: 'end',
          time: new Date().toISOString(),
          duration: sessionStorage.getItem('analytics_session_start') 
            ? (Date.now() - parseInt(sessionStorage.getItem('analytics_session_start')!)) / 1000
            : null
        }
      })
    }
    
    window.addEventListener('beforeunload', handleBeforeUnload)
    
    // Track visibility change (user switching tabs)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // User left the tab
        sessionStorage.setItem('analytics_tab_hidden', Date.now().toString())
      } else {
        // User returned to tab
        const hiddenTime = sessionStorage.getItem('analytics_tab_hidden')
        if (hiddenTime) {
          const duration = (Date.now() - parseInt(hiddenTime)) / 1000
          if (duration > 60) { // Only track if gone for more than 1 minute
            trackEvent({
              event_type: 'page_view',
              event_data: {
                tab_return: true,
                away_duration: duration
              }
            })
          }
          sessionStorage.removeItem('analytics_tab_hidden')
        }
      }
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      unsubscribe()
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  })
</script>

<!-- This is a hidden component that tracks analytics -->
<div style="display: none;"></div>