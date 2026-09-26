import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ArticlePreview from '@/components/preview/ArticlePreview';

const X_WIDGETS_SRC = 'https://platform.twitter.com/widgets.js';
const INSTAGRAM_EMBED_SRC = 'https://www.instagram.com/embed.js';

function facebookPluginPostUrl(canonicalUrl: string): string {
  return `https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(canonicalUrl)}&show_text=true&width=500`;
}

afterEach(() => {
  cleanup();
  document.querySelectorAll(`script[src="${X_WIDGETS_SRC}"]`).forEach((script) => script.remove());
  document.querySelectorAll(`script[src="${INSTAGRAM_EMBED_SRC}"]`).forEach((script) => script.remove());
  delete (window as any).twttr;
  delete (window as any).instgrm;
});

describe('ArticlePreview author byline', () => {
  it('shows only provided public snapshot fields and no empty placeholders', () => {
    const { rerender } = render(<ArticlePreview article={{
      title: 'Story', content: 'Body', category: 'regional',
      authorByline: { enabled: true, snapshot: { name: 'Shailesh Rathod' } },
    }} />);
    const byline = screen.getByTestId('author-byline-preview');
    expect(byline.textContent).toBe('Shailesh Rathod');
    expect(byline.querySelector('img')).toBeNull();
    expect(screen.queryByText('private-user-id')).toBeNull();
    rerender(<ArticlePreview article={{
      title: 'Story', content: 'Body', category: 'regional',
      authorByline: { enabled: true, snapshot: {
        name: 'Shailesh Rathod', publicDesignation: 'Independent Writer', photoUrl: '/uploads/author.jpg', shortBio: 'Regional reporting.',
      } },
    }} />);
    expect(screen.getByText('Independent Writer')).toBeInTheDocument();
    expect(screen.getByText('Regional reporting.')).toBeInTheDocument();
    expect(screen.getByTestId('author-byline-preview').querySelector('img')).toHaveAttribute('src', '/uploads/author.jpg');
  });

  it.each([
    { category: 'regional', enabled: false },
    { category: 'pulse-dialogue', enabled: true },
  ])('hides reporter attribution for %j', ({ category, enabled }) => {
    render(<ArticlePreview article={{ title: 'Story', content: 'Body', category, authorByline: { enabled, snapshot: { name: 'Shailesh Rathod' } } }} />);
    expect(screen.queryByTestId('author-byline-preview')).toBeNull();
    expect(screen.queryByText('Shailesh Rathod')).toBeNull();
  });
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

  it('renders a controlled X marker as an official blockquote embed with fallback', () => {
    const { container } = render(<ArticlePreview article={{
      title: 'X preview',
      content: '<p>Before</p><div data-np-block="x" data-np-post-id="1234567890123456789" data-np-url="https://x.com/newspulse/status/1234567890123456789?s=20"></div><p>After</p>',
    }} />);

    const link = screen.getByRole('link', { name: 'Open post' });
    const blockquote = container.querySelector('blockquote.twitter-tweet');
    expect(blockquote).not.toBeNull();
    expect(screen.getByText('X Post')).toBeInTheDocument();
    expect(screen.getByText('@newspulse')).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'https://x.com/newspulse/status/1234567890123456789?s=20');
    expect(blockquote?.contains(link)).toBe(true);
    expect(container.querySelector('[data-np-block="x"]')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
    expect(container.textContent).not.toContain('data-np-post-id');
    expect(container.textContent).not.toContain('data-np-url');
  });

  it('uses the official post URL when loading an X preview embed', () => {
    const { container } = render(<ArticlePreview article={{
      title: 'Twitter preview',
      content: '<div data-np-block="x" data-np-post-id="9876543210987654321" data-np-url="https://twitter.com/ANI/status/9876543210987654321"></div>',
    }} />);

    expect(container.querySelector('blockquote.twitter-tweet a')).toHaveAttribute('href', 'https://twitter.com/ANI/status/9876543210987654321');
    expect(screen.getByText('@ANI')).toBeInTheDocument();
  });

  it('does not create an X embed from an invalid controlled URL', () => {
    const { container } = render(<ArticlePreview article={{
      title: 'Invalid X preview',
      content: '<div data-np-block="x" data-np-post-id="1234567890123456789" data-np-url="https://x.com.evil.example/newspulse/status/1234567890123456789"></div>',
    }} />);

    expect(screen.getByText('X post unavailable')).toBeInTheDocument();
    expect(container.querySelector('blockquote.twitter-tweet')).toBeNull();
    expect(document.querySelector(`script[src="${X_WIDGETS_SRC}"]`)).toBeNull();
    expect(screen.queryByRole('link', { name: 'Open post' })).toBeNull();
  });

  it('keeps X fallback content visible when widgets script has not hydrated', () => {
    const { container } = render(<ArticlePreview article={{
      title: 'X fallback preview',
      content: '<div data-np-block="x" data-np-post-id="1234567890123456789" data-np-url="https://x.com/newspulse/status/1234567890123456789"></div>',
    }} />);

    expect(container.querySelector('blockquote.twitter-tweet')).not.toBeNull();
    expect(screen.getByText('X Post')).toBeInTheDocument();
    expect(screen.getByText('@newspulse')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open post' })).toHaveAttribute('href', 'https://x.com/newspulse/status/1234567890123456789');
  });

  it('does not create duplicate X widgets.js loaders for multiple X posts', () => {
    const content = '<div data-np-block="x" data-np-post-id="111" data-np-url="https://x.com/first/status/111"></div><div data-np-block="x" data-np-post-id="222" data-np-url="https://x.com/second/status/222"></div>';

    const { container } = render(<ArticlePreview article={{ title: 'Multiple X preview', content }} />);

    expect(container.querySelectorAll('blockquote.twitter-tweet')).toHaveLength(2);
    expect(screen.getByText('@first')).toBeInTheDocument();
    expect(screen.getByText('@second')).toBeInTheDocument();
    expect(document.querySelectorAll(`script[src="${X_WIDGETS_SRC}"]`)).toHaveLength(1);
  });

  it('hydrates multiple X posts through a single widgets load call', async () => {
    const load = vi.fn();
    const content = '<div data-np-block="x" data-np-post-id="111" data-np-url="https://x.com/first/status/111"></div><div data-np-block="x" data-np-post-id="222" data-np-url="https://x.com/second/status/222"></div>';

    render(<ArticlePreview article={{ title: 'Hydrate multiple X preview', content }} />);
    (window as any).twttr = { widgets: { load } };
    document.querySelector(`script[src="${X_WIDGETS_SRC}"]`)?.dispatchEvent(new Event('load'));

    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
    expect(document.querySelectorAll(`script[src="${X_WIDGETS_SRC}"]`)).toHaveLength(1);
  });

  it('does not load X widgets.js repeatedly on re-render', async () => {
    const load = vi.fn();
    const article = {
      title: 'Stable X preview',
      content: '<div data-np-block="x" data-np-post-id="1234567890123456789" data-np-url="https://x.com/newspulse/status/1234567890123456789"></div>',
    };
    const { rerender } = render(<ArticlePreview article={article} />);
    (window as any).twttr = { widgets: { load } };
    document.querySelector(`script[src="${X_WIDGETS_SRC}"]`)?.dispatchEvent(new Event('load'));
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));

    rerender(<ArticlePreview article={{ ...article, summary: 'Updated summary' }} />);

    expect(document.querySelectorAll(`script[src="${X_WIDGETS_SRC}"]`)).toHaveLength(1);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('renders a controlled Instagram marker as an official embed blockquote with fallback', () => {
    const { container } = render(<ArticlePreview article={{
      title: 'Instagram preview',
      content: '<p>Before</p><div data-np-block="instagram" data-np-shortcode="C8xY_z1AbCd" data-np-url="https://www.instagram.com/p/C8xY_z1AbCd/"></div><p>After</p>',
    }} />);

    const link = screen.getByRole('link', { name: 'Open post' });
    const blockquote = container.querySelector('.np-instagram-preview blockquote.instagram-media');
    expect(blockquote).not.toBeNull();
    expect(blockquote).toHaveAttribute('data-instgrm-permalink', 'https://www.instagram.com/p/C8xY_z1AbCd/');
    expect(blockquote).toHaveAttribute('data-instgrm-version', '14');
    expect(screen.getByText('Instagram')).toBeInTheDocument();
    expect(screen.getByText('Post/Reel')).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'https://www.instagram.com/p/C8xY_z1AbCd/');
    expect(blockquote?.contains(link)).toBe(true);
    expect(container.querySelector('[data-np-block="instagram"]')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('iframe')).toBeNull();
    expect(container.textContent).not.toContain('data-np-shortcode');
    expect(container.textContent).not.toContain('data-np-url');
  });

  it.each([
    ['post', 'p', 'C8xY_z1AbCd'],
    ['reel', 'reel', 'C8xY-z1AbCd'],
    ['legacy tv', 'tv', 'C8xY_z1AbCd'],
  ])('renders a controlled Instagram %s URL as an embed container', (_label, kind, shortcode) => {
    const url = `https://www.instagram.com/${kind}/${shortcode}/`;
    const { container } = render(<ArticlePreview article={{
      title: 'Instagram preview',
      content: `<div data-np-block="instagram" data-np-shortcode="${shortcode}" data-np-url="${url}"></div>`,
    }} />);

    expect(container.querySelector('.np-instagram-preview blockquote.instagram-media')).toHaveAttribute('data-instgrm-permalink', url);
    expect(screen.getByRole('link', { name: 'Open post' })).toHaveAttribute('href', url);
  });

  it('does not create an Instagram embed from an invalid controlled URL', () => {
    const { container } = render(<ArticlePreview article={{
      title: 'Invalid Instagram preview',
      content: '<div data-np-block="instagram" data-np-shortcode="C8xY_z1AbCd" data-np-url="https://www.instagram.com.evil.example/p/C8xY_z1AbCd/"></div>',
    }} />);

    expect(screen.getByText('Instagram post unavailable')).toBeInTheDocument();
    expect(container.querySelector('blockquote.instagram-media')).toBeNull();
    expect(document.querySelector(`script[src="${INSTAGRAM_EMBED_SRC}"]`)).toBeNull();
    expect(screen.queryByRole('link', { name: 'Open post' })).toBeNull();
  });

  it('keeps Instagram fallback content visible when embed.js has not hydrated', () => {
    const { container } = render(<ArticlePreview article={{
      title: 'Instagram fallback preview',
      content: '<div data-np-block="instagram" data-np-shortcode="C8xY_z1AbCd" data-np-url="https://www.instagram.com/p/C8xY_z1AbCd/"></div>',
    }} />);

    const blockquote = container.querySelector('blockquote.instagram-media');
    expect(blockquote).not.toBeNull();
    expect(screen.getByText('Instagram')).toBeInTheDocument();
    expect(screen.getByText('Post/Reel')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open post' })).toHaveAttribute('href', 'https://www.instagram.com/p/C8xY_z1AbCd/');
  });

  it('keeps Instagram fallback content visible when embed.js fails to load', () => {
    const { container } = render(<ArticlePreview article={{
      title: 'Instagram blocked preview',
      content: '<div data-np-block="instagram" data-np-shortcode="C8xY_z1AbCd" data-np-url="https://www.instagram.com/p/C8xY_z1AbCd/"></div>',
    }} />);

    document.querySelector(`script[src="${INSTAGRAM_EMBED_SRC}"]`)?.dispatchEvent(new Event('error'));

    expect(container.querySelector('blockquote.instagram-media')).not.toBeNull();
    expect(screen.getByText('Instagram')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open post' })).toHaveAttribute('href', 'https://www.instagram.com/p/C8xY_z1AbCd/');
  });

  it('hydrates Instagram posts through the official embed.js process hook', async () => {
    const process = vi.fn();
    (window as any).instgrm = { Embeds: { process } };

    render(<ArticlePreview article={{
      title: 'Hydrated Instagram preview',
      content: '<div data-np-block="instagram" data-np-shortcode="C8xY_z1AbCd" data-np-url="https://www.instagram.com/p/C8xY_z1AbCd/"></div>',
    }} />);

    await waitFor(() => expect(process).toHaveBeenCalledTimes(1));
    expect(document.querySelector(`script[src="${INSTAGRAM_EMBED_SRC}"]`)).toBeNull();
  });

  it('does not mutate the canonical Instagram stored marker while rendering preview', () => {
    const content = '<div data-np-block="instagram" data-np-shortcode="C8xY_z1AbCd" data-np-url="https://www.instagram.com/p/C8xY_z1AbCd/"></div>';
    const { container } = render(<ArticlePreview article={{ title: 'Stored marker contract', content }} />);

    expect(content).toBe('<div data-np-block="instagram" data-np-shortcode="C8xY_z1AbCd" data-np-url="https://www.instagram.com/p/C8xY_z1AbCd/"></div>');
    expect(container.querySelector('[data-np-block="instagram"]')).toBeNull();
    expect(container.querySelector('blockquote.instagram-media')).not.toBeNull();
  });

  it('renders a controlled Facebook post marker as a safe plugin iframe with fallback', () => {
    const canonicalUrl = 'https://www.facebook.com/newspulse/posts/1234567890123456';
    const { container } = render(<ArticlePreview article={{
      title: 'Facebook preview',
      content: `<p>Before</p><div data-np-block="facebook" data-np-url="${canonicalUrl}"></div><p>After</p>`,
    }} />);

    const link = screen.getByRole('link', { name: 'Open post' });
    const iframe = container.querySelector('.np-facebook-preview iframe');
    expect(iframe).not.toBeNull();
    expect(iframe).toHaveAttribute('src', facebookPluginPostUrl(canonicalUrl));
    expect(iframe).toHaveAttribute('title', 'Facebook Post');
    expect(screen.getByText('Facebook Post')).toBeInTheDocument();
    expect(link).toHaveAttribute('href', canonicalUrl);
    expect(container.querySelector('[data-np-block="facebook"]')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
    expect(container.textContent).not.toContain('data-np-url');
  });

  it('renders a controlled Facebook permalink marker as a safe plugin iframe', () => {
    const canonicalUrl = 'https://www.facebook.com/permalink.php?story_fbid=987654321098765&id=1234567890';
    const { container } = render(<ArticlePreview article={{
      title: 'Facebook permalink preview',
      content: `<div data-np-block="facebook" data-np-url="${canonicalUrl.replace(/&/g, '&amp;')}"></div>`,
    }} />);

    const iframe = container.querySelector('.np-facebook-preview iframe');
    expect(iframe).not.toBeNull();
    expect(iframe).toHaveAttribute('src', facebookPluginPostUrl(canonicalUrl));
    expect(screen.getByRole('link', { name: 'Open post' })).toHaveAttribute('href', canonicalUrl);
    expect(container.querySelector('[data-np-block="facebook"]')).toBeNull();
  });

  it('renders a controlled Facebook Reel marker as a safe plugin iframe with fallback', () => {
    const canonicalUrl = 'https://www.facebook.com/reel/1098765432109876';
    const { container } = render(<ArticlePreview article={{
      title: 'Facebook Reel preview',
      content: `<p>Before</p><div data-np-block="facebook" data-np-url="${canonicalUrl}"></div><p>After</p>`,
    }} />);

    const link = screen.getByRole('link', { name: 'Open post' });
    const iframe = container.querySelector('.np-facebook-preview iframe');
    expect(iframe).not.toBeNull();
    expect(iframe).toHaveAttribute('src', facebookPluginPostUrl(canonicalUrl));
    expect(iframe).toHaveAttribute('title', 'Facebook Reel');
    expect(screen.getByText('Facebook Post')).toBeInTheDocument();
    expect(link).toHaveAttribute('href', canonicalUrl);
    expect(container.querySelector('[data-np-block="facebook"]')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
    expect(container.textContent).not.toContain('data-np-url');
  });

  it('does not create a Facebook plugin iframe from an invalid controlled URL', () => {
    const { container } = render(<ArticlePreview article={{
      title: 'Invalid Facebook preview',
      content: '<div data-np-block="facebook" data-np-url="https://www.facebook.com.evil.example/newspulse/posts/1234567890123456"></div>',
    }} />);

    expect(screen.getByText('Facebook post unavailable')).toBeInTheDocument();
    expect(container.querySelector('iframe')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Open post' })).toBeNull();
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