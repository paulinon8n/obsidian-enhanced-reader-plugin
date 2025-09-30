import { useEffect, useState } from 'react';

export function useDarkMode(): boolean {
  const [isDark, setIsDark] = useState<boolean>(document.body.classList.contains('theme-dark'));

  useEffect(() => {
    const body = document.body;
    const observer = new MutationObserver(() => {
      setIsDark(body.classList.contains('theme-dark'));
    });
    observer.observe(body, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return isDark;
}
