import { describe, it, beforeEach, afterEach, expect } from 'vitest'
import { createPrismaClient } from '../../../server/src/lib/prismaClient'
import { PrismaAccountRepository } from '../../../server/src/modules/accounts/accountRepository'
import { AccountService } from '../../../server/src/modules/accounts/accountService'
import { PrismaSessionRepository } from '../../../server/src/modules/auth/sessionRepository'
import { PrismaPasswordResetRepository } from '../../../server/src/modules/auth/passwordResetRepository'
import { AuthService } from '../../../server/src/modules/auth/authService'
import {
  AccountDeletionBlockedError,
  AccountSuspendedError,
  InvalidCredentialsError,
  InvalidResetTokenError,
  SessionRevokedError,
  TooManyAttemptsError,
} from '../../../server/src/modules/auth/errors'
import { createTestDatabase } from '../support/testDatabase'
import { AccountStatus } from '@prisma/client'
import type { AccountDeletionGuard } from '../../../server/src/modules/accounts/accountDeletionGuard'

describe('AuthService', () => {
  const password = 'Sup3rSecure!'
  let prisma = createPrismaClient()
  let dbHandle: ReturnType<typeof createTestDatabase> | null = null
  let accountRepository: PrismaAccountRepository
  let accountService: AccountService
  let sessionRepository: PrismaSessionRepository
  let passwordResetRepository: PrismaPasswordResetRepository
  let authService: AuthService

  beforeEach(() => {
    dbHandle = createTestDatabase()
    prisma = createPrismaClient({ datasourceUrl: dbHandle.url })
    accountRepository = new PrismaAccountRepository(prisma)
    accountService = new AccountService(accountRepository)
    sessionRepository = new PrismaSessionRepository(prisma)
    passwordResetRepository = new PrismaPasswordResetRepository(prisma)
    authService = new AuthService(accountService, accountRepository, sessionRepository, passwordResetRepository)
  })

  afterEach(async () => {
    await prisma.$disconnect()
    dbHandle?.cleanup()
    dbHandle = null
  })

  it('signs up and logs in, storing a session', async () => {
    await authService.signup({ email: 'login@example.com', password })
    const result = await authService.login({ email: 'login@example.com', password })

    expect(result.accessToken).toBeTruthy()
    expect(result.refreshToken).toBeTruthy()
    const session = await prisma.session.findUnique({ where: { id: result.sessionId } })
    expect(session?.accountId).toBe(result.accountId)
    expect(session?.revokedAt).toBeNull()
  })

  it('throttles repeated failed logins', async () => {
    await authService.signup({ email: 'throttle@example.com', password })
    for (let i = 0; i < 5; i++) {
      await expect(authService.login({ email: 'throttle@example.com', password: 'wrong-password' })).rejects.toBeInstanceOf(
        InvalidCredentialsError,
      )
    }
    await expect(authService.login({ email: 'throttle@example.com', password: 'wrong-password' })).rejects.toBeInstanceOf(
      TooManyAttemptsError,
    )
  })

  it('prevents suspended accounts from logging in', async () => {
    const account = await authService.signup({ email: 'suspended@example.com', password })
    await prisma.account.update({ where: { id: account.id }, data: { status: AccountStatus.SUSPENDED } })
    await expect(authService.login({ email: 'suspended@example.com', password })).rejects.toBeInstanceOf(
      AccountSuspendedError,
    )
  })

  it('refreshes tokens and revokes previous session', async () => {
    await authService.signup({ email: 'refresh@example.com', password })
    const loginResult = await authService.login({ email: 'refresh@example.com', password })
    const refreshed = await authService.refresh({ refreshToken: loginResult.refreshToken })

    expect(refreshed.sessionId).not.toBe(loginResult.sessionId)
    const oldSession = await prisma.session.findUnique({ where: { id: loginResult.sessionId } })
    expect(oldSession?.revokedReason).toBe('rotated')
  })

  it('logs out and blocks future refresh', async () => {
    await authService.signup({ email: 'logout@example.com', password })
    const loginResult = await authService.login({ email: 'logout@example.com', password })
    await authService.logout(loginResult.sessionId)

    await expect(authService.refresh({ refreshToken: loginResult.refreshToken })).rejects.toBeInstanceOf(
      SessionRevokedError,
    )
  })

  it('logout-all revokes all sessions', async () => {
    const account = await authService.signup({ email: 'logoutall@example.com', password })
    const first = await authService.login({ email: 'logoutall@example.com', password })
    const second = await authService.login({ email: 'logoutall@example.com', password })

    await authService.logoutAll(account.id)

    const remaining = await prisma.session.findMany({ where: { accountId: account.id, revokedAt: null } })
    expect(remaining.length).toBe(0)
    await expect(authService.refresh({ refreshToken: first.refreshToken })).rejects.toBeInstanceOf(SessionRevokedError)
    await expect(authService.refresh({ refreshToken: second.refreshToken })).rejects.toBeInstanceOf(SessionRevokedError)
  })

  it('handles password reset request and confirmation', async () => {
    await authService.signup({ email: 'reset@example.com', password })
    const request = await authService.requestPasswordReset({ email: 'reset@example.com' })
    expect(request.sent).toBe(true)
    expect(request.token).toBeDefined()
    await authService.confirmPasswordReset({ token: request.token!, newPassword: 'NewSecure123!' })

    await expect(authService.login({ email: 'reset@example.com', password })).rejects.toBeInstanceOf(
      InvalidCredentialsError,
    )
    const loginResult = await authService.login({ email: 'reset@example.com', password: 'NewSecure123!' })
    expect(loginResult.sessionId).toBeTruthy()
  })

  it('rejects invalid password reset tokens', async () => {
    await authService.signup({ email: 'reset-invalid@example.com', password })
    await expect(authService.confirmPasswordReset({ token: 'bad-token', newPassword: 'Another123!' })).rejects.toBeInstanceOf(
      InvalidResetTokenError,
    )
  })

  it('deletes account after verifying password', async () => {
    const account = await authService.signup({ email: 'delete@example.com', password })
    const loginResult = await authService.login({ email: 'delete@example.com', password })
    await authService.deleteAccount({ accountId: account.id, password })

    await expect(authService.login({ email: 'delete@example.com', password })).rejects.toBeInstanceOf(
      InvalidCredentialsError,
    )
    const stored = await prisma.account.findUnique({ where: { id: account.id } })
    expect(stored?.status).toBe(AccountStatus.DELETED)
    await expect(authService.refresh({ refreshToken: loginResult.refreshToken })).rejects.toBeInstanceOf(
      SessionRevokedError,
    )
  })

  it('blocks account deletion via guard', async () => {
    class DenyGuard implements AccountDeletionGuard {
      async ensureCanDelete() {
        throw new Error('Owning workspace')
      }
    }
    authService = new AuthService(
      accountService,
      accountRepository,
      sessionRepository,
      passwordResetRepository,
      new DenyGuard(),
    )
    const account = await authService.signup({ email: 'guard@example.com', password })
    await expect(authService.deleteAccount({ accountId: account.id, password })).rejects.toBeInstanceOf(
      AccountDeletionBlockedError,
    )
  })
})
