/** Breakpoints for call grid tile size (participant count = tiles). */
export function gridSizeTierFromParticipantCount(participantCount: number): 'sm' | 'md' | 'lg' {
  if (participantCount <= 4) {
    return 'lg'
  }
  if (participantCount <= 9) {
    return 'md'
  }
  return 'sm'
}
