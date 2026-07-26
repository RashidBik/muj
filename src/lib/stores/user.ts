import { writable } from 'svelte/store'

export interface User {
  id: string
  email: string
  name: string
  username: string
  avatar: string | null
  bio: string | null
}

export const user = writable<User | null>(null)