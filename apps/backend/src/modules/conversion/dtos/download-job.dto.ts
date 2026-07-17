import { z } from 'zod'

export const downloadJobParamsSchema = z.object({
  conversionId: z.string().min(1),
  jobId: z.string().min(1),
})

export type DownloadJobParams = z.infer<typeof downloadJobParamsSchema>
