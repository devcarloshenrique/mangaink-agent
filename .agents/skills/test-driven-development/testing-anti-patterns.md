# Anti-Padrões de Teste

**Carregue esta referência quando:** escrevendo ou alterando testes, adicionando mocks, ou tentado a adicionar métodos apenas para teste em código de produção.

## Visão Geral

Testes devem verificar comportamento real, não comportamento de mock. Mocks são um meio para isolar, não a coisa sendo testada.

**Princípio central:** Teste o que o código faz, não o que os mocks fazem.

**Seguir TDD estrito previne estes anti-padrões.**

## As Leis de Ferro

```
1. NUNCA teste comportamento de mock
2. NUNCA adicione métodos apenas para teste em classes de produção
3. NUNCA mock sem entender as dependências
```

## Anti-Padrão 1: Testar Comportamento de Mock

**A violação:**
```typescript
// ❌ RUIM: Testando que o mock existe
test('renderiza barra lateral', () => {
  render(<Pagina />);
  expect(screen.getByTestId('mock-barra-lateral')).toBeInTheDocument();
});
```

**Por que isso é errado:**
- Você está verificando que o mock funciona, não que o componente funciona
- Teste passa quando o mock está presente, falha quando não está
- Não diz nada sobre comportamento real

**Correção do seu parceiro humano:** "Estamos testando o comportamento de um mock?"

**A correção:**
```typescript
// ✅ BOM: Teste o componente real ou não o mock
test('renderiza barra lateral', () => {
  render(<Pagina />);  // Não mock a barra lateral
  expect(screen.getByRole('navigation')).toBeInTheDocument();
});

// OU se a barra lateral deve ser mockada por isolamento:
// Não afirme sobre o mock - teste o comportamento da Pagina com a barra lateral presente
```

### Função de Portão

```
ANTES de afirmar sobre qualquer elemento mock:
  Pergunte: "Estou testando comportamento real do componente ou apenas existência do mock?"

  SE testando existência do mock:
    PARE - Delete a asserção ou remova o mock do componente

  Teste comportamento real
```

## Anti-Padrão 2: Métodos Apenas para Teste em Produção

**A violação:**
```typescript
// ❌ RUIM: destroy() usado apenas em testes
class Sessao {
  async destroy() {  // Parece API de produção!
    await this.gerenciadorWorkspace?.destruirWorkspace(this.id);
    // ... limpeza
  }
}

// Em testes
afterEach(() => sessao.destroy());
```

**Por que isso é errado:**
- Classe de produção poluída com código apenas para teste
- Perigoso se chamado acidentalmente em produção
- Viola YAGNI e separação de preocupações
- Confunde ciclo de vida do objeto com ciclo de vida da entidade

**A correção:**
```typescript
// ✅ BOM: Utilitários de teste cuidam da limpeza do teste
// Sessao não tem destroy() - é stateless em produção

// Em utils-de-teste/
export async function limparSessao(sessao: Sessao) {
  const workspace = sessao.getInfoWorkspace();
  if (workspace) {
    await gerenciadorWorkspace.destruirWorkspace(workspace.id);
  }
}

// Em testes
afterEach(() => limparSessao(sessao));
```

### Função de Portão

```
ANTES de adicionar qualquer método a uma classe de produção:
  Pergunte: "Isso é usado apenas por testes?"

  SE sim:
    PARE - Não adicione
    Coloque em utilitários de teste

  Pergunte: "Esta classe é dona do ciclo de vida deste recurso?"

  SE não:
    PARE - Classe errada para este método
```

## Anti-Padrão 3: Mockar Sem Entender

**A violação:**
```typescript
// ❌ RUIM: Mock quebra a lógica do teste
test('detecta servidor duplicado', () => {
  // Mock impede escrita de config que o teste depende!
  vi.mock('CatalogoFerramentas', () => ({
    descobrirECachearFerramentas: vi.fn().mockResolvedValue(undefined)
  }));

  await adicionarServidor(config);
  await adicionarServidor(config);  // Deveria lançar - mas não vai!
});
```

**Por que isso é errado:**
- Método mockado tinha efeito colateral do qual o teste dependia (escrever config)
- Excesso de mock para "ficar seguro" quebra o comportamento real
- Teste passa pelo motivo errado ou falha misteriosamente

**A correção:**
```typescript
// ✅ BOM: Mock no nível correto
test('detecta servidor duplicado', () => {
  // Mock a parte lenta, preserve comportamento que o teste precisa
  vi.mock('GerenciadorServidorMCP'); // Apenas mock a inicialização lenta do servidor

  await adicionarServidor(config);  // Config escrito
  await adicionarServidor(config);  // Duplicata detectada ✓
});
```

### Função de Portão

```
ANTES de mockar qualquer método:
  PARE - Não mock ainda

  1. Pergunte: "Quais efeitos colaterais o método real tem?"
  2. Pergunte: "Este teste depende de algum desses efeitos colaterais?"
  3. Pergunte: "Eu entendo completamente o que este teste precisa?"

  SE depende de efeitos colaterais:
    Mock em nível mais baixo (a operação lenta/externa real)
    OU use doubles de teste que preservem o comportamento necessário
    NÃO o método de alto nível do qual o teste depende

  SE não tem certeza do que o teste depende:
    Execute o teste com a implementação real PRIMEIRO
    Observe o que realmente precisa acontecer
    ENTÃO adicione mock mínimo no nível correto

  Bandeiras vermelhas:
    - "Vou mockar isso para ficar seguro"
    - "Isso pode ser lento, melhor mockar"
    - Mockar sem entender a cadeia de dependências
```

## Anti-Padrão 4: Mocks Incompletos

**A violação:**
```typescript
// ❌ RUIM: Mock parcial - apenas campos que você acha que precisa
const mockResposta = {
  status: 'sucesso',
  dados: { usuarioId: '123', nome: 'Alice' }
  // Faltando: metadados que código downstream usa
};

// Depois: quebra quando o código acessa resposta.metadados.idRequisicao
```

**Por que isso é errado:**
- **Mocks parciais escondem suposições estruturais** - Você só mockou campos que conhece
- **Código downstream pode depender de campos que você não incluiu** - Falhas silenciosas
- **Testes passam mas integração falha** - Mock incompleto, API real completa
- **Falsa confiança** - Teste não prova nada sobre comportamento real

**A Regra de Ferro:** Mock a ESTRUTURA DE DADOS COMPLETA como ela existe na realidade, não apenas campos que seu teste imediato usa.

**A correção:**
```typescript
// ✅ BOM: Espelhe a completude da API real
const mockResposta = {
  status: 'sucesso',
  dados: { usuarioId: '123', nome: 'Alice' },
  metadados: { idRequisicao: 'req-789', timestamp: 1234567890 }
  // Todos os campos que a API real retorna
};
```

### Função de Portão

```
ANTES de criar respostas mock:
  Verifique: "Quais campos a resposta da API real contém?"

  Ações:
    1. Examine a resposta real da API em docs/exemplos
    2. Inclua TODOS os campos que o sistema pode consumir downstream
    3. Verifique se o mock corresponde ao esquema da resposta real completamente

  Crítico:
    Se você está criando um mock, deve entender a ESTRUTURA INTEIRA
    Mocks parciais falham silenciosamente quando o código depende de campos omitidos

  Se incerto: Inclua todos os campos documentados
```

## Anti-Padrão 5: Testes de Integração como Reflexão Tardia

**A violação:**
```
✅ Implementação completa
❌ Nenhum teste escrito
"Pronto para testar"
```

**Por que isso é errado:**
- Testar é parte da implementação, não acompanhamento opcional
- TDD teria pego isso
- Não pode afirmar completo sem testes

**A correção:**
```
Ciclo TDD:
1. Escreva teste falhando
2. Implemente para passar
3. Refatore
4. ENTÃO afirme completo
```

## Quando Mocks se Tornam Complexos Demais

**Sinais de alerta:**
- Setup do mock maior que a lógica do teste
- Mockando tudo para fazer o teste passar
- Mocks faltando métodos que componentes reais têm
- Teste quebra quando o mock muda

**Pergunta do seu parceiro humano:** "Precisamos estar usando um mock aqui?"

**Considere:** Testes de integração com componentes reais são frequentemente mais simples que mocks complexos

## TDD Previne Estes Anti-Padrões

**Por que TDD ajuda:**
1. **Escreva teste primeiro** → Força você a pensar sobre o que está realmente testando
2. **Veja falhar** → Confirma que o teste testa comportamento real, não mocks
3. **Implementação mínima** → Nenhum método apenas para teste aparece
4. **Dependências reais** → Você vê o que o teste realmente precisa antes de mockar

**Se você está testando comportamento de mock, violou TDD** - você adicionou mocks sem ver o teste falhar contra código real primeiro.

## Referência Rápida

| Anti-Padrão | Correção |
|-------------|----------|
| Afirmar sobre elementos mock | Teste componente real ou remova o mock |
| Métodos apenas para teste em produção | Mova para utilitários de teste |
| Mock sem entender | Entenda dependências primeiro, mock minimamente |
| Mocks incompletos | Espelhe a API real completamente |
| Testes como reflexão tardia | TDD - testes primeiro |
| Mocks supercomplexos | Considere testes de integração |

## Bandeiras Vermelhas

- Asserção verifica IDs de teste `*-mock`
- Métodos chamados apenas em arquivos de teste
- Setup do mock é >50% do teste
- Teste falha quando você remove o mock
- Não consegue explicar por que o mock é necessário
- Mockando "só para ficar seguro"

## Conclusão

**Mocks são ferramentas para isolar, não coisas para testar.**

Se TDD revela que você está testando comportamento de mock, você errou.

Correção: Teste comportamento real ou questione por que está mockando.
