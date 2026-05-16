export function gridSizeTierFromParticipantCount(participantCount) {
    if (participantCount <= 4) {
        return 'lg';
    }
    if (participantCount <= 9) {
        return 'md';
    }
    return 'sm';
}
