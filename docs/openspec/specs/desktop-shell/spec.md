# desktop-shell Specification

## Purpose
TBD - created by archiving change desktop-electron-app. Update Purpose after archive.
## Requirements
### Requirement: Desktop App Loads the Existing Frontend

The desktop application SHALL provide a native Electron window that loads the existing MangaInk frontend, without duplicating its React source.

#### Scenario: Development mode loads the Vite dev server
- **WHEN** the desktop app is started in development mode (`desktop:dev`)
- **THEN** the window SHALL load `http://localhost:5173`
- **AND** API requests made by the frontend SHALL be proxied by the existing Vite proxy to the local backend

#### Scenario: Production mode loads the built frontend
- **WHEN** the desktop app is packaged and started
- **THEN** the window SHALL load the built frontend (`dist/`) served via the custom `app://` protocol
- **AND** static assets (JS, CSS, images, fonts) SHALL be served from the bundled frontend directory

#### Scenario: Single instance lock
- **WHEN** a second instance of the desktop app is launched while one is already running
- **THEN** the second instance SHALL exit
- **AND** the existing window SHALL be focused

### Requirement: Desktop Manages the Backend Process

The desktop main process SHALL spawn the compiled backend (`node dist/app.js`) as a child process and manage its lifecycle.

#### Scenario: Backend is spawned with desktop environment
- **WHEN** the desktop app starts
- **THEN** the backend SHALL be spawned with `node {backendPath}/dist/app.js`
- **AND** the environment SHALL include `PORT`, `JWT_SECRET`, `DATABASE_URL`, `REDIS_URL`, `STORAGE_PATH` and `CONVERSIONS_STORAGE_PATH` resolved from desktop settings
- **AND** `OTEL_SDK_DISABLED=true` SHALL be set
- **AND** `MI_DESKTOP_MANAGED=1` SHALL be set

#### Scenario: Health check gates readiness
- **WHEN** the backend has been spawned
- **THEN** the desktop SHALL poll `GET /api/health` every 500ms until the status is `ok`
- **AND** the app SHALL transition to `ready` only after a successful health check

#### Scenario: Backend failure is reported
- **WHEN** the backend process exits before becoming ready
- **OR** the health check times out
- **THEN** the app SHALL transition to `backend_failed`
- **AND** the captured stderr SHALL be available to the status screen

#### Scenario: Backend is terminated on quit
- **WHEN** the desktop app quits
- **THEN** the backend child process SHALL receive `SIGTERM`
- **AND** if it does not exit within 5 seconds, it SHALL be killed with `SIGKILL`
- **AND** no orphan backend process SHALL remain

#### Scenario: Backend restart
- **WHEN** the user triggers retry from the status screen
- **THEN** the previous backend process SHALL be terminated
- **AND** a new backend process SHALL be spawned and health-checked

#### Scenario: First-run prerequisites are detected
- **WHEN** `docker version` fails on the host
- **OR** the configured database/Redis are unreachable
- **THEN** the app SHALL transition to `prereq_failed`
- **AND** the status screen SHALL display the missing prerequisite with setup instructions

#### Scenario: Database migrations run before the API starts
- **WHEN** `MI_DESKTOP_MANAGED=1` is set
- **THEN** `prisma migrate deploy` SHALL run against the configured `DATABASE_URL` before the backend process is spawned
- **AND** if migrations fail, the app SHALL transition to `migration_failed` with the error output

### Requirement: API Requests Are Proxied to the Local Backend

In production mode, HTTP requests made by the frontend to `/api/*`, `/auth/*` and `/users/*` SHALL be forwarded to the local backend without buffering.

#### Scenario: API paths are forwarded
- **WHEN** the renderer requests a path starting with `/api/`, `/auth/` or `/users/`
- **THEN** the request SHALL be forwarded to `http://127.0.0.1:{backendPort}{path}`
- **AND** the request method, headers and body SHALL be preserved
- **AND** the response body SHALL be streamed back without buffering

#### Scenario: SSE streams are not buffered
- **WHEN** the renderer opens an EventSource to an `/events` endpoint
- **THEN** events SHALL be delivered incrementally as the backend emits them
- **AND** no compression or buffering SHALL be applied to `text/event-stream` responses

#### Scenario: Static assets are served locally
- **WHEN** the renderer requests a path that is not an API path
- **THEN** the file SHALL be resolved from the bundled frontend directory
- **AND** the MIME type SHALL match the file extension
- **AND** requesting `/` SHALL serve `index.html`

#### Scenario: Path traversal is rejected
- **WHEN** the renderer requests a path containing `..` that escapes the frontend directory
- **THEN** the request SHALL fail with HTTP 404
- **AND** no file outside the frontend directory SHALL be served

### Requirement: Status Screen Guides the User

While the backend is starting or has failed, the window SHALL display a status screen with diagnostics and recovery actions.

#### Scenario: Status screen shows startup state
- **WHEN** the backend is starting
- **THEN** the window SHALL show the `starting` state with a progress indication

#### Scenario: Status screen shows failure diagnosis
- **WHEN** the app is in `prereq_failed`, `migration_failed` or `backend_failed`
- **THEN** the screen SHALL display the specific failure reason
- **AND** SHALL show the captured error output when available
- **AND** SHALL offer a retry button

#### Scenario: Status screen offers browser fallback
- **WHEN** the status screen is shown
- **THEN** it SHALL offer a link to open `http://localhost:{backendPort}` in the default browser

#### Scenario: Frontend loads only when ready
- **WHEN** the backend becomes ready
- **THEN** the window SHALL load the frontend
- **AND** the status screen SHALL not be shown again for that session

### Requirement: Settings Are Persisted in userData

The desktop app SHALL persist runtime settings in `settings.json` under Electron `userData`.

#### Scenario: Defaults on first run
- **WHEN** the desktop app runs for the first time
- **THEN** a `settings.json` SHALL be created with default `backendPort`, `databaseUrl` and `redisUrl`
- **AND** a cryptographically random `jwtSecret` SHALL be generated and persisted

#### Scenario: Secret persists across restarts
- **WHEN** the desktop app restarts
- **THEN** the previously generated `jwtSecret` SHALL be reused
- **AND** sessions and tokens SHALL remain valid across restarts

#### Scenario: Corrupted settings fall back to defaults
- **WHEN** `settings.json` is corrupted or unreadable
- **THEN** the app SHALL fall back to default settings without crashing
- **AND** the file SHALL be rewritten with valid content

### Requirement: Installer for Windows

The desktop app SHALL be packaged with electron-builder for Windows, producing an NSIS installer and a portable executable.

#### Scenario: NSIS installer is produced
- **WHEN** `desktop:dist` runs on Windows
- **THEN** an NSIS installer SHALL be generated
- **AND** the installer SHALL allow choosing the installation directory
- **AND** it SHALL create a "MangaInk Agent" shortcut

#### Scenario: Portable executable is produced
- **WHEN** `desktop:dist` runs on Windows
- **THEN** a portable executable SHALL be generated alongside the installer

#### Scenario: Bundle includes backend and frontend
- **WHEN** the app is packaged
- **THEN** the compiled backend (dist + production dependencies + Prisma engine + sharp prebuilds) SHALL be included under `resources/backend/`
- **AND** the built frontend SHALL be included under `resources/frontend/`
- **AND** the packaged app SHALL run without Node.js or pnpm installed on the host

#### Scenario: Prerequisite artifacts are verified before packaging
- **WHEN** the backend bundle is prepared
- **THEN** the Prisma engine binary, the generated Prisma client and the sharp prebuild SHALL be verified to exist
- **AND** the build SHALL fail if any of them is missing

### Requirement: Renderer Is Isolated

The desktop window SHALL follow Electron security best practices.

#### Scenario: Context isolation is enabled
- **WHEN** the window is created
- **THEN** `contextIsolation` SHALL be `true`
- **AND** `nodeIntegration` SHALL be `false`
- **AND** `sandbox` SHALL be `true`

#### Scenario: Preload exposes a limited API
- **WHEN** the renderer accesses the desktop API
- **THEN** only `getStatus`, `retry`, `openLogs`, `openExternal` and `getVersion` SHALL be exposed via `window.desktop`
- **AND** no Node.js APIs SHALL be exposed

#### Scenario: External navigation opens in the default browser
- **WHEN** the renderer attempts to open a new window or navigate to an external `http(s)` URL
- **THEN** the URL SHALL be opened with the system default browser via `shell.openExternal`
- **AND** in-app windows SHALL NOT be created for external content

