import { describe, it, beforeEach, afterEach, expect } from 'vitest'
import { createPrismaClient } from '../../../server/src/lib/prismaClient'
import { buildServer } from '../../../server/src/app'
import { createTestDatabase } from '../support/testDatabase'

describe('ExportRoutes', () => {
  let prisma = createPrismaClient()
  let server = buildServer({ logger: false })
  let dbHandle: ReturnType<typeof createTestDatabase> | null = null
  let workspaceId: string
  let accountId: string
  let token: string

  beforeEach(async () => {
    dbHandle = createTestDatabase()
    prisma = createPrismaClient({ datasourceUrl: dbHandle.url })
    server = buildServer({ prisma, logger: false })
    await server.ready()
    const account = await prisma.account.create({
      data: { email: 'export@example.com', passwordHash: 'hash', status: 'ACTIVE' },
    })
    accountId = account.id
    const workspace = await prisma.workspace.create({
      data: {
        name: 'Export WS',
        slug: 'export-ws',
        defaultLocale: 'en',
        defaultTimezone: 'UTC',
        visibility: 'private',
        ownerAccountId: account.id,
        allowedDomains: [],
      },
    })
    workspaceId = workspace.id
    const membership = await prisma.workspaceMembership.create({
      data: { workspaceId, accountId, role: 'owner', status: 'active' },
    })
    token = 'export-token'
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
        title: 'Exportable Doc',
        slug: 'export-doc',
        status: 'draft',
        visibility: 'private',
        ownerMembershipId: membership.id,
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

  it('creates export job and exposes result', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/api/export',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        workspaceId,
        documentId: (await prisma.document.findFirst({ where: { workspaceId } }))?.id,
        format: 'pdf',
      },
    })
    expect(response.statusCode).toBe(201)
    const job = response.json()
    expect(job.status).toBe('pending')
    expect(job.workspaceId).toBe(workspaceId)
    await new Promise((res) => setTimeout(res, 1200))
    const statusResp = await server.inject({
      method: 'GET',
      url: `/api/export/${job.id}`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(statusResp.statusCode).toBe(200)
    const updated = statusResp.json()
    expect(updated.status).toBe('completed')
    expect(updated.resultUrl).toContain('/exports/')
  })

  it('prevents fetching export job from another member', async () => {
    const jobResp = await server.inject({
      method: 'POST',
      url: '/api/export',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        workspaceId,
        format: 'pdf',
      },
    })
    expect(jobResp.statusCode).toBe(201)
    const { id } = jobResp.json()
    const otherAccount = await prisma.account.create({
      data: { email: 'other@example.com', passwordHash: 'hash', status: 'ACTIVE' },
    })
    const otherWorkspace = await prisma.workspace.create({
      data: {
        name: 'Other WS',
        slug: 'other-ws',
        defaultLocale: 'en',
        defaultTimezone: 'UTC',
        visibility: 'private',
        ownerAccountId: otherAccount.id,
        allowedDomains: [],
      },
    })
    await prisma.workspaceMembership.create({
      data: {
        workspaceId: otherWorkspace.id,
        accountId: otherAccount.id,
        role: 'owner',
        status: 'active',
      },
    })
    const otherToken = 'other-token'
    await prisma.session.create({
      data: {
        accountId: otherAccount.id,
        accessToken: otherToken,
        refreshTokenHash: 'refresh3',
        accessExpiresAt: new Date(Date.now() + 10000),
        refreshExpiresAt: new Date(Date.now() + 10000),
      },
    })
    const response = await server.inject({
      method: 'GET',
      url: `/api/export/${id}`,
      headers: { authorization: `Bearer ${otherToken}` },
    })
    expect(response.statusCode).toBe(403)
  })

  it('cancels pending job', async () => {
    const jobResp = await server.inject({
      method: 'POST',
      url: '/api/export',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        workspaceId,
        format: 'html',
      },
    })
    const job = jobResp.json()
    const cancelResp = await server.inject({
      method: 'POST',
      url: `/api/export/${job.id}/cancel`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(cancelResp.statusCode).toBe(200)
    const statusResp = await server.inject({
      method: 'GET',
      url: `/api/export/${job.id}`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(statusResp.json().status).toBe('cancelled')
  })
})
