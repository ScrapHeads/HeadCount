import { collection, getDocs, query, where } from 'firebase/firestore';
import { scheduleConfig } from '../../config/appConfig';
import { db } from '../../services/firebase';

export const listSchedules = async () => {
  const scheduleSnapshot = await getDocs(collection(db, scheduleConfig.collectionName));

  return scheduleSnapshot.docs.map((scheduleDoc) => ({
    id: scheduleDoc.id,
    ...scheduleDoc.data(),
  }));
};

export const listSchedulesForTask = async (taskId) => {
  const scheduleQuery = query(
    collection(db, scheduleConfig.collectionName),
    where(scheduleConfig.taskIdField, '==', taskId),
  );
  const scheduleSnapshot = await getDocs(scheduleQuery);

  return scheduleSnapshot.docs.map((scheduleDoc) => ({
    id: scheduleDoc.id,
    ...scheduleDoc.data(),
  }));
};
