# Desenvolvendo o Enhanced Reader

Este documento orienta contribuições e explica como trabalhar com a arquitetura modular.

## 🎯 Filosofia de Desenvolvimento

Este plugin segue uma **evolução arquitetural contínua** baseada no padrão **Ports & Adapters**. A modularidade não é apenas um objetivo inicial, mas um compromisso permanente com:

- **Eficiencia e Eficácia** de maneira organizada.
- **Melhoria contínua da testabilidade** 
- **Facilitação de evolução** sem regressões
- **Otimização de performance** através de arquitetura bem definida (Ports & Adapters)

> 💡 **Princípio**: Cada nova feature deve evitar corromper o princípio arquitetura modular baseada em Ports & Adapters

## 📁 Estrutura Atual

### Core (TypeScript Puro - Zero Dependências)

```
core/
├── cfiComparator.ts     # CFI (Canonical Fragment Identifier) comparison logic
├── highlightIndex.ts    # Spatial indexing for performance optimization  
├── logger.ts           # Interface de logging (ILogger)
├── sanitizer.ts        # DOM sanitization (remove scripts, inline CSS, resolve @import)
└── storage.ts          # Storage contract (IStorage)
```

**Princípio**: Código testável sem Obsidian/React, apenas lógica pura de negócio.

### Adapters (Integrações com o Mundo Externo)

```
adapters/
├── epubjs/
│   ├── contentHook.ts  # Integra sanitizer ao hook de conteúdo do epub.js
│   └── theme.ts        # Aplica tema e fonte no Rendition
└── storage/
    └── localStorageAdapter.ts  # Implementação de IStorage
```

### Hooks (Estado Reativo)

```
hooks/
└── useDarkMode.ts      # Observa mudanças de tema do Obsidian
```

### UI Components (Interface Modular)

```
ui/
├── ErrorBoundary.tsx        # Captura erros de renderização
├── HighlightContextMenu.ts  # Menu contextual para highlights
└── ReaderControls.tsx       # Controles de toolbar (tema, fonte, busca)
```

### Utils (Utilitários de Performance)

```
utils/
└── performance.ts      # Debounce, throttle para otimizações
```

### Assets (Recursos Embutidos)

```
assets/
└── OpenDyslexicCss.ts  # Fonte OpenDyslexic como data URLs (auto-gerada)
```

### Componentes Principais

- **`EpubPlugin.ts`**: Plugin principal que registra o visualizador no Obsidian
- **`EpubView.tsx`**: Gerencia ciclo de vida + ErrorBoundary
- **`EpubReader.tsx`**: Orquestra todos os componentes (944 linhas → alvo de refatoração)

## ⚡ Comandos de Desenvolvimento

```bash
# Build de produção (com prebuild automático)
npm run build

# Desenvolvimento com watch mode
npm run dev

# Execução de testes
npm run test              # Run once
npm run test:watch        # Watch mode

# Bump de versão (atualiza manifest.json e versions.json)
npm run version
```

### 🎨 Pipeline de Build

1. **Prebuild**: `scripts/generate-open-dyslexic.mjs`
   - Lê fontes `.woff` do pacote `open-dyslexic`
   - Gera `src/assets/OpenDyslexicCss.ts` com regras `@font-face` em data URLs
   - Permite fonte 100% offline sem dependências de sistema

2. **TypeScript Check**: Validação de tipos sem emissão

3. **ESBuild**: Bundle otimizado para produção (~568KB)

**Distribuição final**: Apenas `main.js`, `manifest.json`, `styles.css`

## 🏗️ Diretrizes Arquiteturais

### Estratégias de Refatoração Contínua

**🎯 Objetivos de Modularidade:**

1. **EpubReader.tsx** (944 linhas): Alvo prioritário para decomposição
   - Extrair hooks especializados: `useHighlights`, `useSearch`, `useTheme`
   - Separar lógica de estado da apresentação
   - Meta: Reduzir linhas, deve ser focadas em orquestração

2. **Performance Optimization**: 
   - Spatial indexing já implementado (10-50x speedup)
   - Debouncing em operações custosas
   - Próximo: Lazy loading de componentes UI

3. **Testing Strategy**:
   - Core: 100% testável (zero dependências)
   - Adapters: Mocking de dependências externas
   - UI: Testing Library para componentes React

### Processo de Contribuição

**🔍 Análise Antes de Implementar:**

```typescript
// ❌ Antipadrão: Misturar lógicas
function handleClick() {
  // DOM manipulation + Business logic + API calls
}

// ✅ Padrão: Separação de responsabilidades
function handleClick() {
  const result = core.processHighlight(data); // Pure logic
  adapter.updateUI(result);                   // Side effects
}
```

**📋 Checklist para Novas Features:**

- [ ] Lógica de negócio vai para `core/` (testável independente)
- [ ] Integrações externas vão para `adapters/`
- [ ] UI components vão para `ui/` (composáveis)
- [ ] Estado reativo vai para `hooks/`
- [ ] Utilitários genéricos vão para `utils/`
- [ ] Tests unitários criados (quando aplicável)
- [ ] Performance impact avaliado
- [ ] Documentação atualizada

## 🧪 Testing Strategy

```bash
# Core modules (pure functions)
test/core/sanitizer.test.ts
test/core/cfiComparator.test.ts
test/core/highlightIndex.test.ts

# Adapters (with mocking)
test/adapters/epubjs/contentHook.test.ts

# UI components (with React Testing Library)
test/ui/ReaderControls.test.tsx
```

**Filosofia**: Teste o comportamento, não a implementação.

## 🚨 Tratamento de Erros & Debugging

### Error Boundaries
- **ErrorBoundary.tsx**: Captura erros de renderização React
- **Graceful degradation**: Plugin continua funcionando mesmo com erros parciais
- **User feedback**: Mensagens claras para o usuário

### Logging Strategy
```typescript
import { logger } from './core/logger';

// Structured logging with levels
logger.info('Highlight created', { cfi, text: selection });
logger.warn('Invalid CFI detected', { cfi, error });
logger.error('Failed to save highlight', { error, context });
```

### CSP (Content Security Policy) Management

### About the Warnings

When using the Enhanced Reader Plugin, you may see Content Security Policy (CSP) warnings in the Obsidian console. These warnings are **expected? apparently do not affect functionality**.

### Common Warnings

**Stylesheet Blob URL Warnings:**
```text
Refused to load the stylesheet 'blob:app://obsidian.md/...' because it violates the following Content Security Policy directive
```

**Sandboxed Script Warnings:**
```text
Blocked script execution in 'about:srcdoc' because the document's frame is sandboxed and the 'allow-scripts' permission is not set
```

### Why These Warnings Occur

1. **epub.js Architecture**: The epub.js library renders ePub content in sandboxed iframes for security
2. **Obsidian's Security**: Obsidian has strict CSP rules to protect user data
3. **ePub Content**: Some ePub files contain CSS and JavaScript that triggers these warnings

### Impact on Functionality

✅ **No functional impact**: The plugin works correctly despite these warnings
✅ **Reading experience**: All core features (reading, navigation, themes) work normally  
✅ **Security maintained**: Obsidian's security is not compromised

### Technical Implementation

- The plugin automatically sanitizes problematic scripts and external resources
- CSS blob URLs are blocked but fallback styling ensures readability
- Interactive ePub features may be limited, but basic reading is unaffected
- The suppression is scoped to the ePub iframe only (does not override the global console)
- The DOM sanitizer removes scripts and inlines stylesheets when possible, reducing CSP noise
- Inline styles using `url(blob:...)` are stripped selectively to avoid violations without losing layout

## 🎯 Roadmap de Modularidade

### Fase Atual (v1.6.1)
✅ Core puro implementado  
✅ Spatial indexing para performance  
✅ CFI-aware highlight system  
✅ Component-based UI architecture  

### Próximas Fases

**v1.7.0 - Hook Extraction**
- [ ] Extrair `useHighlights` do EpubReader.tsx
- [ ] Extrair `useSearch` para busca in-book
- [ ] Extrair `useTheme` para gerenciamento de temas
- [ ] Meta: EpubReader.tsx < 400 linhas

**v1.8.0 - Advanced Performance**
- [ ] Lazy loading de UI components
- [ ] Virtual scrolling para TOC longos
- [ ] Web Workers para processamento CFI
- [ ] Bundle splitting para otimização

**v1.9.0 - Enhanced Testing**
- [ ] 90%+ test coverage no core
- [ ] Integration tests para adapters
- [ ] Visual regression tests
- [ ] Performance benchmarks automatizados

### Métricas de Modularidade

**Tracking continuous improvement:**

```typescript
// File size targets (lines of code)
EpubReader.tsx:     944 → 300 (atual → meta)
Core test coverage: 60% → 95% 
Bundle size:        568KB → 450KB
Cyclomatic complexity: Monitor via ESLint
```

## � Tentativas de Implementação - Context Menu com Botão Direito

### Objetivo
Fazer com que o menu de contexto dos highlights apareça **apenas** com clique direito (botão direito do mouse), não com clique esquerdo.

### Tentativas Realizadas (Outubro 2025)

#### ❌ Tentativa 1: Verificação de event.button no Callback
**Abordagem:** Adicionar verificação `event.button === 2` dentro do callback do epub.js
```typescript
const clickCallback = (event: MouseEvent) => {
  if (event.button !== 2) return; // Apenas botão direito
  showHighlightContextMenu(event, {...});
};
```
**Resultado:** Callbacks nunca foram chamados. Nenhum log de "Mark clicked" no console.

#### ❌ Tentativa 2: Evento markClicked do epub.js
**Abordagem:** Usar o evento nativo `markClicked` do rendition
```typescript
this.rendition.on('markClicked', (cfi: string, data: any, event: MouseEvent) => {
  console.log('Mark clicked:', cfi, event.button);
});
```
**Resultado:** Evento nunca foi disparado. Pesquisa no GitHub do epub.js confirmou limitações.

#### ❌ Tentativa 3: Callback com Listener de contextmenu
**Abordagem:** Usar callback do click para acessar o elemento DOM e adicionar listener de contextmenu
```typescript
const clickCallback = (event: MouseEvent) => {
  const target = event.target as HTMLElement;
  if (target.dataset.contextmenuAttached) return;
  target.dataset.contextmenuAttached = 'true';
  target.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    showHighlightContextMenu(e, {...});
  });
};
```
**Resultado:** Implementado em 3 locais (addClickableHighlight, restoreHighlights, restoreHighlightsOnLocationChange). Build bem-sucedido (568.5kb), mas menu não aparece no teste real.

### Descobertas Técnicas

1. **Limitação do epub.js:** A biblioteca apenas dispara callbacks para eventos 'click' e 'touchstart', NÃO para 'contextmenu'
   - Fonte: Repositório GitHub futurepress/epub.js
   - Callbacks recebem apenas MouseEvent de click

2. **Timing de DOM:** Elementos de highlight são criados dinamicamente dentro do iframe do epub.js
   - Acesso direto via querySelector pode falhar por questões de timing
   - Callback fornece acesso confiável ao elemento

3. **CFI Errors:** Console mostra erros "No startContainer found for epubcfi(...)"
   - Esses erros são separados do problema do menu
   - Não afetam a funcionalidade de clique

### Estado Atual do Código

**Arquivos Modificados:**
- `src/EpubReader.tsx`: Callbacks implementados em 3 funções
- `styles.css`: cursor alterado de 'pointer' para 'context-menu'
- `src/ui/HighlightContextMenu.ts`: Já possui lógica completa de posicionamento

**Comportamento Esperado (não confirmado):**
1. Clique esquerdo no highlight → Anexa listener de contextmenu
2. Clique direito no mesmo highlight → Deveria abrir o menu

**Próximos Passos a Investigar:**
- [ ] Verificar se iframe bloqueia eventos de contextmenu
- [ ] Testar listeners diretamente no DOM após render completo
- [ ] Investigar alternativas usando MutationObserver
- [ ] Considerar usar biblioteca de context menu diferente
- [ ] Verificar se Obsidian API tem limitações para menus em iframes

### Referências
- epub.js GitHub: https://github.com/futurepress/epub.js
- Obsidian Plugin API: https://docs.obsidian.md/Plugins/
- Annotations API do epub.js: rendition.annotations.add(type, cfi, data, callback, className, styles)

---

## �🔄 Compatibilidade & Migration

### Backward Compatibility
- **Settings migration**: Automática entre versões
- **Data formats**: Sempre backward compatible
- **API contracts**: Semantic versioning estrito

### Testing Regression
```bash
# Testes essenciais antes de release
1. Abertura de .epub ✓
2. Mudança de tema ✓  
3. Ajuste de fonte ✓
4. Criação de nota ✓
5. Sistema de highlights ✓
6. Busca in-book ✓
7. Performance com livros grandes ✓
```

---

## 📚 Recursos Adicionais

- **ARCHITECTURE.md**: Documentação detalhada da arquitetura
- **CHANGELOG.md**: Histórico completo de mudanças
- **TESTING_GUIDE.md**: Guia específico de testes
- **Obsidian Plugin API**: https://docs.obsidian.md/Plugins/


