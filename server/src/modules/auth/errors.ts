export class InvalidCredentialsError extends Error {
  constructor() {
    super('Invalid credentials')
    this.name = 'InvalidCredentialsError'
  }
}

export class TooManyAttemptsError extends Error {
  constructor() {
    super('Too many login attempts. Please try again later.')
    this.name = 'TooManyAttemptsError'
  }
}

export class AccountSuspendedError extends Error {
  constructor() {
    super('Account is suspended or deleted')
    this.name = 'AccountSuspendedError'
  }
}

export class SessionRevokedError extends Error {
  constructor() {
    super('Session has been revoked')
    this.name = 'SessionRevokedError'
  }
}

export class InvalidResetTokenError extends Error {
  constructor() {
    super('Invalid or expired password reset token')
    this.name = 'InvalidResetTokenError'
  }
}

export class AccountDeletionBlockedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AccountDeletionBlockedError'
  }
}
