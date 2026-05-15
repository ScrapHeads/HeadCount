import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { studentAuthConfig } from '../../config/appConfig';
import {
  createStudentAuthAccount,
  deleteStudentAuthAccount,
  normalizeStudentAuthId,
  signOutStudentManagementAuth,
  updateExistingStudentAuthPassword,
} from '../../services/auth';
import { db } from '../../services/firebase';
import { createDocument, findStudentRecord, updateDocument } from '../../services/firestore';

const nullableString = (value) => {
  const trimmedValue = String(value ?? '').trim();

  return trimmedValue || null;
};

export const buildStudentCreatePayload = ({ currentMember, name, studentId }) => ({
  [studentAuthConfig.activeTimeLogIdField]: null,
  [studentAuthConfig.currentTaskField]: null,
  [studentAuthConfig.currentTaskIdField]: null,
  name: nullableString(name),
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
        snapshot.docs.map((studentDoc) => ({
          id: studentDoc.id,
          ...studentDoc.data(),
        })),
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

export const createStudent = async ({ currentMember = true, name, password, studentId }) => {
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

  let studentAuthUser = null;

  try {
    studentAuthUser = await createStudentAuthAccount({
      studentId: normalizedStudentId,
      password,
    });

    const studentData = buildStudentCreatePayload({
      currentMember,
      name,
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

export const updateStudent = async ({ password, studentDocId, updates }) => {
  if (!studentDocId) {
    throw new Error('Student document ID is required.');
  }

  if (password) {
    await updateExistingStudentAuthPassword();
  }

  await updateDocument(studentAuthConfig.collectionName, studentDocId, updates);

  return {
    id: studentDocId,
    ...updates,
  };
};
