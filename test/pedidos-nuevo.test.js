const test = require('node:test');
const assert = require('node:assert/strict');
const {
  computePedidoSubtotal,
  computePedidoTotals,
  validatePedidoStock,
  nextAvailablePedidoNumber,
} = require('../lib/pedidosNuevo');

test('computePedidoSubtotal usa total si existe o calcula por cantidad', () => {
  const items = [
    { total: 100 },
    { cantidad: 2, precioUnitario: 50 },
    { cantidad: 3, precioUnitario: 0 },
  ];
  assert.equal(computePedidoSubtotal(items), 200);
});

test('computePedidoTotals aplica descuento y correo', () => {
  const items = [{ cantidad: 2, precioUnitario: 50 }];
  const res = computePedidoTotals({
    items,
    descuentoPct: 10,
    aplicaDescuento: true,
    correo: 5,
  });
  assert.equal(res.subtotal, 100);
  assert.equal(res.totalConDescuento, 90);
  assert.equal(res.totalConRecargo, 0);
  assert.equal(res.totalConCorreo, 95);
});

test('computePedidoTotals aplica recargo cuando no hay descuento', () => {
  const items = [{ total: 200 }];
  const res = computePedidoTotals({
    items,
    recargoPct: 20,
    aplicaDescuento: false,
    correo: 10,
  });
  assert.equal(res.subtotal, 200);
  assert.equal(res.totalConDescuento, 0);
  assert.equal(res.totalConRecargo, 240);
  assert.equal(res.totalConCorreo, 250);
});

test('validatePedidoStock rechaza cantidades mayores al stock', () => {
  const items = [{ articulo: 'A1', cantidad: 3 }];
  const res = validatePedidoStock(items, { A1: 2 });
  assert.equal(res.ok, false);
  assert.equal(res.message, 'stock insuficiente');
});

test('validatePedidoStock rechaza acumulado mayor al stock', () => {
  const items = [
    { articulo: 'A1', cantidad: 2 },
    { articulo: 'A1', cantidad: 2 },
  ];
  const res = validatePedidoStock(items, { A1: 3 });
  assert.equal(res.ok, false);
  assert.equal(res.message, 'stock total insuficiente');
});

test('validatePedidoStock permite stock suficiente', () => {
  const items = [
    { articulo: 'A1', cantidad: 2 },
    { articulo: 'A2', cantidad: 1 },
  ];
  const res = validatePedidoStock(items, { A1: 3, A2: 1 });
  assert.equal(res.ok, true);
});

test('nextAvailablePedidoNumber evita repetir numero', () => {
  const res = nextAvailablePedidoNumber(10, [10, 11, 12]);
  assert.equal(res.ok, true);
  assert.equal(res.numero, 13);
});

test('nextAvailablePedidoNumber falla si excede intentos', () => {
  const res = nextAvailablePedidoNumber(5, [5, 6, 7, 8, 9], 3);
  assert.equal(res.ok, false);
});
