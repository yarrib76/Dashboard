const MONTH_LABELS_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const INFLACION_MIN_PRECIO_PREVIO = 100;
const INFLACION_MAX_VARIATION = 3;
const INFLACION_MIN_VARIATION = -0.8;

function parseInteger(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function validateDashboardComparativoParams(query = {}) {
  const yearA = parseInteger(query.year_a);
  const yearB = parseInteger(query.year_b);
  const monthFrom = parseInteger(query.month_from);
  const monthTo = parseInteger(query.month_to);
  const mode = String(query.mode || 'cantidad').trim().toLowerCase();
  const rawEntity = String(query.entity || 'pedidos').trim().toLowerCase();
  const entity = mode === 'monto' ? 'facturas' : mode === 'inflacion' ? 'compras' : rawEntity;

  if (!yearA || !yearB) {
    return { ok: false, message: 'year_a y year_b son obligatorios y numericos' };
  }
  if (!monthFrom || !monthTo || monthFrom < 1 || monthFrom > 12 || monthTo < 1 || monthTo > 12) {
    return { ok: false, message: 'month_from y month_to deben estar entre 1 y 12' };
  }
  if (monthFrom > monthTo) {
    return { ok: false, message: 'month_from no puede ser mayor que month_to' };
  }
  if (mode !== 'cantidad' && mode !== 'monto' && mode !== 'inflacion') {
    return { ok: false, message: 'mode debe ser cantidad, monto o inflacion' };
  }
  if (entity !== 'pedidos' && entity !== 'facturas' && entity !== 'compras') {
    return { ok: false, message: 'entity debe ser pedidos, facturas o compras' };
  }

  return {
    ok: true,
    data: {
      yearA,
      yearB,
      monthFrom,
      monthTo,
      mode,
      entity,
    },
  };
}

function buildComparativoSeries(rows = [], monthFrom = 1, monthTo = 12) {
  const monthMap = new Map();
  rows.forEach((row) => {
    const month = Number(row?.mes);
    if (!Number.isFinite(month)) return;
    monthMap.set(month, Number(row?.valor) || 0);
  });
  const labels = [];
  const values = [];
  for (let month = monthFrom; month <= monthTo; month += 1) {
    labels.push(MONTH_LABELS_SHORT[month - 1] || String(month));
    values.push(monthMap.get(month) || 0);
  }
  return { labels, values };
}

function buildMonthKey(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function computeInflacionSeries(rows = [], params = {}) {
  const { yearA, yearB, monthFrom = 1, monthTo = 12 } = params;
  const minYear = Math.min(yearA, yearB);
  const maxYear = Math.max(yearA, yearB);
  const byArticulo = new Map();
  rows.forEach((row) => {
    const articulo = String(row?.Articulo || row?.articulo || '').trim();
    const fechaRaw = row?.FechaCompra || row?.fechaCompra || row?.fecha || '';
    const precio = Number(row?.PrecioArgen ?? row?.precioArgen ?? 0);
    if (!articulo || !fechaRaw || !(precio > 0)) return;
    const fecha = new Date(fechaRaw);
    if (Number.isNaN(fecha.getTime())) return;
    if (fecha.getFullYear() > maxYear) return;
    if (!byArticulo.has(articulo)) byArticulo.set(articulo, []);
    byArticulo.get(articulo).push({ fecha, precio });
  });

  const aggregate = new Map();
  byArticulo.forEach((events) => {
    events.sort((a, b) => a.fecha - b.fecha);
    const latestByMonth = [];
    events.forEach((event) => {
      const year = event.fecha.getFullYear();
      const month = event.fecha.getMonth() + 1;
      const key = buildMonthKey(year, month);
      const current = latestByMonth[latestByMonth.length - 1];
      if (current && current.key === key) {
        current.precio = event.precio;
        current.fecha = event.fecha;
      } else {
        latestByMonth.push({ key, year, month, precio: event.precio, fecha: event.fecha });
      }
    });
    let prevPrecio = null;
    let prevYear = null;
    latestByMonth.forEach((entry) => {
      if (prevYear !== entry.year) {
        prevPrecio = null;
      }
      if (prevPrecio && prevPrecio > 0) {
        const variation = entry.precio / prevPrecio - 1;
        const isValidPrevPrecio = prevPrecio >= INFLACION_MIN_PRECIO_PREVIO;
        const isValidVariation =
          variation >= INFLACION_MIN_VARIATION && variation <= INFLACION_MAX_VARIATION;
        if (isValidPrevPrecio && isValidVariation) {
          const aggKey = buildMonthKey(entry.year, entry.month);
          if (!aggregate.has(aggKey)) {
            aggregate.set(aggKey, { year: entry.year, month: entry.month, values: [] });
          }
          aggregate.get(aggKey).values.push(variation);
        }
      }
      prevPrecio = entry.precio;
      prevYear = entry.year;
    });
  });

  const labels = [];
  const valuesByYear = new Map();
  for (let year = minYear; year <= maxYear; year += 1) {
    valuesByYear.set(year, []);
  }
  const summary = [];
  for (let year = minYear; year <= maxYear; year += 1) {
    let cumulative = 1;
    for (let month = 1; month <= 12; month += 1) {
      const key = buildMonthKey(year, month);
      const entry = aggregate.get(key);
      const value =
        entry && entry.values.length
          ? entry.values.reduce((acc, item) => acc + item, 0) / entry.values.length
          : 0;
      valuesByYear.get(year).push(Number((value * 100).toFixed(2)));
      cumulative *= 1 + value;
    }
  }
  for (let month = monthFrom; month <= monthTo; month += 1) {
    labels.push(MONTH_LABELS_SHORT[month - 1] || String(month));
  }
  [yearA, yearB].forEach((year) => {
    let cumulative = 1;
    for (let month = monthFrom; month <= monthTo; month += 1) {
      const monthlyPct = Number((valuesByYear.get(year) || [])[month - 1] ?? 0) / 100;
      cumulative *= 1 + monthlyPct;
    }
    summary.push({
      year,
      cumulativePct: Number(((cumulative - 1) * 100).toFixed(2)),
    });
  });
  return {
    labels,
    series: [
      { year: yearA, values: (valuesByYear.get(yearA) || []).slice(monthFrom - 1, monthTo) },
      { year: yearB, values: (valuesByYear.get(yearB) || []).slice(monthFrom - 1, monthTo) },
    ],
    allSeries: Array.from(valuesByYear.entries()).map(([year, values]) => ({ year, values })),
    summary: {
      yearA: summary[0],
      yearB: summary[1],
      differencePct: Number((summary[0].cumulativePct - summary[1].cumulativePct).toFixed(2)),
    },
  };
}

function buildDashboardComparativoPayload(params, rowsYearA = [], rowsYearB = []) {
  const { yearA, yearB, monthFrom, monthTo, mode, entity } = params;
  const first = buildComparativoSeries(rowsYearA, monthFrom, monthTo);
  const second = buildComparativoSeries(rowsYearB, monthFrom, monthTo);
  return {
    labels: first.labels,
    series: [
      { year: yearA, values: first.values },
      { year: yearB, values: second.values },
    ],
    meta: {
      mode,
      entity,
      month_from: monthFrom,
      month_to: monthTo,
    },
  };
}

function buildInflacionApiPayload(rows = [], params = {}) {
  const { yearA, yearB, monthFrom = 1, monthTo = 12 } = params;
  const minYear = Math.min(yearA, yearB);
  const maxYear = Math.max(yearA, yearB);
  const valuesByYear = new Map();
  for (let year = minYear; year <= maxYear; year += 1) {
    valuesByYear.set(year, new Array(12).fill(0));
  }

  rows.forEach((row) => {
    const fechaRaw = String(row?.fecha || row?.Fecha || '').trim();
    const valor = Number(row?.valor ?? row?.Valor ?? 0);
    if (!fechaRaw || !Number.isFinite(valor)) return;
    const fecha = new Date(fechaRaw);
    if (Number.isNaN(fecha.getTime())) return;
    const year = fecha.getUTCFullYear();
    const month = fecha.getUTCMonth() + 1;
    if (year < minYear || year > maxYear) return;
    const bucket = valuesByYear.get(year);
    if (!bucket) return;
    bucket[month - 1] = valor;
  });

  const labels = [];
  for (let month = monthFrom; month <= monthTo; month += 1) {
    labels.push(MONTH_LABELS_SHORT[month - 1] || String(month));
  }

  const summary = [yearA, yearB].map((year) => {
    let cumulative = 1;
    const values = valuesByYear.get(year) || [];
    for (let month = monthFrom; month <= monthTo; month += 1) {
      cumulative *= 1 + (Number(values[month - 1]) || 0) / 100;
    }
    return {
      year,
      cumulativePct: Number(((cumulative - 1) * 100).toFixed(2)),
    };
  });

  return {
    labels,
    series: [
      { year: yearA, values: (valuesByYear.get(yearA) || []).slice(monthFrom - 1, monthTo) },
      { year: yearB, values: (valuesByYear.get(yearB) || []).slice(monthFrom - 1, monthTo) },
    ],
    allSeries: Array.from(valuesByYear.entries()).map(([year, values]) => ({ year, values })),
    summary: {
      yearA: summary[0],
      yearB: summary[1],
      differencePct: Number((summary[0].cumulativePct - summary[1].cumulativePct).toFixed(2)),
    },
    source: {
      name: 'ArgentinaDatos',
      url: 'https://api.argentinadatos.com/v1/finanzas/indices/inflacion',
    },
  };
}

function computeInflacionAcumulada(values = []) {
  let cumulative = 1;
  return values.map((value) => {
    const monthly = (Number(value) || 0) / 100;
    cumulative *= 1 + monthly;
    return Number(((cumulative - 1) * 100).toFixed(2));
  });
}

function computeMontoRealSeries(nominalValues = [], inflationAccumulatedValues = []) {
  return nominalValues.map((value, index) => {
    const nominal = Number(value) || 0;
    const inflationAccumulated = (Number(inflationAccumulatedValues[index]) || 0) / 100;
    const deflator = 1 + inflationAccumulated;
    if (!(deflator > 0)) return 0;
    return Number((nominal / deflator).toFixed(2));
  });
}

function computeVariacionInteranual(baseValue, currentValue) {
  const base = Number(baseValue) || 0;
  const current = Number(currentValue) || 0;
  if (!(base > 0)) return null;
  return Number((((current / base) - 1) * 100).toFixed(2));
}

module.exports = {
  MONTH_LABELS_SHORT,
  validateDashboardComparativoParams,
  buildComparativoSeries,
  computeInflacionSeries,
  buildDashboardComparativoPayload,
  buildInflacionApiPayload,
  computeInflacionAcumulada,
  computeMontoRealSeries,
  computeVariacionInteranual,
};
