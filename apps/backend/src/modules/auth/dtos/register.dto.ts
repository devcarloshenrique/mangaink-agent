import { z } from 'zod'

export const registerBodySchema = z.object({
  username: z
    .string()
    .min(3, 'Nome de usuário deve ter no mínimo 3 caracteres')
    .max(50, 'Nome de usuário deve ter no máximo 50 caracteres')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Nome de usuário só pode conter letras, números, _ e -'),
  email: z.string().email('E-mail inválido'),
  password: z.string().min(4, 'Senha deve ter no mínimo 4 caracteres'),
  confirmPassword: z.string().min(4, 'Confirmação de senha deve ter no mínimo 4 caracteres'),
})

export const registerSchema = registerBodySchema.refine(
  (data) => data.password === data.confirmPassword,
  {
    path: ['confirmPassword'],
    message: 'As senhas não coincidem',
  },
)

export type RegisterDTO = z.infer<typeof registerBodySchema>
