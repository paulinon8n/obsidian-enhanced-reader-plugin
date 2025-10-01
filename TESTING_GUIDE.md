# 🧪 GUIA DE TESTE - Fase 1

## 🎯 Teste Rápido (30 segundos)

### Pré-requisito
- Build já foi feito ✅
- Obsidian está aberto

### Passos

1. **Recarregue o Obsidian**
   ```
   Windows: Ctrl+R
   Mac: Cmd+R
   ```

2. **Abra um epub com destaques**
   - Qualquer livro que já tenha texto destacado em amarelo

3. **CLIQUE** (não arraste!) em um destaque amarelo
   - Você deve ver o cursor virar uma mãozinha ao passar sobre o destaque
   - Um menu popup deve aparecer instantaneamente

4. **Teste as opções do menu**
   - ✅ Ver detalhes → mostra notificação com informações
   - ✅ Copiar texto → copia para clipboard
   - ✅ Ir para trecho → navega para o CFI
   - ✅ Remover destaque → remove o destaque

---

## 🔍 Teste Completo (5 minutos)

### Teste 1: Hover Effect

**O que testar:**
- Passe o mouse sobre um destaque

**Resultado esperado:**
- ✅ Cursor vira mãozinha (pointer)
- ✅ Destaque fica mais intenso (opacity 0.2 → 0.35)
- ✅ Transição suave (0.15s)

---

### Teste 2: Menu Contextual

**O que testar:**
- Clique em um destaque

**Resultado esperado:**
- ✅ Menu aparece na posição do mouse
- ✅ Menu tem 5 opções:
  1. Ver detalhes (ícone: info)
  2. Copiar texto (ícone: copy)
  3. Ir para trecho (ícone: arrow-right)
  4. --- (separador)
  5. Remover destaque (ícone: trash)

---

### Teste 3: Ver Detalhes

**O que testar:**
- Clique em destaque → "Ver detalhes"

**Resultado esperado:**
- ✅ Notificação aparece com:
  - 📝 Texto do destaque (truncado em 200 chars)
  - 📖 Nome do capítulo
  - 📅 Data de criação
  - ✏️ Data de edição (se existir)
  - 💭 Comentário (se existir)
  - 🏷️ Tags (se existirem)

---

### Teste 4: Copiar Texto

**O que testar:**
1. Clique em destaque → "Copiar texto"
2. Cole em qualquer editor (Ctrl+V)

**Resultado esperado:**
- ✅ Notificação: "Texto copiado para área de transferência"
- ✅ Texto do destaque está no clipboard
- ✅ Funciona mesmo offline

---

### Teste 5: Ir para Trecho

**O que testar:**
- Clique em destaque → "Ir para trecho"

**Resultado esperado:**
- ✅ Livro navega para a página do destaque
- ✅ Destaque fica visível na tela
- ✅ Rolagem automática se necessário

---

### Teste 6: Remover Destaque

**O que testar:**
1. Clique em destaque → "Remover destaque"
2. Verifique o livro

**Resultado esperado:**
- ✅ Destaque desaparece imediatamente
- ✅ Notificação: "Destaque removido"
- ✅ Menu fecha automaticamente

---

### Teste 7: Performance (Navegação Rápida)

**O que testar:**
1. Abra livro com 20+ destaques
2. Navegue rapidamente entre páginas (seta direita)
3. Vire 5-10 páginas rapidamente

**Resultado esperado:**
- ✅ Sem lag ou travamento
- ✅ Destaques aparecem instantaneamente
- ✅ Navegação fluida
- ✅ CPU não sobe muito

**Como verificar:**
- Task Manager → veja uso de CPU
- Deve ficar em ~5-10% (antes era ~20-30%)

---

### Teste 8: Detecção Precisa

**O que testar:**
1. Crie um destaque novo (selecione texto → "Destacar")
2. Arraste para selecionar texto DENTRO desse destaque
3. Olhe a toolbar

**Resultado esperado:**
- ✅ Badge verde aparece: "Destaque existente detectado"
- ✅ Botão vermelho: "Remover destaque"
- ✅ NÃO mostra botão "Destacar" (seria duplicação)

---

### Teste 9: Detecção de Múltiplos Sobrepostos

**O que testar:**
1. Crie destaque A em "texto completo aqui"
2. Crie destaque B em "completo aqui também" (sobreposto)
3. Selecione "completo" (área sobreposta)

**Resultado esperado:**
- ✅ Detecta que está em destaque existente
- ✅ Mostra o primeiro encontrado
- ✅ Não quebra nem duplica

---

### Teste 10: Fechar Menu

**O que testar:**
- Clique em destaque (menu abre)
- Clique FORA do menu (em qualquer lugar)

**Resultado esperado:**
- ✅ Menu fecha automaticamente
- ✅ Destaque continua visível
- ✅ Pode abrir menu novamente

---

## 🐛 Troubleshooting

### Menu não aparece ao clicar

**Possíveis causas:**
1. Plugin não foi recarregado
   - Solução: Settings → Community Plugins → Reload

2. Build antigo
   - Solução: `npm run build` novamente

3. Destaque não tem callback
   - Solução: Remova e recrie o destaque

### Hover effect não funciona

**Possível causa:**
- CSS não foi carregado
  
**Solução:**
```bash
# Verifique se styles.css existe e tem conteúdo
cat styles.css
```

### Performance ainda lenta

**Possível causa:**
- Livro tem 500+ destaques
- Dispositivo lento

**Solução:**
- Habilite `debugLogging: true` nas settings
- Verifique console: tempos de restauração

---

## 📊 Métricas de Sucesso

✅ **Clique único:** < 100ms para abrir menu  
✅ **Hover:** Mudança visual instantânea  
✅ **Performance:** Restauração < 50ms para 100 destaques  
✅ **Detecção:** 0 falsos positivos em testes manuais  
✅ **UX:** 2 ações ao invés de 4  

---

## ✅ Checklist Final

- [ ] Build sem erros
- [ ] Obsidian recarregado
- [ ] Epub aberto
- [ ] Clique único funciona
- [ ] Menu aparece
- [ ] Hover effect visível
- [ ] Performance fluida
- [ ] Detecção precisa
- [ ] Todas opções do menu funcionam

---

**Se todos os ✅ estão marcados: SUCESSO! 🎉**

A Fase 1 está completa e funcional.

---

**Próximo passo:** Fase 2 (Modal de Edição)  
**Estimativa:** 1-2 horas  
**Quando começar:** Quando você quiser! 😊
