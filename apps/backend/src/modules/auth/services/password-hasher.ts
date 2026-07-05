import bcrypt from 'bcryptjs'

export interface PasswordHasher {
  hash(value: string): Promise<string>
  compare(value: string, hash: string): Promise<boolean>
}

export class BcryptPasswordHasher implements PasswordHasher {
  async hash(value: string) {
    return bcrypt.hash(value, 10)
  }

  async compare(value: string, hash: string) {
    return bcrypt.compare(value, hash)
  }
}
