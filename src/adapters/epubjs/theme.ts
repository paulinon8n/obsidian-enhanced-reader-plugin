import type { Rendition } from 'epubjs';

export type ThemeMode = 'light' | 'sepia' | 'dark';
export type FontFamilyChoice = 'system' | 'sans' | 'serif' | 'opendyslexic';

export function applyTheme(rendition: Rendition, mode: ThemeMode) {
  const themes = rendition.themes;
  switch (mode) {
    case 'dark':
      themes.override('color', '#ffffff');
      themes.override('background', '#000000');
      break;
    case 'sepia':
      // Classic sepia reading palette
      themes.override('color', '#5b4636');
      themes.override('background', '#f4ecd8');
      break;
    case 'light':
    default:
      themes.override('color', '#000000');
      themes.override('background', '#ffffff');
      break;
  }
}

export function applyFontSize(rendition: Rendition, sizePct: number) {
  rendition.themes.fontSize(`${sizePct}%`);
}

export function applyFontFamily(rendition: Rendition, family: FontFamilyChoice) {
  let value = 'system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial, "Apple Color Emoji", "Segoe UI Emoji"';
  if (family === 'sans') value = 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, Noto Sans, sans-serif';
  if (family === 'serif') value = 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif';
  if (family === 'opendyslexic') value = '"OpenDyslexic", "OpenDyslexic3", "OpenDyslexic-Regular", "OpenDyslexic Alta", ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, Noto Sans, sans-serif';
  rendition.themes.override('font-family', value);
}
