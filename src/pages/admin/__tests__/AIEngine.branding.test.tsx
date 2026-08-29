import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AIEngine from '@/pages/admin/AIEngine';

vi.mock('@/lib/api', () => ({
  api: {},
}));

vi.mock('@/lib/apiBase', () => ({
  apiUrl: (path: string) => path,
}));

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({}), { status: 200 })));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AIEngine visible branding', () => {
  it('renders the existing route as News Pulse Engine', async () => {
    render(<AIEngine />);

    expect(await screen.findByRole('heading', { name: /news pulse engine/i })).toBeInTheDocument();
    expect(screen.queryByText(/News Pulse AI Engine/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText('News Pulse Engine Provider')).toBeInTheDocument();
  });
});