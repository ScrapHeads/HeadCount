# HeadCount

HeadCount is a React and Firebase application for recording team hours. Students can
check in through a kiosk or their own login, while coaches manage the roster,
schedules, time logs, extra-time requests, and attendance analytics.

## License

HeadCount is free for nonprofit robotics teams, school robotics programs, and educational use.

Commercial use is not allowed without written permission. Companies, vendors, consultants, or other commercial entities may not sell, host, rebrand, bundle, or commercially distribute this app without contacting ScrapHeads Robotics for a separate license.

See [LICENSE.md](LICENSE.md) for the complete terms.

## Hosting Note

Cloudflare Pages is the preferred frontend host for this project, with Firebase
handling Authentication, Firestore, Security Rules, and optional Cloud
Functions. Start with the Firebase guide
[docs/FIREBASE_SETUP.md](docs/FIREBASE_SETUP.md), then follow the preferred
[Cloudflare Pages setup guide](docs/CLOUDFLARE_SETUP.md) to publish the site.

Vercel remains supported as an alternative through
[docs/VERCEL_SETUP.md](docs/VERCEL_SETUP.md). Review Vercel's current plan terms
if multiple team members need to deploy from a private repository.

## Live Demo

Try the hosted HeadCount demo here:
[headcount-01c.pages.dev](https://headcount-01c.pages.dev)

The demo is a separate exploratory deployment and may not match the current
repository revision exactly. Do not enter real student information. A normal
deployment of this repository uses Firebase and must follow the setup guides
below; the demo is not a substitute for configuring Authentication, Firestore,
rules, indexes, and hosting.

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
- Cloudflare Pages hosting (preferred)
- Vercel hosting (alternative)

## Before You Start

Install these tools:

- [Node.js](https://nodejs.org/) 20.19 or newer, or 22.12 or newer
- npm, which is included with Node.js
- Java 21, only when running the Firestore rules tests locally

Create these accounts and projects:

- A Firebase project
- A Cloudflare account for the preferred frontend hosting option
- Alternatively, a Vercel account if the team chooses Vercel instead

Cloud Functions in this repository use Node.js 20, but deploying them is
optional. The main application works without Functions; coaches must then
change student IDs and passwords manually in Firebase. Deploying
second-generation Cloud Functions requires the Firebase Blaze plan with billing
enabled.

## Copy This Repository

Before local setup, copy this project into a repository owned by your team. Create an empty GitHub repository first. Do **not** initialize it with a README, license, or `.gitignore`, because those files already exist in this project.

### Recommended: Keep This Project as Upstream

This method lets your team pull future updates from the original HeadCount project while using your own repository for deployment and team changes.

Clone this project:

```bash
```md
git clone https://github.com/ScrapHeads/HeadCount.git HeadCount
cd HeadCount
```
```

Rename the original project remote to `upstream`:

```bash
git remote rename origin upstream
```

Connect your team’s GitHub repository as `origin`:

```bash
git remote add origin https://github.com/YOUR-ACCOUNT/YOUR-REPO.git
```

Push the project to your team’s repository:

```bash
git push -u origin main
```

After the push, use your new GitHub repository for frontend hosting and Firebase
setup.

### Alternative: Use Your Team Repository Only

If you do not want to keep a connection to the original project, clone this project and then replace the remote URL:

```bash
git clone https://github.com/ScrapHeads/HeadCount.git HeadCount
cd HeadCount
git remote set-url origin https://github.com/YOUR-ACCOUNT/YOUR-REPO.git
git push -u origin main
```

With this method, your repository will not keep an `upstream` remote for pulling future updates from the original project.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm run build` | Create a production frontend build |
| `npm run preview` | Preview the production build locally |
| `npm test` | Run the automated unit tests |
| `npm run test:rules` | Run Firestore Security Rules tests in the local emulator |
| `npm --prefix functions run check` | Check optional Cloud Function JavaScript syntax |

Run the automated tests, Firestore rules tests, production build, and Functions
syntax check before deploying changes. The same checks run in GitHub Actions through
`.github/workflows/ci.yml`.

## Firebase-Free Demo Mode

This branch can run a walkthrough build without Firebase by using demo mode:

```powershell
npm run dev:demo
```

Demo mode also activates when `VITE_DEMO_MODE=true`. It replaces the Firebase
browser SDK imports with local mocks, seeds realistic team data into
`localStorage`, and shows demo entry buttons on the access portal. Demo data is
stored only in the visitor's browser. Use **Reset demo data** on the access
portal to reseed a clean walkthrough.

Normal Firebase mode remains the default. Use `npm run dev` or
`npm run build` with real `VITE_FIREBASE_*` values to run against Firebase.

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

These files connect the copied project to the team's own Firebase and frontend
hosting setup:

| File | Purpose |
| --- | --- |
| `.env` | Frontend Firebase and kiosk settings |
| `functions/.env` | Optional Function coach allowlist and student login domain |
| `firestore.rules` | Browser access allowlists for coach and kiosk emails |
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
that Cloudflare Pages still publishes `public/_redirects`, so direct page
reloads keep working. If using the alternative Vercel path, also keep
`vercel.json` aligned with the routes.

### Advanced Data And Security Settings

These files are more critical because they affect the Firestore data model,
student logins, or browser permissions:

| File | Purpose |
| --- | --- |
| `functions/sharedConfig.json` | Values shared by the frontend and Cloud Functions |
| `src/config/appConfig.js` | Frontend-only Firestore field names, task settings, and status labels |
| `firestore.rules` | Browser permissions for Firestore data |
| `firebase.json` | Firebase deploy targets for Functions, rules, and indexes |
| `public/_redirects` | Cloudflare Pages fallback for client-side React routes |
| `vercel.json` | Vercel rewrite for client-side React routes |
| `vite.config.js` | Vite plugins for React and Tailwind CSS |

Changes to collection names, student ID fields, the student authentication
domain, or password requirements should begin in
`functions/sharedConfig.json`. Review `src/config/appConfig.js` and
`firestore.rules` at the same time because rules cannot import the JSON file.

Changes to coach emails, the kiosk email, or the student login domain must also
be reflected in `.env`, `functions/.env` if Functions are enabled, and
`firestore.rules`. In `firestore.rules`, update both `coachEmails()` and
`kioskEmail()` before deploying rules for a team.

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

- Coaches use normal Firebase email and password accounts. Browser coach access
  is limited to the addresses listed in `coachEmails()` in `firestore.rules`.
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

For a deeper contributor-oriented map of routes, features, data boundaries, and
common change points, see [docs/REPOSITORY_MAP.md](docs/REPOSITORY_MAP.md).

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
  CLOUDFLARE_SETUP.md    Preferred frontend hosting guide for Cloudflare Pages
  FIREBASE_SETUP.md     Complete Firebase setup and deployment guide
  VERCEL_SETUP.md       Alternative frontend hosting guide for Vercel
firebase.json           Firebase deploy targets for Functions, rules, and indexes
firestore.rules         Browser permissions for Firestore data
firestore.indexes.json  Firestore index definitions
public/_redirects       Cloudflare Pages fallback for client-side React routes
vercel.json             Vercel rewrite for client-side React routes
vite.config.js          Vite, React, and Tailwind build configuration
```

## Deployment

Cloudflare Pages is the preferred frontend host. Follow
[docs/CLOUDFLARE_SETUP.md](docs/CLOUDFLARE_SETUP.md) to connect the repository,
add the `VITE_*` environment variables, authorize the Cloudflare domain in
Firebase, and deploy the site. `public/_redirects` provides the fallback needed
for client-side routes.

For the public demo, deploy the `demo` branch to Cloudflare Pages with
`npm run build:demo`.

Vercel remains available as an alternative. Follow
[docs/VERCEL_SETUP.md](docs/VERCEL_SETUP.md); its existing `vercel.json` route
rewrite remains in place. Teams using private repositories should confirm that
their Vercel plan supports the required collaborators.

Deploy the database rules and indexes:

```powershell
npx firebase-tools deploy --only "firestore:rules,firestore:indexes"
```

If you enabled the optional credential-management Function, include it:

```powershell
npx firebase-tools deploy --only "functions,firestore:rules,firestore:indexes"
```

Always confirm the selected Firebase project first. This repository's
`.firebaserc` contains a demo project ID that should not be used for another
team's production deployment.

## Security Notes

The included Firestore rules recognize students and the kiosk by email pattern,
and they allow browser coach access only for emails listed in `coachEmails()`
in `firestore.rules`. Replace the placeholder coach email and keep this list
aligned with your real Firebase Authentication coach accounts before deploying.

When enabled, the credential-management Function is stricter: it requires
either the `coach: true` custom claim or an email listed in `COACH_EMAILS`.
Keep `COACH_EMAILS` aligned with `coachEmails()` when Functions are enabled.

See [docs/FIREBASE_SETUP.md](docs/FIREBASE_SETUP.md) for the exact values that
must stay synchronized and a deployment verification checklist.
