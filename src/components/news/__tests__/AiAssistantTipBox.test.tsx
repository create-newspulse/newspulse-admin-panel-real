import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AiAssistantTipBox, { hasMeaningfulArticleDraft } from '@/components/news/AiAssistantTipBox';

const mocks = vi.hoisted(() => ({
  adminJson: vi.fn(),
  adminFetch: vi.fn(),
  onApplyTitle: vi.fn(),
  onApplySlug: vi.fn(),
  onApplySummary: vi.fn(),
}));

vi.mock('@/lib/http/adminFetch', () => ({
  adminJson: mocks.adminJson,
  adminFetch: mocks.adminFetch,
}));

function renderAssistant(props: Partial<React.ComponentProps<typeof AiAssistantTipBox>> = {}) {
  return render(
    <AiAssistantTipBox
      title="Local bridge repair begins"
      summary=""
      content="The city engineering team began urgent repair work after residents reported cracks."
      language="en"
      onApplyTitle={mocks.onApplyTitle}
      onApplySlug={mocks.onApplySlug}
      onApplySummary={mocks.onApplySummary}
      {...props}
    />,
  );
}

beforeEach(() => {
  mocks.adminJson.mockResolvedValue({
    title: 'Bridge Repair Work Begins After Safety Review',
    slug: 'bridge-repair-work-begins-after-safety-review',
    summary: 'The city engineering team started urgent bridge repair work after residents reported cracks during a safety review.',
    tips: ['Add a source link for trust.'],
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('AiAssistantTipBox', () => {
  it('uses News Pulse Article Assistant wording and removes old visible assistant branding', () => {
    const { container } = renderAssistant();

    expect(screen.getByText('News Pulse Article Assistant')).toBeInTheDocument();
    expect(screen.getByText('Get headline, slug and summary suggestions based on your draft.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Suggest' })).toBeEnabled();
    expect(container).not.toHaveTextContent(/AI Assistant|Tip Box|upgrades to AI|powered by AI|AI generated|Offline/);
  });

  it('keeps Suggest unavailable until the journalist has written draft content', () => {
    renderAssistant({ title: '', summary: '', content: '' });

    expect(screen.getByText('Start writing your article to use draft assistance.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Suggest' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Suggest' }));

    expect(mocks.adminJson).not.toHaveBeenCalled();
  });

  it('uses the existing authenticated admin JSON helper for headline, slug and summary suggestions', async () => {
    renderAssistant();

    fireEvent.click(screen.getByRole('button', { name: 'Suggest' }));

    await waitFor(() => expect(mocks.adminJson).toHaveBeenCalledWith('/assist/suggest', expect.objectContaining({
      method: 'POST',
      json: expect.objectContaining({
        title: 'Local bridge repair begins',
        content: expect.stringContaining('city engineering team'),
        language: 'en',
      }),
    })));
    expect(mocks.adminFetch).not.toHaveBeenCalled();
    expect(await screen.findByText('Suggested Title')).toBeInTheDocument();
    expect(screen.getByText('Suggested Slug')).toBeInTheDocument();
    expect(screen.getByText('Suggested Summary')).toBeInTheDocument();
  });

  it('does not overwrite article fields until a suggestion is deliberately used', async () => {
    renderAssistant();

    fireEvent.click(screen.getByRole('button', { name: 'Suggest' }));
    await screen.findByText('Bridge Repair Work Begins After Safety Review');

    expect(mocks.onApplyTitle).not.toHaveBeenCalled();
    expect(mocks.onApplySlug).not.toHaveBeenCalled();
    expect(mocks.onApplySummary).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Use Title Suggestion' }));
    fireEvent.click(screen.getByRole('button', { name: 'Use Slug Suggestion' }));
    fireEvent.click(screen.getByRole('button', { name: 'Use Summary Suggestion' }));

    expect(mocks.onApplyTitle).toHaveBeenCalledWith('Bridge Repair Work Begins After Safety Review');
    expect(mocks.onApplySlug).toHaveBeenCalledWith('bridge-repair-work-begins-after-safety-review');
    expect(mocks.onApplySummary).toHaveBeenCalledWith(expect.stringContaining('urgent bridge repair work'));
  });

  it('treats title, summary, or body text as a meaningful draft', () => {
    expect(hasMeaningfulArticleDraft({ title: '', summary: '', content: '' })).toBe(false);
    expect(hasMeaningfulArticleDraft({ title: 'Draft headline', summary: '', content: '' })).toBe(true);
    expect(hasMeaningfulArticleDraft({ title: '', summary: 'Draft summary', content: '' })).toBe(true);
    expect(hasMeaningfulArticleDraft({ title: '', summary: '', content: '<p>Draft body</p>' })).toBe(true);
  });
});