const {
  computeNuevaCantidad,
  resolveArticuloValores,
  resolveCompraValores,
  validateBatchItems,
} = require('./abmBatch');

function formatDateTimeLocal(dateObj) {
  const date = dateObj instanceof Date ? dateObj : new Date(dateObj);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  const hours = `${date.getHours()}`.padStart(2, '0');
  const minutes = `${date.getMinutes()}`.padStart(2, '0');
  const seconds = `${date.getSeconds()}`.padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

async function processAbmBatch(conn, ordenCompra, items) {
  const validation = validateBatchItems(items);
  if (!validation.ok) {
    const error = new Error(validation.message);
    error.code = 'VALIDATION';
    throw error;
  }

  const updated = [];
  for (const item of items) {
    const articulo = item.articulo;
    const [[row]] = await conn.query(
      `SELECT Cantidad
       FROM articulos
       WHERE Articulo = ?
       LIMIT 1`,
      [articulo]
    );
    if (!row) throw new Error(`articulo no encontrado: ${articulo}`);
    const baseCantidad = Number(row.Cantidad) || 0;
    const delta = Number(item.cantidadDelta) || 0;
    const resta = !!item.resta;
    const nuevaCantidad = computeNuevaCantidad(baseCantidad, delta, resta);

    const { moneda, precioConvertidoFinal, precioManualFinal, gastosFinal, gananciaFinal } =
      resolveArticuloValores(item.opcion, {
        precioConvertido: item.precioConvertido,
        precioManual: item.precioManual,
        gastos: item.gastos,
        ganancia: item.ganancia,
      });

    await conn.query(
      `UPDATE articulos
       SET Detalle = ?,
           Cantidad = ?,
           PrecioOrigen = ?,
           PrecioConvertido = ?,
           Moneda = ?,
           PrecioManual = ?,
           Gastos = ?,
           Ganancia = ?,
           Proveedor = ?,
           Observaciones = ?
       WHERE Articulo = ?
       LIMIT 1`,
      [
        item.detalle || '',
        nuevaCantidad,
        Number(item.precioOrigen) || 0,
        precioConvertidoFinal,
        moneda,
        precioManualFinal,
        gastosFinal,
        gananciaFinal,
        item.proveedor || '',
        item.observaciones || '',
        articulo,
      ]
    );

    const tipoOrden = resta ? 1 : 2;
    const { precioArgen, compraGastos, compraGanancia } = resolveCompraValores(item.opcion, {
      precioManualFinal,
      precioConvertidoFinal,
      gastos: item.gastos,
      ganancia: item.ganancia,
      gastosProveedor: item.gastosProveedor,
      gananciaProveedor: item.gananciaProveedor,
    });
    const now = new Date();
    const fechaCompra = formatDateTimeLocal(now);
    const orden = Number(item.ordenCompra ?? ordenCompra) || 0;

    const compraColumns = [
      'OrdenCompra',
      'Articulo',
      'Detalle',
      'Cantidad',
      'PrecioOrigen',
      'PrecioArgen',
      'Gastos',
      'Ganancia',
      'Proveedor',
      'Pais',
      'FechaCompra',
      'TipoOrden',
      'Observaciones',
    ];
    const compraValues = [
      orden,
      articulo,
      item.detalle || '',
      delta,
      Number(item.precioOrigen) || 0,
      precioArgen,
      compraGastos,
      compraGanancia,
      item.proveedor || '',
      item.paisProveedor || '',
      fechaCompra,
      tipoOrden,
      item.observaciones || '',
    ];

    try {
      await conn.query(
        `INSERT INTO compras (${compraColumns.join(',')})
         VALUES (${compraColumns.map(() => '?').join(',')})`,
        compraValues
      );
    } catch (error) {
      if (error.code === 'ER_BAD_FIELD_ERROR') {
        const idx = compraColumns.indexOf('Ganancia');
        const cols = compraColumns.filter((c) => c !== 'Ganancia');
        const vals = compraValues.filter((_, i) => i !== idx);
        await conn.query(
          `INSERT INTO compras (${cols.join(',')})
           VALUES (${cols.map(() => '?').join(',')})`,
          vals
        );
      } else {
        throw error;
      }
    }

    updated.push({
      articulo,
      detalle: item.detalle || '',
      cantidad: nuevaCantidad,
      proveedor: item.proveedor || '',
    });
  }

  await conn.query('UPDATE ordencompras SET NumeroOrden = NumeroOrden + 1');
  return updated;
}

module.exports = {
  processAbmBatch,
};
