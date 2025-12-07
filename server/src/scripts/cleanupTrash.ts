import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function cleanupOldTrash() {
    console.log('[Trash Cleanup] Starting cleanup of items older than 7 days...')

    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    try {
        const result = await prisma.fileSystemEntry.deleteMany({
            where: {
                deletedAt: {
                    lt: sevenDaysAgo
                }
            }
        })
        console.log(`[Trash Cleanup] Successfully deleted ${result.count} old items`)
    } catch (error) {
        console.error('[Trash Cleanup] Error during cleanup:', error)
        process.exit(1)
    } finally {
        await prisma.$disconnect()
    }
}

cleanupOldTrash()
