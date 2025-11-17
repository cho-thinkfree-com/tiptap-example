import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

interface TestDatabaseHandle {
  url: string
  cleanup: () => void
}

const prismaBinary = path.join(
  process.cwd(),
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'prisma.cmd' : 'prisma',
)

const runPrismaMigrate = (databaseUrl: string) => {
  const args = ['migrate', 'deploy', '--schema', 'prisma/schema.prisma']
  const execOptions = {
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
    },
    stdio: 'pipe' as const,
  }
  if (process.platform === 'win32') {
    execFileSync('cmd', ['/c', prismaBinary, ...args], execOptions)
  } else {
    execFileSync(prismaBinary, args, execOptions)
  }
}

export const createTestDatabase = (): TestDatabaseHandle => {
  const dir = mkdtempSync(path.join(tmpdir(), 'tiptap-db-'))
  const filePath = path.join(dir, 'test.db')
  const url = `file:${filePath.replace(/\\/g, '/')}`
  runPrismaMigrate(url)
  return {
    url,
    cleanup: () => {
      rmSync(dir, { recursive: true, force: true })
    },
  }
}
