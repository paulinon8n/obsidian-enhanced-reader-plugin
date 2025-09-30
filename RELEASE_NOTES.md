# Enhanced Reader Plugin v1.0.0

## 🎉 Initial Release

This is the first release of the **Enhanced Reader Plugin** for Obsidian, a fork and enhancement of the original ePub Reader Plugin.

### ✨ Features

- **📚 ePub Reading**: Full support for `.epub` files directly in Obsidian
- **🎨 Theme Support**: Automatic light/dark theme switching based on Obsidian theme
- **📖 Reading Modes**: Choose between paginated or continuous scrolling view
- **🔤 Font Control**: Adjustable font size (80%-160%)
- **📑 Table of Contents**: Interactive TOC for easy navigation
- **💾 Progress Saving**: Automatically saves reading position
- **📝 Note Integration**: Create linked notes for your books
- **🏷️ Tagging System**: Customizable tags for book notes
- **📁 Folder Management**: Flexible note organization options

### 🛠️ Installation

1. Download the latest release files: `main.js`, `manifest.json`, and `styles.css`
2. Copy them to your vault's plugin folder: `.obsidian/plugins/obsidian-enhanced-reader-plugin/`
3. Enable the plugin in Obsidian's Community Plugins settings

### 📊 Technical Details

- **Version**: 1.0.0
- **Minimum Obsidian Version**: 0.12.0
- **Platform Compatibility**: Desktop and Mobile
- **Author**: Dr. Paulo Bernardy

### 🚀 Getting Started

1. Place any `.epub` file in your vault
2. Click on the file to open it in the Enhanced Reader
3. Use the settings to customize your reading experience
4. Create notes directly from the reader's context menu

---

**Note**: This plugin is a continuation and enhancement of the original ePub Reader Plugin, bringing improved functionality and user experience to Obsidian users.

---

## Enhanced Reader Plugin v1.0.1

## 🔒 CSP & UX improvements

- Scoped CSP log suppression to the ePub iframe only (no global console override)
- Preserved CSS and data:/blob: resources; now inlines stylesheet links when possible
- Stopped removing entire inline styles; only strips properties using url(blob:)
- Re-enabled right-click (context menu) inside the ePub content
- Reacts to Obsidian theme changes live (re-applies rendition theme overrides)

These changes reduce console noise, improve fidelity of book styling, and keep the experience smooth and predictable without exposing settings.

---

## Enhanced Reader Plugin v1.0.2

### 🛠️ Fixes

- Corrige um caso onde o leitor podia ficar preso em “loading…”:
  - Adicionados guards no hook de conteúdo para garantir que `window`/`document` do iframe estejam prontos antes do processamento.
  - Valor padrão da posição de leitura (location) agora é `undefined` (ao invés de `0`) para evitar exibição inicial com CFI inválido.
  - Removida a migração automática de chaves de progresso durante a inicialização para reduzir efeitos colaterais precoces.

### ⚙️ Mudanças

- Progresso de leitura agora é salvo por arquivo (chave baseada no caminho), evitando colisões quando títulos se repetem.
  - Compatibilidade: chaves antigas não são apagadas automaticamente; nenhuma migração forçada.
- Observação: em modo “Scrolled View” (rolagem contínua) a API de paginação (`prevPage`/`nextPage`) não está disponível por design.

### 🧹 Chore

- Bump de versão para `1.0.2` e sincronização de `manifest.json` e `versions.json`.

---

## v1.1.0

### 🧱 Arquitetura modular (Ports & Adapters)

- Refatoração para camadas, reduzindo risco de regressões e facilitando testes e evolução:
  - `core/`: lógica pura (sanitização, logger, contratos de storage)
  - `adapters/epubjs/`: integração com epub.js (hook de conteúdo, aplicação de tema e fonte)
  - `hooks/`: `useDarkMode` para detectar o tema do Obsidian reativamente
  - `ui/`: `ErrorBoundary` para evitar que erros derrubem o leitor
- `EpubReader.tsx` passou a orquestrar essas peças; `EpubView.tsx` envolve o leitor com `ErrorBoundary`.

### � Testes e Confiabilidade

- Supressão de avisos de CSP escopada apenas ao iframe do ePub (sem afetar o console global)
- Sanitização centralizada: remoção de scripts, inlining de CSS com resolução de `@import`, remoção seletiva de `url(blob:)` em estilos inline
- Comportamento preservado (tema, progresso, leitura); mudanças são internas e focadas em estabilidade
- Adicionados testes unitários para o `core/sanitizer` (Vitest + jsdom)

### 📚 Documentação

- Adicionado `ARCHITECTURE.md` descrevendo a arquitetura e pontos de integração
- `README.md` ganhou uma seção “Architecture notes”
- Pequenos ajustes em documentos auxiliares

### ⚙️ Configurações e UI

- Nova configuração: “Debug logging” (liga/desliga logs detalhados)
- UI do leitor mais limpa: `ReaderControls` (controle de fonte) extraído para componente próprio

### 🗃️ Storage (infra)

- Adicionado adapter simples de LocalStorage (opcional, útil para testes e futuras evoluções)

