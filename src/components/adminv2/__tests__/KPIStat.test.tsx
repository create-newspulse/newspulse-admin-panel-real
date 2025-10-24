/* @vitest-environment jsdom */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import KPIStat from '../KPIStat'

describe('KPIStat', () => {
  it('renders label and formatted numeric value', () => {
    render(<KPIStat label="Visitors" value={12345} />)
    expect(screen.getByText('Visitors')).toBeInTheDocument()
    // value formatted with Intl, but should contain 12345 regardless of locale separators
    expect(screen.getByText((c) => /12/.test(c) && /345/.test(c))).toBeInTheDocument()
  })

  it('shows positive delta with up arrow and green color', () => {
    render(<KPIStat label="Revenue" value={100} delta={+5} />)
    expect(screen.getByText('5')).toBeInTheDocument()
    const up = screen.getByText('▲')
    expect(up).toBeInTheDocument()
  })

  it('shows negative delta with down arrow and red color', () => {
    render(<KPIStat label="Churn" value={10} delta={-1} />)
    expect(screen.getByText('-1')).toBeInTheDocument()
    const down = screen.getByText('▼')
    expect(down).toBeInTheDocument()
  })
})
