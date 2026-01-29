function computePedidoSubtotal(items = []) {
  if (!Array.isArray(items)) return 0;
  return items.reduce((sum, item) => {
    const total = Number(item.total);
    if (Number.isFinite(total) && total !== 0) return sum + total;
    const cantidad = Number(item.cantidad) || 0;
    const unitario = Number(item.precioUnitario) || 0;
    return sum + cantidad * unitario;
  }, 0);
}

function computePedidoTotals({
  items = [],
  descuentoPct = 0,
  recargoPct = 0,
  aplicaDescuento = false,
  correo = 0,
} = {}) {
  const subtotal = computePedidoSubtotal(items);
  const descuento = aplicaDescuento ? Number(descuentoPct) || 0 : 0;
  const recargo = aplicaDescuento ? 0 : Number(recargoPct) || 0;
  const totalConDescuento = descuento > 0 ? subtotal * (1 - descuento / 100) : 0;
  const totalConRecargo = recargo > 0 ? subtotal * (1 + recargo / 100) : 0;
  const base = descuento > 0 ? totalConDescuento : recargo > 0 ? totalConRecargo : subtotal;
  const totalConCorreo = base + (Number(correo) || 0);
  return {
    subtotal,
    totalConDescuento,
    totalConRecargo,
    totalConCorreo,
  };
}

function validatePedidoStock(items = [], stockByArticulo = {}) {
  if (!Array.isArray(items)) {
    return { ok: false, message: 'items invalidos' };
  }
  const acumulados = new Map();
  for (const item of items) {
    const articulo = String(item.articulo || '').trim();
    if (!articulo) continue;
    const cantidad = Number(item.cantidad) || 0;
    const stock = Number(stockByArticulo[articulo]);
    if (!Number.isFinite(stock)) continue;
    const acumulado = (acumulados.get(articulo) || 0) + cantidad;
    acumulados.set(articulo, acumulado);
    if (cantidad > stock) {
      return { ok: false, message: 'stock insuficiente' };
    }
    if (acumulado > stock) {
      return { ok: false, message: 'stock total insuficiente' };
    }
  }
  return { ok: true };
}

function nextAvailablePedidoNumber(start, existing = [], maxAttempts = 5) {
  const existingSet = new Set(
    Array.isArray(existing) ? existing.map((value) => Number(value)) : []
  );
  let numero = Number(start) || 0;
  let attempts = 0;
  while (existingSet.has(numero) && attempts < maxAttempts) {
    numero += 1;
    attempts += 1;
  }
  return { ok: !existingSet.has(numero), numero, attempts };
}

module.exports = {
  computePedidoSubtotal,
  computePedidoTotals,
  validatePedidoStock,
  nextAvailablePedidoNumber,
};
