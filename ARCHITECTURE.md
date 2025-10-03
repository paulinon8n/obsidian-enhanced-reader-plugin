# Enhanced Reader — Arquitetura (Ports & Adapters)

Este plugin deve ser modularizado para reduzir risco de bugs, facilitar testes e evolução seguindo o padrão Ports & Adapters. Este é um propósito que deve ser contínuo e cada vez melhor e mais otimizado. Abaixo está descrito a arquitetura atual e está sempre em atualização.

## Camadas

### Core (TypeScript puro - sem dependências externas)

- **`logger.ts`**: Contrato de logger (`ILogger`) + implementação de console
- **`storage.ts`**: Contrato de storage (`IStorage`) para abstração de persistência
- **`sanitizer.ts`**: Contrato e implementação do sanitizador de DOM do ePub
- **`cfiComparator.ts`**: Utilitários para comparação de CFI (Canonical Fragment Identifiers)
  - Substituiu matching simples de strings por comparação CFI-aware
  - Previne falsos positivos na detecção de highlights sobrepostos
- **`highlightIndex.ts`**: Índice espacial para highlights organizados por seção
  - Melhoria de performance: O(1) lookup por seção vs O(n) busca linear
  - Speedup de ~10-50x para livros com muitos highlights

### Adapters

- **`epubjs/`**
  - **`contentHook.ts`**: Registra hook de conteúdo do epub.js, aplica supressão de CSP no iframe, injeta fontes/estilos e delega ao `sanitizer` do core
  - **`highlightHover.ts`**: Observa os SVGs gerados pelo `marks-pane` (fora do iframe) e injeta sublinhado dinâmico quando o mouse paira sobre um destaque
  - **`theme.ts`**: Aplica tema claro/escuro e tamanho de fonte no `Rendition` do epub.js
- **`storage/`**
  - **`localStorageAdapter.ts`**: Implementação do contrato `IStorage` usando LocalStorage

### Hooks (React)

- **`useDarkMode.ts`**: Observa mudança de tema do Obsidian e expõe `boolean`

### UI Components

- **`ErrorBoundary.tsx`**: Proteção contra erros em tempo de execução na UI do leitor
- **`ReaderControls.tsx`**: Controles de toolbar (tema, fonte, busca e destaques)
  - Centraliza ações de destacar, exportar e remover seleções
- **`HighlightContextMenu.ts`** *(legado)*: Mantido apenas como referência histórica; interações de destaque acontecem na toolbar

### Assets

- **`OpenDyslexicCss.ts`**: Fonte OpenDyslexic embutida como CSS em data URLs
  - Gerada automaticamente pelo script de pré-build
  - Funciona 100% offline sem dependências de sistema

### Utils

- **`performance.ts`**: Utilitários de performance (debounce, throttle)
  - Usado para otimizar operações custosas como restauração de highlights

### Temas

- **`themes/`**: Pasta vazia (sem implementação específica - temas aplicados via adapters)

## Principais Componentes

### `EpubPlugin.ts`

Plugin principal que registra o visualizador de EPUBs no Obsidian.

### `EpubView.tsx`

- Gerencia o ciclo de vida da visualização de arquivos EPUB
- Envolve o leitor com `ErrorBoundary` para falhas não previstas
- Integra com sistema de notas do Obsidian

### `EpubReader.tsx`

- Componente principal que orquestra todas as peças:
  - Usa `useDarkMode` para detectar tema
  - Cria `sanitizer` e outros componentes do core
  - Registra `contentHook` do adapter epub.js
  - Aplica tema e fonte usando adapters
  - Gerencia sistema de highlights com CFI comparison e spatial indexing
  - Implementa busca in-book e navegação

### `EpubPluginSettings.ts`

Tipos e configurações do plugin.

## Fluxo de Dados

```text
EpubPlugin.ts (registro)
    ↓
EpubView.tsx (lifecycle + ErrorBoundary)
    ↓
EpubReader.tsx (orquestração)
    ↓
┌─ Core (cfiComparator, highlightIndex, sanitizer)
├─ Adapters (epubjs hooks, theme application)
├─ UI (toolbar e feedback contextual)
└─ Utils (performance optimizations)
```

## Benefícios da Arquitetura

- **Testável**: O `core` não depende de Obsidian/React e pode ser testado isoladamente
- **Performante**: Spatial indexing e CFI comparison otimizam operações com highlights
- **Menos risco**: Sanitização e temas centralizados evitam duplicação
- **Evolução**: Novos recursos podem adicionar adapters ou hooks sem mexer no core
- **Modular**: Separação clara de responsabilidades entre camadas

## Principais Melhorias Arquiteturais

### 1. Sistema de Highlights Avançado

- **CFI Comparison**: Substituiu matching de strings por análise semântica de CFIs
- **Spatial Indexing**: Otimização de O(n) para O(1) em busca de highlights
- **Toolbar Context-Aware**: Interação guiada diretamente na barra de ferramentas com opções de destacar, exportar e remover

### 2. Performance

- **Debouncing**: Evita operações custosas em eventos frequentes
- **Spatial Indexing**: Reduz drasticamente tempo de busca em livros grandes
- **Lazy Loading**: Highlights carregados apenas quando necessário

### 3. Modularidade

- **Adapters Pattern**: Abstrai integrações com bibliotecas externas
- **Pure Core**: Lógica de negócio sem dependências, facilita testes
- **UI Components**: Componentes reutilizáveis e composáveis

## Compatibilidade

A refatoração preserva o comportamento anterior. Diferenças visuais provavelmente vêm de:

- Correções de sanitização que evitam alertas de CSP
- Melhorias na detecção e performance de highlights
- Interface mais responsiva devido às otimizações de performance
