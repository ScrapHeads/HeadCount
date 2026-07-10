# Repository Maps

Last updated: 2026-07-09

This document maps the HeadCount repository for contributors who need to find
the right files quickly. It complements the setup guides in `docs/` and the
short structure summary in `README.md`.

## System Map

HeadCount is a Vite React frontend backed by Firebase services.

```text
index.html
  -> src/main.jsx
    -> applyBrandingTheme()
    -> AppProviders
      -> AuthProvider
        -> App
          -> BrowserRouter routes
            -> route-level pages
              -> feature hooks
                -> feature services
                  -> shared Firebase/Auth/Firestore wrappers
```

The optional trusted backend is a Firebase Functions package in `functions/`.
It currently exposes credential management for student ID changes and password
resets.

## Directory Map

```text
.
|-- src/
|   |-- app/                  App shell, providers, route guards, route table
|   |-- components/
|   |   |-- dashboard/         Coach dashboard panels and time-log editor
|   |   `-- shared/            Reusable form and message controls
|   |-- config/               Branding, route paths, data fields, ID generation
|   |-- features/             Domain hooks and service modules
|   |   |-- auth/              App auth context and role-specific login flows
|   |   |-- extraTimeRequests/ Extra-time request create/review subscriptions
|   |   |-- schedules/         Schedule CRUD, caching, and active-window logic
|   |   |-- students/          Roster CRUD, active student subscriptions
|   |   |-- tasks/             Task CRUD, caching, and sign-in filtering
|   |   `-- timeLogs/          Check-in/out, analytics, history, subscriptions
|   |-- hooks/                Cross-feature React hooks
|   |-- lib/                  Pure helpers for dates, analytics, validation
|   |-- pages/                Route-level screens
|   |-- services/             Firebase init, Auth, Firestore, Functions wrappers
|   `-- styles/               Tailwind theme bridge and shared class strings
|-- public/                   Static assets, icons, Cloudflare redirect file
|-- functions/                Optional Firebase Cloud Functions package
|-- docs/                     Setup, hosting, commercial-use, and repo guides
|-- firebase.json             Firebase deploy targets
|-- firestore.rules           Firestore browser access rules
|-- firestore.indexes.json    Firestore indexes
|-- package.json              Frontend dependencies and scripts
|-- vite.config.js            Vite, React, and Tailwind build config
`-- vercel.json               Vercel client-side routing rewrite
```

## Entry And Routing Map

| File | Role |
| --- | --- |
| `index.html` | HTML shell and static metadata. |
| `src/main.jsx` | Creates the React root, applies branding variables, and renders the app. |
| `src/app/providers.jsx` | Holds app-wide providers. Currently wraps the app in `AuthProvider`. |
| `src/app/App.jsx` | Defines route guards and all browser routes. |
| `src/config/routesConfig.js` | Central source of route path constants used by links and router definitions. |

| Route constant | Path | Guard | Page |
| --- | --- | --- | --- |
| `accessPortal` | `/` | None | `src/pages/AccessPortal.jsx` |
| `legacyAccessPortal` | `/access` | Redirect | `/` |
| `kiosk` | `/kiosk` | `KioskRoute` | `src/pages/KioskStudentLogin.jsx` |
| `coachDashboard` | `/coach/dashboard` | `CoachRoute` | `src/pages/CoachDashboard.jsx` |
| `studentDashboard` | `/student/dashboard` | `StudentRoute` | `src/pages/StudentDashboard.jsx` |
| `studentSession` | `/student/session` | `StudentRoute` | `src/pages/StudentCheckIn.jsx` |
| `legacyStudentCheckIn` | `/student/checkin` | Redirect | `/student/session` |
| `studentCheckOut` | `/student/checkout` | `StudentRoute` | `src/pages/StudentCheckOut.jsx` |
| `*` | Any other path | None | `src/pages/NotFound.jsx` |

## Feature Map

| Feature | UI entry points | Hooks | Services and helpers |
| --- | --- | --- | --- |
| Authentication | `AccessPortal`, route guards in `App.jsx` | `src/features/auth/useAuth.jsx`, `src/hooks/useStudentSession.js` | `src/features/auth/authServices.js`, `src/services/auth.js`, `src/services/firebase.js` |
| Student roster | `CoachDashboard`, `StudentManagementDashboard` | `src/features/students/useStudents.js` | `src/features/students/studentService.js`, `src/config/studentIdGenerator.js`, `src/lib/studentUtils.js` |
| Time logs | `StudentCheckIn`, `StudentCheckOut`, `StudentDashboard`, dashboard panels | `src/features/timeLogs/useStudentTimeLogs.js`, `useCompletedTimeLogs.js`, `useAnalyticsTimeLogs.js` | `src/features/timeLogs/timeLogService.js`, `src/lib/dateUtils.js`, `src/lib/analyticsUtils.js` |
| Tasks | Coach dashboard task and schedule controls, student check-in task list | `src/features/tasks/useTasks.js` | `src/features/tasks/taskService.js`, `src/features/tasks/taskUtils.js` |
| Schedules | Coach dashboard schedule controls, sign-in availability checks | `src/features/schedules/useSchedules.js` | `src/features/schedules/scheduleService.js`, `src/features/schedules/validateSchedule.js` |
| Extra-time requests | `StudentDashboard`, `StudentManagementDashboard` | `src/features/extraTimeRequests/useExtraTimeRequests.js` | `src/features/extraTimeRequests/extraTimeRequestService.js` |
| Analytics | `AnalyticsDashboard`, student dashboard summary | `src/features/timeLogs/useAnalyticsTimeLogs.js` | `src/lib/analyticsUtils.js`, `src/features/timeLogs/timeLogService.js` |

## Firebase Data Map

Collection and field names are centralized so data model changes are easier to
audit.

| Collection | Primary config | Main writers/readers |
| --- | --- | --- |
| `students` | `studentAuthConfig` in `src/config/appConfig.js`; shared defaults in `functions/sharedConfig.json` | `studentService.js`, `authServices.js`, `timeLogService.js`, `firestore.js` |
| `tasks` | `taskConfig` in `src/config/appConfig.js` | `taskService.js`, `taskUtils.js`, schedule and check-in UI |
| `schedules` | `scheduleConfig` in `src/config/appConfig.js` | `scheduleService.js`, `validateSchedule.js`, `timeLogService.js` stale-session cleanup |
| `timeLogs` | `timeLogConfig` in `src/config/appConfig.js`; shared collection name in `functions/sharedConfig.json` | `timeLogService.js`, analytics hooks, student history hooks |
| `extraTimeRequests` | `extraTimeRequestConfig` in `src/config/appConfig.js`; shared collection name in `functions/sharedConfig.json` | `extraTimeRequestService.js` |

Security and deployment files:

| File | Role |
| --- | --- |
| `firestore.rules` | Browser access rules for coach, kiosk, and student accounts. |
| `firestore.indexes.json` | Firestore index definitions used by deployed queries. |
| `firebase.json` | Connects Firebase CLI deploys to rules, indexes, and Functions. |
| `functions/sharedConfig.json` | Values shared by frontend config and Cloud Functions. |

## Auth And Session Map

| Account type | Firebase Auth identity | App session behavior |
| --- | --- | --- |
| Coach | Normal email/password account listed in `coachEmails()` in `firestore.rules`. | Can access coach dashboard and manage roster, schedules, logs, requests, and analytics. |
| Kiosk | Dedicated email from `VITE_KIOSK_AUTH_EMAIL`; mirrored in `firestore.rules`. | Stays signed in on a shared device. Students select their profile by Student ID or NFC card. |
| Direct student | Generated email in the form `studentId@<student auth domain>`. | Uses Firebase Auth plus a tab-scoped `sessionStorage` student profile. |

Important auth files:

| File | Role |
| --- | --- |
| `src/features/auth/useAuth.jsx` | Combines Firebase's current user with the selected student session. |
| `src/features/auth/authServices.js` | Enforces coach, kiosk, and student login flow rules. |
| `src/services/auth.js` | Low-level Firebase Auth wrapper and student email generation. |
| `src/hooks/useStudentSession.js` | Stores selected student profile in `sessionStorage`; not a security boundary. |
| `src/services/adminFunctions.js` | Calls trusted credential-management Cloud Functions from the browser. |
| `functions/index.js` | Uses Firebase Admin SDK to update student login IDs and passwords. |

## UI Map

| Area | Files |
| --- | --- |
| Access and login | `src/pages/AccessPortal.jsx`, `src/pages/KioskStudentLogin.jsx` |
| Coach workspace | `src/pages/CoachDashboard.jsx`, `src/components/dashboard/*` |
| Student workspace | `src/pages/StudentDashboard.jsx`, `StudentCheckIn.jsx`, `StudentCheckOut.jsx` |
| Shared controls | `src/components/shared/Button.jsx`, `Dropdown.jsx`, `Input.jsx`, `CardMessage.jsx` |
| Theme and class helpers | `src/config/branding.js`, `src/styles/globals.css`, `src/styles/classNames.js` |

## Config And Change Map

| Change | Start here | Also check |
| --- | --- | --- |
| Rename/rebrand the app | `src/config/branding.js`, `index.html`, `public/assets/logo.png`, `public/favicon_io/` | `public/favicon_io/site.webmanifest` |
| Change route paths | `src/config/routesConfig.js` | `src/app/App.jsx`, `public/_redirects`, `vercel.json` |
| Change Firestore collection or field names | `functions/sharedConfig.json`, `src/config/appConfig.js` | `firestore.rules`, existing Firestore data, docs |
| Change student ID generation | `src/config/studentIdGenerator.js` | Student creation flow in `studentService.js` |
| Change coach emails, kiosk email, or student auth domain | `.env`, `functions/.env`, `functions/sharedConfig.json` | `src/config/appConfig.js`, `firestore.rules`, Firebase Auth users |
| Change dashboard styling | `src/styles/classNames.js`, `src/config/branding.js` | Route-level page classes and shared components |
| Add a new feature domain | `src/features/<domain>/` | Route/page entry points, Firestore rules, indexes, docs |

## Deployment And Tooling Map

| Area | Files |
| --- | --- |
| Frontend build | `package.json`, `package-lock.json`, `vite.config.js` |
| Automated checks | `.github/workflows/ci.yml`, `tests/` |
| Cloudflare demo deploy | `.github/workflows/cloudflare-pages-demo.yml`, `public/_redirects`, `docs/CLOUDFLARE_SETUP.md` |
| Firebase backend | `firebase.json`, `firestore.rules`, `firestore.indexes.json`, `functions/` |
| Cloudflare Pages | `public/_redirects`, `docs/CLOUDFLARE_SETUP.md` |
| Vercel | `vercel.json`, `docs/VERCEL_SETUP.md` |
| Firebase setup | `docs/FIREBASE_SETUP.md`, `functions/.env.example` |
| Licensing/commercial use | `LICENSE.md`, `docs/COMMERCIAL_USE.md`, README license section |

## Validation Map

Before shipping a code change, run the automated unit tests and checks
documented in `README.md`:

```powershell
npm.cmd test
npm.cmd run build
npm.cmd --prefix functions run check
```

For documentation-only changes, `git diff --check` is usually enough to catch
trailing whitespace and patch formatting issues.
