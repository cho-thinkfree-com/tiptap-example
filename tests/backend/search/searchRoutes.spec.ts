import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildServer } from '../../../server/src/app'
import { createPrismaClient } from '../../../server/src/lib/prismaClient'
import { createTestDatabase } from '../support/testDatabase'

describe('SearchRoutes', () => {
  let prisma = createPrismaClient()
  let dbHandle: ReturnType<typeof createTestDatabase> | null = null
  let server = buildServer({ logger: false })
  let accountId: string
  let workspaceId: string
  let token: string

  beforeEach(async () => {
    dbHandle = createTestDatabase()
    prisma = createPrismaClient({ datasourceUrl: dbHandle.url })
    server = buildServer({ prisma, logger: false })
    await server.ready()
    const account = await prisma.account.create({
      data: { email: 'search@example.com', passwordHash: 'hash', status: 'ACTIVE' },
    })
    accountId = account.id
    const workspace = await prisma.workspace.create({
      data: {
        name: 'Search WS',
        slug: 'search-ws',
        defaultLocale: 'en',
        defaultTimezone: 'UTC',
        visibility: 'private',
        ownerAccountId: account.id,
        allowedDomains: [],
      },
    })
    workspaceId = workspace.id
    await prisma.workspaceMembership.create({
      data: { workspaceId, accountId, role: 'owner', status: 'active' },
    })
    token = 'search-token'
    await prisma.session.create({
      data: {
        accountId,
        accessToken: token,
        refreshTokenHash: 'refresh',
        accessExpiresAt: new Date(Date.now() + 10000),
        refreshExpiresAt: new Date(Date.now() + 10000),
      },
    })
    await prisma.document.create({
      data: {
        workspaceId,
        title: 'Foo Document',
        slug: 'foo',
        status: 'draft',
        visibility: 'private',
        ownerMembershipId: await prisma.workspaceMembership.findFirst({
          where: { workspaceId, accountId },
        }).then((membership) => membership?.id ?? ''),
        sortOrder: 0,
        workspaceDefaultAccess: 'viewer',
        workspaceEditorAdminsOnly: false,
      },
    })
  })

  afterEach(async () => {
    await server.close()
    await prisma.$disconnect()
    dbHandle?.cleanup()
    dbHandle = null
  })

  it('searches documents with filters', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/api/search',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        workspaceId,
        search: 'Foo',
        page: 1,
        pageSize: 10,
      },
    })
    expect(response.statusCode).toBe(200)
    const payload = response.json()
    expect(payload.total).toBeGreaterThan(0)
    expect(payload.documents).toHaveLength(1)
    expect(payload.hasNextPage).toBe(false)
  })

  it('activity feed returns audit logs', async () => {
    await prisma.auditLog.create({
      data: {
        workspaceId,
        actorType: 'membership',
        actorMembershipId: await prisma.workspaceMembership.findFirst({
          where: { workspaceId, accountId },
        }).then((m) => m?.id ?? ''),
        action: 'document.viewed',
        entityType: 'document',
      },
    })
    const response = await server.inject({
      method: 'GET',
      url: `/api/workspaces/${workspaceId}/activity-feed?page=1&pageSize=5`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.logs.length).toBeGreaterThan(0)
    expect(body.hasNextPage).toBe(false)
  })

  it('requires auth for activity feed', async () => {
    const response = await server.inject({
      method: 'GET',
      url: `/api/workspaces/${workspaceId}/activity-feed`,
    })
    expect(response.statusCode).toBe(401)
  })
})
