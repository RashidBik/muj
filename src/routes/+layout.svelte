<script lang="ts">
  import './layout.css';
  import favicon from '$lib/assets/favicon.svg';
  import { onMount } from 'svelte'
  import { initAuth, session, user } from '$lib/stores/auth'
  import { goto } from '$app/navigation'
  import { page } from '$app/stores'
    import AnalyticsTracker from '$lib/components/AnalyticsTracker.svelte';

  
  let { children } = $props();
  let isAuthInitialized = $state(false)
  let currentSession = $state<any>(null)

  // ✅ Subscribe to session changes
  onMount(async () => {
    console.log('🔐 Layout mounting...')
    
    // Initialize auth
    await initAuth()
    isAuthInitialized = true
    
    // Subscribe to session
    const unsubscribe = session.subscribe(value => {
      console.log('🔄 Session updated:', value?.user?.email || 'No session')
      currentSession = value
      
      // Check auth after session change
      if (isAuthInitialized) {
        checkAuth(value)
      }
    })
    
    return () => unsubscribe()
  })

  // ✅ Check auth function
  function checkAuth(sessionData: any) {
    if (typeof window === 'undefined') return
    
    const path = window.location.pathname
    console.log('🔐 Checking auth for path:', path, 'Session:', !!sessionData)
    
    const protectedRoutes = ['/wave/create', '/settings', '/wallet', '/profile/edit']
    const isProtected = protectedRoutes.some(route => path.startsWith(route))
    
    const authRoutes = ['/auth/login', '/auth/register', '/auth/callback']
    const isAuthRoute = authRoutes.some(route => path.startsWith(route))
    
    // ✅ If protected route and no session
    if (isProtected && !sessionData) {
      console.log('🔐 Redirecting to login (no session)')
      goto('/auth/login')
      return
    }
    
    // ✅ If auth route and has session
    if (isAuthRoute && sessionData) {
      console.log('🔐 Redirecting to home (already logged in)')
      goto('/')
      return
    }
  }

  // ✅ React to route changes
  $effect(() => {
    if (!isAuthInitialized) return
    
    const path = $page.url.pathname
    console.log('📍 Route changed to:', path)
    checkAuth(currentSession)
  })
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>
<AnalyticsTracker />
{@render children()}