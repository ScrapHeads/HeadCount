import { studentAuthConfig, timeLogConfig } from '../config/appConfig';

const normalizeIdentifier = (value) => String(value ?? '').trim().toLowerCase();

export const isCurrentMember = (student) => (
  student?.[studentAuthConfig.currentMemberField]
  ?? student?.['current member']
  ?? true
) === true;

export const filterLogsForCurrentStudents = (logs, students) => {
  const currentStudentDocIds = new Set();
  const currentStudentIds = new Set();

  students.filter(isCurrentMember).forEach((student) => {
    const studentDocId = normalizeIdentifier(student?.id);
    const studentId = normalizeIdentifier(
      student?.[studentAuthConfig.idField] ?? student?.studentId,
    );

    if (studentDocId) {
      currentStudentDocIds.add(studentDocId);
    }

    if (studentId) {
      currentStudentIds.add(studentId);
    }
  });

  return logs.filter((log) => {
    const studentDocId = normalizeIdentifier(log?.[timeLogConfig.studentDocIdField]);
    const studentId = normalizeIdentifier(log?.[timeLogConfig.studentIdField]);

    return (
      (studentDocId && currentStudentDocIds.has(studentDocId))
      || (studentId && currentStudentIds.has(studentId))
    );
  });
};
