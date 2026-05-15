# Prompt: Product Spec

Copy from here.

---

## Role

You are a senior product engineer drafting a product spec for a StreamAssist feature. The spec must be implementable inside StreamAssist's actual architecture (see `/ai/STREAMASSIST_CONTEXT.md`). You do not invent APIs.

## Context

- Product surface: **<call / mafia / eat-first / nadle / nadraw / checkers / new game / overlay / admin / billing>**
- Feature idea: **<PASTE 1–3 SENTENCES>**
- User segment: **<streamer / viewer / participant / admin / OBS source>**
- Constraints from product: **<deadline / scope / what NOT to change>**
- Known competitors / inspiration (optional): **<paste>**

## Constraints

- The spec must respect existing architecture: pages thin, orchestrator owns side effects, server is authority, `call-core` is the only media stack, overlays do not own media.
- The spec must not assume APIs / WS messages that do not exist. Cite the file or mark as "new contract — to be added".
- The spec must call out high-risk zones touched (`/ai/STREAMASSIST_CONTEXT.md` §5).
- Russian-language strings are forbidden.

## Output BEFORE editing (the spec itself)

```text
# <Feature name>

## 1. Problem
- Who has it:
- What goes wrong today:
- Evidence (analytics / support / streamer feedback / "anecdotal"):

## 2. Goal
- One sentence:
- Success metric (measurable):
- Non-goal (explicit):

## 3. User stories
- As a <role>, I want <action> so that <outcome>.
- ...

## 4. UX
- Entry point(s):
- Flow (step by step):
- Empty / error / loading states:
- OBS / viewer mode behavior (if call-adjacent):
- Mobile considerations:

## 5. Architecture fit
- Affected pages:
- Affected orchestrator(s) (use existing or new `use<Feature>Orchestrator`):
- Affected `packages/*-core` (pure rules):
- Affected server domain folder:
- New protocol constants needed (yes/no, list):
- New REST endpoints needed (yes/no, list):
- New WS messages needed (yes/no, list — both client→server and server→client):
- New Prisma fields needed (yes/no, list):
- New storage keys (yes/no, list):

## 6. Server authority
- What the server must validate:
- What the client may not assert:
- Rate-limit considerations:

## 7. Failure modes
- Reconnect:
- Tab background / OBS source idle:
- Two tabs by same user:
- 8–12 camera load:
- Twitch ingest delay:

## 8. Telemetry
- What events to log (server-side):
- What to expose to streamer dashboard:

## 9. Rollout plan
- Feature flag? (yes/no):
- Phase 1 (MVP):
- Phase 2:
- Phase 3:

## 10. Open questions
- ...

## 11. Risks
- ...
```

## Output AFTER editing

N/A. The spec is the deliverable. Hand off to `/ai/PROMPTS/feature-plan.md` for implementation.

## Required checks

- Walk the spec against `.cursor/rules/streamassist-engineering-rules.mdc` §1–§14 and confirm no rule violation.
- Walk failure modes against `/ai/QA_CHECKLIST.md` §1–§3.
- If unsure whether an API / WS already exists, mark it "TBD — verify" instead of asserting.

## Minimal-diff requirement

The spec must scope to the smallest version that solves the problem. If the feature requires more than three phases to be useful, the problem statement is too broad — narrow it before writing the spec.
