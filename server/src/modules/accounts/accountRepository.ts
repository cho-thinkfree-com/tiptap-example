import { Prisma, type Account as AccountModel, type AccountStatus } from '@prisma/client'
import type { DatabaseClient } from '../../lib/prismaClient'
import { AccountAlreadyExistsError } from './errors'

export interface CreateAccountInput {
  email: string
  passwordHash: string
  legalName?: string
  recoveryEmail?: string
  recoveryPhone?: string
  status?: AccountStatus
}

export interface AccountEntity {
  id: string
  email: string
  status: AccountStatus
  legalName?: string | null
  recoveryEmail?: string | null
  recoveryPhone?: string | null
  createdAt: Date
  updatedAt: Date
}

export interface AccountWithPassword extends AccountEntity {
  passwordHash: string
}

export interface AccountRepository {
  create(data: CreateAccountInput): Promise<AccountEntity>
  findByEmail(email: string): Promise<AccountEntity | null>
  findAuthRecordByEmail(email: string): Promise<AccountWithPassword | null>
  findAuthRecordById(id: string): Promise<AccountWithPassword | null>
  updatePasswordHash(accountId: string, passwordHash: string): Promise<void>
  softDelete(accountId: string): Promise<void>
}

export class PrismaAccountRepository implements AccountRepository {
  constructor(private readonly prisma: DatabaseClient) {}

  async create(data: CreateAccountInput): Promise<AccountEntity> {
    try {
      const account = await this.prisma.account.create({
        data: {
          email: data.email,
          passwordHash: data.passwordHash,
          legalName: data.legalName,
          recoveryEmail: data.recoveryEmail,
          recoveryPhone: data.recoveryPhone,
          status: data.status,
        },
      })
      return toEntity(account)
    } catch (error) {
      if (isUniqueEmailError(error)) {
        throw new AccountAlreadyExistsError(data.email)
      }
      throw error
    }
  }

  async findByEmail(email: string): Promise<AccountEntity | null> {
    const account = await this.prisma.account.findUnique({
      where: { email },
    })
    return account ? toEntity(account) : null
  }

  async findAuthRecordByEmail(email: string): Promise<AccountWithPassword | null> {
    const account = await this.prisma.account.findUnique({
      where: { email },
    })
    return account ? { ...toEntity(account), passwordHash: account.passwordHash } : null
  }

  async findAuthRecordById(id: string): Promise<AccountWithPassword | null> {
    const account = await this.prisma.account.findUnique({ where: { id } })
    return account ? { ...toEntity(account), passwordHash: account.passwordHash } : null
  }

  async updatePasswordHash(accountId: string, passwordHash: string): Promise<void> {
    await this.prisma.account.update({
      where: { id: accountId },
      data: { passwordHash },
    })
  }

  async softDelete(accountId: string): Promise<void> {
    await this.prisma.account.update({
      where: { id: accountId },
      data: {
        status: 'DELETED',
        recoveryEmail: null,
        recoveryPhone: null,
      },
    })
  }
}

const toEntity = (account: AccountModel): AccountEntity => ({
  id: account.id,
  email: account.email,
  status: account.status,
  legalName: account.legalName,
  recoveryEmail: account.recoveryEmail,
  recoveryPhone: account.recoveryPhone,
  createdAt: account.createdAt,
  updatedAt: account.updatedAt,
})

const isUniqueEmailError = (error: unknown): boolean => {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false
  }
  return error.code === 'P2002' && Array.isArray(error.meta?.target) && error.meta?.target.includes('email')
}
