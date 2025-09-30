# Desenvolvendo o Enhanced Reader

Este documento orienta contribuições e explica como trabalhar com a arquitetura modular.

## Estrutura

- core/
  - Código TypeScript puro (testável sem Obsidian/React)
  - `sanitizer.ts`: sanitiza o DOM do ePub (remove scripts, inlines CSS, resolve @import)
  - `logger.ts`: interface de logging
  - `storage.ts`: contrato de storage
- adapters/
  - epubjs/
    - `contentHook.ts`: integra sanitizer do core ao hook de conteúdo do epub.js
    - `theme.ts`: aplica tema e fonte no `Rendition`
- hooks/
  - `useDarkMode.ts`: observa tema do Obsidian
- ui/
  - `ErrorBoundary.tsx`: captura erros de renderização
- EpubReader.tsx
  - Orquestra as peças acima
- EpubView.tsx
  - Usa `ErrorBoundary` ao redor do leitor

## Comandos úteis

- Build de produção: `npm run build`
- Dev (watch): `npm run dev`

## Dicas de contribuição

- Mantenha o core sem dependências do Obsidian/React
- Preferir adapters para integrações (epub.js, Obsidian, etc.)
- Ao introduzir uma feature:
  - Se tiver lógica de negócio genérica → core
  - Se usar API de terceiros/DOM/Obsidian → adapter/hook
  - Se renderizar UI → ui/components
- Padronize logs via `ILogger` (pode-se adicionar nível debug futuramente)
- Adicione testes unitários ao core quando possível

## Tratamento de erros

- Erros inesperados na UI são capturados por `ErrorBoundary`
- Supressão de avisos de CSP é escopada ao iframe do ePub via adapter
- Evite `throw` atravessando camadas; prefira objetos de resultado quando fizer sentido

## Compatibilidade

- Mudanças devem preservar comportamento do usuário
- Teste a abertura de `.epub`, mudança de tema, ajuste de fonte e criação de nota
