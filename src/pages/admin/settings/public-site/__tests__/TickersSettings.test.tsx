import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import TickersSettings from '../TickersSettings';

const renderTickersSettings = () => render(<TickersSettings />, { wrapper: MemoryRouter });

describe('TickersSettings (Broadcast Center ownership)', () => {
  it('shows the informational ownership message instead of a duplicate editor', () => {
    renderTickersSettings();

    expect(screen.getByText('Breaking & Live Updates')).toBeInTheDocument();
    expect(
      screen.getByText('Breaking and Live Updates ticker configuration is managed in Broadcast Center.')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Use Broadcast Center to manage ticker visibility, timing and editorial updates.')
    ).toBeInTheDocument();
  });

  it('provides a "Manage in Broadcast Center" action that routes to /admin/broadcast-center', () => {
    renderTickersSettings();

    const action = screen.getByRole('link', { name: 'Manage in Broadcast Center' });
    expect(action).toHaveAttribute('href', '/admin/broadcast-center');
  });

  it('no longer renders the duplicate Breaking/Live editable controls', () => {
    renderTickersSettings();

    expect(screen.queryByRole('switch', { name: 'Pause on hover' })).not.toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: 'Live Updates Ticker' })).not.toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: 'Breaking Ticker' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Live max items')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Live ticker speed')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Breaking max items')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Breaking ticker speed')).not.toBeInTheDocument();
    expect(screen.queryByText('Tickers')).not.toBeInTheDocument();
    expect(screen.queryByText('Control ticker visibility and speeds.')).not.toBeInTheDocument();
  });
});
