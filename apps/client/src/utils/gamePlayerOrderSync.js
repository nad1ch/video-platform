/**
 * Neutral re-export shim for the generic player-join-order helper.
 *
 * The implementation lives in `./mafiaPlayerOrderSync` for legacy reasons —
 * the logic itself is generic (assigns stable 1..N numbers in first-seen
 * order for the current call room) and has nothing Mafia-specific in it.
 * Game Template and any other generic game-room consumers should import
 * from this neutral path; the `Mafia`-prefixed function name is re-exported
 * here under a neutral alias.
 *
 * Mafia consumers continue to import from `./mafiaPlayerOrderSync`
 * directly; those imports remain byte-identical.
 */
export { syncMafiaJoinOrder as syncJoinOrder } from './mafiaPlayerOrderSync';
