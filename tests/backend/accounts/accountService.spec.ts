import { describe, it, beforeEach, afterEach, expect } from 'vitest'
import { createPrismaClient } from '../../../server/src/lib/prismaClient'
import { PrismaAccountRepository } from '../../../server/src/modules/accounts/accountRepository'
import { AccountService } from '../../../server/src/modules/accounts/accountService'
import { AccountAlreadyExistsError } from '../../../server/src/modules/accounts/errors'
import { createTestDatabase } from '../support/testDatabase'

describe('AccountService', () => {
  const password = 'Sup3rSecure!'
  let prisma = createPrismaClient()
  let dbHandle: ReturnType<typeof createTestDatabase> | null = null
  let service: AccountService

  beforeEach(() => {
    dbHandle = createTestDatabase()
    prisma = createPrismaClient({ datasourceUrl: dbHandle.url })
    const repository = new PrismaAccountRepository(prisma)
    service = new AccountService(repository)
  })

  afterEach(async () => {
    await prisma.$disconnect()
    dbHandle?.cleanup()
    dbHandle = null
  })

  it('creates an account with normalized email and hashed password', async () => {
    const account = await service.registerAccount({
      email: 'User@Example.Com  ',
      password,
      legalName: 'User Example',
    })

    expect(account.email).toBe('user@example.com')
    expect(account.legalName).toBe('User Example')
    expect(account.id).toBeTruthy()

    const stored = await prisma.account.findUnique({
      where: { email: 'user@example.com' },
    })

    expect(stored?.passwordHash).toBeDefined()
    expect(stored?.passwordHash).not.toEqual(password)
    expect(stored?.createdAt).toBeInstanceOf(Date)
    expect(stored?.updatedAt).toBeInstanceOf(Date)
  })

  it('rejects duplicate account emails', async () => {
    await service.registerAccount({ email: 'dup@example.com', password })

    await expect(service.registerAccount({ email: 'dup@example.com', password })).rejects.toBeInstanceOf(
      AccountAlreadyExistsError,
    )
  })

  it('retrieves accounts by email', async () => {
    await service.registerAccount({ email: 'lookup@example.com', password, legalName: 'Lookup User' })
    const account = await service.findByEmail('LOOKUP@example.com')
    expect(account).not.toBeNull()
    expect(account?.email).toBe('lookup@example.com')
    expect(account?.legalName).toBe('Lookup User')
  })
})
