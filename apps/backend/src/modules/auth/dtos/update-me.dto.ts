import { z } from 'zod'

const updateMeBodySchema = z.object({
  username: z
    .string()
    .min(3, 'Nome de usuário deve ter no mínimo 3 caracteres')
    .max(50)
    .optional(),
  email: z.string().email('E-mail inválido').optional(),
  kindleEmail: z.string().email('E-mail Kindle inválido').or(z.literal('')).optional(),
  avatarUrl: z.string().url('URL do avatar inválida').optional(),
  currentPassword: z
    .string()
    .min(4, 'Senha atual deve ter no mínimo 4 caracteres')
    .optional(),
  password: z.string().min(4, 'Nova senha deve ter no mínimo 4 caracteres').optional(),
  confirmPassword: z
    .string()
    .min(4, 'Confirmação de senha deve ter no mínimo 4 caracteres')
    .optional(),
})

export const updateMeSchema = updateMeBodySchema
  .refine(
    (data) => {
      const hasAtLeastOne = ['username', 'email', 'kindleEmail', 'avatarUrl', 'password'].some(
        (key) => data[key as keyof typeof data] !== undefined,
      )
      return hasAtLeastOne
    },
    { message: 'Informe ao menos um campo para atualizar' },
  )
  .refine(
    (data) => {
      if (data.password) return !!data.currentPassword
      return true
    },
    { path: ['currentPassword'], message: 'Senha atual é obrigatória para trocar a senha' },
  )
  .refine(
    (data) => {
      if (data.password) return data.password === data.confirmPassword
      return true
    },
    { path: ['confirmPassword'], message: 'As senhas não coincidem' },
  )

export type UpdateMeDTO = z.infer<typeof updateMeBodySchema>
