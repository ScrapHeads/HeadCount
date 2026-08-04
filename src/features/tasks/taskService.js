import { addDoc, collection, doc, getDocs, orderBy, query, updateDoc } from 'firebase/firestore';
import { taskConfig } from '../../config/appConfig';
import { db } from '../../services/firebase';
import { validateTaskName } from './taskNameValidation';

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
  const validatedName = validateTaskName(name);
  const isScheduled = Boolean(scheduled);

  const taskDocRef = await addDoc(collection(db, taskConfig.collectionName), {
    [taskConfig.nameField]: validatedName,
    [taskConfig.scheduledField]: isScheduled,
  });

  return {
    id: taskDocRef.id,
    [taskConfig.nameField]: validatedName,
    [taskConfig.scheduledField]: isScheduled,
  };
};

export const setTaskScheduled = async (taskId, scheduled) => {
  if (!taskId) {
    throw new Error('A task is required.');
  }

  await updateDoc(doc(db, taskConfig.collectionName, taskId), {
    [taskConfig.scheduledField]: Boolean(scheduled),
  });
};

export const markTaskAsScheduled = async (taskId) => (
  setTaskScheduled(taskId, true)
);
