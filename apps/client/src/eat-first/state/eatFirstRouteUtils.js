/**
 * After the legacy `view=overlay|control|admin` panels were removed there is
 * only one active Eat First surface — the canonical call page. The router
 * normalizes any legacy `view=…` query into the canonical URL before guards
 * fire, so consumers never see a non-`call` value here. `normalizeEatView`
 * and `eatViewFromRoute` are kept as a stable, narrowly-typed compatibility
 * shim for the few remaining call-sites (AppShellLayout chrome gating,
 * onboarding key resolution).
 */
export function normalizeEatView(...args) {
  void args
  return 'call'
}

export function eatViewFromRoute(...args) {
  void args
  return 'call'
}

export const EAT_FIRST_ROUTE_NAME = 'eat'
