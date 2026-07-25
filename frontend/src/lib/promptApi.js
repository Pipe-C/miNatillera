/**
 * Prompt API on-device (Chrome/Gemini Nano) integration.
 * Generates a motivational message about the group's progress.
 * Degrades gracefully to a static message if not available.
 */

const STATIC_MESSAGES = [
  '¡Cada aporte cuenta! El progreso del grupo se construye paso a paso.',
  'La constancia es la clave. Juntos están más cerca de la meta.',
  'Un grupo unido alcanza cualquier meta. ¡Sigan así!',
  'Pequeños aportes, grandes resultados. El camino está trazado.',
  'La disciplina de hoy es el logro de mañana. ¡El grupo puede!'
]

/**
 * Attempts to generate a motivational message using the on-device Prompt API.
 * Falls back to a static message if the browser doesn't support it.
 *
 * @param {object} context - { name, progressPercent, remainingAmount, daysLeft, memberCount }
 * @returns {Promise<string>}
 */
export async function getMotivationalMessage(context) {
  // Check if Prompt API is available (Chrome with Gemini Nano)
  if (window.ai && window.ai.languageModel) {
    try {
      const session = await window.ai.languageModel.create()

      const prompt = [
        `Eres un asistente motivacional breve para un grupo de ahorro colombiano.`,
        `El grupo "${context.name}" tiene ${context.memberCount} miembros.`,
        `Han ahorrado el ${context.progressPercent}% de su meta.`,
        `Faltan ${context.daysLeft} días para la fecha objetivo.`,
        `Genera un mensaje motivacional de máximo 2 oraciones en español colombiano informal.`,
        `No uses emojis. No saludes. Ve directo al punto motivacional.`
      ].join(' ')

      const response = await session.prompt(prompt)
      session.destroy()

      if (response && response.trim().length > 10) {
        return response.trim()
      }
    } catch (e) {
      // Prompt API not functional — fall through to static
    }
  }

  // Fallback: static message based on day of week
  const dayIndex = new Date().getDay()
  return STATIC_MESSAGES[dayIndex % STATIC_MESSAGES.length]
}

/**
 * Check if the Prompt API is available in this browser.
 */
export function isPromptApiAvailable() {
  return !!(window.ai && window.ai.languageModel)
}
