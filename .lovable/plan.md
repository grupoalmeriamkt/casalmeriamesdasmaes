## Objetivo

No Quiz, exibir os itens de **Cartão** e **Polaroid** definidos no Upsell da campanha junto com os produtos no STEP 4. Ao selecionar pelo menos um deles, inserir um **novo passo de personalização** (entre o atual STEP 4 e o resumo) onde o cliente digita o texto do cartão e/ou faz upload da foto da polaroid.

---

## Fluxo (UX)

```
1 Cesta → 2 Dados → 3 Entrega → 4 Data + Upsell → [4.5 Personalização] → 5 Resumo
                                                       ↑
                                  Só aparece se houver cartão e/ou polaroid selecionado
```

- Os itens de **cartão** e **polaroid** aparecem na mesma seção "Quer adicionar algo a mais?" do STEP 4, com o mesmo visual dos produtos, mostrando nome e preço.
- Cada item selecionado (toggle on/off) entra no estado `extras.cartoes` / `extras.polaroids` do `usePedido` com valores temporários (mensagem vazia / arquivo vazio).
- Se ao menos um item de cartão ou polaroid estiver selecionado ao clicar **Continuar** no STEP 4, o Quiz vai para o **passo de Personalização**. Caso contrário, vai direto para o STEP 5 (Resumo).
- O passo de Personalização renderiza um cartão para cada item selecionado:
  - **Cartão**: `<Textarea>` com `maxLength` igual a `maxCaracteres` do item, contador "X / max" abaixo.
  - **Polaroid**: input `file` (accept `image/jpeg,image/png`), botão "Escolher foto", mostra nome do arquivo após upload + ✓; reupload substitui.
- Validação ao avançar:
  - Cartão: mensagem com pelo menos 3 caracteres (trim).
  - Polaroid: arquivo enviado com sucesso (URL preenchida).
- Botão "Voltar" no passo de Personalização retorna ao STEP 4 mantendo seleções; "Continuar" salva rascunho e vai ao STEP 5.

---

## Mudanças técnicas

### 1) `src/components/Quiz.tsx`
- **Numeração de passos**: continuar com `step` 1–5, mas tratar o passo de personalização como `step === 4.5` usando um sub-estado booleano `mostrarPersonalizacao` (mais simples que renumerar todo o array de `TITULOS` e o `progresso`). Header mostrará "Passo 4 de 5 — PERSONALIZAÇÃO" quando ativo. (Alternativa considerada: virar 6 passos; rejeitado para não quebrar a barra de progresso e prévia já indexada por 5).
- No STEP 4, dentro do bloco que lista produtos do upsell, **também listar** itens com `tipo === "cartao"` e `tipo === "polaroid"`, controlados via `usePedido.extras`:
  - Toggle de cartão → chama `setCartao({ itemId, nome, preco, mensagem: "" })` ou `removeCartao(itemId)`.
  - Toggle de polaroid → `setPolaroid({ itemId, nome, preco, arquivoUrl: "", arquivoNome: "" })` ou `removePolaroid(itemId)`.
  - Selecionado = item presente em `extras.cartoes/polaroids` por `itemId`.
- No `avancar()` do STEP 4, depois das validações de data/horário:
  - Calcular `precisaPersonalizar = extras.cartoes.length > 0 || extras.polaroids.length > 0`.
  - Se sim: `setMostrarPersonalizacao(true)` e **não** mudar `step`. O JSX do step de personalização é mostrado quando `step === 4 && mostrarPersonalizacao`.
  - Se não: `setStep(5)`.
- No `voltar()` do passo de personalização: `setMostrarPersonalizacao(false)`.
- Ao concluir o passo de personalização, validar campos preenchidos, gravar rascunho e ir para `step = 5` (resetando o flag).

### 2) Componente novo `PersonalizacaoExtras` (interno ao `Quiz.tsx`, junto dos outros subcomponentes)
- Props: nada (lê/escreve diretamente do `usePedido`) — segue padrão do arquivo.
- Para cada `cartao` em `extras.cartoes`:
  - Buscar `maxCaracteres` no `campanhaAtiva.upsell.itens` correspondente.
  - `<Textarea>` controlado, `onChange` chama `setCartao({...cartao, mensagem: novoTexto})`. Mostra `mensagem.length / maxCaracteres`.
- Para cada `polaroid` em `extras.polaroids`:
  - `<input type="file" accept="image/jpeg,image/png">` escondido + botão estilizado.
  - Estado local `uploading[itemId]` para mostrar `Loader2`.
  - Em `onChange`, chama `uploadPolaroid(file)` (já existe em `src/lib/uploadPolaroid.ts`).
  - Em sucesso: `setPolaroid({...polaroid, arquivoUrl, arquivoNome})` + toast de sucesso.
  - Em erro: `toast.error(result.erro)`.
  - Após upload, mostra `✓ {arquivoNome}` e botão "Trocar foto".
- Reaproveita `BotoesNav` para Avançar/Voltar.

### 3) Pré-visualização (`QuizPreviewMobile.tsx`)
- Adicionar opção `"4.5"` ao seletor `PASSOS` chamada `"4 — Personalização"`. Para que o passo apareça, ao selecionar essa opção: forçar `step=4` e popular `extras` com itens fake de cartão/polaroid baseados no upsell da campanha em edição (apenas dentro do `PreviewProvider`, não persiste em produção). Também aceitar `initialStep` fracionário no `Quiz` (parsear) — mais simples: passar uma nova prop opcional `initialPersonalizacao?: boolean` e setar o flag ao montar.

### 4) Resumo (STEP 5) e mensagem WhatsApp — sem mudanças de lógica
- `selectTotal` já soma cartões e polaroids.
- `montarMensagemWhats` já recebe `extras`. **Mas** o botão de envio no STEP 5 atualmente não passa `extras` no payload — adicionar `extras: st.extras` em `payload.pagamento.extras` (compat com `pedidos.ts` atual que coloca extras dentro de `pagamento`) e em `montarMensagemWhats({ ..., extras: st.extras })`.
- No bloco `ResumoLinha` do STEP 5, adicionar linhas:
  - `Cartões: nome (+ trecho da mensagem...)` se houver.
  - `Foto Polaroid: ✓ enviada` se houver.

### 5) Tipos / store
- Não há mudanças necessárias. `usePedido` já expõe `extras`, `setCartao`, `removeCartao`, `setPolaroid`, `removePolaroid` e o `selectTotal` já contabiliza.

---

## Arquivos editados
- `src/components/Quiz.tsx` (principal — adicionar UI dos itens cartão/polaroid no STEP 4, novo bloco do passo de personalização, ajustes em `avancar`/`voltar`, payload de envio).
- `src/components/admin/QuizPreviewMobile.tsx` (opção de prévia para o passo de personalização).

## Sem alterações
- `src/store/pedido.ts`, `src/store/admin.ts`, `src/lib/uploadPolaroid.ts`, `src/lib/whatsappMsg.ts`, `src/lib/pedidos.ts` (já estão prontos para o fluxo).

## Pendência conhecida (já mencionada antes)
- A coluna `extras jsonb` e o bucket `polaroids` precisam estar criados no Supabase para o upload funcionar de fato. Sem o bucket, o `uploadPolaroid` retornará erro e o passo bloqueará o avanço — comportamento desejado para evitar pedidos sem foto.
