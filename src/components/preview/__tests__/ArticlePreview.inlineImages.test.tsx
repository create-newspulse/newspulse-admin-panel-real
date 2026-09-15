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

    expect(container.querySelector('.prose [data-np-credit="true"]')?.textContent).toBe('Photo: PTI');
    expect(screen.queryByText(/article-inline/i)).toBeNull();
  });

  it('renders inline image caption-only presentation without an empty credit line', () => {
    const { container } = render(<ArticlePreview article={{
      title: 'Caption only',
      content: '<figure data-np-block="inline-image" data-np-media-id="caption-only"><img src="https://cdn.newspulse.co.in/inline/caption-only.jpg" alt="Caption only"><figcaption data-np-caption="true">Riverfront scene wraps across more than one line when needed.</figcaption></figure>',
    }} />);

    expect(container.querySelector('.np-media-caption')?.textContent).toBe('Riverfront scene wraps across more than one line when needed.');
    expect(container.querySelector('.np-media-credit')).toBeNull();
  });

  it('renders inline image credit-only presentation without an empty caption line', () => {
    const { container } = render(<ArticlePreview article={{
      title: 'Credit only',
      content: '<figure data-np-block="inline-image" data-np-media-id="credit-only"><img src="https://cdn.newspulse.co.in/inline/credit-only.jpg" alt="Credit only"><div data-np-credit="true">Reuters</div></figure>',
    }} />);

    expect(container.querySelector('.np-media-caption')).toBeNull();
    expect(container.querySelector('.np-media-credit')?.textContent).toBe('Photo: Reuters');
  });

  it('renders inline image caption before credit', () => {
    const { container } = render(<ArticlePreview article={{
      title: 'Caption and credit',
      content: '<figure data-np-block="inline-image" data-np-media-id="caption-credit"><img src="https://cdn.newspulse.co.in/inline/caption-credit.jpg" alt="Caption and credit"><figcaption data-np-caption="true">Caption first</figcaption><div data-np-credit="true">Credit: Reuters</div></figure>',
    }} />);

    const figure = container.querySelector('.np-inline-image-preview') as HTMLElement;
    const caption = figure.querySelector('.np-media-caption') as HTMLElement;
    const credit = figure.querySelector('.np-media-credit') as HTMLElement;
    expect(caption.textContent).toBe('Caption first');
    expect(credit.textContent).toBe('Photo: Reuters');
    expect(caption.compareDocumentPosition(credit) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('does not render empty inline image caption or credit containers', () => {
    const { container } = render(<ArticlePreview article={{
      title: 'Blank media text',
      content: '<figure data-np-block="inline-image" data-np-media-id="blank-text"><img src="https://cdn.newspulse.co.in/inline/blank-text.jpg" alt="Blank text"><figcaption data-np-caption="true">   </figcaption><div data-np-credit="true">   </div></figure>',
    }} />);

    expect(container.querySelector('.np-media-caption')).toBeNull();
    expect(container.querySelector('.np-media-credit')).toBeNull();
  });

  it('does not duplicate stored credit or photo prefixes in preview', () => {
    const { container } = render(<ArticlePreview article={{
      title: 'Prefix normalization',
      content: '<figure data-np-block="inline-image" data-np-media-id="credit-prefix"><img src="https://cdn.newspulse.co.in/inline/credit-prefix.jpg" alt="Credit prefix"><div data-np-credit="true">Photo: Reuters</div></figure><figure data-np-block="inline-image" data-np-media-id="credit-prefix-two"><img src="https://cdn.newspulse.co.in/inline/credit-prefix-two.jpg" alt="Credit prefix two"><div data-np-credit="true">Credit: PTI</div></figure><figure data-np-block="inline-image" data-np-media-id="credit-prefix-three"><img src="https://cdn.newspulse.co.in/inline/credit-prefix-three.jpg" alt="Credit prefix three"><div data-np-credit="true">Credit: Photo: ANI</div></figure><figure data-np-block="inline-image" data-np-media-id="credit-prefix-four"><img src="https://cdn.newspulse.co.in/inline/credit-prefix-four.jpg" alt="Credit prefix four"><div data-np-credit="true">Photo Credit: AFP</div></figure>',
    }} />);

    const credits = Array.from(container.querySelectorAll('.np-media-credit')).map((node) => node.textContent);
    expect(credits).toEqual(['Photo: Reuters', 'Photo: PTI', 'Photo: ANI', 'Photo: AFP']);
    expect(container.textContent).not.toContain('Photo: Photo:');
    expect(container.textContent).not.toContain('Photo: Photo Credit:');
    expect(container.textContent).not.toContain('Photo: Credit:');
  });

  it('visually distinguishes controlled inline image layouts with safe classes', () => {
    const { container } = render(<ArticlePreview article={{
      title: 'Inline image layouts',
      content: '<figure data-np-block="inline-image" data-np-media-id="media-normal" data-np-layout="normal"><img src="https://cdn.newspulse.co.in/inline/normal.jpg" alt="Normal"></figure><figure data-np-block="inline-image" data-np-media-id="media-wide" data-np-layout="wide"><img src="https://cdn.newspulse.co.in/inline/wide.jpg" alt="Wide"></figure><figure data-np-block="inline-image" data-np-media-id="media-full" data-np-layout="full"><img src="https://cdn.newspulse.co.in/inline/full.jpg" alt="Full"></figure>',
    }} />);

    const figures = container.querySelectorAll('.prose figure.np-inline-image-preview');
    expect(figures).toHaveLength(3);
    expect(figures[0]).toHaveClass('np-inline-image-preview-normal');
    expect(figures[1]).toHaveClass('np-inline-image-preview-wide');
    expect(figures[2]).toHaveClass('np-inline-image-preview-full');
    expect(container.querySelector('[data-np-block="inline-image"]')).toBeNull();
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

  it('renders a controlled X marker as a safe preview card', () => {
    const { container } = render(<ArticlePreview article={{
      title: 'X preview',
      content: '<p>Before</p><div data-np-block="x" data-np-post-id="1234567890123456789" data-np-url="https://x.com/newspulse/status/1234567890123456789?s=20"></div><p>After</p>',
    }} />);

    const link = screen.getByRole('link', { name: 'Open post' });
    expect(screen.getByText('X Post')).toBeInTheDocument();
    expect(screen.getByText('@newspulse')).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'https://x.com/newspulse/status/1234567890123456789?s=20');
    expect(container.querySelector('[data-np-block="x"]')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('blockquote')).toBeNull();
    expect(container.textContent).not.toContain('data-np-post-id');
    expect(container.textContent).not.toContain('data-np-url');
  });

  it('renders a controlled Instagram marker as a safe preview card', () => {
    const { container } = render(<ArticlePreview article={{
      title: 'Instagram preview',
      content: '<p>Before</p><div data-np-block="instagram" data-np-shortcode="C8xY_z1AbCd" data-np-url="https://www.instagram.com/p/C8xY_z1AbCd/"></div><p>After</p>',
    }} />);

    const link = screen.getByRole('link', { name: 'Open post' });
    expect(screen.getByText('Instagram')).toBeInTheDocument();
    expect(screen.getByText('Post/Reel')).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'https://www.instagram.com/p/C8xY_z1AbCd/');
    expect(container.querySelector('[data-np-block="instagram"]')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('blockquote')).toBeNull();
    expect(container.querySelector('iframe')).toBeNull();
    expect(container.textContent).not.toContain('data-np-shortcode');
    expect(container.textContent).not.toContain('data-np-url');
  });

  it('renders a controlled Facebook marker as a safe preview card', () => {
    const { container } = render(<ArticlePreview article={{
      title: 'Facebook preview',
      content: '<p>Before</p><div data-np-block="facebook" data-np-url="https://www.facebook.com/newspulse/posts/1234567890123456"></div><p>After</p>',
    }} />);

    const link = screen.getByRole('link', { name: 'Open post' });
    expect(screen.getByText('Facebook Post')).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'https://www.facebook.com/newspulse/posts/1234567890123456');
    expect(container.querySelector('[data-np-block="facebook"]')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('iframe')).toBeNull();
    expect(container.textContent).not.toContain('data-np-url');
  });

  it('renders a controlled gallery marker as a safe preview gallery', () => {
    const { container } = render(<ArticlePreview article={{
      title: 'Gallery preview',
      content: '<p>Before</p><div data-np-block="gallery"><figure data-np-block="inline-image" data-np-media-id="media-1" data-np-width="900" data-np-height="600"><img src="https://cdn.newspulse.co.in/inline/one.jpg" alt="One" width="900" height="600"><figcaption data-np-caption="true">Caption one</figcaption><div data-np-credit="true">Credit: PTI</div></figure><figure data-np-block="inline-image" data-np-media-id="media-2"><img src="https://cdn.newspulse.co.in/inline/two.jpg" alt="Two"><figcaption data-np-caption="true">Caption two</figcaption></figure></div><p>After</p>',
    }} />);

    const images = container.querySelectorAll('.prose img');
    expect(images).toHaveLength(2);
    expect(images[0].getAttribute('src')).toBe('https://cdn.newspulse.co.in/inline/one.jpg');
    expect(screen.getByText('Caption one')).toBeInTheDocument();
    expect(screen.getByText('Photo: PTI')).toBeInTheDocument();
    expect(container.querySelector('.np-gallery-preview .np-media-caption')?.textContent).toBe('Caption one');
    expect(container.querySelector('.np-gallery-preview .np-media-credit')?.textContent).toBe('Photo: PTI');
    expect(container.querySelector('.np-gallery-preview .np-inline-image-preview')).toBeNull();
    expect(container.querySelector('[data-np-block="gallery"]')).toBeNull();
    expect(container.textContent).not.toContain('data-np-media-id');
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('iframe')).toBeNull();
  });
});