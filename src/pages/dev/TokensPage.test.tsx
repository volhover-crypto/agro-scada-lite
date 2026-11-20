import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TokensPage } from './TokensPage'

// Smoke-тест витрины токенов (T02)
describe('TokensPage', () => {
  it('показывает заголовок витрины', () => {
    render(<TokensPage />)
    expect(screen.getByRole('heading', { level: 1, name: 'Витрина токенов' })).toBeInTheDocument()
  })

  it('показывает все четыре приоритета тревог', () => {
    render(<TokensPage />)
    for (const label of ['P1 Авария', 'P2 Важно', 'P3 Предупреждение', 'P4 Информация']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
  })
})
