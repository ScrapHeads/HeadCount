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
- The main student kiosk signs in once with the configured Firebase Authentication email in `VITE_KIOSK_AUTH_EMAIL`, then students use either their student ID or assigned NFC card for the sign-in/out form.
- Students can still sign in with a student ID and password from the access portal. The app turns the student ID into a generated Firebase Authentication email.
- Student passwords live only in Firebase Authentication. Firestore stores the student ID and profile/session fields.
- Student sessions are stored in `sessionStorage` for the current browser tab.

Main auth files:

- `src/services/firebase.js`: Firebase app, Auth, and Firestore initialization.
- `src/services/auth.js`: coach, kiosk, and student auth helpers.
- `src/services/firestore.js`: student lookup against Firestore.
- `src/features/auth/useAuth.jsx`: React auth context and shared session state.
- `src/config/appConfig.js`: configurable Firestore collection name, student ID field, and roster/session fields.
- `src/config/studentIdGenerator.js`: team-editable automatic student ID format.

## Automatic Student IDs

The coach student-creation form includes a **Generate ID** button. By default, it combines the current year with a random number from `10` through `99`. For example, an ID generated in 2026 could be `202647`.

Before returning an ID, the app checks Firestore to confirm that it is not already used as either a student ID or an NFC card ID. Student creation performs the uniqueness check again before saving.

Teams can change the generated format by editing `generateUniqueStudentId()` in `src/config/studentIdGenerator.js`. Keep the `isAvailable(candidateId)` check in the function so customized IDs remain unique.

## Firestore Student Collection

By default, student login checks the `students` collection.

It supports either of these shapes:

1. Document ID is the student ID.
2. Document contains a field named `studentId` matching the entered value.

Recommended student document shape:

```json
{
  "studentId": "12345",
  "nfcCardId": null,
  "name": "Jane Doe",
  "currentMember": true,
  "signedIn": false,
  "currentTask": null,
  "currentTaskId": null,
  "activeTimeLogId": null,
  "signedInAt": null
}
```

If your Firestore schema uses a different collection name or student ID field, change `src/config/appConfig.js`.

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

## Firestore Security Rules

This repo includes Firebase CLI config and Firestore rules:

- `firebase.json`
- `firestore.rules`
- `firestore.indexes.json`

Before deploying the rules, update the `kioskEmail()` value in `firestore.rules` so it exactly matches `VITE_KIOSK_AUTH_EMAIL` from your `.env`.

The default rules assume this authentication model:

- Coaches are signed-in Firebase Auth users whose email is not the kiosk email and does not end in `@myapp.internal`.
- The kiosk is the single signed-in Firebase Auth user matching `kioskEmail()`.
- Student Auth accounts use generated emails like `12345@myapp.internal`.

Deploy the rules with the Firebase CLI:

```powershell
firebase deploy --only firestore:rules
```

Important security note: with the current client-only app, any signed-in non-student, non-kiosk Firebase Auth user is treated as a coach by the rules. For a stricter production setup, use Firebase custom claims such as `coach: true` and update `isCoach()` to check that claim instead of using email shape.

## Notes For Teams

- If a team only wants new colors and text, they should not need to touch the page layout files.
- The coach dashboard is intentionally a shell with `Home`, `Schedule`, and `Analytics` sections so teams can drop in their own Firestore-powered panels without rebuilding the layout.
- Shared UI code now lives under `src/components`.
