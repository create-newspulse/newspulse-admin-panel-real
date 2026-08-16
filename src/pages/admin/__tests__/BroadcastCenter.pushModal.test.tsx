import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import BroadcastCenter from '../BroadcastCenter';
import { BREAKING_PUSH_SPAM_WARNING } from '@/lib/pushSendFeedback';
import { getBroadcastConfig, listItems } from '@/api/broadcast';

vi.mock('@/components/ui/toast-bridge', () => ({
  useNotify: () => ({ ok: vi.fn(), err: vi.fn() }),
}));

vi.mock('@/api/broadcast', () => ({
  getBroadcastConfig: vi.fn(),
  listItems: vi.fn(),
  saveBroadcastConfig: vi.fn(),
  addItem: vi.fn(),
  deleteItem: vi.fn(),
}));

describe('BroadcastCenter breaking push modal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify({ items: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))));

    vi.mocked(getBroadcastConfig).mockResolvedValue({
      settings: {
        breaking: { enabled: true, mode: 'manual' },
        live: { enabled: true, mode: 'manual' },
      },
    });
    vi.mocked(listItems).mockResolvedValue([]);
  });

  it('shows the anti-spam warning in the breaking push confirmation modal', async () => {
    render(<BroadcastCenter />);

    const input = await screen.findByPlaceholderText('Add story (max 160 chars)');
    await waitFor(() => expect(input).not.toBeDisabled());

    fireEvent.change(input, { target: { value: 'Urgent admin update' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Send Breaking Push' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(screen.getByText('Send Breaking Push?')).toBeInTheDocument();
    expect(screen.getByText(BREAKING_PUSH_SPAM_WARNING)).toBeInTheDocument();
  }, 10_000);
});