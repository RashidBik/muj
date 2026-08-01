import { writable } from 'svelte/store'
import { supabase } from '$lib/client/supabase'
import type { Session, User } from '@supabase/supabase-js'

// ✅ Store for session state
export const session = writable<Session | null>(null)
export const user = writable<User | null>(null)

// ✅ Initialize auth state from localStorage
export async function initAuth() {
  console.log('🔐 Initializing auth...')
  
  try {
    // Check if we have a session in localStorage
    let storedSession = null
    
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('sb-session')
      if (stored) {
        try {
          storedSession = JSON.parse(stored)
          console.log('📦 Found stored session:', storedSession?.user?.email || 'No user')
          
          // ✅ Verify the session is still valid
          if (storedSession) {
            const { data: { user: currentUser }, error } = await supabase.auth.getUser()
            if (!error && currentUser) {
              session.set(storedSession)
              user.set(storedSession.user)
              console.log('✅ Session restored from localStorage and verified')
              return
            } else {
              console.log('⚠️ Stored session invalid, clearing...')
              localStorage.removeItem('sb-session')
            }
          }
        } catch (e) {
          console.error('Error parsing stored session:', e)
          localStorage.removeItem('sb-session')
        }
      }
    }
    
    // Try to get from Supabase
    const { data: { session: currentSession } } = await supabase.auth.getSession()
    
    if (currentSession) {
      session.set(currentSession)
      user.set(currentSession.user)
      
      if (typeof window !== 'undefined') {
        localStorage.setItem('sb-session', JSON.stringify(currentSession))
      }
      console.log('✅ Session restored from Supabase')
    } else {
      console.log('❌ No session found')
      session.set(null)
      user.set(null)
    }
  } catch (error) {
    console.error('Error initializing auth:', error)
    session.set(null)
    user.set(null)
  }
}

// ✅ Sign in function
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  })
  
  if (error) throw error
  
  if (data.session) {
    session.set(data.session)
    user.set(data.user)
    if (typeof window !== 'undefined') {
      localStorage.setItem('sb-session', JSON.stringify(data.session))
    }
  }
  
  return data
}

// ✅ Sign out function - CLEAR EVERYTHING
export async function signOutUser() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
  
  session.set(null)
  user.set(null)
  
  if (typeof window !== 'undefined') {
    localStorage.removeItem('sb-session')
    localStorage.removeItem('supabase.auth.token')
    sessionStorage.clear()
    
    // ✅ Redirect to login
    window.location.href = '/auth/login'
  }
}

// ✅ Get current session (for client-side use)
export function getCurrentSession() {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('sb-session')
    if (stored) {
      try {
        return JSON.parse(stored)
      } catch (e) {
        return null
      }
    }
  }
  return null
}

// ✅ Refresh session (call this when you need to verify)
export async function refreshSession() {
  const { data: { session: currentSession } } = await supabase.auth.getSession()
  
  if (currentSession) {
    session.set(currentSession)
    user.set(currentSession.user)
    if (typeof window !== 'undefined') {
      localStorage.setItem('sb-session', JSON.stringify(currentSession))
    }
    return currentSession
  } else {
    session.set(null)
    user.set(null)
    if (typeof window !== 'undefined') {
      localStorage.removeItem('sb-session')
    }
    return null
  }
}