export interface TelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  photo_url?: string
  language_code?: string
}

export interface TelegramWebApp {
  initData: string
  initDataUnsafe: { user?: TelegramUser; auth_date: number; hash: string }
  ready: () => void
  expand: () => void
  close: () => void
  HapticFeedback: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void
  }
}

declare global {
  interface Window {
    Telegram?: { WebApp: TelegramWebApp }
    /**
     * Глобальный callback для Telegram Login Widget.
     * Устанавливается в page.tsx и вызывается виджетом после авторизации в браузере.
     */
    onTelegramAuth?: (user: TelegramUser) => void
  }
}

export function getTelegramWebApp(): TelegramWebApp | null {
  if (typeof window === 'undefined') return null
  return window.Telegram?.WebApp ?? null
}

export function getTelegramUser(): TelegramUser | null {
  if (typeof window === 'undefined') return null
  // Читаем напрямую из window на случай проблем с референсом
  const tg = (window as any).Telegram?.WebApp
  if (!tg) return null
  return tg.initDataUnsafe?.user ?? null
}