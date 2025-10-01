import { Menu, Notice } from 'obsidian';
import type { HighlightEntry } from '../EpubPluginSettings';

/**
 * Context menu for highlight interactions
 * 
 * Shows a native Obsidian menu when user clicks on an existing highlight.
 * Provides options to view details, edit, copy, or remove the highlight.
 */

export interface HighlightMenuOptions {
  highlight: HighlightEntry;
  onEdit?: (highlight: HighlightEntry) => void;
  onRemove?: (cfi: string) => void;
  onCopy?: (text: string) => void;
  onNavigate?: (cfi: string) => void;
}

/**
 * Shows a context menu for a highlight at the mouse position
 * 
 * @param event - Mouse event that triggered the menu
 * @param options - Menu configuration and callbacks
 */
export function showHighlightContextMenu(
  event: MouseEvent,
  options: HighlightMenuOptions
): void {
  const { highlight, onEdit, onRemove, onCopy, onNavigate } = options;
  
  const menu = new Menu();
  
  // View Details (always available)
  menu.addItem((item) => {
    item
      .setTitle('Ver detalhes')
      .setIcon('info')
      .onClick(() => {
        showHighlightDetails(highlight);
      });
  });
  
  // Edit (if handler provided)
  if (onEdit) {
    menu.addItem((item) => {
      item
        .setTitle('Editar')
        .setIcon('pencil')
        .onClick(() => {
          onEdit(highlight);
        });
    });
  }
  
  // Copy text (if handler provided)
  if (onCopy) {
    menu.addItem((item) => {
      item
        .setTitle('Copiar texto')
        .setIcon('copy')
        .onClick(() => {
          onCopy(highlight.text);
          new Notice('Texto copiado para área de transferência');
        });
    });
  }
  
  menu.addSeparator();
  
  // Navigate to highlight (if handler provided)
  if (onNavigate) {
    menu.addItem((item) => {
      item
        .setTitle('Ir para este trecho')
        .setIcon('arrow-right')
        .onClick(() => {
          onNavigate(highlight.cfi);
        });
    });
  }
  
  // Remove (always available, if handler provided)
  if (onRemove) {
    menu.addItem((item) => {
      item
        .setTitle('Remover destaque')
        .setIcon('trash')
        .onClick(() => {
          onRemove(highlight.cfi);
        });
    });
  }
  
  // Show menu at mouse position
  // If the event comes from inside the epub iframe, translate coordinates to the top window
  try {
    const view = (event.view || (event.target as Node | null)?.ownerDocument?.defaultView) as (Window | null);
    const frameEl = view && view !== window ? (view.frameElement as HTMLElement | null) : null;

    // Prefer explicit position using client coordinates
    let x = event.clientX ?? 0;
    let y = event.clientY ?? 0;

    // If event came from iframe, translate to top-window coordinates
    if (frameEl) {
      const rect = frameEl.getBoundingClientRect();
      x += rect.left;
      y += rect.top;
    }

    // If client coords are 0,0 (e.g., synthetic or missing), fallback to target's bounding rect center
    if ((x === 0 && y === 0) && event.target instanceof Element) {
      const trect = event.target.getBoundingClientRect();
      x = trect.left + trect.width / 2;
      y = trect.top + trect.height / 2;
    }

    const anyMenu = menu as unknown as { showAtPosition?: (pos: { x: number; y: number }) => void; showAtMouseEvent: (ev: MouseEvent) => void };
    if (typeof anyMenu.showAtPosition === 'function') {
      anyMenu.showAtPosition({ x, y });
    } else {
      // Back-compat: synthesize a MouseEvent at the right coordinates
      const synth = new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: Math.round(x),
        clientY: Math.round(y),
        view: window,
      });
      anyMenu.showAtMouseEvent(synth);
    }
  } catch {
    // Fallback to default behavior
    menu.showAtMouseEvent(event);
  }
}

/**
 * Shows highlight details in a notice
 * Simple implementation - can be replaced with a modal later
 * 
 * @param highlight - Highlight to display
 */
function showHighlightDetails(highlight: HighlightEntry): void {
  const lines: string[] = [];
  
  // Text preview (truncated if long)
  const textPreview = highlight.text.length > 200 
    ? highlight.text.substring(0, 200) + '...'
    : highlight.text;
  lines.push(`📝 "${textPreview}"`);
  
  // Chapter
  if (highlight.chapter) {
    lines.push(`📖 Capítulo: ${highlight.chapter}`);
  }
  
  // Created date
  if (highlight.createdAt) {
    const date = new Date(highlight.createdAt);
    lines.push(`📅 Criado: ${date.toLocaleString()}`);
  }
  
  // Updated date
  if (highlight.updatedAt) {
    const date = new Date(highlight.updatedAt);
    lines.push(`✏️ Editado: ${date.toLocaleString()}`);
  }
  
  // Comment
  if (highlight.comment) {
    lines.push(`💭 Comentário: ${highlight.comment}`);
  }
  
  // Tags
  if (highlight.tags && highlight.tags.length > 0) {
    lines.push(`🏷️ Tags: ${highlight.tags.join(', ')}`);
  }
  
  // Show as notice (longer duration for more content)
  const duration = Math.min(10000, 3000 + lines.length * 1000);
  new Notice(lines.join('\n'), duration);
}

/**
 * Copies text to clipboard
 * Helper function for copy functionality
 * 
 * @param text - Text to copy
 */
export async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch (error) {
    // Fallback for older browsers or when clipboard API is not available
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }
}
