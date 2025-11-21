import { PrismaClient } from '@prisma/client'
import { AuthService } from './server/src/modules/auth/authService'
import { AccountService } from './server/src/modules/accounts/accountService'
import { PrismaAccountRepository } from './server/src/modules/accounts/accountRepository'
import { PrismaSessionRepository } from './server/src/modules/auth/sessionRepository'
import { PrismaPasswordResetRepository } from './server/src/modules/auth/passwordResetRepository'
import { WorkspaceService } from './server/src/modules/workspaces/workspaceService'
import { WorkspaceRepository } from './server/src/modules/workspaces/workspaceRepository'
import { MembershipRepository } from './server/src/modules/workspaces/membershipRepository'
import { WorkspaceAccessService } from './server/src/modules/workspaces/workspaceAccess'

const prisma = new PrismaClient()

async function main() {
    const accountRepo = new PrismaAccountRepository(prisma)
    const accountService = new AccountService(accountRepo)
    const sessionRepo = new PrismaSessionRepository(prisma)
    const passwordResetRepo = new PrismaPasswordResetRepository(prisma)
    const authService = new AuthService(accountService, accountRepo, sessionRepo, passwordResetRepo)

    const workspaceRepo = new WorkspaceRepository(prisma)
    const membershipRepo = new MembershipRepository(prisma)
    const workspaceAccess = new WorkspaceAccessService(workspaceRepo, membershipRepo)
    const workspaceService = new WorkspaceService(workspaceRepo, membershipRepo, workspaceAccess, accountRepo)

    const email = `test-ja-${Date.now()}@example.com`
    const password = 'password123'
    const legalName = 'Test User JA'
    const preferredLanguage = 'ja-JP'

    console.log(`Signing up user ${email} with language ${preferredLanguage}...`)

    // 1. Signup
    const account = await authService.signup({
        email,
        password,
        legalName,
        preferredLanguage,
    })

    console.log('Signup successful. Account ID:', account.id)

    // 2. Verify Account preferredLanguage
    const savedAccount = await accountRepo.findById(account.id)
    if (savedAccount?.preferredLanguage !== preferredLanguage) {
        console.error(`FAILED: Account preferredLanguage mismatch. Expected ${preferredLanguage}, got ${savedAccount?.preferredLanguage}`)
        process.exit(1)
    }
    console.log('PASSED: Account preferredLanguage matches.')

    // 3. Create Workspace
    console.log('Creating workspace...')
    const workspace = await workspaceService.create(account.id, {
        name: 'Test Workspace JA',
        visibility: 'private',
    })
    console.log('Workspace created. ID:', workspace.id)

    // 4. Verify Membership preferredLanguage
    const membership = await membershipRepo.findByWorkspaceAndAccount(workspace.id, account.id)
    if (membership?.preferredLanguage !== preferredLanguage) {
        console.error(`FAILED: Membership preferredLanguage mismatch. Expected ${preferredLanguage}, got ${membership?.preferredLanguage}`)
        process.exit(1)
    }
    console.log('PASSED: Membership preferredLanguage matches.')

    console.log('All checks passed!')
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
