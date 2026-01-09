const test = require('node:test');
const assert = require('node:assert/strict');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const { processAbmCreate } = require('../lib/abmCreateService');

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

test('ABM create integration', async (t) => {
  if (process.env.RUN_INTEGRATION_TESTS !== '1') {
    t.skip('RUN_INTEGRATION_TESTS!=1');
    return;
  }

  pool = mysql.createPool(dbConfig);

  const pickAvailableBase = async (conn) => {
    for (let i = 0; i < 10; i += 1) {
      const base = String(90000000 + Math.floor(Math.random() * 9000000));
      const codigo = `7798${base}`;
      const [[exists]] = await conn.query(
        'SELECT 1 AS ok FROM articulos WHERE Articulo LIKE ? LIMIT 1',
        [`${codigo}%`]
      );
      if (!exists) return base;
    }
    return null;
  };

  await t.test('crea articulo y compras en una transaccion', async () => {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [[ordenRow]] = await conn.query('SELECT NumeroOrden FROM ordencompras LIMIT 1');
      const baseOrden = Number(ordenRow?.NumeroOrden) || 0;
      const ordenCompra = baseOrden + 880000;

      const [[provRow]] = await conn.query(
        `SELECT Proveedor
         FROM articulos
         WHERE Proveedor IS NOT NULL AND Proveedor <> ''
         LIMIT 1`
      );
      const proveedor = provRow?.Proveedor || 'ProveedorTest';

      const baseDigits = await pickAvailableBase(conn);
      if (!baseDigits) {
        await conn.rollback();
        return;
      }

      const payload = {
        articuloBase: baseDigits,
        detalle: 'UTEST NUEVO',
        proveedorSku: 'UTEST-SKU-01',
        cantidad: 5,
        precioOrigen: 100,
        precioConvertido: 200,
        precioManual: 0,
        gastos: 0,
        ganancia: 0,
        proveedor,
        observaciones: 'UTEST OBS',
        ordenCompra,
        opcion: 'opcion_pesos',
        paisProveedor: '',
        gastosProveedor: 1.1,
        gananciaProveedor: 1.2,
      };

      const created = await processAbmCreate(conn, payload);
      assert.ok(created.articulo.startsWith('7798'));
      assert.equal(created.articulo.length, 13);
      assert.equal(created.moneda, 'ARG');

      const [[artRow]] = await conn.query(
        `SELECT Articulo, Detalle, ProveedorSKU, Cantidad, PrecioOrigen, PrecioConvertido, Moneda, PrecioManual, Gastos, Ganancia, Proveedor, Observaciones
         FROM articulos
         WHERE Articulo = ?
         LIMIT 1`,
        [created.articulo]
      );
      assert.ok(artRow, 'articulo no encontrado');
      assert.equal(artRow.Detalle, payload.detalle);
      assert.equal(artRow.ProveedorSKU || '', payload.proveedorSku);
      assert.equal(Number(artRow.Cantidad) || 0, payload.cantidad);
      assert.equal(Number(artRow.PrecioOrigen) || 0, payload.precioOrigen);
      assert.equal(Number(artRow.PrecioConvertido) || 0, created.precioConvertidoFinal);
      assert.equal(artRow.Moneda || '', 'ARG');
      assert.equal(Number(artRow.PrecioManual) || 0, 0);
      assert.equal(Number(artRow.Gastos) || 0, 0);
      assert.equal(Number(artRow.Ganancia) || 0, 0);
      assert.equal(artRow.Proveedor || '', proveedor);
      assert.equal(artRow.Observaciones || '', payload.observaciones);

      const [comprasCols] = await conn.query(
        `SELECT COLUMN_NAME
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'compras'`
      );
      const hasGanancia = comprasCols.some((row) => row.COLUMN_NAME === 'Ganancia');

      const [[compRow]] = await conn.query(
        `SELECT OrdenCompra, Articulo, Detalle, Cantidad, PrecioOrigen, PrecioArgen, Gastos, Proveedor, Pais, TipoOrden, Observaciones${
          hasGanancia ? ', Ganancia' : ''
        }
         FROM compras
         WHERE OrdenCompra = ? AND Articulo = ?
         LIMIT 1`,
        [ordenCompra, created.articulo]
      );
      assert.ok(compRow, 'compra no encontrada');
      assert.equal(Number(compRow.OrdenCompra) || 0, ordenCompra);
      assert.equal(compRow.Detalle, payload.detalle);
      assert.equal(Number(compRow.Cantidad) || 0, payload.cantidad);
      assert.equal(Number(compRow.PrecioOrigen) || 0, payload.precioOrigen);
      assert.equal(Number(compRow.PrecioArgen) || 0, created.precioArgen);
      assert.equal(Number(compRow.Gastos) || 0, created.compraGastos);
      if (hasGanancia) {
        assert.equal(Number(compRow.Ganancia) || 0, created.compraGanancia);
      }
      assert.equal(compRow.Proveedor || '', proveedor);
      assert.equal(compRow.TipoOrden || 0, 2);
      assert.equal(compRow.Observaciones || '', payload.observaciones);

      const [[ordenAfter]] = await conn.query('SELECT NumeroOrden FROM ordencompras LIMIT 1');
      assert.equal(Number(ordenAfter?.NumeroOrden) || 0, baseOrden + 1);

      await conn.rollback();
    } finally {
      conn.release();
    }
  });

  await t.after(async () => {
    if (pool) {
      await pool.end();
    }
  });
});
