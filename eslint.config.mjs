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
