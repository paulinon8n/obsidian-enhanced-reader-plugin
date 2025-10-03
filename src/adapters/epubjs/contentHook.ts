import type { Contents } from 'epubjs';
import type { ISanitizer } from '../../core/sanitizer';
import type { ILogger } from '../../core/logger';
import OpenDyslexicCss from '../../assets/OpenDyslexicCss';
import type { FontFamilyChoice } from './theme';
import { installHighlightHover } from './highlightHover';

export interface ContentHookOptions {
  bionicEnabled?: boolean;
  fontFamily?: FontFamilyChoice;
}

// Wrap epub.js content hook to sanitize DOM and reduce CSP console noise inside the iframe only
export function registerContentHook(contents: Contents, sanitizer: ISanitizer, logger?: ILogger, options?: ContentHookOptions) {
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

  // Ensure OpenDyslexic @font-face and helper rule exist in iframe
  try {
    ensureOpenDyslexicCSS(doc);
  } catch (e) {
    logger?.warn?.('Failed to ensure OpenDyslexic CSS', e);
  }

  // Setup Bionic wrappers and CSS (idempotent)
  try {
    ensureBionicCSS(doc);
    // Only wrap once per document
    if (!doc.body.hasAttribute('data-br-processed')) {
      wrapTextNodesForBionic(doc.body);
      doc.body.setAttribute('data-br-processed', 'true');
    }
    // Toggle enabled state according to options
    doc.body.classList.toggle('br-enabled', !!options?.bionicEnabled);
    // Toggle OpenDyslexic font application
    const odEnabled = options?.fontFamily === 'opendyslexic';
    doc.body.classList.toggle('od-enabled', !!odEnabled);
  } catch (e) {
    logger?.warn?.('Bionic setup error', e);
  }

  // Enhance highlight affordances inside the iframe content
  try {
    installHighlightHover(doc);
  } catch (e) {
    logger?.warn?.('Failed to install highlight hover helpers', e);
  }
}

export function updateBionicMode(contents: Contents, enabled: boolean) {
  if (!contents?.window || !contents.window.document) return;
  const doc = contents.window.document;
  ensureBionicCSS(doc);
  if (!doc.body.hasAttribute('data-br-processed')) {
    wrapTextNodesForBionic(doc.body);
    doc.body.setAttribute('data-br-processed', 'true');
  }
  doc.body.classList.toggle('br-enabled', !!enabled);
}

function ensureBionicCSS(doc: Document) {
  if (doc.getElementById('br-style')) return;
  const style = doc.createElement('style');
  style.id = 'br-style';
  style.textContent = `
  /* Bionic reading styling */
  .br-strong { font-weight: inherit; }
  .br-tail { font-weight: inherit; }
  .br-enabled .br-strong { font-weight: 600; }
  `;
  doc.head.appendChild(style);
}

function ensureOpenDyslexicCSS(doc: Document) {
  if (!OpenDyslexicCss) return;
  let style = doc.getElementById('open-dyslexic-style') as HTMLStyleElement | null;
  if (!style) {
    style = doc.createElement('style');
    style.id = 'open-dyslexic-style';
    doc.head.appendChild(style);
  }
  const helper = `\n/* OpenDyslexic font faces */\n${OpenDyslexicCss}\n/* Apply when enabled */\nbody.od-enabled, body.od-enabled * { font-family: "OpenDyslexic", ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, Noto Sans, sans-serif !important; }\n`;
  if (style.textContent !== helper) style.textContent = helper;
}

export function updateOpenDyslexicMode(contents: Contents, enabled: boolean) {
  if (!contents?.window || !contents.window.document) return;
  const doc = contents.window.document;
  ensureOpenDyslexicCSS(doc);
  doc.body.classList.toggle('od-enabled', !!enabled);
}

// Wrap words in <span class="br-strong">prefix</span><span class="br-tail">rest</span>
function wrapTextNodesForBionic(root: Node) {
  const doc = root.ownerDocument || document;
  const walker = doc.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (n: Node) => {
        if (!n.nodeValue) return NodeFilter.FILTER_REJECT;
        // Skip trivial whitespace-only nodes
        if (!/\S/.test(n.nodeValue)) return NodeFilter.FILTER_REJECT;
        // Avoid inside script/style
        const p = n.parentNode as Element | null;
        if (p && (/^(script|style)$/i).test(p.tagName)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );
  const toProcess: Text[] = [];
  let node: Text | null;
  // eslint-disable-next-line no-cond-assign
  while ((node = walker.nextNode() as Text | null)) {
    toProcess.push(node);
  }
  for (const textNode of toProcess) {
    const d = textNode.ownerDocument || document;
    const frag = d.createDocumentFragment();
    const parts = splitWords(textNode.nodeValue || '');
    for (const part of parts) {
      if (typeof part === 'string') {
        frag.appendChild(d.createTextNode(part));
      } else {
        const [head, tail] = part;
        const strong = d.createElement('span');
        strong.className = 'br-strong';
        strong.textContent = head;
        frag.appendChild(strong);
        if (tail) {
          const tailSpan = d.createElement('span');
          tailSpan.className = 'br-tail';
          tailSpan.textContent = tail;
          frag.appendChild(tailSpan);
        }
      }
    }
    textNode.parentNode?.replaceChild(frag, textNode);
  }
}

// Return array of either strings (non-word sequences) or [head, tail] tuples for words
function splitWords(input: string): Array<string | [string, string]> {
  const out: Array<string | [string, string]> = [];
  const regex = /(\p{L}+(?:['’]\p{L}+)*)/gu; // word sequences with apostrophes
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(input))) {
    if (m.index > lastIndex) out.push(input.slice(lastIndex, m.index));
    const w = m[1];
    const headLen = Math.max(1, Math.min(4, Math.ceil(w.length * 0.4)));
    out.push([w.slice(0, headLen), w.slice(headLen)]);
    lastIndex = m.index + w.length;
  }
  if (lastIndex < input.length) out.push(input.slice(lastIndex));
  return out;
}
