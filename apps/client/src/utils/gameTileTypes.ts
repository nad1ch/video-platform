/**
 * Neutral type aliases for generic tile / game-room state types whose
 * underlying definitions still live in the Mafia-named util files.
 *
 * The string-literal unions below — life state, elimination background
 * colour, elimination-mark avatar variant — are not Mafia-specific in
 * content; they happen to live alongside Mafia-specific types because
 * Mafia is where the call tile originated. Shared consumers
 * (ParticipantTile's public API, future generic game-room callers)
 * import from this file so their identifiers don't carry a misleading
 * `Mafia` prefix.
 *
 * `./mafiaGameTypes` and `./mafiaEliminationAvatarKind` remain the
 * single source of truth so Mafia and Game Template narrow to exactly
 * the same string literals. Mafia-specific types like `MafiaRole` are
 * NOT re-exported here — see `./mafiaGameTypes` for those.
 */
import type {
  MafiaEliminationBackground,
  MafiaPlayerLifeState,
} from './mafiaGameTypes'
import type { MafiaEliminationAvatarKind } from './mafiaEliminationAvatarKind'

export type GamePlayerLifeState = MafiaPlayerLifeState
export type GameEliminationBackground = MafiaEliminationBackground
export type GameEliminationAvatarKind = MafiaEliminationAvatarKind
