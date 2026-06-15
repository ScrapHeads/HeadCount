import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';

const updateStudentCredentialsCallable = httpsCallable(
  functions,
  'updateStudentCredentials',
);

export const updateStudentCredentials = async ({
  password,
  studentDocId,
  studentId,
}) => {
  try {
    const result = await updateStudentCredentialsCallable({
      password,
      studentDocId,
      studentId,
    });

    return result.data;
  } catch (error) {
    if (error?.code === 'functions/not-found') {
      throw new Error('The student credential management function has not been deployed.');
    }

    if (error?.code === 'functions/internal' && !error?.details) {
      throw new Error(
        'The credential backend is unavailable or outdated. Deploy the latest Firebase functions.',
      );
    }

    const operation = error?.details?.operation;
    const adminCode = error?.details?.adminCode;
    const diagnostic = [operation, adminCode].filter(Boolean).join(' / ');
    const message = error?.message || 'Failed to update student credentials.';

    throw new Error(diagnostic ? `${message} (${diagnostic})` : message);
  }
};
