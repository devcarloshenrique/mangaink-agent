import { z } from 'zod'

// ─── Login ─────────────────────────────────────────────────────────────────────
export const loginSchema = z.object({
  /** E-mail ou nome de usuário (mín. 3 caracteres) */
  identifier: z
    .string()
    .min(3, 'E-mail ou nome de usuário deve ter no mínimo 3 caracteres'),
  password: z.string().min(1, 'Senha obrigatória'),
})

export type LoginDTO = z.infer<typeof loginSchema>

// ─── Register ──────────────────────────────────────────────────────────────────
export const registerBodySchema = z.object({
  username: z
    .string()
    .min(3, 'Nome de usuário deve ter no mínimo 3 caracteres')
    .max(50, 'Nome de usuário deve ter no máximo 50 caracteres')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Nome de usuário só pode conter letras, números, _ e -'),
  email: z.string().email('E-mail inválido'),
  password: z.string().min(4, 'Senha deve ter no mínimo 4 caracteres'),
  confirmPassword: z
    .string()
    .min(4, 'Confirmação de senha deve ter no mínimo 4 caracteres'),
})

export const registerSchema = registerBodySchema.refine(
  (data) => data.password === data.confirmPassword,
  {
    path: ['confirmPassword'],
    message: 'As senhas não coincidem',
  },
)

export type RegisterDTO = z.infer<typeof registerBodySchema>

// ─── Update Me ─────────────────────────────────────────────────────────────────
export const updateMeSchema = z
  .object({
    username: z
      .string()
      .min(3, 'Nome de usuário deve ter no mínimo 3 caracteres')
      .max(50)
      .regex(/^[a-zA-Z0-9_-]+$/, 'Nome de usuário só pode conter letras, números, _ e -')
      .optional(),
    email: z.string().email('E-mail inválido').optional(),
    kindleEmail: z.string().email('E-mail Kindle inválido').nullable().optional(),
    avatarUrl: z.string().url('URL inválida').nullable().optional(),
    currentPassword: z.string().optional(),
    password: z.string().min(4, 'Senha deve ter no mínimo 4 caracteres').optional(),
  })
  .refine(
    (data) => {
      if (data.password && !data.currentPassword) return false
      return true
    },
    {
      path: ['currentPassword'],
      message: 'Senha atual é obrigatória para alterar a senha',
    },
  )

export type UpdateMeDTO = z.infer<typeof updateMeSchema>

// ─── User entity (public) ──────────────────────────────────────────────────────
export interface PublicUser {
  id: string
  username: string
  email: string
  kindleEmail: string | null
  avatarUrl: string | null
}

export interface AuthResponse {
  user: PublicUser
  token: string
}
