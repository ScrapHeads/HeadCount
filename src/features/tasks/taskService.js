import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { taskConfig } from '../../config/appConfig';
import { db } from '../../services/firebase';

export const listTasks = async () => {
  const taskQuery = query(
    collection(db, taskConfig.collectionName),
    orderBy(taskConfig.nameField),
  );
  const taskSnapshot = await getDocs(taskQuery);

  return taskSnapshot.docs.map((taskDoc) => ({
    id: taskDoc.id,
    ...taskDoc.data(),
  }));
};
