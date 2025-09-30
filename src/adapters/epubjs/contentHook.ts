import type { Contents } from 'epubjs';
import type { ISanitizer } from '../../core/sanitizer';
import type { ILogger } from '../../core/logger';

// Wrap epub.js content hook to sanitize DOM and reduce CSP console noise inside the iframe only
export function registerContentHook(contents: Contents, sanitizer: ISanitizer, logger?: ILogger) {
  // Guard: iframe/window/doc ready
  if (!contents?.window || !contents.window.document) return;
  const doc = contents.window.document;

  // Scoped suppression for CSP-related warnings/errors inside the iframe only
  try {
    const frameConsole = (contents.window as Window & typeof globalThis).console;
    if (frameConsole) {
      const originalWarn = frameConsole.warn.bind(frameConsole);
      const originalError = frameConsole.error.bind(frameConsole);
      frameConsole.warn = (...args: unknown[]) => {
        const message = String(args.join(' '));
        if (message.includes('Content Security Policy') && (message.includes('blob:') || message.includes('srcdoc'))) {
          return;
        }
        originalWarn(...(args as []));
      };
      frameConsole.error = (...args: unknown[]) => {
        const message = String(args.join(' '));
        if (message.includes('Content Security Policy') && (message.includes('blob:') || message.includes('srcdoc'))) {
          return;
        }
        originalError(...(args as []));
      };
    }
  } catch (e) {
    logger?.debug?.('Iframe console override not available', e);
  }

  // Run sanitizer
  try {
    const res = sanitizer.sanitizeDocument(doc, logger);
    if (res instanceof Promise) {
      res.catch((e) => logger?.warn?.('Sanitizer async error', e));
    }
  } catch (e) {
    logger?.warn?.('Sanitizer error', e);
  }
}
