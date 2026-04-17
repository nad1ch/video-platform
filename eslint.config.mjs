import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import pluginVue from 'eslint-plugin-vue'
import globals from 'globals'
import vueParser from 'vue-eslint-parser'

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', '**/.tmp/**', '**/coverage/**'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['apps/server/**/*.ts'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ['packages/call-core/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.es2021,
        ...globals.browser,
      },
    },
  },
  {
    files: ['apps/client/**/*.{ts,vue}'],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    files: ['apps/client/src/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2021,
      },
    },
  },
  {
    files: ['apps/client/scripts/**/*.mjs'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ['apps/client/*.config.js'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ['apps/server/**/*.cjs'],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    files: ['packages/wordle-core/**/*.cjs'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ['apps/client/src/eat-first/pages/ControlPage.vue'],
    rules: {
      // Orchestrator exposes a wide surface; this page’s template uses a subset. Trimming destructuring is high-churn.
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
  ...pluginVue.configs['flat/essential'],
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: ['.vue'],
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
  },
  {
    files: ['**/*.{ts,vue}'],
    rules: {
      // TypeScript / vue-tsc already resolve globals and types
      'no-undef': 'off',
    },
  },
)
