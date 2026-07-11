import { studentAuthConfig, timeLogConfig } from '../config/appConfig';

const normalizeIdentifier = (value) => String(value ?? '').trim().toLowerCase();

export const getStudentIdHistory = (student) => {
  const previousStudentIds = Array.isArray(
    student?.[studentAuthConfig.previousStudentIdField],
  )
    ? student[studentAuthConfig.previousStudentIdField]
    : [];
  const identifiers = [
    student?.[studentAuthConfig.idField],
    student?.studentId,
    ...previousStudentIds,
  ];

  return [...new Set(identifiers.map(normalizeIdentifier).filter(Boolean))];
};

const studentMatchesLog = (student, log) => {
  const studentDocId = normalizeIdentifier(student?.id);
  const logStudentDocId = normalizeIdentifier(
    log?.[timeLogConfig.studentDocIdField],
  );

  if (studentDocId && logStudentDocId === studentDocId) {
    return true;
  }

  const logStudentId = normalizeIdentifier(log?.[timeLogConfig.studentIdField]);
  return Boolean(logStudentId && getStudentIdHistory(student).includes(logStudentId));
};

export const findStudentForLog = (log, students) => (
  students.find((student) => studentMatchesLog(student, log)) ?? null
);

export const isCurrentMember = (student) => (
  student?.[studentAuthConfig.currentMemberField]
  // Older records used a field name containing a space. Keep reading it so a
  // database migration is not required just to load the roster.
  ?? student?.['current member']
  // Some early profiles used `active` for the same roster state.
  ?? student?.active
  // Records created before roster archiving existed are treated as current.
  ?? true
) === true;

export const filterLogsForCurrentStudents = (logs, students) => {
  const currentStudentDocIds = new Set();
  const currentStudentIds = new Set();

  students.filter(isCurrentMember).forEach((student) => {
    const studentDocId = normalizeIdentifier(student?.id);

    if (studentDocId) {
      currentStudentDocIds.add(studentDocId);
    }

    getStudentIdHistory(student).forEach((studentId) => {
      currentStudentIds.add(studentId);
    });
  });

  // Historical logs may contain either the Firestore document ID or the
  // team's student ID, so check both identifiers.
  return logs.filter((log) => {
    const studentDocId = normalizeIdentifier(log?.[timeLogConfig.studentDocIdField]);
    const studentId = normalizeIdentifier(log?.[timeLogConfig.studentIdField]);

    return (
      (studentDocId && currentStudentDocIds.has(studentDocId))
      || (studentId && currentStudentIds.has(studentId))
    );
  });
};
