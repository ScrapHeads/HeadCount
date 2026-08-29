import assert from 'node:assert/strict';
import test from 'node:test';

import { createServer } from 'vite';

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
