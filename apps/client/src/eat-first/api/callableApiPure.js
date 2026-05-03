



export function trimFunctionsRegionEnv(value) {
  return String(value ?? '').trim()
}


export function callableApiEnabledFromFlags(firebaseConfigured, functionsRegionRaw) {
  return Boolean(firebaseConfigured) && Boolean(trimFunctionsRegionEnv(functionsRegionRaw))
}
