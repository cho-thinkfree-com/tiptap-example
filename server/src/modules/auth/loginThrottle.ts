type Timestamp = number

export interface LoginThrottle {
  registerFailure(email: string): number
  reset(email: string): void
  isBlocked(email: string): boolean
}

export interface LoginThrottleOptions {
  maxAttempts: number
  windowMs: number
}

const defaultOptions: LoginThrottleOptions = {
  maxAttempts: 6,
  windowMs: 10 * 60 * 1000,
}

export class InMemoryLoginThrottle implements LoginThrottle {
  private readonly attempts = new Map<string, Timestamp[]>()

  constructor(private readonly options: LoginThrottleOptions = defaultOptions) {}

  registerFailure(email: string): number {
    const normalized = normalize(email)
    const list = this.attempts.get(normalized) ?? []
    const now = Date.now()
    const filtered = list.filter((ts) => now - ts < this.options.windowMs)
    filtered.push(now)
    this.attempts.set(normalized, filtered)
    return filtered.length
  }

  reset(email: string): void {
    this.attempts.delete(normalize(email))
  }

  isBlocked(email: string): boolean {
    const normalized = normalize(email)
    const list = this.attempts.get(normalized)
    if (!list) return false
    const now = Date.now()
    const filtered = list.filter((ts) => now - ts < this.options.windowMs)
    if (filtered.length !== list.length) {
      this.attempts.set(normalized, filtered)
    }
    return filtered.length >= this.options.maxAttempts
  }
}

const normalize = (email: string) => email.trim().toLowerCase()
