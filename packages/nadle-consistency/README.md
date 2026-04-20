# Wordle consistency tests

Runs the same fixtures against:

- `apps/client/src/wordle/wordleLogic.ts` — `normalizeWord`, `computeFeedback`
- `apps/server/src/wordle/wordleLogic.ts` — `normalizeWord`, `computeFeedback`

## Run

From repo root:

```bash
npm run test:wordle
```

## Ground truth

- **normalizeWord:** Client matches server (`trim` → `NFC` → `toLocaleLowerCase('uk-UA')`). Includes extra Unicode cases (surrogates, combining marks).
- **wordGraphemeCount (client):** Asserted equal to `[...s].length` (same length semantics as server).
- **computeFeedback:** Equal code-point length for `secret` / `guess` → identical feedback on both sides; includes one surrogate-pair row.
- **Documented difference:** Server `computeFeedback` throws on length mismatch; client returns an array sized to the guess (avoid mismatched lengths in product code).

Add new edge cases to `wordle-logic.test.ts` whenever Wordle rules change.
