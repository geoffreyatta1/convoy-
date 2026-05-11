const tseslint = require('typescript-eslint');
const reactHooksPlugin = require('eslint-plugin-react-hooks');

module.exports = tseslint.config(
  {
    ignores: [
      '.expo/**',
      'dist/**',
      'build/**',
      'node_modules/**',
      'scripts/**',
      'babel.config.js',
      'eslint.config.js',
    ],
  },
  tseslint.configs.recommended,
  {
    plugins: {
      'react-hooks': reactHooksPlugin,
    },
    rules: {
      ...reactHooksPlugin.configs.recommended.rules,
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
);
