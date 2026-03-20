const { resolveArticuloValores, resolveCompraValores } = require('./abmBatch');
const { buildArticuloCodigo } = require('./abmCreate');

async function processAbmCreate(conn, payload = {}) {
  const {
    articuloBase = '',
    detalle = '',
    proveedorSku = '',
    cantidad = 0,
    precioOrigen = 0,
    precioConvertido = 0,
    precioManual = 0,
    gastos = 0,
    ganancia = 0,
    proveedor = '',
    observaciones = '',
    ordenCompra = 0,
    opcion = 'opcion_dolares',
    paisProveedor = '',
    gastosProveedor = 0,
    gananciaProveedor = 0,
  } = payload;

  const articulo = buildArticuloCodigo(articuloBase);
  if (!articulo) {
    const err = new Error('El articulo debe tener 8 digitos.');
    err.code = 'ARTICULO_INVALIDO';
    throw err;
  }

  const { moneda, precioConvertidoFinal, precioManualFinal, gastosFinal, gananciaFinal } =
    resolveArticuloValores(opcion, {
      precioConvertido,
      precioManual,
      gastos,
      ganancia,
    });

  const [[lenRow]] = await conn.query(
    `SELECT CHARACTER_MAXIMUM_LENGTH AS maxLen
     FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = 'compras'
       AND column_name = 'Observaciones'
     LIMIT 1`
  );
  const maxObservaciones = Number(lenRow?.maxLen) || 255;
  const observacionesCompra = (observaciones || '').toString().slice(0, maxObservaciones);

  await conn.query(
    `INSERT INTO articulos
       (Articulo, Detalle, ProveedorSKU, Cantidad, PrecioOrigen, PrecioConvertido, Moneda, PrecioManual, Gastos, Ganancia, Proveedor)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      articulo,
      detalle || '',
      proveedorSku || '',
      Number(cantidad) || 0,
      Number(precioOrigen) || 0,
      precioConvertidoFinal,
      moneda,
      precioManualFinal,
      gastosFinal,
      gananciaFinal,
      proveedor || '',
    ]
  );

  const tipoOrden = 2;
  const { precioArgen, compraGastos, compraGanancia } = resolveCompraValores(opcion, {
    precioManualFinal,
    precioConvertidoFinal,
    gastos,
    ganancia,
    gastosProveedor,
    gananciaProveedor,
  });
  const fechaCompra = new Date().toISOString().slice(0, 19).replace('T', ' ');
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
    Number(ordenCompra) || 0,
    articulo,
    detalle || '',
    Number(cantidad) || 0,
    Number(precioOrigen) || 0,
    precioArgen,
    compraGastos,
    compraGanancia,
    proveedor || '',
    paisProveedor || '',
    fechaCompra,
    tipoOrden,
    observacionesCompra,
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

  await conn.query('UPDATE ordencompras SET NumeroOrden = NumeroOrden + 1');

  return {
    articulo,
    detalle: detalle || '',
    cantidad: Number(cantidad) || 0,
    proveedor: proveedor || '',
    moneda,
    precioConvertidoFinal,
    precioManualFinal,
    gastosFinal,
    gananciaFinal,
    precioArgen,
    compraGastos,
    compraGanancia,
    tipoOrden,
  };
}

module.exports = {
  processAbmCreate,
};
