# Robotics Team Hours Tracker

A React and Firebase application for recording robotics team hours. Students can
check in through a kiosk or their own login, while coaches manage the roster,
schedules, time logs, extra-time requests, and attendance analytics.

## Hosting Note

This project is intended to be hosted on Vercel for the frontend, with Firebase
handling Authentication, Firestore, Security Rules, and optional Cloud
Functions. Start with the Firebase guide
[docs/FIREBASE_SETUP.md](docs/FIREBASE_SETUP.md), then follow
[docs/VERCEL_SETUP.md](docs/VERCEL_SETUP.md) to publish the site.

## Features

- Coach, kiosk, and student sign-in flows
- Student ID, password, and optional NFC card lookup
- Live check-in and check-out with required session notes
- One-time, weekly, monthly, and yearly schedules
- Coach roster and student account management
- Manual extra hours and student extra-time requests
- Editable time-log history
- Team hours, task category, and attendance analytics
- Centralized colors, text, routes, and Firestore field configuration

## Technology

- React 19
- Vite 8
- Tailwind CSS 4
- Firebase Authentication
- Cloud Firestore
- Cloud Functions for Firebase (optional)
- Vercel hosting

## Before You Start

Install these tools:

- [Node.js](https://nodejs.org/) 20 or newer
- npm, which is included with Node.js

Create these accounts and projects:

- A Firebase project
- A Vercel account for hosting the frontend

Cloud Functions in this repository use Node.js 20, but deploying them is
optional. The main application works without Functions; coaches must then
change student IDs and passwords manually in Firebase. Deploying
second-generation Cloud Functions requires the Firebase Blaze plan with billing
enabled.

## Local Setup

1. Install the frontend dependencies:

   ```powershell
   npm.cmd install
   ```

2. Create the frontend environment file:

   ```powershell
   Copy-Item .env.example .env
   ```

3. Complete the Authentication, Firestore, rules, and optional Functions setup in
   [docs/FIREBASE_SETUP.md](docs/FIREBASE_SETUP.md).

4. Add your Firebase web app values to `.env`.

5. Start the development server:

   ```powershell
   npm.cmd run dev
   ```

Vite prints the local URL in the terminal. The access portal is the root page,
and it links users into the coach, kiosk, or student flow.

## Commands

| Command | Purpose |
| --- | --- |
| `npm.cmd run dev` | Start the Vite development server |
| `npm.cmd run build` | Create a production frontend build |
| `npm.cmd run preview` | Preview the production build locally |
| `npm.cmd --prefix functions run check` | Check optional Cloud Function JavaScript syntax |

There is currently no automated test suite. Run the production build and
Functions syntax check before deploying changes.

## Configuration

Most teams only need the first two groups. The later groups are for deeper
changes where several files must stay in sync.

### Common Rebranding

These are the safest files to edit when adapting the project for a new team:

| File or folder | Purpose |
| --- | --- |
| `src/config/branding.js` | App name, team text, fonts, and theme colors |
| `index.html` | Page title, browser metadata, social preview text, and asset links |
| `public/assets/logo.png` | Social preview logo used by `index.html` |
| `public/favicon_io/` | Browser tab icons, mobile icons, and web app manifest |

If you keep the same public asset paths, rebranding usually only requires
replacing the image files. If you rename or move them, also update `index.html`
and `public/favicon_io/site.webmanifest`.

### Required Environment Setup

These files connect the copied project to the team's own Firebase and Vercel
setup:

| File | Purpose |
| --- | --- |
| `.env` | Frontend Firebase and kiosk settings |
| `functions/.env` | Optional Function coach allowlist and student login domain |
| `.firebaserc` | Default Firebase project alias used by Firebase CLI commands |

Do not commit `.env` or `functions/.env`. Always confirm the Firebase project
before deploying because `.firebaserc` may still point at the demo project until
the team changes it.

### Team Workflow Choices

Edit these when the team wants to change how the app behaves, not just how it
looks:

| File | Purpose |
| --- | --- |
| `src/config/studentIdGenerator.js` | Automatically generated student ID format |
| `src/config/routesConfig.js` | Browser route paths |

Route changes are low-risk when all links continue to use `ROUTES`, but confirm
that Vercel still uses `vercel.json` so direct page reloads keep working.

### Advanced Data And Security Settings

These files are more critical because they affect the Firestore data model,
student logins, or browser permissions:

| File | Purpose |
| --- | --- |
| `functions/sharedConfig.json` | Values shared by the frontend and Cloud Functions |
| `src/config/appConfig.js` | Frontend-only Firestore field names, task settings, and status labels |
| `firestore.rules` | Browser permissions for Firestore data |
| `firebase.json` | Firebase deploy targets for Functions, rules, and indexes |
| `vercel.json` | Vercel rewrite for client-side React routes |
| `vite.config.js` | Vite plugins for React and Tailwind CSS |

Changes to collection names, student ID fields, the student authentication
domain, or password requirements should begin in
`functions/sharedConfig.json`. Review `src/config/appConfig.js` and
`firestore.rules` at the same time because rules cannot import the JSON file.

Changes to the kiosk email or student login domain must also be reflected in
`.env`, `functions/.env` if Functions are enabled, and `firestore.rules`.

## Branding And Styling

Start rebranding in `src/config/branding.js`. The theme is applied in this order:

1. `branding.js` defines the editable theme.
2. `applyBrandingTheme()` writes values to CSS variables.
3. `src/main.jsx` applies the theme before React renders.
4. `src/styles/globals.css` exposes the variables as Tailwind theme tokens.
5. Components use classes such as `bg-primary`, `text-on-primary`, and
   `border-border`.

## Public Assets

The browser tab icons and social preview image live in `public/`:

| File or folder | Purpose |
| --- | --- |
| `public/assets/logo.png` | Logo used by the social preview tags in `index.html` |
| `public/favicon_io/` | Browser favicon, Apple touch icon, Android icons, and web app manifest |

Replace these files when rebranding the app. Keep the same paths unless you also
update the matching links in `index.html` and `public/favicon_io/site.webmanifest`.

## Authentication And Sessions

- Coaches use normal Firebase email and password accounts.
- A kiosk uses one dedicated Firebase account and selects students by ID or NFC
  card. The kiosk Firebase user remains signed in between students.
- Direct student logins turn a student ID into an internal email such as
  `12345@myapp.internal`. These addresses are identifiers and do not need inboxes.
- The selected student profile is stored in `sessionStorage` for the current
  browser tab. Firebase Authentication and Firestore Security Rules provide the
  actual access control.
- Student sign-in and sign-out update the live student record and historical
  time log in one Firestore batch.

Student ID changes and password resets can use the optional callable function in
`functions/index.js`. Browser code does not receive Firebase Admin access. If
the Function is not deployed, use the manual credential instructions in
[docs/FIREBASE_SETUP.md](docs/FIREBASE_SETUP.md#manual-student-credential-changes-without-functions).
When an ID changes, the old value is added to the student's
`previousStudentId` array. Historical logs remain unchanged and are matched
using the stable student document ID or that ID history.

## Project Structure

```text
src/
  app/                  App providers and route definitions
  components/           Shared controls and dashboard sections
  config/               Branding, routes, IDs, and data field names
  features/             Authentication and feature-specific services/hooks
  hooks/                Reusable React hooks
  lib/                  Date, analytics, validation, and student helpers
  pages/                Route-level screens
  services/             Firebase initialization and shared service wrappers
  styles/               Tailwind setup and shared class names
public/
  assets/               Logo and public images
  favicon_io/           Browser and mobile app icons
functions/
  index.js              Optional trusted student credential management
  sharedConfig.json     Frontend/backend shared defaults
docs/
  FIREBASE_SETUP.md     Complete Firebase setup and deployment guide
  VERCEL_SETUP.md       Frontend hosting guide for Vercel
firebase.json           Firebase deploy targets for Functions, rules, and indexes
firestore.rules         Browser permissions for Firestore data
firestore.indexes.json  Firestore index definitions
vercel.json             Vercel rewrite for client-side React routes
vite.config.js          Vite, React, and Tailwind build configuration
```

## Deployment

The frontend is hosted through Vercel. Follow
[docs/VERCEL_SETUP.md](docs/VERCEL_SETUP.md) to connect the repository, add the
`VITE_*` environment variables, authorize the Vercel domain in Firebase, and
deploy the site. `vercel.json` includes the rewrite needed for client-side
routes.

Deploy the database rules and indexes:

```powershell
npx.cmd firebase-tools deploy --only "firestore:rules,firestore:indexes"
```

If you enabled the optional credential-management Function, include it:

```powershell
npx.cmd firebase-tools deploy --only "functions,firestore:rules,firestore:indexes"
```

Always confirm the selected Firebase project first. This repository's
`.firebaserc` contains a demo project ID that should not be used for another
team's production deployment.

## Security Notes

The included Firestore rules recognize students and the kiosk by email pattern.
Any other signed-in Firebase user is currently treated as a coach for browser
Firestore access. Limit who can create Authentication users, and consider a
`coach: true` custom claim check before using the app with sensitive data.

When enabled, the credential-management Function is stricter: it requires
either the `coach: true` custom claim or an email listed in `COACH_EMAILS`.

See [docs/FIREBASE_SETUP.md](docs/FIREBASE_SETUP.md) for the exact values that
must stay synchronized and a deployment verification checklist.
