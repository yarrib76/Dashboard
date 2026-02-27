const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeIdempotencyKey, validateFacturaPayload } = require('../lib/facturas');

test('validateFacturaPayload rechaza faltantes obligatorios', () => {
  const missing = validateFacturaPayload({
    cliente_id: 1,
    vendedora: '',
    tipo_pago_id: 2,
    items: [{ articulo: 'A1', cantidad: 1 }],
  });
  assert.equal(missing.ok, false);
  assert.equal(missing.message, 'cliente_id, vendedora y tipo_pago_id requeridos');
});

test('validateFacturaPayload rechaza lista de items vacia', () => {
  const noItems = validateFacturaPayload({
    cliente_id: 1,
    vendedora: 'Maria',
    tipo_pago_id: 2,
    items: [],
  });
  assert.equal(noItems.ok, false);
  assert.equal(noItems.message, 'items requeridos');
});

test('validateFacturaPayload acepta payload valido', () => {
  const ok = validateFacturaPayload({
    cliente_id: 1,
    vendedora: 'Maria',
    tipo_pago_id: 2,
    items: [{ articulo: 'A1', cantidad: 1 }],
    esPedido: 'SI',
    nroPedido: 1001,
  });
  assert.equal(ok.ok, true);
  assert.equal(ok.data.cliente_id, 1);
  assert.equal(ok.data.vendedora, 'Maria');
  assert.equal(ok.data.tipo_pago_id, 2);
  assert.equal(ok.data.esPedido, 'SI');
  assert.equal(ok.data.nroPedido, 1001);
});

test('normalizeIdempotencyKey recorta y limpia', () => {
  assert.equal(normalizeIdempotencyKey(''), '');
  assert.equal(normalizeIdempotencyKey('   abc   '), 'abc');
  const long = 'x'.repeat(90);
  assert.equal(normalizeIdempotencyKey(long).length, 64);
});
