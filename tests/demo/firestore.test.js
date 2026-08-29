import assert from 'node:assert/strict';
import test from 'node:test';

import { createServer } from 'vite';

const sortKeys = (value) => Object.keys(value).sort();

const snapshotsById = (snapshot) => new Map(snapshot.docs.map((document) => [
  document.id,
  document.data(),
]));

test('seeded demo documents match real service schemas and relationships', async (t) => {
  const vite = await createServer({
    appType: 'custom',
    logLevel: 'silent',
    mode: 'demo',
    server: { middlewareMode: true },
  });
  t.after(() => vite.close());

  const { collection, getDocs } = await vite.ssrLoadModule('/src/demo/firebase/firestore.js');
  const {
    extraTimeRequestConfig,
    scheduleConfig,
    studentAuthConfig,
    taskConfig,
    timeLogConfig,
  } = await vite.ssrLoadModule('/src/config/appConfig.js');
  const { getScheduleOccurrencesInRange } = await vite.ssrLoadModule(
    '/src/features/schedules/scheduleUtils.js',
  );
  const [studentSnapshot, taskSnapshot, scheduleSnapshot, timeLogSnapshot, requestSnapshot] = (
    await Promise.all([
      getDocs(collection({}, studentAuthConfig.collectionName)),
      getDocs(collection({}, taskConfig.collectionName)),
      getDocs(collection({}, scheduleConfig.collectionName)),
      getDocs(collection({}, timeLogConfig.collectionName)),
      getDocs(collection({}, extraTimeRequestConfig.collectionName)),
    ])
  );
  const students = snapshotsById(studentSnapshot);
  const tasks = snapshotsById(taskSnapshot);
  const schedules = snapshotsById(scheduleSnapshot);
  const timeLogs = snapshotsById(timeLogSnapshot);
  const requests = snapshotsById(requestSnapshot);
  const studentFields = [
    'activeTimeLogId',
    'createdAt',
    'currentMember',
    'currentTask',
    'currentTaskId',
    'name',
    'nfcCardId',
    'previousStudentId',
    'signedIn',
    'signedInAt',
    'studentId',
    'updatedAt',
  ].sort();
  const scheduleFields = [
    'countsForAttendance',
    'countsForOutreach',
    'dayOfMonth',
    'dayOfWeek',
    'endTime',
    'excludedDates',
    'isRecurring',
    'monthOfYear',
    'noteRequirement',
    'recurrenceEndsBefore',
    'recurrenceStartsOn',
    'recurrenceType',
    'startTime',
    'taskId',
  ].sort();
  const sessionTimeLogFields = [
    'createdAt',
    'durationMinutes',
    'signInAt',
    'signInNotes',
    'signOutAt',
    'signOutNotes',
    'status',
    'studentDocId',
    'studentId',
    'studentName',
    'taskId',
    'taskName',
    'updatedAt',
  ].sort();
  const extraHoursTimeLogFields = [
    'createdAt',
    'durationMinutes',
    'enteredBy',
    'reason',
    'status',
    'studentDocId',
    'studentId',
    'studentName',
    'taskName',
    'updatedAt',
  ].sort();
  const requestFields = [
    'durationMinutes',
    'reason',
    'requestedAt',
    'reviewedAt',
    'reviewedBy',
    'status',
    'studentDocId',
    'studentId',
    'studentName',
  ].sort();

  students.forEach((student) => {
    assert.deepEqual(sortKeys(student), studentFields);
    assert.equal(typeof student.createdAt?.toDate, 'function');
    assert.equal(typeof student.updatedAt?.toDate, 'function');
  });

  tasks.forEach((task) => {
    assert.deepEqual(sortKeys(task), ['name', 'scheduled']);
  });

  schedules.forEach((schedule) => {
    assert.deepEqual(sortKeys(schedule), scheduleFields);
    assert.ok(tasks.has(schedule.taskId));
    assert.equal(tasks.get(schedule.taskId).scheduled, true);
    assert.ok(Array.isArray(schedule.excludedDates));

    if (schedule.isRecurring) {
      assert.match(schedule.recurrenceStartsOn, /^\d{4}-\d{2}-\d{2}$/);
      assert.match(schedule.recurrenceEndsBefore, /^\d{4}-\d{2}-\d{2}$/);
      assert.ok(schedule.recurrenceStartsOn < schedule.recurrenceEndsBefore);
    } else {
      assert.equal(schedule.recurrenceStartsOn, null);
      assert.equal(schedule.recurrenceEndsBefore, null);
    }
  });

  const weeklyBuildSchedule = schedules.get('schedule-weekly-build');
  const parseDateKey = (value) => {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  };
  const weeklyRangeEnd = parseDateKey(weeklyBuildSchedule.recurrenceEndsBefore);
  weeklyRangeEnd.setDate(weeklyRangeEnd.getDate() - 1);
  const weeklyBuildOccurrences = getScheduleOccurrencesInRange(
    [{ id: 'schedule-weekly-build', ...weeklyBuildSchedule }],
    parseDateKey(weeklyBuildSchedule.recurrenceStartsOn),
    weeklyRangeEnd,
  );
  assert.ok(
    weeklyBuildOccurrences.length > 5,
    'expected enough real-format weekly occurrences to exercise calendar scrolling',
  );

  timeLogs.forEach((timeLog) => {
    assert.deepEqual(
      sortKeys(timeLog),
      timeLog.taskName === timeLogConfig.extraTimeTaskName
        ? extraHoursTimeLogFields
        : sessionTimeLogFields,
    );
  });

  requests.forEach((request) => {
    assert.deepEqual(sortKeys(request), requestFields);
  });

  const activeStudent = students.get('student-grace');
  const activeTimeLog = timeLogs.get(activeStudent.activeTimeLogId);
  assert.equal(activeStudent.currentTaskId, activeTimeLog.taskId);
  assert.equal(activeStudent.currentTask, activeTimeLog.taskName);
  assert.equal(activeTimeLog.status, timeLogConfig.activeStatus);

  const approvedRequest = requests.get('request-grace-approved');
  const approvedTimeLog = timeLogs.get('time-log-grace-approved-extra');
  assert.equal(approvedTimeLog.studentDocId, approvedRequest.studentDocId);
  assert.equal(approvedTimeLog.durationMinutes, approvedRequest.durationMinutes);
  assert.equal(approvedTimeLog.reason, approvedRequest.reason);
  assert.equal(approvedTimeLog.enteredBy, approvedRequest.reviewedBy);
  assert.equal(
    approvedTimeLog.createdAt.toMillis(),
    approvedRequest.reviewedAt.toMillis(),
  );
});

test('demo schedules support excluding occurrences and deleting documents', async (t) => {
  const vite = await createServer({
    appType: 'custom',
    logLevel: 'silent',
    mode: 'demo',
    server: { middlewareMode: true },
  });
  t.after(() => vite.close());

  const {
    addDoc,
    collection,
    getDoc,
  } = await vite.ssrLoadModule('/src/demo/firebase/firestore.js');
  const {
    deleteSchedule,
    excludeScheduleOccurrence,
  } = await vite.ssrLoadModule('/src/features/schedules/scheduleService.js');
  const schedules = collection({}, 'schedules');
  const scheduleRef = await addDoc(schedules, {
    excludedDates: ['2026-08-01'],
  });

  await excludeScheduleOccurrence({
    occurrenceDate: '2026-08-01',
    scheduleId: scheduleRef.id,
  });
  await excludeScheduleOccurrence({
    occurrenceDate: '2026-08-02',
    scheduleId: scheduleRef.id,
  });
  await excludeScheduleOccurrence({
    occurrenceDate: '2026-08-02',
    scheduleId: scheduleRef.id,
  });

  const updatedSchedule = await getDoc(scheduleRef);
  assert.deepEqual(updatedSchedule.data().excludedDates, [
    '2026-08-01',
    '2026-08-02',
  ]);

  await deleteSchedule(scheduleRef.id);

  const deletedSchedule = await getDoc(scheduleRef);
  assert.equal(deletedSchedule.exists(), false);
});
