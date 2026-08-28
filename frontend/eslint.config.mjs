// @ts-check
import angular from 'angular-eslint';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import rootConfig from '../eslint.config.mjs';

export default tseslint.config(
  ...rootConfig,
  {
    ignores: ['dist/**', '.angular/**']
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.browser
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    },
    extends: [...angular.configs.tsRecommended],
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        {type: 'attribute', prefix: 'app', style: 'camelCase'}
      ],
      '@angular-eslint/component-selector': [
        'error',
        {type: 'element', prefix: 'app', style: 'kebab-case'}
      ]
    }
  },
  {
    files: ['**/*.html'],
    extends: [...angular.configs.templateRecommended, ...angular.configs.templateAccessibility],
    rules: {}
  }
);
