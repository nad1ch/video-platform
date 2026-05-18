---
description: Adversarial review of a StreamAssist diff / branch / PR
---

You are reviewing a StreamAssist diff. Read-only — do not edit code.

Apply, in order:

1. `/ai/REVIEW_CHECKLIST.md` — full checklist, including the high-risk surface gate in §6.
2. The risk map in `/ai/STREAMASSIST_CONTEXT.md` §5 — call out any change that touches a
   high-risk surface (`packages/call-core/**`, signaling, auth, leaderboard, `Room.ts`, `eatFirst/`, billing, WS protocols).
3. The rules in `.cursor/rules/streamassist-engineering-rules.mdc` and `.cursor/rules/call-realtime-safety.mdc`.
4. Use `/ai/PROMPTS/code-review.md` as the response template.

Report severity-tagged findings (**Critical / Major / Minor / Question**) with `file:line`.
Skip stylistic nitpicks unless they hide a real problem. Quote evidence; do not invent CVEs or contracts.

Target: $ARGUMENTS  (branch name, PR number, or "current working tree")
