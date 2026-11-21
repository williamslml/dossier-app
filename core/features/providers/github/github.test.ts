import { describe, expect, it } from 'vitest'
import { deriveNoreplyEmail } from './github.ts'

// P1.3 (requirements.md): sin red, puro — se puede probar unitariamente
// aunque el Device Flow en sí sea interactivo.

describe('deriveNoreplyEmail (P1.3)', () => {
  it('cuentas creadas desde el 2017-07-18 usan el email con id', () => {
    expect(deriveNoreplyEmail('juan-dev', 12345, '2017-07-18T00:00:00Z')).toBe(
      '12345+juan-dev@users.noreply.github.com',
    )
    expect(deriveNoreplyEmail('juan-dev', 12345, '2020-01-01T00:00:00Z')).toBe(
      '12345+juan-dev@users.noreply.github.com',
    )
  })

  it('cuentas anteriores al 2017-07-18 usan el email sin id', () => {
    expect(deriveNoreplyEmail('juan-dev', 12345, '2017-07-17T23:59:59Z')).toBe(
      'juan-dev@users.noreply.github.com',
    )
    expect(deriveNoreplyEmail('juan-dev', 12345, '2010-05-01T00:00:00Z')).toBe(
      'juan-dev@users.noreply.github.com',
    )
  })
})
