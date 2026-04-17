/** Legacy hook: Firebase anonymous auth removed; eat-first uses API + Postgres. */
export async function bootstrapEatFirstAuthOnce(): Promise<void> {
  return Promise.resolve()
}
