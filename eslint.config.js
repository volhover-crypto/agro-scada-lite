import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  // Артефакты сборки/тестов и сгенерированные типы не линтим
  {
    ignores: [
      'dist',
      'coverage',
      'playwright-report',
      'test-results',
      'src/api/types.gen.ts',
      '.zcode-site/',
    ],
  },

  // База для всех js/ts-файлов
  { extends: [js.configs.recommended, ...tseslint.configs.recommended] },

  // Код приложения
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },

  // Конфиги и скрипты сборки (окружение Node)
  {
    files: ['*.js', '*.mjs', '*.ts', 'scripts/**/*'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.node },
    },
  },

  // Prettier отвечает за форматирование — выключаем конфликтующие правила
  prettier,
)
