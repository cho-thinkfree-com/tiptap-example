import { z } from 'zod'
import { Argon2PasswordHasher, type PasswordHasher } from '../../lib/passwordHasher.js'
import type { AccountEntity, AccountRepository } from './accountRepository.js'

const registerAccountSchema = z.object({
  email: z.string().trim().min(1).email(),
  password: z.string().min(8).max(128),
  legalName: z
    .string()
    .trim()
    .max(200)
    .optional(),
  preferredLocale: z.string().optional(),
})

export type RegisterAccountInput = z.infer<typeof registerAccountSchema>

export class AccountService {
  constructor(
    private readonly repository: AccountRepository,
    private readonly passwordHasher: PasswordHasher = new Argon2PasswordHasher(),
  ) { }

  async registerAccount(input: RegisterAccountInput): Promise<AccountEntity> {
    const parsed = registerAccountSchema.parse(input)
    const normalizedEmail = parsed.email.toLowerCase()
    const passwordHash = await this.passwordHasher.hash(parsed.password)
    return this.repository.create({
      email: normalizedEmail,
      passwordHash,
      legalName: parsed.legalName,
      preferredLocale: parsed.preferredLocale,
    })
  }

  async findByEmail(email: string): Promise<AccountEntity | null> {
    return this.repository.findByEmail(email.toLowerCase())
  }

  async updatePassword(accountId: string, newPassword: string): Promise<void> {
    const hash = await this.passwordHasher.hash(newPassword)
    await this.repository.updatePasswordHash(accountId, hash)
  }

  async updateAccount(accountId: string, data: Partial<RegisterAccountInput> & { preferredLocale?: string; preferredTimezone?: string }): Promise<AccountEntity> {
    if (data.email) {
      data.email = data.email.toLowerCase()
    }
    return this.repository.update(accountId, data)
  }
}
