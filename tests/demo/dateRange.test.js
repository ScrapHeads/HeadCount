import assert from 'node:assert/strict';
import test from 'node:test';

import { createServer } from 'vite';

const createMemoryStorage = () => {
  const entries = new Map();

  return {
    getItem: (key) => entries.get(key) ?? null,
    removeItem: (key) => entries.delete(key),
    setItem: (key, value) => entries.set(key, String(value)),
  };
};

const ageTimestamps = (value, milliseconds) => {
  if (Array.isArray(value)) {
    value.forEach((item) => ageTimestamps(item, milliseconds));
    return;
  }

  if (!value || typeof value !== 'object') {
    return;
  }

  if (typeof value.__demoTimestamp === 'number') {
    value.__demoTimestamp -= milliseconds;
    return;
  }

  Object.values(value).forEach((item) => ageTimestamps(item, milliseconds));
};

const createDemoViteServer = () => createServer({
  appType: 'custom',
  logLevel: 'silent',
  mode: 'demo',
  server: { middlewareMode: true },
});

test('persisted demo fixtures remain inside the default analytics range', async (t) => {
  const localStorage = createMemoryStorage();
  const firstVite = await createDemoViteServer();
  const { DEMO_STATE_STORAGE_KEY } = await firstVite.ssrLoadModule('/src/config/demoMode.js');
  const { collection, getDocs } = await firstVite.ssrLoadModule('/src/demo/firebase/firestore.js');

  globalThis.window = { localStorage };
  await getDocs(collection({}, 'timeLogs'));
  delete globalThis.window;
  await firstVite.close();

  const storedState = JSON.parse(localStorage.getItem(DEMO_STATE_STORAGE_KEY));
  const ninetyDays = 90 * 24 * 60 * 60 * 1_000;
  ageTimestamps(storedState, ninetyDays);
  storedState.seedDate = '2000-01-01';
  localStorage.setItem(DEMO_STATE_STORAGE_KEY, JSON.stringify(storedState));

  const secondVite = await createDemoViteServer();
  t.after(async () => {
    delete globalThis.window;
    await secondVite.close();
  });
  const { listAnalyticsTimeLogsByRange } = await secondVite.ssrLoadModule(
    '/src/features/timeLogs/timeLogService.js',
  );
  const endDate = new Date();
  endDate.setHours(23, 59, 59, 999);
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 29);
  startDate.setHours(0, 0, 0, 0);

  globalThis.window = { localStorage };
  const timeLogs = await listAnalyticsTimeLogsByRange({ endDate, startDate });

  assert.ok(
    timeLogs.some((timeLog) => timeLog.status === 'completed'),
    'expected completed demo hours in the default 30-day range',
  );
});
