import { devices } from '../config/devices'
import { formats } from '../config/formats'
import { fields } from '../config/fields'
import { presets } from '../config/presets'
import type { ConversionOptions } from '../types/conversion.types'

/**
 * Opções internas do Planner que nunca devem ser expostas na API pública.
 * Elas são definidas automaticamente pelo Planner com base nos `books`.
 */
const HIDDEN_FIELD_IDS = new Set(['batchSplit', 'fileFusion'])

export class GetConversionOptionsUseCase {
  execute(): ConversionOptions {
    return {
      devices,
      formats,
      fields: fields.filter((f) => !HIDDEN_FIELD_IDS.has(f.id)),
      presets: presets.map((p) => ({
        ...p,
        values: Object.fromEntries(
          Object.entries(p.values).filter(([key]) => !HIDDEN_FIELD_IDS.has(key)),
        ),
      })),
    }
  }
}