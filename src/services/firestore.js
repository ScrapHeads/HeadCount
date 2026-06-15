import {
  addDoc,
  collection,
  doc,
  getDocs,
  getDoc,
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

export const createDocument = async (collectionName, data) => {
  const docRef = await addDoc(collection(db, collectionName), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return docRef.id;
};

export const getDocument = async (collectionName, documentId) => {
  if (!documentId) {
    throw new Error('Document ID is required.');
  }

  const documentSnapshot = await getDoc(doc(db, collectionName, documentId));

  if (!documentSnapshot.exists()) {
    return null;
  }

  return {
    id: documentSnapshot.id,
    ...documentSnapshot.data(),
  };
};

export const updateDocument = async (collectionName, documentId, updates) => {
  if (!documentId) {
    throw new Error('Document ID is required for updates.');
  }

  const documentRef = doc(db, collectionName, documentId);
  await updateDoc(documentRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
};
