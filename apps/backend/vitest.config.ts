import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    hookTimeout: 30000,
    testTimeout: 30000,
    env: {
      NODE_ENV: 'test',
    },
    envFile: resolve(__dirname, '.env.test'),
    globalSetup: resolve(__dirname, './vitest.globalSetup.ts'),
    pool: 'forks',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/modules/**/use-cases/**'],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 80,
      },
    },
  },
})
