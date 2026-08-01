import { type Handle } from '@sveltejs/kit'
import { sequence } from '@sveltejs/kit/hooks'

// ✅ Rename the handler to something else
const authHandler: Handle = async ({ event, resolve }) => {
  console.log('🔐 Handle - URL:', event.url.pathname)
  
  // ✅ Add empty getSession to prevent errors
  event.locals.getSession = async () => {
    return null // No session on server
  }
  
  return resolve(event)
}

// ✅ Export with the correct name
export const handle = sequence(authHandler)