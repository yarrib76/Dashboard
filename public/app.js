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
const sampleFacturas = [
  {
    id: 1,
    cliente: 'Cliente Demo',
    nroFactura: 1501,
    totales: 18500.5,
    envio: 1200,
    totalConEnvio: 19700.5,
    tipoPagoId: 1,
    tipoPago: 'Transferencia',
    estadoId: 2,
    estado: 'Cobrado',
    fecha: '2025-12-01',
    pagoMixto: 'No',
    comentario: 'Sin notas',
  },
  {
    id: 2,
    cliente: 'Cliente Test',
    nroFactura: 1499,
    totales: 9200,
    envio: 0,
    totalConEnvio: 9200,
    tipoPagoId: 2,
    tipoPago: 'Tarjeta',
    estadoId: 1,
    estado: 'Pendiente',
    fecha: '2025-11-28',
    pagoMixto: 'Sí',
    comentario: 'Pago mixto 50/50',
  },
];
const sampleFacturasTipoPagos = [
  { value: 1, label: 'Transferencia' },
  { value: 2, label: 'Tarjeta' },
  { value: 3, label: 'Efectivo' },
];
const sampleFacturasEstados = [
  { value: 1, label: 'Pendiente' },
  { value: 2, label: 'Cobrado' },
  { value: 3, label: 'Anulado' },
];
const sampleComisionesTardes = [
  { nombre: 'Empleado Demo', tardes: 6, descuento: 0 },
  { nombre: 'Empleado Test', tardes: 5, descuento: 0 },
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
let calendarCurrentUserId = null;
let calendarCurrentYear = null;
let calendarCurrentMonth = null;
let calendarDiasData = [];
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
const viewMercaderia = document.getElementById('view-mercaderia');
const viewAbm = document.getElementById('view-abm');
const viewFacturas = document.getElementById('view-facturas');
const viewComisiones = document.getElementById('view-comisiones');
const mercDesde = document.getElementById('merc-desde');
const mercHasta = document.getElementById('merc-hasta');
const mercProveedoresList = document.getElementById('merc-proveedores-list');
const mercWebTn = document.getElementById('merc-webtn');
const mercSearch = document.getElementById('merc-search');
const mercBuscarBtn = document.getElementById('merc-buscar');
const mercExportBtn = document.getElementById('merc-export');
const mercGraficarBtn = document.getElementById('merc-graficar');
const mercTableBody = document.querySelector('#merc-table tbody');
const mercStatus = document.getElementById('merc-status');
const mercIaOverlay = document.getElementById('merc-ia-overlay');
const mercIaClose = document.getElementById('merc-ia-close');
const mercIaTitle = document.getElementById('merc-ia-title');
const mercIaInfo = document.getElementById('merc-ia-info');
const mercIaYear = document.getElementById('merc-ia-year');
const mercIaMonthsList = document.getElementById('merc-ia-months-list');
const mercIaStock = document.getElementById('merc-ia-stock');
const mercIaDemanda = document.getElementById('merc-ia-demanda');
const mercIaCompra = document.getElementById('merc-ia-compra');
const mercIaTableBody = document.querySelector('#merc-ia-table tbody');
const mercIaStatus = document.getElementById('merc-ia-status');
const mercIaRun = document.getElementById('merc-ia-run');
const mercProvWrap = document.getElementById('merc-proveedores-wrap');
const mercProvToggle = document.getElementById('merc-proveedores-toggle');
const mercIaMonthsWrap = document.getElementById('merc-ia-months-wrap');
const mercIaMonthsToggle = document.getElementById('merc-ia-months-toggle');
const mercPrev = document.getElementById('merc-prev');
const mercNext = document.getElementById('merc-next');
const mercPageInfo = document.getElementById('merc-page-info');
const mercPageSizeSelect = document.getElementById('merc-page-size');
const mercImgOverlay = document.getElementById('merc-img-overlay');
const mercImgClose = document.getElementById('merc-img-close');
const mercImgFull = document.getElementById('merc-img-full');
const mercImgZoomIn = document.getElementById('merc-img-zoom-in');
const mercImgZoomOut = document.getElementById('merc-img-zoom-out');
const mercImgZoomReset = document.getElementById('merc-img-zoom-reset');
const mercChartOverlay = document.getElementById('merc-chart-overlay');
const mercChartClose = document.getElementById('merc-chart-close');
const mercChartCanvas = document.getElementById('merc-chart');
const mercChartStatus = document.getElementById('merc-chart-status');
const abmRefreshBtn = document.getElementById('abm-refresh');
const abmTableBody = document.querySelector('#abm-table tbody');
const abmTableHead = document.querySelector('#abm-table thead');
const abmStatus = document.getElementById('abm-status');
const abmBarcodeOverlay = document.getElementById('abm-barcode-overlay');
const abmBarcodeClose = document.getElementById('abm-barcode-close');
const abmBarcodeSvg = document.getElementById('abm-barcode-svg');
const abmBarcodeCode = document.getElementById('abm-barcode-code');
const abmBarcodeText = document.getElementById('abm-barcode-text');
const abmBarcodeStatus = document.getElementById('abm-barcode-status');
const abmBarcodePrint = document.getElementById('abm-barcode-print');
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
const statusFacturas = document.getElementById('status-facturas');
const tablaFacturasBody = document.querySelector('#tabla-facturas tbody');
const facturasPrev = document.getElementById('facturas-prev');
const facturasNext = document.getElementById('facturas-next');
const facturasPageInfo = document.getElementById('facturas-page-info');
const facturasPageSizeSelect = document.getElementById('facturas-page-size');
const facturasTable = document.getElementById('tabla-facturas');
const facturasRefresh = document.getElementById('facturas-refresh');
const facturasFilterCliente = document.getElementById('filter-facturas-cliente');
const facturasFilterFecha = document.getElementById('filter-facturas-fecha');
const facturasFilterNro = document.getElementById('filter-facturas-nro');
const facturasFilterTotal = document.getElementById('filter-facturas-total');
const facturasFilterTotalEnvio = document.getElementById('filter-facturas-total-envio');
const facturasFilterCobrar = document.getElementById('filter-facturas-cobrar');
const facturasFilterTipoPago = document.getElementById('filter-facturas-tipo-pago');
const facturasFilterEstado = document.getElementById('filter-facturas-estado');
const comisionesDesdeInput = document.getElementById('comisiones-desde');
const comisionesHastaInput = document.getElementById('comisiones-hasta');
const comisionesPorcentajeInput = document.getElementById('comisiones-porcentaje');
const comisionesEmpleadosInput = document.getElementById('comisiones-empleados');
const comisionesRefreshBtn = document.getElementById('comisiones-refrescar');
const comisionesTotalEl = document.getElementById('comisiones-total');
const comisionesPorcentajeEl = document.getElementById('comisiones-total-porcentaje');
const comisionesEmpleadosEl = document.getElementById('comisiones-total-empleados');
const comisionesPagarEl = document.getElementById('comisiones-total-pagar');
const comisionesStatus = document.getElementById('status-comisiones');
const comisionesTardesBody = document.querySelector('#tabla-comisiones-tardes tbody');
const comisionesTardesStatus = document.getElementById('status-comisiones-tardes');
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
let mercRows = [];
let mercFiltered = [];
const mercSelected = new Set();
let mercCurrentRow = null;
let mercPage = 1;
let mercPageSize = 10;
let mercTotalPages = 1;
const mercProveedorSet = new Set();
const mercMesSet = new Set();
let mercImgZoom = 1;
let mercChart = null;
let abmDataTable = null;
let abmLoaded = false;
let facturasRows = [];
let facturasTipoPagos = [];
let facturasEstados = [];
let facturasLoaded = false;
let facturasPage = 1;
let facturasPageSize = 10;
let facturasTotalPages = 1;
const facturasColumnWidths = [160, 110];
const facturasFilters = {
  cliente: '',
  fecha: '',
  nroFactura: '',
  totales: '',
  totalConEnvio: '',
  cobrar: '',
  tipoPago: '',
  estado: '',
};
let comisionesTotal = 0;
let comisionesPorcentaje = 1.5;
let comisionesEmpleados = 1;
let comisionesLoaded = false;
let comisionesTardesRows = [];

function textMatchesAllTokens(text, filter) {
  if (!filter) return true;
  const base = (text || '').toLowerCase();
  const tokens = filter.split(/\s+/).filter(Boolean);
  return tokens.every((t) => base.includes(t));
}

const currencyFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 0,
});

function formatMoney(value) {
  return currencyFormatter.format(Number(value) || 0);
}

function fillSelectOptions(selectEl, options) {
  if (!selectEl) return;
  selectEl.innerHTML = '';
  options.forEach((opt) => {
    const option = document.createElement('option');
    option.value = opt.value;
    option.textContent = opt.label;
    selectEl.appendChild(option);
  });
}

function getSelectedMonths() {
  return Array.from(mercMesSet);
}

function calcularCobrar(row) {
  const base = Number(row.totalConEnvio) || Number(row.totales) || 0;
  const efectivo = base === 0 ? Number(row.totales) || 0 : base;
  return Math.round((efectivo - efectivo * 0.025) * 100) / 100;
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
  const totalV = values.reduce((acc, v) => acc + v, 0);
  if (chartSalonVendedoras) {
    chartSalonVendedoras.data.labels = labels;
    chartSalonVendedoras.data.datasets[0].data = values;
    chartSalonVendedoras.options.plugins.tooltip.callbacks.label = (ctx) => {
      const pct = totalV > 0 ? ((ctx.parsed.y / totalV) * 100).toFixed(1) : '0.0';
      return `${ctx.parsed.y} ventas (${pct}%)`;
    };
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
            label: (ctx) => {
              const pct = totalV > 0 ? ((ctx.parsed.y / totalV) * 100).toFixed(1) : '0.0';
              return `${ctx.parsed.y} ventas (${pct}%)`;
            },
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

function getSelectedOptions(selectEl) {
  if (!selectEl) return [];
  return Array.from(selectEl.selectedOptions).map((o) => o.value).filter(Boolean);
}

function getSelectedProviders() {
  return Array.from(mercProveedorSet);
}

async function loadProveedores() {
  try {
    const res = await fetchJSON('/api/proveedores');
    const opts = (res.data || [])
      .map((r) => ({ value: r.proveedor, label: r.proveedor }))
      .sort((a, b) => a.label.localeCompare(b.label));
    if (mercProveedoresList) {
      mercProveedoresList.innerHTML = '';
      opts.forEach((opt) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'pill-option';
        btn.dataset.value = opt.value;
        btn.textContent = opt.label;
        mercProveedoresList.appendChild(btn);
      });
      mercProveedoresList.addEventListener('click', (e) => {
        const btn = e.target.closest('.pill-option');
        if (!btn) return;
        const value = btn.dataset.value;
        if (!value) return;
        if (mercProveedorSet.has(value)) {
          mercProveedorSet.delete(value);
          btn.classList.remove('selected');
        } else {
          mercProveedorSet.add(value);
          btn.classList.add('selected');
        }
        mercPage = 1;
        loadMercaderia();
      });
    }
  } catch (error) {
    console.error('Error cargando proveedores', error);
  }
}

function applyMercFilters() {
  const term = (mercSearch?.value || '').toLowerCase();
  mercFiltered = mercRows.filter((row) => {
    if (!term) return true;
    return (
      (row.articulo || '').toLowerCase().includes(term) ||
      (row.detalle || '').toLowerCase().includes(term) ||
      (row.proveedorSku || '').toLowerCase().includes(term) ||
      String(row.totalVendido || '').includes(term) ||
      String(row.totalStock || '').includes(term) ||
      String(row.precioVenta || '').includes(term)
    );
  });
  mercPage = 1;
  renderMercaderiaTable();
}

function renderMercaderiaTable() {
  if (!mercTableBody) return;
  mercTableBody.innerHTML = '';
  mercTotalPages = Math.max(1, Math.ceil(mercFiltered.length / mercPageSize));
  mercPage = Math.min(mercPage, mercTotalPages);
  const start = (mercPage - 1) * mercPageSize;
  const slice = mercFiltered.slice(start, start + mercPageSize);
  slice.forEach((row, idx) => {
    const tr = document.createElement('tr');
    const checked = mercSelected.has(row.articulo);
    const imgHtml = row.imagessrc ? `<img src="${row.imagessrc}" alt="img" width="48" class="merc-thumb" loading="lazy">` : '';
    const stockClass = row.totalStock < 10 ? 'low-stock' : '';
    tr.innerHTML = `
      <td><input type="checkbox" class="merc-select" data-id="${row.articulo}" ${checked ? 'checked' : ''}></td>
      <td>${row.articulo || ''}</td>
      <td>${row.detalle || ''}</td>
      <td>${row.proveedorSku || ''}</td>
      <td>${row.totalVendido ?? 0}</td>
      <td class="${stockClass}">${row.totalStock ?? 0}</td>
      <td>${formatMoney(row.precioVenta || 0)}</td>
      <td><span class="merc-img" data-articulo="${row.articulo}">${imgHtml}</span></td>
      <td><button class="icon-button merc-ia-btn" data-idx="${start + idx}" title="Predicción IA">🤖</button></td>
    `;
    mercTableBody.appendChild(tr);
  });
  if (mercPageInfo) mercPageInfo.textContent = `Página ${mercPage} de ${mercTotalPages}`;
  if (mercWebTn?.checked) {
    loadMercaderiaImages(slice);
  }
}

async function loadMercaderia() {
  if (mercStatus) mercStatus.textContent = 'Cargando...';
  try {
    const params = new URLSearchParams();
    if (mercDesde?.value) params.set('desde', mercDesde.value);
    if (mercHasta?.value) params.set('hasta', mercHasta.value);
    const provs = getSelectedProviders();
    if (provs.length) params.set('proveedores', provs.join(','));
    if (mercWebTn?.checked) params.set('webTn', 'true');
    const url = params.toString() ? `/api/mercaderia/top?${params.toString()}` : '/api/mercaderia/top';
    const res = await fetchJSON(url);
    mercRows = res.data || [];
    mercFiltered = mercRows.slice();
    applyMercFilters();
    if (mercStatus) mercStatus.textContent = `Resultados: ${mercFiltered.length} (rango ${res.desde} a ${res.hasta})`;
  } catch (error) {
    if (mercStatus) mercStatus.textContent = 'Error al cargar artículos más vendidos';
    console.error(error);
  }
}

function initMercaderia() {
  if (!viewMercaderia) return;
  const hoy = new Date();
  const firstDay = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  if (mercDesde) mercDesde.value = firstDay.toISOString().slice(0, 10);
  if (mercHasta) mercHasta.value = hoy.toISOString().slice(0, 10);
  loadProveedores();
  if (mercProvToggle && mercProvWrap) {
    mercProvToggle.addEventListener('click', () => {
      mercProvWrap.classList.toggle('open');
    });
    document.addEventListener('click', (e) => {
      if (!mercProvWrap.contains(e.target)) mercProvWrap.classList.remove('open');
    });
  }
  if (mercBuscarBtn) mercBuscarBtn.addEventListener('click', loadMercaderia);
  if (mercWebTn) mercWebTn.addEventListener('change', loadMercaderia);
  if (mercSearch) mercSearch.addEventListener('input', applyMercFilters);
  if (mercExportBtn) mercExportBtn.addEventListener('click', exportMercaderia);
  if (mercGraficarBtn) mercGraficarBtn.addEventListener('click', graficarMercaderia);
  if (mercPrev) mercPrev.addEventListener('click', () => {
    if (mercPage > 1) {
      mercPage -= 1;
      renderMercaderiaTable();
    }
  });
  if (mercNext) mercNext.addEventListener('click', () => {
    if (mercPage < mercTotalPages) {
      mercPage += 1;
      renderMercaderiaTable();
    }
  });
  if (mercPageSizeSelect)
    mercPageSizeSelect.addEventListener('change', () => {
      mercPageSize = Number(mercPageSizeSelect.value) || 10;
      mercPage = 1;
      renderMercaderiaTable();
    });
  if (mercTableBody) {
    mercTableBody.addEventListener('change', (e) => {
      const cb = e.target.closest('.merc-select');
      if (!cb) return;
      const id = cb.dataset.id;
      if (!id) return;
      if (cb.checked) mercSelected.add(id);
      else mercSelected.delete(id);
    });
    mercTableBody.addEventListener('click', (e) => {
      const btn = e.target.closest('.merc-ia-btn');
      if (btn) {
        const idx = Number(btn.dataset.idx);
        const row = mercFiltered[idx];
        if (row) openMercIa(row);
        return;
      }
      const imgEl = e.target.closest('.merc-thumb');
      if (imgEl) {
        openMercImage(imgEl.src);
      }
    });
  }
  if (mercIaClose) mercIaClose.addEventListener('click', closeMercIa);
  if (mercIaOverlay) mercIaOverlay.addEventListener('click', (e) => {
    if (e.target === mercIaOverlay) closeMercIa();
  });
  if (mercIaRun) mercIaRun.addEventListener('click', runMercIa);
  if (mercIaMonthsToggle && mercIaMonthsWrap) {
    mercIaMonthsToggle.addEventListener('click', () => {
      mercIaMonthsWrap.classList.toggle('open');
    });
    document.addEventListener('click', (e) => {
      if (!mercIaMonthsWrap.contains(e.target)) mercIaMonthsWrap.classList.remove('open');
    });
  }
  if (mercImgClose) mercImgClose.addEventListener('click', closeMercImage);
  if (mercImgOverlay)
    mercImgOverlay.addEventListener('click', (e) => {
      if (e.target === mercImgOverlay) closeMercImage();
    });
  if (mercImgZoomIn)
    mercImgZoomIn.addEventListener('click', () => {
      setMercImgZoom(mercImgZoom + 0.25);
    });
  if (mercImgZoomOut)
    mercImgZoomOut.addEventListener('click', () => {
      setMercImgZoom(mercImgZoom - 0.25);
    });
  if (mercImgZoomReset)
    mercImgZoomReset.addEventListener('click', () => {
      setMercImgZoom(1);
    });
  if (mercChartClose)
    mercChartClose.addEventListener('click', () => {
      if (mercChartOverlay) mercChartOverlay.classList.remove('open');
      if (mercChart) mercChart.destroy();
      mercChart = null;
    });
  // inicializa años para IA
  if (mercIaYear) {
    const opts = [];
    for (let y = 2025; y <= 2030; y += 1) {
      opts.push({ value: String(y), label: String(y) });
    }
    fillSelectOptions(mercIaYear, opts);
    mercIaYear.value = String(hoy.getFullYear());
  }
  if (mercIaMonthsList) {
    const months = [
      'Enero',
      'Febrero',
      'Marzo',
      'Abril',
      'Mayo',
      'Junio',
      'Julio',
      'Agosto',
      'Septiembre',
      'Octubre',
      'Noviembre',
      'Diciembre',
    ];
    mercIaMonthsList.innerHTML = '';
    months.forEach((name, idx) => {
      const val = String(idx + 1);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pill-option';
      btn.dataset.value = val;
      btn.textContent = name;
      mercIaMonthsList.appendChild(btn);
    });
    mercIaMonthsList.addEventListener('click', (e) => {
      const btn = e.target.closest('button.pill-option');
      if (!btn) return;
      const val = btn.dataset.value;
      if (!val) return;
      if (mercMesSet.has(val)) {
        mercMesSet.delete(val);
        btn.classList.remove('selected');
      } else {
        mercMesSet.add(val);
        btn.classList.add('selected');
      }
    });
  }
  // primera carga
  loadMercaderia();
}

function closeMercIa() {
  if (mercIaOverlay) mercIaOverlay.classList.remove('open');
  mercCurrentRow = null;
  if (mercIaStatus) mercIaStatus.textContent = '';
  if (mercIaTableBody) mercIaTableBody.innerHTML = '';
}

function openMercIa(row) {
  mercCurrentRow = row;
  if (mercIaTitle) mercIaTitle.textContent = `Predicción - ${row.articulo}`;
  if (mercIaInfo) mercIaInfo.textContent = `${row.detalle || ''}`;
  if (mercIaStock) mercIaStock.value = row.totalStock || 0;
  if (mercIaDemanda) mercIaDemanda.value = '';
  if (mercIaCompra) mercIaCompra.value = '';
  if (mercIaTableBody) mercIaTableBody.innerHTML = '';
  if (mercIaStatus) mercIaStatus.textContent = 'Selecciona año y meses, luego Ejecutar.';
  if (mercIaOverlay) mercIaOverlay.classList.add('open');
}

async function runMercIa() {
  if (!mercCurrentRow) return;
  try {
    if (mercIaStatus) mercIaStatus.textContent = 'Calculando...';
    const meses = getSelectedMonths().map((m) => Number(m));
    if (!meses.length) {
      if (mercIaStatus) mercIaStatus.textContent = 'Selecciona meses para predecir.';
      return;
    }
    const payload = {
      articulo: mercCurrentRow.articulo,
      detalle: mercCurrentRow.detalle,
      anio: Number(mercIaYear?.value) || new Date().getFullYear(),
      meses,
      stockActual: Number(mercIaStock?.value) || 0,
    };
    const res = await fetch('/api/mercaderia/prediccion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(errText || 'No se pudo calcular la predicción');
    }
    const data = await res.json();
    let resultados = [];
    if (Array.isArray(data.resultados)) {
      resultados = data.resultados;
    } else if (data.mes && (data.prediccion_ventas_mes || data.prediccion)) {
      resultados = [
        {
          mes: data.mes,
          prediccion: data.prediccion_ventas_mes ?? data.prediccion,
          demanda_total_horizonte: data.demanda_total_horizonte,
          compra_sugerida_total: data.compra_sugerida_total,
          stock_actual: data.stock_actual,
        },
      ];
    }
    const firstRes = Array.isArray(resultados) && resultados.length ? resultados[0] : null;
    const demandaTotal =
      firstRes?.demanda_total_horizonte ??
      data.demanda_total_horizonte ??
      data.demanda_total ??
      null;
    const stockVal = Number(mercIaStock?.value) || 0;
    const compraSugerida =
      firstRes?.compra_sugerida_total ??
      data.compra_sugerida_total ??
      data.compra_sugerida ??
      (demandaTotal != null ? Math.max(0, (Number(demandaTotal) || 0) - stockVal) : null);
    
    if (mercIaDemanda) mercIaDemanda.value = demandaTotal != null ? demandaTotal : '';
    if (mercIaCompra) mercIaCompra.value = compraSugerida != null ? compraSugerida : '';
    // No modificar el stock mostrado; se usa el valor de la grilla/input

    if (Array.isArray(resultados) && mercIaTableBody) {
      mercIaTableBody.innerHTML = '';
      const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
      resultados.forEach((r) => {
        const mesLabel = monthNames[(Number(r.mes) || 1) - 1] || r.mes;
        const pred = r.prediccion ?? r.prediccion_ventas_mes ?? r.total ?? '';
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${mesLabel}</td><td>${pred}</td>`;
        mercIaTableBody.appendChild(tr);
      });
    }
    if (mercIaStatus) mercIaStatus.textContent = 'Predicción generada.';
  } catch (error) {
    if (mercIaStatus) mercIaStatus.textContent = error.message || 'Error en predicción';
  }
}

async function loadMercaderiaImages(rows) {
  try {
    await Promise.all(
      rows.map(async (row) => {
        try {
          if (row.imagessrc) return;
          const res = await fetchJSON(`/api/mercaderia/image?articulo=${encodeURIComponent(row.articulo)}`);
          const cell = mercTableBody?.querySelector(`.merc-img[data-articulo="${row.articulo}"]`);
          if (cell && res.imagessrc) {
            cell.innerHTML = `<img src="${res.imagessrc}" alt="img" width="48" loading="lazy" class="merc-thumb">`;
            row.imagessrc = res.imagessrc;
          }
        } catch (_err) {
          /* silencioso por cada imagen */
        }
      })
    );
  } catch (_err) {
    /* silencioso */
  }
}

function exportMercaderia() {
  const rows = mercFiltered.filter((r) => mercSelected.has(r.articulo));
  if (!rows.length) {
    if (mercStatus) mercStatus.textContent = 'Seleccione al menos un artículo para exportar.';
    return;
  }
  const headers = ['Articulo', 'Detalle', 'ProveedorSku', 'Total Vendido', 'Total Stock', 'Precio Venta'];
  const csvRows = [headers.join(',')];
  rows.forEach((r) => {
    const row = [
      r.articulo,
      (r.detalle || '').replace(/,/g, ' '),
      r.proveedorSku || '',
      r.totalVendido ?? 0,
      r.totalStock ?? 0,
      r.precioVenta ?? 0,
    ];
    csvRows.push(row.join(','));
  });
  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'mercaderia.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  if (mercStatus) mercStatus.textContent = `Exportado ${rows.length} artículo(s).`;
}

async function graficarMercaderia() {
  const rows = mercFiltered.filter((r) => mercSelected.has(r.articulo));
  if (!rows.length) {
    if (mercStatus) mercStatus.textContent = 'Seleccione al menos un artículo para graficar.';
    return;
  }
  try {
    const desde = mercDesde?.value;
    const params = new URLSearchParams();
    params.set('articulos', rows.map((r) => r.articulo).join(','));
    if (desde) params.set('desde', desde);
    const res = await fetchJSON(`/api/mercaderia/series?${params.toString()}`);
    const detailMap = Object.fromEntries(rows.map((r) => [r.articulo, r.detalle || '']));
    const labels = [];
    const labelSet = new Set();
    const monthNamesShort = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const byArticulo = res.data || {};
    const datasets = [];
    Object.entries(byArticulo).forEach(([art, series], idx) => {
      const dataPoints = Array(6).fill(0);
      series.forEach((item) => {
        const key = `${item.anio}-${String(item.mes).padStart(2, '0')}`;
        labelSet.add(key);
      });
      datasets.push({
        label: art,
        data: dataPoints,
        backgroundColor: colorByIndex(idx, 0.15),
        borderColor: colorByIndex(idx, 0.9),
        borderWidth: 2,
        fill: false,
        detail: detailMap[art] || '',
      });
    });
    const sortedLabels = Array.from(labelSet)
      .sort()
      .slice(-6)
      .map((k) => {
        const [y, m] = k.split('-');
        return `${monthNamesShort[Number(m) - 1]} ${y}`;
      });
    // rebuild data with last 6 labels only
    Object.entries(byArticulo).forEach(([art, series]) => {
      const ds = datasets.find((d) => d.label === art);
      if (!ds) return;
      ds.data = sortedLabels.map((lbl) => {
        const [monLabel, yearLabel] = lbl.split(' ');
        const mesIndex = monthNamesShort.indexOf(monLabel) + 1;
        const yearVal = Number(yearLabel);
        const found = series.find((s) => s.anio === yearVal && s.mes === mesIndex);
        return found ? found.total : 0;
      });
    });

    if (mercChart) mercChart.destroy();
    if (mercChartCanvas) {
      mercChart = new Chart(mercChartCanvas, {
        type: 'line',
        data: { labels: sortedLabels, datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom' },
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  const detail = ctx.dataset.detail || '';
                  const parts = [`${ctx.dataset.label}: ${ctx.parsed.y}`];
                  if (detail) parts.push(detail);
                  return parts;
                },
              },
            },
          },
          scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
        },
      });
    }
    if (mercChartStatus) mercChartStatus.textContent = `Rango: ${res.desde} a ${res.hasta}`;
    if (mercChartOverlay) mercChartOverlay.classList.add('open');
  } catch (error) {
    if (mercStatus) mercStatus.textContent = error.message || 'Error al graficar';
  }
}

function openMercImage(src) {
  if (!src) return;
  mercImgZoom = 1;
  if (mercImgFull) {
    mercImgFull.src = src;
    mercImgFull.style.transform = 'scale(1)';
  }
  if (mercImgOverlay) mercImgOverlay.classList.add('open');
}

function closeMercImage() {
  if (mercImgOverlay) mercImgOverlay.classList.remove('open');
}

function setMercImgZoom(factor) {
  mercImgZoom = Math.max(0.5, Math.min(4, factor));
  if (mercImgFull) mercImgFull.style.transform = `scale(${mercImgZoom})`;
}

function escapeAttr(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function completarDetalle(texto) {
  const base = String(texto || '');
  if (base.length >= 29) return base;
  return base + '_'.repeat(29 - base.length);
}

function openAbmBarcode(articulo, detalle) {
  if (!abmBarcodeOverlay) return;
  const code = String(articulo || '').trim();
  const texto = completarDetalle(detalle);
  if (abmBarcodeCode) abmBarcodeCode.textContent = code;
  if (abmBarcodeText) abmBarcodeText.textContent = texto;
  if (abmBarcodeStatus) abmBarcodeStatus.textContent = '';
  if (!window.JsBarcode || !abmBarcodeSvg) {
    if (abmBarcodeStatus) abmBarcodeStatus.textContent = 'No se pudo generar el codigo de barras.';
    abmBarcodeOverlay.classList.add('open');
    return;
  }
  try {
    window.JsBarcode(abmBarcodeSvg, code, {
      format: 'EAN13',
      width: 1,
      height: 40,
      displayValue: false,
    });
  } catch (error) {
    if (abmBarcodeStatus) {
      abmBarcodeStatus.textContent = error.message || 'Codigo de barras invalido.';
    }
  }
  abmBarcodeOverlay.classList.add('open');
}

function closeAbmBarcode() {
  if (abmBarcodeOverlay) abmBarcodeOverlay.classList.remove('open');
}

function renderAbmTable(rows) {
  if (!abmTableBody) return;
  abmTableBody.innerHTML = '';
  rows.forEach((row) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${row.articulo || ''}</td>
      <td>${row.detalle || ''}</td>
      <td>${row.proveedorSku || ''}</td>
      <td>${row.cantidad ?? 0}</td>
      <td>${row.enPedido ?? 0}</td>
      <td>${formatMoney(row.precioVenta || 0)}</td>
      <td>
        <div class="abm-actions">
          <button type="button" class="abm-action" data-action="barcode" data-articulo="${row.articulo || ''}">
            Codigo Barras
          </button>
          <button type="button" class="abm-action" data-action="edit" data-articulo="${row.articulo || ''}">
            Modificar
          </button>
          <button type="button" class="abm-action" data-action="photo" data-articulo="${row.articulo || ''}">
            Foto
          </button>
        </div>
      </td>
    `;
    abmTableBody.appendChild(tr);
  });
}

async function loadAbmDataTable(force = false) {
  if (!abmTableBody) return;
  try {
    if (abmLoaded && !force) return;
    if (abmStatus) abmStatus.textContent = 'Cargando...';
    const res = await fetchJSON('/api/mercaderia/abm/all');
    const rows = Array.isArray(res.data) ? res.data : [];
    if (abmDataTable) {
      abmDataTable.clear();
      abmDataTable.rows.add(rows);
      abmDataTable.draw();
    } else if (window.DataTable) {
      abmDataTable = new DataTable('#abm-table', {
        data: rows,
        columns: [
          { data: 'articulo' },
          { data: 'detalle' },
          { data: 'proveedorSku' },
          { data: 'cantidad' },
          { data: 'enPedido' },
          {
            data: 'precioVenta',
            render: (data) => formatMoney(data || 0),
          },
          {
            data: null,
            orderable: false,
            render: (_data, _type, row) => `
              <div class="abm-actions">
                <button type="button" class="abm-action" data-action="barcode" data-articulo="${escapeAttr(row.articulo)}" data-detalle="${escapeAttr(row.detalle)}">
                  Codigo Barras
                </button>
                <button type="button" class="abm-action" data-action="edit" data-articulo="${escapeAttr(row.articulo)}">
                  Modificar
                </button>
                <button type="button" class="abm-action" data-action="photo" data-articulo="${escapeAttr(row.articulo)}">
                  Foto
                </button>
              </div>
            `,
          },
        ],
        pageLength: 10,
        lengthMenu: [10, 25, 50, 100],
        deferRender: true,
        order: [[0, 'asc']],
        autoWidth: false,
      });
    }
    abmLoaded = true;
    if (abmStatus) {
      abmStatus.textContent = rows.length ? `Total artículos: ${rows.length}` : 'Sin resultados';
    }
  } catch (error) {
    if (abmStatus) abmStatus.textContent = error.message || 'Error al cargar ABM';
  }
}

function initAbm() {
  if (!viewAbm) return;
  if (abmRefreshBtn)
    abmRefreshBtn.addEventListener('click', () => {
      abmLoaded = false;
      loadAbmDataTable(true);
    });
  loadAbmDataTable();
  if (abmTableBody) {
    abmTableBody.addEventListener('click', async (e) => {
      const btn = e.target.closest('.abm-action');
      if (!btn) return;
      const action = btn.dataset.action;
      const articulo = btn.dataset.articulo;
      if (!articulo) return;
      if (action === 'photo') {
        try {
          if (abmStatus) abmStatus.textContent = 'Cargando foto...';
          const res = await fetchJSON(`/api/mercaderia/abm/image?articulo=${encodeURIComponent(articulo)}`);
          if (res.imagessrc) {
            openMercImage(res.imagessrc);
            if (abmStatus) abmStatus.textContent = '';
          } else if (abmStatus) {
            abmStatus.textContent = 'Sin foto disponible.';
          }
        } catch (error) {
          if (abmStatus) abmStatus.textContent = error.message || 'Error al cargar foto';
        }
      } else if (action === 'barcode') {
        const detalle = btn.dataset.detalle || '';
        openAbmBarcode(articulo, detalle);
      }
    });
  }
  if (abmBarcodeClose) abmBarcodeClose.addEventListener('click', closeAbmBarcode);
  if (abmBarcodeOverlay)
    abmBarcodeOverlay.addEventListener('click', (e) => {
      if (e.target === abmBarcodeOverlay) closeAbmBarcode();
    });
  if (abmBarcodePrint)
    abmBarcodePrint.addEventListener('click', () => {
      window.print();
    });
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

function renderEncuestas(data, breakdown = []) {
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

  const breakdownMap = new Map();
  breakdown.forEach((row) => {
    const key = `${row.encuesta || 'Sin dato'}|${row.mes}`;
    breakdownMap.set(key, {
      pedidos: Number(row.pedidos) || 0,
      salon: Number(row.salon) || 0,
      sin_match: Number(row.sin_match) || 0,
      total: Number(row.total) || 0,
    });
  });

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
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const encuestaLabel = ctx.dataset.label || '';
              const mes = ctx.dataIndex + 1;
              const value = ctx.parsed.y || 0;
              const key = `${encuestaLabel}|${mes}`;
              const detail = breakdownMap.get(key) || { pedidos: 0, salon: 0, sin_match: 0, total: value };
              const parts = [`${encuestaLabel}: ${value}`];
              parts.push(`Pedidos: ${detail.pedidos}`);
              parts.push(`Salón: ${detail.salon}`);
              if (detail.sin_match) parts.push(`Sin match: ${detail.sin_match}`);
              return parts;
            },
          },
        },
      },
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
      <td>${row.mail || row.email || ''}</td>
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
    const totalNuevos = Number(res.totalNuevos ?? 0);
    const totalPedidos = Number(res.totalPedidos ?? 0);
    const pctNuevos = totalPedidos > 0 ? ((totalNuevos / totalPedidos) * 100).toFixed(1) : '0.0';
    const pctEl = document.getElementById('stat-pc-pct-nuevos');
    if (pctEl) pctEl.textContent = `${pctNuevos}%`;
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
    renderEncuestas(res.data, res.breakdown || []);
    if (selectYear && res.year) selectYear.value = res.year;
    setStatus(statusEncuestas, `Año ${res.year}`);
  } catch (error) {
    if (USE_SAMPLE_FALLBACK) {
      renderEncuestas(sampleEncuestas, []);
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
  const navItems = document.querySelectorAll('.menu-item[data-target]');
  const parentButtons = document.querySelectorAll('.menu-parent');
  const groups = document.querySelectorAll('.menu-group');
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
  groups.forEach((group) => {
    group.addEventListener('mouseenter', () => group.classList.add('open'));
    group.addEventListener('mouseleave', () => group.classList.remove('open'));
  });
  parentButtons.forEach((parent) => {
    parent.addEventListener('click', (e) => {
      e.stopPropagation();
      const group = parent.closest('.menu-group');
      const isOpen = group?.classList.contains('open');
      groups.forEach((g) => g.classList.remove('open'));
      if (group && !isOpen) group.classList.add('open');
    });
  });

  navItems.forEach((btn) => {
    btn.addEventListener('click', () => {
      navItems.forEach((b) => b.classList.remove('active'));
      parentButtons.forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      const group = btn.closest('.menu-group');
      if (group) {
        group.classList.add('open');
        const parentBtn = group.querySelector('.menu-parent');
        if (parentBtn) parentBtn.classList.add('active');
      }
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
  if (calendarGrid) {
    calendarGrid.addEventListener('click', onCalendarDayClick);
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
    calendarCurrentUserId = userId;
    calendarCurrentYear = safeYear;
    calendarCurrentMonth = safeMonth;
    calendarTitle.textContent = `Calendario de ${nombre} (${safeYear}-${String(safeMonth).padStart(2, '0')})`;
    calendarGrid.innerHTML = '';
    calendarStatus.textContent = 'Cargando...';
    const res = await fetch(`/api/empleados/tardes?userId=${userId}&year=${safeYear}&month=${safeMonth}`);
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || `Error ${res.status}`);
    }
    const data = await res.json();
    calendarDiasData = (data.dias || []).map((d) => ({
      ...d,
      comentario: d.comentario || '',
    }));
    renderCalendario(calendarDiasData, safeYear, safeMonth);
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
    const hasComment = !!(d.comentario && String(d.comentario).trim());
    const hasEntry = d.minutos !== null;
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d.dia).padStart(2, '0')}`;
    div.dataset.date = dateStr;
    div.dataset.comment = d.comentario || '';
    div.dataset.hasEntry = hasEntry ? '1' : '0';
    const commentAttr = hasComment ? ` title="${(d.comentario || '').replace(/"/g, "'")}"` : '';
    div.innerHTML = `
      <div class="day-head">
        <p class="day-number">${label}</p>
      </div>
      <p class="status">${d.minutos != null ? `${d.minutos} min tarde` : 'Sin registro'}</p>
      ${hasComment ? `<div class="comment-indicator-wrap"><span class="comment-indicator"${commentAttr}>&#9993;</span></div>` : ''}
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

async function saveCalendarioComentario(dateStr, comentario) {
  if (!calendarCurrentUserId) return;
  try {
    calendarStatus.textContent = 'Guardando...';
    if (USE_SAMPLE_FALLBACK) {
      calendarStatus.textContent = 'Modo muestra activo (comentario no guardado)';
      return;
    }
    const res = await fetch('/api/empleados/tardes/comentario', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: calendarCurrentUserId, fecha: dateStr, comentario }),
    });
    if (!res.ok) throw new Error(`Error ${res.status}`);
    const match = calendarDiasData.find((d) => {
      const dStr = `${calendarCurrentYear}-${String(calendarCurrentMonth).padStart(2, '0')}-${String(d.dia).padStart(2, '0')}`;
      return dStr === dateStr;
    });
    if (match) match.comentario = comentario;
    renderCalendario(calendarDiasData, calendarCurrentYear, calendarCurrentMonth);
    calendarStatus.textContent = 'Comentario guardado';
  } catch (error) {
    calendarStatus.textContent = error.message || 'No se pudo guardar el comentario';
    window.alert(calendarStatus.textContent);
  }
}

function onCalendarDayClick(e) {
  const card = e.target.closest('.day-card');
  if (!card) return;
  const hasEntry = card.dataset.hasEntry === '1';
  if (!hasEntry) return;
  const dateStr = card.dataset.date;
  const current = card.dataset.comment || '';
  const input = window.prompt('Comentario de llegada', current);
  if (input === null) return;
  saveCalendarioComentario(dateStr, input.trim());
}

function normalizeFacturaRow(raw) {
  const row = {
    id: raw.id ?? raw.nroFactura ?? raw.NroFactura,
    cliente: raw.cliente || raw.Cliente || '',
    nroFactura: raw.nroFactura ?? raw.NroFactura ?? '',
    totales: Number(raw.totales ?? raw.Totales ?? raw.total ?? 0),
    envio: Number(raw.envio ?? raw.Envio ?? 0),
    totalConEnvio: Number(raw.totalConEnvio ?? raw.TotalConEnvio ?? 0),
    tipoPagoId: raw.tipoPagoId ?? raw.id_tipo_pago ?? raw.tipo_pago_id ?? null,
    tipoPago: raw.tipoPago || raw.tipo_pago || '',
    estadoId: raw.estadoId ?? raw.id_estado ?? raw.id_estados_financiera ?? null,
    estado: raw.estado || raw.estado_financiera || raw.nombre || '',
    fecha: raw.fecha || raw.created_at || raw.updated_at || '',
    pagoMixto: raw.pagomixto ?? raw.pagoMixto ?? raw.pago_mixto ?? '',
    comentario: raw.comentario || '',
  };
  const cobrarCalc = calcularCobrar(row);
  return { ...row, cobrar: Number(raw.cobrar ?? cobrarCalc) };
}

function renderFacturasTabla(rows) {
  if (!tablaFacturasBody) return;
  initFacturasColumnWidthSetter();
  const filteredRows = rows.filter((row) => {
    const matchCliente = textMatchesAllTokens(row.cliente, facturasFilters.cliente);
    const matchFecha = !facturasFilters.fecha || (row.fecha || '').includes(facturasFilters.fecha);
    const matchNro = !facturasFilters.nroFactura || String(row.nroFactura || '').toLowerCase().includes(facturasFilters.nroFactura);
    const matchTotal =
      !facturasFilters.totales ||
      String(row.totales || '')
        .toLowerCase()
        .includes(facturasFilters.totales);
    const matchTotalEnv =
      !facturasFilters.totalConEnvio ||
      String(row.totalConEnvio || '')
        .toLowerCase()
        .includes(facturasFilters.totalConEnvio);
    const matchCobrar =
      !facturasFilters.cobrar ||
      String(row.cobrar || '')
        .toLowerCase()
        .includes(facturasFilters.cobrar);
    const matchTipoPago =
      !facturasFilters.tipoPago ||
      (row.tipoPago || '').toLowerCase().includes(facturasFilters.tipoPago) ||
      String(row.tipoPagoId || '').includes(facturasFilters.tipoPago);
    const matchEstado =
      !facturasFilters.estado ||
      (row.estado || '').toLowerCase().includes(facturasFilters.estado) ||
      String(row.estadoId || '').includes(facturasFilters.estado);
    return matchCliente && matchFecha && matchNro && matchTotal && matchTotalEnv && matchCobrar && matchTipoPago && matchEstado;
  });
  facturasTotalPages = Math.max(1, Math.ceil(filteredRows.length / facturasPageSize));
  facturasPage = Math.min(facturasPage, facturasTotalPages);
  const offset = (facturasPage - 1) * facturasPageSize;
  const pageRows = filteredRows.slice(offset, offset + facturasPageSize);
  tablaFacturasBody.innerHTML = '';
  const opcionesPago = (facturasTipoPagos.length ? facturasTipoPagos : sampleFacturasTipoPagos).map((o) => ({
    value: String(o.value),
    label: o.label || o.nombre || o.tipo_pago || '',
  }));
  const opcionesEstado = (facturasEstados.length ? facturasEstados : sampleFacturasEstados).map((o) => ({
    value: String(o.value),
    label: o.label || o.nombre || '',
  }));
  pageRows.forEach((row) => {
    const tr = document.createElement('tr');
    const selectPago = document.createElement('select');
    selectPago.className = 'factura-select';
    selectPago.dataset.id = row.id;
    selectPago.dataset.field = 'tipoPagoId';
    opcionesPago.forEach((opt) => {
      const option = document.createElement('option');
      option.value = opt.value;
      option.textContent = opt.label;
      if (String(row.tipoPagoId ?? '') === opt.value) option.selected = true;
      selectPago.appendChild(option);
    });
    if (selectPago.selectedOptions[0]) selectPago.selectedOptions[0].style.fontWeight = '700';

    const selectEstado = document.createElement('select');
    selectEstado.className = 'factura-select';
    selectEstado.dataset.id = row.id;
    selectEstado.dataset.field = 'estadoId';
    opcionesEstado.forEach((opt) => {
      const option = document.createElement('option');
      option.value = opt.value;
      option.textContent = opt.label;
      if (String(row.estadoId ?? '') === opt.value) option.selected = true;
      selectEstado.appendChild(option);
    });
    if (selectEstado.selectedOptions[0]) selectEstado.selectedOptions[0].style.fontWeight = '700';

    tr.innerHTML = `
      <td>${row.cliente || ''}</td>
      <td>${row.fecha ? formatDate(row.fecha) : ''}</td>
      <td>${row.nroFactura || ''}</td>
      <td>${formatMoney(row.totales)}</td>
      <td>${formatMoney(row.envio)}</td>
      <td>${formatMoney(row.totalConEnvio || row.totales)}</td>
      <td>${formatMoney(row.cobrar)}</td>
      <td class="factura-select-cell"></td>
      <td class="factura-select-cell"></td>
      <td>${row.pagoMixto || ''}</td>
      <td class="factura-comment-cell"></td>
    `;
    tr.querySelector('.factura-select-cell:nth-child(8)').appendChild(selectPago);
    tr.querySelector('.factura-select-cell:nth-child(9)').appendChild(selectEstado);
    const commentInput = document.createElement('input');
    commentInput.type = 'text';
    commentInput.className = 'factura-input';
    commentInput.dataset.id = row.id;
    commentInput.dataset.field = 'comentario';
    commentInput.value = row.comentario || '';
    const commentCell = tr.querySelector('.factura-comment-cell');
    if (commentCell) commentCell.appendChild(commentInput);
    tablaFacturasBody.appendChild(tr);
  });
  if (facturasPageInfo) {
    facturasPageInfo.textContent = `Página ${facturasPage} de ${facturasTotalPages}`;
  }
  if (facturasPrev) facturasPrev.disabled = facturasPage <= 1;
  if (facturasNext) facturasNext.disabled = facturasPage >= facturasTotalPages;
  if (statusFacturas) statusFacturas.textContent = `${filteredRows.length} facturas`;
  applyFacturasStoredWidths();
}

function applyFacturasStoredWidths() {
  if (!facturasTable || !facturasColumnWidths.length) return;
  const rows = Array.from(facturasTable.querySelectorAll('tr'));
  facturasColumnWidths.forEach((w, idx) => {
    if (!w) return;
    rows.forEach((row) => {
      const cell = row.children[idx];
      if (cell) {
        cell.style.width = `${w}px`;
        cell.style.minWidth = `${w}px`;
        cell.style.maxWidth = `${w}px`;
      }
    });
  });
}

function handleFacturaSelectChange(e) {
  const control = e.target.closest('.factura-select, .factura-input');
  if (!control) return;
  const { id, field } = control.dataset;
  if (!id || !field) return;
  const value = control.value;
  if (control.tagName === 'SELECT') {
    Array.from(control.options).forEach((opt) => {
      opt.style.fontWeight = opt.selected ? '700' : '400';
    });
  }
  updateFacturaField(id, field, value);
}

async function loadFacturas() {
  if (!tablaFacturasBody) return;
  try {
    if (statusFacturas) statusFacturas.textContent = 'Cargando...';
    if (USE_SAMPLE_FALLBACK) {
      facturasRows = sampleFacturas.map((r) => normalizeFacturaRow(r));
      facturasTipoPagos = sampleFacturasTipoPagos;
      facturasEstados = sampleFacturasEstados;
      renderFacturasTabla(facturasRows);
      facturasLoaded = true;
      if (statusFacturas) statusFacturas.textContent = 'Modo muestra activo (USE_SAMPLE_FALLBACK)';
      return;
    }
    const res = await fetch('/api/facturas');
    if (!res.ok) throw new Error(`Error ${res.status}`);
    const ct = res.headers.get('content-type') || '';
    if (!ct.toLowerCase().includes('application/json')) {
      const text = await res.text();
      throw new Error('Respuesta no es JSON (¿falta el endpoint /api/facturas?)');
    }
    const data = await res.json();
    facturasTipoPagos = (data.tipoPagos || data.tiposPago || []).map((t) => ({
      value: t.id ?? t.value,
      label: t.tipo_pago || t.nombre || t.label,
    }));
    facturasEstados = (data.estados || []).map((t) => ({
      value: t.id ?? t.value,
      label: t.nombre || t.label,
    }));
    const rows = data.facturas || data.data || [];
    facturasRows = rows.map((r) => normalizeFacturaRow(r));
    facturasPage = 1;
    renderFacturasTabla(facturasRows);
    facturasLoaded = true;
    if (statusFacturas) statusFacturas.textContent = `${rows.length} facturas`;
  } catch (error) {
    if (statusFacturas) statusFacturas.textContent = error.message || 'No se pudieron cargar las facturas';
  }
}

async function updateFacturaField(id, field, value) {
  const row = facturasRows.find((r) => String(r.id) === String(id));
  const prevState = row ? { ...row } : null;
  if (row) {
    if (field === 'tipoPagoId') {
      row.tipoPagoId = Number(value);
      const match = facturasTipoPagos.find((o) => String(o.value) === String(value)) || {};
      row.tipoPago = match.label || row.tipoPago || '';
    } else if (field === 'estadoId') {
      row.estadoId = Number(value);
      const match = facturasEstados.find((o) => String(o.value) === String(value)) || {};
      row.estado = match.label || row.estado || '';
    } else if (field === 'comentario') {
      row.comentario = value || '';
    }
    renderFacturasTabla(facturasRows);
  }
  if (USE_SAMPLE_FALLBACK) {
    if (statusFacturas) statusFacturas.textContent = 'Cambio aplicado en modo muestra';
    return;
  }
  try {
    if (statusFacturas) statusFacturas.textContent = 'Guardando...';
    const res = await fetch(`/api/facturas/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    });
    if (!res.ok) throw new Error(`No se pudo actualizar (${res.status})`);
    if (statusFacturas) statusFacturas.textContent = 'Actualizado';
  } catch (error) {
    if (prevState && row) {
      Object.assign(row, prevState);
      renderFacturasTabla(facturasRows);
    }
    const offlineMsg = !navigator.onLine ? 'Sin conexion. No se guardo el cambio.' : null;
    const message = offlineMsg || error.message || 'No se pudo actualizar la factura';
    if (statusFacturas) statusFacturas.textContent = message;
    window.alert(message);
  }
}

function initFacturasColumnWidthSetter() {
  if (!facturasTable) return;
  const headers = Array.from(facturasTable.querySelectorAll('thead th'));
  if (!headers.length) return;
  headers.forEach((th, idx) => {
    if (th.dataset.widthListener === '1') return;
    th.dataset.widthListener = '1';
    th.addEventListener('dblclick', () => {
      const currentWidth = th.getBoundingClientRect().width || 120;
      const input = window.prompt('Ancho de columna (px):', String(Math.round(currentWidth)));
      if (input === null) return;
      const newWidth = Number(input);
      if (!Number.isFinite(newWidth) || newWidth < 50) return;
      facturasColumnWidths[idx] = newWidth;
      applyFacturasStoredWidths();
    });
  });
}

function initFacturas() {
  if (tablaFacturasBody) tablaFacturasBody.addEventListener('change', handleFacturaSelectChange);
  if (facturasPrev)
    facturasPrev.addEventListener('click', () => {
      if (facturasPage > 1) {
        facturasPage -= 1;
        renderFacturasTabla(facturasRows);
      }
    });
  if (facturasNext)
    facturasNext.addEventListener('click', () => {
      if (facturasPage < facturasTotalPages) {
        facturasPage += 1;
        renderFacturasTabla(facturasRows);
      }
    });
  if (facturasPageSizeSelect) {
    facturasPageSizeSelect.value = String(facturasPageSize);
    facturasPageSizeSelect.addEventListener('change', () => {
      facturasPageSize = Number(facturasPageSizeSelect.value) || 10;
      facturasPage = 1;
      renderFacturasTabla(facturasRows);
    });
  }
  if (facturasRefresh) {
    facturasRefresh.addEventListener('click', () => {
      facturasPage = 1;
      loadFacturas();
    });
  }
  const filterInputs = [
    { el: facturasFilterCliente, key: 'cliente' },
    { el: facturasFilterFecha, key: 'fecha' },
    { el: facturasFilterNro, key: 'nroFactura' },
    { el: facturasFilterTotal, key: 'totales' },
    { el: facturasFilterTotalEnvio, key: 'totalConEnvio' },
    { el: facturasFilterCobrar, key: 'cobrar' },
    { el: facturasFilterTipoPago, key: 'tipoPago' },
    { el: facturasFilterEstado, key: 'estado' },
  ];
  filterInputs.forEach(({ el, key }) => {
    if (!el) return;
    el.addEventListener('input', (e) => {
      facturasFilters[key] = (e.target.value || '').trim().toLowerCase();
      facturasPage = 1;
      renderFacturasTabla(facturasRows);
    });
  });
}

function toISODateInput(dateObj) {
  return dateObj.toISOString().slice(0, 10);
}

function getDefaultComisionesRange() {
  const hoy = new Date();
  const hasta = new Date(hoy.getFullYear(), hoy.getMonth(), 19);
  const desde = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 20);
  return { desde: toISODateInput(desde), hasta: toISODateInput(hasta) };
}

function ensureComisionesFechas() {
  if (!comisionesDesdeInput || !comisionesHastaInput) return;
  const { desde, hasta } = getDefaultComisionesRange();
  if (!comisionesDesdeInput.value) comisionesDesdeInput.value = desde;
  if (!comisionesHastaInput.value) comisionesHastaInput.value = hasta;
}

function renderComisionesPanel() {
  const empleados = Math.max(1, Number(comisionesEmpleados) || 1);
  const porcentaje = Math.max(0, Number(comisionesPorcentaje) || 0);
  const total = Number(comisionesTotal) || 0;
  const monto = getBaseComisionPorEmpleado();
  if (comisionesTotalEl) comisionesTotalEl.textContent = formatMoney(total);
  if (comisionesPorcentajeEl) comisionesPorcentajeEl.textContent = `${porcentaje.toFixed(2)}%`;
  if (comisionesEmpleadosEl) comisionesEmpleadosEl.textContent = String(empleados);
  if (comisionesPagarEl) comisionesPagarEl.textContent = formatMoney(monto);
}

function getTotalComisionPool() {
  const porcentaje = Math.max(0, Number(comisionesPorcentaje) || 0);
  const total = Number(comisionesTotal) || 0;
  return total * (porcentaje / 100);
}

function getBaseComisionPorEmpleado() {
  const empleados = Math.max(1, Number(comisionesEmpleados) || 1);
  const pool = getTotalComisionPool();
  return empleados > 0 ? pool / empleados : 0;
}

function renderComisionesTardes() {
  if (!comisionesTardesBody) return;
  comisionesTardesBody.innerHTML = '';
  const baseComision = getBaseComisionPorEmpleado();
  const prelim = comisionesTardesRows.map((row) => {
    const desc = Math.max(0, Number(row.descuento) || 0);
    const penalizado = desc > 0;
    const deduccion = penalizado ? baseComision * (desc / 100) : 0;
    const valor = baseComision - deduccion;
    return { desc, penalizado, deduccion, valor };
  });
  const totalDeduccion = prelim.reduce((acc, r) => acc + r.deduccion, 0);
  const beneficiarios = prelim.filter((r) => !r.penalizado).length || 0;
  const extra = beneficiarios > 0 ? totalDeduccion / beneficiarios : 0;

  comisionesTardesRows.forEach((row, idx) => {
    const info = prelim[idx];
    const valor = info.penalizado ? info.valor : info.valor + extra;
    const input = document.createElement('input');
    input.type = 'number';
    input.min = '0';
    input.max = '100';
    input.step = '0.1';
    input.value = String(info.desc);
    input.addEventListener('input', () => {
      const val = Number(input.value);
      comisionesTardesRows[idx].descuento = Number.isFinite(val) ? val : 0;
      renderComisionesTardes();
    });
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${row.nombre || ''}</td>
      <td>${row.tardes ?? 0}</td>
      <td class="comisiones-desc-cell"></td>
      <td>${formatMoney(valor)}</td>
    `;
    const descCell = tr.querySelector('.comisiones-desc-cell');
    if (descCell) descCell.appendChild(input);
    comisionesTardesBody.appendChild(tr);
  });
}

function getComisionesYearMonth() {
  ensureComisionesFechas();
  const desdeVal = comisionesDesdeInput?.value;
  if (!desdeVal) {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  }
  const d = new Date(`${desdeVal}T00:00:00`);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

async function loadComisionesResumen() {
  if (!comisionesDesdeInput || !comisionesHastaInput) return;
  ensureComisionesFechas();
  const desde = comisionesDesdeInput.value;
  const hasta = comisionesHastaInput.value;
  try {
    if (comisionesStatus) comisionesStatus.textContent = 'Cargando...';
    if (USE_SAMPLE_FALLBACK) {
      comisionesTotal = 150000;
      comisionesLoaded = true;
      renderComisionesPanel();
      if (comisionesStatus) comisionesStatus.textContent = 'Modo muestra activo (USE_SAMPLE_FALLBACK)';
      comisionesTardesRows = sampleComisionesTardes;
      renderComisionesTardes();
      return;
    }
    const params = new URLSearchParams({ desde, hasta });
    const res = await fetch(`/api/comisiones/resumen?${params.toString()}`);
    if (!res.ok) throw new Error(`Error ${res.status}`);
    const ct = res.headers.get('content-type') || '';
    if (!ct.toLowerCase().includes('application/json')) {
      const text = await res.text();
      console.error('Respuesta inesperada comisiones:', text);
      throw new Error('Respuesta no es JSON (falta /api/comisiones/resumen?)');
    }
    const data = await res.json();
    comisionesTotal = Number(data.totalFacturado || 0);
    comisionesLoaded = true;
    renderComisionesPanel();
    if (comisionesStatus) comisionesStatus.textContent = '';
  } catch (error) {
    if (comisionesStatus) comisionesStatus.textContent = error.message || 'No se pudo cargar comisiones';
  }
}

async function loadComisionesTardes() {
  const { year, month } = getComisionesYearMonth();
  try {
    if (comisionesTardesStatus) comisionesTardesStatus.textContent = 'Cargando...';
    if (USE_SAMPLE_FALLBACK) {
      comisionesTardesRows = sampleComisionesTardes.map((r) => ({ ...r }));
      renderComisionesTardes();
      if (comisionesTardesStatus) comisionesTardesStatus.textContent = 'Modo muestra activo (USE_SAMPLE_FALLBACK)';
      return;
    }
    const params = new URLSearchParams({ year, month });
    const res = await fetch(`/api/comisiones/tardes?${params.toString()}`);
    if (!res.ok) throw new Error(`Error ${res.status}`);
    const ct = res.headers.get('content-type') || '';
    if (!ct.toLowerCase().includes('application/json')) {
      const text = await res.text();
      console.error('Respuesta inesperada comisiones/tardes:', text);
      throw new Error('Respuesta no es JSON (falta /api/comisiones/tardes?)');
    }
    const data = await res.json();
    comisionesTardesRows = (data.data || []).map((r) => ({
      ...r,
      descuento: 0,
    }));
    renderComisionesTardes();
    if (comisionesTardesStatus) comisionesTardesStatus.textContent = '';
  } catch (error) {
    if (comisionesTardesStatus) comisionesTardesStatus.textContent = error.message || 'No se pudo cargar tardes';
  }
}

function initComisiones() {
  ensureComisionesFechas();
  if (comisionesPorcentajeInput) {
    comisionesPorcentajeInput.value = String(comisionesPorcentaje);
    comisionesPorcentajeInput.addEventListener('input', () => {
      const val = Number(comisionesPorcentajeInput.value);
      comisionesPorcentaje = Number.isFinite(val) ? val : comisionesPorcentaje;
      renderComisionesPanel();
      renderComisionesTardes();
    });
  }
  if (comisionesEmpleadosInput) {
    comisionesEmpleadosInput.value = String(comisionesEmpleados);
    comisionesEmpleadosInput.addEventListener('input', () => {
      const val = Number(comisionesEmpleadosInput.value);
      comisionesEmpleados = Number.isFinite(val) && val > 0 ? val : comisionesEmpleados;
      renderComisionesPanel();
      renderComisionesTardes();
    });
  }
  if (comisionesDesdeInput) {
    comisionesDesdeInput.addEventListener('change', () => {
      ensureComisionesFechas();
      loadComisionesResumen();
      loadComisionesTardes();
    });
  }
  if (comisionesHastaInput) {
    comisionesHastaInput.addEventListener('change', () => {
      ensureComisionesFechas();
      loadComisionesResumen();
      loadComisionesTardes();
    });
  }
  if (comisionesRefreshBtn) {
    comisionesRefreshBtn.addEventListener('click', () => {
      ensureComisionesFechas();
      loadComisionesResumen();
      loadComisionesTardes();
    });
  }
  renderComisionesPanel();
}

function switchView(target) {
  const views = [
    viewDashboard,
    viewEmpleados,
    viewClientes,
    viewIa,
    viewSalon,
    viewPedidos,
    viewMercaderia,
    viewAbm,
    viewFacturas,
    viewComisiones,
  ];
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
  } else if (target === 'mercaderia') {
    viewMercaderia.classList.remove('hidden');
    loadMercaderia();
  } else if (target === 'abm') {
    viewAbm.classList.remove('hidden');
    loadAbmDataTable();
  } else if (target === 'facturas') {
    viewFacturas.classList.remove('hidden');
    if (!facturasLoaded) loadFacturas();
  } else if (target === 'comisiones') {
    viewComisiones.classList.remove('hidden');
    if (!comisionesLoaded) {
      loadComisionesResumen();
    }
    loadComisionesTardes();
    renderComisionesPanel();
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
initMercaderia();
initAbm();
initFacturas();
initComisiones();
loadTransportes();
loadEncuestas(defaultYearEncuestas);
initDateRange();
loadProductividad(document.getElementById('fecha-desde').value, document.getElementById('fecha-hasta').value);
loadMensual(defaultYearMensual);
loadVentas(defaultYearVentas);
loadPaqueteria();
loadPedidosClientes();


