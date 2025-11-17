import type {
  DocumentPermission as DocumentPermissionModel,
  DocumentPermissionRole,
  DocumentPermissionPrincipalType,
} from '@prisma/client'
import type { DatabaseClient } from '../../lib/prismaClient'
import type { MembershipEntity } from '../workspaces/membershipRepository'

export interface DocumentPermissionEntity {
  id: string
  documentId: string
  principalType: DocumentPermissionPrincipalType
  principalId: string
  membershipId?: string | null
  role: DocumentPermissionRole
  createdAt: Date
  updatedAt: Date
  membership?: MembershipEntity | null
}

export class DocumentPermissionRepository {
  constructor(private readonly prisma: DatabaseClient) {}

  async listByDocument(documentId: string): Promise<DocumentPermissionEntity[]> {
    const permissions = await this.prisma.documentPermission.findMany({
      where: { documentId },
      include: {
        membership: true,
      },
      orderBy: { createdAt: 'asc' },
    })
    return permissions.map(toEntity)
  }

  async findById(id: string): Promise<DocumentPermissionEntity | null> {
    const permission = await this.prisma.documentPermission.findUnique({
      where: { id },
      include: { membership: true },
    })
    return permission ? toEntity(permission) : null
  }

  async findByDocumentAndMembership(documentId: string, membershipId: string): Promise<DocumentPermissionEntity | null> {
    const permission = await this.prisma.documentPermission.findUnique({
      where: {
        documentId_principalType_principalId: {
          documentId,
          principalType: 'membership',
          principalId: membershipId,
        },
      },
      include: { membership: true },
    })
    return permission ? toEntity(permission) : null
  }

  async upsertMembershipPermission(documentId: string, membershipId: string, role: DocumentPermissionRole) {
    const permission = await this.prisma.documentPermission.upsert({
      where: {
        documentId_principalType_principalId: {
          documentId,
          principalType: 'membership',
          principalId: membershipId,
        },
      },
      update: { role },
      create: {
        documentId,
        principalType: 'membership',
        principalId: membershipId,
        membershipId,
        role,
      },
      include: { membership: true },
    })
    return toEntity(permission)
  }

  async delete(id: string): Promise<void> {
    await this.prisma.documentPermission.delete({ where: { id } })
  }
}

const toEntity = (
  permission: DocumentPermissionModel & { membership?: WorkspaceMembership | null },
): DocumentPermissionEntity => ({
  id: permission.id,
  documentId: permission.documentId,
  principalType: permission.principalType,
  principalId: permission.principalId,
  membershipId: permission.membershipId,
  role: permission.role,
  createdAt: permission.createdAt,
  updatedAt: permission.updatedAt,
  membership: mapMembership(permission.membership),
})


const mapMembership = (membership?: WorkspaceMembership | null): MembershipEntity | null => {
  if (!membership) return null
  return {
    id: membership.id,
    workspaceId: membership.workspaceId,
    accountId: membership.accountId,
    role: membership.role,
    status: membership.status,
    displayName: membership.displayName,
    avatarUrl: membership.avatarUrl,
    timezone: membership.timezone,
    preferredLocale: membership.preferredLocale,
    notifications: membership.notifications as Record<string, unknown> | null,
    createdAt: membership.createdAt,
    updatedAt: membership.updatedAt,
  }
}
