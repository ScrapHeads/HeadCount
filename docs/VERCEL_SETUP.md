# Vercel Setup

This guide deploys the Robotics Team Hours Tracker frontend to Vercel. Vercel
hosts the React site only. Firebase still provides Authentication, Firestore,
Firestore Security Rules, and the optional Cloud Functions.

Set up Firebase first with [FIREBASE_SETUP.md](FIREBASE_SETUP.md), then use this
guide for the website deployment.

> **Organization hosting:** If this Vercel project is owned by an organization,
> the organization must use a Vercel Pro account.

## 1. Connect The Repository

1. Open the [Vercel dashboard](https://vercel.com/dashboard).
2. Select **Add New > Project**.
3. Import the GitHub repository for this project.
4. Leave **Root Directory** as the repository root.
5. Use these project settings:

| Setting | Value |
| --- | --- |
| Framework Preset | Vite |
| Install Command | `npm install` |
| Build Command | `npm run build` |
| Output Directory | `dist` |

Vercel normally detects Vite automatically. If the settings are already filled
in with these values, keep the defaults.

## 2. Add Environment Variables

Open the Vercel project settings and add every frontend variable from
`.env.example`:

```dotenv
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_KIOSK_AUTH_EMAIL="kiosk@myapp.internal"
VITE_STUDENT_AUTH_EMAIL_DOMAIN="myapp.internal"
```

Use the same values that work in the local `.env` file. Add them for
**Production** and any **Preview** environments that should connect to Firebase.
You can import your local `.env` file into Vercel instead of creating the
variables one at a time.

Only add Firebase-connected values to Preview environments if the team plans to
test preview deployments. Each preview domain that uses Firebase Authentication
also needs to be authorized in Firebase.

Only add `VITE_*` variables to Vercel. The optional `functions/.env` values are
part of the Firebase Cloud Functions setup in
[FIREBASE_SETUP.md](FIREBASE_SETUP.md#9-optional-configure-cloud-functions),
not the Vercel project settings.

## 3. Deploy The Site

1. Select **Deploy** in Vercel.
2. Wait for the build to finish.
3. Open the generated `.vercel.app` URL.

The repository already includes `vercel.json`, which sends all browser routes
back to `index.html`. This is required because React Router handles routes such
as `/coach`, `/kiosk`, and `/student` in the browser.

## 4. Authorize The Vercel Domain In Firebase

Firebase Authentication blocks sign-in from unknown domains. After Vercel
creates the site URL:

1. Open the Firebase console.
2. Select the project used by this app.
3. Open **Build > Authentication > Settings**.
4. In **Authorized domains**, add the Vercel domain, such as:

   ```text
   your-project.vercel.app
   ```

5. If you add a custom domain in Vercel, add that domain to Firebase too.

If Preview deployments have Firebase environment variables, add the exact
preview domains you plan to test with. Otherwise, Firebase Authentication can
block sign-in even when the Vercel build succeeds.

## 5. Deploy Firebase Rules And Optional Functions

Vercel does not deploy Firestore rules, indexes, or Cloud Functions. Deploy
those with the Firebase CLI from this repository.

For the main app:

```powershell
npx.cmd firebase-tools deploy --only "firestore:rules,firestore:indexes"
```

If the optional student credential-management Function is enabled:

```powershell
npx.cmd firebase-tools deploy --only "functions,firestore:rules,firestore:indexes"
```

Always confirm the selected Firebase project before deploying. The repository's
`.firebaserc` contains a demo project ID that should not be used for another
team's production deployment.

## 6. After Deployment

Use this quick checklist after each production deployment:

- The Vercel deployment finished without build errors.
- The Vercel project has all required `VITE_*` environment variables.
- The Vercel domain is listed in Firebase Authentication authorized domains.
- Firestore rules and indexes were deployed to the same Firebase project.
- Coach, kiosk, and student sign-in flows were tested on the deployed site.
- A student can start and end a session, and the coach dashboard shows the log.

If environment variables change in Vercel, redeploy the site. Vite reads those
values during the build, so an existing deployment will not update until it is
built again.
