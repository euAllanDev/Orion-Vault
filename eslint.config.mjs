import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'openspec/**', 'docs/**']
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['interfaces/web/**/*.{js,ts}'],
    ignores: ['interfaces/web/server.ts'],
    languageOptions: {
      globals: globals.browser
    }
  },
  {
    files: [
      'application/**/*.{js,ts}',
      'domain/**/*.{js,ts}',
      'infra/**/*.{js,ts}',
      'interfaces/desktop/**/*.{js,ts}',
      'interfaces/web/server.ts',
      'scripts/**/*.{js,ts}',
      'tests/**/*.{js,ts}',
      'vault/**/*.{js,ts}'
    ],
    languageOptions: {
      globals: globals.node
    }
  },
  {
    files: ['interfaces/desktop/preload.{ts,cjs}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node
      }
    }
  },
  {
    files: ['**/*.cjs'],
    languageOptions: {
      sourceType: 'commonjs'
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off'
    }
  },
  {
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }]
    }
  }
);
