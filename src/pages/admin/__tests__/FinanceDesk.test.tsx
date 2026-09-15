import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import FinanceDesk from '@/pages/admin/FinanceDesk';
import { api } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  api: {
    revenue: vi.fn(),
  },
}));

function summaryCard(label: string): HTMLElement {
  return screen.getByLabelText(`${label} summary`);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.revenue).mockResolvedValue({
    totalRevenue: 125000,
    paidAmount: 75000,
    outstandingAmount: 50000,
    revenueRecords: 8,
  });
});

afterEach(() => {
  cleanup();
});

describe('FinanceDesk summary metrics', () => {
  it('renders real Finance summary values from the existing revenue helper', async () => {
    render(<FinanceDesk />);

    expect(await within(summaryCard('Total Revenue')).findByText('₹1,25,000')).toBeInTheDocument();
    expect(within(summaryCard('Paid Amount')).getByText('₹75,000')).toBeInTheDocument();
    expect(within(summaryCard('Outstanding Amount')).getByText('₹50,000')).toBeInTheDocument();
    expect(within(summaryCard('Revenue Records')).getByText('8')).toBeInTheDocument();
    expect(screen.getByText('Connected real Finance source')).toBeInTheDocument();
    expect(api.revenue).toHaveBeenCalledTimes(1);
  });

  it('renders connected empty Finance source as truthful zeroes', async () => {
    vi.mocked(api.revenue).mockResolvedValueOnce({
      totalRevenue: 0,
      paidAmount: 0,
      outstandingAmount: 0,
      revenueRecords: 0,
    });

    render(<FinanceDesk />);

    expect(await within(summaryCard('Total Revenue')).findByText('₹0')).toBeInTheDocument();
    expect(within(summaryCard('Paid Amount')).getByText('₹0')).toBeInTheDocument();
    expect(within(summaryCard('Outstanding Amount')).getByText('₹0')).toBeInTheDocument();
    expect(within(summaryCard('Revenue Records')).getByText('0')).toBeInTheDocument();
    expect(screen.getByText('Connected real Finance source')).toBeInTheDocument();
  });

  it('shows unavailable state when the Finance source fails without fake zeroes', async () => {
    vi.mocked(api.revenue).mockResolvedValueOnce({ error: 'revenue-unavailable', status: 503 });

    render(<FinanceDesk />);

    expect(await screen.findByText('Finance summary is unavailable.')).toBeInTheDocument();
    expect(screen.getAllByText('Unavailable')).toHaveLength(4);
    expect(screen.queryByText('₹0')).toBeNull();
  });

  it('preserves existing Finance Desk controls and stays out of Analytics presentation', async () => {
    render(<FinanceDesk />);

    expect(await screen.findByText('Connected real Finance source')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Finance & Accounts Manager Scope' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Founder-only Finance Controls' })).toBeInTheDocument();
    expect(screen.getByText('Invoices and receipt records')).toBeInTheDocument();
    expect(screen.getByText('Revenue and expense entries')).toBeInTheDocument();
    expect(screen.getByText('Sponsor payment status')).toBeInTheDocument();
    expect(screen.getByText('Monthly finance reports for Founder review')).toBeInTheDocument();
    expect(screen.getByText('Reconciliation summary exports')).toBeInTheDocument();
    expect(screen.getByText('Bank detail changes')).toBeInTheDocument();
    expect(screen.getByText('Payment gateway settings')).toBeInTheDocument();
    expect(screen.getByText('Withdrawal approvals')).toBeInTheDocument();
    expect(screen.getByText('Finance record deletion')).toBeInTheDocument();
    expect(screen.getByText('Final finance report approval')).toBeInTheDocument();
    expect(screen.queryByText('Readership Analytics')).toBeNull();
    expect(screen.queryByText('Ad Performance')).toBeNull();
  });
});