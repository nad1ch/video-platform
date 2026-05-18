---
description: Performance audit — find the hotspot before optimizing
---

You are auditing StreamAssist for performance. Read-only by default.

1. Use `/ai/PROMPTS/performance-audit.md` as the structured prompt.
2. Prefer measured evidence over guesses. **Label every estimate.**
3. Cover: I/O, big-O, allocations, render/remount cost (especially `<video>` remounts in
   `CallPage.vue` / `ParticipantTile.vue` / `StreamVideo.vue`), WS round-trips, mediasoup
   producer/consumer churn, reconnect storms.
4. For UI hot paths, check the cascade impact in 8–12-camera rooms.
5. Output the top hotspots ranked by expected impact; propose the smallest change with the largest measurable win.
6. Do not optimize before the hotspot is identified.

Scope: $ARGUMENTS
