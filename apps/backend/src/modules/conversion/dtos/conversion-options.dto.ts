import { z } from 'zod'

export const conversionOptionsResponseSchema = z.object({
  devices: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      resolution: z.string(),
    }),
  ),
  formats: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      default: z.boolean().optional(),
    }),
  ),
  fields: z.array(
    z.object({
      id: z.string(),
      type: z.enum(['boolean', 'enum', 'number']),
      component: z.enum(['switch', 'select', 'slider', 'input']),
      label: z.string(),
      description: z.string(),
      help: z.string(),
      default: z.union([z.string(), z.number(), z.boolean()]),
      group: z.enum(['reading', 'processing', 'image', 'output', 'format']),
      options: z
        .array(
          z.object({
            id: z.string(),
            label: z.string(),
          }),
        )
        .optional(),
      min: z.number().optional(),
      max: z.number().optional(),
      step: z.number().optional(),
    }),
  ),
  presets: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      description: z.string(),
      values: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
      exclusive: z.boolean().optional(),
    }),
  ),
})

export type ConversionOptionsResponse = z.infer<typeof conversionOptionsResponseSchema>