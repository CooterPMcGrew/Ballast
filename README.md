# Sweaty Finger

Auto-regulating strength-training app. Prescribes the next set, takes a one-tap
result, adjusts the prescription. Built for a sweaty, tired user glancing between
sets — zero-precision UI, no keyboard mid-workout.

## Docs
- `CLAUDE.md` — operating brief: design system, code conventions, physiology
  guardrails. **Read this first.**
- `docs/PRD.md` — feature spec and the design decisions behind it.
- `docs/DATA.md` — how to populate the exercise catalog and gym profiles
  (editable JSON, allowed tags, validation rules).

## Stack
Expo (React Native) + TypeScript. See `CLAUDE.md` §4.

## Status
Scaffolded — Expo SDK 57 + TypeScript (strict), expo-router, dark-only shell.
Design tokens, progression config, and domain types in place. Engine, store,
and screens not yet built.

## Run it
```
npm install
npm start        # then scan the QR with Expo Go
npm run typecheck
```
