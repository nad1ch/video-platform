const DOC_TITLE_BASE = 'Кого ми з’їмо першим'

/**
 * After the `view=overlay|control|admin` panels were removed, the canonical
 * Eat First page always reports the same title regardless of `?mode=view`.
 * The OBS surface and the host/player surface intentionally share the
 * "Кімната" suffix.
 */
export function eatViewTitleFromQuery() {
  return `${DOC_TITLE_BASE} · Кімната`
}
