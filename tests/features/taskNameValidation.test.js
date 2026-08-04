import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MAX_TASK_NAME_LENGTH,
  isReservedTaskName,
  validateTaskName,
} from '../../src/features/tasks/taskNameValidation.js';

test('validateTaskName preserves normal punctuation and normalizes surrounding text', () => {
  assert.equal(validateTaskName('  CAD / Build & Test (A)  '), 'CAD / Build & Test (A)');
  assert.equal(validateTaskName('Cafe\u0301'), 'Café');
});

test('validateTaskName rejects oversized, control, invisible, and reserved names', () => {
  assert.throws(() => validateTaskName('A'.repeat(MAX_TASK_NAME_LENGTH + 1)), /characters or fewer/);
  assert.throws(() => validateTaskName('Build\nTest'), /control or invisible/);
  assert.throws(() => validateTaskName('Build\u202ETest'), /control or invisible/);
  assert.throws(() => validateTaskName('Extra Hours'), /reserved/);
  assert.throws(() => validateTaskName('extra_time'), /reserved/);
});

test('isReservedTaskName recognizes only system extra-hours aliases', () => {
  assert.equal(isReservedTaskName('extra-hours'), true);
  assert.equal(isReservedTaskName('ExtraTime'), true);
  assert.equal(isReservedTaskName('Extra practice'), false);
});
