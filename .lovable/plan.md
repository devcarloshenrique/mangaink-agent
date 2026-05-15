## Repositionamento: MangáForge (mangás → Kindle)

Mudar todo o copy/branding do site de "comics/HQs" para **mangás com foco em envio para Kindle**. Manter o estilo pop art, mas com referências a mangás (painéis verticais, balões, "TOMO 01", etc.).

### Arquivos afetados (copy)
- `src/routes/index.tsx` — hero, "How it works", CTAs: trocar "ComicForge" → "MangaForge", "HQs" → "mangás", mencionar "envio direto pro seu Kindle".
- `src/components/comic/Header.tsx` — logo/nome.
- `src/routes/wizard.tsx` — labels, títulos das etapas, mocks ("Capítulo" segue, mas "Volume" também).

---

## 1. Auth + Sistema de Créditos (somente UI/mock)

### Backend
Habilitar **Lovable Cloud** com:
- Auth: **email/senha + Google** (defaults).
- Tabela `profiles` (id → auth.users, display_name, credits int default 10).
- Trigger `handle_new_user` cria profile com 10 créditos grátis no signup.
- Tabela `credit_transactions` (id, user_id, delta, reason, created_at) para histórico.
- RLS: usuário só vê o próprio profile e transações.

### Rotas novas
- `src/routes/login.tsx` — tela de login pop art (email/senha + botão Google).
- `src/routes/_authenticated.tsx` — layout route com `beforeLoad` que redireciona para `/login` se não autenticado.
- Mover `wizard.tsx` para `src/routes/_authenticated/wizard.tsx`.
- `src/routes/_authenticated/conta.tsx` — painel com créditos atuais, histórico, botão fictício "Comprar mais créditos".

### UI
- Header ganha:
  - Badge "⚡ X créditos" sempre visível.
  - Avatar com dropdown (Conta, Sair).
- No wizard, etapa final mostra: **"Esta conversão vai gastar N créditos (1 crédito por capítulo)"**, botão Finalizar desabilitado se créditos insuficientes com CTA "Comprar créditos".
- Server function `consumeCredits({ amount, reason })` chamada no Finalizar (decrementa profile.credits + insere transaction). Conversão em si segue mockada.

---

## 2. Wizard — etapa "Capas" (revisão completa)

Novo modo de seleção. Usuário escolhe granularidade:

```text
[ Por capítulo ]   [ Por volume ]   [ Capa única para tudo ]
```

- **Por capítulo**: lista de capítulos, cada um com seletor de capa (original / galeria / upload).
- **Por volume**: capítulos são auto-agrupados por volume (mock: cada 8 capítulos = 1 volume); um seletor de capa por volume aplica a todos os capítulos do volume.
- **Capa única**: um único seletor que vale para todos os capítulos selecionados.
- Atalho dentro de "Por capítulo": multi-seleção de capítulos + botão **"Aplicar mesma capa"** abre galeria/upload e aplica a todos os marcados.

Estado em `WizardData.covers`:
```ts
{ mode: 'per-chapter' | 'per-volume' | 'single',
  assignments: Record<string /*chapterId|volumeId|'all'*/, CoverRef> }
```

---

## 3. Wizard — etapa "Configurações" (refeita)

Substituir os campos atuais (formato/quality sliders/metadata) por:

### Campos
1. **Perfil do Dispositivo** (dropdown) — opções:
   - Kindle Paperwhite (11ª/12ª gen)
   - Kindle Paperwhite Signature
   - Kindle Oasis
   - Kindle Scribe
   - Kindle Basic (2022/2024)
   - Kindle Colorsoft
   - Kindle Voyage (legado)
   - Kindle Fire HD
2. **Formato de Saída** (dropdown): `EPUB`, `MOBI`, `CBZ`, `KFX`.
3. **Preset** (dropdown com descrição visível):
   - `default` — Configuração padrão
   - `manga` — Otimizado para mangá
   - `webtoon` — Otimizado para webtoon
   - `highQuality` — Qualidade máxima
   - `noProcessing` — Sem processamento de imagem
   - `comic` — Otimizado para comics ocidentais
4. Manter título/autor (metadados) opcionais.

Implementação: `Select` do shadcn estilizado com borda preta grossa + sombra offset (consistente com o tema). Constantes em `src/lib/kindle-presets.ts`.

---

## 4. Wizard — etapa "Entrega" (ajuste leve)

Trocar "download direto" e "email" por:
- **Baixar arquivo**
- **Enviar para meu Kindle** (campo `seu-email@kindle.com`, com nota "lembre de autorizar nosso remetente em Amazon → Manage Your Content and Devices") — apenas UI.

Mostrar resumo final + custo em créditos antes do botão "Converter e enviar".

---

## Detalhes técnicos

- **Stack**: TanStack Start + Lovable Cloud (Supabase). Cliente browser para auth UI; `requireSupabaseAuth` middleware para `consumeCredits` e leitura de profile.
- **Rota protegida**: `_authenticated` layout com `beforeLoad` checando `supabase.auth.getUser()`; `/login` e `/` ficam públicas.
- **Migration**: cria enum/tabelas `profiles`, `credit_transactions`, função `handle_new_user`, trigger em `auth.users`, RLS policies.
- **Server functions** (`src/server/credits.functions.ts`): `getMyProfile`, `consumeCredits`.
- **Sem alteração no design system**: continuamos com `ComicPanel`, `OnomatopoeiaBadge`, `SpeechBubble`, fontes Bangers/Inter.

## Fora do escopo
- Conversão real de arquivos / scraping real de mangás (segue mockado).
- Envio real por e-mail para Kindle.
- Pagamento real de créditos (botão é placeholder).
