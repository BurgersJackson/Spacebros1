/**
 * Vitest Configuration for Spacebros1
 * AI-callable test setup for Core Utilities and Game Systems
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Use node environment - game code doesn't need DOM
    environment: 'node',

    // Test file patterns
    include: ['tests/**/*.{test,spec}.{js,mjs}'],

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        'electron/',
        'dist/',
        'scripts/',
        'assets/'
      ]
    },

    // Show verbose output for better AI understanding
    reporters: ['verbose'],

    // Global setup file
    setupFiles: ['./tests/setup.js'],

    // Test timeout (game tests may need more time)
    testTimeout: 10000,
    hookTimeout: 10000
  }
});
