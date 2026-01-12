const test = require('node:test');
const assert = require('node:assert/strict');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const { processAbmBatch } = require('../lib/abmBatchService');
const { resolveArticuloValores, resolveCompraValores, computeNuevaCantidad } = require('../lib/abmBatch');

dotenv.config();

const dbConfig = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 4,
};

let pool;

test('ABM batch integration', async (t) => {
  if (process.env.RUN_INTEGRATION_TESTS !== '1') {
    t.skip('RUN_INTEGRATION_TESTS!=1');
    return;
  }
  pool = mysql.createPool(dbConfig);

  const getObservacionesMax = async (conn) => {
    const [rows] = await conn.query(
      `SELECT TABLE_NAME, COLUMN_NAME, CHARACTER_MAXIMUM_LENGTH AS maxLen
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND COLUMN_NAME = 'Observaciones'
         AND TABLE_NAME IN ('articulos', 'compras')`
    );
    const map = new Map(rows.map((r) => [r.TABLE_NAME, r.maxLen]));
    const artLen = map.get('articulos') || 200;
    const compLen = map.get('compras') || 200;
    return Math.min(artLen, compLen);
  };

  const buildItemFromRow = (row, idx, overrides = {}) => {
    const opcion =
      row.Moneda === 'uSs'
        ? 'opcion_dolares'
        : row.Moneda === 'ARG'
          ? 'opcion_pesos'
          : 'opcion_manual';
    return {
      articulo: row.Articulo,
      detalle: `UTEST DETALLE ${idx}`,
      baseCantidad: Number(row.Cantidad) || 0,
      cantidadDelta: 1,
      resta: false,
      precioOrigen: row.PrecioOrigen ?? 0,
      precioConvertido: row.PrecioConvertido ?? 0,
      precioManual: row.PrecioManual ?? 0,
      gastos: opcion === 'opcion_manual' ? 1.1 : row.Gastos ?? 0,
      ganancia: opcion === 'opcion_manual' ? 1.2 : row.Ganancia ?? 0,
      proveedor: row.Proveedor || '',
      observaciones: `UTEST OBS ${idx}`,
      opcion,
      paisProveedor: '',
      gastosProveedor: 1.1,
      gananciaProveedor: 1.2,
      ordenCompra: 0,
      ...overrides,
    };
  };

  await t.test('procesa 100 articulos en una misma orden', async (t2) => {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [comprasCols] = await conn.query(
        `SELECT COLUMN_NAME
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'compras'`
      );
      const hasGanancia = comprasCols.some((row) => row.COLUMN_NAME === 'Ganancia');

      const [[ordenRow]] = await conn.query('SELECT NumeroOrden FROM ordencompras LIMIT 1');
      const baseOrden = Number(ordenRow?.NumeroOrden) || 0;
      const ordenCompra = baseOrden + 900000;

      const [rows] = await conn.query(
        `SELECT Articulo, Detalle, Cantidad, PrecioOrigen, PrecioConvertido, Moneda, PrecioManual, Gastos, Ganancia, Proveedor
         FROM articulos
         ORDER BY Articulo
         LIMIT 100`
      );

      if (rows.length < 100) {
        t2.skip(`Se requieren 100 articulos y solo hay ${rows.length}.`);
        await conn.rollback();
        return;
      }

      const items = rows.map((row, idx) => buildItemFromRow(row, idx, { ordenCompra }));

      const updated = await processAbmBatch(conn, ordenCompra, items);
      assert.equal(updated.length, 100);

      const [articulosAfter] = await conn.query(
        `SELECT Articulo, Detalle, Cantidad, PrecioOrigen, PrecioConvertido, Moneda, PrecioManual, Gastos, Ganancia, Proveedor, Observaciones
         FROM articulos
         WHERE Articulo IN (${items.map(() => '?').join(',')})`,
        items.map((i) => i.articulo)
      );
      const articulosMap = new Map(articulosAfter.map((row) => [row.Articulo, row]));
      items.forEach((item) => {
        const after = articulosMap.get(item.articulo);
        assert.ok(after, `articulo no encontrado: ${item.articulo}`);
        const { moneda, precioConvertidoFinal, precioManualFinal, gastosFinal, gananciaFinal } =
          resolveArticuloValores(item.opcion, {
            precioConvertido: item.precioConvertido,
            precioManual: item.precioManual,
            gastos: item.gastos,
            ganancia: item.ganancia,
          });
        const expectedCantidad = computeNuevaCantidad(item.baseCantidad, item.cantidadDelta, item.resta);
        assert.equal(after.Detalle, item.detalle);
        assert.equal(Number(after.PrecioOrigen) || 0, Number(item.precioOrigen) || 0);
        assert.equal(Number(after.PrecioConvertido) || 0, precioConvertidoFinal);
        assert.equal(after.Moneda || '', moneda);
        assert.equal(Number(after.PrecioManual) || 0, precioManualFinal);
        assert.equal(Number(after.Gastos) || 0, gastosFinal);
        assert.equal(Number(after.Ganancia) || 0, gananciaFinal);
        assert.equal(after.Proveedor || '', item.proveedor || '');
        assert.equal(after.Observaciones || '', item.observaciones || '');
        assert.equal(Number(after.Cantidad) || 0, expectedCantidad);
      });

      const [[comprasRow]] = await conn.query(
        'SELECT COUNT(*) AS total FROM compras WHERE OrdenCompra = ?',
        [ordenCompra]
      );
      assert.ok(Number(comprasRow?.total) >= 100);

      const [comprasRows] = await conn.query(
        `SELECT OrdenCompra, Articulo, Detalle, Cantidad, PrecioOrigen, PrecioArgen, Gastos, Proveedor, Pais, TipoOrden, Observaciones${
          hasGanancia ? ', Ganancia' : ''
        }
         FROM compras
         WHERE OrdenCompra = ?`,
        [ordenCompra]
      );
      const comprasMap = new Map(comprasRows.map((row) => [row.Articulo, row]));
      items.forEach((item) => {
        const compra = comprasMap.get(item.articulo);
        assert.ok(compra, `compra no encontrada: ${item.articulo}`);
        const { precioConvertidoFinal, precioManualFinal } = resolveArticuloValores(item.opcion, {
          precioConvertido: item.precioConvertido,
          precioManual: item.precioManual,
          gastos: item.gastos,
          ganancia: item.ganancia,
        });
        const { precioArgen, compraGastos, compraGanancia } = resolveCompraValores(item.opcion, {
          precioManualFinal,
          precioConvertidoFinal,
          gastos: item.gastos,
          ganancia: item.ganancia,
          gastosProveedor: item.gastosProveedor,
          gananciaProveedor: item.gananciaProveedor,
        });
        assert.equal(Number(compra.OrdenCompra) || 0, ordenCompra);
        assert.equal(compra.Detalle, item.detalle);
        assert.equal(Number(compra.Cantidad) || 0, Number(item.cantidadDelta) || 0);
        assert.equal(Number(compra.PrecioOrigen) || 0, Number(item.precioOrigen) || 0);
        assert.equal(Number(compra.PrecioArgen) || 0, precioArgen);
        assert.equal(Number(compra.Gastos) || 0, compraGastos);
        if (hasGanancia) {
          assert.equal(Number(compra.Ganancia) || 0, compraGanancia);
        }
        assert.equal(compra.Proveedor || '', item.proveedor || '');
        assert.equal(compra.Pais || '', item.paisProveedor || '');
        assert.equal(Number(compra.TipoOrden) || 0, 2);
        assert.equal(compra.Observaciones || '', item.observaciones || '');
      });

      const [[ordenAfter]] = await conn.query('SELECT NumeroOrden FROM ordencompras LIMIT 1');
      assert.equal(Number(ordenAfter?.NumeroOrden) || 0, baseOrden + 1);

      await conn.rollback();
    } finally {
      conn.release();
    }
  });

  await t.test('resta stock correctamente', async () => {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [[row]] = await conn.query(
        `SELECT Articulo, Detalle, Cantidad, PrecioOrigen, PrecioConvertido, Moneda, PrecioManual, Gastos, Ganancia, Proveedor
         FROM articulos
         ORDER BY Articulo
         LIMIT 1`
      );
      if (!row) {
        await conn.rollback();
        return;
      }
      const ordenCompra = 920000;
      const item = buildItemFromRow(row, 1, { ordenCompra, cantidadDelta: 2, resta: true });
      await processAbmBatch(conn, ordenCompra, [item]);
      const [[after]] = await conn.query('SELECT Cantidad FROM articulos WHERE Articulo = ? LIMIT 1', [row.Articulo]);
      const expected = computeNuevaCantidad(item.baseCantidad, item.cantidadDelta, true);
      assert.equal(Number(after?.Cantidad) || 0, expected);
      await conn.rollback();
    } finally {
      conn.release();
    }
  });

  await t.test('acepta cantidadDelta 0 y valores decimales', async () => {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [[row]] = await conn.query(
        `SELECT Articulo, Detalle, Cantidad, PrecioOrigen, PrecioConvertido, Moneda, PrecioManual, Gastos, Ganancia, Proveedor
         FROM articulos
         ORDER BY Articulo
         LIMIT 1`
      );
      if (!row) {
        await conn.rollback();
        return;
      }
      const ordenCompra = 930000;
      const item = buildItemFromRow(row, 2, {
        ordenCompra,
        cantidadDelta: 0,
        precioOrigen: 123.45,
        precioConvertido: 67.89,
      });
      await processAbmBatch(conn, ordenCompra, [item]);
      const [[after]] = await conn.query(
        'SELECT PrecioOrigen, PrecioConvertido, Cantidad FROM articulos WHERE Articulo = ? LIMIT 1',
        [row.Articulo]
      );
      assert.equal(Number(after?.PrecioOrigen) || 0, 123.45);
      assert.equal(Number(after?.PrecioConvertido) || 0, item.opcion === 'opcion_manual' ? 0 : 67.89);
      assert.equal(Number(after?.Cantidad) || 0, item.baseCantidad);
      await conn.rollback();
    } finally {
      conn.release();
    }
  });

  await t.test('opcion invalida usa modo manual', async () => {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [[row]] = await conn.query(
        `SELECT Articulo, Detalle, Cantidad, PrecioOrigen, PrecioConvertido, Moneda, PrecioManual, Gastos, Ganancia, Proveedor
         FROM articulos
         ORDER BY Articulo
         LIMIT 1`
      );
      if (!row) {
        await conn.rollback();
        return;
      }
      const ordenCompra = 940000;
      const item = buildItemFromRow(row, 3, {
        ordenCompra,
        opcion: 'opcion_invalida',
        precioManual: 99.99,
        gastos: 1.25,
        ganancia: 1.5,
      });
      await processAbmBatch(conn, ordenCompra, [item]);
      const [[after]] = await conn.query(
        'SELECT Moneda, PrecioConvertido, PrecioManual, Gastos, Ganancia FROM articulos WHERE Articulo = ? LIMIT 1',
        [row.Articulo]
      );
      assert.equal(after?.Moneda || '', '');
      assert.equal(Number(after?.PrecioConvertido) || 0, 0);
      assert.equal(Number(after?.PrecioManual) || 0, 99.99);
      assert.equal(Number(after?.Gastos) || 0, 1.25);
      assert.equal(Number(after?.Ganancia) || 0, 1.5);
      await conn.rollback();
    } finally {
      conn.release();
    }
  });

  await t.test('proveedor vacio y observaciones largas', async () => {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [[row]] = await conn.query(
        `SELECT Articulo, Detalle, Cantidad, PrecioOrigen, PrecioConvertido, Moneda, PrecioManual, Gastos, Ganancia, Proveedor
         FROM articulos
         ORDER BY Articulo
         LIMIT 1`
      );
      if (!row) {
        await conn.rollback();
        return;
      }
      const maxLen = await getObservacionesMax(conn);
      const longObs = 'OBS'.padEnd(Math.max(10, maxLen - 2), 'X');
      const ordenCompra = 950000;
      const item = buildItemFromRow(row, 4, {
        ordenCompra,
        proveedor: '',
        observaciones: longObs,
      });
      await processAbmBatch(conn, ordenCompra, [item]);
      const [[after]] = await conn.query(
        'SELECT Proveedor, Observaciones FROM articulos WHERE Articulo = ? LIMIT 1',
        [row.Articulo]
      );
      assert.equal(after?.Proveedor || '', '');
      assert.ok((after?.Observaciones || '').startsWith('OBS'));
      await conn.rollback();
    } finally {
      conn.release();
    }
  });

  await t.test('permite articulos duplicados en batch', async () => {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [[row]] = await conn.query(
        `SELECT Articulo, Detalle, Cantidad, PrecioOrigen, PrecioConvertido, Moneda, PrecioManual, Gastos, Ganancia, Proveedor
         FROM articulos
         ORDER BY Articulo
         LIMIT 1`
      );
      if (!row) {
        await conn.rollback();
        return;
      }
      const ordenCompra = 960000;
      const item = buildItemFromRow(row, 5, { ordenCompra });
      const result = await processAbmBatch(conn, ordenCompra, [item, item]);
      assert.ok(Array.isArray(result));
      await conn.rollback();
    } finally {
      conn.release();
    }
  });

  await t.test('hace rollback ante error en batch', async () => {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [[ordenRow]] = await conn.query('SELECT NumeroOrden FROM ordencompras LIMIT 1');
      const baseOrden = Number(ordenRow?.NumeroOrden) || 0;
      const ordenCompra = baseOrden + 910000;

      const [[row]] = await conn.query(
        `SELECT Articulo, Detalle, Cantidad, PrecioOrigen, PrecioConvertido, Moneda, PrecioManual, Gastos, Ganancia, Proveedor
         FROM articulos
         ORDER BY Articulo
         LIMIT 1`
      );
      if (!row) {
        await conn.rollback();
        return;
      }
      const originalCantidad = Number(row.Cantidad) || 0;

      const opcion =
        row.Moneda === 'uSs' ? 'opcion_dolares' : row.Moneda === 'ARG' ? 'opcion_pesos' : 'opcion_manual';
      const items = [
        {
          articulo: row.Articulo,
          detalle: row.Detalle || 'UTEST DETALLE',
          cantidadDelta: 2,
          resta: false,
          precioOrigen: row.PrecioOrigen ?? 0,
          precioConvertido: row.PrecioConvertido ?? 0,
          precioManual: row.PrecioManual ?? 0,
          gastos: opcion === 'opcion_manual' ? 1.1 : row.Gastos ?? 0,
          ganancia: opcion === 'opcion_manual' ? 1.2 : row.Ganancia ?? 0,
          proveedor: row.Proveedor || '',
          observaciones: 'UTEST ERROR',
          opcion,
          paisProveedor: '',
          gastosProveedor: 1.1,
          gananciaProveedor: 1.2,
          ordenCompra,
        },
        {
          articulo: 'UTEST-NO-EXISTE',
          detalle: 'Invalido',
          cantidadDelta: 1,
          resta: false,
          precioOrigen: 0,
          precioConvertido: 0,
          precioManual: 0,
          gastos: 0,
          ganancia: 0,
          proveedor: '',
          observaciones: 'Invalido',
          opcion: 'opcion_manual',
          paisProveedor: '',
          gastosProveedor: 0,
          gananciaProveedor: 0,
          ordenCompra,
        },
      ];

      await assert.rejects(
        () => processAbmBatch(conn, ordenCompra, items),
        /articulo no encontrado/i
      );

      await conn.rollback();

      const [[rowAfter]] = await conn.query(
        'SELECT Cantidad FROM articulos WHERE Articulo = ? LIMIT 1',
        [row.Articulo]
      );
      assert.equal(Number(rowAfter?.Cantidad) || 0, originalCantidad);

      const [[comprasRow]] = await conn.query(
        'SELECT COUNT(*) AS total FROM compras WHERE OrdenCompra = ?',
        [ordenCompra]
      );
      assert.equal(Number(comprasRow?.total) || 0, 0);
    } finally {
      conn.release();
    }
  });

  await pool.end();
});
