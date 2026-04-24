import { addDoc, collection, doc, getDocs, orderBy, query, updateDoc } from 'firebase/firestore';
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

export const createTask = async ({ name, scheduled = false }) => {
  const trimmedName = String(name ?? '').trim();

  if (!trimmedName) {
    throw new Error('A task name is required.');
  }

  const taskDocRef = await addDoc(collection(db, taskConfig.collectionName), {
    [taskConfig.nameField]: trimmedName,
    [taskConfig.scheduledField]: scheduled,
  });

  return {
    id: taskDocRef.id,
    [taskConfig.nameField]: trimmedName,
    [taskConfig.scheduledField]: scheduled,
  };
};

export const markTaskAsScheduled = async (taskId) => {
  if (!taskId) {
    throw new Error('A task is required.');
  }

  await updateDoc(doc(db, taskConfig.collectionName, taskId), {
    [taskConfig.scheduledField]: true,
  });
};
