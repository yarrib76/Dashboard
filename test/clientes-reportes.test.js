const test = require('node:test');
const assert = require('node:assert/strict');
const {
  CLIENTE_ESTADOS,
  classifyClienteEstado,
  enrichClienteReporteRow,
  buildClientesResumen,
} = require('../lib/clientesReportes');

test('classifyClienteEstado respeta cortes 90/180/365', () => {
  assert.equal(classifyClienteEstado(0), CLIENTE_ESTADOS.ACTIVO);
  assert.equal(classifyClienteEstado(90), CLIENTE_ESTADOS.ACTIVO);
  assert.equal(classifyClienteEstado(91), CLIENTE_ESTADOS.BAJA_FRECUENCIA);
  assert.equal(classifyClienteEstado(180), CLIENTE_ESTADOS.BAJA_FRECUENCIA);
  assert.equal(classifyClienteEstado(181), CLIENTE_ESTADOS.EN_RIESGO);
  assert.equal(classifyClienteEstado(365), CLIENTE_ESTADOS.EN_RIESGO);
  assert.equal(classifyClienteEstado(366), CLIENTE_ESTADOS.INACTIVO);
});

test('classifyClienteEstado marca sin compras cuando no hay ultima compra', () => {
  assert.equal(classifyClienteEstado(null), CLIENTE_ESTADOS.SIN_COMPRAS);
  assert.equal(classifyClienteEstado(undefined), CLIENTE_ESTADOS.SIN_COMPRAS);
  assert.equal(classifyClienteEstado(''), CLIENTE_ESTADOS.SIN_COMPRAS);
});

test('enrichClienteReporteRow calcula agregados derivados', () => {
  const row = enrichClienteReporteRow({
    id: 10,
    diasSinComprar: 91,
    cantComprasHistorico: 4,
    compras12m: 2,
    monto12m: 5000.257,
    montoHistorico: 10000,
  });

  assert.equal(row.estado, CLIENTE_ESTADOS.BAJA_FRECUENCIA);
  assert.equal(row.cantComprasHistorico, 4);
  assert.equal(row.compras12m, 2);
  assert.equal(row.monto12m, 5000.26);
  assert.equal(row.montoHistorico, 10000);
  assert.equal(row.ticketPromedio, 2500);
});

test('buildClientesResumen agrupa estados y promedia ticket', () => {
  const resumen = buildClientesResumen([
    enrichClienteReporteRow({ diasSinComprar: 30, cantComprasHistorico: 2, montoHistorico: 2000, monto12m: 1500 }),
    enrichClienteReporteRow({ diasSinComprar: 45, cantComprasHistorico: 1, montoHistorico: 500, monto12m: 500 }),
    enrichClienteReporteRow({ diasSinComprar: null, cantComprasHistorico: 0, montoHistorico: 0, monto12m: 0 }),
  ]);
  const activo = resumen.find((row) => row.estado === CLIENTE_ESTADOS.ACTIVO);
  const sinCompras = resumen.find((row) => row.estado === CLIENTE_ESTADOS.SIN_COMPRAS);

  assert.equal(activo.total, 2);
  assert.equal(activo.monto12m, 2000);
  assert.equal(activo.ticketPromedio, 750);
  assert.equal(sinCompras.total, 1);
});
