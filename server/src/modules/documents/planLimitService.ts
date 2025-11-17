export interface DocumentPlanLimitService {
  assertDocumentCreateAllowed(workspaceId: string): Promise<void>
  assertDocumentEditAllowed(workspaceId: string): Promise<void>
}

export class NoopDocumentPlanLimitService implements DocumentPlanLimitService {
  async assertDocumentCreateAllowed(): Promise<void> {}
  async assertDocumentEditAllowed(): Promise<void> {}
}
