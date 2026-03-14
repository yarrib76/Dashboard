const test = require('node:test');
const assert = require('node:assert/strict');
const {
  validateDashboardComparativoParams,
  buildComparativoSeries,
  computeInflacionSeries,
  buildDashboardComparativoPayload,
  buildInflacionApiPayload,
  computeInflacionAcumulada,
  computeMontoRealSeries,
  computeVariacionInteranual,
} = require('../lib/dashboardComparativo');

test('validateDashboardComparativoParams rechaza años faltantes', () => {
  const res = validateDashboardComparativoParams({
    year_a: '',
    year_b: '2026',
    month_from: '1',
    month_to: '2',
    mode: 'cantidad',
    entity: 'pedidos',
  });
  assert.equal(res.ok, false);
  assert.equal(res.message, 'year_a y year_b son obligatorios y numericos');
});

test('validateDashboardComparativoParams rechaza rango de meses invalido', () => {
  const res = validateDashboardComparativoParams({
    year_a: '2025',
    year_b: '2026',
    month_from: '6',
    month_to: '4',
    mode: 'cantidad',
    entity: 'pedidos',
  });
  assert.equal(res.ok, false);
  assert.equal(res.message, 'month_from no puede ser mayor que month_to');
});

test('validateDashboardComparativoParams fuerza facturas cuando el modo es monto', () => {
  const res = validateDashboardComparativoParams({
    year_a: '2025',
    year_b: '2026',
    month_from: '1',
    month_to: '3',
    mode: 'monto',
    entity: 'pedidos',
  });
  assert.equal(res.ok, true);
  assert.equal(res.data.entity, 'facturas');
});

test('buildComparativoSeries completa meses sin datos con 0', () => {
  const res = buildComparativoSeries(
    [
      { mes: 1, valor: 10 },
      { mes: 3, valor: 25 },
    ],
    1,
    4
  );
  assert.deepEqual(res.labels, ['Ene', 'Feb', 'Mar', 'Abr']);
  assert.deepEqual(res.values, [10, 0, 25, 0]);
});

test('buildDashboardComparativoPayload devuelve dos series alineadas', () => {
  const res = buildDashboardComparativoPayload(
    {
      yearA: 2025,
      yearB: 2026,
      monthFrom: 1,
      monthTo: 2,
      mode: 'cantidad',
      entity: 'pedidos',
    },
    [{ mes: 1, valor: 5 }],
    [{ mes: 2, valor: 9 }]
  );
  assert.deepEqual(res.labels, ['Ene', 'Feb']);
  assert.deepEqual(res.series, [
    { year: 2025, values: [5, 0] },
    { year: 2026, values: [0, 9] },
  ]);
  assert.deepEqual(res.meta, {
    mode: 'cantidad',
    entity: 'pedidos',
    month_from: 1,
    month_to: 2,
  });
});

test('computeInflacionSeries toma el ultimo precio del mes y calcula variacion', () => {
  const res = computeInflacionSeries(
    [
      { Articulo: 'A1', PrecioArgen: 100, FechaCompra: '2024-12-10 10:00:00' },
      { Articulo: 'A1', PrecioArgen: 120, FechaCompra: '2025-01-05 10:00:00' },
      { Articulo: 'A1', PrecioArgen: 150, FechaCompra: '2025-01-28 10:00:00' },
      { Articulo: 'A1', PrecioArgen: 180, FechaCompra: '2025-02-08 10:00:00' },
    ],
    { yearA: 2025, yearB: 2024, monthFrom: 1, monthTo: 2 }
  );
  assert.deepEqual(res.labels, ['Ene', 'Feb']);
  assert.deepEqual(res.series[0], { year: 2025, values: [0, 20] });
  assert.deepEqual(res.series[1], { year: 2024, values: [0, 0] });
});

test('computeInflacionSeries excluye articulos sin precio previo comparable', () => {
  const res = computeInflacionSeries(
    [
      { Articulo: 'A1', PrecioArgen: 100, FechaCompra: '2025-01-10 10:00:00' },
      { Articulo: 'A2', PrecioArgen: 200, FechaCompra: '2024-12-10 10:00:00' },
      { Articulo: 'A2', PrecioArgen: 220, FechaCompra: '2025-01-10 10:00:00' },
    ],
    { yearA: 2025, yearB: 2024, monthFrom: 1, monthTo: 1 }
  );
  assert.deepEqual(res.series[0], { year: 2025, values: [0] });
});

test('computeInflacionSeries calcula acumulado del periodo', () => {
  const res = computeInflacionSeries(
    [
      { Articulo: 'A1', PrecioArgen: 100, FechaCompra: '2024-12-10 10:00:00' },
      { Articulo: 'A1', PrecioArgen: 110, FechaCompra: '2025-01-10 10:00:00' },
      { Articulo: 'A1', PrecioArgen: 121, FechaCompra: '2025-02-10 10:00:00' },
      { Articulo: 'A1', PrecioArgen: 100, FechaCompra: '2023-12-10 10:00:00' },
      { Articulo: 'A1', PrecioArgen: 120, FechaCompra: '2024-01-10 10:00:00' },
      { Articulo: 'A1', PrecioArgen: 132, FechaCompra: '2024-02-10 10:00:00' },
    ],
    { yearA: 2025, yearB: 2024, monthFrom: 1, monthTo: 2 }
  );
  assert.equal(res.summary.yearA.cumulativePct, 10);
  assert.equal(res.summary.yearB.cumulativePct, 10);
  assert.equal(res.summary.differencePct, 0);
  assert.equal(res.allSeries.length, 2);
  assert.deepEqual(res.allSeries[0].values.slice(0, 2), [0, 10]);
});

test('computeInflacionSeries excluye outliers por base baja y variacion extrema', () => {
  const res = computeInflacionSeries(
    [
      { Articulo: 'OK', PrecioArgen: 200, FechaCompra: '2025-11-10 10:00:00' },
      { Articulo: 'OK', PrecioArgen: 220, FechaCompra: '2025-12-10 10:00:00' },
      { Articulo: 'LOW_BASE', PrecioArgen: 1, FechaCompra: '2025-11-10 10:00:00' },
      { Articulo: 'LOW_BASE', PrecioArgen: 2250, FechaCompra: '2025-12-10 10:00:00' },
      { Articulo: 'HIGH_JUMP', PrecioArgen: 100, FechaCompra: '2025-11-10 10:00:00' },
      { Articulo: 'HIGH_JUMP', PrecioArgen: 500, FechaCompra: '2025-12-10 10:00:00' },
      { Articulo: 'LOW_DROP', PrecioArgen: 1000, FechaCompra: '2025-11-10 10:00:00' },
      { Articulo: 'LOW_DROP', PrecioArgen: 100, FechaCompra: '2025-12-10 10:00:00' },
    ],
    { yearA: 2025, yearB: 2024, monthFrom: 12, monthTo: 12 }
  );

  assert.deepEqual(res.series[0], { year: 2025, values: [10] });
  assert.deepEqual(res.series[1], { year: 2024, values: [0] });
});

test('computeInflacionAcumulada compone inflación mensual', () => {
  const res = computeInflacionAcumulada([10, 20, 0]);
  assert.deepEqual(res, [10, 32, 32]);
});

test('computeMontoRealSeries deflacta nominal por inflación acumulada', () => {
  const res = computeMontoRealSeries([1100, 1320], [10, 32]);
  assert.deepEqual(res, [1000, 1000]);
});

test('computeVariacionInteranual calcula crecimiento porcentual y protege base cero', () => {
  assert.equal(computeVariacionInteranual(100, 125), 25);
  assert.equal(computeVariacionInteranual(0, 125), null);
});

test('buildInflacionApiPayload arma series mensuales desde la API externa', () => {
  const res = buildInflacionApiPayload(
    [
      { fecha: '2023-01-01', valor: 6 },
      { fecha: '2023-02-01', valor: 10 },
      { fecha: '2024-01-01', valor: 20 },
      { fecha: '2024-02-01', valor: 10 },
    ],
    { yearA: 2024, yearB: 2023, monthFrom: 1, monthTo: 2 }
  );

  assert.deepEqual(res.labels, ['Ene', 'Feb']);
  assert.deepEqual(res.series, [
    { year: 2024, values: [20, 10] },
    { year: 2023, values: [6, 10] },
  ]);
  assert.equal(res.summary.yearA.cumulativePct, 32);
  assert.equal(res.summary.yearB.cumulativePct, 16.6);
  assert.equal(res.source.name, 'ArgentinaDatos');
});
