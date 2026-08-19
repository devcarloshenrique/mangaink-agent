import { getPrisma } from '../../../shared/database/prisma'
import { BcryptPasswordHasher } from '../services/password-hasher'

/**
 * Inicializa o usuário admin padrão no boot.
 * Username: admin | Email: admin@mangaink.local | Senha: admin
 * 
 * Como o aplicativo é self-hosted, isso garante que o usuário tenha um acesso
 * out-of-the-box sem precisar rodar comandos no terminal para seeder o banco.
 * O usuário pode alterar a senha e o username pela tela de Configurações depois.
 */
export async function initAdminUser(): Promise<void> {
  const prisma = getPrisma()
  const hasher = new BcryptPasswordHasher()

  const existing = await prisma.user.findUnique({
    where: { username: 'admin' },
  })

  if (!existing) {
    const passwordHash = await hasher.hash('admin')
    await prisma.user.create({
      data: {
        username: 'admin',
        email: 'admin@mangaink.local',
        passwordHash,
        role: 'ADMIN',
      },
    })
  } else if (existing.role !== 'ADMIN') {
    // Garante que o usuário admin tenha sempre a role ADMIN
    await prisma.user.update({
      where: { username: 'admin' },
      data: { role: 'ADMIN' },
    })
  }
}
