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
const statusPedidosClientes = document.getElementById('status-pedidos-clientes');
const menuToggle = document.getElementById('menu-toggle');
const menuBackdrop = document.getElementById('menu-backdrop');
const mesEmpleados = document.getElementById('mes-empleados');
const tablaEmpleadosBody = document.querySelector('#tabla-empleados tbody');
const filtroRoles = document.getElementById('filtro-roles');
const buscarEmpleados = document.getElementById('buscar-empleados');
const fechaPedidosClientes = document.getElementById('fecha-pedidos-clientes');
const tablaPedidosClientesBody = document.querySelector('#tabla-pedidos-clientes tbody');
const refreshPedidosClientes = document.getElementById('refresh-pedidos-clientes');
const tablaPedidosClientesHead = document.querySelector('#tabla-pedidos-clientes thead');
const statPcTotal = document.getElementById('stat-pc-total');
const statPcNuevos = document.getElementById('stat-pc-nuevos');
const statPcRecurrentes = document.getElementById('stat-pc-recurrentes');
const pcPrev = document.getElementById('pc-prev');
const pcNext = document.getElementById('pc-next');
const pcPageInfo = document.getElementById('pc-page-info');
const pcPageSizeSelect = document.getElementById('pc-page-size');
const iaChatWindow = document.getElementById('ia-chat-window');
const iaMessageInput = document.getElementById('ia-message');
const iaFileInput = document.getElementById('ia-file');
const iaSendBtn = document.getElementById('ia-send');
const iaStatus = document.getElementById('ia-status');
const iaSqlQuestionInput = document.getElementById('ia-sql-question');
const iaSqlSendBtn = document.getElementById('ia-sql-send');
const iaSqlStatus = document.getElementById('ia-sql-status');
const iaSqlQueryEl = document.getElementById('ia-sql-query');
const iaSqlExplanationEl = document.getElementById('ia-sql-explanation');
const iaSqlResultEl = document.getElementById('ia-sql-result');
const statusClientes = document.getElementById('status-clientes');
const tablaClientesBody = document.querySelector('#tabla-clientes tbody');
const tablaClientesHead = document.querySelector('#tabla-clientes thead');
const buscarClientes = document.getElementById('buscar-clientes');
const clientesPageSizeSelect = document.getElementById('clientes-page-size');
const clientesPrev = document.getElementById('clientes-prev');
const clientesNext = document.getElementById('clientes-next');
const clientesPageInfo = document.getElementById('clientes-page-info');
const refreshClientesBtn = document.getElementById('refresh-clientes');
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
const neOverlay = document.getElementById('ne-overlay');
const neTitle = document.getElementById('ne-title');
const neClose = document.getElementById('ne-close');
const neSearch = document.getElementById('ne-search');
const neStatus = document.getElementById('ne-status');
const neTableBody = document.querySelector('#ne-table tbody');
const nePrev = document.getElementById('ne-prev');
const neNext = document.getElementById('ne-next');
const nePageInfo = document.getElementById('ne-page-info');
const nePageSizeSelect = document.getElementById('ne-page-size');

let paqueteriaRows = [];
let transportesList = [];
let empleadosRows = [];
const viewDashboard = document.getElementById('view-dashboard');
const viewEmpleados = document.getElementById('view-empleados');
const viewClientes = document.getElementById('view-clientes');
const viewIa = document.getElementById('view-ia');
const viewSalon = document.getElementById('view-salon');
const viewPedidos = document.getElementById('view-pedidos');
const salonDesdeInput = document.getElementById('salon-desde');
const salonHastaInput = document.getElementById('salon-hasta');
const salonActualizarBtn = document.getElementById('salon-actualizar');
const statSalonTotal = document.getElementById('stat-salon-total');
const statSalonCantidad = document.getElementById('stat-salon-cantidad');
const statSalonTicket = document.getElementById('stat-salon-ticket');
const salonStatus = document.getElementById('salon-status');
const salonVendedorasChartEl = document.getElementById('chart-salon-vendedoras');
const pedidosDesdeInput = document.getElementById('pedidos-desde');
const pedidosHastaInput = document.getElementById('pedidos-hasta');
const pedidosActualizarBtn = document.getElementById('pedidos-actualizar');
const statPedidosTotal = document.getElementById('stat-pedidos-total');
const statPedidosCantidad = document.getElementById('stat-pedidos-cantidad');
const statPedidosTicket = document.getElementById('stat-pedidos-ticket');
const pedidosStatus = document.getElementById('pedidos-status');
const pedidosVendedorasChartEl = document.getElementById('chart-pedidos-vendedoras');
let clientesPage = 1;
let clientesPageSize = 10;
let clientesTotalPages = 1;
let clientesTerm = '';
let clientesRows = [];
let clientesSort = { key: null, dir: 'asc' };
let iaMessages = [];
let iaFiles = [];
let pedidosClientesRows = [];
let pedidosClientesSort = { key: null, dir: 'asc' };
let pcPage = 1;
let pcTotalPages = 1;
let pcPageSize = 10;
let nePage = 1;
let neTotalPages = 1;
let nePageSize = 10;
let neSearchTerm = '';
let neUserId = null;
let neUserName = '';
let sessionIdleMinutes = 30;
let sessionIdleTimer = null;
let chartSalonVendedoras = null;
let chartPedidosVendedoras = null;

const currencyFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 0,
});

function formatMoney(value) {
  return currencyFormatter.format(Number(value) || 0);
}

function initSalonResumen() {
  if (!salonDesdeInput || !salonHastaInput) return;
  const hoy = new Date();
  const hoyIso = hoy.toISOString().slice(0, 10);
  salonDesdeInput.value = hoyIso;
  salonHastaInput.value = hoyIso;
  const handler = () => loadSalonResumen();
  if (salonActualizarBtn) salonActualizarBtn.addEventListener('click', handler);
  salonDesdeInput.addEventListener('change', handler);
  salonHastaInput.addEventListener('change', handler);
  loadSalonResumen();
}

async function loadSalonResumen() {
  if (!salonDesdeInput || !salonHastaInput) return;
  try {
    if (salonStatus) salonStatus.textContent = 'Cargando...';
    const desde = salonDesdeInput.value || new Date().toISOString().slice(0, 10);
    const hasta = salonHastaInput.value || desde;
    const params = new URLSearchParams({ desde, hasta });
    const [resResumen, resVend] = await Promise.all([
      fetch(`/api/salon/resumen?${params.toString()}`),
      fetch(`/api/salon/vendedoras?${params.toString()}`),
    ]);
    if (!resResumen.ok) throw new Error('No se pudo cargar el resumen de salón');
    const data = await resResumen.json();
    let vendData = [];
    if (resVend.ok) {
      const parsed = await resVend.json();
      vendData = Array.isArray(parsed.data) ? parsed.data : [];
    }
    if (statSalonTotal) statSalonTotal.textContent = formatMoney(data.total || 0);
    if (statSalonCantidad) statSalonCantidad.textContent = data.cantidad ?? 0;
    if (statSalonTicket) statSalonTicket.textContent = formatMoney(data.ticketPromedio || 0);
    if (salonStatus) salonStatus.textContent = `Rango: ${data.desde || desde} a ${data.hasta || hasta}`;
    renderSalonVendedorasChart(vendData);
  } catch (error) {
    if (salonStatus) salonStatus.textContent = error.message || 'Error al cargar resumen de salón';
  }
}

function renderSalonVendedorasChart(rows) {
  if (!salonVendedorasChartEl) return;
  const labels = rows.map((r) => r.vendedora || 'Sin vendedora');
  const values = rows.map((r) => Number(r.cantidad) || 0);
  if (chartSalonVendedoras) {
    chartSalonVendedoras.data.labels = labels;
    chartSalonVendedoras.data.datasets[0].data = values;
    chartSalonVendedoras.update();
    return;
  }
  chartSalonVendedoras = new Chart(salonVendedorasChartEl, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Cantidad de ventas',
          data: values,
          backgroundColor: 'rgba(123, 215, 255, 0.6)',
          borderColor: 'rgba(123, 215, 255, 0.9)',
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.parsed.y} ventas`,
          },
        },
      },
      scales: {
        y: { beginAtZero: true, ticks: { precision: 0 } },
      },
    },
  });
}

function initPedidosResumen() {
  if (!pedidosDesdeInput || !pedidosHastaInput) return;
  const hoy = new Date();
  const hoyIso = hoy.toISOString().slice(0, 10);
  pedidosDesdeInput.value = hoyIso;
  pedidosHastaInput.value = hoyIso;
  const handler = () => loadPedidosResumen();
  if (pedidosActualizarBtn) pedidosActualizarBtn.addEventListener('click', handler);
  pedidosDesdeInput.addEventListener('change', handler);
  pedidosHastaInput.addEventListener('change', handler);
  loadPedidosResumen();
}

async function loadPedidosResumen() {
  if (!pedidosDesdeInput || !pedidosHastaInput) return;
  try {
    if (pedidosStatus) pedidosStatus.textContent = 'Cargando...';
    const desde = pedidosDesdeInput.value || new Date().toISOString().slice(0, 10);
    const hasta = pedidosHastaInput.value || desde;
    const params = new URLSearchParams({ desde, hasta });
    const [resResumen, resVend] = await Promise.all([
      fetch(`/api/pedidos/resumen?${params.toString()}`),
      fetch(`/api/pedidos/vendedoras?${params.toString()}`),
    ]);
    if (!resResumen.ok) throw new Error('No se pudo cargar el resumen de pedidos');
    const data = await resResumen.json();
    let vendData = [];
    if (resVend.ok) {
      const parsed = await resVend.json();
      vendData = Array.isArray(parsed.data) ? parsed.data : [];
    }
    if (statPedidosTotal) statPedidosTotal.textContent = formatMoney(data.total || 0);
    if (statPedidosCantidad) statPedidosCantidad.textContent = data.cantidad ?? 0;
    if (statPedidosTicket) statPedidosTicket.textContent = formatMoney(data.ticketPromedio || 0);
    if (pedidosStatus) pedidosStatus.textContent = `Rango: ${data.desde || desde} a ${data.hasta || hasta}`;
    renderPedidosVendedorasChart(vendData);
  } catch (error) {
    if (pedidosStatus) pedidosStatus.textContent = error.message || 'Error al cargar resumen de pedidos';
  }
}

function renderPedidosVendedorasChart(rows) {
  if (!pedidosVendedorasChartEl) return;
  const labels = rows.map((r) => r.vendedora || 'Sin vendedora');
  const values = rows.map((r) => Number(r.cantidad) || 0);
  if (chartPedidosVendedoras) {
    chartPedidosVendedoras.data.labels = labels;
    chartPedidosVendedoras.data.datasets[0].data = values;
    chartPedidosVendedoras.update();
    return;
  }
  chartPedidosVendedoras = new Chart(pedidosVendedorasChartEl, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Pedidos',
          data: values,
          backgroundColor: 'rgba(167, 139, 250, 0.6)',
          borderColor: 'rgba(167, 139, 250, 0.9)',
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.parsed.y} pedidos`,
          },
        },
      },
      scales: {
        y: { beginAtZero: true, ticks: { precision: 0 } },
      },
    },
  });
}

function updateSortIndicators(headEl, sortState) {
  if (!headEl) return;
  headEl.querySelectorAll('th[data-sort]').forEach((th) => {
    th.classList.remove('sorted-asc', 'sorted-desc');
    if (sortState.key === th.dataset.sort) {
      th.classList.add(sortState.dir === 'desc' ? 'sorted-desc' : 'sorted-asc');
    }
  });
}

function renderIaMessages() {
  if (!iaChatWindow) return;
  iaChatWindow.innerHTML = '';
  iaMessages.forEach((msg) => {
    const div = document.createElement('div');
    div.className = `chat-message ${msg.from}`;
    const filesText = (msg.files || []).length ? `<small>Adjuntos: ${(msg.files || []).map((f) => f.name).join(', ')}</small>` : '';
    div.innerHTML = `<p>${msg.text || ''}</p>${filesText}`;
    iaChatWindow.appendChild(div);
  });
  iaChatWindow.scrollTop = iaChatWindow.scrollHeight;
}

function renderIaSqlResult(rows) {
  if (!iaSqlResultEl) return;
  iaSqlResultEl.innerHTML = '';
  if (!Array.isArray(rows) || rows.length === 0) {
    const p = document.createElement('p');
    p.className = 'status';
    p.textContent = 'Sin resultados';
    iaSqlResultEl.appendChild(p);
    return;
  }

  const columns = Object.keys(rows[0]);
  const table = document.createElement('table');
  table.className = 'table';

  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  columns.forEach((col) => {
    const th = document.createElement('th');
    th.textContent = col;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  rows.forEach((row) => {
    const tr = document.createElement('tr');
    columns.forEach((col) => {
      const td = document.createElement('td');
      const value = row[col];
      td.textContent = value === null || value === undefined ? '' : value;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  iaSqlResultEl.appendChild(table);
}

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
      <td>${(row.fechaFactura)}</td>
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
      <td>${
        noEncVal > 0
          ? `<button class="link-btn noenc-btn" data-user="${row.id}" data-name="${row.nombre || ''}">${noEncVal}</button>`
          : noEncVal
      }</td>
      <td>${toNum(row.porcentajePedidos)}%</td>
      <td>${toNum(row.porcentajeVentas)}%</td>
    `;
    tablaEmpleadosBody.appendChild(tr);
  });
}

function renderNoEncuestados(rows) {
  if (!neTableBody) return;
  neTableBody.innerHTML = '';
  rows.forEach((row) => {
    const tr = document.createElement('tr');
    const cliente = `${row.nombre || ''} ${row.apellido || ''}`.trim();
    tr.innerHTML = `
      <td>${row.nropedido ?? ''}</td>
      <td>${cliente}</td>
      <td>${formatDate(row.fechaPedido)}</td>
      <td>${row.vendedora || ''}</td>
      <td>${row.encuesta || ''}</td>
    `;
    neTableBody.appendChild(tr);
  });
}

function renderClientes(rows) {
  tablaClientesBody.innerHTML = '';
  rows.forEach((row) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${row.nombre || ''}</td>
      <td>${row.apellido || ''}</td>
      <td>${row.mail || ''}</td>
      <td>${row.telefono || ''}</td>
      <td>${formatDate(row.updated_at)}</td>
      <td>${formatDate(row.ultimaCompra)}</td>
      <td>${row.cantFacturas ?? 0}</td>
      <td>${Number(row.ticketPromedio ?? 0).toFixed(2)}</td>
    `;
    tablaClientesBody.appendChild(tr);
  });
}

function renderPedidosClientes(rows) {
  tablaPedidosClientesBody.innerHTML = '';
  const uniqueNuevos = new Set();
  const uniqueRecurrentes = new Set();

  rows.forEach((row) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${row.nombre || ''}</td>
      <td>${row.apellido || ''}</td>
      <td>${row.totalPedidos ?? 0}</td>
      <td>${row.tipo || ''}</td>
    `;
    tablaPedidosClientesBody.appendChild(tr);

    if (row.idCliente) {
      if ((row.tipo || '').toLowerCase() === 'nuevo') uniqueNuevos.add(row.idCliente);
      if ((row.tipo || '').toLowerCase() === 'recurrente') uniqueRecurrentes.add(row.idCliente);
    }
  });

  if (statPcTotal) statPcTotal.textContent = rows.length;
  if (statPcNuevos) statPcNuevos.textContent = uniqueNuevos.size;
  if (statPcRecurrentes) statPcRecurrentes.textContent = uniqueRecurrentes.size;
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

async function loadClientes(page = 1) {
  try {
    setStatus(statusClientes, 'Cargando...');
    const params = new URLSearchParams();
    params.set('page', page);
    params.set('pageSize', clientesPageSize);
    const term = buscarClientes.value.trim();
    if (term) params.set('q', term);
    if (clientesSort.key) {
      params.set('sort', clientesSort.key);
      params.set('dir', clientesSort.dir);
    }
    const res = await fetchJSON(`/api/clientes?${params.toString()}`);
    clientesPage = res.page || 1;
    clientesTotalPages = res.totalPages || 1;
    clientesRows = res.data || [];
    renderClientes(clientesRows);
    clientesPageInfo.textContent = `Pбgina ${clientesPage} de ${clientesTotalPages}`;
    setStatus(statusClientes, `Total ${res.total || 0} clientes`);
  } catch (error) {
    setStatus(
      statusClientes,
      'Error cargando clientes. Revisa conexiИn al servidor/base.',
      true
    );
    console.error(error);
  }
}

async function loadPedidosClientes() {
  try {
    setStatus(statusPedidosClientes, 'Cargando...');
    const params = new URLSearchParams();
    const fecha = fechaPedidosClientes?.value;
    if (fecha) params.set('fecha', fecha);
    if (pedidosClientesSort.key) {
      params.set('sort', pedidosClientesSort.key);
      params.set('dir', pedidosClientesSort.dir);
    }
    params.set('page', pcPage);
    params.set('pageSize', pcPageSize);
    const res = await fetchJSON(`/api/pedidos/clientes?${params.toString()}`);
    pedidosClientesRows = res.data || [];
    renderPedidosClientes(pedidosClientesRows);
    pcTotalPages = res.totalPages || 1;
    pcPage = res.page || 1;
    if (pcPageInfo) pcPageInfo.textContent = `Página ${pcPage} de ${pcTotalPages}`;
    if (statPcTotal) statPcTotal.textContent = res.totalPedidos ?? 0;
    if (statPcNuevos) statPcNuevos.textContent = res.totalNuevos ?? 0;
    if (statPcRecurrentes) statPcRecurrentes.textContent = res.totalRecurrentes ?? 0;
    setStatus(statusPedidosClientes, `Fecha ${res.fecha}`);
  } catch (error) {
    setStatus(statusPedidosClientes, 'Error al cargar pedidos de clientes.', true);
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
    if (Number.isFinite(Number(data.sessionIdleMinutes))) {
      sessionIdleMinutes = Number(data.sessionIdleMinutes) || sessionIdleMinutes;
    }
    initIdleTimeout();
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

let idleListenersBound = false;
function resetIdleTimer() {
  if (sessionIdleTimer) {
    clearTimeout(sessionIdleTimer);
  }
  const ms = Math.max(1, Number(sessionIdleMinutes) || 0) * 60 * 1000;
  sessionIdleTimer = setTimeout(handleLogout, ms);
}

function initIdleTimeout() {
  if (idleListenersBound) {
    resetIdleTimer();
    return;
  }
  const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
  events.forEach((ev) => {
    window.addEventListener(ev, resetIdleTimer, { passive: true });
  });
  idleListenersBound = true;
  resetIdleTimer();
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
      if (!isHidden) {
        if (target === 'encuestas') loadEncuestas(defaultYearEncuestas);
        if (target === 'productividad') {
          const desde = document.getElementById('fecha-desde').value;
          const hasta = document.getElementById('fecha-hasta').value;
          loadProductividad(desde, hasta);
        }
        if (target === 'mensual') loadMensual(defaultYearMensual);
        if (target === 'ventas') loadVentas(defaultYearVentas);
        if (target === 'pedidos-clientes') loadPedidosClientes();
      }
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

function initPedidosClientes() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const todayISO = `${yyyy}-${mm}-${dd}`;
  if (fechaPedidosClientes) {
    fechaPedidosClientes.value = todayISO;
    fechaPedidosClientes.addEventListener('change', () => loadPedidosClientes());
  }
  if (refreshPedidosClientes) {
    refreshPedidosClientes.addEventListener('click', () => loadPedidosClientes());
  }
  if (pcPageSizeSelect) {
    pcPageSize = Number(pcPageSizeSelect.value) || pcPageSize;
    pcPageSizeSelect.addEventListener('change', () => {
      pcPageSize = Number(pcPageSizeSelect.value) || pcPageSize;
      pcPage = 1;
      loadPedidosClientes();
    });
  }
  if (pcPrev) {
    pcPrev.addEventListener('click', () => {
      if (pcPage > 1) {
        pcPage -= 1;
        loadPedidosClientes();
      }
    });
  }
  if (pcNext) {
    pcNext.addEventListener('click', () => {
      if (pcPage < pcTotalPages) {
        pcPage += 1;
        loadPedidosClientes();
      }
    });
  }
  if (tablaPedidosClientesHead) {
    tablaPedidosClientesHead.addEventListener('click', (e) => {
      const th = e.target.closest('th[data-sort]');
      if (!th) return;
      const key = th.dataset.sort;
      if (pedidosClientesSort.key === key) {
        pedidosClientesSort.dir = pedidosClientesSort.dir === 'asc' ? 'desc' : 'asc';
      } else {
        pedidosClientesSort.key = key;
        pedidosClientesSort.dir = 'asc';
      }
      pcPage = 1;
      loadPedidosClientes();
    });
  }
}

function initClientes() {
  if (clientesPageSizeSelect) {
    clientesPageSize = Number(clientesPageSizeSelect.value) || clientesPageSize;
    clientesPageSizeSelect.addEventListener('change', () => {
      clientesPageSize = Number(clientesPageSizeSelect.value) || clientesPageSize;
      loadClientes(1);
    });
  }
  if (refreshClientesBtn) {
    refreshClientesBtn.addEventListener('click', () => loadClientes(1));
  }
  if (buscarClientes) {
    let debounce;
    buscarClientes.addEventListener('input', () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => loadClientes(1), 250);
    });
  }
  if (clientesPrev) {
    clientesPrev.addEventListener('click', () => {
      if (clientesPage > 1) loadClientes(clientesPage - 1);
    });
  }
  if (clientesNext) {
    clientesNext.addEventListener('click', () => {
      if (clientesPage < clientesTotalPages) loadClientes(clientesPage + 1);
    });
  }
  if (tablaClientesHead) {
    tablaClientesHead.addEventListener('click', (e) => {
      const th = e.target.closest('th[data-sort]');
      if (!th) return;
      const key = th.dataset.sort;
      if (clientesSort.key === key) {
        clientesSort.dir = clientesSort.dir === 'asc' ? 'desc' : 'asc';
      } else {
        clientesSort.key = key;
        clientesSort.dir = 'asc';
      }
      loadClientes(1);
    });
  }
}

function initIaChat() {
  if (iaSendBtn) {
    iaSendBtn.addEventListener('click', sendIaMessage);
  }
  if (iaMessageInput) {
    iaMessageInput.addEventListener('keyup', (e) => {
      if (e.key === 'Enter') sendIaMessage();
    });
  }
  if (iaSqlSendBtn) {
    iaSqlSendBtn.addEventListener('click', sendIaSqlQuery);
  }
  if (iaSqlQuestionInput) {
    iaSqlQuestionInput.addEventListener('keyup', (e) => {
      if (e.key === 'Enter') sendIaSqlQuery();
    });
  }
}

async function sendIaMessage() {
  const text = iaMessageInput?.value?.trim();
  if (!text) return;
  const allowedExt = ['pdf', 'csv', 'xls', 'xlsx', 'doc', 'docx'];
  const filesSelected = Array.from(iaFileInput?.files || []);
  const invalid = filesSelected.find((f) => {
    const ext = f.name.split('.').pop()?.toLowerCase() || '';
    return !allowedExt.includes(ext);
  });
  if (invalid) {
    setStatus(iaStatus, 'Solo se permiten PDF, CSV, XLS, XLSX, DOC o DOCX.', true);
    return;
  }

  async function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
      reader.readAsDataURL(file);
    });
  }

  const files = [];
  for (const f of filesSelected) {
    const content = await fileToBase64(f);
    files.push({ name: f.name, size: f.size, content });
  }
  iaMessages.push({ from: 'user', text, files });
  renderIaMessages();
  iaMessageInput.value = '';
  if (iaStatus) iaStatus.textContent = 'Enviando...';
  try {
    const res = await fetch('/api/ia/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, files }),
    });
    const data = await res.json();
    iaMessages.push({ from: 'ia', text: data.reply || 'Sin respuesta', files: [] });
    renderIaMessages();
    if (iaStatus) iaStatus.textContent = '';
  } catch (error) {
    if (iaStatus) iaStatus.textContent = 'Error enviando mensaje';
  }
}

async function sendIaSqlQuery() {
  const question = iaSqlQuestionInput?.value?.trim();
  if (!question) return;
  setStatus(iaSqlStatus, 'Generando consulta...');
  if (iaSqlQueryEl) iaSqlQueryEl.textContent = '';
  if (iaSqlExplanationEl) iaSqlExplanationEl.textContent = '';
  if (iaSqlResultEl) iaSqlResultEl.innerHTML = '';
  try {
    const res = await fetch('/api/ia/db-query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || errData.message || `Error ${res.status}`);
    }
    const data = await res.json();
    if (iaSqlQueryEl) iaSqlQueryEl.textContent = data.query || '';
    if (iaSqlExplanationEl) iaSqlExplanationEl.textContent = data.explanation || '';
    renderIaSqlResult(Array.isArray(data.rows) ? data.rows : []);
    const totalRows = Number.isFinite(data.rowCount) ? `${data.rowCount} fila(s)` : '';
    const msg = data.message || totalRows || 'Consulta ejecutada';
    setStatus(iaSqlStatus, msg, data.rowCount === 0);
  } catch (error) {
    renderIaSqlResult([]);
    setStatus(iaSqlStatus, error.message || 'Error consultando IA', true);
  }
}

async function loadNoEncuestados(page = 1) {
  try {
    if (!neStatus) return;
    setStatus(neStatus, 'Cargando...');
    nePage = page;
    const params = new URLSearchParams();
    if (neUserId) params.set('userId', neUserId);
    const mes = mesEmpleados?.value;
    if (mes) params.set('fecha', `${mes}-01`);
    params.set('page', nePage);
    params.set('pageSize', nePageSize);
    if (neSearchTerm) params.set('q', neSearchTerm);
    const res = await fetchJSON(`/api/empleados/no-encuestados?${params.toString()}`);
    neTotalPages = res.totalPages || 1;
    nePage = res.page || 1;
    renderNoEncuestados(res.data || []);
    if (nePageInfo) nePageInfo.textContent = `Página ${nePage} de ${neTotalPages}`;
    setStatus(neStatus, `Total ${res.total || 0}`);
  } catch (error) {
    setStatus(neStatus, error.message || 'No se pudieron cargar los no encuestados', true);
    if (neTableBody) neTableBody.innerHTML = '';
  }
}

function openNoEncuestadosModal(userId, userName) {
  neUserId = userId;
  neUserName = userName || '';
  nePage = 1;
  neSearchTerm = '';
  if (neSearch) neSearch.value = '';
  if (nePageSizeSelect) nePageSizeSelect.value = String(nePageSize);
  if (neTitle) neTitle.textContent = `No encuestados de ${neUserName || 'vendedor'}`;
  if (neOverlay) neOverlay.classList.add('open');
  loadNoEncuestados(1);
}

function closeNoEncuestadosModal() {
  if (neOverlay) neOverlay.classList.remove('open');
}

function initMenu() {
  const menu = document.getElementById('side-menu');
  const items = document.querySelectorAll('.menu-item');
  const mqMobile = window.matchMedia('(max-width: 960px)');

  const toggleMenu = (force) => {
    const shouldOpen = typeof force === 'boolean' ? force : !menu.classList.contains('open');
    if (shouldOpen) {
      menu.classList.add('open');
      document.body.classList.add('menu-open');
    } else {
      menu.classList.remove('open');
      document.body.classList.remove('menu-open');
    }
  };

  if (menuToggle) menuToggle.addEventListener('click', () => toggleMenu());
  if (menuBackdrop) menuBackdrop.addEventListener('click', () => toggleMenu(false));

  menu.addEventListener('mouseenter', () => menu.classList.add('expanded'));
  menu.addEventListener('mouseleave', () => menu.classList.remove('expanded'));
  items.forEach((btn) => {
    btn.addEventListener('click', () => {
      items.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      if (btn.classList.contains('logout')) return;
      switchView(btn.dataset.target);
      if (mqMobile.matches) toggleMenu(false);
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
    const btnCal = e.target.closest('.transport-btn');
    if (btnCal) {
      const userId = Number(btnCal.dataset.user);
      const employee = empleadosRows.find((u) => u.id === userId);
      const [year, month] = mesEmpleados.value.split('-');
      await loadCalendario(userId, employee?.nombre || '', year, month);
      return;
    }
    const btnNoEnc = e.target.closest('.noenc-btn');
    if (btnNoEnc) {
      const userId = Number(btnNoEnc.dataset.user);
      const name = btnNoEnc.dataset.name || '';
      openNoEncuestadosModal(userId, name);
    }
  });
}

function initNoEncuestadosModal() {
  if (neClose) neClose.addEventListener('click', closeNoEncuestadosModal);
  if (neOverlay) {
    neOverlay.addEventListener('click', (e) => {
      if (e.target === neOverlay) closeNoEncuestadosModal();
    });
  }
  if (nePrev)
    nePrev.addEventListener('click', () => {
      if (nePage > 1) loadNoEncuestados(nePage - 1);
    });
  if (neNext)
    neNext.addEventListener('click', () => {
      if (nePage < neTotalPages) loadNoEncuestados(nePage + 1);
    });
  if (nePageSizeSelect)
    nePageSizeSelect.addEventListener('change', () => {
      nePageSize = Number(nePageSizeSelect.value) || 10;
      loadNoEncuestados(1);
    });
  if (neSearch) {
    let t;
    neSearch.addEventListener('input', (e) => {
      clearTimeout(t);
      neSearchTerm = e.target.value.trim();
      t = setTimeout(() => loadNoEncuestados(1), 250);
    });
  }
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
  const views = [viewDashboard, viewEmpleados, viewClientes, viewIa, viewSalon, viewPedidos];
  views.forEach((v) => v.classList.add('hidden'));

  if (target === 'empleados') {
    viewEmpleados.classList.remove('hidden');
    const [year, month] = mesEmpleados.value.split('-');
    loadEmpleados(`${year}-${month}-01`);
  } else if (target === 'clientes') {
    viewClientes.classList.remove('hidden');
    loadClientes(clientesPage);
  } else if (target === 'ia') {
    viewIa.classList.remove('hidden');
  } else if (target === 'salon') {
    viewSalon.classList.remove('hidden');
    loadSalonResumen();
  } else if (target === 'pedidos') {
    viewPedidos.classList.remove('hidden');
    loadPedidosResumen();
  } else {
    viewDashboard.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

const defaultYearEncuestas = initYearSelect('year-encuestas', (y) => loadEncuestas(y));
const defaultYearMensual = initYearSelect('year-mensual', (y) => loadMensual(y));
const defaultYearVentas = initYearSelect('year-ventas', (y) => loadVentas(y));
initMenu();
initCollapsibles();
initPaqueteriaModal();
initNoEncuestadosModal();
initFechaEmpleados();
initClientes();
initPedidosClientes();
initIaChat();
initSalonResumen();
initPedidosResumen();
loadTransportes();
loadEncuestas(defaultYearEncuestas);
initDateRange();
loadProductividad(document.getElementById('fecha-desde').value, document.getElementById('fecha-hasta').value);
loadMensual(defaultYearMensual);
loadVentas(defaultYearVentas);
loadPaqueteria();
loadPedidosClientes();
