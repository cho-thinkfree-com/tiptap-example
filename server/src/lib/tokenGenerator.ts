import { randomBytes, createHash } from 'node:crypto'

export interface TokenPair {
  accessToken: string
  refreshToken: string
}

export interface TokenGenerator {
  generateTokens(): TokenPair
}

export class RandomTokenGenerator implements TokenGenerator {
  constructor(private readonly bytes: number = 32) {}

  generateTokens(): TokenPair {
    const accessToken = randomBytes(this.bytes).toString('base64url')
    const refreshToken = randomBytes(this.bytes).toString('base64url')
    return { accessToken, refreshToken }
  }
}

export const hashToken = (token: string): string => {
  return createHash('sha256').update(token).digest('hex')
}
