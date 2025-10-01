# Enhanced Reader Plugin v1.6.0

## 🎯 Highlight Management & Search Features

### ✨ New Features

#### **Highlight Removal System**
- ✅ **Interactive Highlight Removal**: Select text in an existing highlight to show removal option
- ✅ **Context-Aware UI**: Automatically detects if selected text is already highlighted
- ✅ **Visual Feedback**: Badge indicator when existing highlight is detected
- ✅ **Persistent Management**: Highlights properly removed from both view and storage

#### **In-Book Search** (from v1.5.0)
- ✅ **Full-Text Search**: Search within the entire EPUB book
- ✅ **Result Navigation**: Navigate through search results with previous/next buttons
- ✅ **Excerpts Preview**: See context around each search result
- ✅ **Chapter Information**: Results show which chapter they're from
- ✅ **Temporary Highlighting**: Search results are highlighted temporarily

#### **Toolbar Persistence** (from v1.5.0)
- ✅ **Per-Book Settings**: Font size, theme, and bionic mode saved per book
- ✅ **Default Settings**: Global defaults applied to new books
- ✅ **Automatic Restoration**: Settings restored when reopening books

### 🔧 Technical Improvements

- **CFI-Based Detection**: Uses Canonical Fragment Identifiers for reliable highlight matching
- **Event-Driven Architecture**: Leverages epub.js `selected` event for text selection
- **Simplified Approach**: Removed complex DOM traversal in favor of data comparison
- **Debug Logging**: Comprehensive logging system for troubleshooting (disabled by default)

### 🐛 Bug Fixes

- Fixed highlight restoration issues with invalid CFIs
- Improved highlight persistence across page navigations
- Better handling of edge cases in text selection

### 📊 Technical Details

- **Version**: 1.6.0
- **Bundle Size**: ~563KB
- **Minimum Obsidian Version**: 0.12.0
- **Platform Compatibility**: Desktop and Mobile

### 🚀 How to Use Highlight Removal

1. Open an EPUB with existing highlights
2. Select text within a highlighted area (drag to select)
3. Notice the green badge "Destaque existente detectado"
4. Click the red "Remover destaque" button
5. Highlight is permanently removed

### 💡 Notes

- Highlight detection works by comparing CFI (location identifiers) between selection and saved highlights
- The system automatically differentiates between creating new highlights and removing existing ones
- All highlight operations are persisted to Obsidian's plugin data

---

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

### 🧪 Testes e Confiabilidade

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


---

## v1.2.0

### 🎨 Toolbar de tema + persistência por arquivo

- Nova toolbar no leitor com ícones nativos do Obsidian para escolher o tema das páginas:
  - Claro (sun), Sépia (palette) e Escuro (moon)
- O tema escolhido passa a ser lembrado por arquivo de livro (chave baseada no caminho)
- O tamanho da fonte também é salvo por arquivo e restaurado automaticamente
- Caso você não tenha escolhido um tema explicitamente, o leitor segue o tema do Obsidian (claro/escuro)

### 🧩 Interno

- `applyTheme` agora suporta `light | sepia | dark` e aplica paletas apropriadas
- `ReaderControls` renderiza ícones usando `setIcon` para manter o visual nativo do Obsidian
- Pequenas melhorias de acessibilidade e estado ativo dos botões

---

## v1.3.0

### 🔤 Seleção de fonte + modo Bionic Reading

- Toolbar agora permite escolher família tipográfica: System / Sans / Serif
- Novo modo “Bionic” (experimental): destaca o início das palavras para auxiliar leitura (dislexia/TDAH)
- Preferências salvas por arquivo: família de fonte e Bionic ficam guardados por livro

Detalhes técnicos:

- `applyFontFamily` aplica `font-family` no `Rendition`
- O hook de conteúdo (`contentHook`) processa os nós de texto de cada seção, quebrando palavras em `<span class="br-strong">` e `<span class="br-tail">` e ativa via classe `br-enabled`
- O processamento é idempotente por seção; alternância só liga/desliga a classe sem reprocessar o texto

#### 1.3.1 (patch)

- Adicionada opção de família tipográfica OpenDyslexic (quando presente no sistema/epub); fallback mantém Sans/Serif caso a fonte não esteja disponível

---

## v1.4.0

### 🔤 OpenDyslexic offline, embutido no plugin

- A família tipográfica OpenDyslexic agora é embutida diretamente no bundle do plugin e injetada no iframe do ePub.
- Funciona 100% offline, sem depender de a fonte existir no EPUB ou no sistema operacional.
- Evita problemas de caminho/CSP no iframe e dispensa arquivos extras na distribuição do Community Store (apenas `main.js`, `manifest.json`, `styles.css`).

Detalhes técnicos:

- Script de pré-build (`scripts/generate-open-dyslexic.mjs`) lê os arquivos `.woff` do pacote `open-dyslexic`, converte para data URL e gera `src/assets/OpenDyslexicCss.ts` com regras `@font-face`.
- O hook de conteúdo garante a injeção do CSS no documento do iframe e alterna uma classe que força a aplicação da fonte quando o usuário seleciona OpenDyslexic.
- Em `EpubReader.tsx`, refs garantem que novas seções carreguem sempre com as preferências atuais (fonte e Bionic) sem re-registro de hooks.

### ✅ Correções e confiabilidade

- A aplicação de fonte e Bionic fica consistente ao navegar entre capítulos/seções.


---

## v1.4.1

### 💡 Destaques persistentes ao reabrir o livro

- Corrige um problema onde o highlight feito apenas com “Destacar” desaparecia ao fechar e reabrir o EPUB.
  - Agora, ao clicar em “Destacar”, o trecho é salvo nos ajustes do plugin para aquele arquivo e restaurado visualmente na abertura seguinte.
  - Exportar para a nota continua funcionando como antes e também persiste o destaque.

### 🧭 Outros

- Pequena limpeza interna: unificação da rotina de persistência de destaques para evitar duplicações e facilitar manutenção.

---

## v1.5.0

### 🧰 Toolbar inteligente e busca dentro do livro

- A barra de ferramentas passou a sincronizar suas preferências via ajustes do plugin:
  - O último estado de fonte, tema, família tipográfica e modo Bionic é gravado por livro e também atualiza o padrão para novos títulos.
  - Ao reabrir um EPUB, o leitor restaura essas escolhas automaticamente.
- Novo painel de busca embutido no leitor:
  - Ative pelo ícone de lupa, digite o termo desejado e navegue pelos resultados.
  - Cada resultado mostra um trecho resumido e, ao clicar, o leitor vai direto para o ponto correspondente com destaque temporário.
  - Botões “Anterior/Próximo” facilitam percorrer os resultados sequencialmente.

### 🧼 Manutenção

- Removida a dependência `use-local-storage-state` (a persistência agora acontece via configurações do plugin).
- Atualização dos controles React para suportar o novo painel de busca e exibir o capítulo da seleção ativa.
- Correção da restauração de destaques: implementado sistema robusto de retry e validação de CFI para garantir que os highlights sejam restaurados corretamente ao reabrir livros.

---

## v1.5.1

### 🐛 Correções

- Corrigido problema onde destaques (highlights) não eram restaurados após fechar e reabrir um EPUB:
  - Implementado sistema de retry automático para CFIs que falham na primeira tentativa.
  - Adicionada validação de CFI antes de tentar restaurar highlights.
  - Os highlights agora são restaurados tanto na abertura inicial quanto ao navegar entre seções.
  - Logs melhorados para facilitar diagnóstico de problemas com CFIs inválidos.

### ✨ Novos recursos

- **Sistema de remoção de destaques**: Agora você pode remover highlights diretamente no leitor:
  - Clique em qualquer destaque existente para selecionar
  - Aparecerá uma barra de ações com opção "Remover destaque"
  - O destaque é removido tanto visualmente quanto da persistência
  - Confirmação via notificação do Obsidian

---

## Enhanced Reader Plugin v1.6.1

## 🛠 Correções e melhorias de UX

### Menu contextual dos destaques na posição correta

- Corrige o problema do menu aparecer fixo no canto superior esquerdo do Obsidian.
- Agora o plugin traduz as coordenadas do clique de dentro do iframe do ePub para a janela principal e usa `showAtPosition` quando possível.
- Fallback: quando `showAtPosition` não está disponível, sintetiza um evento com as coordenadas corretas e usa `showAtMouseEvent`.

### Menu disponível imediatamente após criar destaque

- Destaques criados passam a receber o mesmo handler de clique e estilos de cursor dos restaurados.
- Assim, o menu já abre logo após criar o destaque (não é mais necessário fechar e reabrir o livro).

### Detalhes técnicos

- `src/ui/HighlightContextMenu.ts`: cálculo robusto de posição (iframe → app) com fallback para boundingRect do alvo quando necessário.
- `src/EpubReader.tsx`: helper `addClickableHighlight(...)` centraliza a criação de highlights clicáveis e é usado tanto em “Destacar” quanto em “Exportar”.

### Validação

- Testado em modos paginado e scrolled, e em layout com painéis divididos (split views).

### Versão

- Bump para `1.6.1` e atualização de `manifest.json` e `versions.json`.

