import { writable } from 'svelte/store'

export interface User {
  id: string
  email: string
  name: string
  username: string
  avatar: string | null
  bio: string | null
}

// ✅ استفاده از writable با مقدار اولیه null
export const user = writable<User | null>(null)

// تابع‌های کمکی
export function setUser(data: User | null) {
  user.set(data)
}

export function clearUser() {
  user.set(null)
}