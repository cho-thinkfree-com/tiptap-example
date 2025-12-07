import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    // Find a document in a folder
    const doc = await prisma.fileSystemEntry.findFirst({
        where: {
            parentId: { not: null },
            deletedAt: null,
            type: 'file'
        },
        select: {
            id: true,
            name: true,
            parentId: true,
            workspaceId: true
        }
    })

    if (!doc) {
        console.log('❌ No documents in folders found to test')
        return
    }

    console.log(`📄 Found document: "${doc.name}"`)
    console.log(`   ID: ${doc.id}`)
    console.log(`   Current parentId: ${doc.parentId}`)

    // Find a membership for this workspace
    const membership = await prisma.workspaceMembership.findFirst({
        where: {
            workspaceId: doc.workspaceId,
            status: 'active'
        }
    })

    if (!membership) {
        console.log('❌ No active membership found')
        return
    }

    console.log(`\n📝 Testing softDelete with:`)
    console.log(`   membershipId: ${membership.id}`)
    console.log(`   folderId to save: ${doc.parentId}`)

    // Perform soft delete
    await prisma.fileSystemEntry.update({
        where: { id: doc.id },
        data: {
            deletedAt: new Date(),
            deletedBy: membership.id,
            originalParentId: doc.parentId
        }
    })

    console.log(`\n✅ Soft delete executed`)

    // Verify the result
    const updated = await prisma.fileSystemEntry.findUnique({
        where: { id: doc.id },
        select: {
            id: true,
            name: true,
            parentId: true,
            deletedAt: true,
            deletedBy: true,
            originalParentId: true
        }
    })

    console.log(`\n📊 Result:`)
    console.log(`   deletedAt: ${updated?.deletedAt}`)
    console.log(`   deletedBy: ${updated?.deletedBy}`)
    console.log(`   originalParentId: ${updated?.originalParentId}`)

    if (updated?.deletedBy && updated?.originalParentId) {
        console.log(`\n✅ SUCCESS: Both deletedBy and originalParentId are saved!`)
    } else {
        console.log(`\n❌ FAILED: Fields are still null`)
    }
}

main()
    .then(() => prisma.$disconnect())
    .catch((e) => {
        console.error(e)
        prisma.$disconnect()
    })
