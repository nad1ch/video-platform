import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.ts', '../call-core/__tests__/**/*.test.ts'],
  },
})
