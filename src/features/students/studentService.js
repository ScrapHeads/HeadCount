import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { studentAuthConfig } from '../../config/appConfig';
import { generateUniqueStudentId } from '../../config/studentIdGenerator';
import { isCurrentMember } from '../../lib/studentUtils';
import {
  createStudentAuthAccount,
  deleteStudentAuthAccount,
  normalizeStudentAuthId,
  signOutStudentManagementAuth,
} from '../../services/auth';
import { updateStudentCredentials } from '../../services/adminFunctions';
import { db } from '../../services/firebase';
import {
  createDocument,
  findStudentRecord,
  findStudentRecordByNfcCardId,
  normalizeNfcCardId,
  updateDocument,
} from '../../services/firestore';

const nullableString = (value) => {
  const trimmedValue = String(value ?? '').trim();

  return trimmedValue || null;
};

const buildStudentCreatePayload = ({
  currentMember,
  name,
  nfcCardId,
  studentId,
}) => ({
  [studentAuthConfig.activeTimeLogIdField]: null,
  [studentAuthConfig.currentTaskField]: null,
  [studentAuthConfig.currentTaskIdField]: null,
  name: nullableString(name),
  [studentAuthConfig.nfcCardIdField]: normalizeNfcCardId(nfcCardId) || null,
  [studentAuthConfig.signedInField]: null,
  [studentAuthConfig.signedInAtField]: null,
  [studentAuthConfig.idField]: normalizeStudentAuthId(studentId),
  [studentAuthConfig.currentMemberField]: Boolean(currentMember),
});

// Subscribe to currently active student sessions for the coach dashboard.
export const watchActiveStudents = (callback, onError) => {
  const activeStudentsQuery = query(
    collection(db, studentAuthConfig.collectionName),
    where(studentAuthConfig.signedInField, '==', true),
    orderBy(studentAuthConfig.signedInAtField, 'asc'),
  );

  return onSnapshot(
    activeStudentsQuery,
    (snapshot) => {
      callback(
        snapshot.docs
          .map((studentDoc) => ({
            id: studentDoc.id,
            ...studentDoc.data(),
          }))
          .filter(isCurrentMember),
      );
    },
    onError,
  );
};

export const watchStudents = (callback, onError) => {
  return onSnapshot(
    collection(db, studentAuthConfig.collectionName),
    (snapshot) => {
      callback(
        snapshot.docs.map((studentDoc) => ({
          id: studentDoc.id,
          ...studentDoc.data(),
        })),
      );
    },
    onError,
  );
};

const assertNfcCardIdAvailable = async ({ nfcCardId, studentDocId = null }) => {
  const normalizedNfcCardId = normalizeNfcCardId(nfcCardId);

  if (!normalizedNfcCardId) {
    return;
  }

  const [studentWithCard, studentWithMatchingId] = await Promise.all([
    findStudentRecordByNfcCardId(normalizedNfcCardId),
    findStudentRecord(normalizedNfcCardId),
  ]);
  const conflictingStudent = [studentWithCard, studentWithMatchingId]
    .find((student) => student && student.id !== studentDocId);

  if (conflictingStudent) {
    throw new Error('That NFC card ID is already assigned to another student.');
  }
};

export const generateAvailableStudentId = () => generateUniqueStudentId({
  isAvailable: async (candidateId) => {
    const [studentWithId, studentWithCardId] = await Promise.all([
      findStudentRecord(candidateId),
      findStudentRecordByNfcCardId(candidateId),
    ]);

    return !studentWithId && !studentWithCardId;
  },
});

export const createStudent = async ({
  currentMember = true,
  name,
  nfcCardId,
  password,
  studentId,
}) => {
  const normalizedStudentId = normalizeStudentAuthId(studentId);

  if (!nullableString(name)) {
    throw new Error('Student name is required.');
  }

  if (!normalizedStudentId) {
    throw new Error('Student ID is required.');
  }

  if (!password) {
    throw new Error('Student password is required.');
  }

  if (password.length < 6) {
    throw new Error('Student passwords must be at least 6 characters.');
  }

  const existingStudent = await findStudentRecord(normalizedStudentId);

  if (existingStudent) {
    throw new Error('A student record already exists for this student ID.');
  }

  const studentWithMatchingCardId = await findStudentRecordByNfcCardId(normalizedStudentId);

  if (studentWithMatchingCardId) {
    throw new Error('That student ID is already assigned as another student\'s NFC card ID.');
  }

  await assertNfcCardIdAvailable({ nfcCardId });

  let studentAuthUser = null;

  try {
    studentAuthUser = await createStudentAuthAccount({
      studentId: normalizedStudentId,
      password,
    });

    const studentData = buildStudentCreatePayload({
      currentMember,
      name,
      nfcCardId,
      studentId: normalizedStudentId,
    });
    const studentDocId = await createDocument(studentAuthConfig.collectionName, studentData);

    return {
      id: studentDocId,
      ...studentData,
      authEmail: studentAuthUser?.email ?? null,
      authUid: studentAuthUser?.uid ?? null,
    };
  } catch (error) {
    if (studentAuthUser) {
      await deleteStudentAuthAccount(studentAuthUser).catch(() => {});
    }

    throw error;
  } finally {
    await signOutStudentManagementAuth().catch(() => {});
  }
};

export const updateStudent = async ({
  originalStudentId,
  password,
  studentDocId,
  updates,
}) => {
  if (!studentDocId) {
    throw new Error('Student document ID is required.');
  }

  const normalizedUpdates = { ...updates };
  const normalizedOriginalStudentId = normalizeStudentAuthId(originalStudentId);
  const normalizedStudentId = normalizeStudentAuthId(
    normalizedUpdates[studentAuthConfig.idField] ?? normalizedOriginalStudentId,
  );
  const includesNfcCardId = Object.prototype.hasOwnProperty.call(
    normalizedUpdates,
    studentAuthConfig.nfcCardIdField,
  );
  const credentialsChanged = (
    Boolean(password)
    || normalizedStudentId !== normalizedOriginalStudentId
  );

  if (includesNfcCardId) {
    normalizedUpdates[studentAuthConfig.nfcCardIdField] = (
      normalizeNfcCardId(normalizedUpdates[studentAuthConfig.nfcCardIdField]) || null
    );
    await assertNfcCardIdAvailable({
      nfcCardId: normalizedUpdates[studentAuthConfig.nfcCardIdField],
      studentDocId,
    });
  }

  if (credentialsChanged) {
    await updateStudentCredentials({
      password,
      studentDocId,
      studentId: normalizedStudentId,
    });
  }

  delete normalizedUpdates[studentAuthConfig.idField];
  await updateDocument(studentAuthConfig.collectionName, studentDocId, normalizedUpdates);

  return {
    id: studentDocId,
    [studentAuthConfig.idField]: normalizedStudentId,
    ...normalizedUpdates,
  };
};
