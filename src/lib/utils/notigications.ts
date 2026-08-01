// درخواست مجوز Notification
export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    return false
  }
  
  const permission = await Notification.requestPermission()
  return permission === 'granted'
}

// ارسال Notification
export function sendNotification(title: string, body: string, icon?: string) {
  if (!('Notification' in window)) {
    return
  }
  
  if (Notification.permission === 'granted') {
    new Notification(title, {
      body,
      icon: icon || '/favicon.ico',
      silent: false
    })
  }
}