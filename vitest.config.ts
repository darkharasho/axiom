import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    testTimeout: 10000,
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
