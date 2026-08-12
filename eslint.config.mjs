// @ts-check
import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    // Files ESLint should never touch
    ignores: ['eslint.config.mjs', 'scripts/', 'dist/', 'coverage/'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,

  // ── Production source files ───────────────────────────────────────────────
  {
    files: ['src/**/*.ts'],
    ignores: ['src/**/*.spec.ts', 'src/test/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
      sourceType: 'module',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
    },
  },

  // ── Test files (spec, mocks, fixtures, e2e) ───────────────────────────────
  // Uses tsconfig.spec.json which includes @types/jest, so jest.fn() etc. are typed.
  // Several strict unsafe-* rules are relaxed here because test helpers intentionally
  // use dynamic mocking patterns that TypeScript cannot fully resolve at compile time.
  {
    files: ['src/**/*.spec.ts', 'src/test/**/*.ts', 'test/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'module',
      parserOptions: {
        project: ['./tsconfig.spec.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
);
