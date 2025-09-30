import type { ILogger } from './logger';

export interface SanitizerOptions {
  inlineStylesheets?: boolean; // try to inline <link rel="stylesheet">
  removeScripts?: boolean; // remove <script>
  stripBlobUrlsInInlineStyles?: boolean; // remove CSS properties that reference url(blob:...)
}

export interface ISanitizer {
  sanitizeDocument: (doc: Document, logger?: ILogger) => Promise<void> | void;
}

export function createDefaultSanitizer(options?: SanitizerOptions): ISanitizer {
  const {
    inlineStylesheets = true,
    removeScripts = true,
    stripBlobUrlsInInlineStyles = true,
  } = options ?? {};

  return {
    async sanitizeDocument(doc: Document, logger) {
      try {
        if (removeScripts) {
          const scripts = doc.querySelectorAll('script');
          scripts.forEach((s) => s.remove());
        }

        if (inlineStylesheets) {
          const links = Array.from(doc.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"][href]'));
          for (const link of links) {
            const href = link.href;
            const placeholder = doc.createElement('style');
            placeholder.setAttribute('data-inlined-from', href);
            link.parentNode?.insertBefore(placeholder, link);
            link.remove();

            try {
              const cssText = await fetchCss(doc, href);
              if (cssText == null) continue;
              const resolved = await resolveImports(doc, cssText, href);
              placeholder.textContent = resolved;
            } catch (e) {
              logger?.warn?.('Failed to inline stylesheet', href, e);
            }
          }
        }

        if (stripBlobUrlsInInlineStyles) {
          const elements = doc.querySelectorAll<HTMLElement>('[style]');
          elements.forEach((el) => {
            const styleDecl = el.style;
            const props: string[] = [];
            for (let i = 0; i < styleDecl.length; i++) {
              const prop = styleDecl.item(i);
              if (prop) props.push(prop);
            }
            props.forEach((prop) => {
              const val = styleDecl.getPropertyValue(prop);
              if (val && val.includes('url(blob:')) {
                styleDecl.removeProperty(prop);
              }
            });
          });
        }
      } catch (e) {
        logger?.warn?.('sanitizeDocument error', e);
      }
    },
  };
}

async function fetchCss(doc: Document, url: string): Promise<string | null> {
  try {
    // Use the iframe window's fetch when available to honor its CSP/context
    const wnd = doc.defaultView as (Window & typeof globalThis) | null;
    const fetchFn = wnd?.fetch ? wnd.fetch.bind(wnd) : fetch;
    const res: Response = await fetchFn(url);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function resolveImports(doc: Document, cssText: string, baseHref: string): Promise<string> {
  const importRegex = /@import\s+url\(([^)]+)\)\s*[^;]*;|@import\s+['"]([^"']+)['"];?/g;
  const tasks: Array<Promise<void>> = [];
  const replacements: { start: number; end: number; content: string }[] = [];
  let match: RegExpExecArray | null;
  while ((match = importRegex.exec(cssText)) !== null) {
    const full = match[0];
    const rawUrl = (match[1] || match[2] || '').trim().replace(/^["']|["']$/g, '');
    const start = match.index;
    const end = start + full.length;
    tasks.push((async () => {
      const absUrl = (() => {
        try {
          return new URL(rawUrl, baseHref).toString();
        } catch {
          return rawUrl;
        }
      })();
      const imported = await fetchCss(doc, absUrl);
      if (imported != null) {
        replacements.push({ start, end, content: imported });
      }
    })());
  }
  await Promise.all(tasks);
  replacements.sort((a, b) => b.start - a.start);
  let result = cssText;
  for (const r of replacements) {
    result = result.slice(0, r.start) + r.content + result.slice(r.end);
  }
  return result;
}
