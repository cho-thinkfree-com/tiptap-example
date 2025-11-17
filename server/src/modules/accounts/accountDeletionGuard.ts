export interface AccountDeletionGuard {
  ensureCanDelete(accountId: string): Promise<void>
}

export class AllowAllAccountDeletionGuard implements AccountDeletionGuard {
  async ensureCanDelete(): Promise<void> {
    // Placeholder until workspace ownership constraints exist.
  }
}
