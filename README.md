# robotics-team-hours-tracker

Demo React + Vite app for tracking robotics team hours. The project is set up so teams can copy it and mostly rebrand it by editing a single file.

## Local Setup

Install dependencies:

```powershell
npm.cmd install
```

Start the development server:

```powershell
npm.cmd run dev
```

Create a production build:

```powershell
npm.cmd run build
```

## Styling

This project now uses Tailwind CSS v4 through the Vite plugin.

Main styling files:

- `src/styles/globals.css`: imports Tailwind and maps app CSS variables into Tailwind theme tokens.
- `src/config/branding.js`: the main branding file teams should edit.
- `src/components/shared/Button.jsx` and `src/components/shared/Input.jsx`: shared UI primitives using Tailwind utility classes.

## Rebranding

Teams should start in `src/config/branding.js`.

The most common values to change are:

- `appName`
- `tagline`
- `teamLabel`
- `theme.fontFamily`
- `theme.colors`

The `theme.colors` values are applied to CSS variables at startup, and Tailwind utilities reference those variables. That means teams can change the app colors without rewriting component class names.

## How The Theme Flow Works

1. `src/config/branding.js` defines the editable branding object.
2. `applyBrandingTheme()` writes branding values into CSS variables on the document root.
3. `src/main.jsx` runs `applyBrandingTheme()` before rendering the React app.
4. `src/styles/globals.css` exposes those CSS variables to Tailwind with `@theme inline`.
5. Components use Tailwind classes like `bg-primary`, `text-text`, and `border-border`, which automatically pick up the current branding values.

When extending the demo, keep new styling inside this system. Prefer theme-backed classes such as `bg-surface`, `text-onPrimary`, `border-border`, and `bg-surface-muted` over hardcoded hex colors, `rgba(...)`, or one-off literal color utilities.

## Firebase Auth Setup

Firebase config is read from `.env` through Vite environment variables in `src/services/firebase.js`.

Current authentication model:

- Coaches sign in with Firebase Authentication using email/password.
- Students sign in by entering a student ID that is checked against Firestore.
- Students in the `/access` portal sign in with both student ID and password from Firestore.
- Student sessions are stored in `sessionStorage` for the current browser tab.

Main auth files:

- `src/services/firebase.js`: Firebase app, Auth, and Firestore initialization.
- `src/services/auth.js`: coach sign-in and sign-out helpers.
- `src/services/firestore.js`: student lookup against Firestore.
- `src/features/auth/useAuth.jsx`: React auth context and shared session state.
- `src/config/appConfig.js`: configurable Firestore collection name, student ID field, and student password field.

## Firestore Student Collection

By default, student login checks the `students` collection.

It supports either of these shapes:

1. Document ID is the student ID.
2. Document contains a field named `studentId` matching the entered value.

Recommended student document shape:

```json
{
  "studentId": "12345",
  "password": "student-demo-password",
  "name": "Jane Doe",
  "active": true
}
```

If your Firestore schema uses a different collection name, student ID field, or student password field, change `src/config/appConfig.js`.

## Firestore Session Model

Student sign-in and sign-out now use two Firestore data shapes:

- `students`: current live session state for the student kiosk and coach dashboard.
- `timeLogs`: historical session records used for reporting and analytics.

Recommended live session fields on each student document:

```json
{
  "signedIn": false,
  "currentTask": null,
  "currentTaskId": null,
  "activeTimeLogId": null,
  "signedInAt": null
}
```

Recommended `timeLogs` document shape:

```json
{
  "studentDocId": "abc123",
  "studentId": "12345",
  "studentName": "Jane Doe",
  "taskId": "cad",
  "taskName": "CAD",
  "signInAt": "Firestore Timestamp",
  "signOutAt": null,
  "signInNotes": "Finish drivetrain plate layout",
  "signOutNotes": null,
  "status": "active",
  "durationMinutes": null,
  "createdAt": "Firestore Timestamp",
  "updatedAt": "Firestore Timestamp"
}
```

Implementation notes:

- `currentTaskId` is the stable reference and should be preferred over task name matching.
- `currentTask` is still kept as a readable snapshot for simpler displays and backwards compatibility.
- Sign-in and sign-out are written as Firestore batches so the student live state and historical time log stay in sync.
- `signedInAt` should be a Firestore timestamp while a session is active and `null` when it is not.

## Notes For Teams

- If a team only wants new colors and text, they should not need to touch the page layout files.
- The coach dashboard is intentionally a shell with `Home`, `Schedule`, and `Analytics` sections so teams can drop in their own Firestore-powered panels without rebuilding the layout.
- Shared UI code now lives under `src/components`.
