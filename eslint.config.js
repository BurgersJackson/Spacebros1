import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import prettierPlugin from 'eslint-plugin-prettier';

export default [
  {
    ignores: ['node_modules/**', 'dist/**', 'coverage/**', '*.min.js', 'electron/**', 'assets/**'],
  },
  js.configs.recommended,
  prettier,
  {
    plugins: {
      prettier: prettierPlugin,
    },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        // Browser globals
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        localStorage: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        Audio: 'readonly',
        Image: 'readonly',
        URL: 'readonly',
        Blob: 'readonly',
        fetch: 'readonly',
        // Node globals
        process: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        // Game-specific globals
        PIXI: 'readonly',
        phaser: 'readonly',
        GameContext: 'readonly',
      },
    },
    rules: {
      'prettier/prettier': 'error',
      'no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': 'warn',
      'eqeqeq': ['error', 'always'],
      curly: ['error', 'multi-line'],
      'no-var': 'error',
      'prefer-const': 'error',
      'no-undef': 'error',
      'no-dupe-keys': 'error',
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
];
