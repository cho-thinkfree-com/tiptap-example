import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createPrismaClient } from '../../../server/src/lib/prismaClient'
import { buildServer } from '../../../server/src/app'
import { createTestDatabase } from '../support/testDatabase'

describe('WorkspaceAuditRoutes', () => {
  let prisma = createPrismaClient()
  let server = buildServer({ logger: false })
  let dbHandle: ReturnType<typeof createTestDatabase> | null = null
  let workspaceId: string
  let ownerToken: string
  let memberToken: string

  beforeEach(async () => {
    dbHandle = createTestDatabase()
    prisma = createPrismaClient({ datasourceUrl: dbHandle.url })
    server = buildServer({ prisma, logger: false })
    await server.ready()

    const owner = await prisma.account.create({
      data: { email: 'owner@example.com', passwordHash: 'hash', status: 'ACTIVE' },
    })
    const workspace = await prisma.workspace.create({
      data: {
        name: 'workspace',
        slug: 'workspace',
        defaultLocale: 'en',
        defaultTimezone: 'UTC',
        visibility: 'private',
        ownerAccountId: owner.id,
      },
    })
    workspaceId = workspace.id
    const ownerMembership = await prisma.workspaceMembership.create({
      data: {
        workspaceId: workspace.id,
        accountId: owner.id,
        role: 'owner',
        status: 'active',
      },
    })

    await prisma.auditLog.createMany({
      data: [
        {
          workspaceId: workspace.id,
          actorType: 'membership',
          actorMembershipId: ownerMembership.id,
          action: 'created',
          entityType: 'document',
        },
        {
          workspaceId: workspace.id,
          actorType: 'membership',
          actorMembershipId: ownerMembership.id,
          action: 'updated',
          entityType: 'document',
        },
      ],
    })

    ownerToken = 'owner-token'
    await prisma.session.create({
      data: {
        accountId: owner.id,
        accessToken: ownerToken,
        refreshTokenHash: 'refresh',
        accessExpiresAt: new Date(Date.now() + 10000),
        refreshExpiresAt: new Date(Date.now() + 10000),
      },
    })

    const member = await prisma.account.create({
      data: { email: 'member@example.com', passwordHash: 'hash', status: 'ACTIVE' },
    })
    await prisma.workspaceMembership.create({
      data: {
        workspaceId: workspace.id,
        accountId: member.id,
        role: 'member',
        status: 'active',
      },
    })
    memberToken = 'member-token'
    await prisma.session.create({
      data: {
        accountId: member.id,
        accessToken: memberToken,
        refreshTokenHash: 'refresh2',
        accessExpiresAt: new Date(Date.now() + 10000),
        refreshExpiresAt: new Date(Date.now() + 10000),
      },
    })
  })

  afterEach(async () => {
    await server.close()
    await prisma.$disconnect()
    dbHandle?.cleanup()
    dbHandle = null
  })

  it('returns paginated audit logs for owner', async () => {
    const response = await server.inject({
      method: 'GET',
      url: `/api/workspaces/${workspaceId}/audit?pageSize=1`,
      headers: {
        authorization: `Bearer ${ownerToken}`,
      },
    })

    expect(response.statusCode).toBe(200)
    const payload = response.json()
    expect(payload).toMatchObject({
      page: 1,
      pageSize: 1,
      hasNextPage: true,
    })
    expect(Array.isArray(payload.logs)).toBe(true)
  })

  it('denies access for members without admin rights', async () => {
    const response = await server.inject({
      method: 'GET',
      url: `/api/workspaces/${workspaceId}/audit`,
      headers: {
        authorization: `Bearer ${memberToken}`,
      },
    })
    expect(response.statusCode).toBe(403)
  })

  it('requires authentication', async () => {
    const response = await server.inject({
      method: 'GET',
      url: `/api/workspaces/${workspaceId}/audit`,
    })
    expect(response.statusCode).toBe(401)
  })
})
