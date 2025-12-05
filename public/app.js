const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const USE_SAMPLE_FALLBACK = false; // Cambiar a true solo si quieres ver mocks cuando la API falle.

const chartState = {
  encuestas: null,
  mensual: null,
  ventas: null,
};

const sampleEncuestas = [
  { encuesta: 'Google', mes: 1, cantidad: 10 },
  { encuesta: 'Google', mes: 2, cantidad: 12 },
  { encuesta: 'Caminando', mes: 1, cantidad: 5 },
  { encuesta: 'Caminando', mes: 2, cantidad: 7 },
];

const sampleProductividad = [
  {
    vendedora: 'Sin datos',
    cantPedidos: 6,
    dias: 1,
    promedio: 6,
    promedioFacturado: 25000,
    promedioCantArticulos: 4,
  },
];

const sampleMensual = [
  { vendedora: 'Ada', mes: 1, cantidad: 12 },
  { vendedora: 'Ada', mes: 2, cantidad: 14 },
  { vendedora: 'Bea', mes: 1, cantidad: 9 },
  { vendedora: 'Bea', mes: 2, cantidad: 11 },
];

const sampleVentas = [
  { vendedora: 'Ada', mes: 1, cantidad: 8 },
  { vendedora: 'Ada', mes: 2, cantidad: 10 },
  { vendedora: 'Bea', mes: 1, cantidad: 6 },
  { vendedora: 'Bea', mes: 2, cantidad: 12 },
];

const samplePaqueteria = {
  pendientes: 0,
  sinTransporte: 0,
  vencidos: 2,
};
const samplePaqueteriaLista = [
  {
    nropedido: 1001,
    nrofactura: 501,
    cliente: 'Cliente Demo',
    vendedora: 'Ada',
    transporte: '',
    fechaPedido: '2025-02-01',
    fechaFactura: '2025-02-01',
    total: 12345.67,
    comentario: 'Sin transporte asignado',
  },
];

const statusEncuestas = document.getElementById('status-encuestas');
const statusProductividad = document.getElementById('status-productividad');
const statusMensual = document.getElementById('status-mensual');
const statusVentas = document.getElementById('status-ventas');
const statusPaqueteria = document.getElementById('status-paqueteria');
const statPendientes = document.getElementById('stat-pendientes');
const statSinTransporte = document.getElementById('stat-sin-transporte');
const statVencidos = document.getElementById('stat-vencidos');
const statusEmpleados = document.getElementById('status-empleados');
const mesEmpleados = document.getElementById('mes-empleados');
const tablaEmpleadosBody = document.querySelector('#tabla-empleados tbody');
const filtroRoles = document.getElementById('filtro-roles');
const buscarEmpleados = document.getElementById('buscar-empleados');
const userNameEl = document.getElementById('user-name');
const avatarEl = document.getElementById('user-avatar');
const logoutBtn = document.getElementById('logout-btn');
const modalOverlay = document.getElementById('modal-overlay');
const modalTitle = document.getElementById('modal-title');
const modalStatus = document.getElementById('modal-status');
const modalClose = document.getElementById('modal-close');
const modalTableBody = document.querySelector('#tabla-modal tbody');
const modalSearch = document.getElementById('modal-search');
const calendarOverlay = document.getElementById('calendar-overlay');
const calendarTitle = document.getElementById('calendar-title');
const calendarClose = document.getElementById('calendar-close');
const calendarGrid = document.getElementById('calendar-grid');
const calendarStatus = document.getElementById('calendar-status');

let paqueteriaRows = [];
let transportesList = [];
let empleadosRows = [];
const viewDashboard = document.getElementById('view-dashboard');
const viewEmpleados = document.getElementById('view-empleados');

function setStatus(el, text, isError = false) {
  if (!el) return;
  el.textContent = text;
  el.style.color = isError ? '#f87171' : 'var(--muted)';
}

async function fetchJSON(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Error ${response.status}`);
  return response.json();
}

function buildDatasetMensual(rows) {
  const porVendedora = {};
  rows.forEach((row) => {
    if (!porVendedora[row.vendedora]) {
      porVendedora[row.vendedora] = Array(12).fill(0);
    }
    porVendedora[row.vendedora][row.mes - 1] = row.cantidad;
  });
  return Object.entries(porVendedora)
    .sort(([a], [b]) => (a || '').localeCompare(b || ''))
    .map(([vendedora, valores], idx) => ({
      label: vendedora || 'Sin asignar',
      data: valores,
      borderColor: colorByIndex(idx, 0.95),
      backgroundColor: colorByIndex(idx, 0.08),
      tension: 0.3,
      borderWidth: 2,
    }));
}

function colorByIndex(index, alpha = 1) {
  const hue = (index * 137.508) % 360;
  return `hsla(${hue}, 70%, 60%, ${alpha})`;
}

function setAlpha(color, alpha) {
  if (!color) return color;
  const match = color.match(/hsla?\(([^)]+)\)/);
  if (!match) return color;
  const parts = match[1].split(',').map((p) => p.trim());
  const [h, s, l] = parts;
  return `hsla(${h}, ${s}, ${l}, ${alpha})`;
}

function renderEncuestas(data) {
  const porEncuesta = {};
  data.forEach((row) => {
    const label = row.encuesta || 'Sin dato';
    if (!porEncuesta[label]) porEncuesta[label] = Array(12).fill(0);
    porEncuesta[label][row.mes - 1] = row.cantidad;
  });

  const totals = Array(12).fill(0);
  const datasets = Object.entries(porEncuesta)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, valores], idx) => ({
      label,
      data: valores,
      backgroundColor: colorByIndex(idx, 0.85),
      borderRadius: 12,
      barThickness: 36,
      maxBarThickness: 46,
      categoryPercentage: 0.9,
      barPercentage: 0.95,
    }));

  datasets.forEach((ds) => {
    ds.data.forEach((v, idx) => {
      totals[idx] += v;
    });
  });
  const maxTotal = Math.max(...totals, 1);
  const suggestedMax = Math.ceil(maxTotal * 1.25);

  const ctx = document.getElementById('chart-encuestas').getContext('2d');
  if (chartState.encuestas) chartState.encuestas.destroy();
  chartState.encuestas = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: monthNames,
      datasets,
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom' } },
      scales: {
        x: { stacked: true },
        y: { stacked: true, beginAtZero: true, suggestedMax, ticks: { precision: 0 } },
      },
    },
  });
}

function renderProductividad(rows) {
  const tbody = document.querySelector('#tabla-productividad tbody');
  tbody.innerHTML = '';
  rows.forEach((row) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${row.vendedora || 'Sin asignar'}</td>
      <td>${row.cantPedidos}</td>
      <td>${row.dias}</td>
      <td><span class="pill">${row.promedio}</span></td>
      <td>$${row.promedioFacturado}</td>
      <td>${row.promedioCantArticulos}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderMensual(rows) {
  const ctx = document.getElementById('chart-mensual').getContext('2d');
  const datasets = buildDatasetMensual(rows).map((ds) => ({
    ...ds,
    _baseColor: ds.borderColor,
    _baseBg: ds.backgroundColor,
  }));
  if (chartState.mensual) chartState.mensual.destroy();
  chartState.mensual = new Chart(ctx, {
    type: 'line',
    data: {
      labels: monthNames,
      datasets,
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'bottom',
          onHover: (_evt, item, legend) => {
            const chart = legend.chart;
            chart.data.datasets.forEach((ds, idx) => {
              const base = ds._baseColor || ds.borderColor;
              const baseBg = ds._baseBg || ds.backgroundColor;
              if (idx === item.datasetIndex) {
                ds.borderColor = base;
                ds.backgroundColor = baseBg;
                ds.borderWidth = 3;
              } else {
                ds.borderColor = setAlpha(base, 0.25);
                ds.backgroundColor = setAlpha(baseBg, 0.06);
                ds.borderWidth = 1.5;
              }
            });
            chart.update('none');
          },
          onLeave: (_evt, _item, legend) => {
            const chart = legend.chart;
            chart.data.datasets.forEach((ds) => {
              const base = ds._baseColor || ds.borderColor;
              const baseBg = ds._baseBg || ds.backgroundColor;
              ds.borderColor = base;
              ds.backgroundColor = baseBg;
              ds.borderWidth = 2;
            });
            chart.update('none');
          },
        },
      },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
    },
  });
}

function renderVentas(rows) {
  const ctx = document.getElementById('chart-ventas').getContext('2d');
  const datasets = buildDatasetMensual(rows).map((ds) => ({
    ...ds,
    _baseColor: ds.borderColor,
    _baseBg: ds.backgroundColor,
  }));
  if (chartState.ventas) chartState.ventas.destroy();
  chartState.ventas = new Chart(ctx, {
    type: 'line',
    data: {
      labels: monthNames,
      datasets,
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'bottom',
          onHover: (_evt, item, legend) => {
            const chart = legend.chart;
            chart.canvas?.classList.add('is-hovering-legend');
            chart.data.datasets.forEach((ds, idx) => {
              const base = ds._baseColor || ds.borderColor;
              const baseBg = ds._baseBg || ds.backgroundColor;
              if (idx === item.datasetIndex) {
                ds.borderColor = base;
                ds.backgroundColor = baseBg;
                ds.borderWidth = 3;
              } else {
                ds.borderColor = setAlpha(base, 0.25);
                ds.backgroundColor = setAlpha(baseBg, 0.06);
                ds.borderWidth = 1.5;
              }
            });
            chart.update('none');
          },
          onLeave: (_evt, _item, legend) => {
            const chart = legend.chart;
            chart.canvas?.classList.remove('is-hovering-legend');
            chart.data.datasets.forEach((ds) => {
              const base = ds._baseColor || ds.borderColor;
              const baseBg = ds._baseBg || ds.backgroundColor;
              ds.borderColor = base;
              ds.backgroundColor = baseBg;
              ds.borderWidth = 2;
            });
            chart.update('none');
          },
        },
      },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
    },
  });
}

function renderPaqueteria(data) {
  statPendientes.textContent = data.pendientes ?? 0;
  statSinTransporte.textContent = data.sinTransporte ?? 0;
  statVencidos.textContent = data.vencidos ?? 0;
}

function renderPaqueteriaLista(rows) {
  modalTableBody.innerHTML = '';
  rows.forEach((row) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${row.nropedido || ''}</td>
      <td>${row.cliente || ''}</td>
      <td>${formatDate(row.fechaFactura)}</td>
      <td>${row.vendedora || ''}</td>
      <td>${row.total ?? ''}</td>
      <td>${row.ordenWeb ?? ''}</td>
      <td>${row.totalWeb ?? ''}</td>
      <td>${renderTransporteCell(row)}</td>
      <td>${mapInstancia(row.instancia)}</td>
      <td>${mapEstado(row.estado, row.empaquetado)}</td>
    `;
    modalTableBody.appendChild(tr);
  });
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toISOString().slice(0, 10);
}

function mapInstancia(value) {
  if (value === 0 || value === '0') return 'Pendientes';
  if (value === 1 || value === '1') return 'Iniciado';
  if (value === 2 || value === '2') return 'Finalizado';
  return value ?? '';
}

function mapEstado(estado, empaquetado) {
  const est = Number(estado);
  const emp = Number(empaquetado);
  if (est === 0 && emp === 1) return 'Empaquetado';
  if (est === 0) return 'Facturado';
  if (est === 1) return 'Procesado';
  return 'Cancelado';
}

function renderTransporteCell(row) {
  const label = row.transporte || 'Asignar';
  return `<button class="transport-btn" data-id="${row.id}" data-transport="${row.transporte || ''}">${label}</button>`;
}

function applyModalFilter() {
  const term = (modalSearch.value || '').toLowerCase();
  if (!term) {
    renderPaqueteriaLista(paqueteriaRows);
    return;
  }
  const filtered = paqueteriaRows.filter((row) => {
    return Object.values(row).some((val) => String(val ?? '').toLowerCase().includes(term));
  });
  renderPaqueteriaLista(filtered);
}

async function loadTransportes() {
  try {
    const res = await fetchJSON('/api/transportes');
    transportesList = res.data || [];
  } catch (error) {
    transportesList = [];
    console.error(error);
  }
}

function openTransportEditor(btn, rowId, current) {
  const cell = btn.parentElement;
  const editor = document.createElement('div');
  editor.className = 'transport-editor';

  const select = document.createElement('select');
  const emptyOpt = document.createElement('option');
  emptyOpt.value = '';
  emptyOpt.textContent = 'Seleccionar...';
  select.appendChild(emptyOpt);
  transportesList.forEach((t) => {
    const opt = document.createElement('option');
    opt.value = t.nombre;
    opt.textContent = t.nombre;
    select.appendChild(opt);
  });
  select.value = current || '';

  editor.appendChild(select);

  cell.innerHTML = '';
  cell.appendChild(editor);

  select.addEventListener('change', async () => {
    try {
      await fetch('/api/paqueteria/transporte', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: rowId, transporte: select.value }),
      });
      const row = paqueteriaRows.find((r) => r.id === rowId);
      if (row) {
        row.transporte = select.value;
      }
      applyModalFilter();
    } catch (error) {
      console.error(error);
      alert('No se pudo actualizar el transporte');
    }
  });
}

function renderEmpleados(rows) {
  tablaEmpleadosBody.innerHTML = '';
  const toNum = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  rows.forEach((row) => {
    console.log(row);
    const tr = document.createElement('tr');
    const noEncVal = toNum(row.noEncuestados ?? row.NOENCUESTADOS);
    //console.log(noEncVal);
    tr.innerHTML = `
      <td>${row.nombre || ''}</td>
      <td>${toNum(row.alertas)}</td>
      <td>${toNum(row.tardes)}</td>
      <td><button class="transport-btn" data-user="${row.id}">Ver calendario</button></td>
      <td>${noEncVal}</td>
      <td>${toNum(row.porcentajePedidos)}%</td>
      <td>${toNum(row.porcentajeVentas)}%</td>
    `;
    tablaEmpleadosBody.appendChild(tr);
  });
}

function formatDateTime(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const iso = d.toISOString();
  const date = iso.slice(0, 10);
  const time = iso.slice(11, 16);
  return `${date} ${time}`;
}

async function loadEmpleados(fecha) {
  try {
    setStatus(statusEmpleados, 'Cargando...');
    const params = new URLSearchParams();
    if (fecha) params.set('fecha', fecha);
  if (filtroRoles.checked) params.set('todos', 'true');
  const term = buscarEmpleados.value.trim();
  if (term) params.set('q', term);
  const url = `/api/empleados?${params.toString()}`;
    const res = await fetchJSON(url);
    console.log('Empleados data', res);
    empleadosRows = (res.data || []).map((row) => ({
      ...row,
      nombre: row.nombre || row.name || '',
      alertas: row.alertas,
      tardes: row.tardes,
      porcentajePedidos: row.porcentajePedidos,
      porcentajeVentas: row.porcentajeVentas,
    }));
    renderEmpleados(empleadosRows);
  setStatus(statusEmpleados, `Fecha ${res.fecha}`);
  } catch (error) {
    setStatus(
      statusEmpleados,
      'Error cargando empleados. Revisa conexión al servidor/base.',
      true
    );
    console.error(error);
  }
}

async function loadEncuestas(year) {
  try {
    setStatus(statusEncuestas, 'Cargando...');
    const selectYear = document.getElementById('year-encuestas');
    const yearValue =
      typeof year === 'string' || typeof year === 'number'
        ? year
        : selectYear?.value || '';
    const url = yearValue ? `/api/encuestas/mes?year=${yearValue}` : '/api/encuestas/mes';
    const res = await fetchJSON(url);
    renderEncuestas(res.data);
    if (selectYear && res.year) selectYear.value = res.year;
    setStatus(statusEncuestas, `Año ${res.year}`);
  } catch (error) {
    if (USE_SAMPLE_FALLBACK) {
      renderEncuestas(sampleEncuestas);
      setStatus(statusEncuestas, 'Usando datos de ejemplo (sin conexión a la base).', true);
    } else {
      setStatus(
        statusEncuestas,
        'Error cargando encuestas. Revisa que el servidor y la base estén configurados (.env) y corriendo.',
        true
      );
    }
    console.error(error);
  }
}

async function loadProductividad(desde, hasta) {
  try {
    setStatus(statusProductividad, 'Cargando...');
    const params = new URLSearchParams();
    if (desde) params.set('fechaDesde', desde);
    if (hasta) params.set('fechaHasta', hasta);
    const url = params.toString()
      ? `/api/pedidos/productividad?${params.toString()}`
      : '/api/pedidos/productividad';
    const res = await fetchJSON(url);
    renderProductividad(res.data);
    setStatus(statusProductividad, `Rango ${res.fechaDesde} -> ${res.fechaHasta}`);
  } catch (error) {
    if (USE_SAMPLE_FALLBACK) {
      renderProductividad(sampleProductividad);
      setStatus(statusProductividad, 'Usando datos de ejemplo (sin conexión a la base).', true);
    } else {
      setStatus(
        statusProductividad,
        'Error cargando productividad. Revisa que el servidor y la base estén configurados (.env) y corriendo.',
        true
      );
    }
    console.error(error);
  }
}

async function loadMensual(year) {
  try {
    setStatus(statusMensual, 'Cargando...');
    const selectYear = document.getElementById('year-mensual');
    const yearValue =
      typeof year === 'string' || typeof year === 'number'
        ? year
        : selectYear?.value || '';
    const url = yearValue ? `/api/pedidos/mensual?year=${yearValue}` : '/api/pedidos/mensual';
    const res = await fetchJSON(url);
    renderMensual(res.data);
    if (selectYear && res.year) selectYear.value = res.year;
    setStatus(statusMensual, `Año ${res.year}`);
  } catch (error) {
    if (USE_SAMPLE_FALLBACK) {
      renderMensual(sampleMensual);
      setStatus(statusMensual, 'Usando datos de ejemplo (sin conexión a la base).', true);
    } else {
      setStatus(
        statusMensual,
        'Error cargando pedidos mensuales. Revisa que el servidor y la base estén configurados (.env) y corriendo.',
        true
      );
    }
    console.error(error);
  }
}

async function loadVentas(year) {
  try {
    setStatus(statusVentas, 'Cargando...');
    const selectYear = document.getElementById('year-ventas');
    const yearValue =
      typeof year === 'string' || typeof year === 'number'
        ? year
        : selectYear?.value || '';
    const url = yearValue ? `/api/ventas/mensual?year=${yearValue}` : '/api/ventas/mensual';
    const res = await fetchJSON(url);
    renderVentas(res.data);
    if (selectYear && res.year) selectYear.value = res.year;
    setStatus(statusVentas, `Año ${res.year}`);
  } catch (error) {
    if (USE_SAMPLE_FALLBACK) {
      renderVentas(sampleVentas);
      setStatus(statusVentas, 'Usando datos de ejemplo (sin conexión a la base).', true);
    } else {
      setStatus(
        statusVentas,
        'Error cargando ventas mensuales. Revisa que el servidor y la base estén configurados (.env) y corriendo.',
        true
      );
    }
    console.error(error);
  }
}

async function loadPaqueteria() {
  try {
    setStatus(statusPaqueteria, 'Cargando...');
    const res = await fetchJSON('/api/paqueteria');
    renderPaqueteria(res);
    setStatus(statusPaqueteria, 'Actualizado');
  } catch (error) {
    if (USE_SAMPLE_FALLBACK) {
      renderPaqueteria(samplePaqueteria);
      setStatus(statusPaqueteria, 'Usando datos de ejemplo (sin conexión a la base).', true);
    } else {
      setStatus(
        statusPaqueteria,
        'Error cargando empaquetados. Revisa conexión al servidor/base.',
        true
      );
    }
    console.error(error);
  }
}

async function loadPaqueteriaLista(tipo) {
  try {
    modalStatus.textContent = 'Cargando...';
    const res = await fetchJSON(`/api/paqueteria/lista?tipo=${encodeURIComponent(tipo)}`);
    paqueteriaRows = res.data || [];
    applyModalFilter();
    modalStatus.textContent = `${paqueteriaRows.length || 0} registros`;
  } catch (error) {
    if (USE_SAMPLE_FALLBACK) {
      paqueteriaRows = samplePaqueteriaLista;
      applyModalFilter();
      modalStatus.textContent = 'Usando datos de ejemplo (sin conexión a la base).';
    } else {
      modalStatus.textContent = 'Error cargando datos. Revisa conexión al servidor/base.';
    }
    console.error(error);
  }
}

async function loadCurrentUser() {
  try {
    const res = await fetch('/api/me');
    if (!res.ok) throw new Error('No autenticado');
    const data = await res.json();
    if (data?.user?.name) {
      userNameEl.textContent = data.user.name;
      const initials = data.user.name
        .split(' ')
        .map((w) => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
      avatarEl.textContent = initials || '👤';
    }
  } catch (error) {
    window.location.href = '/login';
  }
}

document.getElementById('refresh-encuestas').addEventListener('click', () => {
  const selectYear = document.getElementById('year-encuestas');
  loadEncuestas(selectYear?.value);
});
document.getElementById('refresh-productividad').addEventListener('click', () => {
  const desde = document.getElementById('fecha-desde').value;
  const hasta = document.getElementById('fecha-hasta').value;
  loadProductividad(desde, hasta);
});
document.getElementById('refresh-mensual').addEventListener('click', () => {
  const selectYear = document.getElementById('year-mensual');
  loadMensual(selectYear?.value);
});
document.getElementById('refresh-ventas').addEventListener('click', () => {
  const selectYear = document.getElementById('year-ventas');
  loadVentas(selectYear?.value);
});
document.getElementById('refresh-paqueteria').addEventListener('click', () => {
  loadPaqueteria();
});
document.getElementById('refresh-empleados').addEventListener('click', () => {
  const [year, month] = mesEmpleados.value.split('-');
  loadEmpleados(`${year}-${month}-01`);
});
filtroRoles.addEventListener('change', () => {
  const [year, month] = mesEmpleados.value.split('-');
  loadEmpleados(`${year}-${month}-01`);
});
buscarEmpleados.addEventListener('input', () => {
  const [year, month] = mesEmpleados.value.split('-');
  loadEmpleados(`${year}-${month}-01`);
});

async function handleLogout() {
  try {
    await fetch('/api/logout', { method: 'POST' });
  } catch (e) {
    // ignore
  } finally {
    window.location.href = '/login';
  }
}

function initYearSelect(elementId, onChange) {
  const select = document.getElementById(elementId);
  const current = new Date().getFullYear();
  const years = [];
  for (let y = current; y >= current - 20; y -= 1) {
    years.push(y);
  }
  select.innerHTML = '';
  years.forEach((y) => {
    const opt = document.createElement('option');
    opt.value = y;
    opt.textContent = y;
    select.appendChild(opt);
  });
  select.value = current;
  if (onChange) select.addEventListener('change', () => onChange(select.value));
  return select.value;
}

function initCollapsibles() {
  const toggles = document.querySelectorAll('.collapse-toggle');
  toggles.forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.target;
      const body = document.querySelector(`.card-body[data-section="${target}"]`);
      if (!body) return;
      const isHidden = body.classList.toggle('hidden');
      btn.setAttribute('aria-expanded', (!isHidden).toString());
      btn.textContent = isHidden ? 'Mostrar' : 'Ocultar';
    });
  });
}

function initDateRange() {
  const desde = document.getElementById('fecha-desde');
  const hasta = document.getElementById('fecha-hasta');
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const todayISO = `${yyyy}-${mm}-${dd}`;
  desde.value = todayISO;
  hasta.value = todayISO;
  desde.addEventListener('change', () => loadProductividad(desde.value, hasta.value));
  hasta.addEventListener('change', () => loadProductividad(desde.value, hasta.value));
}

function initFechaEmpleados() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  mesEmpleados.value = `${yyyy}-${mm}`;
  mesEmpleados.addEventListener('change', () => {
    const [year, month] = (mesEmpleados.value || `${yyyy}-${mm}`).split('-');
    loadEmpleados(`${year}-${month}-01`);
  });
}

function initMenu() {
  const menu = document.getElementById('side-menu');
  const items = document.querySelectorAll('.menu-item');
  menu.addEventListener('mouseenter', () => menu.classList.add('expanded'));
  menu.addEventListener('mouseleave', () => menu.classList.remove('expanded'));
  items.forEach((btn) => {
    btn.addEventListener('click', () => {
      items.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      if (btn.classList.contains('logout')) return;
      switchView(btn.dataset.target);
    });
  });
  logoutBtn.addEventListener('click', handleLogout);
  loadCurrentUser();
}

function initPaqueteriaModal() {
  const statButtons = document.querySelectorAll('.stat-click');
  statButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tipo = btn.dataset.tipo;
      const titleMap = {
        pendientes: 'Pendientes',
        sinTransporte: 'Sin transporte',
        vencidos: 'Vencidos (>3 días)',
      };
      modalTitle.textContent = `Empaquetados - ${titleMap[tipo] || ''}`;
      modalOverlay.classList.add('open');
      loadPaqueteriaLista(tipo);
    });
  });
  modalClose.addEventListener('click', () => modalOverlay.classList.remove('open'));
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) {
      modalOverlay.classList.remove('open');
    }
  });
  modalSearch.addEventListener('input', applyModalFilter);
  modalTableBody.addEventListener('click', (e) => {
    const btn = e.target.closest('.transport-btn');
    if (!btn) return;
    const id = Number(btn.dataset.id);
    const current = btn.dataset.transport || '';
    openTransportEditor(btn, id, current);
  });

  calendarClose.addEventListener('click', () => calendarOverlay.classList.remove('open'));
  calendarOverlay.addEventListener('click', (e) => {
    if (e.target === calendarOverlay) calendarOverlay.classList.remove('open');
  });

  tablaEmpleadosBody.addEventListener('click', async (e) => {
    const btn = e.target.closest('.transport-btn');
    if (!btn) return;
    const userId = Number(btn.dataset.user);
    const employee = empleadosRows.find((u) => u.id === userId);
    const [year, month] = mesEmpleados.value.split('-');
    await loadCalendario(userId, employee?.nombre || '', year, month);
  });
}

async function loadCalendario(userId, nombre, year, month) {
  try {
    const safeYear = Number(year) || new Date().getFullYear();
    const safeMonth = Number(month) || new Date().getMonth() + 1;
    calendarTitle.textContent = `Calendario de ${nombre} (${safeYear}-${String(safeMonth).padStart(2, '0')})`;
    calendarGrid.innerHTML = '';
    calendarStatus.textContent = 'Cargando...';
    const res = await fetch(`/api/empleados/tardes?userId=${userId}&year=${safeYear}&month=${safeMonth}`);
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || `Error ${res.status}`);
    }
    const data = await res.json();
    renderCalendario(data.dias || [], safeYear, safeMonth);
    calendarStatus.textContent = '';
    calendarOverlay.classList.add('open');
  } catch (error) {
    calendarStatus.textContent = `No se pudo cargar el calendario: ${error.message}`;
    calendarGrid.innerHTML = '';
    calendarOverlay.classList.add('open');
    console.error(error);
  }
}

function renderCalendario(dias, year, month) {
  calendarGrid.innerHTML = '';
  dias.forEach((d) => {
    const div = document.createElement('div');
    const cls =
      d.status === 'a_tiempo'
        ? 'green'
        : d.status === 'amarillo'
        ? 'yellow'
        : d.status === 'rojo'
        ? 'red'
        : 'gray';
    div.className = `day-card ${cls}`;
    const label = formatDayLabel(year, month, d.dia);
    div.innerHTML = `
      <p class="day-number">${label}</p>
      <p class="status">${d.minutos != null ? `${d.minutos} min tarde` : 'Sin registro'}</p>
    `;
    calendarGrid.appendChild(div);
  });
}

function formatDayLabel(year, month, dayNumber) {
  // month is 1-based
  const date = new Date(Number(year), Number(month) - 1, Number(dayNumber));
  const weekDays = ['DO', 'LU', 'MA', 'MI', 'JU', 'VI', 'SA'];
  const weekday = weekDays[date.getDay()] || '';
  return `${weekday} ${String(dayNumber).padStart(2, '0')}`;
}

function switchView(target) {
  if (target === 'empleados') {
    viewDashboard.classList.add('hidden');
    viewEmpleados.classList.remove('hidden');
    const [year, month] = mesEmpleados.value.split('-');
    loadEmpleados(`${year}-${month}-01`);
  } else {
    viewDashboard.classList.remove('hidden');
    viewEmpleados.classList.add('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

const defaultYearEncuestas = initYearSelect('year-encuestas', (y) => loadEncuestas(y));
const defaultYearMensual = initYearSelect('year-mensual', (y) => loadMensual(y));
const defaultYearVentas = initYearSelect('year-ventas', (y) => loadVentas(y));
initMenu();
initCollapsibles();
initPaqueteriaModal();
initFechaEmpleados();
loadTransportes();
loadEncuestas(defaultYearEncuestas);
initDateRange();
loadProductividad(document.getElementById('fecha-desde').value, document.getElementById('fecha-hasta').value);
loadMensual(defaultYearMensual);
loadVentas(defaultYearVentas);
loadPaqueteria();
