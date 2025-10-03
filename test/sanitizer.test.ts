import { describe, it, expect } from 'vitest';
import { createDefaultSanitizer } from '../src/core/sanitizer';

describe('core/sanitizer', () => {
  it('removes scripts and strips blob urls in inline styles', async () => {
    const html = `<!doctype html><html><head>
      <link rel="stylesheet" href="data:text/css,body{color:red}">
      <script>console.log('x')</script>
    </head><body style="background-image:url(blob:fake)">Hello</body></html>`;
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const sanitizer = createDefaultSanitizer();
    await sanitizer.sanitizeDocument(doc);

    // scripts removed
    expect(doc.querySelectorAll('script').length).toBe(0);
    // inline styles sanitized (blob URLs removed)
    const body = doc.querySelector('body') as HTMLElement;
    const bgImage = body.style.backgroundImage;
    // Different jsdom versions may parse differently, but blob: should be stripped
    expect(bgImage).not.toContain('blob:');
    // link stylesheet replaced by style placeholder
    expect(doc.querySelectorAll('link[rel="stylesheet"]').length).toBe(0);
    expect(doc.querySelectorAll('style[data-inlined-from]').length).toBe(1);
  });
});
