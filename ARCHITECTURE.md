# Enhanced Reader — Arquitetura (Ports & Adapters)

Este plugin foi modularizado para reduzir risco de bugs, facilitar testes e evolução.

## Camadas

- core/ (TypeScript puro)
  - `logger.ts`: contrato de logger (`ILogger`) + implementação de console.
  - `storage.ts`: contrato de storage (`IStorage`).
  - `sanitizer.ts`: contrato e implementação do sanitizador de DOM do ePub.

- adapters/
  - `epubjs/`
    - `contentHook.ts`: registra o hook de conteúdo do epub.js, aplica supressão de CSP no iframe e chama o `sanitizer` do core.
    - `theme.ts`: aplica tema claro/escuro e tamanho de fonte no `Rendition` do epub.js.

- hooks/
  - `useDarkMode.ts`: observa mudança de tema do Obsidian e expõe `boolean`.

- ui/
  - `ErrorBoundary.tsx`: proteção contra erros em tempo de execução na UI do leitor.

## Ponto de integração

- `EpubReader.tsx` agora orquestra essas peças:
  - Usa `useDarkMode` para detectar tema.
  - Cria um `sanitizer` do core.
  - Registra `contentHook` do adapter epub.js para sanitizar o DOM do iframe.
  - Aplica tema e tamanho de fonte usando os adapters.

- `EpubView.tsx` envolve o leitor com `ErrorBoundary` para falhas não previstas.

## Benefícios

- Testável: o `core` não depende de Obsidian/React e pode ser testado isoladamente.
- Menos risco: a sanitização e tema ficam centralizados, evitando duplicação.
- Evolução: novos recursos podem adicionar adapters ou hooks sem mexer no core.

## Compatibilidade

A refatoração preserva o comportamento anterior. Se notar diferença visual, provavelmente vem de correções de sanitização que evitam alertas de CSP sem alterar o conteúdo.
