import type { DatabaseClient } from '../../lib/prismaClient'

export interface PasswordResetTokenEntity {
  id: string
  accountId: string
  tokenHash: string
  expiresAt: Date
  usedAt?: Date | null
  createdAt: Date
}

export interface PasswordResetRepository {
  create(accountId: string, tokenHash: string, expiresAt: Date): Promise<PasswordResetTokenEntity>
  findByHash(tokenHash: string): Promise<PasswordResetTokenEntity | null>
  markUsed(id: string): Promise<void>
  deleteByAccount(accountId: string): Promise<void>
}

export class PrismaPasswordResetRepository implements PasswordResetRepository {
  constructor(private readonly prisma: DatabaseClient) {}

  async create(accountId: string, tokenHash: string, expiresAt: Date): Promise<PasswordResetTokenEntity> {
    await this.prisma.passwordResetToken.deleteMany({
      where: { accountId },
    })
    const token = await this.prisma.passwordResetToken.create({
      data: {
        accountId,
        tokenHash,
        expiresAt,
      },
    })
    return toEntity(token)
  }

  async findByHash(tokenHash: string): Promise<PasswordResetTokenEntity | null> {
    const token = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    })
    return token ? toEntity(token) : null
  }

  async markUsed(id: string): Promise<void> {
    await this.prisma.passwordResetToken.update({
      where: { id },
      data: { usedAt: new Date() },
    })
  }

  async deleteByAccount(accountId: string): Promise<void> {
    await this.prisma.passwordResetToken.deleteMany({ where: { accountId } })
  }
}

const toEntity = (token: {
  id: string
  accountId: string
  tokenHash: string
  expiresAt: Date
  usedAt: Date | null
  createdAt: Date
}): PasswordResetTokenEntity => ({
  id: token.id,
  accountId: token.accountId,
  tokenHash: token.tokenHash,
  expiresAt: token.expiresAt,
  usedAt: token.usedAt,
  createdAt: token.createdAt,
})
