import type { Rendition } from 'epubjs';

export type ThemeMode = 'light' | 'dark';

export function applyTheme(rendition: Rendition, mode: ThemeMode) {
  const themes = rendition.themes;
  themes.override('color', mode === 'dark' ? '#fff' : '#000');
  themes.override('background', mode === 'dark' ? '#000' : '#fff');
}

export function applyFontSize(rendition: Rendition, sizePct: number) {
  rendition.themes.fontSize(`${sizePct}%`);
}
