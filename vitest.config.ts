import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['spike/**/*.test.ts', 'core/**/*.test.ts', 'src/**/*.test.ts'],
    exclude: ['node_modules/**'],
    testTimeout: 15_000,
    hookTimeout: 15_000,
  },
})
