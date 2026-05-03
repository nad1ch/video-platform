import { trimFunctionsRegionEnv } from './callableApiPure.js'

export function callableRegion() {
  return trimFunctionsRegionEnv(import.meta.env.VITE_FUNCTIONS_REGION)
}





export function callableApiEnabled() {
  return false
}
