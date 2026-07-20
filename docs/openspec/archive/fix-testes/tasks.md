## 1. Ambiente de teste autossuficiente

- [x] 1.1 Garantir que `.env.test` define todas as variáveis obrigatórias (incluindo `JWT_SECRET`). (Já estava definido)
- [x] 1.2 Adicionar `vitest.globalSetup.ts` que gera `STORAGE_PATH` temporário via `os.tmpdir()` + UUID e o injeta em `process.env`.
- [x] 1.3 Adicionar `vitest.globalTeardown.ts` que remove o diretório temporário recursivamente. (Unificado em `vitest.globalSetup.ts` com exports `setup`/`teardown`)
- [x] 1.4 Atualizar `vitest.config.ts` para registrar `globalSetup` e `globalTeardown`.
- [x] 1.5 Atualizar `.env.test` para usar `STORAGE_PATH` relativo apenas como fallback (o `globalSetup` sobrescreve). (Mantido como fallback; globalSetup sobrescreve em tempo de execução)

## 2. Independência de infraestrutura externa

- [x] 2.1 Refatorar `prisma.ts` para que a conexão PostgreSQL seja inicializada sob demanda (lazy), não no `import` do módulo.
- [x] 2.2 Garantir que o adapter PrismaPg mantenha compatibilidade com o uso existente em produção. (Todos os consumers atualizados para `getPrisma()`)

## 3. Portabilidade de paths entre sistemas operacionais

- [x] 3.1 Corrigir `mobi-preview.service.test.ts`: mock de `env` (`CONVERSIONS_STORAGE_PATH`, `STORAGE_PATH`) deve usar paths construídos com `path.join` a partir de uma raiz portátil.
- [x] 3.2 Corrigir `mobi-preview.service.test.ts`: mock de `fs/promises` (Map storage) deve normalizar separadores para buscas por prefixo.
- [x] 3.3 Corrigir `mobi-preview.service.test.ts`: funções auxiliares (`mobiPath()`, `tempBase()`) devem usar `path.join` em vez de template strings com `/`.
- [x] 3.4 Corrigir `serve-cover.use-case.test.ts`: mock de `STORAGE_PATH` deve usar `path.join(os.tmpdir(), ...)` em vez de `'/test/storage'`.
- [x] 3.5 Corrigir `serve-cover.use-case.test.ts`: asserção `toContain('/covers/')` deve usar `path.join` ou `path.sep`.

## 4. Limpeza automática de recursos

- [x] 4.1 Confirmar que `globalTeardown` (tarefa 1.3) cobre a remoção de todo o storage temporário.
- [x] 4.2 Verificar que os 3 testes de repositório Prisma (`prisma-*.repository.test.ts`) já possuem `afterAll` com cleanup de registros e `$disconnect()`.
- [x] 4.3 Verificar que `filesystem.test.ts` já possui `afterAll` com remoção do diretório de teste. (Sim, usa `fs.rm(testDir, { recursive: true, force: true })`)

## 5. Validação

- [x] 5.1 Executar `pnpm test` no Windows: 0 falhas, 0 warnings. (55 files, 532 tests passed)
- [x] 5.2 Executar `pnpm test` duas vezes consecutivas e confirmar que `storage/` não acumulou novos artefatos.
- [x] 5.3 Executar `pnpm build:backend` sem erros de compilação nos arquivos alterados. (Erros pré-existentes em outros arquivos de teste não relacionados)
- [ ] 5.4 (Desejável) Executar `pnpm test` em Linux e confirmar 0 falhas.

## 6. Atualização da skill TDD

- [x] 6.1 Adicionar seção "Compatibilidade Cross-Platform" com regras sobre paths, asserções e mocks de I/O.
- [x] 6.2 Adicionar seção "Isolamento de Recursos" com regras sobre diretórios temporários, limpeza e bancos de teste.
- [x] 6.3 Adicionar seção "Singletons e Efeitos Colaterais de Módulo" sobre inicialização lazy e variáveis de ambiente.
- [x] 6.4 Adicionar seção "Execução Paralela" sobre workers e recursos compartilhados.
