import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('=== Checking deleted documents ===\n')

    const deletedDocs = await prisma.fileSystemEntry.findMany({
        where: {
            deletedAt: { not: null },
            type: 'file'
        },
        select: {
            id: true,
            name: true,
            parentId: true,
            deletedAt: true,
            deletedBy: true,
            originalParentId: true,
        },
        orderBy: {
            deletedAt: 'desc'
        },
        take: 5
    })

    for (const doc of deletedDocs) {
        console.log(`\n📄 Document: "${doc.name}"`)
        console.log(`   ID: ${doc.id}`)
        console.log(`   Current parentId: ${doc.parentId}`)
        console.log(`   originalParentId: ${doc.originalParentId}`)
        console.log(`   deletedBy: ${doc.deletedBy}`)
        console.log(`   deletedAt: ${doc.deletedAt}`)

        if (doc.originalParentId) {
            const folder = await prisma.fileSystemEntry.findUnique({
                where: { id: doc.originalParentId },
                select: { id: true, name: true, deletedAt: true, parentId: true }
            })

            if (folder) {
                console.log(`   ✅ Original folder exists: "${folder.name}"`)
                console.log(`      Folder deleted: ${folder.deletedAt ? 'YES' : 'NO'}`)
                console.log(`      Folder parentId: ${folder.parentId}`)
            } else {
                console.log(`   ❌ Original folder NOT found`)
            }
        } else {
            console.log(`   ⚠️  No originalParentId saved`)
        }
    }

    console.log('\n\n=== Checking deleted folders ===\n')

    const deletedFolders = await prisma.fileSystemEntry.findMany({
        where: {
            deletedAt: { not: null },
            type: 'folder'
        },
        select: {
            id: true,
            name: true,
            parentId: true,
            deletedAt: true,
            deletedBy: true,
            originalParentId: true,
        },
        orderBy: {
            deletedAt: 'desc'
        },
        take: 5
    })

    for (const folder of deletedFolders) {
        console.log(`\n📁 Folder: "${folder.name}"`)
        console.log(`   ID: ${folder.id}`)
        console.log(`   Current parentId: ${folder.parentId}`)
        console.log(`   originalParentId: ${folder.originalParentId}`)
        console.log(`   deletedBy: ${folder.deletedBy}`)
        console.log(`   deletedAt: ${folder.deletedAt}`)

        if (folder.originalParentId) {
            const parent = await prisma.fileSystemEntry.findUnique({
                where: { id: folder.originalParentId },
                select: { id: true, name: true, deletedAt: true }
            })

            if (parent) {
                console.log(`   ✅ Original parent exists: "${parent.name}"`)
                console.log(`      Parent deleted: ${parent.deletedAt ? 'YES' : 'NO'}`)
            } else {
                console.log(`   ❌ Original parent NOT found`)
            }
        } else {
            console.log(`   ⚠️  No originalParentId saved (was in root)`)
        }
    }
}

main()
    .then(() => prisma.$disconnect())
    .catch((e) => {
        console.error(e)
        prisma.$disconnect()
    })
