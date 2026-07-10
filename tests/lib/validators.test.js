import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getMinimumLengthMessage,
  isNumericString,
  nullableString,
} from '../../src/lib/validators.js';

test('nullableString trims text and converts blank values to null', () => {
  assert.equal(nullableString('  Ada Lovelace  '), 'Ada Lovelace');
  assert.equal(nullableString('   '), null);
  assert.equal(nullableString(null), null);
  assert.equal(nullableString(undefined), null);
});

test('isNumericString accepts signed integers and decimals only', () => {
  assert.equal(isNumericString('12345'), true);
  assert.equal(isNumericString('-42'), true);
  assert.equal(isNumericString('3.14'), true);
  assert.equal(isNumericString('12abc'), false);
  assert.equal(isNumericString(''), false);
  assert.equal(isNumericString(' 12 '), false);
});

test('getMinimumLengthMessage formats a consistent validation message', () => {
  assert.equal(
    getMinimumLengthMessage('Student passwords', 6),
    'Student passwords must be at least 6 characters.',
  );
});
