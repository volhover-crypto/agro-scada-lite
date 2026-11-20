import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { HomePage } from './HomePage'

// Smoke-тест T01: приложение собирается и рендерится
describe('HomePage', () => {
  it('показывает заголовок приложения', () => {
    render(<HomePage />)
    expect(screen.getByRole('heading', { level: 1, name: 'Agro-SCADA Lite' })).toBeInTheDocument()
  })
})
