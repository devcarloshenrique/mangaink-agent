import { readdir, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { env } from '../../../shared/config/env'
import { pathExists } from '../../../shared/utils/filesystem'
import { getPrisma } from '../../../shared/database/prisma'
import { logger } from '../../../shared/logging/logger'

/**
 * Contrato de consulta de conversões existentes no banco (fonte de verdade).
 */
export interface ConversionExistenceChecker {
  /** Todos os conversionIds presentes no banco. */
  listKnownConversionIds(): Promise<Set<string>>
}

/** Implementação Prisma do checker — fonte de verdade é a tabela `conversions`. */
export class PrismaConversionExistenceChecker implements ConversionExistenceChecker {
  async listKnownConversionIds(): Promise<Set<string>> {
    const rows = await getPrisma().conversion.findMany({
      select: { conversionId: true },
    })
    return new Set(rows.map((r) => r.conversionId))
  }
}

export interface StorageSweepResult {
  /** Total de subdiretórios encontrados em `CONVERSIONS_STORAGE_PATH`. */
  scanned: number
  /** conversionIds órfãos removidos (sem registro no banco e acima da idade mínima). */
  removed: string[]
  /** Diretórios que pertencem a conversões existentes no banco (mantidos). */
  kept: number
  /** Diretórios ignorados por estarem abaixo da idade mínima (grace period). */
  skipped: string[]
  /** Mensagens de erro por diretório (falha ao ler/estatar/remover). */
  errors: string[]
}

/**
 * Sweeper de storage órfão de conversões (VULN-8).
 *
 * Varre `CONVERSIONS_STORAGE_PATH` e remove recursivamente diretórios que NÃO
 * possuem registro correspondente na tabela `conversions` (outputs, logs e
 * previews temporários de conversões já removidas do banco — seja via DELETE,
 * seja por falha anterior de limpeza). Nunca remove o storage de uma conversão
 * que ainda existe no banco.
 *
 * Grace period: diretórios com mtime mais recente que `minOrphanAgeMs` são
 * ignorados, evitando a corrida entre a criação do diretório e a transação de
 * insert no banco (janela onde o diretório existe sem registro).
 */
export class ConversionStorageSweeper {
  constructor(
    private readonly checker: ConversionExistenceChecker,
    private readonly storagePath: string = env.CONVERSIONS_STORAGE_PATH,
    private readonly minOrphanAgeMs: number = env.STORAGE_SWEEPER_MIN_ORPHAN_AGE_MS,
  ) {}

  async sweep(): Promise<StorageSweepResult> {
    if (!(await pathExists(this.storagePath))) {
      return { scanned: 0, removed: [], kept: 0, skipped: [], errors: [] }
    }

    let entries
    try {
      entries = await readdir(this.storagePath, { withFileTypes: true })
    } catch (err) {
      return {
        scanned: 0,
        removed: [],
        kept: 0,
        skipped: [],
        errors: [this.formatError('(leitura do storage)', err)],
      }
    }

    const dirs = entries.filter((e) => e.isDirectory())

    let knownIds: Set<string>
    try {
      knownIds = await this.checker.listKnownConversionIds()
    } catch (err) {
      return {
        scanned: dirs.length,
        removed: [],
        kept: 0,
        skipped: [],
        errors: [this.formatError('(consulta de conversões no banco)', err)],
      }
    }

    const now = Date.now()

    const result: StorageSweepResult = {
      scanned: dirs.length,
      removed: [],
      kept: 0,
      skipped: [],
      errors: [],
    }

    for (const dir of dirs) {
      const dirPath = join(this.storagePath, dir.name)
      try {
        const stats = await stat(dirPath)
        if (now - stats.mtimeMs < this.minOrphanAgeMs) {
          result.skipped.push(dir.name)
          continue
        }
        if (knownIds.has(dir.name)) {
          result.kept += 1
          continue
        }
        await rm(dirPath, { recursive: true, force: true })
        result.removed.push(dir.name)
      } catch (err) {
        result.errors.push(this.formatError(dir.name, err))
      }
    }

    return result
  }

  private formatError(dirName: string, err: unknown): string {
    return `${dirName}: ${err instanceof Error ? err.message : String(err)}`
  }
}

/**
 * Inicia o sweeper periódico de storage órfão (intervalo configurável via
 * `STORAGE_SWEEPER_INTERVAL_MS`). Executa uma varredura inicial logo após o
 * boot e repete no intervalo. Retorna um handle para encerrar o timer.
 */
export function startConversionStorageSweeper(): { close(): void } {
  const sweeper = new ConversionStorageSweeper(new PrismaConversionExistenceChecker())

  const run = async (): Promise<void> => {
    try {
      const result = await sweeper.sweep()
      if (result.removed.length > 0 || result.errors.length > 0) {
        logger.info(
          {
            scanned: result.scanned,
            removed: result.removed.length,
            kept: result.kept,
            skipped: result.skipped.length,
            errors: result.errors.length,
          },
          '[StorageSweeper] Varredura concluída',
        )
        for (const id of result.removed) {
          logger.info({ conversionId: id }, '[StorageSweeper] Removido storage/conversions')
        }
        for (const error of result.errors) {
          logger.error({ error }, '[StorageSweeper]')
        }
      }
    } catch (err) {
      logger.error({ err: err instanceof Error ? err.message : String(err) }, '[StorageSweeper] Falha na varredura')
    }
  }

  // Varredura inicial após 1 min (não bloqueia o boot) e depois no intervalo.
  const firstRun = setTimeout(() => void run(), 60_000)
  const interval = setInterval(() => void run(), env.STORAGE_SWEEPER_INTERVAL_MS)
  firstRun.unref()
  interval.unref()

  return {
    close() {
      clearTimeout(firstRun)
      clearInterval(interval)
    },
  }
}
