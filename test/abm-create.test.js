const test = require('node:test');
const assert = require('node:assert/strict');

const { computeBarcodeCheckDigit, buildArticuloCodigo } = require('../lib/abmCreate');

test('computeBarcodeCheckDigit calcula el digito para 779812345678', () => {
  assert.equal(computeBarcodeCheckDigit('779812345678'), 3);
});

test('buildArticuloCodigo construye el codigo completo con prefijo 7798', () => {
  assert.equal(buildArticuloCodigo('12345678'), '7798123456783');
});

test('buildArticuloCodigo rechaza bases invalidas', () => {
  assert.equal(buildArticuloCodigo('1234'), null);
  assert.equal(buildArticuloCodigo('abc12345'), null);
});
