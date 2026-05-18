---
description: Debug a StreamAssist bug — root-cause-first, minimal-fix, regression-test
---

You are in the StreamAssist repo. The user is reporting a bug.

Follow this discipline (do not skip):

1. Read `/ai/DEBUG_PLAYBOOK.md` and apply it.
2. If the bug is observable in a running browser tab, additionally apply `/ai/BROWSER_DEBUG_WORKFLOW.md`.
   Respect the browser-debug allowlist in the global `~/.claude/CLAUDE.md`.
3. Use the template in `/ai/PROMPTS/bug-debug.md` to structure your investigation.
4. **Confirm root cause before writing any code.** Hypothesis → evidence → conclusion. No "probably fixes it" patches.
5. If the bug is deterministic, write a failing regression test first per `/ai/REGRESSION_TEST_WORKFLOW.md`, then the smallest fix.
6. Output the "Before editing" block from `/ai/CLAUDE.md` §2 before touching any file.
7. After the fix, output the "After editing" block and the relevant rows from `/ai/QA_CHECKLIST.md`.

Bug report from user: $ARGUMENTS
