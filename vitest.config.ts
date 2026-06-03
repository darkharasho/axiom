import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    // Limit parallelism to avoid exhausting system memory
    pool: 'forks',
    poolOptions: {
      forks: { maxForks: 2, minForks: 1 },
    },
    maxWorkers: 2,
    minWorkers: 1,
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'electron/**/*.test.ts'],
    exclude: ['dist-electron/**', 'dist/**', 'node_modules/**'],
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'electron/shared'),
    },
  },
})
