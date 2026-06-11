import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import {
  extraTimeRequestConfig,
  studentAuthConfig,
  timeLogConfig,
} from '../../config/appConfig';
import { db } from '../../services/firebase';

const sortRequestsNewestFirst = (requests) => [...requests].sort((left, right) => {
  const leftTime = left?.[extraTimeRequestConfig.requestedAtField]?.toMillis?.() ?? 0;
  const rightTime = right?.[extraTimeRequestConfig.requestedAtField]?.toMillis?.() ?? 0;

  return rightTime - leftTime;
});

export const createExtraTimeRequest = async ({ hours, reason, student }) => {
  if (!student?.id) {
    throw new Error('A student record is required to request extra time.');
  }

  const numericHours = Number(hours);
  const trimmedReason = String(reason ?? '').trim();

  if (!Number.isFinite(numericHours) || numericHours <= 0) {
    throw new Error('Requested hours must be greater than zero.');
  }

  if (!trimmedReason) {
    throw new Error('A reason is required.');
  }

  return addDoc(collection(db, extraTimeRequestConfig.collectionName), {
    [extraTimeRequestConfig.studentDocIdField]: student.id,
    [extraTimeRequestConfig.studentIdField]: String(
      student[studentAuthConfig.idField] ?? student.studentId ?? student.id,
    ),
    [extraTimeRequestConfig.studentNameField]: student.name ?? 'Student',
    [extraTimeRequestConfig.durationMinutesField]: Math.round(numericHours * 60),
    [extraTimeRequestConfig.reasonField]: trimmedReason,
    [extraTimeRequestConfig.statusField]: extraTimeRequestConfig.pendingStatus,
    [extraTimeRequestConfig.requestedAtField]: serverTimestamp(),
    [extraTimeRequestConfig.reviewedAtField]: null,
    [extraTimeRequestConfig.reviewedByField]: null,
  });
};

export const watchExtraTimeRequestsForStudent = ({ student, onData, onError }) => {
  const requestsCollection = collection(db, extraTimeRequestConfig.collectionName);
  const studentId = String(
    student?.[studentAuthConfig.idField] ?? student?.studentId ?? '',
  );
  const requestsQuery = student?.authMode === 'kiosk'
    ? query(
      requestsCollection,
      where(extraTimeRequestConfig.studentDocIdField, '==', student?.id ?? ''),
    )
    : query(
      requestsCollection,
      where(extraTimeRequestConfig.studentIdField, '==', studentId ?? ''),
    );

  return onSnapshot(
    requestsQuery,
    (snapshot) => {
      onData(sortRequestsNewestFirst(snapshot.docs.map((requestDoc) => ({
        id: requestDoc.id,
        ...requestDoc.data(),
      }))));
    },
    onError,
  );
};

export const watchExtraTimeRequests = (onData, onError) => onSnapshot(
  collection(db, extraTimeRequestConfig.collectionName),
  (snapshot) => {
    onData(sortRequestsNewestFirst(snapshot.docs.map((requestDoc) => ({
      id: requestDoc.id,
      ...requestDoc.data(),
    }))));
  },
  onError,
);

export const reviewExtraTimeRequest = async ({ decision, request, reviewedBy }) => {
  if (!request?.id) {
    throw new Error('An extra-time request is required.');
  }

  if (
    decision !== extraTimeRequestConfig.approvedStatus
    && decision !== extraTimeRequestConfig.deniedStatus
  ) {
    throw new Error('The review decision is invalid.');
  }

  const requestDocRef = doc(db, extraTimeRequestConfig.collectionName, request.id);

  await runTransaction(db, async (transaction) => {
    const requestSnapshot = await transaction.get(requestDocRef);

    if (!requestSnapshot.exists()) {
      throw new Error('The extra-time request could not be found.');
    }

    const requestData = requestSnapshot.data();

    if (
      requestData[extraTimeRequestConfig.statusField]
      !== extraTimeRequestConfig.pendingStatus
    ) {
      throw new Error('This extra-time request has already been reviewed.');
    }

    if (decision === extraTimeRequestConfig.approvedStatus) {
      const studentDocRef = doc(
        db,
        studentAuthConfig.collectionName,
        requestData[extraTimeRequestConfig.studentDocIdField],
      );
      const studentSnapshot = await transaction.get(studentDocRef);

      if (!studentSnapshot.exists()) {
        throw new Error('The student record for this request could not be found.');
      }

      const studentData = studentSnapshot.data();
      const timeLogDocRef = doc(collection(db, timeLogConfig.collectionName));

      transaction.set(timeLogDocRef, {
        [timeLogConfig.createdAtField]: serverTimestamp(),
        [timeLogConfig.updatedAtField]: serverTimestamp(),
        [timeLogConfig.durationMinutesField]:
          requestData[extraTimeRequestConfig.durationMinutesField],
        [timeLogConfig.studentDocIdField]:
          requestData[extraTimeRequestConfig.studentDocIdField],
        [timeLogConfig.studentIdField]: studentData[studentAuthConfig.idField],
        [timeLogConfig.studentNameField]: studentData.name ?? 'Student',
        [timeLogConfig.statusField]: timeLogConfig.completedStatus,
        [timeLogConfig.taskNameField]: timeLogConfig.extraTimeTaskName,
        [timeLogConfig.reasonField]: requestData[extraTimeRequestConfig.reasonField],
        [timeLogConfig.enteredByField]: String(reviewedBy ?? '').trim() || 'Coach',
      });
    }

    transaction.update(requestDocRef, {
      [extraTimeRequestConfig.statusField]: decision,
      [extraTimeRequestConfig.reviewedAtField]: serverTimestamp(),
      [extraTimeRequestConfig.reviewedByField]:
        String(reviewedBy ?? '').trim() || 'Coach',
    });
  });
};
