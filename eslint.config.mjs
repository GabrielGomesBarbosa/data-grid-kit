import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'

/**
 * Structure rules that CI (or the pre-push hook) enforces:
 *  - a source file stays under 500 lines (blank lines and comments do not count): split it before it grows
 *  - hooks follow the rules of hooks
 * `legacyLarge` lists files that are still too big. Each has an issue; remove the file from the list when it is split.
 */
const legacyLarge = [
  'apps/docs/pages.tsx', // #43
]

export default tseslint.config(
  { ignores: ['**/dist/**', '**/.next/**', '**/node_modules/**', '**/.turbo/**', 'apps/next-example/next-env.d.ts'] },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { parser: tseslint.parser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'max-lines': ['error', { max: 500, skipBlankLines: true, skipComments: true }],
      'no-duplicate-imports': 'error',
    },
  },
  // tests describe many cases: a higher limit, still not unbounded
  { files: ['**/*.test.{ts,tsx}'], rules: { 'max-lines': ['error', { max: 800, skipBlankLines: true, skipComments: true }] } },
  { files: legacyLarge, rules: { 'max-lines': 'off' } },
)
