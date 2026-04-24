import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { studentAuthConfig } from '../../config/appConfig';
import { db } from '../../services/firebase';

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
