# Contributing to Enhanced Reader

<!-- markdownlint-disable MD022 MD031 MD032 MD034 MD040 -->

## Stack Tecnológico

- **React 18.3.1**: UI framework com Concurrent Features
- **TypeScript 5.9.3**: Type safety e melhor DX
- **epub.js 0.3.93**: Core de renderização EPUB
- **ESBuild 0.25**: Bundler ultrarrápido
- **Vitest 3.2.4**: Test runner moderno

## Filosofia Arquitetural

Este plugin adota **Ports & Adapters (Hexagonal Architecture)** como fundação permanente, não como objetivo inicial. Compromissos inegociáveis:

- **Eficiência e Eficácia** através de organização modular
- **Testabilidade** como requisito, não afterthought
- **Evolução sem regressão** via contratos bem definidos
- **Performance** otimizada por design, não correção

**Princípio fundamental**: Cada feature nova deve respeitar a separação de responsabilidades.

---

## Estrutura do Projeto

### Core (TypeScript Puro)
Zero dependências externas. Apenas lógica de negócio testável.

```
core/
├── cfiComparator.ts     # Comparação de CFI (Canonical Fragment Identifier)
├── highlightIndex.ts    # Indexação espacial para performance
├── logger.ts            # Interface de logging (ILogger)
├── sanitizer.ts         # Sanitização de DOM (remove scripts, resolve @import)
└── storage.ts           # Contrato de storage (IStorage)
```

### Adapters (Integrações)
Ponte entre core e mundo externo (Obsidian, epub.js, etc).

```
adapters/
├── epubjs/
│   ├── contentHook.ts           # Integra sanitizer ao epub.js e instala helpers
│   ├── highlightHover.ts        # Gere sublinhado dinâmico em overlays do marks-pane
│   └── theme.ts                 # Aplica tema no Rendition
└── storage/
    └── localStorageAdapter.ts   # Implementação de IStorage
```

### Hooks (Estado Reativo)
```
hooks/
└── useDarkMode.ts               # Observa mudanças de tema
```

### UI Components

```text
ui/
├── ErrorBoundary.tsx            # Captura erros de renderização
├── ReaderControls.tsx           # Toolbar (tema, fonte, busca, destaques)
└── HighlightContextMenu.ts      # Legado (mantido apenas para histórico)
```

### Utils & Assets
```
utils/
└── performance.ts               # Debounce, throttle

assets/
└── OpenDyslexicCss.ts           # Fonte OpenDyslexic embarcada
```

### Componentes Principais
- **`EpubPlugin.ts`**: Registra visualizador no Obsidian
- **`EpubView.tsx`**: Gerencia ciclo de vida + ErrorBoundary
- **`EpubReader.tsx`**: Orquestra componentes (944 LOC → alvo de refatoração)

---

## Desenvolvimento

### Comandos

```bash
npm run build         # Produção (com prebuild automático)
npm run dev           # Watch mode
npm run test          # Testes unitários
npm run test:watch    # Testes em watch mode
npm run version       # Bump de versão (manifest.json + versions.json)
```

### Pipeline de Build

1. **Prebuild** (`scripts/generate-open-dyslexic.mjs`):
   - Lê fontes `.woff` do pacote npm
   - Gera `OpenDyslexicCss.ts` com data URLs
   - Resultado: Fonte 100% offline

2. **TypeScript Check**: Validação de tipos sem emissão

3. **ESBuild**: Bundle otimizado (~701KB com React 18)

**Saída final**: `main.js`, `manifest.json`, `styles.css`

**Nota sobre Bundle Size**: A migração para React 18 (de Preact compat) aumentou o bundle em ~40KB, mas trouxe melhor estabilidade, compatibilidade com ecossistema e acesso a features modernas do React 18.

---

## Padrões de Código

### ✅ Boas Práticas

```typescript
// Separação clara de responsabilidades
function handleHighlightClick(event: MouseEvent) {
  const result = highlightCore.process(data);  // Pure logic
  storageAdapter.save(result);                 // Side effect
  uiAdapter.update(result);                    // Side effect
}
```

### ❌ Antipadrões

```typescript
// Mistura de lógicas (evitar)
function handleClick() {
  // DOM manipulation + Business logic + API calls juntos
}
```

### Checklist para Novas Features

- [ ] Lógica de negócio em `core/` (testável independentemente)
- [ ] Integrações externas em `adapters/`
- [ ] UI components em `ui/` (composáveis)
- [ ] Estado reativo em `hooks/`
- [ ] Testes unitários criados
- [ ] Performance impact avaliado
- [ ] Documentação atualizada

---

## Testing Strategy

```
test/
├── highlightHover.test.ts   # Exercita helper de hover usando jsdom + SVG
└── sanitizer.test.ts        # Garante sanitização de iframes/estilos
```

**Filosofia**: Teste comportamento, não implementação.

---

## Error Handling & Debugging

### Error Boundaries
- **ErrorBoundary.tsx** captura erros React
- **Graceful degradation**: Plugin continua funcionando com erros parciais
- **User feedback**: Mensagens claras

### Logging Estruturado
```typescript
import { logger } from './core/logger';

logger.info('Highlight created', { cfi, text });
logger.warn('Invalid CFI detected', { cfi, error });
logger.error('Failed to save highlight', { error, context });
```

### CSP (Content Security Policy)

**Warnings Esperados** (não afetam funcionalidade):

```
Refused to load stylesheet 'blob:app://obsidian.md/...'
Blocked script execution in 'about:srcdoc'
```

**Motivo**: epub.js renderiza conteúdo em iframes sandboxed. Obsidian tem CSP estrito.

**Impacto**: ✅ Nenhum. Plugin funciona normalmente.

**Mitigação implementada**:
- DOM sanitizer remove scripts problemáticos
- CSS blob URLs bloqueados, mas fallback styling garante legibilidade
- Supressão de warnings escopo limitado ao iframe do epub

---

## Problemas Conhecidos

### Limitações do iframe do epub.js

- Eventos `contextmenu` e `pointer` avançados não são propagados de forma previsível para o host Obsidian.
- Tentativas de anexar menus nativos aos destaques resultaram em comportamento instável ou dependente de timeouts frágeis.
- **Decisão**: O menu contextual foi removido. Toda a interação com destaques acontece pela seleção + toolbar (destacar, exportar, remover).
- O fluxo atual prioriza previsibilidade: selecionar texto dentro de um destaque aciona os controles dedicados sem depender de eventos de clique dentro do iframe.

### Itens de backlog relacionados

- Extrair um hook `useHighlights` para reduzir o tamanho de `EpubReader.tsx`.
- Normalizar logs de depuração adicionados durante a investigação dos destaques.
- Investigar alternativas de UI baseadas em overlays próprios caso surja uma API confiável para eventos no iframe.

### Entendendo os destaques (epub.js + marks-pane + Obsidian)

Essa seção compila as descobertas mais importantes sobre o pipeline de destaques após as investigações de Outubro/2025:

- **Quem desenha os destaques?** `rendition.annotations.highlight` delega para o `IframeView.highlight`, que cria um `Highlight` do pacote `marks-pane`. Esse helper rende um `<svg>` com `<g>` e múltiplos `rect/path/polygon` absolutizados.
- **Onde o SVG vive?** O `Pane` do `marks-pane` é anexado ao container `.epub-view` (fora do `iframe` do capítulo). Portanto, o highlight não está dentro do `document` do livro, e sim no DOM host onde o ReactReader injeta os views.
- **Propagação de eventos:** `marks-pane/src/events.ts` faz `proxyMouse` entre o `iframe` do livro e os overlays. Os eventos chegam como `click`/`pointerdown` normais, mas já no documento host. Para reagir, escute no `document` do overlay (não apenas no `iframe`).
- **Coordenadas:** Como o `<g>` é absoluto em relação ao `.epub-view`, os bounding boxes vêm em coordenadas globais de viewport. Para posicionar um menu dentro do reader, converta usando `getBoundingClientRect()` do container principal (`readerContainerRef`).
- **Grupo sem tamanho:** O `<g>` raiz frequentemente tem `width/height = 0`. Os retângulos reais estão nos filhos (`rect`, `polygon`, etc.). Use o primeiro `rect` válido como fallback de ancoragem.
- **Metadados:** O `marks-pane` já copia `data-*` do objeto `data` passado ao `Highlight`. Aproveite para gravar `data-highlight-cfi`, `data-highlight-text`, etc., assim conseguimos reconstruir o contexto ao interceptar `pointerdown`.
- **Guards de seleção:** Quando abrirmos dropdowns ou tooltips, registre listeners em **ambos** os documentos: o do `iframe` (texto) e o do overlay (`Pane`). Caso contrário, cliques fora não fecham o menu.
- **Pointer-events:** As formas criadas pelo `marks-pane` têm `pointer-events: none`. Se quiser tornar o highlight clicável, habilite o `pointer-events` no `<g>` via `decorateHighlightElement`.

Seguir esses pontos evita os bugs clássicos (menu aparecendo no canto 0x0, cliques ignorados, ou highlights “fantasmas”).

---

## Roadmap

### v1.6.1 (Atual)
✅ Core puro implementado  
✅ Spatial indexing (10-50x speedup)  
✅ Sistema de highlights CFI-aware  
✅ Component-based UI architecture  

### v1.7.0 - Hook Extraction
- [ ] `useHighlights` extraído do EpubReader
- [ ] `useSearch` para busca in-book
- [ ] `useTheme` para gerenciamento de temas
- [ ] **Meta**: EpubReader.tsx < 400 LOC

### v1.8.0 - Advanced Performance
- [ ] Lazy loading de UI components
- [ ] Virtual scrolling para TOC longos
- [ ] Web Workers para processamento CFI
- [ ] Bundle splitting

### v1.9.0 - Enhanced Testing
- [ ] 90%+ test coverage no core
- [ ] Integration tests para adapters
- [ ] Visual regression tests
- [ ] Performance benchmarks automatizados

### Métricas de Modularidade

```typescript
EpubReader.tsx:       944 → 300 LOC
Core test coverage:   60% → 95%
Bundle size:          568KB → 450KB
```

---

## Compatibilidade

### Backward Compatibility
- **Settings migration**: Automática entre versões
- **Data formats**: Sempre backward compatible
- **API contracts**: Semantic versioning estrito

### Testing Essencial Antes de Release

1. ✓ Abertura de .epub
2. ✓ Mudança de tema
3. ✓ Ajuste de fonte
4. ✓ Criação de nota
5. ✓ Sistema de highlights
6. ✓ Busca in-book
7. ✓ Performance com livros grandes

---

## Recursos Adicionais

- **ARCHITECTURE.md**: Documentação detalhada da arquitetura
- **CHANGELOG.md**: Histórico completo de mudanças
- **TESTING_GUIDE.md**: Guia específico de testes
- **Obsidian Plugin API**: https://docs.obsidian.md/Plugins/
- **epub.js GitHub**: https://github.com/futurepress/epub.js
