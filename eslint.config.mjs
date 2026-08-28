// @ts-check
// Shared base ESLint config. `frontend` and `backend` each import this and
// layer their own framework-specific overrides on top.
import js from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.angular/**',
      '**/coverage/**',
      // These have their own eslint.config.mjs and are linted via their own npm scripts.
      'backend/**',
      'frontend/**'
    ]
  },
  js.configs.recommended,
  {
    files: ['**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}'],
    ...stylistic.configs.recommended,
    rules: {
      ...stylistic.configs.recommended.rules,
      '@stylistic/block-spacing': ['error', 'never'],
      '@stylistic/brace-style': ['error', '1tbs'],
      '@stylistic/comma-dangle': ['error', 'never'],
      '@stylistic/indent': ['error', 2, {
        ignoredNodes: ['Constructor'],
        FunctionDeclaration: {
          parameters: 'first'
        },
        FunctionExpression: {
          parameters: 'first'
        },
        SwitchCase: 1,
        VariableDeclarator: 'first'
      }],
      '@stylistic/member-delimiter-style': ['error', {
        overrides: {
          interface: {
            multiline: {
              delimiter: 'semi',
              requireLast: true
            }
          }
        }
      }],
      '@stylistic/no-extra-semi': ['error'],
      '@stylistic/object-curly-newline': ['error', {
        ObjectExpression: {
          consistent: true
        },
        ObjectPattern: {
          consistent: true
        },
        ExportDeclaration: 'never',
        ImportDeclaration: 'never'
      }],
      '@stylistic/object-curly-spacing': ['error', 'never', {
        overrides: {
          ImportAttributes: 'always',
          ImportDeclaration: 'never'
        }
      }],
      '@stylistic/one-var-declaration-per-line': ['error', 'always'],
      '@stylistic/quote-props': ['error', 'as-needed'],
      '@stylistic/semi': ['error', 'always'],
      '@stylistic/semi-style': ['error', 'last']
    }
  },
  {
    files: ['**/*.{ts,mts,cts,tsx}'],
    extends: [...tseslint.configs.recommended],
    rules: {
      '@typescript-eslint/explicit-function-return-type': ['error', {
        allowExpressions: false,
        allowTypedFunctionExpressions: true,
        allowHigherOrderFunctions: true
      }],
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      // Requires type-checked parsing (parserOptions.project); enable per-project once configured.
      '@typescript-eslint/no-deprecated': 'off',
      '@typescript-eslint/no-empty-function': ['error', {
        allow: ['constructors']
      }],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',
      '@typescript-eslint/no-unused-vars': 'error',
      '@typescript-eslint/no-var-requires': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/unbound-method': ['error', {
        ignoreStatic: true
      }]
    }
  }
);
