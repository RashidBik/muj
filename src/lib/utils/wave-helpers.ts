// توابع کمکی برای موج‌ها
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${String(secs).padStart(2, '0')}`
}

export function getDurationLabel(category: string): string {
  const labels: Record<string, string> = {
    SHORT: '⚡ کوتاه',
    MEDIUM: '📻 متوسط',
    LONG: '🎙️ طولانی'
  }
  return labels[category] || category
}

export function getDurationColor(category: string): string {
  const colors: Record<string, string> = {
    SHORT: '#10b981',
    MEDIUM: '#f59e0b',
    LONG: '#ef4444'
  }
  return colors[category] || '#6b7280'
}

export function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    NEWS: '📰 اخبار',
    EDUCATION: '📚 آموزش',
    MUSIC: '🎵 موسیقی',
    AUDIOBOOK: '📖 کتاب صوتی',
    STORY: '📖 داستان',
    FREE: '🎯 آزاد'
  }
  return labels[category] || category
}

// ✅ Format view count
export function formatViewCount(views: number): string {
  if (!views || views === 0) return '0'
  if (views >= 1000000) {
    return (views / 1000000).toFixed(1) + 'M'
  }
  if (views >= 1000) {
    return (views / 1000).toFixed(1) + 'K'
  }
  return views.toString()
}

// ✅ Parse hashtags from text
export function parseHashtags(text: string): string[] {
  const hashtagRegex = /#[\w\u0600-\u06FF]+/g
  const matches = text.match(hashtagRegex)
  return matches ? matches.map(tag => tag.substring(1)) : []
}

// ✅ Format hashtags for display
export function formatHashtags(hashtags: string | null): string[] {
  if (!hashtags) return []
  return hashtags.split(' ').filter(tag => tag.trim())
}

// ✅ Create hashtag string from array
export function hashtagsToString(tags: string[]): string {
  return tags.filter(tag => tag.trim()).join(' ')
}

/**
 * Check if a wave is a short wave (under 30 seconds)
 */
export function isShortWave(duration: number): boolean {
  return duration < 30
}

/**
 * Get the appropriate route for a wave based on its duration
 */
export function getWaveRoute(waveId: string, duration: number): string {
  if (isShortWave(duration)) {
    return `/story/${waveId}`
  }
  return `/wave/${waveId}`
}

/**
 * Navigate to the appropriate wave view based on duration
 */
export function navigateToWave(goto: (url: string) => void, waveId: string, duration: number): void {
  const route = getWaveRoute(waveId, duration)
  goto(route)
}

// Add this function to wave-helpers.ts
export function formatNumber(num: number): string {
  if (num === undefined || num === null) return '0'
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M'
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K'
  }
  return num.toString()
}

// Also add this for Persian formatting if needed
export function formatNumberPersian(num: number): string {
  return num.toLocaleString('fa-IR')
}