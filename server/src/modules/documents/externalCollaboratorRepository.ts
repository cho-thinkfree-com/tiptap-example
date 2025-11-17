import type { ExternalCollaborator as CollaboratorModel, ExternalCollaboratorStatus } from '@prisma/client'
import type { DatabaseClient } from '../../lib/prismaClient'

export interface ExternalCollaboratorEntity {
  id: string
  email: string
  displayName?: string | null
  status: ExternalCollaboratorStatus
  createdAt: Date
  updatedAt: Date
}

export class ExternalCollaboratorRepository {
  constructor(private readonly prisma: DatabaseClient) {}

  async findByEmail(email: string): Promise<ExternalCollaboratorEntity | null> {
    const collaborator = await this.prisma.externalCollaborator.findUnique({ where: { email } })
    return collaborator ? toEntity(collaborator) : null
  }

  async findById(id: string): Promise<ExternalCollaboratorEntity | null> {
    const collaborator = await this.prisma.externalCollaborator.findUnique({ where: { id } })
    return collaborator ? toEntity(collaborator) : null
  }

  async create(email: string, displayName?: string | null): Promise<ExternalCollaboratorEntity> {
    const collaborator = await this.prisma.externalCollaborator.create({
      data: {
        email,
        displayName,
      },
    })
    return toEntity(collaborator)
  }
}

const toEntity = (collaborator: CollaboratorModel): ExternalCollaboratorEntity => ({
  id: collaborator.id,
  email: collaborator.email,
  displayName: collaborator.displayName,
  status: collaborator.status,
  createdAt: collaborator.createdAt,
  updatedAt: collaborator.updatedAt,
})
