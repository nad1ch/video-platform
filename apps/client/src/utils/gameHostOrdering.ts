/**
 * Neutral re-export shim for generic host-ordering helpers.
 *
 * The implementation lives in `./mafiaHostOrdering` for legacy reasons —
 * the logic itself is generic (a host peer is pinned to the end of the
 * numbering order; it has nothing Mafia-specific in it). Game Template
 * and any other generic game-room consumers should import from this
 * neutral path so future renames don't touch every call site.
 *
 * Mafia consumers continue to import from `./mafiaHostOrdering` directly;
 * those imports remain byte-identical.
 */
export { pinHostPeerToEndOfOrder } from './mafiaHostOrdering'
export { mafiaNightActionMaxSeatForOrder as nightActionMaxSeatForOrder } from './mafiaHostOrdering'
