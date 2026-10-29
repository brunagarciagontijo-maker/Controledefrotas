import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', '.cache/**', 'node_modules/**', 'test-results/**'] },
  {
    ...js.configs.recommended,
    files: ['scripts/**/*.mjs'],
    languageOptions: { globals: globals.node, ecmaVersion: 'latest', sourceType: 'module' },
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      // React 18 sem React Compiler: mantem as verificacoes de hooks e dependencias.
      // As regras adicionais do compilador nao fazem parte deste pipeline.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  }
);
