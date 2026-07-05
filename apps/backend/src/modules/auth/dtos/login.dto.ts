import { z } from 'zod'

export const loginSchema = z.object({
  identifier: z
    .string()
    .min(3, 'E-mail ou nome de usuário deve ter no mínimo 3 caracteres'),
  password: z.string().min(1, 'Senha obrigatória'),
})

export type LoginDTO = z.infer<typeof loginSchema>
