# Prompt: MCP / connectors workflow (per task)

Use this prompt to run [`/ai/MCP_CONNECTORS_WORKFLOW.md`](../MCP_CONNECTORS_WORKFLOW.md) against a specific task. The output is a per-task connectors plan, not a global plan and not an implementation.

Paste this as a **user message** in Claude Code / Cursor after filling in the placeholders. Do not connect anything, do not create configs, and do not use production credentials while answering.

For the one-shot global candidate inventory (run once per agent / IDE setup change), use [`/ai/PROMPTS/mcp-connectors-plan.md`](mcp-connectors-plan.md) instead.

---

## Role

You are a senior AI tooling / security architect for StreamAssist's agent workflow. You select connectors that give Claude / Cursor real, actionable context — and reject connectors whose risk is not justified by the task. You treat every connector as candidate-only until explicitly verified and approved for the task. You never paste secrets, never assume a connector is enabled, and never confuse "enabled" with "approved".

## Context

- Repo: StreamAssist (Vue 3 + Vite client `apps/client`, Node + Express server `apps/server`, mediasoup `packages/call-core`, multi-WS, Twitch, OBS).
- Agents in use: <Claude Code / Cursor / both — fill in>
- Production exposure: real users are live mid-stream; production data includes user identity, billing, leaderboard scores, host authority.
- Documentation: read [`/ai/MCP_CONNECTORS_WORKFLOW.md`](../MCP_CONNECTORS_WORKFLOW.md) first if you have not.
- Surface (fill in if known): <call / mafia / eat first / nadle / checkers / auth / billing / landing>

## Task

<one or two sentences describing the task this connectors plan supports — e.g., "debug a black-tile bug in Mafia overlay on production", "review a billing webhook PR", "implement a new Figma frame for the Eat First admin page">

## Connector inventory (fill in BEFORE responding)

For each candidate connector, mark its state from the agent's actual MCP / tool list — do not assume. If you cannot verify a state, mark `candidate` and do not plan workflows on top of it.

- GitHub repo / issues: <candidate / enabled / approved-for-task>
- Figma: <candidate / enabled / approved-for-task>
- Browser / Chrome MCP: <candidate / enabled / approved-for-task>
- Logs / Sentry: <candidate / enabled / approved-for-task>
- Production URL (fetch): <candidate / enabled / approved-for-task>
- Database (read-only replica or sanitized snapshot): <candidate / enabled / approved-for-task>
- Internal APIs: <candidate / enabled / approved-for-task>
- Docs / Notion: <candidate / enabled / approved-for-task>
- Jira / Linear: <candidate / enabled / approved-for-task>
- CI / GitHub Actions: <candidate / enabled / approved-for-task>
- Analytics / product events: <candidate / enabled / approved-for-task>
- Other (specify): <candidate / enabled / approved-for-task>

## Constraints

- Do NOT connect anything as part of producing this plan.
- Do NOT create MCP config files, `.mcp/` configs, or IDE settings.
- Do NOT request or accept production credentials, `.env` values, OAuth client secrets, DB URIs, signing keys, or webhook secrets.
- Do NOT echo any secret value back, even if the user pastes one — flag it and tell the user to rotate it.
- Read-only first. Promote to write only after a real usage period and an explicit user approval.
- Least privilege. Smallest scope token / role / channel / repo / project that satisfies the task.
- **Candidate does NOT mean enabled.** Listing a connector as a candidate is not permission to call it.
- **Enabled does NOT mean approved.** Visibility in the tool list is not permission to use it for this task.
- **Approved must be task-scoped.** Approval for one task does not grant approval for the next. Re-state scope every task.
- No production writes. No database mutation. No payment, admin, refund, or broadcast actions through an agent.
- No browser automation in trusted production accounts without an explicit per-task approval. Prefer a fresh non-production session.

## Output

Produce the following block in this exact order. Do not skip fields. If a field is not applicable, write "n/a" and explain why.

```text
1. Task summary:
   <one or two sentences restating the task in your own words>

2. Candidate connectors (theoretically useful for this task, not confirmed enabled):
   - <name>: <why it would help this task>

3. Enabled connectors (visible to the agent, but not automatically approved for this task):
   - <name>: <current scope / token type / known limits>

4. Recommended connectors for this task (must be already enabled; pick the smallest set that satisfies the task):
   - <name>:
       data it WILL read:
       data it will NOT touch:
       fallback if it fails or is denied:

5. Connectors to avoid for this task (with reason):
   - <name>: <reason — risk / unnecessary / secret exposure / write access not needed / production data not justified>

6. Permission boundaries per recommended connector:
   - <name>: <repo / project / channel / table / scope token / time window>
   - <name>: read-only? write-with-HITL? approved actions list?

7. Security risks if recommendations are followed:
   - <risk>: <mitigation>

8. Safer fallback without any connector:
   - <how the task could still be completed using file reads, pasted logs, manual screenshots — i.e. the version of the task that requires zero connectors>

9. Required user approvals before proceeding:
   - <approval needed>: <why>: <what action it enables>

10. Next safe step:
    <single concrete action — e.g., "wait for user to confirm Sentry is read-only and project-scoped to streamassist-prod, then run /ai/PROMPTS/bug-debug.md">
```

## Required checks

- Every connector you recommend appears as `enabled` (or `approved-for-task`) in the inventory above. If not, switch to the "safer fallback" path and do not call it.
- No recommendation requires modifying `apps/`, `packages/`, or runtime configs.
- No recommendation requires a secret to be pasted into the agent.
- Every write-capable recommendation is gated by an explicit HITL approval in the relevant prompt (e.g., GitHub PR comment → user confirms before posting).
- If the task touches billing, auth, leaderboard writes, host transfer, or any surface listed in [`/ai/REVIEW_CHECKLIST.md`](../REVIEW_CHECKLIST.md) §6 ("Known production risk surfaces"), recommend the most conservative read-only set and defer any write connector.
- If the task triggers browser automation against a deployed surface, pair with [`/ai/BROWSER_DEBUG_WORKFLOW.md`](../BROWSER_DEBUG_WORKFLOW.md) and explicitly require a fresh non-production session.

## Minimal-diff requirement

This prompt produces a plan — not code. Do not modify runtime code, tests, or CI configs while running it. If the plan requires repo-level changes (e.g., a `.mcp/` config), those land in a separate, scoped PR after the plan is approved.
