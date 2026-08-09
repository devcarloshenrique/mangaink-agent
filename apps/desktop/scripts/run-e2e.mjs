import { execSync } from 'node:child_process'

process.env.MI_RUN_E2E = '1'

try {
  execSync('npx vitest run src/tests/e2e --reporter=verbose', {
    stdio: 'inherit',
    shell: true,
  })
} catch (error) {
  const code = typeof error.status === 'number' ? error.status : 1
  process.exit(code)
}
