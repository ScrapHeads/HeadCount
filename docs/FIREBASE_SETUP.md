# Firebase Setup

This guide configures Firebase Authentication, Cloud Firestore, Cloud
Functions, and Firestore Security Rules for HeadCount.
It is written for a new Firebase project.

Complete sections 1-8 and 10 for the core application. Section 9 is required
only when coaches need to change student IDs or passwords from the dashboard.
After Firebase is configured, follow the
[Cloudflare Pages](CLOUDFLARE_SETUP.md) or [Vercel](VERCEL_SETUP.md) guide to
publish the frontend and add the same `VITE_*` values to that host.

## Before You Begin

Install Node.js 20.19 or newer (or Node.js 22.12 or newer), clone the
repository, and run this command from the repository root:

```powershell
npm.cmd install
```

Install Java 21 if you plan to run the local Firestore Security Rules
tests. Java is not required to build or run the frontend.

The Firebase CLI commands below use `npx`, so a separate global CLI install is
not required. Run every command from the repository root unless a step says
otherwise.

## Services Used

The application uses:

- **Firebase Authentication** for coach, kiosk, and student credentials
- **Cloud Firestore** for students, tasks, schedules, time logs, and requests
- **Cloud Functions (optional)** for student ID changes and password resets

Official Firebase references:

- [Add Firebase to a web app](https://firebase.google.com/docs/web/setup)
- [Email and password authentication](https://firebase.google.com/docs/auth/web/password-auth)
- [Firebase CLI](https://firebase.google.com/docs/cli)
- [Cloud Functions environment configuration](https://firebase.google.com/docs/functions/config-env)
- [Firebase pricing plans](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans)
- [Google Cloud budgets and alerts](https://cloud.google.com/billing/docs/how-to/budgets)
- [Firebase Authentication user management](https://firebase.google.com/docs/auth/admin/manage-users)

## 1. Create A Firebase Project

1. Open the [Firebase console](https://console.firebase.google.com/).
2. Create a project or select an existing project.
3. Open **Project settings**.
4. Under **Your apps**, register a web app. Firebase Hosting is not required;
   do not enable it unless the team has intentionally chosen it instead of the
   documented Cloudflare Pages or Vercel options.
5. Keep the displayed Firebase configuration available for the next step.

The main application does not require Cloud Functions. Functions are used only
to let coaches change student IDs and passwords from inside the dashboard.

## 2. Configure The Frontend Environment

Create the local file:

```powershell
Copy-Item .env.example .env
```

Fill in the values from the Firebase web app:

```dotenv
VITE_DEMO_MODE=false
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
VITE_KIOSK_AUTH_EMAIL="kiosk@myapp.internal"
VITE_STUDENT_AUTH_EMAIL_DOMAIN="myapp.internal"
```

Vite only exposes variables beginning with `VITE_` to browser code. Keep
`VITE_DEMO_MODE=false` for a Firebase-connected app. Firebase web
configuration identifies the project but is not a secret. Security still
depends on Authentication and Firestore Security Rules.

Do not commit `.env`.

## 3. Enable Email And Password Authentication

In the Firebase console:

1. Open **Security > Authentication**.
2. Select **Get started** if Authentication is not initialized.
3. Open **Sign-in method**.
4. Enable **Email/Password**.

The coach dashboard creates student Authentication accounts with Firebase's
Web SDK. In **Authentication > Settings > User actions**, leave end-user account
creation and deletion enabled. Creation is required for **Create Student**;
deletion lets the app remove a newly created Authentication account if its
matching Firestore profile cannot be saved. Disabling either action can produce
`auth/admin-restricted-operation` or leave an unmatched account after a failed
student creation.

### Authorize Application Domains

In **Authentication > Settings > Authorized domains**:

1. Add `localhost` if the application will be run locally. Firebase projects
   created after April 28, 2025 do not include it automatically.
2. After choosing a frontend host, add each exact production domain that will
   serve the app.
3. Add a preview domain only if that preview deployment contains real Firebase
   environment variables and is intended to access this project.

Do not include `https://`, a path, or a trailing slash. The Cloudflare and
Vercel setup guides contain host-specific examples. Restart the local Vite
server after changing `.env` values.

The default application password requirement is six characters, matching
`functions/sharedConfig.json`. If the Firebase project's password policy is
stricter, update the shared minimum so the UI gives users the correct message.

## 4. Create Cloud Firestore

In the Firebase console:

1. Open **Databases & Storage > Firestore**.
2. Select **Create database**.
3. Choose **Standard edition** and use the database ID `(default)`. The Web SDK
   and included Firebase configuration connect to the default database.
4. Select a database region appropriate for the team. This location cannot be
   changed after creation.
5. Start in **Production mode**. Its initial deny-all rules are temporary; you
   will deploy this repository's rules before using the app.

The application creates collection documents as they are needed. You do not
need to create empty collections manually.

The Cloud Function region is currently `us-central1` in `functions/index.js`.
Changing it requires updating both the function deployment region and the
frontend Functions client in `src/services/firebase.js`.

## 5. Keep Login Settings Synchronized

Student accounts use generated internal emails:

```text
student-id@student-domain
```

For example, student ID `12345` with the default domain becomes
`12345@myapp.internal`.

This project already defaults to `@myapp.internal`. Avoid changing it unless you
are also updating every synced setting below.

The following values must agree:

| Setting | Location |
| --- | --- |
| Frontend student domain | `VITE_STUDENT_AUTH_EMAIL_DOMAIN` in `.env` |
| Backend student domain | `STUDENT_AUTH_EMAIL_DOMAIN` in `functions/.env` |
| Shared default domain | `studentAuth.authEmailDomain` in `functions/sharedConfig.json` |
| Student email pattern | `isStudentAuth()` in `firestore.rules` |
| Kiosk email | `VITE_KIOSK_AUTH_EMAIL` in `.env` |
| Kiosk rules email | `kioskEmail()` in `firestore.rules` |
| Coach rules emails | `coachEmails()` in `firestore.rules` |

Before deploying, replace the example kiosk address, student-domain regular
expression, and coach allowlist in `firestore.rules` with the values selected
for this Firebase project. Leaving the example coach addresses unchanged will
let a coach authenticate but the dashboard's Firestore requests will be denied.

The internal student domain does not need working email or DNS. Use a consistent
domain-like value with no spaces.

When changing the domain, update the regular expression in `firestore.rules`.
For example, a domain of `team.internal` needs an escaped suffix similar to:

```text
.*@team\.internal$
```

## 6. Create Coach And Kiosk Accounts

In **Authentication > Users**, create:

1. At least one coach email/password user.
2. One kiosk email/password user matching `VITE_KIOSK_AUTH_EMAIL` exactly.

Add each coach Authentication email to `coachEmails()` in `firestore.rules`.
If Functions are enabled, also add the same coach emails to `COACH_EMAILS` in
`functions/.env`.

Do not manually create student accounts during normal use. The coach dashboard
creates each student's Authentication account and Firestore profile together.

The kiosk password is entered only when opening the kiosk. Store it using the
team's normal password-management process.

## 7. Select The Firebase CLI Project

From the repository root:

```powershell
npx.cmd firebase-tools login
npx.cmd firebase-tools use --add
```

Choose the correct Firebase project and assign an alias such as `default`.

Important: this repository's `.firebaserc` currently references
`robotics-time-tracker-demo`. Confirm the active project before every deploy:

```powershell
npx.cmd firebase-tools use
```

You can also pass a project explicitly:

```powershell
npx.cmd firebase-tools deploy --only firestore:rules --project your-project-id
```

## 8. Choose A Credential Management Method

The site works with either method:

1. **Optional Cloud Function:** Coaches can change student IDs and passwords
   from the dashboard. Continue to the next section.
2. **Manual management:** Keep the project on the no-cost Spark plan and make
   credential changes in the Firebase console. Skip section 9, deploy the rules
   and indexes in section 10, and use
   [Manual Student Credential Changes Without Functions](#manual-student-credential-changes-without-functions)
   whenever an existing student's ID or password must change.

Without the Function, coaches can still use the dashboard to create students,
change names, assign NFC cards, archive roster members, manage sessions, and
view analytics. Do not enter a new student ID or password in the dashboard's
Edit Student form unless the Function has been deployed.

## 9. Optional: Configure Cloud Functions

> **Billing required:** Deploying Cloud Functions requires upgrading the
> Firebase project to the pay-as-you-go Blaze plan. You can create a `$0.01`
> Google Cloud budget as an early cost alert, but budgets do **not** stop usage
> or cap charges. This small-team application is expected to stay within
> Firebase's no-cost usage quotas during normal use, but that cannot be
> guaranteed. Cloud Functions quotas reset monthly; some other Firebase quotas,
> including Firestore quotas, reset daily.

Install the backend dependencies:

```powershell
npm.cmd --prefix functions install
```

Create the backend environment file:

```powershell
Copy-Item functions\.env.example functions\.env
```

Edit `functions/.env`:

```dotenv
COACH_EMAILS=leadcoach@example.com,assistantcoach@example.com
STUDENT_AUTH_EMAIL_DOMAIN=myapp.internal
```

- `COACH_EMAILS` is a comma-separated allowlist for student ID changes and
  password resets. Keep it aligned with `coachEmails()` in `firestore.rules`.
- `STUDENT_AUTH_EMAIL_DOMAIN` must match the frontend and rules settings.
- A coach with a Firebase custom claim named `coach` set to `true` is also
  accepted by the callable function.

Do not commit `functions/.env`.

Set up a budget alert in **Google Cloud Console > Billing > Budgets & alerts**.
Select this Firebase project, enter the budget amount, and make sure notification
emails go to an account that the team monitors. A budget is an alerting tool,
not an automatic shutdown mechanism.

## 10. Deploy Firebase Resources

Check the project first:

```powershell
npx.cmd firebase-tools use
```

Always deploy the Firestore rules and indexes:

```powershell
npx.cmd firebase-tools deploy --only "firestore:rules,firestore:indexes"
```

If you completed the optional Functions setup, deploy all three resources:

```powershell
npx.cmd firebase-tools deploy --only "functions,firestore:rules,firestore:indexes"
```

The included `firestore.indexes.json` defines the composite `students` index
used by the live signed-in roster (`signedIn` plus `signedInAt`). Deploying the
indexes is required before that query can work reliably. Index creation can
take several minutes; wait until the Firebase console reports the index as
enabled. If Firestore later reports that another query needs an index, follow
the error link, create it, and export or add it to this file so future setups
remain reproducible.

## 11. Optional: Verify Function Permissions

Skip this section if Cloud Functions are not enabled.

Student ID changes and password resets use Firebase Admin Authentication.
If those actions fail while ordinary profile edits still work:

1. In the Firebase console, copy the Firebase **Project ID** from
   **Project settings > General**.
2. Open the [Google Cloud console](https://console.cloud.google.com/). This is
   separate from the Firebase console, even though it uses the same project.
3. Use the project picker at the top of Google Cloud Console to select the same
   Project ID.
4. Select **View all products**, then open **IAM & Admin > IAM**. If you do not
   see it, use the Google Cloud search bar and search for `IAM`.
5. Locate the service account used by the deployed second-generation function.
6. Confirm it has the **Firebase Authentication Admin** role. In Google Cloud,
   click the edit button and search **Firebase Authentication Admin**.

The runtime commonly uses the project's default Compute Engine service account
unless the deployment specifies a different account.

## Manual Student Credential Changes Without Functions

Use this process when the optional Cloud Function is not deployed. Student
accounts use generated internal Authentication emails in this format:

```text
student-id@student-domain
```

For example, student ID `12345` with the default domain uses
`12345@myapp.internal`.

### Change Only A Student Password

The default internal student email does not have a real inbox, so an emailed
password-reset link normally cannot be received. The simplest console-only
method is to recreate the Authentication account:

1. Open **Firebase Console > Authentication > Users**.
2. Find the user whose email matches the student's generated email.
3. Delete that Authentication user.
4. Select **Add user**.
5. Enter the exact same generated email and a known or new password.
6. Test the student's direct login.

Deleting and recreating the Authentication user changes its Firebase UID and
signs out existing direct-login sessions. This project links student data by
the generated email, student ID, and Firestore document ID rather than by the
Firebase UID, so no Firestore changes are needed for a password-only reset.

### Change A Student ID

Changing the student ID also changes the generated Authentication email. Old
IDs are stored in the student's `previousStudentId` array, so historical logs
do not need to be edited:

1. Open **Firestore > Data > students** and find the student.
2. Record the current `studentId`.
3. Confirm the new ID is not used in another student's `studentId`,
   `nfcCardId`, or `previousStudentId` array.
4. Open **Authentication > Users** and delete the old generated-email account.
5. Select **Add user** and create an account using the new generated email and
   a known or new password. Firebase does not reveal the old password.
6. Return to the same student document in Firestore.
7. Change `studentId` to the new ID.
8. Add the old ID to `previousStudentId`, preserving any IDs already in the
   array. Every value in this field should be a string.
9. If the new ID was already in this student's `previousStudentId` array,
   remove it because it is now the current ID.
10. Test the student's direct login and confirm their previous timeline and
    analytics still include records created under the old ID.

Do not edit documents in `timeLogs` or `extraTimeRequests`. The app first
matches records by the stable `studentDocId`. For older or imported records
without that field, it compares their stored `studentId` with the current
`studentId` and every string in `previousStudentId`.

If the old Authentication user was deleted but the new account cannot be
created, recreate the old account first so the student is not locked out while
the conflict is investigated.

When the optional Function is enabled, the coach dashboard performs these same
steps automatically: it changes the Authentication email, sets the new
`studentId`, and appends the replaced ID to `previousStudentId`.

## Firestore Data Model

### `students`

Stores the roster profile and the student's current live session:

```json
{
  "studentId": "12345",
  "previousStudentId": [],
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

The Firestore document ID does not have to equal the student ID. New records
created by the coach dashboard use an automatically generated document ID and
start with an empty `previousStudentId` array.

After changing an ID more than once, a profile could look like:

```json
{
  "studentId": "202603",
  "previousStudentId": ["202601", "202602"]
}
```

Do not reuse a previous ID for a different student. The application treats all
IDs in this array as belonging to the same student when matching older records.

### `tasks`

Stores work categories available for sessions:

```json
{
  "name": "CAD",
  "scheduled": false
}
```

Unscheduled tasks are always available. Scheduled tasks are available only
during an active schedule occurrence.

To create an unscheduled task manually, open Firestore and create a `tasks`
document using the structure above with `scheduled` set to `false`. Students can
select unscheduled tasks at any time.

### `schedules`

Stores one-time or recurring availability windows:

```json
{
  "taskId": "task-document-id",
  "isRecurring": true,
  "recurrenceType": "weekly",
  "dayOfWeek": 1,
  "dayOfMonth": null,
  "monthOfYear": null,
  "startTime": "Firestore Timestamp",
  "endTime": "Firestore Timestamp",
  "countsForAttendance": true
}
```

For recurring schedules, the timestamps provide the time of day and duration.
The recurrence fields choose the calendar occurrence.

### `timeLogs`

Stores historical sessions and manually granted hours:

```json
{
  "studentDocId": "student-document-id",
  "studentId": "12345",
  "studentName": "Jane Doe",
  "taskId": "task-document-id",
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

Student and task names are stored as snapshots so old reports stay readable
after a profile or task is renamed.

### `extraTimeRequests`

Stores requests submitted by students:

```json
{
  "studentDocId": "student-document-id",
  "studentId": "12345",
  "studentName": "Jane Doe",
  "durationMinutes": 90,
  "reason": "Worked at an off-site event",
  "status": "pending",
  "requestedAt": "Firestore Timestamp",
  "reviewedAt": null,
  "reviewedBy": null
}
```

Approving a request creates a completed time log and marks the request approved
in one Firestore transaction.

## Security Model

The provided rules assume:

- The kiosk is the exact account returned by `kioskEmail()`.
- Student accounts end with the configured internal student domain.
- Coach accounts are explicitly listed in `coachEmails()`.
- Students can update only their live session fields.
- Student time-log and request queries use the stable student document ID and
  confirm that its current ID matches the Authentication email.
- Only coaches can edit historical records or review extra-time requests.

For larger deployments, teams can replace the email allowlist in `isCoach()`
with a `coach: true` custom claim. The callable credential function already
uses a custom claim or `COACH_EMAILS` allowlist.

When enabled, Cloud Functions use the Admin SDK and bypass Firestore Security
Rules. The authorization check in `functions/index.js` is therefore required
and should not be removed.

## Verification Checklist

After setup:

1. Confirm the CLI is targeting the intended project:

   ```powershell
   npx.cmd firebase-tools use
   ```

2. Confirm the deployed Firestore rules no longer contain the example coach
   allowlist or a kiosk/student domain that differs from `.env`.
3. In **Firestore > Indexes**, wait for the included `students` composite index
   to show as enabled.
4. Run the Firestore Security Rules tests against the local emulator:

   ```powershell
   npm.cmd run test:rules
   ```

5. Run the frontend build:

   ```powershell
   npm.cmd run build
   ```

6. Start the local app:

   ```powershell
   npm.cmd run dev
   ```

7. If Functions are enabled, check the Function code:

   ```powershell
   npm.cmd --prefix functions run check
   ```

8. Sign in as a coach.
9. Create a student and confirm both an Authentication user and a `students`
   document were created.
10. Create at least one task from the coach dashboard.
11. Sign in through the kiosk using the student ID or NFC card.
12. Start and end a task, then confirm the student and `timeLogs` records update.
13. Sign in directly as the student and review the timeline.
14. Submit and approve an extra-time request.
15. Change a student password using the enabled Function or the manual process.
16. Confirm analytics display the completed session and approved extra time.
17. When publishing the frontend, copy all eight `VITE_*` values to the hosting
    provider, authorize its exact domain in Firebase Authentication, deploy,
    and repeat the coach, kiosk, and direct-student sign-in checks there.

## Troubleshooting

### Firebase configuration is missing

Confirm `.env` exists at the repository root, contains all `VITE_FIREBASE_*`
values, and restart the Vite development server after editing it.

### Student login reports invalid credentials

Confirm Email/Password authentication is enabled and that the student domain is
identical in `.env`, `functions/.env`, `functions/sharedConfig.json`, and
`firestore.rules`.

### Creating a student reports `auth/admin-restricted-operation`

Open **Authentication > Settings > User actions** and enable end-user account
creation and deletion. The coach dashboard uses a secondary Firebase Web SDK
session to create the student's Authentication account without signing out the
coach, and deletion provides rollback if its Firestore write fails.

### Kiosk can sign in but cannot read or write student data

Confirm the kiosk Authentication email exactly matches both
`VITE_KIOSK_AUTH_EMAIL` and `kioskEmail()` in `firestore.rules`, then redeploy
the rules.

### Coach can sign in but cannot load dashboard data

Confirm the coach Authentication email is listed in `coachEmails()` in
`firestore.rules`, then redeploy the rules.

### Coach can edit a name but cannot reset a password

If the optional Function is enabled, confirm the coach email is in
both `coachEmails()` and `COACH_EMAILS`, redeploy after changing rules or
Function environment, and verify the runtime service account has the Firebase
Authentication Admin role. Otherwise, use the manual credential process above.

### Firestore reports a missing index

Open the index-creation link in the Firebase error, wait for the index to finish
building, and then retry the operation.
