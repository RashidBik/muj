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