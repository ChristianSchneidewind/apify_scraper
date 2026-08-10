import tseslint from '@typescript-eslint/eslint-plugin';
import parser from '@typescript-eslint/parser';
import local from './tools/eslint-local-rules.mjs';

const fileLineRule = { 'local/max-file-lines': ['error', { max: 250 }] };

const typescriptRules = {
  '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
  '@typescript-eslint/no-explicit-any': 'error',
  '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
};

const languageOptions = {
  parser,
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: import.meta.dirname,
  },
};

export default [
  {
    files: ['cli/src/**/*.ts'],
    languageOptions,
    plugins: { '@typescript-eslint': tseslint, local },
    rules: {
      ...fileLineRule,
      ...typescriptRules,
      'local/centralized-types': 'error',
      'local/max-function-lines': ['error', { max: 45 }],
      'local/max-indent-depth': ['error', { max: 2 }],
    },
  },
  {
    files: ['cli/tests/**/*.ts'],
    languageOptions,
    plugins: { '@typescript-eslint': tseslint, local },
    rules: { ...fileLineRule, ...typescriptRules },
  },
  {
    files: ['tools/**/*.mjs', 'eslint.config.mjs'],
    plugins: { local },
    rules: fileLineRule,
  },
];
