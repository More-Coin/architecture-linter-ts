export interface StructuredErrorProtocol {
  readonly code: string;
  readonly message: string;
  readonly retryable: boolean;
  readonly details?: string;
}
