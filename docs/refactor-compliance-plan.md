# Strict modular CLI compliance plan

## Invariants

- The Instagram runtime is TypeScript-only; browser evaluators are linted `.ts` modules.
- `core/` owns parsing, dispatch, context, results, and nothing Instagram-specific.
- Serializable project data is defined with TypeBox and inferred with `Static`.
- Project type declarations live only in `cli/src/schemas/`; implementation signatures use named imported types.
- Source files have at most 250 lines, functions at most 45 lines, and indentation depth at most 2.
- TypeScript is strict; explicit `any`, dynamic `new Function`, and `as never` escape hatches are forbidden.
- Liker profile collection remains intentionally disabled until it is reliable.

## Phases

1. `automation`: tracked resumable loop, deterministic checks, independent read-only Pi review.
2. `guardrails`: comprehensive source inventory and tested custom ESLint rules.
3. `browser-typescript`: replace `.script` files and dynamic script evaluation with TypeScript evaluators.
4. `central-types`: TypeBox data schemas, centralized ports, no local structural declarations or unsafe casts.
5. `modular-core`: command descriptors/registry and a small command-agnostic core.
6. `cli-semantics`: global options before/after commands and a non-mutating standalone profile summary.
7. `likers-disabled`: preserve and test the intentional disabled state; align documentation.
8. `documentation`: architecture, usage, options, output, status, and contributor guidance.
9. `final-review`: coverage guardrails and an independent requirements audit.

## Phase acceptance

Each phase must pass its focused checks, then `CI=1 npm run guardrails`, then an independent Pi process restricted to read-only tools. The reviewer must emit a final line containing `VALIDATION: PASS`; any other outcome blocks advancement.

Automation never commits, pushes, publishes, deploys, or reads `.env` and browser storage state. Loop state and review logs live under ignored `.loop/`.

## Final acceptance

```bash
npm run lint
npm run typecheck
npm run test
npm run test:coverage
CI=1 npm run guardrails
```

Additionally, `cli/src` contains no `.script`, JavaScript, or Python runtime files; documented CLI forms have smoke tests; and all requirements above have deterministic checks.