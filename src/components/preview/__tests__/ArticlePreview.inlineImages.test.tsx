import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import ArticlePreview from '@/components/preview/ArticlePreview';

afterEach(() => {
  cleanup();
});

describe('ArticlePreview inline images', () => {
  it('shows no credit text for image-only inline markup', () => {
    render(<ArticlePreview article={{
      title: 'Inline image preview',
      content: '<figure data-np-block="inline-image" data-np-media-id="media-1"><img src="https://cdn.newspulse.co.in/inline/image-only.jpg" alt="Image only"></figure>',
    }} />);

    expect(screen.queryByText(/Credit:/i)).toBeNull();
    expect(screen.queryByText(/article-inline/i)).toBeNull();
    expect(screen.queryByText(/article-gallery/i)).toBeNull();
    expect(screen.queryByText(/cloudinary/i)).toBeNull();
  });

  it('shows an explicitly entered inline image credit', () => {
    const { container } = render(<ArticlePreview article={{
      title: 'Inline image preview',
      content: '<figure data-np-block="inline-image" data-np-media-id="media-2"><img src="https://cdn.newspulse.co.in/inline/credit.jpg" alt="Credit"><div data-np-credit="true">Credit: PTI</div></figure>',
    }} />);

    expect(container.querySelector('.prose [data-np-credit="true"]')?.textContent).toBe('Credit: PTI');
    expect(screen.queryByText(/article-inline/i)).toBeNull();
  });

  it('renders a controlled YouTube marker as a safe preview player', () => {
    const { container } = render(<ArticlePreview article={{
      title: 'YouTube preview',
      content: '<p>Before</p><div data-np-block="youtube" data-np-video-id="dQw4w9WgXcQ" data-np-url="https://www.youtube.com/watch?v=dQw4w9WgXcQ"></div><p>After</p>',
    }} />);

    const iframe = container.querySelector('.prose iframe');
    expect(iframe).not.toBeNull();
    expect(iframe?.getAttribute('src')).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
    expect(container.querySelector('[data-np-block="youtube"]')).toBeNull();
    expect(container.textContent).not.toContain('data-np-video-id');
    expect(container.textContent).not.toContain('data-np-url');
  });
});