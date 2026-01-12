const test = require('node:test');
const assert = require('node:assert/strict');
const {
  computeNuevaCantidad,
  resolveArticuloValores,
  resolveCompraValores,
  validateBatchItems,
} = require('../lib/abmBatch');

test('computeNuevaCantidad suma y resta correctamente', () => {
  assert.equal(computeNuevaCantidad(10, 3, false), 13);
  assert.equal(computeNuevaCantidad(10, 3, true), 7);
});

test('resolveArticuloValores para dolares/pesos deja ganancia en 0', () => {
  const dolares = resolveArticuloValores('opcion_dolares', {
    precioConvertido: 120,
    precioManual: 50,
    gastos: 2,
    ganancia: 3,
  });
  assert.equal(dolares.moneda, 'uSs');
  assert.equal(dolares.precioConvertidoFinal, 120);
  assert.equal(dolares.precioManualFinal, 0);
  assert.equal(dolares.gastosFinal, 0);
  assert.equal(dolares.gananciaFinal, 0);

  const pesos = resolveArticuloValores('opcion_pesos', {
    precioConvertido: 80,
    precioManual: 50,
    gastos: 2,
    ganancia: 3,
  });
  assert.equal(pesos.moneda, 'ARG');
  assert.equal(pesos.precioConvertidoFinal, 80);
  assert.equal(pesos.precioManualFinal, 0);
  assert.equal(pesos.gastosFinal, 0);
  assert.equal(pesos.gananciaFinal, 0);
});

test('resolveArticuloValores para manual usa precio manual y gastos/ganancia', () => {
  const manual = resolveArticuloValores('opcion_manual', {
    precioConvertido: 80,
    precioManual: 50,
    gastos: 2,
    ganancia: 3,
  });
  assert.equal(manual.moneda, '');
  assert.equal(manual.precioConvertidoFinal, 0);
  assert.equal(manual.precioManualFinal, 50);
  assert.equal(manual.gastosFinal, 2);
  assert.equal(manual.gananciaFinal, 3);
});

test('resolveCompraValores usa gastos/ganancia de proveedor cuando no es manual', () => {
  const nonManual = resolveCompraValores('opcion_dolares', {
    precioManualFinal: 50,
    precioConvertidoFinal: 120,
    gastos: 2,
    ganancia: 3,
    gastosProveedor: 1.2,
    gananciaProveedor: 1.5,
  });
  assert.equal(nonManual.precioArgen, 120);
  assert.equal(nonManual.compraGastos, 1.2);
  assert.equal(nonManual.compraGanancia, 1.5);
});

test('resolveCompraValores usa gastos/ganancia manual cuando es manual', () => {
  const manual = resolveCompraValores('opcion_manual', {
    precioManualFinal: 50,
    precioConvertidoFinal: 120,
    gastos: 2,
    ganancia: 3,
    gastosProveedor: 1.2,
    gananciaProveedor: 1.5,
  });
  assert.equal(manual.precioArgen, 50);
  assert.equal(manual.compraGastos, 2);
  assert.equal(manual.compraGanancia, 3);
});

test('validateBatchItems detecta vacios y permite duplicados', () => {
  assert.equal(validateBatchItems([]).ok, false);
  assert.equal(validateBatchItems([{ articulo: '' }]).ok, false);
  const dup = validateBatchItems([{ articulo: 'A1' }, { articulo: 'A1' }]);
  assert.equal(dup.ok, true);
  const ok = validateBatchItems([{ articulo: 'A1' }, { articulo: 'A2' }]);
  assert.equal(ok.ok, true);
});
