# Shared canvas editor

This package shares structural editing between the browser and Node.js. It does not run source evaluation, WavePlan generation, HTTP requests, or persistence.

## Build

Install both backend and frontend dependencies for development, as described in `frontend/README.md`. From the repository root, run:

```powershell
node scripts/build-canvas-core.cjs
```

The build uses the frontend TypeScript installation and writes CommonJS to `dist/cjs`, ESM to `dist/esm`, and declarations to both directories. Generated files are ignored by Git. Frontend build, test, typecheck, and dev scripts build this package first. Backend test and dev scripts also build it first.

For backend deployment, build before packaging and include both `dist` directories and `.build-signature` alongside the source. Backend startup checks the source signature and output files. An unchanged prebuilt deployment does not need TypeScript. A source deployment with missing or stale output needs frontend development dependencies to rebuild. Direct Node entry points run the same check.

## API

`createEditor(runtime)` returns parsing, endpoint, capacity, port, edge checking, editing, and `deriveEditorModel` functions. Callers supply `createId`; Node injects SHA-256 and its authoritative rule validation. The browser supplies the authenticated component catalog and uses a local content token for impact confirmation. A local token is not a server digest.

Edits clone the original graph. A successful edit returns `graph`; destructive edits can return `requiresConfirmation`, `impact`, and `digest`. Confirmation must use the original digest. The browser additionally binds confirmation to the editor epoch and revision.

The catalog includes `editorProtocol`, `ruleCatalogVersion`, `nodes`, `matchFormats`, `propertyDefinitions`, `formats`, and structural `samples`. `EDITOR_PROTOCOL` is `canvas-editor`. Current graphs use `schemaVersion: "canvas"`; preview keys use the `canvas-plan/` prefix. These canvas identifiers have no numeric version suffix. Format rules, planner versions, and optimistic concurrency versions remain independent.

Database startup atomically renames previously stored `canvas-v2` graphs and their corresponding validation, schedule, and cached request results. Node and session identities and save versions remain unchanged. Digest aliases preserve retries of an already confirmed request. New requests with old schema names are rejected. Back up persistent databases before updating the application; application rollback must use the matching database backup.

`deriveEditorModel` provides ports, capacities, and display information without source values or wave planning. Full analysis remains an explicit server request. Saving a graph still repeats authoritative server validation.

The core preserves the existing dynamic graph rule implementation during extraction. Its generated declarations currently retain broad types. API type refinement can be done separately without changing graph behavior.

## Checks

```powershell
cd backend
npm test
cd ../frontend
npm test
npm run build
npx playwright test e2e/canvas-local-editing.spec.ts
cd ..
node scripts/profile-canvas-latency.cjs
node scripts/verify-canvas-core.cjs
```

The performance script uses an isolated in-memory application, three warmup runs, and thirty measured runs per graph/network configuration. It measures DOM insertion plus two animation frames as a rendering proxy. It does not measure physical screen scanout or actual phone performance.
