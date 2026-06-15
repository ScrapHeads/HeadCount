const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { FieldValue, getFirestore } = require('firebase-admin/firestore');
const { defineString } = require('firebase-functions/params');
const { setGlobalOptions } = require('firebase-functions/v2');
const { HttpsError, onCall } = require('firebase-functions/v2/https');
const sharedConfig = require('./sharedConfig.json');

// Cloud Functions handle credential changes because browser code must never
// receive Firebase Admin privileges.
initializeApp();
setGlobalOptions({
  maxInstances: 10,
  region: 'us-central1',
});

const coachEmails = defineString('COACH_EMAILS', { default: '' });
const studentAuthEmailDomain = defineString('STUDENT_AUTH_EMAIL_DOMAIN', {
  default: sharedConfig.studentAuth.authEmailDomain,
});
const studentPasswordRequirementMessage = (
  `Student passwords must be at least ${sharedConfig.studentAuth.minPasswordLength} characters.`
);

const normalizeStudentId = (value) => String(value ?? '').trim().toLowerCase();

const buildStudentAuthEmail = (studentId) => (
  `${normalizeStudentId(studentId)}@${studentAuthEmailDomain.value().trim().toLowerCase()}`
);

const isAdminAuthPermissionError = (error) => {
  const code = String(error?.code ?? '').toLowerCase();
  const message = String(error?.message ?? '').toLowerCase();

  return (
    code === 'auth/insufficient-permission'
    || code === 'app/invalid-credential'
    || message.includes('insufficient permission')
    || message.includes('permission denied')
  );
};

const throwAdminAuthError = ({ error, fallbackMessage, operation }) => {
  console.error(`Firebase Admin Auth failed during ${operation}.`, {
    code: error?.code,
    message: error?.message,
  });

  if (isAdminAuthPermissionError(error)) {
    throw new HttpsError(
      'failed-precondition',
      'The Cloud Function runtime account cannot manage Firebase Authentication users.',
      {
        adminCode: error?.code ?? null,
        operation,
        requiredRole: 'Firebase Authentication Admin',
      },
    );
  }

  throw new HttpsError(
    'unavailable',
    fallbackMessage,
    {
      adminCode: error?.code ?? null,
      operation,
    },
  );
};

const assertAuthorizedCoach = (request) => {
  const token = request.auth?.token;
  const email = String(token?.email ?? '').trim().toLowerCase();
  const allowedCoachEmails = new Set(
    coachEmails.value()
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );

  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign in as a coach before managing student credentials.');
  }

  // A deployment can authorize coaches with a custom claim or with the
  // comma-separated COACH_EMAILS environment parameter.
  if (token?.coach !== true && !allowedCoachEmails.has(email)) {
    throw new HttpsError(
      'permission-denied',
      'This coach account is not authorized to manage student credentials.',
    );
  }
};

const assertStudentIdAvailable = async ({ db, studentDocId, studentId }) => {
  const [studentIdSnapshot, nfcCardSnapshot, previousStudentIdSnapshot] = await Promise.all([
    db.collection(sharedConfig.studentAuth.collectionName)
      .where(sharedConfig.studentAuth.idField, '==', studentId)
      .limit(2)
      .get(),
    db.collection(sharedConfig.studentAuth.collectionName)
      .where(sharedConfig.studentAuth.nfcCardIdField, '==', studentId)
      .limit(2)
      .get(),
    db.collection(sharedConfig.studentAuth.collectionName)
      .where(sharedConfig.studentAuth.previousStudentIdField, 'array-contains', studentId)
      .limit(2)
      .get(),
  ]);
  const conflict = [
    ...studentIdSnapshot.docs,
    ...nfcCardSnapshot.docs,
    ...previousStudentIdSnapshot.docs,
  ]
    .find((studentDoc) => studentDoc.id !== studentDocId);

  if (conflict) {
    throw new HttpsError(
      'already-exists',
      'That student ID is already assigned to another student, NFC card, or previous ID history.',
    );
  }
};

const updateStudentIdHistory = async ({
  currentStudentId,
  requestedStudentId,
  studentDoc,
}) => {
  const storedPreviousStudentIds = studentDoc.get(
    sharedConfig.studentAuth.previousStudentIdField,
  );
  const previousStudentIds = new Set(
    (Array.isArray(storedPreviousStudentIds) ? storedPreviousStudentIds : [])
      .map(normalizeStudentId)
      .filter(Boolean),
  );

  // The requested ID becomes current, so remove it from history if a coach is
  // switching back to an older ID. The ID being replaced becomes historical.
  previousStudentIds.delete(requestedStudentId);
  previousStudentIds.add(currentStudentId);

  await studentDoc.ref.update({
    [sharedConfig.sharedFields.studentIdField]: requestedStudentId,
    [sharedConfig.studentAuth.previousStudentIdField]: [...previousStudentIds],
    [sharedConfig.sharedFields.updatedAtField]: FieldValue.serverTimestamp(),
  });
};

exports.updateStudentCredentials = onCall(async (request) => {
  assertAuthorizedCoach(request);
  const studentDocId = String(request.data?.studentDocId ?? '').trim();
  const requestedStudentId = normalizeStudentId(request.data?.studentId);
  const newPassword = String(request.data?.password ?? '');

  if (!studentDocId) {
    throw new HttpsError('invalid-argument', 'Student document ID is required.');
  }

  if (!requestedStudentId) {
    throw new HttpsError('invalid-argument', 'Student ID is required.');
  }

  if (
    newPassword
    && newPassword.length < sharedConfig.studentAuth.minPasswordLength
  ) {
    throw new HttpsError(
      'invalid-argument',
      studentPasswordRequirementMessage,
    );
  }

  const db = getFirestore();
  const studentDoc = await db
    .collection(sharedConfig.studentAuth.collectionName)
    .doc(studentDocId)
    .get();

  if (!studentDoc.exists) {
    throw new HttpsError('not-found', 'Student record not found.');
  }

  const currentStudentId = normalizeStudentId(
    studentDoc.get(sharedConfig.studentAuth.idField),
  );
  const studentIdChanged = requestedStudentId !== currentStudentId;

  if (!currentStudentId) {
    throw new HttpsError('failed-precondition', 'The student record has no current student ID.');
  }

  if (!studentIdChanged && !newPassword) {
    return {
      passwordReset: false,
      studentId: currentStudentId,
      studentIdChanged: false,
    };
  }

  if (studentIdChanged) {
    await assertStudentIdAvailable({
      db,
      studentDocId,
      studentId: requestedStudentId,
    });
  }

  const auth = getAuth();
  let authUser;

  try {
    authUser = await auth.getUserByEmail(buildStudentAuthEmail(currentStudentId));
  } catch (error) {
    if (error?.code === 'auth/user-not-found') {
      throw new HttpsError(
        'failed-precondition',
        'No Firebase Authentication account exists for this student.',
      );
    }

    throwAdminAuthError({
      error,
      fallbackMessage: 'Could not load the student Authentication account. No credentials were changed.',
      operation: 'student-user-lookup',
    });
  }

  if (studentIdChanged) {
    try {
      const existingUser = await auth.getUserByEmail(buildStudentAuthEmail(requestedStudentId));

      if (existingUser.uid !== authUser.uid) {
        throw new HttpsError(
          'already-exists',
          'A Firebase Authentication account already uses that student ID.',
        );
      }
    } catch (error) {
      if (error?.code === 'auth/user-not-found') {
        // The requested Student ID is available in Firebase Authentication.
      } else if (error instanceof HttpsError) {
        throw error;
      } else {
        throwAdminAuthError({
          error,
          fallbackMessage: 'Could not verify whether the new Student ID is available.',
          operation: 'new-student-id-lookup',
        });
      }
    }
  }

  if (studentIdChanged) {
    try {
      // Change Authentication first, then update the student profile. If the
      // Firestore write fails, restore the original Authentication email.
      await auth.updateUser(authUser.uid, {
        email: buildStudentAuthEmail(requestedStudentId),
      });

      try {
        await updateStudentIdHistory({
          currentStudentId,
          requestedStudentId,
          studentDoc,
        });
      } catch (firestoreError) {
        let authRollbackSucceeded = false;

        await auth.updateUser(authUser.uid, {
          email: buildStudentAuthEmail(currentStudentId),
        }).then(() => {
          authRollbackSucceeded = true;
        }).catch((rollbackError) => {
          console.error('Failed to roll back the student Authentication email.', {
            code: rollbackError?.code,
            message: rollbackError?.message,
            studentDocId,
          });
        });

        console.error('Failed to update Student ID history in Firestore.', {
          authRollbackSucceeded,
          code: firestoreError?.code,
          message: firestoreError?.message,
          studentDocId,
        });

        throw new HttpsError(
          authRollbackSucceeded ? 'aborted' : 'data-loss',
          authRollbackSucceeded
            ? 'The Student ID was not changed because the student profile update failed.'
            : 'The Student ID update may be inconsistent. Check Firebase Authentication and Firestore.',
        );
      }
    } catch (error) {
      if (error instanceof HttpsError) {
        throw error;
      }

      if (error?.code === 'auth/email-already-exists') {
        throw new HttpsError(
          'already-exists',
          'A Firebase Authentication account already uses that student ID.',
        );
      }

      if (error?.code === 'auth/invalid-email') {
        throw new HttpsError('invalid-argument', 'That student ID cannot be used for login.');
      }

      throwAdminAuthError({
        error,
        fallbackMessage: 'Could not update the student login ID. No Firestore records were changed.',
        operation: 'student-email-update',
      });
    }
  }

  if (newPassword) {
    try {
      await auth.updateUser(authUser.uid, { password: newPassword });
    } catch (error) {
      if (error?.code === 'auth/invalid-password') {
        throw new HttpsError(
          'invalid-argument',
          studentPasswordRequirementMessage,
        );
      }

      throwAdminAuthError({
        error,
        fallbackMessage: studentIdChanged
          ? 'The Student ID changed, but the password reset failed.'
          : 'The password reset failed. The Student ID was not changed.',
        operation: 'student-password-update',
      });
    }
  }

  // Existing sessions should not continue using credentials that a coach has
  // replaced. Revocation takes effect when Firebase next refreshes the token.
  await auth.revokeRefreshTokens(authUser.uid).catch((error) => {
    console.error('Student credentials changed, but session revocation failed.', error);
  });

  return {
    passwordReset: Boolean(newPassword),
    studentId: requestedStudentId,
    studentIdChanged,
  };
});
