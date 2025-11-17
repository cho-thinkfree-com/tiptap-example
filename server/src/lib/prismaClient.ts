import { PrismaClient } from '@prisma/client'

export interface PrismaClientOptions {
  datasourceUrl?: string
}

export const createPrismaClient = (options: PrismaClientOptions = {}) => {
  const { datasourceUrl } = options
  const logLevels =
    process.env.NODE_ENV === 'test' ? [] : process.env.NODE_ENV === 'production' ? ['error'] : ['error', 'warn']
  return new PrismaClient({
    datasources: datasourceUrl
      ? {
          db: {
            url: datasourceUrl,
          },
        }
      : undefined,
    log: logLevels,
  })
}

export type DatabaseClient = ReturnType<typeof createPrismaClient>
