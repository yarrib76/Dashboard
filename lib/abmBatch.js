function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function computeNuevaCantidad(baseCantidad, cantidadDelta, resta) {
  const base = toNumber(baseCantidad);
  const delta = toNumber(cantidadDelta);
  return resta ? base - delta : base + delta;
}

function resolveArticuloValores(opcion, { precioConvertido = 0, precioManual = 0, gastos = 0, ganancia = 0 } = {}) {
  let moneda = '';
  let precioConvertidoFinal = toNumber(precioConvertido);
  let precioManualFinal = 0;
  let gastosFinal = 0;
  let gananciaFinal = 0;

  if (opcion === 'opcion_dolares') {
    moneda = 'uSs';
    precioManualFinal = 0;
  } else if (opcion === 'opcion_pesos') {
    moneda = 'ARG';
    precioManualFinal = 0;
  } else {
    moneda = '';
    precioConvertidoFinal = 0;
    precioManualFinal = toNumber(precioManual);
    gastosFinal = toNumber(gastos);
    gananciaFinal = toNumber(ganancia);
  }

  return { moneda, precioConvertidoFinal, precioManualFinal, gastosFinal, gananciaFinal };
}

function resolveCompraValores(opcion, { precioManualFinal = 0, precioConvertidoFinal = 0, gastos = 0, ganancia = 0, gastosProveedor = 0, gananciaProveedor = 0 } = {}) {
  const precioArgen = opcion === 'opcion_manual' ? toNumber(precioManualFinal) : toNumber(precioConvertidoFinal);
  const compraGastos = opcion === 'opcion_manual' ? toNumber(gastos) : toNumber(gastosProveedor);
  const compraGanancia = opcion === 'opcion_manual' ? toNumber(ganancia) : toNumber(gananciaProveedor);
  return { precioArgen, compraGastos, compraGanancia };
}

function validateBatchItems(items) {
  if (!Array.isArray(items) || items.length === 0) return { ok: false, message: 'items requerido' };
  for (const item of items) {
    const articulo = item?.articulo;
    if (!articulo) return { ok: false, message: 'articulo requerido' };
  }
  return { ok: true };
}

module.exports = {
  computeNuevaCantidad,
  resolveArticuloValores,
  resolveCompraValores,
  validateBatchItems,
};
