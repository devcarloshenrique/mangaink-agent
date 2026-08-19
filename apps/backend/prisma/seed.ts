import { getPrisma } from '../src/shared/database/prisma'
import bcrypt from 'bcryptjs'

const prisma = getPrisma()

/**
 * Seed: cria o usuario admin padrao se nao existir.
 * Username: admin | Email: admin@mangaink.local | Senha: admin
 *
 * O usuario pode alterar username e senha na tela de Configuracoes.
 * Idempotente: se ja existir, nao faz nada.
 */
async function main() {
  const passwordHash = await bcrypt.hash('admin', 10)

  const existing = await prisma.user.findUnique({
    where: { username: 'admin' },
  })

  if (!existing) {
    await prisma.user.create({
      data: {
        username: 'admin',
        email: 'admin@mangaink.local',
        passwordHash,
        role: 'ADMIN',
      },
    })
    console.log('Seed: usuario admin criado (username: admin, senha: admin)')
  } else {
    if (existing.role !== 'ADMIN') {
      await prisma.user.update({
        where: { username: 'admin' },
        data: { role: 'ADMIN' },
      })
      console.log('Seed: role ADMIN aplicada ao usuario admin existente')
    } else {
      console.log('Seed: usuario admin ja existe, ignorado')
    }
  }
}

main()
  .catch((e) => {
    console.error('Erro no seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
