import type { LayoutServerLoad } from './$types'

export const load: LayoutServerLoad = async ({ url }) => {
  console.log('📐 LAYOUT (server) - URL:', url.pathname)
  
  // ✅ Always return null - client handles auth
  return {
    session: null
  }
}