const CLIENTE_ESTADOS = {
  ACTIVO: 'Activo',
  BAJA_FRECUENCIA: 'Baja frecuencia',
  EN_RIESGO: 'En riesgo',
  INACTIVO: 'Inactivo',
  SIN_COMPRAS: 'Sin compras',
};

function classifyClienteEstado(diasSinComprar) {
  if (diasSinComprar === null || diasSinComprar === undefined || diasSinComprar === '') {
    return CLIENTE_ESTADOS.SIN_COMPRAS;
  }
  const dias = Number(diasSinComprar);
  if (!Number.isFinite(dias) || dias < 0) return CLIENTE_ESTADOS.SIN_COMPRAS;
  if (dias <= 90) return CLIENTE_ESTADOS.ACTIVO;
  if (dias <= 180) return CLIENTE_ESTADOS.BAJA_FRECUENCIA;
  if (dias <= 365) return CLIENTE_ESTADOS.EN_RIESGO;
  return CLIENTE_ESTADOS.INACTIVO;
}

function round2(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function enrichClienteReporteRow(row = {}) {
  const cantComprasHistorico = Number(row.cantComprasHistorico || row.cant_compras_historico || 0);
  const montoHistorico = round2(row.montoHistorico ?? row.monto_historico ?? 0);
  const compras12m = Number(row.compras12m || row.compras_12m || 0);
  const monto12m = round2(row.monto12m ?? row.monto_12m ?? 0);
  const diasRaw = row.diasSinComprar ?? row.dias_sin_comprar;
  const diasSinComprar =
    diasRaw === null || diasRaw === undefined || diasRaw === '' ? null : Math.max(0, Number(diasRaw) || 0);
  const ticketPromedio = cantComprasHistorico > 0 ? round2(montoHistorico / cantComprasHistorico) : 0;

  return {
    ...row,
    diasSinComprar,
    cantComprasHistorico,
    compras12m,
    monto12m,
    montoHistorico,
    ticketPromedio,
    estado: classifyClienteEstado(diasSinComprar),
  };
}

function buildClientesResumen(rows = []) {
  const estados = Object.values(CLIENTE_ESTADOS);
  const resumen = Object.fromEntries(
    estados.map((estado) => [
      estado,
      {
        estado,
        total: 0,
        monto12m: 0,
        ticketPromedio: 0,
      },
    ])
  );

  rows.forEach((row) => {
    const estado = row.estado || classifyClienteEstado(row.diasSinComprar);
    if (!resumen[estado]) return;
    resumen[estado].total += 1;
    resumen[estado].monto12m = round2(resumen[estado].monto12m + Number(row.monto12m || 0));
    resumen[estado].ticketPromedio = round2(
      ((resumen[estado].ticketPromedio * (resumen[estado].total - 1)) + Number(row.ticketPromedio || 0)) /
        resumen[estado].total
    );
  });

  return estados.map((estado) => resumen[estado]);
}

module.exports = {
  CLIENTE_ESTADOS,
  classifyClienteEstado,
  enrichClienteReporteRow,
  buildClientesResumen,
  round2,
};
