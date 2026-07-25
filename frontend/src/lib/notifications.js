/**
 * Notifications API integration.
 * Requests permission and schedules local reminders.
 */

export async function requestNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'

  const result = await Notification.requestPermission()
  return result
}

/**
 * Schedule a reminder notification before the target date.
 * Uses setTimeout since Service Worker push is out of scope for MVP.
 *
 * @param {string} groupName
 * @param {string} targetDate - ISO date string
 */
export function scheduleTargetDateReminder(groupName, targetDate) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return

  const target = new Date(targetDate + 'T00:00:00')
  const threeDaysBefore = new Date(target.getTime() - 3 * 24 * 60 * 60 * 1000)
  const now = new Date()
  const delay = threeDaysBefore.getTime() - now.getTime()

  if (delay > 0 && delay < 7 * 24 * 60 * 60 * 1000) {
    // Only schedule if within 7 days from now
    setTimeout(() => {
      showNotification(
        '¡Quedan 3 días!',
        `La meta de "${groupName}" está cerca. ¿Ya aportaste esta semana?`
      )
    }, delay)
  }
}

/**
 * Fire an inactivity reminder if no contributions in 7+ days.
 *
 * @param {string} groupName
 * @param {string|null} lastContributionDate - ISO date or null
 */
export function checkInactivityReminder(groupName, lastContributionDate) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  if (!lastContributionDate) return

  const last = new Date(lastContributionDate + 'T00:00:00')
  const daysSince = Math.ceil((Date.now() - last.getTime()) / (1000 * 60 * 60 * 24))

  if (daysSince > 7) {
    showNotification(
      'Hace rato no aportan',
      `"${groupName}" lleva ${daysSince} días sin nuevos aportes. ¡Motiva al grupo!`
    )
  }
}

function showNotification(title, body) {
  try {
    new Notification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png'
    })
  } catch (e) {
    // Silently ignore if notification fails
  }
}
