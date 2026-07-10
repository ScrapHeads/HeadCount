# Cloudflare Pages Setup

Cloudflare Pages is the preferred host for the HeadCount frontend. It hosts the
built React site only. Firebase still provides Authentication, Firestore,
Firestore Security Rules, and the optional Cloud Functions.

This repository also supports a Firebase-free demo deployment from the `demo`
branch. Use `npm run build:demo` for that demo site so Cloudflare publishes the
browser-local walkthrough instead of a Firebase-connected build.

For a Firebase-connected deployment, set up Firebase first with
[FIREBASE_SETUP.md](FIREBASE_SETUP.md), then use this guide for the website
deployment. For the public demo deployment, use the `demo` branch and
`npm run build:demo`; Firebase variables and Firebase domain authorization are
not required.

## 1. Connect The Repository

1. Open the [Cloudflare dashboard](https://dash.cloudflare.com/).
2. Open **Workers & Pages** and select **Create application**.
3. Choose **Pages**, connect to Git, and authorize access to GitHub if prompted.
4. Select the GitHub repository for this project.
5. Set the production branch and leave the root directory at the repository
   root:
   - Firebase-connected app: `main`
   - Firebase-free public demo: `demo`
6. Use these build settings:

| Setting | Value |
| --- | --- |
| Framework preset | Vite |
| Build command | `npm run build` for Firebase, or `npm run build:demo` for the public demo |
| Build output directory | `dist` |

Cloudflare normally fills in the Vite build command and output directory. If
the dashboard already shows these values, keep them. Dashboard labels may vary
slightly as Cloudflare updates the Pages interface.

## 2. Add Environment Variables For A Firebase Build

Before the first production deployment, copy and paste (as a group should work) every frontend variable from
`.env` to the Cloudflare Pages project's environment variables:

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

Add them to the **Production** environment and to **Preview** 
only if preview deployments should connect to Firebase. 
Depending on the Cloudflare dashboard version, these may
appear under **Settings > Environment variables** or **Variables and Secrets**.

Only add `VITE_*` variables to Cloudflare Pages. The optional `functions/.env`
values are part of the Firebase Cloud Functions setup in
[FIREBASE_SETUP.md](FIREBASE_SETUP.md#9-optional-configure-cloud-functions), not
the Cloudflare Pages project.

Vite reads these variables at build time. Redeploy the site after changing a
value so the new build contains it.

Skip these Firebase variables for the public demo deployment when the build
command is `npm run build:demo`. That build aliases Firebase imports to the
local demo backend and keeps all demo data in the visitor's browser.

## 3. Deploy The Site

1. Save the project and start the first deployment.
2. Wait for the install and build steps to finish.
3. Open the generated `.pages.dev` URL.

The repository includes `public/_redirects`. Vite copies it into `dist`, and
Cloudflare Pages uses it to send browser routes such as `/coach`, `/kiosk`, and
`/student` back to `index.html` for React Router.

Future pushes to `main` create production deployments automatically. Other
branches and pull requests can create preview deployments when previews are
enabled for the project.

For the `demo` branch, future pushes should create the public demo deployment
with `npm run build:demo`. This branch also includes
`.github/workflows/cloudflare-pages-demo.yml` for teams that prefer GitHub
Actions direct upload instead of Cloudflare's Git integration.

To use the GitHub Actions workflow, create a Cloudflare Pages project, then add
these GitHub repository settings:

| GitHub setting | Name | Value |
| --- | --- | --- |
| Secret | `CLOUDFLARE_API_TOKEN` | Cloudflare API token with Account > Cloudflare Pages > Edit permission |
| Secret | `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID |
| Variable | `CLOUDFLARE_PAGES_PROJECT_NAME` | Cloudflare Pages project name, such as `headcount-demo` |

After those values exist, pushing to `demo` runs tests, builds the demo, and
uploads `dist` to Cloudflare Pages.

## 4. Authorize The Cloudflare Domain In Firebase

Skip this section for the Firebase-free public demo.

Firebase Authentication blocks sign-in from unknown domains. After Cloudflare
creates the site URL:

1. Open the Firebase console.
2. Select the project used by this app.
3. Open **Build > Authentication > Settings**.
4. In **Authorized domains**, add the Cloudflare Pages domain, such as:

   ```text
   your-project.pages.dev
   ```

5. If you add a custom domain in Cloudflare Pages, add that domain to Firebase
   too.

If Preview deployments have Firebase environment variables, authorize the exact
preview domains the team plans to test. Otherwise, Firebase Authentication can
block sign-in even when the Cloudflare build succeeds.

## 5. Add A Custom Domain (Optional)

In the Cloudflare Pages project, open **Custom domains**, select **Set up a
custom domain**, and enter the domain or subdomain. Follow the dashboard prompts
to create or verify its DNS record. After the domain becomes active, add it to
Firebase Authentication's authorized domains as described above.

## 6. After Deployment

Use this quick checklist after each production deployment:

- The Cloudflare Pages deployment finished without build errors.
- Firebase-connected deployments have all required `VITE_*` environment
  variables.
- Firebase-connected `.pages.dev` or custom domains are listed in Firebase
  Authentication's authorized domains.
- Directly opening `/coach`, `/kiosk`, and `/student` does not return a 404.
- Coach, kiosk, and student sign-in flows were tested on the deployed site.
- A student can start and end a session, and the coach dashboard shows the log.
- Public demo deployments were built with `npm run build:demo` and show the
  demo entry buttons on the access portal.
