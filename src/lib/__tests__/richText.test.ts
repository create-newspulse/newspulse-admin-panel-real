import { autoFormatPlainTextToHtml } from '@/lib/richText';

describe('autoFormatPlainTextToHtml', () => {
  it('converts blank lines to paragraphs', () => {
    expect(autoFormatPlainTextToHtml('Hello\n\nWorld')).toBe('<p>Hello</p><p>World</p>');
  });

  it('converts bullet-prefixed lines to a <ul>', () => {
    expect(autoFormatPlainTextToHtml('- one\n- two')).toBe('<ul><li>one</li><li>two</li></ul>');
    expect(autoFormatPlainTextToHtml('• one\n• two')).toBe('<ul><li>one</li><li>two</li></ul>');
  });

  it('converts ## lines to one-liner bold paragraphs', () => {
    expect(autoFormatPlainTextToHtml('## Subheading')).toBe('<p><strong>Subheading</strong></p>');
  });

  it('converts ==highlight== to <mark>', () => {
    expect(autoFormatPlainTextToHtml('This is ==hot== now.')).toBe('<p>This is <mark>hot</mark> now.</p>');
  });

  it('escapes HTML in user input', () => {
    expect(autoFormatPlainTextToHtml('<b>no</b> ==yes==')).toBe('<p>&lt;b&gt;no&lt;/b&gt; <mark>yes</mark></p>');
  });
});
