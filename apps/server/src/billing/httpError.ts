/**
 * Local HTTP error for the billing module — mirrors the small helper used by Coin Hub
 * (`coinHub/httpError.ts`) so router glue can map throws to JSON `{ error: { code, message } }`.
 * Kept module-local to avoid creating a shared "errors" package before duplication is real.
 */
export class BillingHttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'BillingHttpError'
  }
}
