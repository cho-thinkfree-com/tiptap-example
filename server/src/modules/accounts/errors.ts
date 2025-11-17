export class AccountAlreadyExistsError extends Error {
  constructor(public readonly email: string) {
    super(`Account with email ${email} already exists`)
    this.name = 'AccountAlreadyExistsError'
  }
}
