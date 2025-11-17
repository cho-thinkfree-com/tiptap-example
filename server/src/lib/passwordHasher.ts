import argon2 from 'argon2'

export interface PasswordHasher {
  hash(plaintext: string): Promise<string>
  verify(hash: string, plaintext: string): Promise<boolean>
}

export class Argon2PasswordHasher implements PasswordHasher {
  async hash(plaintext: string): Promise<string> {
    return argon2.hash(plaintext, {
      type: argon2.argon2id,
    })
  }

  async verify(hash: string, plaintext: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plaintext, { type: argon2.argon2id })
    } catch {
      return false
    }
  }
}
