import { readFileSync } from 'node:fs';
import { after, before, beforeEach, test } from 'node:test';

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';

const projectId = 'demo-headcount-rules';
const rules = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');

const readConfiguredIdentity = (pattern, label) => {
  const match = rules.match(pattern);

  if (!match?.[1]) {
    throw new Error(`Could not read the configured ${label} from firestore.rules.`);
  }

  return match[1].replaceAll('\\', '');
};

const kioskEmail = readConfiguredIdentity(
  /function\s+kioskEmail\(\)\s*\{[\s\S]*?return\s+'([^']+)'/,
  'kiosk email',
);
const coachEmail = readConfiguredIdentity(
  /function\s+coachEmails\(\)\s*\{[\s\S]*?return\s*\[[\s\S]*?'([^']+)'/,
  'coach email',
);
const studentDomain = readConfiguredIdentity(
  /email\.matches\('\.\*@(.+?)\$'\)/,
  'student email domain',
);

const studentEmail = (studentId) => `${studentId}@${studentDomain}`;
const authToken = (email) => ({ email });

let testEnv;

const seedData = async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();

    await Promise.all([
      setDoc(doc(db, 'students', 'alice-profile'), {
        activeTimeLogId: null,
        currentMember: true,
        currentTask: null,
        currentTaskId: null,
        name: 'Alice',
        signedIn: false,
        signedInAt: null,
        studentId: 'alice',
      }),
      setDoc(doc(db, 'students', 'bob-profile'), {
        activeTimeLogId: null,
        currentMember: true,
        currentTask: null,
        currentTaskId: null,
        name: 'Bob',
        signedIn: false,
        signedInAt: null,
        studentId: 'bob',
      }),
      setDoc(doc(db, 'tasks', 'build'), {
        name: 'Build',
        scheduled: false,
      }),
      setDoc(doc(db, 'schedules', 'meeting'), {
        taskId: 'build',
      }),
    ]);
  });
};

const activeTimeLog = ({ studentDocId, studentId, ...overrides }) => ({
  createdAt: serverTimestamp(),
  durationMinutes: null,
  signInAt: serverTimestamp(),
  signInNotes: 'Build drivetrain',
  signOutAt: null,
  signOutNotes: null,
  status: 'active',
  studentDocId,
  studentId,
  studentName: 'Alice',
  taskId: 'build',
  taskName: 'Build',
  updatedAt: serverTimestamp(),
  ...overrides,
});

const extraTimeRequest = ({ studentDocId, studentId }) => ({
  durationMinutes: 60,
  reason: 'Off-site work',
  requestedAt: serverTimestamp(),
  reviewedAt: null,
  reviewedBy: null,
  status: 'pending',
  studentDocId,
  studentId,
  studentName: 'Alice',
});

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: { rules },
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seedData();
});

after(async () => {
  await testEnv.cleanup();
});

test('unauthenticated and unrecognized accounts cannot read application data', async () => {
  const unauthenticatedDb = testEnv.unauthenticatedContext().firestore();
  const unknownDb = testEnv
    .authenticatedContext('unknown-user', authToken('unknown@example.net'))
    .firestore();

  await assertFails(getDoc(doc(unauthenticatedDb, 'tasks', 'build')));
  await assertFails(getDoc(doc(unknownDb, 'tasks', 'build')));
  await assertFails(getDoc(doc(unknownDb, 'schedules', 'meeting')));
});

test('coach, kiosk, and direct-student accounts can read tasks and schedules', async () => {
  const identities = [
    ['coach-user', coachEmail],
    ['kiosk-user', kioskEmail],
    ['alice-user', studentEmail('alice')],
  ];

  for (const [uid, email] of identities) {
    const db = testEnv.authenticatedContext(uid, authToken(email)).firestore();

    await assertSucceeds(getDoc(doc(db, 'tasks', 'build')));
    await assertSucceeds(getDoc(doc(db, 'schedules', 'meeting')));
  }
});

test('direct students can read and update session fields only on their own profile', async () => {
  const aliceDb = testEnv
    .authenticatedContext('alice-user', authToken(studentEmail('alice')))
    .firestore();

  await assertSucceeds(getDoc(doc(aliceDb, 'students', 'alice-profile')));
  await assertFails(getDoc(doc(aliceDb, 'students', 'bob-profile')));
  await assertFails(updateDoc(doc(aliceDb, 'students', 'alice-profile'), {
    signedIn: true,
    signedInAt: serverTimestamp(),
  }));

  const sessionBatch = writeBatch(aliceDb);
  sessionBatch.set(
    doc(aliceDb, 'timeLogs', 'session-log'),
    activeTimeLog({ studentDocId: 'alice-profile', studentId: 'alice' }),
  );
  sessionBatch.update(doc(aliceDb, 'students', 'alice-profile'), {
    activeTimeLogId: 'session-log',
    currentTask: 'Build',
    currentTaskId: 'build',
    signedIn: true,
    signedInAt: serverTimestamp(),
  });
  await assertSucceeds(sessionBatch.commit());

  await assertFails(updateDoc(doc(aliceDb, 'students', 'alice-profile'), {
    currentTask: 'Forged task name',
  }));
  await assertFails(updateDoc(doc(aliceDb, 'students', 'alice-profile'), {
    name: 'Changed by student',
  }));
});

test('direct-student time logs require matching studentId and studentDocId ownership', async () => {
  const aliceDb = testEnv
    .authenticatedContext('alice-user', authToken(studentEmail('alice')))
    .firestore();

  await assertSucceeds(setDoc(
    doc(aliceDb, 'timeLogs', 'owned-log'),
    activeTimeLog({ studentDocId: 'alice-profile', studentId: 'alice' }),
  ));
  await assertFails(setDoc(
    doc(aliceDb, 'timeLogs', 'mismatched-profile'),
    activeTimeLog({ studentDocId: 'bob-profile', studentId: 'alice' }),
  ));
  await assertFails(setDoc(
    doc(aliceDb, 'timeLogs', 'mismatched-id'),
    activeTimeLog({ studentDocId: 'alice-profile', studentId: 'bob' }),
  ));
  await assertFails(setDoc(
    doc(aliceDb, 'timeLogs', 'missing-task'),
    activeTimeLog({
      studentDocId: 'alice-profile',
      studentId: 'alice',
      taskId: 'missing',
    }),
  ));
  await assertFails(setDoc(
    doc(aliceDb, 'timeLogs', 'forged-task-name'),
    activeTimeLog({
      studentDocId: 'alice-profile',
      studentId: 'alice',
      taskName: 'Extra Hours',
    }),
  ));
});

test('task writes enforce coach ownership, schema, and safe names', async () => {
  const aliceDb = testEnv
    .authenticatedContext('alice-user', authToken(studentEmail('alice')))
    .firestore();
  const coachDb = testEnv
    .authenticatedContext('coach-user', authToken(coachEmail))
    .firestore();

  await assertSucceeds(setDoc(doc(coachDb, 'tasks', 'valid-task'), {
    name: 'CAD / Build & Test (A)',
    scheduled: false,
  }));
  await assertFails(setDoc(doc(aliceDb, 'tasks', 'student-task'), {
    name: 'Student-created task',
    scheduled: false,
  }));
  await assertFails(setDoc(doc(coachDb, 'tasks', 'reserved-task'), {
    name: 'extra_time',
    scheduled: false,
  }));
  await assertFails(setDoc(doc(coachDb, 'tasks', 'oversized-task'), {
    name: 'A'.repeat(121),
    scheduled: false,
  }));
  await assertFails(setDoc(doc(coachDb, 'tasks', 'formatted-task'), {
    name: 'Build\u202ETest',
    scheduled: false,
  }));
  await assertFails(setDoc(doc(coachDb, 'tasks', 'extra-field-task'), {
    name: 'Build test',
    scheduled: false,
    system: true,
  }));
  await assertSucceeds(updateDoc(doc(coachDb, 'tasks', 'build'), {
    scheduled: true,
  }));
  await assertFails(updateDoc(doc(coachDb, 'tasks', 'build'), {
    name: 'Renamed task',
  }));
});

test('direct-student extra-time requests require matching identifiers', async () => {
  const aliceDb = testEnv
    .authenticatedContext('alice-user', authToken(studentEmail('alice')))
    .firestore();

  await assertSucceeds(setDoc(
    doc(aliceDb, 'extraTimeRequests', 'owned-request'),
    extraTimeRequest({ studentDocId: 'alice-profile', studentId: 'alice' }),
  ));
  await assertFails(setDoc(
    doc(aliceDb, 'extraTimeRequests', 'mismatched-request'),
    extraTimeRequest({ studentDocId: 'bob-profile', studentId: 'alice' }),
  ));
});

test('kiosk and coach retain their intended elevated access', async () => {
  const kioskDb = testEnv
    .authenticatedContext('kiosk-user', authToken(kioskEmail))
    .firestore();
  const coachDb = testEnv
    .authenticatedContext('coach-user', authToken(coachEmail))
    .firestore();

  await assertSucceeds(getDoc(doc(kioskDb, 'students', 'bob-profile')));
  await assertSucceeds(setDoc(
    doc(kioskDb, 'timeLogs', 'kiosk-log'),
    activeTimeLog({ studentDocId: 'bob-profile', studentId: 'bob' }),
  ));
  await assertSucceeds(updateDoc(doc(coachDb, 'students', 'bob-profile'), {
    name: 'Updated by coach',
  }));
});
