# MCP / connectors workflow

This document specifies how AI agents in this repository decide which **MCP servers, connectors, browser tools, repo integrations, log sources, docs platforms, and internal systems** to wire into the agent — and how to use them without leaking secrets, mutating production, or exceeding the task's scope.

It complements [`/ai/PROMPTS/mcp-connectors-plan.md`](PROMPTS/mcp-connectors-plan.md) (one-shot global planning prompt) and the rules in [`/ai/AI_RULES.md`](AI_RULES.md) and [`/ai/REVIEW_CHECKLIST.md`](REVIEW_CHECKLIST.md). Run this workflow per task; run the one-shot plan once per agent / IDE setup change.

## Core principle

> **Candidate → enabled → approved for task.**
> Never assume a connector exists. Never assume an enabled connector is safe to use for the current task.

A connector is a power tool. Wiring one wrong can leak production secrets, mutate live data, expose user PII to an LLM provider, or commit unreviewed changes to a shared system. Treat every connector as **candidate-only** until verified, and treat every verified connector as **task-scoped** for permission purposes.

## 1. Connector states

Every connector — MCP server, browser MCP, repo integration, log source, docs platform, internal API, design tool — sits in exactly one of these states for the current task:

| State | Meaning | What the agent may do |
|-------|---------|------------------------|
| **Candidate** | Useful in theory. Not confirmed installed / enabled for this user, this repo, this agent. | Mention as an option in the plan. Do NOT call it. Do NOT describe outputs as if they exist. |
| **Enabled** | Configured and visible to the agent (appears in MCP list / tool list / IDE config). Not automatically safe for every task. | Acknowledge availability. Do NOT use it without checking the permission boundary for the current task. |
| **Approved for task** | Explicitly allowed for the current task, with clear permissions, scope, and boundaries. | Use within the approved scope only. Do NOT widen scope mid-task. Re-request approval if scope changes. |

The agent must classify every connector it intends to touch and surface that classification in the "Before editing" output (see [`/ai/CLAUDE.md`](CLAUDE.md) §2) and in the task approval checklist below.

## 2. Connector priority table

Candidate inventory for StreamAssist. **None of the rows below are assumed enabled.** The agent must verify enablement before using any of them. "Safe for StreamAssist now?" reflects what the connector class can be used for if read-only and least-privilege are honored — not whether it is wired today.

| Connector | Value | Risk | Setup complexity | Permission level | Safe for StreamAssist now? | Recommended priority |
|-----------|-------|------|------------------|------------------|-----------------------------|----------------------|
| GitHub repo / issues | Code context, PR review, issue tracking | Low (read) / Medium (write PR or comment) | Low | Read-only first; write requires HITL | Yes — read-only | P1 |
| Figma | Design handoff, UI implementation, visual QA | Low (read team / public frames) | Low | Read-only | Yes — read-only | P1 |
| Browser / Chrome (MCP) | Reproduce UI / WebRTC bugs against the deployed app | Medium (auth cookies, session, account state) | Medium | Task-scoped; fresh non-production session | Yes — only with a fresh non-prod session | P2 |
| Logs / Sentry | Real production stack traces; runtime errors | Low (read) / Medium (PII in messages, breadcrumbs) | Medium | Read-only; redact PII | Yes — read-only with redaction | P2 |
| Production URL (fetch) | Read-only verification of deployed surface | Low if read-only and unauthenticated | Low | Anonymous / unauthenticated reads only | Yes — read-only | P2 |
| Database | Spot-check Prisma schema vs runtime | High (PII, identity, billing, economy data) | High | Read-only replica or sanitized snapshot only | No — never production write access | P4 (read replica only) |
| Internal APIs | Server-side context for diagnostics | Medium–High (depending on scope) | Medium | Read-only token; staging env first | Maybe — staging / read-only first | P3 |
| Docs / Notion | Product spec context, ADRs | Low (read) | Low | Read-only | Yes — read-only | P2 |
| Jira / Linear | Map tickets to branches, acceptance criteria | Low (read) / Medium (write) | Low | Read-only first | Yes — read-only | P2 |
| CI / GitHub Actions | Inspect / re-run checks, fetch logs | Medium (`workflow_dispatch` can mutate) | Medium | Read logs first; trigger requires HITL | Maybe — read logs only | P3 |
| Analytics / product events | Funnel, retention, regression detection | Medium (user PII, identifiers) | Medium | Read-only; aggregates over raw events | Maybe — aggregates only | P3 |

Priorities are advisory. The actual order of adoption is in §5 (Adoption roadmap).

## 3. Security rules

Non-negotiable. These apply to every connector, every task, every agent.

- **No secrets in agent context.** Never paste `.env` values, API keys, OAuth client secrets, signing keys, webhook secrets, or DB connection strings into Claude / Cursor.
- **No production writes.** No connector may issue mutating calls against production (DB writes, payment actions, admin endpoints, broadcast messages, mass emails) without explicit per-action user approval.
- **No database mutation.** Production DB connectors are **read-only replica** or **sanitized snapshot** only. Never `INSERT` / `UPDATE` / `DELETE` against the live DB via an agent.
- **No auth / session token exposure.** Cookies, session IDs, OAuth codes, JWTs, refresh tokens — redact before any agent sees them.
- **No browser automation in trusted production accounts** without explicit per-task approval. If a browser MCP is used, prefer a fresh non-production session.
- **No payment / admin actions through browser automation** without explicit human approval per action — never as a batch.
- **Read-only first.** Promote a connector to write access only after a real usage period and an explicit review.
- **Least privilege.** Smallest scope token / role / channel / repo / project that satisfies the task. Do not reuse a broad token because it is convenient.
- **Task-scoped access only.** Approval for one task does not grant approval for the next. Re-state state and scope every task.
- **Revoke when not needed.** If a connector is not in use this week, disable it. Re-enable on demand.
- **Redact at every boundary**: tokens, cookies, OAuth codes, session IDs, webhook secrets, payment IDs, customer emails, phone numbers, raw IP addresses.
- **Never paste `.env` values into Claude.** Reference variable names; never values. If the user pastes one anyway, flag it and ask them to rotate it.
- **Never connect production DB with write access.** Use a read replica or sanitized snapshot. Block at the role / network layer, not at "the agent will be careful".

## 4. StreamAssist-specific usage

Aligned with the surfaces in [`/ai/STREAMASSIST_CONTEXT.md`](STREAMASSIST_CONTEXT.md) and [`/ai/CLAUDE.md`](CLAUDE.md) §0.

- **GitHub repo / issues** — code context, PR review, issue triage. Read-only by default. Write (PR comments, labels, merges) requires HITL per [`/ai/CLAUDE.md`](CLAUDE.md) §1.7.
- **Figma** — design implementation and UI QA. Read-only.
- **Browser / Chrome MCP** — WebRTC / UI bug reproduction (black tile, stuck overlay, wrong control state). Use per [`/ai/BROWSER_DEBUG_WORKFLOW.md`](BROWSER_DEBUG_WORKFLOW.md). Do not log in with a production account; use a fresh test session.
- **Logs / Sentry** — runtime errors and stack traces feeding [`/ai/PROMPTS/bug-debug.md`](PROMPTS/bug-debug.md). Read-only; redact PII in messages and breadcrumbs.
- **Production URL** — read-only verification (public pages, public viewer mode). No authenticated reads through the agent.
- **Database** — read-only replica or sanitized snapshot only. Spot-check Prisma schema vs runtime. **Never** connect a connector with write privileges to production. Billing, identity, and economy tables are restricted-sensitivity.
- **Internal APIs** — read-only token against staging where possible. Never use an admin token to "just look".
- **Twitch-related connectors** — read public scopes only (streamer ID / username casing). Never expose user tokens, broadcaster tokens, or chat OAuth codes to the agent.
- **Billing connectors** — read-only. No refunds, no charge captures, no plan changes, no admin actions executed by an agent. Per [`/ai/REVIEW_CHECKLIST.md`](REVIEW_CHECKLIST.md) §6, billing trust boundaries (`apps/server/src/billing/*`) are high-risk and must be re-verified on every touch.

## 5. What not to connect yet

Even if technically possible, do NOT enable any of the following for agent use today:

- **Production DB with write access.** Read replica / sanitized snapshot only — never live write.
- **Payment provider admin actions** (refunds, captures, plan changes, dispute responses).
- **Raw `.env` files or secret stores** as agent-readable sources.
- **Personal browser sessions with sensitive accounts** (admin Twitch, owner GitHub, billing portal, email).
- **Unrestricted filesystem** (full host disk, home directory) — scope to the repo working tree.
- **Unrestricted shell against any production server.** No SSH-as-root, no `kubectl exec` into prod pods.
- **Broad admin panels** (Twitch broadcaster admin, billing admin, support admin).
- **Third-party accounts without least-privilege tokens.** No "use my personal Slack workspace token" / "use my owner GitHub PAT".

## 6. Adoption roadmap

Order matters. Each step is a checkpoint, not a parallel task. Do not skip ahead.

1. **GitHub / repo context** — read-only. Highest value, lowest risk.
2. **Figma** — design context for UI work. Low risk, high value for handoff.
3. **Browser-assisted debugging** — paired with [`/ai/BROWSER_DEBUG_WORKFLOW.md`](BROWSER_DEBUG_WORKFLOW.md). Fresh sessions only.
4. **Logs / Sentry** — runtime evidence for bug debug. Read-only, with redaction.
5. **Read-only DB / sanitized snapshots** — never live writes. Schema verification, runtime spot-checks.
6. **Internal APIs** — read-only tokens, staging first.
7. **CI / GitHub Actions automation** — read logs first; trigger requires HITL.
8. **MCP / connector governance review** — quarterly audit of which connectors are still in use, who owns each, rotation status, and least-privilege scope.

## 7. Task approval checklist

Before the agent uses any connector for a task, it must output the following block for each connector it intends to touch. Any field that cannot be answered with confidence means the connector is **not approved** for the task — fall back to the safer alternative.

```text
1. Connector:
2. Current state (candidate / enabled / approved for task):
3. What data it can read (sources, scopes, repos, projects, channels, tables):
4. What data it can write (mutations, posts, comments, merges, triggers):
5. Could secrets appear in the data? (yes / no / unknown — assume yes if unknown):
6. Production data involved? (yes / no — and which surface):
7. Permission boundary (repo / project / channel / table / scope token / time window):
8. Why this connector is necessary for THIS task:
9. Safer alternative if not approved (file read / pasted log / WS evidence / staging / manual screenshot):
10. User approval required? (yes / no — yes if production data, write access, secrets risk, or browser automation):
```

## 8. Output format

When the agent outputs a connectors plan for a task, the structure is:

```text
1. Candidate connectors (useful in theory; not confirmed enabled):
2. Enabled connectors (visible to agent; not yet task-approved):
3. Approved-for-task connectors (explicit scope and boundary):
4. Missing setup (connectors a workflow would benefit from but are not enabled):
5. Risk per connector (data sensitivity / write access / secrets exposure):
6. Recommended first connector (single choice, with reason):
7. Permission boundaries (per approved connector):
8. What not to connect yet (with reason):
9. Next safe step (single concrete action):
```

This block is mandatory before any connector call. It is the connectors-equivalent of the "Before editing" output in [`/ai/CLAUDE.md`](CLAUDE.md) §2.

## 9. Related documents

- [`/ai/CLAUDE.md`](CLAUDE.md) — agent identity, model split, output contract.
- [`/ai/AI_RULES.md`](AI_RULES.md) — non-negotiable engineering rules.
- [`/ai/REVIEW_CHECKLIST.md`](REVIEW_CHECKLIST.md) — PR / diff review, including the connector / MCP review row.
- [`/ai/BROWSER_DEBUG_WORKFLOW.md`](BROWSER_DEBUG_WORKFLOW.md) — when using a browser MCP for bug reproduction.
- [`/ai/PROMPTS/mcp-connectors-plan.md`](PROMPTS/mcp-connectors-plan.md) — one-shot global planning prompt (candidate inventory; run once per agent / IDE setup change).
- [`/ai/PROMPTS/mcp-connectors-workflow.md`](PROMPTS/mcp-connectors-workflow.md) — copy-paste per-task prompt for running this workflow.
