// @ts-check
import js from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    // Alcance explícito: solo nuestro código. Todo lo demás (dependencias,
    // skills/MCP de terceros instalados por integrations.sh, docs) queda fuera.
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      'spike/electron-target/**',
      '.claude/**',
      '.agents/**',
      '.sfp/**',
      'docs/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    files: ['*.config.{js,ts}'],
  },
  {
    // Solo el código del producto: rutas siempre con path/os, nunca "\"
    // escritos a mano. No aplica a los propios configs (pueden
    // necesitar backslashes en literales/regex legítimos, como esta regla).
    files: ['core/**/*.ts', 'spike/**/*.ts'],
    ignores: ['spike/electron-target/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value=/\\\\\\\\/]',
          message: 'No escribas rutas con "\\\\" a mano: usa path.join/path.resolve.',
        },
      ],
    },
  },
  {
    // M1.3 (docs/adr/0003-stack-fundacional-y-sin-backend.md): core es Node puro, nunca importa electron.
    files: ['core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'electron',
              message:
                'core/ es Node puro (docs/adr/0003-stack-fundacional-y-sin-backend.md): electron solo se importa desde main/preload.',
            },
          ],
        },
      ],
    },
  },
)
