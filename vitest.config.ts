import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['spike/**/*.test.ts', 'core/**/*.test.ts'],
    exclude: ['spike/electron-target/**', 'node_modules/**'],
    testTimeout: 15_000,
    hookTimeout: 15_000,
  },
})
