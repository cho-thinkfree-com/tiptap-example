import { AccountStatus } from '@prisma/client'
import { z } from 'zod'
import { AccountService } from '../accounts/accountService.js'
import type { AccountRepository } from '../accounts/accountRepository.js'
import { Argon2PasswordHasher, type PasswordHasher } from '../../lib/passwordHasher.js'
import type { SessionRepository } from './sessionRepository.js'
import { RandomTokenGenerator, type TokenGenerator, hashToken } from '../../lib/tokenGenerator.js'
import { InMemoryLoginThrottle, type LoginThrottle } from './loginThrottle.js'
import type { PasswordResetRepository } from './passwordResetRepository.js'
import {
  AccountDeletionBlockedError,
  AccountSuspendedError,
  InvalidCredentialsError,
  InvalidResetTokenError,
  SessionRevokedError,
  TooManyAttemptsError,
} from './errors.js'
import type { AccountDeletionGuard } from '../accounts/accountDeletionGuard.js'
import { AllowAllAccountDeletionGuard } from '../accounts/accountDeletionGuard.js'
import { randomBytes } from 'node:crypto'

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8).max(128),
})

const signupSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8).max(128),
  legalName: z
    .string()
    .trim()
    .max(200)
    .optional(),
  preferredLocale: z.string().optional(),
  preferredTimezone: z.string().optional(),
})

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
})

const resetRequestSchema = z.object({
  email: z.string().trim().email(),
})

const resetConfirmSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8).max(128),
})

const deleteSchema = z.object({
  accountId: z.string().min(1),
  password: z.string().min(8),
})

const ACCESS_TTL_MS = 15 * 60 * 1000
const REFRESH_TTL_MS = 10 * 24 * 60 * 60 * 1000
const RESET_TTL_MS = 30 * 60 * 1000

export interface LoginResult {
  sessionId: string
  accountId: string
  accessToken: string
  accessTokenExpiresAt: Date
  refreshToken: string
  refreshTokenExpiresAt: Date
}

export class AuthService {
  constructor(
    private readonly accountService: AccountService,
    private readonly accountRepository: AccountRepository,
    private readonly sessionRepository: SessionRepository,
    private readonly passwordResetRepository: PasswordResetRepository,
    private readonly accountDeletionGuard: AccountDeletionGuard = new AllowAllAccountDeletionGuard(),
    private readonly passwordHasher: PasswordHasher = new Argon2PasswordHasher(),
    private readonly tokenGenerator: TokenGenerator = new RandomTokenGenerator(),
    private readonly loginThrottle: LoginThrottle = new InMemoryLoginThrottle(),
  ) { }

  signup(input: z.infer<typeof signupSchema>) {
    const parsed = signupSchema.parse(input)
    let legalName = parsed.legalName

    // If legalName is not provided or empty (after trim), default to email prefix
    if (!legalName) {
      legalName = parsed.email.split('@')[0]
    }

    return this.accountService.registerAccount({
      ...parsed,
      legalName,
    })
  }

  async login(rawInput: z.infer<typeof loginSchema>): Promise<LoginResult> {
    const input = loginSchema.parse(rawInput)
    const email = normalizeEmail(input.email)
    if (this.loginThrottle.isBlocked(email)) throw new TooManyAttemptsError()

    const account = await this.accountRepository.findAuthRecordByEmail(email)
    if (!account || account.status === AccountStatus.DELETED) {
      this.loginThrottle.registerFailure(email)
      throw new InvalidCredentialsError()
    }
    if (account.status === AccountStatus.SUSPENDED) throw new AccountSuspendedError()

    const passwordValid = await this.passwordHasher.verify(account.passwordHash, input.password)
    if (!passwordValid) {
      this.loginThrottle.registerFailure(email)
      if (this.loginThrottle.isBlocked(email)) throw new TooManyAttemptsError()
      throw new InvalidCredentialsError()
    }

    this.loginThrottle.reset(email)
    return this.issueSession(account.id)
  }

  async refresh(rawInput: z.infer<typeof refreshSchema>): Promise<LoginResult> {
    const input = refreshSchema.parse(rawInput)
    const hashed = hashToken(input.refreshToken)
    const session = await this.sessionRepository.findByRefreshHash(hashed)
    if (!session) throw new InvalidCredentialsError()
    if (session.revokedAt || session.refreshExpiresAt.getTime() <= Date.now()) throw new SessionRevokedError()
    await this.sessionRepository.revokeById(session.id, 'rotated')
    return this.issueSession(session.accountId)
  }

  async logout(sessionId: string): Promise<void> {
    const session = await this.sessionRepository.findById(sessionId)
    if (!session || session.revokedAt) throw new SessionRevokedError()
    await this.sessionRepository.revokeById(session.id, 'user_logout')
  }

  async logoutAll(accountId: string): Promise<void> {
    await this.sessionRepository.revokeByAccount(accountId, 'user_logout_all')
  }

  async requestPasswordReset(rawInput: z.infer<typeof resetRequestSchema>): Promise<{ sent: boolean; token?: string }> {
    const input = resetRequestSchema.parse(rawInput)
    const email = normalizeEmail(input.email)
    const account = await this.accountRepository.findAuthRecordByEmail(email)
    if (!account || account.status !== AccountStatus.ACTIVE) {
      return { sent: false }
    }
    const token = randomBytes(32).toString('base64url')
    await this.passwordResetRepository.create(account.id, hashToken(token), new Date(Date.now() + RESET_TTL_MS))
    return { sent: true, token }
  }

  async confirmPasswordReset(rawInput: z.infer<typeof resetConfirmSchema>): Promise<void> {
    const input = resetConfirmSchema.parse(rawInput)
    const token = await this.passwordResetRepository.findByHash(hashToken(input.token))
    if (!token || token.usedAt || token.expiresAt.getTime() <= Date.now()) throw new InvalidResetTokenError()

    const account = await this.accountRepository.findAuthRecordById(token.accountId)
    if (!account || account.status !== AccountStatus.ACTIVE) throw new InvalidResetTokenError()

    await this.accountService.updatePassword(account.id, input.newPassword)
    await this.passwordResetRepository.markUsed(token.id)
    await this.sessionRepository.revokeByAccount(account.id, 'password_reset')
  }

  async deleteAccount(rawInput: z.infer<typeof deleteSchema>): Promise<void> {
    const input = deleteSchema.parse(rawInput)
    const account = await this.accountRepository.findAuthRecordById(input.accountId)
    if (!account || account.status === AccountStatus.DELETED) throw new InvalidCredentialsError()
    const passwordValid = await this.passwordHasher.verify(account.passwordHash, input.password)
    if (!passwordValid) throw new InvalidCredentialsError()
    try {
      await this.accountDeletionGuard.ensureCanDelete(account.id)
    } catch (err) {
      throw new AccountDeletionBlockedError(err instanceof Error ? err.message : 'Cannot delete account')
    }
    await this.accountRepository.softDelete(account.id)
    await this.passwordResetRepository.deleteByAccount(account.id)
    await this.sessionRepository.revokeByAccount(account.id, 'account_deleted')
  }

  async updateAccount(accountId: string, rawInput: { email?: string; legalName?: string; preferredLocale?: string; preferredTimezone?: string; currentPassword?: string; newPassword?: string }): Promise<void> {
    const account = await this.accountRepository.findAuthRecordById(accountId)
    if (!account) throw new InvalidCredentialsError()

    // If changing password or sensitive info (like email), require current password
    if (rawInput.newPassword || rawInput.email) {
      if (!rawInput.currentPassword) {
        throw new InvalidCredentialsError() // Or a more specific error "Current password required"
      }
      const passwordValid = await this.passwordHasher.verify(account.passwordHash, rawInput.currentPassword)
      if (!passwordValid) {
        throw new InvalidCredentialsError()
      }
    }

    if (rawInput.newPassword) {
      await this.accountService.updatePassword(accountId, rawInput.newPassword)
    }

    if (rawInput.email || rawInput.legalName || rawInput.preferredLocale || rawInput.preferredTimezone) {
      await this.accountService.updateAccount(accountId, {
        email: rawInput.email,
        legalName: rawInput.legalName,
        preferredLocale: rawInput.preferredLocale,
        preferredTimezone: rawInput.preferredTimezone,
      })
    }
  }

  private async issueSession(accountId: string): Promise<LoginResult> {
    const { accessToken, refreshToken } = this.tokenGenerator.generateTokens()
    const now = Date.now()
    const accessTokenExpiresAt = new Date(now + ACCESS_TTL_MS)
    const refreshTokenExpiresAt = new Date(now + REFRESH_TTL_MS)
    const session = await this.sessionRepository.create({
      accountId,
      accessToken,
      refreshTokenHash: hashToken(refreshToken),
      accessExpiresAt: accessTokenExpiresAt,
      refreshExpiresAt: refreshTokenExpiresAt,
    })
    return {
      sessionId: session.id,
      accountId,
      accessToken,
      accessTokenExpiresAt,
      refreshToken,
      refreshTokenExpiresAt,
    }
  }
}

const normalizeEmail = (email: string) => email.trim().toLowerCase()
