function normalizeIdempotencyKey(value) {
  const key = String(value || '').trim();
  if (!key) return '';
  return key.slice(0, 64);
}

function validateFacturaPayload(body = {}) {
  const {
    cliente_id,
    vendedora,
    tipo_pago_id,
    items = [],
    porcentajeDescuento = 0,
    envio = 0,
    pagoMixto = 0,
    esPedido = 'NO',
    nroPedido = null,
    listoParaEnvio = 0,
  } = body || {};

  if (!cliente_id || !vendedora || !tipo_pago_id) {
    return { ok: false, message: 'cliente_id, vendedora y tipo_pago_id requeridos' };
  }
  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, message: 'items requeridos' };
  }

  return {
    ok: true,
    data: {
      cliente_id,
      vendedora,
      tipo_pago_id,
      items,
      porcentajeDescuento,
      envio,
      pagoMixto,
      esPedido,
      nroPedido,
      listoParaEnvio,
    },
  };
}

module.exports = {
  normalizeIdempotencyKey,
  validateFacturaPayload,
};
