import { writable, derived } from 'svelte/store'
import { getTokenBalance, getTokenTransactions } from '$lib/services/token-service'
import type { TokenTransaction } from '$lib/services/token-service'

// Store برای موجودی توکن
export const tokenBalance = writable<number>(0)
export const tokenTransactions = writable<TokenTransaction[]>([])
export const tokenLoading = writable<boolean>(false)

// تابع بارگذاری موجودی
export async function loadTokenBalance(userId: string): Promise<void> {
  try {
    tokenLoading.set(true)
    const balance = await getTokenBalance(userId)
    tokenBalance.set(balance)
  } catch (error) {
    console.error('Error loading token balance:', error)
    tokenBalance.set(0)
  } finally {
    tokenLoading.set(false)
  }
}

// تابع بارگذاری تراکنش‌ها
export async function loadTokenTransactions(
  userId: string,
  limit: number = 20
): Promise<void> {
  try {
    const transactions = await getTokenTransactions(userId, limit)
    tokenTransactions.set(transactions)
  } catch (error) {
    console.error('Error loading token transactions:', error)
    tokenTransactions.set([])
  }
}

// Derived store برای فرمت شده موجودی
export const formattedTokenBalance = derived(
  tokenBalance,
  ($balance) => $balance.toLocaleString('fa-IR')
)

// Derived store برای وضعیت موجودی (کم، متوسط، زیاد)
export const tokenStatus = derived(
  tokenBalance,
  ($balance) => {
    if ($balance < 10) return 'low'
    if ($balance < 50) return 'medium'
    if ($balance < 100) return 'high'
    return 'rich'
  }
)