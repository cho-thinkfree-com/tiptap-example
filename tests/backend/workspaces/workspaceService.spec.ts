import { describe, it, beforeEach, afterEach, expect } from 'vitest'
import { z } from 'zod'
import { createPrismaClient } from '../../../server/src/lib/prismaClient'
import { PrismaAccountRepository } from '../../../server/src/modules/accounts/accountRepository'
import { AccountService } from '../../../server/src/modules/accounts/accountService'
import { WorkspaceRepository } from '../../../server/src/modules/workspaces/workspaceRepository'
import { WorkspaceService, WorkspaceNotFoundError } from '../../../server/src/modules/workspaces/workspaceService'
import { createTestDatabase } from '../support/testDatabase'

describe('WorkspaceService', () => {
  let prisma = createPrismaClient()
  let dbHandle: ReturnType<typeof createTestDatabase> | null = null
  let accountService: AccountService
  let workspaceService: WorkspaceService
  let ownerId: string

  beforeEach(async () => {
    dbHandle = createTestDatabase()
    prisma = createPrismaClient({ datasourceUrl: dbHandle.url })
    const accountRepository = new PrismaAccountRepository(prisma)
    accountService = new AccountService(accountRepository)
    const workspaceRepository = new WorkspaceRepository(prisma)
    workspaceService = new WorkspaceService(workspaceRepository)

    const account = await accountService.registerAccount({ email: 'owner@example.com', password: 'Sup3rSecure!' })
    ownerId = account.id
  })

  afterEach(async () => {
    await prisma.$disconnect()
    dbHandle?.cleanup()
    dbHandle = null
  })

  it('creates a workspace and lists it for the owner', async () => {
    const workspace = await workspaceService.create(ownerId, { name: 'Team Space' })
    expect(workspace.slug).toBe('team-space')

    const list = await workspaceService.listOwned(ownerId)
    expect(list).toHaveLength(1)
    expect(list[0].id).toBe(workspace.id)
  })

  it('lists workspaces in creation order and fetches by id', async () => {
    const first = await workspaceService.create(ownerId, { name: 'First Space' })
    const second = await workspaceService.create(ownerId, { name: 'Second Space' })

    const list = await workspaceService.listOwned(ownerId)
    expect(list.map((w) => w.id)).toEqual([first.id, second.id])

    const fetched = await workspaceService.getById(second.id)
    expect(fetched?.name).toBe('Second Space')
  })

  it('ensures slug uniqueness when names collide', async () => {
    const first = await workspaceService.create(ownerId, { name: 'Duplicate' })
    const second = await workspaceService.create(ownerId, { name: 'Duplicate' })
    expect(first.slug).not.toEqual(second.slug)
  })

  it('updates metadata fields individually', async () => {
    const workspace = await workspaceService.create(ownerId, { name: 'Original' })
    const updated = await workspaceService.update(ownerId, workspace.id, {
      name: 'Renamed',
      coverImage: 'https://cdn.example.com/img.png',
    })
    expect(updated.name).toBe('Renamed')
    expect(updated.coverImage).toBe('https://cdn.example.com/img.png')
  })

  it('requires at least one field when updating', async () => {
    const workspace = await workspaceService.create(ownerId, { name: 'No Change' })
    await expect(workspaceService.update(ownerId, workspace.id, {} as any)).rejects.toBeInstanceOf(z.ZodError)
  })

  it('rejects non-HTTPS cover images and invalid locales', async () => {
    const workspace = await workspaceService.create(ownerId, { name: 'Validation' })
    await expect(
      workspaceService.update(ownerId, workspace.id, {
        coverImage: 'http://insecure.example.com/img.png',
      }),
    ).rejects.toBeInstanceOf(z.ZodError)

    await expect(
      workspaceService.update(ownerId, workspace.id, {
        defaultLocale: 'k', // too short
      }),
    ).rejects.toBeInstanceOf(z.ZodError)
  })

  it('prevents non-owners from updating or deleting', async () => {
    const workspace = await workspaceService.create(ownerId, { name: 'Protected' })
    const other = await accountService.registerAccount({ email: 'other@example.com', password: 'Sup3rSecure!' })
    await expect(workspaceService.update(other.id, workspace.id, { name: 'Hack' })).rejects.toBeInstanceOf(
      WorkspaceNotFoundError,
    )
    await expect(workspaceService.softDelete(other.id, workspace.id)).rejects.toBeInstanceOf(WorkspaceNotFoundError)
  })

  it('soft deletes workspaces and is idempotent', async () => {
    const workspace = await workspaceService.create(ownerId, { name: 'Temp' })
    await workspaceService.softDelete(ownerId, workspace.id)

    const list = await workspaceService.listOwned(ownerId)
    expect(list).toHaveLength(0)

    await expect(workspaceService.softDelete(ownerId, workspace.id)).resolves.toBeUndefined()
    const fetched = await workspaceService.getById(workspace.id)
    expect(fetched).toBeNull()
  })
})
