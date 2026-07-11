import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { studentAuthConfig } from '../config/appConfig';
import { isNumericString } from '../lib/validators';
import { db } from './firebase';

const normalizeStudentId = (studentId) => String(studentId ?? '').trim();

export const normalizeNfcCardId = (nfcCardId) => (
  String(nfcCardId ?? '').trim().toLowerCase()
);

const buildCandidateValues = (studentId) => {
  const candidates = [];

  if (studentAuthConfig.idValueType === 'number') {
    return [Number(studentId)];
  }

  candidates.push(studentId);

  // Older Firestore data may have stored IDs as numbers. In "auto" mode the
  // app checks both the text and numeric forms so those records still work.
  if (
    studentAuthConfig.idValueType === 'auto' &&
    isNumericString(studentId)
  ) {
    candidates.push(Number(studentId));
  }

  return candidates;
};

export const findStudentRecord = async (studentId) => {
  const normalizedStudentId = normalizeStudentId(studentId);

  if (!normalizedStudentId) {
    throw new Error('Student ID is required.');
  }

  const studentsCollection = collection(db, studentAuthConfig.collectionName);
  const candidateValues = buildCandidateValues(normalizedStudentId);

  try {
    for (const candidateValue of candidateValues) {
      const studentQuery = query(
        studentsCollection,
        where(studentAuthConfig.idField, '==', candidateValue),
        limit(1),
      );
      const studentSnapshot = await getDocs(studentQuery);

      if (!studentSnapshot.empty) {
        const matchingStudent = studentSnapshot.docs[0];

        return {
          id: matchingStudent.id,
          ...matchingStudent.data(),
        };
      }
    }
  } catch (error) {
    if (error?.code === 'permission-denied') {
      throw new Error('Firestore denied student lookup. Check your Firestore security rules.');
    }

    throw new Error(`Student lookup failed: ${error?.message || 'unknown Firestore error'}`);
  }

  return null;
};

export const findStudentRecordByPreviousStudentId = async (studentId) => {
  const normalizedStudentId = normalizeStudentId(studentId).toLowerCase();

  if (!normalizedStudentId) {
    return null;
  }

  try {
    const studentQuery = query(
      collection(db, studentAuthConfig.collectionName),
      where(
        studentAuthConfig.previousStudentIdField,
        'array-contains',
        normalizedStudentId,
      ),
      limit(1),
    );
    const studentSnapshot = await getDocs(studentQuery);

    if (studentSnapshot.empty) {
      return null;
    }

    const matchingStudent = studentSnapshot.docs[0];
    return {
      id: matchingStudent.id,
      ...matchingStudent.data(),
    };
  } catch (error) {
    if (error?.code === 'permission-denied') {
      throw new Error('Firestore denied previous Student ID lookup. Check your Firestore security rules.');
    }

    throw new Error(`Previous Student ID lookup failed: ${error?.message || 'unknown Firestore error'}`);
  }
};

export const findStudentRecordByNfcCardId = async (nfcCardId) => {
  const normalizedNfcCardId = normalizeNfcCardId(nfcCardId);

  if (!normalizedNfcCardId) {
    return null;
  }

  try {
    const studentQuery = query(
      collection(db, studentAuthConfig.collectionName),
      where(studentAuthConfig.nfcCardIdField, '==', normalizedNfcCardId),
      limit(1),
    );
    const studentSnapshot = await getDocs(studentQuery);

    if (studentSnapshot.empty) {
      return null;
    }

    const matchingStudent = studentSnapshot.docs[0];

    return {
      id: matchingStudent.id,
      ...matchingStudent.data(),
    };
  } catch (error) {
    if (error?.code === 'permission-denied') {
      throw new Error('Firestore denied NFC card lookup. Check your Firestore security rules.');
    }

    throw new Error(`NFC card lookup failed: ${error?.message || 'unknown Firestore error'}`);
  }
};

export const findStudentRecordByIdentifier = async (identifier) => {
  const normalizedIdentifier = String(identifier ?? '').trim();

  if (!normalizedIdentifier) {
    throw new Error('Student ID or NFC card ID is required.');
  }

  // Prefer the student's normal ID before treating the same input as an NFC
  // card serial number.
  const studentById = await findStudentRecord(normalizedIdentifier);

  if (studentById) {
    return studentById;
  }

  return findStudentRecordByNfcCardId(normalizedIdentifier);
};

export const updateStudentRecord = async (studentDocId, updates) => {
  if (!studentDocId) {
    throw new Error('Student document ID is required for updates.');
  }

  const studentDocRef = doc(db, studentAuthConfig.collectionName, studentDocId);
  await updateDoc(studentDocRef, updates);
};

export const createStudentProfile = async (data) => {
  // Server timestamps use Firebase's clock, which keeps records consistent
  // when users' computers have inaccurate local time settings.
  const docRef = await addDoc(collection(db, studentAuthConfig.collectionName), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return docRef.id;
};

export const updateStudentProfile = async (studentDocId, updates) => {
  if (!studentDocId) {
    throw new Error('Student document ID is required for profile updates.');
  }

  const documentRef = doc(db, studentAuthConfig.collectionName, studentDocId);
  await updateDoc(documentRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
};
