import {
  collection,
  getDocs,
  limit,
  query,
  where,
} from 'firebase/firestore';
import { studentAuthConfig } from '../config/appConfig';
import { db } from './firebase';

const normalizeStudentId = (studentId) => studentId.trim();
const isNumericString = (value) => /^-?\d+(\.\d+)?$/.test(value);

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
