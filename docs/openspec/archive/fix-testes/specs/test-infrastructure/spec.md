## ADDED Requirements

### Requirement: Portabilidade de paths entre sistemas operacionais
Tests MUST use platform-portable path APIs (`path.join`, `path.resolve`, `path.sep`) when constructing or comparing file paths. Tests MUST NOT contain hardcoded path strings with OS-specific separators (`/` or `\`).

#### Scenario: Mock de storage path usa path.join
- **WHEN** um teste mocka `STORAGE_PATH` ou `CONVERSIONS_STORAGE_PATH` via `vi.mock`
- **THEN** o valor injetado deve ser construído com `path.join(os.tmpdir(), ...)`
- **AND** não deve conter strings literais como `'/test/storage'` ou `'\\test\\storage'`

#### Scenario: Asserção de path não depende de separador fixo
- **WHEN** um teste verifica que um path contém um segmento específico
- **THEN** a asserção deve usar `path.join('segmento')` ou `path.sep` em vez de `'/segmento/'`
- **AND** deve ser portável entre Windows e Linux sem modificação

#### Scenario: Mock de fs/promises usa paths normalizados
- **WHEN** um mock de `node:fs/promises` armazena arquivos em um `Map` indexado por path
- **THEN** todas as chaves do `Map` devem ser normalizadas com `path.normalize()`
- **AND** todas as consultas ao `Map` devem normalizar o path de entrada antes da busca

### Requirement: Isolamento de filesystem nos testes
The test suite MUST use an exclusive temporary directory for all file I/O during test execution. The directory MUST be removed completely when the suite finishes, regardless of test results.

#### Scenario: Diretório temporário exclusivo por execução
- **WHEN** a suíte de testes é iniciada
- **THEN** um diretório temporário único é criado em `os.tmpdir()` com prefixo identificável
- **AND** a variável `STORAGE_PATH` aponta para este diretório
- **AND** o diretório não conflita com execuções simultâneas ou anteriores

#### Scenario: Limpeza ao final da execução
- **WHEN** a suíte de testes termina (com sucesso ou falha)
- **THEN** o diretório temporário criado no setup é removido recursivamente
- **AND** não restam arquivos ou diretórios de teste em paths de produção

#### Scenario: Execuções consecutivas não acumulam artefatos
- **WHEN** a suíte é executada duas vezes consecutivas
- **THEN** a segunda execução não encontra artefatos da primeira
- **AND** o diretório `./storage/` (quando existir) não contém novos diretórios após a execução

### Requirement: Independência de infraestrutura externa
The mere act of importing infrastructure modules MUST NOT cause test failures. Tests that do not use a given resource (database, Redis, Docker) MUST be executable without that resource being available.

#### Scenario: Testes sem banco de dados executam sem PostgreSQL
- **WHEN** PostgreSQL não está disponível
- **THEN** testes que não usam banco de dados são executados normalmente
- **AND** a importação de módulos que referenciam `prisma.ts` não causa exceção

#### Scenario: Conexão com banco de dados é lazy
- **WHEN** um módulo de infraestrutura exporta um client de banco de dados
- **THEN** a conexão não é estabelecida no momento do `import`
- **AND** a conexão só ocorre quando o client é efetivamente utilizado

### Requirement: Ambiente de teste autossuficiente
The test environment file (`.env.test`) MUST define all required environment variables that have no default value in the application schema.

#### Scenario: Variáveis obrigatórias definidas
- **WHEN** a suíte de testes é iniciada com `NODE_ENV=test`
- **THEN** `process.env` contém todas as variáveis exigidas pelo schema Zod com `z.string()` sem `.default()`
- **AND** `safeParse(process.env)` é bem-sucedido sem lançar exceção

### Requirement: Banco de dados de teste isolado
When integration tests use a real database, the database MUST be separate from the development database.

#### Scenario: Database dedicado para testes
- **WHEN** um teste de integração escreve no banco de dados
- **THEN** os dados são persistidos em um database exclusivo para testes
- **AND** o banco de dados de desenvolvimento não é afetado
- **AND** os registros de teste são limpos ao final da execução
