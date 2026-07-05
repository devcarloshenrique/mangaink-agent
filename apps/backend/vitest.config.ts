import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    env: {
      NODE_ENV: 'test',
    },
    envFile: '.env.test',
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
