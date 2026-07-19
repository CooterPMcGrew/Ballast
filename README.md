# Ballast

Auto-regulating strength-training app. Prescribes the next set, takes a one-tap
result, adjusts the prescription. Built for a tired, grip-compromised user
glancing between sets — zero-precision UI, no keyboard mid-workout.

## Docs
- `CLAUDE.md` — operating brief: design system, code conventions, physiology
  guardrails. **Read this first.**
- `docs/PRD.md` — feature spec and the design decisions behind it.
- `docs/DATA.md` — how to populate the exercise catalog and gym profiles
  (editable JSON, allowed tags, validation rules).

## Stack
Expo (React Native) + TypeScript. See `CLAUDE.md` §4.

## Status
Working prototype — exercise catalog + gym profiles (editable JSON), active
workout loop (prescription, steppers, Post-Set Matrix), on-device SQLite
persistence. APK builds in CI.

## Run it

Local dev (browser, hot reload):
```
npm install
npm start        # open http://localhost:8081
npm run typecheck
```

On a phone: install the APK from the rolling release —
<https://github.com/CooterPMcGrew/Ballast/releases/tag/latest>.
New builds: push a `v*` tag, or Actions → android-apk → Run workflow.
Expo Go is not used in this project.
