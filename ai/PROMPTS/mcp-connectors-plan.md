# Prompt: MCP Connectors Plan

Use this to plan which MCP (Model Context Protocol) connectors / servers to wire into the Claude / Cursor workflow for StreamAssist. The output is a plan, not an implementation.

> **Status: candidates only.** Every connector listed below is a **candidate**, not a confirmed / enabled integration. Nothing in this prompt should be read as "Sentry / Grafana / Cloudflare / Postgres / Figma / Browser MCP data already exists for StreamAssist". Before any workflow is recommended, the agent **must ask the user which MCPs are actually configured**, or read the IDE / agent MCP config, and adjust the plan to that ground truth. Do not invent data sources.

---

## Role

You are a senior workflow engineer planning the MCP surface for StreamAssist's AI tooling. You select connectors that give Claude / Cursor real, actionable context — not "shiny demos". You document trade-offs. You verify what is actually wired before recommending workflows that depend on it.

## Context

- Repo: StreamAssist (Vue 3 + Vite client, Node + Express server, mediasoup, multi-WS, Twitch, OBS).
- AI agents in use: Claude Code, Cursor.
- Goal: give agents read access to production-shaped context (logs, issues, deploys), and limited write access only where it is safe.
- Constraint: do NOT modify application runtime code or tests as part of MCP planning.

## Pre-flight (do this BEFORE writing the plan)

The agent must, before producing the plan:

1. Ask the user — or inspect the agent / IDE config — which MCP servers are **currently enabled** for this user, this repo, and this agent. Capture the list explicitly.
2. For each candidate connector below, mark it `[enabled]`, `[available-but-not-enabled]`, or `[not-available]`.
3. Only map workflows to `[enabled]` connectors. For `[available-but-not-enabled]` connectors, list them under "Connectors to enable later". For `[not-available]` connectors, list them under "Connectors to NOT enable" with the reason.
4. Never imply a connector's data exists if it has not been confirmed enabled. If the workflow truly requires an unenabled connector, write "blocked on enabling <X>" rather than describing the workflow as if it works today.

## Constraints

- No connector that grants Claude unsupervised write access to production data.
- No connector that exposes secrets (Twitch tokens, DB credentials, OAuth client secrets) to the agent.
- All write-enabled connectors require an explicit user-approval step in the agent flow.
- Prefer read-only first. Promote to write only after a usage period.
- Document data sensitivity of each connector before enabling.
- **Do not assume any of the candidate connectors below are enabled in this repo today.** Verify first.

## Candidate connector categories (candidates only — verify enablement first)

| Category | Why useful in StreamAssist | Risk |
|----------|----------------------------|------|
| GitHub | PR review, issue context, file fetch outside checkout | low (read) / medium (write PR / comment) |
| Linear / Jira | Map work items to branches, surface acceptance criteria | low (read) / medium (write) |
| Slack | Surface incident threads, streamer reports | medium (read DMs is sensitive) |
| Sentry / error tracker | Real production stack traces feed `bug-debug.md` | low (read) |
| Grafana / metrics | Latency / WS reconnect / CPU dashboards inform perf audits | low (read) |
| Cloudflare / Nginx logs | Verify ping / idle / WS upgrade assumptions | medium (logs can contain PII) |
| Twitch API | Verify streamer ID / username casing | low (read public) |
| Postgres (read replica) | Spot-check Prisma schema vs runtime | high (data sensitivity) |
| Docs (Notion / Confluence) | Product spec context | low (read) |
| Figma | UI handoff for new features | low (read) |
| Browser MCP (Claude in Chrome) | Reproduce bugs in the deployed app | medium (auth cookies) |

## Output BEFORE editing (the plan)

```text
Goal:
Agents this plan serves (Claude Code / Cursor / both):
Data-sensitivity tiers used (define them, e.g., public / internal / restricted / secret):

Connectors to enable now (read-only):
  - <name>: scope: <repos / orgs / channels>: justification: workflow that uses it (link to /ai/PROMPTS/*):

Connectors to enable later (write or sensitive):
  - <name>: gating condition: human-in-the-loop checkpoint:

Connectors to NOT enable:
  - <name>: reason:

Per-connector auth model:
  - Where credentials live (Claude-managed vs user OS keyring vs env):
  - Rotation policy:

Workflow mapping (only for connectors confirmed `[enabled]` in pre-flight; otherwise mark "blocked on enabling <X>"):
  - /ai/PROMPTS/bug-debug.md          → <enabled connectors only; candidates: Sentry, GitHub (read), Slack (read incident threads)>
  - /ai/PROMPTS/feature-plan.md       → <enabled only; candidates: Linear / Jira, Figma, Notion>
  - /ai/PROMPTS/code-review.md        → <enabled only; candidates: GitHub (PR read)>
  - /ai/PROMPTS/performance-audit.md  → <enabled only; candidates: Grafana, Sentry>
  - /ai/PROMPTS/webRTC-debug.md       → <enabled only; candidates: Sentry, Cloudflare / Nginx logs, Browser MCP>
  - /ai/PROMPTS/product-spec.md       → <enabled only; candidates: Notion, Figma, Linear>
  - /ai/PROMPTS/regression-test.md    → <enabled only; candidates: GitHub (read history)>
  - /ai/PROMPTS/worktree-parallel-agents.md → <enabled only; candidates: GitHub (PR write — with approval)>

Rollout plan:
  - Week 1:
  - Week 2:
  - Review checkpoint:

Risks:
Open questions for the user:
```

## Output AFTER editing

N/A. This is a planning prompt. Once approved, the configuration happens in agent / IDE settings — not in this repo's runtime code.

## Required checks

- Confirm no connector requires modifying `apps/`, `packages/`, or runtime configs.
- Confirm each enabled connector has a documented owner.
- Confirm each write-enabled connector has an explicit human-in-the-loop step in the relevant prompt.
- Re-run this plan quarterly or after any agent / IDE major version bump.

## Minimal-diff requirement

This plan ships as a documentation update only (a section in `/ai/` or a `docs/` file referenced from `/ai/`). It must not modify runtime code, tests, or CI configs. If a connector requires repo-level changes (e.g., a `.mcp/` config), those land in a separate, scoped PR after this plan is approved.
