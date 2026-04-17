/**
 * Admin module barrel. Composables import `@/admin/api/adminApi` directly to avoid `@/admin` → state → `@/admin` cycles.
 */
export { adminGetJson } from './api/adminApi'
export {
  useAdminStatsState,
  useAdminStreamersState,
  useAdminUsersState,
  type AdminStatsPayload,
  type AdminStreamerRow,
  type AdminUserRow,
} from './state/useAdminState'
