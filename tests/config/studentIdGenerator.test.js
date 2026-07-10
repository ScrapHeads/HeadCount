import assert from 'node:assert/strict';
import test from 'node:test';

import { generateUniqueStudentId } from '../../src/config/studentIdGenerator.js';

test('generateUniqueStudentId requires an availability checker', async () => {
  await assert.rejects(
    () => generateUniqueStudentId({}),
    /Student ID availability checker is required\./,
  );
});

test('generateUniqueStudentId returns an available ID for the current year', async () => {
  const checkedCandidates = [];
  const result = await generateUniqueStudentId({
    now: new Date(2026, 6, 9),
    random: () => 0.5,
    isAvailable: async (candidateId) => {
      checkedCandidates.push(candidateId);
      return candidateId === '202642';
    },
  });

  assert.equal(result, '202642');
  assert.equal(checkedCandidates.at(-1), '202642');
  assert.equal(new Set(checkedCandidates).size, checkedCandidates.length);
  assert.ok(checkedCandidates.every((candidateId) => /^2026\d{2}$/.test(candidateId)));
});

test('generateUniqueStudentId throws when every candidate is unavailable', async () => {
  await assert.rejects(
    () => generateUniqueStudentId({
      now: new Date(2026, 6, 9),
      random: () => 0,
      isAvailable: async () => false,
    }),
    /No generated student IDs are available for 2026\./,
  );
});
