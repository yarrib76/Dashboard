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
const themeToggle = document.getElementById('theme-toggle');
const themeLabel = document.getElementById('theme-label');
const userRoleEl = document.getElementById('user-role');
const rolesList = document.getElementById('roles-list');
const rolesPermsGroups = document.getElementById('roles-perms-groups');
const rolesTitle = document.getElementById('roles-title');
const rolesStatus = document.getElementById('roles-status');
const rolesAdd = document.getElementById('roles-add');
const rolesSave = document.getElementById('roles-save');
const usersList = document.getElementById('users-list');
const usersTitle = document.getElementById('users-title');
const usersStatus = document.getElementById('users-status');
const usersSave = document.getElementById('users-save');
const usersSearch = document.getElementById('users-search');
const usersPrev = document.getElementById('users-prev');
const usersNext = document.getElementById('users-next');
const usersPageInfo = document.getElementById('users-page-info');
const usersStatusFilter = document.getElementById('users-status-filter');
const userNameInput = document.getElementById('user-name-input');
const userEmailInput = document.getElementById('user-email-input');
const userRoleSelect = document.getElementById('user-role-select');
const userVendedoraSelect = document.getElementById('user-vendedora-select');
const userHoraIngreso = document.getElementById('user-hora-ingreso');
const userHoraEgreso = document.getElementById('user-hora-egreso');
const userPassInput = document.getElementById('user-pass-input');
const userPassConfirm = document.getElementById('user-pass-confirm');
const userPassSave = document.getElementById('user-pass-save');
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
const carritosOverlay = document.getElementById('carritos-overlay');
const carritosTitle = document.getElementById('carritos-title');
const carritosClose = document.getElementById('carritos-close');
const carritosTableEl = document.getElementById('carritos-table');
const carritosStatus = document.getElementById('carritos-status');
const carritosNotasOverlay = document.getElementById('carritos-notas-overlay');
const carritosNotasTitle = document.getElementById('carritos-notas-title');
const carritosNotasClose = document.getElementById('carritos-notas-close');
const carritosNotasList = document.getElementById('carritos-notas-list');
const carritosNotasInput = document.getElementById('carritos-notas-input');
const carritosNotasSave = document.getElementById('carritos-notas-save');
const carritosNotasStatus = document.getElementById('carritos-notas-status');
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
let carritosRows = [];
let transportesList = [];
const pedidoTransporteCache = new Map();
let empleadosRows = [];
let carritosTable = null;
let carritosCurrentTipo = 'pendientes';
let carritosNotasCurrentId = null;
let carritosNotasEditingId = null;
let carritosVendedoras = [];
let carritosVendedorasLoaded = false;
let carritosVendedorasLoading = null;
let pedidosControlRows = [];
let pedidosControlSort = { key: 'enProceso', dir: 'desc' };
let pedidosVendedoraListaTable = null;
let pedidosVendedoraActual = '';
let currentPedidosScope = 'vendedora';
let pedidosListaServerSide = false;
let pedidosListaVariant = '';
let pedidoItemsTable = null;
let pedidoNotasCurrentId = null;
let pedidoNotasEditingId = null;
let currentPedidosTipo = '';
let pedidoCheckoutTnTable = null;
let pedidoCheckoutLocalTable = null;
let pedidoCheckoutDiffTable = null;
let pedidoIaControlId = null;
let pedidoIaClienteId = null;
let pedidoIaMessages = [];
let controlOrdenesRows = [];
let controlOrdenesFiltered = [];
let controlOrdenesSearchTerm = '';
let controlOrdenesNotasCompraId = null;
let controlOrdenesNotasEditingId = null;
let controlOrdenesDecisionResolver = null;
let controlOrdenesPage = 1;
let controlOrdenesPageSize = 10;
let controlOrdenesTotal = 0;
let controlOrdenesTotalPages = 1;
let controlOrdenesEstadoDefaulted = false;
let controlOrdenesOrdenTimer = null;
let cajasCierreRows = [];
const controlOrdenesFilters = {
  orden: '',
  articulo: '',
  detalle: '',
  fecha: '',
  observaciones: '',
  proveedor: '',
};
const viewDashboard = document.getElementById('view-dashboard');
const viewPanelControl = document.getElementById('view-panel-control');
const viewEmpleados = document.getElementById('view-empleados');
const viewClientes = document.getElementById('view-clientes');
const viewIa = document.getElementById('view-ia');
  const viewSalon = document.getElementById('view-salon');
  const viewPedidos = document.getElementById('view-pedidos');
const viewPedidosTodos = document.getElementById('view-pedidos-todos');
const viewMercaderia = document.getElementById('view-mercaderia');
const viewAbm = document.getElementById('view-abm');
const viewControlOrdenes = document.getElementById('view-control-ordenes');
const viewCajas = document.getElementById('view-cajas');
const viewCajasCierre = document.getElementById('view-cajas-cierre');
const viewCargarTicket = document.getElementById('view-cargar-ticket');
const DEBUG_OCR = true;
  const viewConfiguracion = document.getElementById('view-configuracion');
  const viewFacturas = document.getElementById('view-facturas');
  const viewComisiones = document.getElementById('view-comisiones');
  const viewNoPermission = document.getElementById('view-no-permission');
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
const statPendientesControl = document.getElementById('stat-pendientes-control');
const statSinTransporteControl = document.getElementById('stat-sin-transporte-control');
const statVencidosControl = document.getElementById('stat-vencidos-control');
const statusPaqueteriaControl = document.getElementById('status-paqueteria-control');
const refreshPaqueteriaControl = document.getElementById('refresh-paqueteria-control');
const statCarritosSinAsignar = document.getElementById('stat-carritos-sin-asignar');
const statCarritosSinAsignarCard = document.getElementById('stat-carritos-sin-asignar-card');
const statCarritosPendientes = document.getElementById('stat-carritos-pendientes');
const statCarritosSinNotas = document.getElementById('stat-carritos-sin-notas');
const statusCarritosControl = document.getElementById('status-carritos-control');
const refreshCarritosControl = document.getElementById('refresh-carritos-control');
const pedidosControlTableBody = document.querySelector('#pedidos-control-table tbody');
const pedidosControlTableHead = document.querySelector('#pedidos-control-table thead');
const pedidosControlStatus = document.getElementById('pedidos-control-status');
const refreshPedidosControl = document.getElementById('refresh-pedidos-control');
const pedidosTodosFacturados = document.getElementById('pedidos-todos-facturados');
const pedidosTodosProceso = document.getElementById('pedidos-todos-proceso');
const pedidosTodosPagados = document.getElementById('pedidos-todos-pagados');
const pedidosTodosEmpaquetados = document.getElementById('pedidos-todos-empaquetados');
const pedidosTodosCancelados = document.getElementById('pedidos-todos-cancelados');
const pedidosTodosTotal = document.getElementById('pedidos-todos-total');
const pedidosTodosStatus = document.getElementById('pedidos-todos-status');
const pedidosTodosRefresh = document.getElementById('pedidos-todos-refresh');
const pedidosTodosGrid = document.getElementById('pedidos-todos-grid');
const operativosStatus = document.getElementById('operativos-status');
const refreshOperativosControl = document.getElementById('refresh-operativos-control');
const pedidosPendientesCount = document.getElementById('pedidos-pendientes-count');
const pedidosPasadosCount = document.getElementById('pedidos-pasados-count');
const pedidosVendedoraOverlay = document.getElementById('pedidos-vendedora-overlay');
const pedidosVendedoraTitle = document.getElementById('pedidos-vendedora-title');
const pedidosVendedoraClose = document.getElementById('pedidos-vendedora-close');
const pedidosVendedoraTableBody = document.querySelector('#pedidos-vendedora-table tbody');
const pedidosVendedoraStatus = document.getElementById('pedidos-vendedora-status');
const pedidosVendedoraListaOverlay = document.getElementById('pedidos-vendedora-lista-overlay');
const pedidosVendedoraListaTitle = document.getElementById('pedidos-vendedora-lista-title');
const pedidosVendedoraListaClose = document.getElementById('pedidos-vendedora-lista-close');
const pedidosVendedoraListaTableEl = document.getElementById('pedidos-vendedora-lista-table');
const pedidosVendedoraListaStatus = document.getElementById('pedidos-vendedora-lista-status');
const pedidoCardsEl = document.getElementById('pedido-cards');
const pedidoCardsSearchInput = document.getElementById('pedido-cards-search');
const pedidoItemsOverlay = document.getElementById('pedido-items-overlay');
const pedidoItemsTitle = document.getElementById('pedido-items-title');
const pedidoItemsClose = document.getElementById('pedido-items-close');
const pedidoItemsTableEl = document.getElementById('pedido-items-table');
const pedidoItemsStatus = document.getElementById('pedido-items-status');
const pedidoNotasOverlay = document.getElementById('pedido-notas-overlay');
const pedidoNotasTitle = document.getElementById('pedido-notas-title');
const pedidoNotasClose = document.getElementById('pedido-notas-close');
const pedidoNotasList = document.getElementById('pedido-notas-list');
const pedidoNotasInput = document.getElementById('pedido-notas-input');
const pedidoNotasSave = document.getElementById('pedido-notas-save');
const pedidoNotasStatus = document.getElementById('pedido-notas-status');
const pedidoCheckoutOverlay = document.getElementById('pedido-checkout-overlay');
const pedidoCheckoutTitle = document.getElementById('pedido-checkout-title');
const pedidoCheckoutClose = document.getElementById('pedido-checkout-close');
const pedidoCheckoutStatus = document.getElementById('pedido-checkout-status');
const pedidoCheckoutTnTableEl = document.getElementById('pedido-checkout-tn');
const pedidoCheckoutLocalTableEl = document.getElementById('pedido-checkout-local');
const pedidoCheckoutDiffTableEl = document.getElementById('pedido-checkout-diff');
const pedidoIaOverlay = document.getElementById('pedido-ia-overlay');
const pedidoIaTitle = document.getElementById('pedido-ia-title');
const pedidoIaClose = document.getElementById('pedido-ia-close');
const pedidoIaWindow = document.getElementById('pedido-ia-window');
const controlOrdenesEstado = document.getElementById('control-ordenes-estado');
const controlOrdenesDesde = document.getElementById('control-ordenes-desde');
const controlOrdenesHasta = document.getElementById('control-ordenes-hasta');
const controlOrdenesOrdenInput = document.getElementById('control-ordenes-orden');
const controlOrdenesRefreshBtn = document.getElementById('control-ordenes-refresh');
const controlOrdenesExportBtn = document.getElementById('control-ordenes-export');
const controlOrdenesSearchInput = document.getElementById('control-ordenes-search');
const controlOrdenesTableBody = document.querySelector('#control-ordenes-table tbody');
const controlOrdenesCards = document.getElementById('control-ordenes-cards');
const controlOrdenesStatus = document.getElementById('control-ordenes-status');
const controlOrdenesPrev = document.getElementById('control-ordenes-prev');
const controlOrdenesNext = document.getElementById('control-ordenes-next');
const controlOrdenesPageInfo = document.getElementById('control-ordenes-page-info');
const controlOrdenesFilterOrden = document.getElementById('co-filter-orden');
const controlOrdenesFilterArticulo = document.getElementById('co-filter-articulo');
const controlOrdenesFilterDetalle = document.getElementById('co-filter-detalle');
const controlOrdenesFilterFecha = document.getElementById('co-filter-fecha');
const controlOrdenesFilterProveedor = document.getElementById('co-filter-proveedor');
const controlOrdenesNotasOverlay = document.getElementById('control-ordenes-notas-overlay');
const controlOrdenesNotasClose = document.getElementById('control-ordenes-notas-close');
const controlOrdenesNotasTitle = document.getElementById('control-ordenes-notas-title');
const controlOrdenesNotasList = document.getElementById('control-ordenes-notas-list');
const controlOrdenesNotasInput = document.getElementById('control-ordenes-notas-input');
const controlOrdenesNotasSave = document.getElementById('control-ordenes-notas-save');
const controlOrdenesNotasStatus = document.getElementById('control-ordenes-notas-status');
const controlOrdenesDecisionOverlay = document.getElementById('control-ordenes-decision-overlay');
const controlOrdenesDecisionClose = document.getElementById('control-ordenes-decision-close');
const controlOrdenesDecisionText = document.getElementById('control-ordenes-decision-text');
const controlOrdenesDecisionIncompleto = document.getElementById('control-ordenes-decision-incompleto');
const controlOrdenesDecisionCompleto = document.getElementById('control-ordenes-decision-completo');
const controlOrdenesDecisionSinEstado = document.getElementById('control-ordenes-decision-sin-estado');
const cajasCierreTableBody = document.querySelector('#cajas-cierre-table tbody');
const cajasCierreCards = document.getElementById('cajas-cierre-cards');
const cajasCierreStatus = document.getElementById('cajas-cierre-status');
const cajasCierreRefreshBtn = document.getElementById('cajas-cierre-refresh');
const cajasCierreExportBtn = document.getElementById('cajas-cierre-export');
const cajasCierreSearch = document.getElementById('cajas-cierre-search');
const cajasCierrePrev = document.getElementById('cajas-cierre-prev');
const cajasCierreNext = document.getElementById('cajas-cierre-next');
const cajasCierrePageInfo = document.getElementById('cajas-cierre-page-info');
const cajasGastosOverlay = document.getElementById('cajas-gastos-overlay');
const cajasGastosClose = document.getElementById('cajas-gastos-close');
const cajasGastosTitle = document.getElementById('cajas-gastos-title');
const cajasGastosTableBody = document.querySelector('#cajas-gastos-table tbody');
const cajasGastosStatus = document.getElementById('cajas-gastos-status');
const cajasGastosSearch = document.getElementById('cajas-gastos-search');
const cajasGastosExport = document.getElementById('cajas-gastos-export');
const cajasGastosPrev = document.getElementById('cajas-gastos-prev');
const cajasGastosNext = document.getElementById('cajas-gastos-next');
const cajasGastosPageInfo = document.getElementById('cajas-gastos-page-info');
const cajasGastoId = document.getElementById('cajas-gasto-id');
const cajasGastoNombre = document.getElementById('cajas-gasto-nombre');
const cajasGastoDetalle = document.getElementById('cajas-gasto-detalle');
const cajasGastoImporte = document.getElementById('cajas-gasto-importe');
const cajasGastoSave = document.getElementById('cajas-gasto-save');
const cajasGastoCancel = document.getElementById('cajas-gasto-cancel');
const cajasFacturasOverlay = document.getElementById('cajas-facturas-overlay');
const cajasFacturasClose = document.getElementById('cajas-facturas-close');
const cajasFacturasTitle = document.getElementById('cajas-facturas-title');
const cajasFacturasTableBody = document.querySelector('#cajas-facturas-table tbody');
const cajasFacturasStatus = document.getElementById('cajas-facturas-status');
const cajasFacturasSearch = document.getElementById('cajas-facturas-search');
const cajasFacturasExport = document.getElementById('cajas-facturas-export');
const cajasFacturasPrev = document.getElementById('cajas-facturas-prev');
const cajasFacturasNext = document.getElementById('cajas-facturas-next');
const cajasFacturasPageInfo = document.getElementById('cajas-facturas-page-info');
const cajasFacturaItemsOverlay = document.getElementById('cajas-factura-items-overlay');
const cajasFacturaItemsClose = document.getElementById('cajas-factura-items-close');
const cajasFacturaItemsTitle = document.getElementById('cajas-factura-items-title');
const cajasFacturaItemsTableBody = document.querySelector('#cajas-factura-items-table tbody');
const cajasFacturaItemsStatus = document.getElementById('cajas-factura-items-status');
const cajasFacturaItemsSearch = document.getElementById('cajas-factura-items-search');
const cajasFacturaItemsExport = document.getElementById('cajas-factura-items-export');
const cajasFacturaItemsPrev = document.getElementById('cajas-factura-items-prev');
const cajasFacturaItemsNext = document.getElementById('cajas-factura-items-next');
const cajasFacturaItemsPageInfo = document.getElementById('cajas-factura-items-page-info');
const cajasControlOverlay = document.getElementById('cajas-control-overlay');
const cajasControlClose = document.getElementById('cajas-control-close');
const cajasControlTitle = document.getElementById('cajas-control-title');
const cajasControlTableBody = document.querySelector('#cajas-control-table tbody');
const cajasControlStatus = document.getElementById('cajas-control-status');
const cajasControlSearch = document.getElementById('cajas-control-search');
const cajasControlExport = document.getElementById('cajas-control-export');
const cajasControlPrev = document.getElementById('cajas-control-prev');
const cajasControlNext = document.getElementById('cajas-control-next');
const cajasControlPageInfo = document.getElementById('cajas-control-page-info');
const cajasControlFacturasOverlay = document.getElementById('cajas-control-facturas-overlay');
const cajasControlFacturasClose = document.getElementById('cajas-control-facturas-close');
const cajasControlFacturasTitle = document.getElementById('cajas-control-facturas-title');
const cajasControlFacturasTableBody = document.querySelector('#cajas-control-facturas-table tbody');
const cajasControlFacturasStatus = document.getElementById('cajas-control-facturas-status');
const cajasControlFacturasSearch = document.getElementById('cajas-control-facturas-search');
const cajasControlFacturasExport = document.getElementById('cajas-control-facturas-export');
const cajasControlFacturasPrev = document.getElementById('cajas-control-facturas-prev');
const cajasControlFacturasNext = document.getElementById('cajas-control-facturas-next');
const cajasControlFacturasPageInfo = document.getElementById('cajas-control-facturas-page-info');
const pedidoIaInput = document.getElementById('pedido-ia-input');
const pedidoIaSend = document.getElementById('pedido-ia-send');
const pedidoIaStatus = document.getElementById('pedido-ia-status');
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
const abmCardsEl = document.getElementById('abm-cards');
const abmMobileSearchInput = document.getElementById('abm-mobile-search-input');
const abmMobileSearchBtn = document.getElementById('abm-mobile-search-btn');
const abmCreateBtn = document.getElementById('abm-create');
const abmBarcodeOverlay = document.getElementById('abm-barcode-overlay');
const abmBarcodeClose = document.getElementById('abm-barcode-close');
const abmBarcodeSvg = document.getElementById('abm-barcode-svg');
const abmBarcodeCode = document.getElementById('abm-barcode-code');
const abmBarcodeText = document.getElementById('abm-barcode-text');
const abmBarcodeStatus = document.getElementById('abm-barcode-status');
const abmBarcodePrint = document.getElementById('abm-barcode-print');
const abmBarcodePreview = document.querySelector('#abm-barcode-overlay .barcode-preview');
const abmEditOverlay = document.getElementById('abm-edit-overlay');
const abmEditClose = document.getElementById('abm-edit-close');
const abmEditCancel = document.getElementById('abm-edit-cancel');
const abmEditForm = document.getElementById('abm-edit-form');
const abmEditStatus = document.getElementById('abm-edit-status');
const abmEditSave = document.getElementById('abm-edit-save');
const abmCalcOpen = document.getElementById('abm-calc-open');
const abmCalcOverlay = document.getElementById('abm-calc-overlay');
const abmCalcClose = document.getElementById('abm-calc-close');
const abmCalcStatus = document.getElementById('abm-calc-status');
const abmCalcPesos = document.getElementById('abm-calc-pesos');
const abmCalcDolares = document.getElementById('abm-calc-dolares');
const abmCalcVenta = document.getElementById('abm-calc-venta');
const abmCalcGastos = document.getElementById('abm-calc-gastos');
const abmCalcGanancia = document.getElementById('abm-calc-ganancia');
const abmNewBtn = document.getElementById('abm-new');
const abmCreateOverlay = document.getElementById('abm-create-overlay');
const abmCreateClose = document.getElementById('abm-create-close');
const abmCreateCancel = document.getElementById('abm-create-cancel');
const abmCreateForm = document.getElementById('abm-create-form');
const abmCreateArticuloInput = document.getElementById('abm-create-articulo');
const abmCreateDetalleInput = document.getElementById('abm-create-detalle');
const abmCreateProveedorSkuInput = document.getElementById('abm-create-proveedor-sku');
const abmCreateCantidadInput = document.getElementById('abm-create-cantidad');
const abmCreatePrecioOrigenInput = document.getElementById('abm-create-precio-origen');
const abmCreatePrecioConvertidoInput = document.getElementById('abm-create-precio-convertido');
const abmCreateDolaresInput = document.getElementById('abm-create-dolares');
const abmCreatePesosInput = document.getElementById('abm-create-pesos');
const abmCreateManualInput = document.getElementById('abm-create-manual');
const abmCreatePrecioManualInput = document.getElementById('abm-create-precio-manual');
const abmCreateGastosInput = document.getElementById('abm-create-gastos');
const abmCreateGananciaInput = document.getElementById('abm-create-ganancia');
const abmCreateProveedorSelect = document.getElementById('abm-create-proveedor');
const abmCreateProveedorLoading = document.getElementById('abm-create-proveedor-loading');
const abmCreatePaisInput = document.getElementById('abm-create-pais');
const abmCreateGastosProveedorInput = document.getElementById('abm-create-gastos-proveedor');
const abmCreateGananciaProveedorInput = document.getElementById('abm-create-ganancia-proveedor');
const abmCreateOrdenInput = document.getElementById('abm-create-orden');
const abmCreateCalcOpen = document.getElementById('abm-create-calc-open');
const abmCreateObservacionesInput = document.getElementById('abm-create-observaciones');
const abmCreateSave = document.getElementById('abm-create-save');
const abmCreateStatus = document.getElementById('abm-create-status');
const abmBatchCalcOpen = document.getElementById('abm-batch-calc-open');
const abmBatchCalcOverlay = document.getElementById('abm-batch-calc-overlay');
const abmBatchCalcClose = document.getElementById('abm-batch-calc-close');
const abmBatchCalcStatus = document.getElementById('abm-batch-calc-status');
const abmBatchCalcPesos = document.getElementById('abm-batch-calc-pesos');
const abmBatchCalcDolares = document.getElementById('abm-batch-calc-dolares');
const abmBatchCalcVenta = document.getElementById('abm-batch-calc-venta');
const abmBatchCalcGastos = document.getElementById('abm-batch-calc-gastos');
const abmBatchCalcGanancia = document.getElementById('abm-batch-calc-ganancia');
const abmBatchOverlay = document.getElementById('abm-batch-overlay');
const abmBatchClose = document.getElementById('abm-batch-close');
const abmBatchForm = document.getElementById('abm-batch-form');
const abmBatchFormStatus = document.getElementById('abm-batch-form-status');
const abmBatchStatus = document.getElementById('abm-batch-status');
const abmBatchAdd = document.getElementById('abm-batch-add');
const abmBatchSubmit = document.getElementById('abm-batch-submit');
const abmBatchArticuloInput = document.getElementById('abm-batch-articulo');
const abmBatchDetalleInput = document.getElementById('abm-batch-detalle');
const abmBatchCantidadActualInput = document.getElementById('abm-batch-cantidad-actual');
const abmBatchRestaInput = document.getElementById('abm-batch-resta');
const abmBatchCantidadInput = document.getElementById('abm-batch-cantidad');
const abmBatchPrecioOrigenInput = document.getElementById('abm-batch-precio-origen');
const abmBatchPrecioConvertidoInput = document.getElementById('abm-batch-precio-convertido');
const abmBatchDolaresInput = document.getElementById('abm-batch-dolares');
const abmBatchPesosInput = document.getElementById('abm-batch-pesos');
const abmBatchManualInput = document.getElementById('abm-batch-manual');
const abmBatchPrecioManualInput = document.getElementById('abm-batch-precio-manual');
const abmBatchGastosInput = document.getElementById('abm-batch-gastos');
const abmBatchGananciaInput = document.getElementById('abm-batch-ganancia');
const abmBatchProveedorSelect = document.getElementById('abm-batch-proveedor');
const abmBatchProveedorLoading = document.getElementById('abm-batch-proveedor-loading');
const abmBatchPaisInput = document.getElementById('abm-batch-pais');
const abmBatchGastosProveedorInput = document.getElementById('abm-batch-gastos-proveedor');
const abmBatchGananciaProveedorInput = document.getElementById('abm-batch-ganancia-proveedor');
const abmBatchOrdenInput = document.getElementById('abm-batch-orden');
const abmBatchObservacionesInput = document.getElementById('abm-batch-observaciones');
const abmBatchSearchBtn = document.getElementById('abm-batch-search');
const abmBatchTableEl = document.getElementById('abm-batch-table');
const abmPickOverlay = document.getElementById('abm-pick-overlay');
const abmPickClose = document.getElementById('abm-pick-close');
const abmPickTableEl = document.getElementById('abm-pick-table');
  const abmPickStatus = document.getElementById('abm-pick-status');
  const abmPickLoading = document.getElementById('abm-pick-loading');
  const ticketFileInput = document.getElementById('ticket-file');
  const ticketDrop = document.getElementById('ticket-drop');
  const ticketPreview = document.getElementById('ticket-preview');
  const ticketStatus = document.getElementById('ticket-status');
  const ticketProcessBtn = document.getElementById('ticket-process');
  const ticketClearBtn = document.getElementById('ticket-clear');
  const ticketAmount = document.getElementById('ticket-amount');
  const ticketCopyBtn = document.getElementById('ticket-copy');
  const ticketOcrText = document.getElementById('ticket-ocr-text');
const abmPedidosOverlay = document.getElementById('abm-pedidos-overlay');
const abmPedidosClose = document.getElementById('abm-pedidos-close');
const abmPedidosTableBody = document.querySelector('#abm-pedidos-table tbody');
const abmPedidosStatus = document.getElementById('abm-pedidos-status');
const abmPedidosDetalle = document.getElementById('abm-pedidos-detalle');
const abmArticuloInput = document.getElementById('abm-articulo');
const abmDetalleInput = document.getElementById('abm-detalle');
const abmCantidadActualInput = document.getElementById('abm-cantidad-actual');
const abmRestaInput = document.getElementById('abm-resta');
const abmCantidadInput = document.getElementById('abm-cantidad');
const abmPrecioOrigenInput = document.getElementById('abm-precio-origen');
const abmPrecioConvertidoInput = document.getElementById('abm-precio-convertido');
const abmDolaresInput = document.getElementById('abm-dolares');
const abmPesosInput = document.getElementById('abm-pesos');
const abmManualInput = document.getElementById('abm-manual');
const abmPrecioManualInput = document.getElementById('abm-precio-manual');
const abmGastosInput = document.getElementById('abm-gastos');
const abmGananciaInput = document.getElementById('abm-ganancia');
const abmProveedorSelect = document.getElementById('abm-proveedor');
const abmPaisInput = document.getElementById('abm-pais');
const abmGastosProveedorInput = document.getElementById('abm-gastos-proveedor');
const abmGananciaProveedorInput = document.getElementById('abm-ganancia-proveedor');
const abmOrdenInput = document.getElementById('abm-orden');
const abmObservacionesInput = document.getElementById('abm-observaciones');
const abmProveedorLoading = document.getElementById('abm-proveedor-loading');
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
let abmRowsCache = [];
let abmCardFilterTerm = '';
let abmCardFilteredRows = [];
let abmCardVisibleCount = 0;
let abmCardLoading = false;
const abmCardBatchSize = 20;
let abmCardSearchTimer = null;
let pedidoCardsRowsCache = [];
let pedidoCardsFilterTerm = '';
let pedidoCardsFilteredRows = [];
let pedidoCardsVisibleCount = 0;
let pedidoCardsLoading = false;
const pedidoCardsBatchSize = 20;
let pedidoCardsSearchTimer = null;
let pedidoCardsServerMode = false;
let pedidoCardsServerStart = 0;
let pedidoCardsServerDone = false;
let pedidoCardsServerLoading = false;
let pedidoCardsServerSearch = '';
let abmProvidersLoaded = false;
let abmCreateProvidersLoaded = false;
let abmCurrentArticulo = null;
let abmDolarRate = null;
let abmBatchTable = null;
let abmPickTable = null;
let abmBatchProvidersLoaded = false;
let abmBatchCurrentArticulo = null;
let abmPickLoaded = false;
let abmBatchItems = [];
let abmBatchItemSeq = 1;
let abmBatchEditingId = null;
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
let currentPermissions = {};

function textMatchesAllTokens(text, filter) {
  if (!filter) return true;
  const base = (text || '').toLowerCase();
  const tokens = filter
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
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

function initCargarTicket() {
  if (!viewCargarTicket) return;
  let pdfJsLoadPromise = null;
  let cvLoadPromise = null;

  const showDebugCanvas = (canvas, label) => {
    if (!DEBUG_OCR || !canvas) return;
    const host = ensureDebugWrap();
    if (!host) return;
    const wrap = document.createElement('div');
    wrap.style.margin = '8px 0';
    const title = document.createElement('div');
    title.textContent = label || '';
    title.style.font = '12px Arial';
    title.style.color = '#333';
    canvas.style.border = '2px solid red';
    canvas.style.maxWidth = '360px';
    wrap.appendChild(title);
    wrap.appendChild(canvas);
    host.appendChild(wrap);
  };

  const ensurePdfJs = () => {
    if (window.pdfjsLib) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
      return Promise.resolve(window.pdfjsLib);
    }
    if (pdfJsLoadPromise) return pdfJsLoadPromise;
    pdfJsLoadPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js';
      script.onload = () => {
        if (window.pdfjsLib) {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc =
            'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
          resolve(window.pdfjsLib);
        } else {
          reject(new Error('PDF.js no esta disponible.'));
        }
      };
      script.onerror = () => reject(new Error('No se pudo cargar PDF.js.'));
      document.head.appendChild(script);
    });
    return pdfJsLoadPromise;
  };

  const ensureOpenCv = () => {
    if (window.cv && window.cv.imread) {
      return Promise.resolve(window.cv);
    }
    if (cvLoadPromise) return cvLoadPromise;
    cvLoadPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/opencv.js@1.2.1/opencv.js';
      script.onload = () => {
        if (window.cv && window.cv.imread) {
          resolve(window.cv);
        } else {
          reject(new Error('OpenCV no disponible.'));
        }
      };
      script.onerror = () => reject(new Error('No se pudo cargar OpenCV.'));
      document.head.appendChild(script);
    });
    return cvLoadPromise;
  };

  let ticketFile = null;
  let ticketPreviewUrl = '';
  let ticketPreviewCanvas = null;
  let ticketOcrCanvas = null;
  let ticketDebugWrap = null;

  const ticketSetStatus = (msg) => {
    if (ticketStatus) ticketStatus.textContent = msg || '';
  };

  const ensureDebugWrap = () => {
    if (!DEBUG_OCR) return null;
    if (ticketDebugWrap) return ticketDebugWrap;
    ticketDebugWrap = document.createElement('div');
    ticketDebugWrap.id = 'ticket-debug';
    ticketDebugWrap.style.marginTop = '12px';
    ticketDebugWrap.style.display = 'grid';
    ticketDebugWrap.style.gap = '10px';
    if (ticketPreview && ticketPreview.parentNode) {
      ticketPreview.parentNode.insertBefore(ticketDebugWrap, ticketPreview.nextSibling);
    } else if (viewCargarTicket) {
      viewCargarTicket.appendChild(ticketDebugWrap);
    }
    return ticketDebugWrap;
  };

  const clearDebugWrap = () => {
    if (ticketDebugWrap) ticketDebugWrap.innerHTML = '';
  };

  const setAmount = (value) => {
    if (!ticketAmount) return;
    if (Number.isFinite(value) && value > 0) {
      ticketAmount.textContent = formatMoney(value);
    } else {
      ticketAmount.textContent = '$ 0';
    }
  };

  const clearPreview = () => {
    if (ticketPreview) ticketPreview.innerHTML = '';
    if (ticketPreviewUrl) URL.revokeObjectURL(ticketPreviewUrl);
    ticketPreviewUrl = '';
    ticketPreviewCanvas = null;
    ticketOcrCanvas = null;
    clearDebugWrap();
  };

  const resetAll = () => {
    ticketFile = null;
    clearPreview();
    if (ticketOcrText) ticketOcrText.value = '';
    setAmount(0);
    ticketSetStatus('');
    if (ticketFileInput) ticketFileInput.value = '';
    if (ticketProcessBtn) ticketProcessBtn.disabled = true;
  };

  const parseAmount = (raw) => {
    if (!raw) return null;
    let cleaned = raw.replace(/[^\d.,]/g, '');
    if (!cleaned) return null;
    if (cleaned.includes('.') && cleaned.includes(',')) {
      if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
        cleaned = cleaned.replace(/\./g, '').replace(',', '.');
      } else {
        cleaned = cleaned.replace(/,/g, '');
      }
    } else if (cleaned.includes(',')) {
      cleaned = cleaned.replace(',', '.');
    }
    const value = Number(cleaned);
    if (!Number.isFinite(value)) return null;
    return value;
  };

  const hasLikelyAmount = (text) => {
    const re = /(\$?\s*\d{1,3}([.,]\d{3})+|\$?\s*\d+)([.,]\d{2})?/;
    return re.test(text || '');
  };

  const extractAmount = (text) => {
    if (!text) return null;
    const match =
      text.match(/(\$?\s*\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?)/) ||
      text.match(/(\$?\s*\d+(?:[.,]\d{2})?)/);
    if (!match) return null;
    let raw = match[1].replace(/\s/g, '').replace('$', '');
    const lastDot = raw.lastIndexOf('.');
    const lastComma = raw.lastIndexOf(',');
    const idx = Math.max(lastDot, lastComma);
    if (idx >= 0) {
      const decSep = raw[idx];
      const parts = raw.split(decSep);
      const intPart = parts[0].replace(/[.,]/g, '');
      const decPart = (parts[1] || '').replace(/[.,]/g, '');
      const hasOtherSep = raw.replace(decSep, '').includes(decSep === '.' ? ',' : '.');
      if (!hasOtherSep && decPart.length === 3) {
        // Caso miles: 19.330 -> 19330
        raw = `${intPart}${decPart}`;
      } else {
        raw = decPart ? `${intPart}.${decPart}` : intPart;
      }
    } else {
      raw = raw.replace(/[.,]/g, '');
    }
    const val = Number(raw);
    return Number.isFinite(val) ? val : null;
  };

  const isMercadoPago = (text) => /mercado\s*pago/i.test(text || '');

  const extractTicketAmount = (text) => {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const keyword = /(total|importe|monto|pagado|transferencia|saldo|acreditado)/i;
    const amountRegex = /\d{1,3}(?:[.\s]\d{3})*(?:[.,]\d{2})|\d+[.,]\d{2}|\d{2,}/g;
    const currencyRegex =
      /(?:\$|\bARS\b|\bAR\$\b|\bPESOS?\b|(?:^|\b)[sS])\s*([0-9][0-9.\s,]*)/gi;
    const candidates = [];

    lines.forEach((line) => {
      const matches = [...line.matchAll(currencyRegex)];
      matches.forEach((m) => {
        const val = parseAmount(m[1] || '');
        if (val) candidates.push(val);
      });
    });

    lines.forEach((line) => {
      if (!keyword.test(line)) return;
      const matches = line.match(amountRegex) || [];
      matches.forEach((m) => {
        const val = parseAmount(m);
        if (val) candidates.push(val);
      });
    });

    if (!candidates.length) {
      const matches = text.match(amountRegex) || [];
      matches.forEach((m) => {
        const val = parseAmount(m);
        if (val) candidates.push(val);
      });
    }

    return candidates.length ? Math.max(...candidates) : 0;
  };

  const preprocessCanvas = (source) => {
    if (!source) return null;
    const scale = 1.5;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(source.width * scale);
    canvas.height = Math.round(source.height * scale);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) {
      const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      sum += gray;
    }
    const avg = sum / (data.length / 4);
    const threshold = Math.min(210, Math.max(150, avg + 10));
    for (let i = 0; i < data.length; i += 4) {
      let gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      gray = (gray - 128) * 1.2 + 128;
      const value = gray >= threshold ? 255 : 0;
      data[i] = value;
      data[i + 1] = value;
      data[i + 2] = value;
    }
    ctx.putImageData(imgData, 0, 0);
    return canvas;
  };

  const preprocessForAmount = (source) => {
    if (!source) return null;
    const scale = 3;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(source.width * scale);
    canvas.height = Math.round(source.height * scale);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.filter = 'grayscale(1) contrast(2.2) brightness(1.05)';
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    ctx.filter = 'none';
    return canvas;
  };

  const preprocessAmountSoft = (source, invert = false) => {
    if (!source) return null;
    const scale = 4;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(source.width * scale);
    canvas.height = Math.round(source.height * scale);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = img.data;
    for (let i = 0; i < data.length; i += 4) {
      let gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      gray = (gray - 128) * 2.2 + 128;
      if (invert) gray = 255 - gray;
      gray = Math.max(0, Math.min(255, gray));
      data[i] = gray;
      data[i + 1] = gray;
      data[i + 2] = gray;
      data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return canvas;
  };

  const preprocessAmountStrong = (source, { invert = false } = {}) => {
    if (!source) return null;
    const scale = 4;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(source.width * scale);
    canvas.height = Math.round(source.height * scale);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = img.data;
    for (let i = 0; i < data.length; i += 4) {
      let gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      gray = (gray - 128) * 2.0 + 128;
      if (invert) gray = 255 - gray;
      gray = Math.max(0, Math.min(255, gray));
      data[i] = gray;
      data[i + 1] = gray;
      data[i + 2] = gray;
      data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return canvas;
  };

  const cropCanvas = (source, fromY, toY) => {
    if (!source) return null;
    const height = source.height;
    const start = Math.max(0, Math.floor(fromY * height));
    const end = Math.min(height, Math.floor(toY * height));
    const cropHeight = Math.max(1, end - start);
    const canvas = document.createElement('canvas');
    canvas.width = source.width;
    canvas.height = cropHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(source, 0, start, source.width, cropHeight, 0, 0, source.width, cropHeight);
    return canvas;
  };

  const cropFixedMpAmount = (baseCanvas) => {
    if (!baseCanvas) return null;
    return cropCanvas(baseCanvas, 0.16, 0.34);
  };

  const runTesseract = async (source, extra = {}) => {
    return window.Tesseract.recognize(source, 'spa+eng', {
      tessedit_pageseg_mode: '6',
      preserve_interword_spaces: '1',
      ...extra,
    });
  };

  const ocrAmountZone = async (baseCanvas) => {
    if (!baseCanvas) return '';
    const amountCrop = cropCanvas(baseCanvas, 0.18, 0.34);
    if (!amountCrop) return '';
    const focus = preprocessForAmount(amountCrop) || amountCrop;
    const result = await runTesseract(focus, {
      tessedit_pageseg_mode: '7',
      tessedit_char_whitelist: '0123456789.,$',
      preserve_interword_spaces: '1',
    });
    return (result?.data?.text || '').trim();
  };

  const ocrCanvasForAmount = async (canvas) => {
    if (!canvas) return '';
    const prep = preprocessAmountStrong(canvas) || canvas;
    const result = await runTesseract(prep, {
      tessedit_pageseg_mode: '7',
      classify_bln_numeric_mode: '1',
      tessedit_char_whitelist: '0123456789.,$',
      preserve_interword_spaces: '1',
    });
    return (result?.data?.text || '').trim();
  };

  const ocrMpAmountFixed = async (baseCanvas) => {
    const zone = cropFixedMpAmount(baseCanvas);
    if (!zone) return '';
    showDebugCanvas(zone, 'DEBUG: MP crop fijo (sin preprocess)');
    const candidates = [];
    for (const invert of [false, true]) {
      const prep = preprocessAmountSoft(zone, invert) || zone;
      showDebugCanvas(prep, `DEBUG: MP crop preprocess invert=${invert}`);
      const r = await runTesseract(prep, {
        tessedit_pageseg_mode: '7',
        classify_bln_numeric_mode: '1',
        tessedit_char_whitelist: '0123456789.,$',
        preserve_interword_spaces: '1',
      });
      const t = (r?.data?.text || '').trim();
      if (t) candidates.push(t);
    }
    candidates.sort(
      (a, b) => (b.match(/\d/g) || []).length - (a.match(/\d/g) || []).length
    );
    return candidates[0] || '';
  };

  const detectAmountRegionWithOpenCV = async (baseCanvas) => {
    if (!baseCanvas) return null;
    try {
      const cv = await ensureOpenCv();
      const roiTop = Math.floor(baseCanvas.height * 0.1);
      const roiBottom = Math.floor(baseCanvas.height * 0.45);
      const roiHeight = Math.max(1, roiBottom - roiTop);
      const roiCanvas = document.createElement('canvas');
      roiCanvas.width = baseCanvas.width;
      roiCanvas.height = roiHeight;
      roiCanvas.getContext('2d').drawImage(baseCanvas, 0, roiTop, baseCanvas.width, roiHeight, 0, 0, baseCanvas.width, roiHeight);
      showDebugCanvas(roiCanvas, 'DEBUG: OpenCV ROI 10%-45%');

      const src = cv.imread(roiCanvas);
      const gray = new cv.Mat();
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
      const blur = new cv.Mat();
      cv.GaussianBlur(gray, blur, new cv.Size(5, 5), 0);
      const thresh = new cv.Mat();
      cv.adaptiveThreshold(blur, thresh, 255, cv.ADAPTIVE_THRESH_MEAN_C, cv.THRESH_BINARY_INV, 31, 15);
      const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(25, 7));
      const closed = new cv.Mat();
      cv.morphologyEx(thresh, closed, cv.MORPH_CLOSE, kernel);
      const contours = new cv.MatVector();
      const hierarchy = new cv.Mat();
      cv.findContours(closed, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

      const roiArea = roiCanvas.width * roiCanvas.height;
      let best = null;
      let bestScore = -1;
      for (let i = 0; i < contours.size(); i += 1) {
        const cnt = contours.get(i);
        const rect = cv.boundingRect(cnt);
        const area = rect.width * rect.height;
        const aspect = rect.width / Math.max(1, rect.height);
        if (rect.width < roiCanvas.width * 0.12) continue;
        if (area < roiArea * 0.006) continue;
        if (aspect < 1.6) continue;
        const verticalBias = 1 - rect.y / Math.max(1, roiCanvas.height);
        const score = area * verticalBias;
        if (score > bestScore) {
          bestScore = score;
          best = rect;
        }
      }

      let cropCanvasEl = null;
      if (best) {
        const padX = Math.round(best.width * 0.05);
        const padY = Math.round(best.height * 0.35);
        const x = Math.max(0, best.x - padX);
        const y = Math.max(0, best.y - padY);
        const w = Math.min(roiCanvas.width - x, best.width + padX * 2);
        const h = Math.min(roiCanvas.height - y, best.height + padY * 2);
        cropCanvasEl = document.createElement('canvas');
        cropCanvasEl.width = w;
        cropCanvasEl.height = h;
        cropCanvasEl.getContext('2d').drawImage(roiCanvas, x, y, w, h, 0, 0, w, h);
        if (OCR_DEBUG && ticketPreview) {
          const debug = document.createElement('canvas');
          debug.width = roiCanvas.width;
          debug.height = roiCanvas.height;
          const dctx = debug.getContext('2d');
          dctx.drawImage(roiCanvas, 0, 0);
          dctx.strokeStyle = 'red';
          dctx.lineWidth = 3;
          dctx.strokeRect(x, y, w, h);
          debug.style.maxWidth = '320px';
          debug.style.marginTop = '8px';
          ticketPreview.appendChild(debug);
        }
      }

      src.delete();
      gray.delete();
      blur.delete();
      thresh.delete();
      closed.delete();
      contours.delete();
      hierarchy.delete();
      kernel.delete();

      return cropCanvasEl;
    } catch (_err) {
      return null;
    }
  };

  const ocrAmountUsingMotivoAnchor = async (baseCanvas) => {
    if (!baseCanvas) return '';
    const layout = await runTesseract(baseCanvas, { tessedit_pageseg_mode: '3' });
    const lines = layout?.data?.lines || [];
    const motivoLine = lines.find((l) => /motivo/i.test(l.text));
    const dateLine = lines.find((l) => /(lunes|martes|mi[eé]rcoles|jueves|viernes|s[áa]bado|domingo)/i.test(l.text));
    if (!motivoLine || !dateLine) return '';
    const yTop = Math.min(dateLine.bbox.y0, dateLine.bbox.y1);
    const yBottom = Math.max(motivoLine.bbox.y0, motivoLine.bbox.y1);
    const midTop = yTop + (yBottom - yTop) * 0.15;
    const midBottom = yTop + (yBottom - yTop) * 0.75;
    const amountZone = cropCanvas(baseCanvas, midTop / baseCanvas.height, midBottom / baseCanvas.height);
    const psms = ['6', '7', '11', '13'];
    const candidates = [];
    for (const invert of [false, true]) {
      const prep = preprocessAmountStrong(amountZone, { invert }) || amountZone;
      for (const psm of psms) {
        const r = await runTesseract(prep, {
          tessedit_pageseg_mode: psm,
          classify_bln_numeric_mode: '1',
          tessedit_char_whitelist: '0123456789.,$',
          preserve_interword_spaces: '1',
        });
        const t = (r?.data?.text || '').trim();
        if (t) candidates.push(t);
      }
    }
    let best = '';
    let bestScore = -1;
    candidates.forEach((c) => {
      const digits = (c.match(/\d/g) || []).length;
      const looks = /(\$?\d{1,3}([.,]\d{3})+|\$?\d+)([.,]\d{2})?/.test(c) ? 10 : 0;
      const score = digits + looks;
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    });
    return best.trim();
  };

  const findAmountBetweenMarkers = async (baseCanvas) => {
    if (!baseCanvas) return '';
    const layout = await runTesseract(baseCanvas, { tessedit_pageseg_mode: '3' });
    const lines = layout?.data?.lines || [];
    const startLine = lines.find((l) => /martes|lunes|miercoles|jueves|viernes|sabado|domingo/i.test(l.text));
    const endLine = lines.find((l) => /motivo/i.test(l.text));
    if (!startLine || !endLine) return '';
    const y1 = Math.min(startLine.bbox.y1, startLine.bbox.y0);
    const y2 = Math.max(endLine.bbox.y1, endLine.bbox.y0);
    if (!Number.isFinite(y1) || !Number.isFinite(y2) || y2 <= y1) return '';
    const top = y1 / baseCanvas.height;
    const bottom = y2 / baseCanvas.height;
    const cropped = cropCanvas(baseCanvas, top, bottom);
    if (!cropped) return '';
    const focus = preprocessCanvas(cropped) || cropped;
    const focusResult = await runTesseract(focus, {
      tessedit_pageseg_mode: '6',
      tessedit_char_whitelist: '0123456789.,$sS',
    });
    return focusResult?.data?.text || '';
  };

  const buildOcrCanvasFromImage = async (file) => {
    const img = document.createElement('img');
    const url = URL.createObjectURL(file);
    try {
      await new Promise((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('No se pudo leer la imagen.'));
        img.src = url;
      });
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      return preprocessCanvas(canvas) || canvas;
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  const renderPdfPreview = async (file) => {
    const pdfjs = await ensurePdfJs();
    const arrayBuffer = await file.arrayBuffer();
    const doc = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    const page = await doc.getPage(1);
    const viewport = page.getViewport({ scale: 1.6 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;
    ticketPreviewCanvas = canvas;
    ticketOcrCanvas = preprocessCanvas(canvas) || canvas;
    if (ticketPreview) {
      ticketPreview.innerHTML = '';
      ticketPreview.appendChild(canvas);
    }
  };

  const renderImagePreview = (file) => {
    const img = document.createElement('img');
    ticketPreviewUrl = URL.createObjectURL(file);
    img.src = ticketPreviewUrl;
    img.alt = 'Vista previa ticket';
    if (ticketPreview) {
      ticketPreview.innerHTML = '';
      ticketPreview.appendChild(img);
    }
  };

  const setTicketFile = async (file) => {
    if (!file) return;
    ticketFile = file;
    clearPreview();
    ticketSetStatus('Preparando vista previa...');
    const ext = (file.name || '').toLowerCase();
    if (file.type === 'application/pdf' || ext.endsWith('.pdf')) {
      await renderPdfPreview(file);
    } else {
      renderImagePreview(file);
      ticketOcrCanvas = await buildOcrCanvasFromImage(file);
    }
    ticketSetStatus('Listo para procesar.');
    if (ticketProcessBtn) ticketProcessBtn.disabled = false;
  };

  const readFileAsDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
      reader.readAsDataURL(file);
    });

  const getTicketImageData = async () => {
    if (!ticketFile) return '';
    const ext = (ticketFile.name || '').toLowerCase();
    if (ticketFile.type === 'application/pdf' || ext.endsWith('.pdf')) {
      if (!ticketPreviewCanvas) {
        await renderPdfPreview(ticketFile);
      }
      return ticketPreviewCanvas ? ticketPreviewCanvas.toDataURL('image/jpeg', 0.85) : '';
    }
    return readFileAsDataUrl(ticketFile);
  };

  const runOcr = async () => {
    if (!ticketFile) {
      ticketSetStatus('Selecciona un archivo primero.');
      return;
    }
    ticketSetStatus('Enviando a IA...');
    const imageData = await getTicketImageData();
    if (!imageData) {
      ticketSetStatus('No se pudo generar la imagen.');
      return;
    }
    const res = await fetch('/api/ocr/openai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageData }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      ticketSetStatus(err.message || 'Error en OpenAI.');
      return;
    }
    const data = await res.json();
    const fullText = data.fullText || '';
    const amountText = data.amountText || '';
    if (ticketOcrText) ticketOcrText.value = (fullText || amountText).trim();
    const amount = extractAmount(amountText || fullText) ?? extractTicketAmount(fullText);
    setAmount(amount);
    ticketSetStatus(amount ? 'Monto detectado.' : 'No se detecto monto.');
    if (ticketAmount) {
      ticketAmount.dataset.amountText = amountText || '';
      ticketAmount.dataset.amountNumber = Number.isFinite(amount) ? String(amount) : '';
    }
  };

  if (ticketDrop) {
    ticketDrop.addEventListener('dragover', (e) => {
      e.preventDefault();
      ticketDrop.classList.add('dragging');
    });
    ticketDrop.addEventListener('dragleave', () => {
      ticketDrop.classList.remove('dragging');
    });
    ticketDrop.addEventListener('drop', async (e) => {
      e.preventDefault();
      ticketDrop.classList.remove('dragging');
      const file = e.dataTransfer?.files?.[0];
      if (file) {
        try {
          await setTicketFile(file);
        } catch (err) {
          ticketSetStatus(err.message || 'No se pudo leer el archivo.');
        }
      }
    });
  }

  if (ticketFileInput)
    ticketFileInput.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (file) {
        try {
          await setTicketFile(file);
        } catch (err) {
          ticketSetStatus(err.message || 'No se pudo leer el archivo.');
        }
      }
    });

  if (ticketProcessBtn)
    ticketProcessBtn.addEventListener('click', async () => {
      try {
        await runOcr();
      } catch (err) {
        ticketSetStatus(err.message || 'Error al procesar.');
      }
    });

  if (ticketClearBtn)
    ticketClearBtn.addEventListener('click', () => {
      resetAll();
    });

  if (ticketCopyBtn)
    ticketCopyBtn.addEventListener('click', async () => {
      if (!ticketAmount) return;
      const value = ticketAmount.textContent || '';
      try {
        await navigator.clipboard.writeText(value);
        ticketSetStatus('Monto copiado.');
      } catch {
        ticketSetStatus('No se pudo copiar.');
      }
    });

  if (ticketProcessBtn) ticketProcessBtn.disabled = true;
}

function exportMercaderia() {
  const rows = mercFiltered.filter((r) => mercSelected.has(r.articulo));
  if (!rows.length) {
    if (mercStatus) mercStatus.textContent = 'Seleccione al menos un art︷ulo para exportar.';
    return;
  }
  exportMercaderiaXlsx(rows).catch(() => {
    exportMercaderiaCsv(rows);
  });
}

async function exportMercaderiaXlsx(rows) {
  if (!window.XLSX) {
    await loadXlsxLibrary();
  }
  if (!window.XLSX) {
    throw new Error('XLSX no disponible');
  }
  const headers = ['Articulo', 'Detalle', 'ProveedorSku', 'Total Vendido', 'Total Stock', 'Precio Venta'];
  const data = rows.map((r) => [
    r.articulo,
    r.detalle || '',
    r.proveedorSku || '',
    r.totalVendido ?? 0,
    r.totalStock ?? 0,
    r.precioVenta ?? 0,
  ]);
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...data]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Mercaderia');
  XLSX.writeFile(workbook, 'mercaderia.xlsx');
  if (mercStatus) mercStatus.textContent = `Exportado ${rows.length} art︷ulo(s).`;
}

function exportMercaderiaCsv(rows) {
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
  if (mercStatus) mercStatus.textContent = `Exportado ${rows.length} art︷ulo(s).`;
}

function loadXlsxLibrary() {
  return new Promise((resolve) => {
    const existing = document.querySelector('script[data-xlsx]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => resolve());
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
    script.async = true;
    script.dataset.xlsx = '1';
    script.onload = () => resolve();
    script.onerror = () => resolve();
    document.head.appendChild(script);
  });
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
  return String(value ?? '')
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

function balanceDetalle(texto) {
  const cleaned = String(texto || '').trim().replace(/\s+/g, ' ');
  if (!cleaned) return '';
  if (cleaned.length <= 30) return cleaned;
  const words = cleaned.split(' ');
  if (words.length < 2) return cleaned;
  const target = Math.ceil(cleaned.length / 2);
  let line1 = '';
  let line2 = '';
  for (let i = 0; i < words.length; i += 1) {
    const next = line1 ? `${line1} ${words[i]}` : words[i];
    if (next.length <= target || line1.length === 0) {
      line1 = next;
    } else {
      line2 = words.slice(i).join(' ');
      break;
    }
  }
  if (!line2) return cleaned;
  return `${line1}\n${line2}`;
}

function crearDigitoControl(codigoBarras) {
  const base = String(codigoBarras || '');
  if (base.length !== 12) return '';
  const codTmp = (`0000000000000000${base}`).slice(-17);
  let bPal = 3;
  let calTotal = 0;
  for (let numC = 0; numC <= 17; numC += 1) {
    const num = Number(codTmp.substr(numC, 1)) || 0;
    calTotal += num * bPal;
    bPal = 4 - bPal;
  }
  let digito = calTotal % 10;
  digito = digito === 0 ? 0 : 10 - digito;
  return String(digito);
}

function buildCodigoBarras(articulo) {
  const raw = String(articulo || '').replace(/\D/g, '');
  if (!raw) return '';
  if (raw.length === 13) return raw;
  if (raw.length === 12) return raw + crearDigitoControl(raw);
  if (raw.length <= 8) {
    const base = `7798${raw}`;
    if (base.length === 12) return base + crearDigitoControl(base);
  }
  return raw;
}

function openAbmBarcode(articulo, detalle) {
  if (!abmBarcodeOverlay) return;
  const code = buildCodigoBarras(articulo);
  const texto = balanceDetalle(detalle);
  if (abmBarcodeCode) abmBarcodeCode.textContent = code;
  if (abmBarcodeText) abmBarcodeText.textContent = texto;
  if (abmBarcodeStatus) abmBarcodeStatus.textContent = '';
  if (abmBarcodePreview) {
    abmBarcodePreview.classList.remove('is-compact', 'is-tight');
    if (texto.length > 55) {
      abmBarcodePreview.classList.add('is-tight');
    } else if (texto.length > 40) {
      abmBarcodePreview.classList.add('is-compact');
    }
  }
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
      flat: true,
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

function setAbmModo(opcion) {
  const isManual = opcion === 'opcion_manual';
  if (abmPrecioConvertidoInput) abmPrecioConvertidoInput.disabled = isManual;
  if (abmPrecioManualInput) abmPrecioManualInput.disabled = !isManual;
  if (abmGastosInput) abmGastosInput.disabled = !isManual;
  if (abmGananciaInput) abmGananciaInput.disabled = !isManual;
}

function setAbmBatchModo(opcion) {
  const isManual = opcion === 'opcion_manual';
  if (abmBatchPrecioConvertidoInput) abmBatchPrecioConvertidoInput.disabled = isManual;
  if (abmBatchPrecioManualInput) abmBatchPrecioManualInput.disabled = !isManual;
  if (abmBatchGastosInput) abmBatchGastosInput.disabled = !isManual;
  if (abmBatchGananciaInput) abmBatchGananciaInput.disabled = !isManual;
}

function setAbmCreateModo(opcion) {
  const isManual = opcion === 'opcion_manual';
  if (abmCreatePrecioConvertidoInput) abmCreatePrecioConvertidoInput.disabled = isManual;
  if (abmCreatePrecioManualInput) abmCreatePrecioManualInput.disabled = !isManual;
  if (abmCreateGastosInput) abmCreateGastosInput.disabled = !isManual;
  if (abmCreateGananciaInput) abmCreateGananciaInput.disabled = !isManual;
}

function clearAbmBatchForm() {
  if (abmBatchArticuloInput) abmBatchArticuloInput.value = '';
  if (abmBatchDetalleInput) abmBatchDetalleInput.value = '';
  if (abmBatchCantidadActualInput) abmBatchCantidadActualInput.value = '';
  if (abmBatchCantidadInput) abmBatchCantidadInput.value = '';
  if (abmBatchPrecioOrigenInput) abmBatchPrecioOrigenInput.value = '';
  if (abmBatchPrecioConvertidoInput) abmBatchPrecioConvertidoInput.value = '';
  if (abmBatchPrecioManualInput) abmBatchPrecioManualInput.value = '';
  if (abmBatchGastosInput) abmBatchGastosInput.value = '';
  if (abmBatchGananciaInput) abmBatchGananciaInput.value = '';
  if (abmBatchObservacionesInput) abmBatchObservacionesInput.value = '';
  if (abmBatchRestaInput) abmBatchRestaInput.checked = false;
  abmBatchCurrentArticulo = null;
}

function clearAbmCreateForm() {
  if (abmCreateArticuloInput) abmCreateArticuloInput.value = '';
  if (abmCreateDetalleInput) abmCreateDetalleInput.value = '';
  if (abmCreateProveedorSkuInput) abmCreateProveedorSkuInput.value = '';
  if (abmCreateCantidadInput) abmCreateCantidadInput.value = '';
  if (abmCreatePrecioOrigenInput) abmCreatePrecioOrigenInput.value = '';
  if (abmCreatePrecioConvertidoInput) abmCreatePrecioConvertidoInput.value = '';
  if (abmCreatePrecioManualInput) abmCreatePrecioManualInput.value = '';
  if (abmCreateGastosInput) abmCreateGastosInput.value = '';
  if (abmCreateGananciaInput) abmCreateGananciaInput.value = '';
  if (abmCreateObservacionesInput) abmCreateObservacionesInput.value = '';
  if (abmCreatePesosInput) abmCreatePesosInput.checked = true;
  setAbmCreateModo('opcion_pesos');
}

function ayudaPrecio(valor) {
  let precio = Math.round((Number(valor) || 0) * 100) / 100;
  let guard = 0;
  let result =
    Math.round((precio / 0.05) * 100) / 100 - Math.floor(Math.round((precio / 0.05) * 100) / 100);
  while (result !== 0 && guard < 10000) {
    precio = Math.round((precio - 0.01) * 100) / 100;
    result = Math.round((precio / 0.05) * 100) / 100 - Math.floor(Math.round((precio / 0.05) * 100) / 100);
    guard += 1;
  }
  return precio;
}

function setCalcValues({ pesos = 0, dolares = 0, venta = 0, gastos = 0, ganancia = 0 }) {
  if (abmCalcPesos) abmCalcPesos.value = pesos;
  if (abmCalcDolares) abmCalcDolares.value = dolares;
  if (abmCalcVenta) abmCalcVenta.value = venta;
  if (abmCalcGastos) abmCalcGastos.value = gastos;
  if (abmCalcGanancia) abmCalcGanancia.value = ganancia;
}

function setBatchCalcValues({ pesos = 0, dolares = 0, venta = 0, gastos = 0, ganancia = 0 }) {
  if (abmBatchCalcPesos) abmBatchCalcPesos.value = pesos;
  if (abmBatchCalcDolares) abmBatchCalcDolares.value = dolares;
  if (abmBatchCalcVenta) abmBatchCalcVenta.value = venta;
  if (abmBatchCalcGastos) abmBatchCalcGastos.value = gastos;
  if (abmBatchCalcGanancia) abmBatchCalcGanancia.value = ganancia;
}

async function loadAbmDolarRate() {
  if (abmDolarRate !== null) return abmDolarRate;
  try {
    const res = await fetchJSON('/api/dolar');
    const rate = Number(res.precioDolar ?? res.PrecioDolar ?? res.valor ?? 0) || 0;
    abmDolarRate = rate;
    return abmDolarRate;
  } catch (_err) {
    return 0;
  }
}

async function openAbmCalc() {
  if (!abmCalcOverlay) return;
  if (abmCalcStatus) abmCalcStatus.textContent = '';
  if (!abmProvidersLoaded && abmCalcStatus) {
    abmCalcStatus.textContent = 'Cargando proveedores...';
  }

  const isManual = !!abmManualInput?.checked;
  const isDolares = !!abmDolaresInput?.checked;
  if (isManual) {
    const precioManual = Number(abmPrecioManualInput?.value) || 0;
    const gastos = Number(abmGastosInput?.value) || 0;
    const ganancia = Number(abmGananciaInput?.value) || 0;
    const precioEnPesos = ayudaPrecio(precioManual * gastos);
    const precioVenta = ayudaPrecio(precioManual * ganancia * gastos);
    setCalcValues({ pesos: precioEnPesos, dolares: 0, venta: precioVenta, gastos, ganancia });
  } else if (isDolares) {
    const dolar = await loadAbmDolarRate();
    if (!dolar && abmCalcStatus) {
      abmCalcStatus.textContent = 'No se pudo cargar el dolar.';
    }
    const precioConvertido = Number(abmPrecioConvertidoInput?.value) || 0;
    const gastos = Number(abmGastosProveedorInput?.value) || 0;
    const ganancia = Number(abmGananciaProveedorInput?.value) || 0;
    const precioConvertidoDolar = precioConvertido * (dolar || 0);
    const precioEnPesos = ayudaPrecio(precioConvertidoDolar * gastos);
    const precioVenta = ayudaPrecio(precioConvertidoDolar * ganancia * gastos);
    const precioEnDolares = ayudaPrecio(precioConvertido * gastos);
    setCalcValues({ pesos: precioEnPesos, dolares: precioEnDolares, venta: precioVenta, gastos, ganancia });
  } else {
    const precioConvertido = Number(abmPrecioConvertidoInput?.value) || 0;
    const gastos = Number(abmGastosProveedorInput?.value) || 0;
    const ganancia = Number(abmGananciaProveedorInput?.value) || 0;
    const precioEnPesos = ayudaPrecio(precioConvertido * gastos);
    const precioVenta = ayudaPrecio(precioConvertido * ganancia * gastos);
    setCalcValues({ pesos: precioEnPesos, dolares: 0, venta: precioVenta, gastos, ganancia });
  }

  abmCalcOverlay.classList.add('open');
}

function closeAbmCalc() {
  if (abmCalcOverlay) abmCalcOverlay.classList.remove('open');
}

async function openAbmCreateCalc() {
  if (!abmCalcOverlay) return;
  if (abmCalcStatus) abmCalcStatus.textContent = '';
  if (!abmCreateProvidersLoaded && abmCalcStatus) {
    abmCalcStatus.textContent = 'Cargando proveedores...';
  }

  const isManual = !!abmCreateManualInput?.checked;
  const isDolares = !!abmCreateDolaresInput?.checked;
  if (isManual) {
    const precioManual = Number(abmCreatePrecioManualInput?.value) || 0;
    const gastos = Number(abmCreateGastosInput?.value) || 0;
    const ganancia = Number(abmCreateGananciaInput?.value) || 0;
    const precioEnPesos = ayudaPrecio(precioManual * gastos);
    const precioVenta = ayudaPrecio(precioManual * ganancia * gastos);
    setCalcValues({ pesos: precioEnPesos, dolares: 0, venta: precioVenta, gastos, ganancia });
  } else if (isDolares) {
    const dolar = await loadAbmDolarRate();
    if (!dolar && abmCalcStatus) {
      abmCalcStatus.textContent = 'No se pudo cargar el dolar.';
    }
    const precioConvertido = Number(abmCreatePrecioConvertidoInput?.value) || 0;
    const gastos = Number(abmCreateGastosProveedorInput?.value) || 0;
    const ganancia = Number(abmCreateGananciaProveedorInput?.value) || 0;
    const precioConvertidoDolar = precioConvertido * (dolar || 0);
    const precioEnPesos = ayudaPrecio(precioConvertidoDolar * gastos);
    const precioVenta = ayudaPrecio(precioConvertidoDolar * ganancia * gastos);
    const precioEnDolares = ayudaPrecio(precioConvertido * gastos);
    setCalcValues({ pesos: precioEnPesos, dolares: precioEnDolares, venta: precioVenta, gastos, ganancia });
  } else {
    const precioConvertido = Number(abmCreatePrecioConvertidoInput?.value) || 0;
    const gastos = Number(abmCreateGastosProveedorInput?.value) || 0;
    const ganancia = Number(abmCreateGananciaProveedorInput?.value) || 0;
    const precioEnPesos = ayudaPrecio(precioConvertido * gastos);
    const precioVenta = ayudaPrecio(precioConvertido * ganancia * gastos);
    setCalcValues({ pesos: precioEnPesos, dolares: 0, venta: precioVenta, gastos, ganancia });
  }

  abmCalcOverlay.classList.add('open');
}

async function openAbmBatchCalc() {
  if (!abmBatchCalcOverlay) return;
  if (abmBatchCalcStatus) abmBatchCalcStatus.textContent = '';
  if (!abmBatchProvidersLoaded && abmBatchCalcStatus) {
    abmBatchCalcStatus.textContent = 'Cargando proveedores...';
  }
  const isManual = !!abmBatchManualInput?.checked;
  const isDolares = !!abmBatchDolaresInput?.checked;
  if (isManual) {
    const precioManual = Number(abmBatchPrecioManualInput?.value) || 0;
    const gastos = Number(abmBatchGastosInput?.value) || 0;
    const ganancia = Number(abmBatchGananciaInput?.value) || 0;
    const precioEnPesos = ayudaPrecio(precioManual * gastos);
    const precioVenta = ayudaPrecio(precioManual * ganancia * gastos);
    setBatchCalcValues({ pesos: precioEnPesos, dolares: 0, venta: precioVenta, gastos, ganancia });
  } else if (isDolares) {
    const dolar = await loadAbmDolarRate();
    if (!dolar && abmBatchCalcStatus) {
      abmBatchCalcStatus.textContent = 'No se pudo cargar el dolar.';
    }
    const precioConvertido = Number(abmBatchPrecioConvertidoInput?.value) || 0;
    const gastos = Number(abmBatchGastosProveedorInput?.value) || 0;
    const ganancia = Number(abmBatchGananciaProveedorInput?.value) || 0;
    const precioConvertidoDolar = precioConvertido * (dolar || 0);
    const precioEnPesos = ayudaPrecio(precioConvertidoDolar * gastos);
    const precioVenta = ayudaPrecio(precioConvertidoDolar * ganancia * gastos);
    const precioEnDolares = ayudaPrecio(precioConvertido * gastos);
    setBatchCalcValues({ pesos: precioEnPesos, dolares: precioEnDolares, venta: precioVenta, gastos, ganancia });
  } else {
    const precioConvertido = Number(abmBatchPrecioConvertidoInput?.value) || 0;
    const gastos = Number(abmBatchGastosProveedorInput?.value) || 0;
    const ganancia = Number(abmBatchGananciaProveedorInput?.value) || 0;
    const precioEnPesos = ayudaPrecio(precioConvertido * gastos);
    const precioVenta = ayudaPrecio(precioConvertido * ganancia * gastos);
    setBatchCalcValues({ pesos: precioEnPesos, dolares: 0, venta: precioVenta, gastos, ganancia });
  }
  abmBatchCalcOverlay.classList.add('open');
}

function closeAbmBatchCalc() {
  if (abmBatchCalcOverlay) abmBatchCalcOverlay.classList.remove('open');
}

async function loadAbmProveedores(selected) {
  if (!abmProveedorSelect) return;
  try {
    if (abmProveedorLoading) abmProveedorLoading.style.display = 'block';
    const res = await fetchJSON('/api/proveedores/select');
    const data = Array.isArray(res.data) ? res.data : [];
    abmProveedorSelect.innerHTML = '';
    data.forEach((row) => {
      const opt = document.createElement('option');
      opt.value = row.Nombre || row.nombre || '';
      opt.textContent = row.Nombre || row.nombre || '';
      abmProveedorSelect.appendChild(opt);
    });
    if (selected) abmProveedorSelect.value = selected;
    abmProvidersLoaded = true;
    if (abmEditSave) abmEditSave.disabled = false;
    if (abmProveedorLoading) abmProveedorLoading.style.display = 'none';
  } catch (_err) {
    if (abmEditStatus) abmEditStatus.textContent = 'No se pudieron cargar proveedores.';
    if (abmEditSave) abmEditSave.disabled = true;
    if (abmProveedorLoading) abmProveedorLoading.style.display = 'none';
  }
}

async function loadAbmBatchProveedores(selected) {
  if (!abmBatchProveedorSelect) return;
  try {
    if (abmBatchProveedorLoading) abmBatchProveedorLoading.style.display = 'block';
    const res = await fetchJSON('/api/proveedores/select');
    const data = Array.isArray(res.data) ? res.data : [];
    abmBatchProveedorSelect.innerHTML = '';
    data.forEach((row) => {
      const opt = document.createElement('option');
      opt.value = row.Nombre || row.nombre || '';
      opt.textContent = row.Nombre || row.nombre || '';
      abmBatchProveedorSelect.appendChild(opt);
    });
    if (selected) abmBatchProveedorSelect.value = selected;
    abmBatchProvidersLoaded = true;
    if (abmBatchAdd) abmBatchAdd.disabled = false;
    if (abmBatchSubmit) abmBatchSubmit.disabled = false;
    if (abmBatchProveedorLoading) abmBatchProveedorLoading.style.display = 'none';
  } catch (_err) {
    if (abmBatchFormStatus) abmBatchFormStatus.textContent = 'No se pudieron cargar proveedores.';
    if (abmBatchAdd) abmBatchAdd.disabled = true;
    if (abmBatchSubmit) abmBatchSubmit.disabled = true;
    if (abmBatchProveedorLoading) abmBatchProveedorLoading.style.display = 'none';
  }
}

async function loadAbmCreateProveedores(selected) {
  if (!abmCreateProveedorSelect) return;
  try {
    if (abmCreateProveedorLoading) abmCreateProveedorLoading.style.display = 'block';
    const res = await fetchJSON('/api/proveedores/select');
    const data = Array.isArray(res.data) ? res.data : [];
    abmCreateProveedorSelect.innerHTML = '';
    data.forEach((row) => {
      const opt = document.createElement('option');
      opt.value = row.Nombre || row.nombre || '';
      opt.textContent = row.Nombre || row.nombre || '';
      abmCreateProveedorSelect.appendChild(opt);
    });
    if (selected) abmCreateProveedorSelect.value = selected;
    abmCreateProvidersLoaded = true;
    if (abmCreateSave) abmCreateSave.disabled = false;
    if (abmCreateProveedorLoading) abmCreateProveedorLoading.style.display = 'none';
  } catch (_err) {
    if (abmCreateStatus) abmCreateStatus.textContent = 'No se pudieron cargar proveedores.';
    if (abmCreateSave) abmCreateSave.disabled = true;
    if (abmCreateProveedorLoading) abmCreateProveedorLoading.style.display = 'none';
  }
}

async function loadProveedorMeta(nombre) {
  if (!nombre) return;
  try {
    const params = new URLSearchParams({ proveedor_name: nombre });
    const res = await fetchJSON(`/api/proveedores/select?${params.toString()}`);
    const row = Array.isArray(res.data) ? res.data[0] : res.data;
    if (!row) return;
    if (abmPaisInput) abmPaisInput.value = row.Pais || row.pais || '';
    if (abmGastosProveedorInput) abmGastosProveedorInput.value = row.Gastos ?? row.gastos ?? '';
    if (abmGananciaProveedorInput) abmGananciaProveedorInput.value = row.Ganancia ?? row.ganancia ?? '';
  } catch (_err) {
    /* silencioso */
  }
}

async function loadBatchProveedorMeta(nombre) {
  if (!nombre) return;
  try {
    const params = new URLSearchParams({ proveedor_name: nombre });
    const res = await fetchJSON(`/api/proveedores/select?${params.toString()}`);
    const row = Array.isArray(res.data) ? res.data[0] : res.data;
    if (!row) return;
    if (abmBatchPaisInput) abmBatchPaisInput.value = row.Pais || row.pais || '';
    if (abmBatchGastosProveedorInput) abmBatchGastosProveedorInput.value = row.Gastos ?? row.gastos ?? '';
    if (abmBatchGananciaProveedorInput) abmBatchGananciaProveedorInput.value = row.Ganancia ?? row.ganancia ?? '';
  } catch (_err) {
    /* silencioso */
  }
}

async function loadCreateProveedorMeta(nombre) {
  if (!nombre) return;
  try {
    const params = new URLSearchParams({ proveedor_name: nombre });
    const res = await fetchJSON(`/api/proveedores/select?${params.toString()}`);
    const row = Array.isArray(res.data) ? res.data[0] : res.data;
    if (!row) return;
    if (abmCreatePaisInput) abmCreatePaisInput.value = row.Pais || row.pais || '';
    if (abmCreateGastosProveedorInput) abmCreateGastosProveedorInput.value = row.Gastos ?? row.gastos ?? '';
    if (abmCreateGananciaProveedorInput) abmCreateGananciaProveedorInput.value = row.Ganancia ?? row.ganancia ?? '';
  } catch (_err) {
    /* silencioso */
  }
}

async function openAbmEdit(articulo) {
  if (!abmEditOverlay) return;
  abmCurrentArticulo = articulo;
  if (abmEditSave) abmEditSave.disabled = true;
  if (abmProveedorLoading) abmProveedorLoading.style.display = 'block';
  if (abmEditStatus) abmEditStatus.textContent = 'Cargando...';
  try {
    const [artRes, ordenRes] = await Promise.all([
      fetchJSON(`/api/mercaderia/abm/articulo?articulo=${encodeURIComponent(articulo)}`),
      fetchJSON('/api/ordencompras'),
    ]);
    const row = artRes.data || {};
    if (!abmProvidersLoaded) {
      await loadAbmProveedores(row.Proveedor || row.proveedor || '');
    } else if (abmProveedorSelect) {
      abmProveedorSelect.value = row.Proveedor || row.proveedor || '';
      if (abmEditSave) abmEditSave.disabled = false;
      if (abmProveedorLoading) abmProveedorLoading.style.display = 'none';
    }
    if (abmArticuloInput) abmArticuloInput.value = row.Articulo || row.articulo || articulo || '';
    if (abmDetalleInput) abmDetalleInput.value = row.Detalle || row.detalle || '';
    if (abmCantidadActualInput) abmCantidadActualInput.value = row.Cantidad ?? row.cantidad ?? 0;
    if (abmCantidadInput) abmCantidadInput.value = '';
    if (abmPrecioOrigenInput) abmPrecioOrigenInput.value = row.PrecioOrigen ?? row.precioOrigen ?? '';
    if (abmPrecioConvertidoInput)
      abmPrecioConvertidoInput.value = row.PrecioConvertido ?? row.precioConvertido ?? '';
    if (abmPrecioManualInput) abmPrecioManualInput.value = row.PrecioManual ?? row.precioManual ?? '';
    if (abmGastosInput) abmGastosInput.value = row.Gastos ?? row.gastos ?? '';
    if (abmGananciaInput) abmGananciaInput.value = row.Ganancia ?? row.ganancia ?? '';
    if (abmObservacionesInput) abmObservacionesInput.value = '';
    if (abmOrdenInput) abmOrdenInput.value = ordenRes.numeroOrden ?? ordenRes.NumeroOrden ?? '';

    const moneda = row.Moneda || row.moneda || '';
    if (moneda === 'uSs') {
      if (abmDolaresInput) abmDolaresInput.checked = true;
      setAbmModo('opcion_dolares');
    } else if (moneda === 'ARG') {
      if (abmPesosInput) abmPesosInput.checked = true;
      setAbmModo('opcion_pesos');
    } else {
      if (abmManualInput) abmManualInput.checked = true;
      setAbmModo('opcion_manual');
    }
    await loadProveedorMeta(abmProveedorSelect?.value);
    if (abmEditStatus) abmEditStatus.textContent = '';
    abmEditOverlay.classList.add('open');
  } catch (error) {
    if (abmEditStatus) abmEditStatus.textContent = error.message || 'Error al cargar articulo';
  }
}

async function openAbmCreate() {
  if (!abmCreateOverlay) return;
  if (abmCreateSave) abmCreateSave.disabled = true;
  if (abmCreateStatus) abmCreateStatus.textContent = 'Cargando...';
  try {
    clearAbmCreateForm();
    const ordenRes = await fetchJSON('/api/ordencompras');
    if (!abmCreateProvidersLoaded) {
      await loadAbmCreateProveedores();
    } else if (abmCreateProveedorSelect) {
      if (abmCreateSave) abmCreateSave.disabled = false;
    }
    if (abmCreateOrdenInput) {
      abmCreateOrdenInput.value = ordenRes.numeroOrden ?? ordenRes.NumeroOrden ?? '';
    }
    if (abmCreateProveedorSelect?.value) {
      await loadCreateProveedorMeta(abmCreateProveedorSelect.value);
    }
    if (abmCreateStatus) abmCreateStatus.textContent = '';
    abmCreateOverlay.classList.add('open');
  } catch (error) {
    if (abmCreateStatus) abmCreateStatus.textContent = error.message || 'Error al cargar formulario';
  }
}

function closeAbmCreate() {
  if (abmCreateOverlay) abmCreateOverlay.classList.remove('open');
}

function closeAbmEdit() {
  if (abmEditOverlay) abmEditOverlay.classList.remove('open');
}

async function openAbmBatch() {
  if (!abmBatchOverlay) return;
  if (abmBatchFormStatus) abmBatchFormStatus.textContent = '';
  if (abmBatchStatus) abmBatchStatus.textContent = '';
  if (abmBatchAdd) abmBatchAdd.disabled = true;
  if (abmBatchSubmit) abmBatchSubmit.disabled = true;
  if (abmBatchProveedorLoading) abmBatchProveedorLoading.style.display = 'block';
  try {
    const ordenRes = await fetchJSON('/api/ordencompras');
    if (abmBatchOrdenInput) abmBatchOrdenInput.value = ordenRes.numeroOrden ?? ordenRes.NumeroOrden ?? '';
    if (!abmBatchProvidersLoaded) {
      await loadAbmBatchProveedores('');
    } else {
      if (abmBatchAdd) abmBatchAdd.disabled = false;
      if (abmBatchSubmit) abmBatchSubmit.disabled = false;
      if (abmBatchProveedorLoading) abmBatchProveedorLoading.style.display = 'none';
    }
        abmBatchItems = [];
        renderBatchTable();
    clearAbmBatchForm();
    abmBatchOverlay.classList.add('open');
  } catch (error) {
    if (abmBatchFormStatus) abmBatchFormStatus.textContent = error.message || 'No se pudo abrir.';
  }
}

function closeAbmBatch() {
  if (abmBatchOverlay) abmBatchOverlay.classList.remove('open');
}

  async function openAbmPick() {
    if (!abmPickOverlay) return;
    if (abmPickStatus) abmPickStatus.textContent = '';
    if (abmPickOverlay) abmPickOverlay.classList.add('open');
    if (!abmPickLoaded) {
      if (abmPickLoading) abmPickLoading.style.display = 'flex';
      await loadAbmPickTable();
      if (abmPickLoading) abmPickLoading.style.display = 'none';
    } else if (abmPickTable) {
      abmPickTable.search('').draw();
      const searchInput = getAbmPickSearchInput();
      if (searchInput) searchInput.value = '';
    }
    if (!focusAbmPickSearch()) {
      requestAnimationFrame(() => focusAbmPickSearch());
      setTimeout(focusAbmPickSearch, 150);
      setTimeout(focusAbmPickSearch, 350);
      setTimeout(focusAbmPickSearch, 600);
    }
  }

  function closeAbmPick() {
    if (abmPickOverlay) abmPickOverlay.classList.remove('open');
  }

  function getAbmPickSearchInput() {
    const scope =
      abmPickOverlay ||
      abmPickTableEl?.closest('.dt-container, .dataTables_wrapper') ||
      abmPickTableEl?.parentElement;
    return scope?.querySelector('input[type="search"]') || null;
  }

  function focusAbmPickSearch() {
    const searchInput = getAbmPickSearchInput();
    if (searchInput) {
      const isActive = document.activeElement === searchInput;
      if (!isActive) {
        searchInput.focus();
      }
      if (!isActive && searchInput.value) {
        searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);
      } else if (!searchInput.value) {
        searchInput.select();
      }
      return true;
    }
    return false;
  }

function setBatchFormFromArticulo(row) {
  if (!row) return;
  abmBatchCurrentArticulo = row.Articulo || row.articulo || '';
  if (abmBatchArticuloInput) abmBatchArticuloInput.value = row.Articulo || row.articulo || '';
  if (abmBatchDetalleInput) abmBatchDetalleInput.value = row.Detalle || row.detalle || '';
  if (abmBatchCantidadActualInput) abmBatchCantidadActualInput.value = row.Cantidad ?? row.cantidad ?? 0;
  if (abmBatchCantidadInput) abmBatchCantidadInput.value = '';
  if (abmBatchPrecioOrigenInput) abmBatchPrecioOrigenInput.value = row.PrecioOrigen ?? row.precioOrigen ?? '';
  if (abmBatchPrecioConvertidoInput)
    abmBatchPrecioConvertidoInput.value = row.PrecioConvertido ?? row.precioConvertido ?? '';
  if (abmBatchPrecioManualInput) abmBatchPrecioManualInput.value = row.PrecioManual ?? row.precioManual ?? '';
  if (abmBatchGastosInput) abmBatchGastosInput.value = row.Gastos ?? row.gastos ?? '';
  if (abmBatchGananciaInput) abmBatchGananciaInput.value = row.Ganancia ?? row.ganancia ?? '';
  if (abmBatchObservacionesInput) abmBatchObservacionesInput.value = '';
  const moneda = row.Moneda || row.moneda || '';
  if (moneda === 'uSs') {
    if (abmBatchDolaresInput) abmBatchDolaresInput.checked = true;
    setAbmBatchModo('opcion_dolares');
  } else if (moneda === 'ARG') {
    if (abmBatchPesosInput) abmBatchPesosInput.checked = true;
    setAbmBatchModo('opcion_pesos');
  } else {
    if (abmBatchManualInput) abmBatchManualInput.checked = true;
    setAbmBatchModo('opcion_manual');
  }
  if (abmBatchProveedorSelect && (row.Proveedor || row.proveedor)) {
    abmBatchProveedorSelect.value = row.Proveedor || row.proveedor || '';
  }
  loadBatchProveedorMeta(abmBatchProveedorSelect?.value);
}

function setBatchFormFromItem(item) {
  if (!item) return;
  abmBatchCurrentArticulo = item.articulo || '';
  if (abmBatchArticuloInput) abmBatchArticuloInput.value = item.articulo || '';
  if (abmBatchDetalleInput) abmBatchDetalleInput.value = item.detalle || '';
  if (abmBatchCantidadActualInput) abmBatchCantidadActualInput.value = item.cantidadActual ?? '';
  if (abmBatchCantidadInput) abmBatchCantidadInput.value = item.cantidadDelta ?? 0;
  if (abmBatchPrecioOrigenInput) abmBatchPrecioOrigenInput.value = item.precioOrigen ?? '';
  if (abmBatchPrecioConvertidoInput) abmBatchPrecioConvertidoInput.value = item.precioConvertido ?? '';
  if (abmBatchPrecioManualInput) abmBatchPrecioManualInput.value = item.precioManual ?? '';
  if (abmBatchGastosInput) abmBatchGastosInput.value = item.gastos ?? '';
  if (abmBatchGananciaInput) abmBatchGananciaInput.value = item.ganancia ?? '';
  if (abmBatchObservacionesInput) abmBatchObservacionesInput.value = item.observaciones || '';
  if (abmBatchRestaInput) abmBatchRestaInput.checked = !!item.resta;
  if (abmBatchProveedorSelect) abmBatchProveedorSelect.value = item.proveedor || '';
  if (abmBatchPaisInput) abmBatchPaisInput.value = item.paisProveedor || '';
  if (abmBatchGastosProveedorInput) abmBatchGastosProveedorInput.value = item.gastosProveedor ?? '';
  if (abmBatchGananciaProveedorInput) abmBatchGananciaProveedorInput.value = item.gananciaProveedor ?? '';
  if (item.opcion === 'opcion_dolares') {
    if (abmBatchDolaresInput) abmBatchDolaresInput.checked = true;
    setAbmBatchModo('opcion_dolares');
  } else if (item.opcion === 'opcion_pesos') {
    if (abmBatchPesosInput) abmBatchPesosInput.checked = true;
    setAbmBatchModo('opcion_pesos');
  } else {
    if (abmBatchManualInput) abmBatchManualInput.checked = true;
    setAbmBatchModo('opcion_manual');
  }
}

  async function loadAbmPickTable() {
    if (!abmPickTableEl) return;
    try {
      if (abmPickStatus) abmPickStatus.textContent = 'Cargando...';
      const res = await fetchJSON('/api/mercaderia/abm/pick');
      const rows = Array.isArray(res.data) ? res.data : [];
      if (abmPickTable) {
        abmPickTable.clear();
        abmPickTable.rows.add(rows);
        abmPickTable.draw();
        requestAnimationFrame(() => focusAbmPickSearch());
      } else if (window.DataTable) {
        abmPickTable = new DataTable('#abm-pick-table', {
          data: rows,
        columns: [
          { data: 'articulo' },
          { data: 'detalle' },
          { data: 'cantidad' },
          {
            data: null,
            orderable: false,
            render: (_data, _type, row) => `
              <button type="button" class="abm-pick-add" data-articulo="${escapeAttr(row.articulo)}">
                Agregar
              </button>
            `,
          },
        ],
        pageLength: 10,
        lengthMenu: [10, 25, 50, 100],
        deferRender: true,
        order: [[0, 'asc']],
        autoWidth: false,
      });
        abmPickTable.on('draw', () => {
          focusAbmPickSearch();
        });
        setTimeout(() => {
          const searchInput = getAbmPickSearchInput();
          if (searchInput) {
            searchInput.addEventListener('keydown', (ev) => {
              if (ev.key === 'Enter') {
                if (!abmPickTable) return;
                const count = abmPickTable.rows({ filter: 'applied' }).data().length;
                if (count === 1) {
                  const firstBtn = abmPickTableEl.querySelector('tbody .abm-pick-add');
                  if (firstBtn) {
                    ev.preventDefault();
                    firstBtn.click();
                  }
                }
                return;
              }
              if (ev.key !== 'Tab' || ev.shiftKey) return;
              const firstBtn = abmPickTableEl.querySelector('tbody .abm-pick-add');
              if (firstBtn) {
                ev.preventDefault();
                firstBtn.focus();
              }
            });
          }
          focusAbmPickSearch();
        }, 0);
      }
    abmPickLoaded = true;
    if (abmPickStatus) abmPickStatus.textContent = rows.length ? `Total articulos: ${rows.length}` : 'Sin resultados';
  } catch (error) {
    if (abmPickStatus) abmPickStatus.textContent = error.message || 'Error al cargar articulos';
  } finally {
    if (abmPickLoading) abmPickLoading.style.display = 'none';
  }
}

function getBatchItemsArray() {
  return abmBatchItems.slice();
}

function renderBatchTable() {
  if (!abmBatchTableEl) return;
  const rows = getBatchItemsArray().map((item) => {
    const precio = item.opcion === 'opcion_manual' ? item.precioManual : item.precioConvertido;
    return {
      ...item,
      precioDisplay: precio,
    };
  });
  if (abmBatchTable) {
    abmBatchTable.clear();
    abmBatchTable.rows.add(rows);
    abmBatchTable.draw();
  } else if (window.DataTable) {
    abmBatchTable = new DataTable('#abm-batch-table', {
      data: rows,
      columns: [
        { data: 'articulo' },
        { data: 'detalle' },
        { data: 'cantidadDelta' },
        { data: 'precioOrigen' },
        { data: 'precioDisplay' },
        { data: 'proveedor' },
        {
          data: null,
          orderable: false,
          render: (_data, _type, row) => `
            <div class="abm-actions">
              <button type="button" class="abm-batch-edit" data-batch-id="${row._batchId}">Modificar</button>
              <button type="button" class="abm-batch-remove" data-batch-id="${row._batchId}">Eliminar</button>
            </div>
          `,
        },
      ],
      pageLength: 10,
      lengthMenu: [10, 25, 50],
      deferRender: true,
      order: [[0, 'asc']],
      autoWidth: false,
    });
  }
}

function renderAbmPedidos(rows) {
  if (!abmPedidosTableBody) return;
  abmPedidosTableBody.innerHTML = '';
  rows.forEach((row) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${row.nropedido ?? ''}</td>
      <td>${row.cliente || ''}</td>
      <td>${row.cantidad ?? ''}</td>
      <td>${row.fecha || ''}</td>
      <td>${row.vendedora || ''}</td>
      <td>${row.total ?? ''}</td>
      <td>${row.ordenWeb ?? ''}</td>
    `;
    abmPedidosTableBody.appendChild(tr);
  });
}

async function openAbmPedidos(articulo, detalle) {
  if (!abmPedidosOverlay) return;
  if (abmPedidosStatus) abmPedidosStatus.textContent = 'Cargando...';
  if (abmPedidosTableBody) abmPedidosTableBody.innerHTML = '';
  if (abmPedidosDetalle) abmPedidosDetalle.textContent = detalle ? `Detalle: ${detalle}` : '';
  try {
    const res = await fetchJSON(`/api/mercaderia/abm/pedidos?articulo=${encodeURIComponent(articulo)}`);
    const rows = Array.isArray(res.data) ? res.data : [];
    renderAbmPedidos(rows);
    if (abmPedidosStatus) {
      abmPedidosStatus.textContent = rows.length ? `Pedidos: ${rows.length}` : 'Sin pedidos.';
    }
    abmPedidosOverlay.classList.add('open');
  } catch (error) {
    if (abmPedidosStatus) abmPedidosStatus.textContent = error.message || 'Error al cargar pedidos.';
    abmPedidosOverlay.classList.add('open');
  }
}

function upsertBatchItem(item) {
  if (!item?.articulo) return;
  if (abmBatchEditingId) {
    abmBatchItems = abmBatchItems.map((row) =>
      row._batchId === abmBatchEditingId ? { ...item, _batchId: row._batchId } : row
    );
    abmBatchEditingId = null;
  } else {
    abmBatchItems.push({ ...item, _batchId: abmBatchItemSeq++ });
  }
  renderBatchTable();
}

function removeBatchItem(batchId) {
  if (!batchId) return;
  if (abmBatchEditingId === batchId) abmBatchEditingId = null;
  abmBatchItems = abmBatchItems.filter((item) => item._batchId !== batchId);
  renderBatchTable();
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

function buildAbmCard(row) {
  const articulo = row.articulo || '';
  const detalle = row.detalle || '';
  const proveedorSku = row.proveedorSku || '';
  const cantidad = row.cantidad ?? 0;
  const enPedido = Number(row.enPedido) || 0;
  const precioVenta = formatMoney(row.precioVenta || 0);
  const enPedidoHtml =
    enPedido > 0
      ? `<button type="button" class="abm-link-btn abm-pedido-link" data-articulo="${escapeAttr(
          articulo
        )}">${enPedido}</button>`
      : `${enPedido}`;
  const card = document.createElement('article');
  card.className = 'abm-card';
  card.dataset.articulo = articulo;
  card.dataset.detalle = detalle;
  card.innerHTML = `
    <div class="abm-card-header">
      <div>
        <p class="abm-card-title">${escapeAttr(articulo)}</p>
        <p class="abm-card-sub">${escapeAttr(detalle)}</p>
      </div>
      <div class="abm-card-actions">
        <button type="button" class="abm-card-menu-toggle" aria-label="Acciones">...</button>
        <div class="abm-card-menu">
          <button type="button" class="abm-action" data-action="barcode" data-articulo="${escapeAttr(
            articulo
          )}" data-detalle="${escapeAttr(detalle)}">Codigo Barras</button>
          <button type="button" class="abm-action" data-action="edit" data-articulo="${escapeAttr(
            articulo
          )}">Modificar</button>
          <button type="button" class="abm-action" data-action="photo" data-articulo="${escapeAttr(
            articulo
          )}">Foto</button>
        </div>
      </div>
    </div>
    <div class="abm-card-grid">
      <div>
        <div class="abm-card-label">ProveedorSKU</div>
        <div class="abm-card-value">${escapeAttr(proveedorSku)}</div>
      </div>
      <div>
        <div class="abm-card-label">Cantidad</div>
        <div class="abm-card-value">${escapeAttr(cantidad)}</div>
      </div>
      <div>
        <div class="abm-card-label">En Pedido</div>
        <div class="abm-card-value">${enPedidoHtml}</div>
      </div>
      <div>
        <div class="abm-card-label">Precio Venta</div>
        <div class="abm-card-value">${escapeAttr(precioVenta)}</div>
      </div>
    </div>
  `;
  return card;
}

function filterAbmRows(rows, term) {
  const clean = String(term || '').trim();
  if (!clean) return rows;
  return rows.filter((row) =>
    textMatchesAllTokens(
      `${row.articulo || ''} ${row.detalle || ''} ${row.proveedorSku || ''}`,
      clean
    )
  );
}

function resetAbmCards() {
  if (!abmCardsEl) return;
  abmCardFilteredRows = filterAbmRows(abmRowsCache, abmCardFilterTerm);
  abmCardVisibleCount = 0;
  abmCardsEl.innerHTML = '';
  appendAbmCards();
}

function appendAbmCards() {
  if (!abmCardsEl || abmCardLoading) return;
  if (abmCardVisibleCount >= abmCardFilteredRows.length) return;
  abmCardLoading = true;
  const next = abmCardFilteredRows.slice(abmCardVisibleCount, abmCardVisibleCount + abmCardBatchSize);
  next.forEach((row) => {
    abmCardsEl.appendChild(buildAbmCard(row));
  });
  abmCardVisibleCount += next.length;
  abmCardLoading = false;
}

function closeAbmCardMenus(except) {
  if (!abmCardsEl) return;
  abmCardsEl.querySelectorAll('.abm-card-menu.open').forEach((menu) => {
    if (menu !== except) menu.classList.remove('open');
  });
}

function buildPedidoCard(row) {
  const pedido = row.pedido || '';
  const cliente = row.cliente || '';
  const fecha = formatDateLong(row.fecha || '');
  const vendedora = row.vendedora || '';
  const factura = row.factura || '';
  const total = row.total ?? '';
  const ordenWeb = row.ordenWeb || '';
  const totalWeb = row.totalWeb ?? '';
  const estado = mapEstado(row.estado, row.empaquetado);
  const transporte = row.transporte || '';
  const instancia = row.instancia ?? '';
  const notaCount = Number(row.notasCount) || 0;
  if (row?.id) {
    pedidoTransporteCache.set(Number(row.id), row.transporte || '');
  }
  const options = buildTransporteOptions(transporte);
  const instanciaOptions = `
    <option value="0"${Number(instancia) === 0 ? ' selected' : ''}>Pendiente</option>
    <option value="1"${Number(instancia) === 1 ? ' selected' : ''}>Iniciado</option>
    <option value="2"${Number(instancia) === 2 ? ' selected' : ''}>Finalizado</option>
  `;
  const isTodosEmpaquetados = currentPedidosScope === 'todos' && currentPedidosTipo === 'empaquetados';
  const actionsHtml = isTodosEmpaquetados
    ? `
        <button type="button" class="abm-link-btn pedido-items-btn" title="Ver mercaderia" data-pedido="${escapeAttr(
          pedido
        )}" data-vendedora="${escapeAttr(vendedora)}" data-cliente="${escapeAttr(cliente)}">👁️</button>
        <button type="button" class="abm-link-btn pedido-notas-btn" title="Notas" data-id="${escapeAttr(
          row.id
        )}" data-pedido="${escapeAttr(pedido)}" data-vendedora="${escapeAttr(vendedora)}" data-cliente="${escapeAttr(
          cliente
        )}">📘<span class="nota-count">${notaCount}</span></button>
        <button type="button" class="abm-link-btn pedido-entregado-btn" title="Entregado" data-id="${escapeAttr(
          row.id
        )}" data-pedido="${escapeAttr(pedido)}">✅</button>
      `
    : `
        <button type="button" class="abm-link-btn pedido-items-btn" title="Ver mercaderia" data-pedido="${escapeAttr(
          pedido
        )}" data-vendedora="${escapeAttr(vendedora)}" data-cliente="${escapeAttr(cliente)}">👁️</button>
        <button type="button" class="abm-link-btn pedido-notas-btn" title="Notas" data-id="${escapeAttr(
          row.id
        )}" data-pedido="${escapeAttr(pedido)}" data-vendedora="${escapeAttr(vendedora)}" data-cliente="${escapeAttr(
          cliente
        )}">📘<span class="nota-count">${notaCount}</span></button>
        <button type="button" class="abm-link-btn pedido-checkout-btn" title="Check Out" data-pedido="${escapeAttr(
          pedido
        )}" data-vendedora="${escapeAttr(vendedora)}" data-cliente="${escapeAttr(cliente)}">✅</button>
        <button type="button" class="abm-link-btn pedido-pago-btn ${Number(row.pagado) === 1 ? 'pago-ok' : 'pago-pendiente'}" title="${
          Number(row.pagado) === 1 ? 'Marcar como no pagado' : 'Marcar como pagado'
        }" data-id="${escapeAttr(row.id)}" data-pagado="${Number(row.pagado)}">${
          Number(row.pagado) === 1 ? '😊' : '😟'
        }</button>
        <button type="button" class="abm-link-btn pedido-cancel-btn" title="Cancelar pedido" data-id="${escapeAttr(
          row.id
        )}">🚫</button>
        <button type="button" class="abm-link-btn pedido-ia-btn" title="IA cliente" data-id="${escapeAttr(
          row.id
        )}" data-cliente-id="${escapeAttr(row.id_cliente || '')}" data-pedido="${escapeAttr(
          pedido
        )}" data-vendedora="${escapeAttr(vendedora)}" data-cliente="${escapeAttr(cliente)}">🤖</button>
      `;
  const card = document.createElement('article');
  card.className = `pedido-card${Number(row.vencido) > 0 ? ' pedido-card--alert' : ''}`;
  card.dataset.pedido = pedido;
  card.dataset.cliente = cliente;
  card.innerHTML = `
    <div class="pedido-card-header">
      <div>
        <p class="pedido-card-title">Pedido ${escapeAttr(pedido)}</p>
        <p class="pedido-card-sub">${escapeAttr(cliente)}</p>
      </div>
      <div class="pedido-card-actions">
        <button type="button" class="pedido-card-menu-toggle" aria-label="Acciones">...</button>
        <div class="pedido-card-menu">
          ${actionsHtml}
        </div>
      </div>
    </div>
    <div class="pedido-card-grid">
      <div>
        <div class="pedido-card-label">Notas</div>
        <div class="pedido-card-value"><span class="pedido-notas-badge">${notaCount}</span></div>
      </div>
      <div>
        <div class="pedido-card-label">Fecha</div>
        <div class="pedido-card-value">${escapeAttr(fecha)}</div>
      </div>
      <div>
        <div class="pedido-card-label">Vendedora</div>
        <div class="pedido-card-value">${escapeAttr(vendedora)}</div>
      </div>
      <div>
        <div class="pedido-card-label">Factura</div>
        <div class="pedido-card-value">${escapeAttr(factura)}</div>
      </div>
      <div>
        <div class="pedido-card-label">Total</div>
        <div class="pedido-card-value">${escapeAttr(total)}</div>
      </div>
      <div>
        <div class="pedido-card-label">OrdenWeb</div>
        <div class="pedido-card-value">${escapeAttr(ordenWeb)}</div>
      </div>
      <div>
        <div class="pedido-card-label">TotalWeb</div>
        <div class="pedido-card-value">${escapeAttr(totalWeb)}</div>
      </div>
      <div>
        <div class="pedido-card-label">Transporte</div>
        <div class="pedido-card-value">
          <select class="pedido-transporte-select${getPedidoSelectClass()}"${getPedidoSelectStyle()} data-id="${escapeAttr(
            row.id
          )}">${options}</select>
        </div>
      </div>
      <div>
        <div class="pedido-card-label">Instancia</div>
        <div class="pedido-card-value">
          <select class="pedido-instancia-select${getPedidoSelectClass()}"${getPedidoSelectStyle()} data-id="${escapeAttr(
            row.id
          )}" data-prev="${Number(instancia)}">${instanciaOptions}</select>
        </div>
      </div>
      <div>
        <div class="pedido-card-label">Estado</div>
        <div class="pedido-card-value">${escapeAttr(estado)}</div>
      </div>
    </div>
  `;
  return card;
}

function filterPedidoRows(rows, term) {
  const clean = String(term || '').trim();
  if (!clean) return rows;
  return rows.filter((row) =>
    textMatchesAllTokens(
      `${row.pedido || ''} ${row.cliente || ''} ${row.vendedora || ''} ${row.factura || ''} ${row.ordenWeb || ''} ${mapEstado(
        row.estado,
        row.empaquetado
      )}`,
      clean
    )
  );
}

function resetPedidoCards() {
  if (!pedidoCardsEl) return;
  pedidoCardsFilteredRows = pedidoCardsServerMode
    ? pedidoCardsRowsCache
    : filterPedidoRows(pedidoCardsRowsCache, pedidoCardsFilterTerm);
  pedidoCardsVisibleCount = 0;
  pedidoCardsEl.innerHTML = '';
  appendPedidoCards();
}

function appendPedidoCards() {
  if (!pedidoCardsEl || pedidoCardsLoading) return;
  if (pedidoCardsVisibleCount >= pedidoCardsFilteredRows.length) return;
  pedidoCardsLoading = true;
  const next = pedidoCardsFilteredRows.slice(
    pedidoCardsVisibleCount,
    pedidoCardsVisibleCount + pedidoCardsBatchSize
  );
  next.forEach((row) => {
    pedidoCardsEl.appendChild(buildPedidoCard(row));
  });
  pedidoCardsVisibleCount += next.length;
  pedidoCardsLoading = false;
}

function closePedidoCardMenus(except) {
  if (!pedidoCardsEl) return;
  pedidoCardsEl.querySelectorAll('.pedido-card-menu.open').forEach((menu) => {
    if (menu !== except) menu.classList.remove('open');
  });
}

function isMobileView() {
  return document.body.classList.contains('is-mobile');
}

function setPedidoCardsServerMode(enabled) {
  pedidoCardsServerMode = enabled;
  pedidoCardsServerStart = 0;
  pedidoCardsServerDone = false;
  pedidoCardsServerSearch = '';
  if (pedidoCardsSearchInput) pedidoCardsSearchInput.value = '';
}

async function loadPedidosTodosCards(reset = false) {
  if (!pedidoCardsServerMode || !currentPedidosTipo || !isMobileView()) return;
  if (pedidoCardsServerLoading) return;
  if (!reset && pedidoCardsServerDone) return;
  pedidoCardsServerLoading = true;
  const start = reset ? 0 : pedidoCardsServerStart;
  const searchValue = (pedidoCardsServerSearch || '').trim();
  const params = new URLSearchParams({
    tipo: currentPedidosTipo,
    start: String(start),
    length: String(50),
    'search[value]': searchValue,
  });
  try {
    const res = await fetchJSON(`/api/pedidos/todos/lista?${params.toString()}`);
    const rows = Array.isArray(res.data) ? res.data : [];
    if (reset) {
      pedidoCardsRowsCache = rows;
      resetPedidoCards();
    } else {
      pedidoCardsRowsCache = pedidoCardsRowsCache.concat(rows);
      pedidoCardsFilteredRows = pedidoCardsRowsCache;
      appendPedidoCards();
    }
    pedidoCardsServerStart = start + rows.length;
    if (rows.length < 50) pedidoCardsServerDone = true;
  } catch (error) {
    if (pedidosVendedoraListaStatus) {
      pedidosVendedoraListaStatus.textContent = error.message || 'Error al cargar pedidos.';
    }
  } finally {
    pedidoCardsServerLoading = false;
  }
}

function updatePedidoCardsVisibility() {
  const isMobile = document.body.classList.contains('is-mobile');
  const shouldShow = isMobile && (currentPedidosScope === 'vendedora' || currentPedidosScope === 'todos');
  const toolbar = pedidoCardsSearchInput?.closest('.pedido-cards-toolbar');
  if (pedidoCardsEl) pedidoCardsEl.style.display = shouldShow ? 'grid' : 'none';
  if (toolbar) toolbar.style.display = shouldShow ? 'block' : 'none';
  if (pedidosVendedoraListaTableEl) pedidosVendedoraListaTableEl.style.display = shouldShow ? 'none' : '';
  const wrapper = document.getElementById('pedidos-vendedora-lista-table_wrapper');
  if (wrapper) wrapper.style.display = shouldShow ? 'none' : '';
  if (shouldShow && pedidoCardsEl && !pedidoCardsEl.innerHTML) {
    if (pedidoCardsServerMode) {
      loadPedidosTodosCards(true);
    } else if (pedidoCardsRowsCache.length) {
      resetPedidoCards();
    }
  }
}

function normalizeTransporte(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, '');
}

function getTransporteValueForSave(value) {
  const normalized = normalizeTransporte(value);
  if (!normalized || normalized === 'sintransporte') return '';
  return String(value || '').trim();
}

function isTransporteSnapshotValido(value) {
  const normalized = normalizeTransporte(value);
  return normalized !== '' && normalized !== 'sintransporte';
}

function buildTransporteOptions(currentValue) {
  const current = normalizeTransporte(currentValue);
  const isEmpty = !current || current === 'sintransporte';
  const options = [
    `<option value="SinTransporte"${isEmpty ? ' selected' : ''}>Sin Transporte</option>`,
    ...transportesList.map((t) => {
      const value = String(t.nombre || '');
      const normalized = normalizeTransporte(value);
      const isSelected = normalized === current && !isEmpty;
      return `<option value="${escapeAttr(value)}"${isSelected ? ' selected' : ''}>${escapeAttr(
        value
      )}</option>`;
    }),
  ].join('');
  return options;
}

function getTransporteState(select) {
  if (!select) return { value: '', label: '' };
  const value = String(select.value || '').trim();
  let label = select.selectedOptions?.[0]?.textContent?.trim() || '';
  if (!label && typeof select.selectedIndex === 'number' && select.selectedIndex >= 0) {
    label = select.options?.[select.selectedIndex]?.textContent?.trim() || '';
  }
  return { value, label };
}

function getTransporteSnapshot(select) {
  if (!select) return '';
  const label = select.dataset.transporteLabel || '';
  if (label) return label;
  const options = Array.from(select.options || []);
  const selectedOption =
    options.find((opt) => opt.selected) ||
    (typeof select.selectedIndex === 'number' && select.selectedIndex >= 0
      ? select.options?.[select.selectedIndex]
      : null);
  const selectedLabel = selectedOption?.textContent?.trim() || '';
  if (selectedLabel) return selectedLabel;
  const value = select.dataset.transporte || select.value || '';
  if (value) {
    const normalized = normalizeTransporte(value);
    const match = options.find((opt) => {
      const optValue = normalizeTransporte(opt.value || '');
      const optLabel = normalizeTransporte(opt.textContent || '');
      return optValue === normalized || optLabel === normalized;
    });
    if (match?.textContent) return match.textContent.trim();
  }
  return value;
}

function isTransporteSeleccionado(select) {
  if (!select) return false;
  const idx = typeof select.selectedIndex === 'number' ? select.selectedIndex : -1;
  if (idx > 0) {
    const text = select.options?.[idx]?.textContent || '';
    const normalizedText = normalizeTransporte(text);
    return normalizedText !== '' && normalizedText !== 'sintransporte';
  }
  const { value, label } = getTransporteState(select);
  const normalized = normalizeTransporte(value || label);
  return normalized !== '' && normalized !== 'sintransporte';
}

function isTransporteValido(select, fallbackValue) {
  if (select) return isTransporteSeleccionado(select);
  return isTransporteSnapshotValido(fallbackValue || '');
}

function findTransporteSelectById(id) {
  if (!id) return null;
  const selector = `.pedido-transporte-select[data-id="${id}"]`;
  return (
    pedidosVendedoraListaTableEl?.querySelector(selector) ||
    document.querySelector(selector)
  );
}

async function savePedidoTransporte(id, transporte, select) {
  if (!id) return false;
  const rawValue = String(transporte || '').trim();
  const value = getTransporteValueForSave(rawValue);
  pedidoTransporteCache.set(Number(id), value);
  if (select) {
    select.dataset.pending = '1';
    select.dataset.transporte = rawValue;
  }
  try {
    if (pedidosVendedoraListaStatus) pedidosVendedoraListaStatus.textContent = 'Actualizando transporte...';
    const res = await fetch('/api/paqueteria/transporte', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ id, transporte: value }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || 'No se pudo actualizar transporte.');
    }
    if (pedidosVendedoraListaStatus) pedidosVendedoraListaStatus.textContent = 'Transporte actualizado.';
    if (select) {
      select.dataset.pending = '0';
      select.dataset.lastValue = value;
    }
    return true;
  } catch (error) {
    if (select) {
      select.dataset.pending = '0';
    }
    if (pedidosVendedoraListaStatus) {
      pedidosVendedoraListaStatus.textContent = error.message || 'Error al actualizar transporte.';
    }
    return false;
  }
}

async function handleAbmAction(action, articulo, detalle) {
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
    openAbmBarcode(articulo, detalle || '');
  } else if (action === 'edit') {
    openAbmEdit(articulo);
  }
}

async function loadAbmDataTable(force = false) {
  if (!abmTableBody) return;
  try {
    if (abmLoaded && !force) return;
    if (abmStatus) abmStatus.textContent = 'Cargando...';
    const res = await fetchJSON('/api/mercaderia/abm/all');
    const rows = Array.isArray(res.data) ? res.data : [];
    abmRowsCache = rows;
    if (abmCardsEl) resetAbmCards();
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
          {
            data: 'enPedido',
            render: (data, type, row) => {
              if (type !== 'display') return data;
              const value = Number(data) || 0;
              if (value <= 0) return value;
              return `
                <button type="button" class="abm-link-btn abm-pedido-link" data-articulo="${escapeAttr(row.articulo)}">
                  ${value}
                </button>
              `;
            },
          },
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
    } else {
      renderAbmTable(rows);
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
      const pedidosBtn = e.target.closest('.abm-pedido-link');
      if (pedidosBtn) {
        const articulo = pedidosBtn.dataset.articulo;
        const row = pedidosBtn.closest('tr');
        const detalle = row?.querySelector('td:nth-child(2)')?.textContent?.trim() || '';
        if (articulo) openAbmPedidos(articulo, detalle);
        return;
      }
      const btn = e.target.closest('.abm-action');
      if (!btn) return;
      const action = btn.dataset.action;
      const articulo = btn.dataset.articulo;
      const detalle = btn.dataset.detalle || '';
      await handleAbmAction(action, articulo, detalle);
    });
  }
  if (abmMobileSearchInput) {
    abmMobileSearchInput.addEventListener('input', () => {
      if (abmCardSearchTimer) clearTimeout(abmCardSearchTimer);
      abmCardSearchTimer = setTimeout(() => {
        abmCardFilterTerm = abmMobileSearchInput.value || '';
        resetAbmCards();
      }, 200);
    });
  }
  if (abmCardsEl) {
    abmCardsEl.addEventListener('click', async (e) => {
      const toggle = e.target.closest('.abm-card-menu-toggle');
      if (toggle) {
        const menu = toggle.closest('.abm-card-actions')?.querySelector('.abm-card-menu');
        if (menu) {
          const isOpen = menu.classList.contains('open');
          closeAbmCardMenus(menu);
          menu.classList.toggle('open', !isOpen);
        }
        return;
      }
      const pedidosBtn = e.target.closest('.abm-pedido-link');
      if (pedidosBtn) {
        const articulo = pedidosBtn.dataset.articulo;
        const card = pedidosBtn.closest('.abm-card');
        const detalle = card?.dataset?.detalle || '';
        if (articulo) openAbmPedidos(articulo, detalle);
        return;
      }
      const actionBtn = e.target.closest('.abm-action');
      if (actionBtn) {
        const action = actionBtn.dataset.action;
        const articulo = actionBtn.dataset.articulo;
        const detalle = actionBtn.dataset.detalle || '';
        closeAbmCardMenus();
        await handleAbmAction(action, articulo, detalle);
      }
    });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.abm-card')) closeAbmCardMenus();
    });
  }
  if (pedidoCardsSearchInput) {
    pedidoCardsSearchInput.addEventListener('input', () => {
      if (pedidoCardsSearchTimer) clearTimeout(pedidoCardsSearchTimer);
      pedidoCardsSearchTimer = setTimeout(() => {
        pedidoCardsFilterTerm = pedidoCardsSearchInput.value || '';
        if (pedidoCardsServerMode) {
          pedidoCardsServerSearch = pedidoCardsFilterTerm;
          loadPedidosTodosCards(true);
        } else {
          resetPedidoCards();
        }
      }, 200);
    });
  }
  if (pedidoCardsEl) {
    pedidoCardsEl.addEventListener('scroll', () => {
      if (pedidoCardsEl.scrollTop + pedidoCardsEl.clientHeight >= pedidoCardsEl.scrollHeight - 140) {
        if (pedidoCardsServerMode) {
          loadPedidosTodosCards(false);
        } else {
          appendPedidoCards();
        }
      }
    });
    pedidoCardsEl.addEventListener('click', async (e) => {
      const toggle = e.target.closest('.pedido-card-menu-toggle');
      if (toggle) {
        const menu = toggle.closest('.pedido-card-actions')?.querySelector('.pedido-card-menu');
        if (menu) {
          const isOpen = menu.classList.contains('open');
          closePedidoCardMenus(menu);
          menu.classList.toggle('open', !isOpen);
        }
        return;
      }
      const itemsBtn = e.target.closest('.pedido-items-btn');
      if (itemsBtn) {
        const pedido = itemsBtn.dataset.pedido;
        const vendedora = itemsBtn.dataset.vendedora || '';
        const cliente = itemsBtn.dataset.cliente || '';
        if (pedidoItemsTitle) {
          const parts = [`Pedido ${pedido}`];
          if (cliente) parts.push(cliente);
          if (vendedora) parts.push(vendedora);
          pedidoItemsTitle.textContent = parts.join(' - ');
        }
        pedidoItemsOverlay?.classList.add('open');
        loadPedidoItems(pedido);
        closePedidoCardMenus();
        return;
      }
      const notasBtn = e.target.closest('.pedido-notas-btn');
      if (notasBtn) {
        const controlId = notasBtn.dataset.id;
        const pedido = notasBtn.dataset.pedido;
        const vendedora = notasBtn.dataset.vendedora || '';
        const cliente = notasBtn.dataset.cliente || '';
        openPedidoNotas(controlId, pedido, cliente ? `${vendedora} - ${cliente}` : vendedora);
        closePedidoCardMenus();
        return;
      }
      const checkoutBtn = e.target.closest('.pedido-checkout-btn');
      if (checkoutBtn) {
        const pedido = checkoutBtn.dataset.pedido;
        const vendedora = checkoutBtn.dataset.vendedora || '';
        const cliente = checkoutBtn.dataset.cliente || '';
        if (pedidoCheckoutTitle) {
          const parts = [`Pedido ${pedido}`];
          if (cliente) parts.push(cliente);
          if (vendedora) parts.push(vendedora);
          pedidoCheckoutTitle.textContent = parts.join(' - ');
        }
        pedidoCheckoutOverlay?.classList.add('open');
        loadPedidoCheckout(pedido);
        closePedidoCardMenus();
        return;
      }
      const pagoBtn = e.target.closest('.pedido-pago-btn');
      if (pagoBtn) {
        const id = Number(pagoBtn.dataset.id);
        const current = Number(pagoBtn.dataset.pagado) || 0;
        const next = current === 1 ? 0 : 1;
        try {
          if (pedidosVendedoraListaStatus) pedidosVendedoraListaStatus.textContent = 'Actualizando pago...';
          const res = await fetch('/api/pedidos/pago', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ id, pagado: next }),
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.message || 'No se pudo actualizar pago.');
          }
          pagoBtn.dataset.pagado = String(next);
          pagoBtn.textContent = next === 1 ? '😊' : '😟';
          pagoBtn.classList.toggle('pago-ok', next === 1);
          pagoBtn.classList.toggle('pago-pendiente', next === 0);
          if (pedidosVendedoraListaStatus) pedidosVendedoraListaStatus.textContent = 'Pago actualizado.';
        } catch (error) {
          if (pedidosVendedoraListaStatus) {
            pedidosVendedoraListaStatus.textContent = error.message || 'Error al actualizar pago.';
          }
        }
        closePedidoCardMenus();
        return;
      }
      const cancelBtn = e.target.closest('.pedido-cancel-btn');
      if (cancelBtn) {
        const id = Number(cancelBtn.dataset.id);
        const card = cancelBtn.closest('.pedido-card');
        const pedido = card?.dataset?.pedido || '';
        const cliente = card?.dataset?.cliente || '';
        const label = cliente ? `${cliente} - Pedido ${pedido}` : `Pedido ${pedido || id}`;
        if (!confirm(`Cancelar ${label}?`)) return;
        try {
          if (pedidosVendedoraListaStatus) pedidosVendedoraListaStatus.textContent = 'Cancelando pedido...';
          const res = await fetch('/api/pedidos/cancelar', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ id }),
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.message || 'No se pudo cancelar pedido.');
          }
          await reloadPedidosLista();
          if (pedidosVendedoraListaStatus) pedidosVendedoraListaStatus.textContent = 'Pedido cancelado.';
        } catch (error) {
          if (pedidosVendedoraListaStatus) {
            pedidosVendedoraListaStatus.textContent = error.message || 'Error al cancelar pedido.';
          }
        }
        closePedidoCardMenus();
        return;
      }
      const entregadoBtn = e.target.closest('.pedido-entregado-btn');
      if (entregadoBtn) {
        const pedido = entregadoBtn.dataset.pedido;
        const card = entregadoBtn.closest('.pedido-card');
        const cliente = card?.dataset?.cliente || '';
        if (!pedido) return;
        const label = cliente ? `${cliente} - Pedido ${pedido}` : `Pedido ${pedido}`;
        if (!confirm(`Marcar como entregado ${label}?`)) return;
        try {
          if (pedidosVendedoraListaStatus) pedidosVendedoraListaStatus.textContent = 'Marcando entregado...';
          const res = await fetch('/api/pedidos/entregado', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ nropedido: pedido }),
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.message || 'No se pudo marcar como entregado.');
          }
          if (pedidosVendedoraListaStatus) pedidosVendedoraListaStatus.textContent = 'Pedido entregado.';
          await reloadPedidosLista();
          loadPedidosTodosSummary();
        } catch (error) {
          if (pedidosVendedoraListaStatus) {
            pedidosVendedoraListaStatus.textContent = error.message || 'Error al marcar entregado.';
          }
        }
        closePedidoCardMenus();
        return;
      }
      const iaBtn = e.target.closest('.pedido-ia-btn');
      if (iaBtn) {
        const pedido = iaBtn.dataset.pedido;
        const vendedora = iaBtn.dataset.vendedora || '';
        const cliente = iaBtn.dataset.cliente || '';
        pedidoIaControlId = Number(iaBtn.dataset.id) || null;
        pedidoIaClienteId = Number(iaBtn.dataset.clienteId) || null;
        if (pedidoIaTitle) {
          const parts = [`Pedido ${pedido}`];
          if (cliente) parts.push(cliente);
          if (vendedora) parts.push(vendedora);
          pedidoIaTitle.textContent = parts.join(' - ');
        }
        pedidoIaOverlay?.classList.add('open');
        loadPedidoIaHistory(pedidoIaControlId);
        closePedidoCardMenus();
      }
    });
    pedidoCardsEl.addEventListener('change', async (e) => {
      const select = e.target.closest('.pedido-transporte-select');
      const instanciaSelect = e.target.closest('.pedido-instancia-select');
      if (select) {
        const id = Number(select.dataset.id);
        const transporte = select.value || '';
        const label = select.options?.[select.selectedIndex]?.textContent?.trim() || '';
        select.dataset.transporteLabel = label;
        pedidoTransporteCache.set(Number(id), transporte);
        const card = select.closest('.pedido-card');
        const instanciaSelect = card?.querySelector('.pedido-instancia-select');
        if (instanciaSelect) {
          instanciaSelect.dataset.transporte = transporte;
          if (label) instanciaSelect.dataset.transporteLabel = label;
        }
        const ok = await savePedidoTransporte(id, transporte, select);
        return;
      }
      if (instanciaSelect) {
        const id = Number(instanciaSelect.dataset.id);
        const instancia = Number(instanciaSelect.value);
        if (instancia === 2) {
          const card = instanciaSelect.closest('.pedido-card');
          const transporteSelect = card?.querySelector('.pedido-transporte-select') || findTransporteSelectById(id);
          const transporteSnapshot =
            getTransporteSnapshot(transporteSelect) ||
            instanciaSelect.dataset.transporteLabel ||
            instanciaSelect.dataset.transporte ||
            '';
          if (!isTransporteSnapshotValido(transporteSnapshot)) {
            alert('Para finalizar, seleccione un transporte.');
            instanciaSelect.value = instanciaSelect.dataset.prev || '0';
            return;
          }
          if (transporteSelect) {
            const saved = await savePedidoTransporte(id, transporteSnapshot, transporteSelect);
            if (!saved) {
              alert('No se pudo guardar el transporte.');
              instanciaSelect.value = instanciaSelect.dataset.prev || '0';
              return;
            }
          }
        }
        try {
          if (pedidosVendedoraListaStatus) pedidosVendedoraListaStatus.textContent = 'Actualizando instancia...';
          const res = await fetch('/api/pedidos/instancia', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ id, instancia }),
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.message || 'No se pudo actualizar instancia.');
          }
          instanciaSelect.dataset.prev = String(instancia);
          if (pedidosVendedoraListaStatus) pedidosVendedoraListaStatus.textContent = 'Instancia actualizada.';
        } catch (error) {
          instanciaSelect.value = instanciaSelect.dataset.prev || '0';
          alert(error.message || 'Error al actualizar instancia.');
        }
      }
    });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.pedido-card')) closePedidoCardMenus();
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
  if (abmCalcOpen) abmCalcOpen.addEventListener('click', openAbmCalc);
  if (abmCalcClose) abmCalcClose.addEventListener('click', closeAbmCalc);
  if (abmCalcOverlay)
    abmCalcOverlay.addEventListener('click', (e) => {
      if (e.target === abmCalcOverlay) closeAbmCalc();
    });
  if (abmCreateCalcOpen) abmCreateCalcOpen.addEventListener('click', openAbmCreateCalc);
  if (abmCreateBtn) abmCreateBtn.addEventListener('click', openAbmCreate);
  if (abmCreateClose) abmCreateClose.addEventListener('click', closeAbmCreate);
  if (abmCreateCancel) abmCreateCancel.addEventListener('click', closeAbmCreate);
  if (abmCreateProveedorSelect) {
    abmCreateProveedorSelect.addEventListener('change', (e) => {
      loadCreateProveedorMeta(e.target.value);
    });
  }
  if (abmCreateDolaresInput)
    abmCreateDolaresInput.addEventListener('change', () => setAbmCreateModo('opcion_dolares'));
  if (abmCreatePesosInput)
    abmCreatePesosInput.addEventListener('change', () => setAbmCreateModo('opcion_pesos'));
  if (abmCreateManualInput)
    abmCreateManualInput.addEventListener('change', () => setAbmCreateModo('opcion_manual'));
  if (abmCreateForm)
    abmCreateForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (abmCreateSave) abmCreateSave.disabled = true;
      if (abmCreateStatus) abmCreateStatus.textContent = '';
      const articuloBase = (abmCreateArticuloInput?.value || '').trim();
      if (!/^\d{8}$/.test(articuloBase)) {
        if (abmCreateStatus) abmCreateStatus.textContent = 'El articulo debe tener 8 digitos.';
        if (abmCreateSave) abmCreateSave.disabled = false;
        return;
      }
      if (!abmCreateProvidersLoaded || !abmCreateProveedorSelect?.value) {
        if (abmCreateStatus) abmCreateStatus.textContent = 'Espera a que cargue el proveedor.';
        if (abmCreateSave) abmCreateSave.disabled = false;
        return;
      }
      const opcion = abmCreateManualInput?.checked
        ? 'opcion_manual'
        : abmCreatePesosInput?.checked
        ? 'opcion_pesos'
        : 'opcion_dolares';
      const payload = {
        articuloBase,
        detalle: abmCreateDetalleInput?.value || '',
        proveedorSku: abmCreateProveedorSkuInput?.value || '',
        cantidad: Number(abmCreateCantidadInput?.value) || 0,
        precioOrigen: Number(abmCreatePrecioOrigenInput?.value) || 0,
        precioConvertido: Number(abmCreatePrecioConvertidoInput?.value) || 0,
        precioManual: Number(abmCreatePrecioManualInput?.value) || 0,
        gastos: Number(abmCreateGastosInput?.value) || 0,
        ganancia: Number(abmCreateGananciaInput?.value) || 0,
        proveedor: abmCreateProveedorSelect?.value || '',
        observaciones: abmCreateObservacionesInput?.value || '',
        ordenCompra: Number(abmCreateOrdenInput?.value) || 0,
        opcion,
        paisProveedor: abmCreatePaisInput?.value || '',
        gastosProveedor: Number(abmCreateGastosProveedorInput?.value) || 0,
        gananciaProveedor: Number(abmCreateGananciaProveedorInput?.value) || 0,
      };
      try {
        if (abmCreateStatus) abmCreateStatus.textContent = 'Guardando...';
        const res = await fetch('/api/mercaderia/abm/articulo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.message || 'No se pudo crear el articulo.');
        }
        if (abmCreateStatus) abmCreateStatus.textContent = 'Articulo creado.';
        closeAbmCreate();
        loadAbmDataTable(true);
        if (abmStatus) abmStatus.textContent = `Articulo ${data?.data?.articulo || ''} creado.`;
      } catch (error) {
        if (abmCreateStatus) abmCreateStatus.textContent = error.message || 'Error al crear articulo.';
      } finally {
        if (abmCreateSave) abmCreateSave.disabled = false;
      }
    });
  if (abmBatchCalcOpen) abmBatchCalcOpen.addEventListener('click', openAbmBatchCalc);
  if (abmBatchCalcClose) abmBatchCalcClose.addEventListener('click', closeAbmBatchCalc);
  if (abmBatchCalcOverlay)
    abmBatchCalcOverlay.addEventListener('click', (e) => {
      if (e.target === abmBatchCalcOverlay) closeAbmBatchCalc();
    });
  if (abmPedidosClose) abmPedidosClose.addEventListener('click', () => abmPedidosOverlay?.classList.remove('open'));
  if (abmPedidosOverlay)
    abmPedidosOverlay.addEventListener('click', (e) => {
      if (e.target === abmPedidosOverlay) abmPedidosOverlay.classList.remove('open');
    });
  if (abmEditClose) abmEditClose.addEventListener('click', closeAbmEdit);
  if (abmEditCancel) abmEditCancel.addEventListener('click', closeAbmEdit);
  if (abmEditOverlay)
    abmEditOverlay.addEventListener('click', (e) => {
      if (e.target === abmEditOverlay) closeAbmEdit();
    });
  if (abmDolaresInput) abmDolaresInput.addEventListener('change', () => setAbmModo('opcion_dolares'));
  if (abmPesosInput) abmPesosInput.addEventListener('change', () => setAbmModo('opcion_pesos'));
  if (abmManualInput) abmManualInput.addEventListener('change', () => setAbmModo('opcion_manual'));
  if (abmProveedorSelect)
    abmProveedorSelect.addEventListener('change', (e) => {
      loadProveedorMeta(e.target.value);
    });
  if (abmNewBtn) abmNewBtn.addEventListener('click', openAbmBatch);
  if (abmBatchClose) abmBatchClose.addEventListener('click', closeAbmBatch);
  if (abmBatchSearchBtn) abmBatchSearchBtn.addEventListener('click', openAbmPick);
  if (abmPickClose) abmPickClose.addEventListener('click', closeAbmPick);
  if (abmPickOverlay)
    abmPickOverlay.addEventListener('click', (e) => {
      if (e.target === abmPickOverlay) closeAbmPick();
    });
  if (abmBatchDolaresInput) abmBatchDolaresInput.addEventListener('change', () => setAbmBatchModo('opcion_dolares'));
  if (abmBatchPesosInput) abmBatchPesosInput.addEventListener('change', () => setAbmBatchModo('opcion_pesos'));
  if (abmBatchManualInput) abmBatchManualInput.addEventListener('change', () => setAbmBatchModo('opcion_manual'));
  if (abmBatchProveedorSelect)
    abmBatchProveedorSelect.addEventListener('change', (e) => {
      loadBatchProveedorMeta(e.target.value);
    });
  if (abmBatchForm)
    abmBatchForm.addEventListener('submit', (e) => {
      e.preventDefault();
    });
  if (abmPickTableEl)
    abmPickTableEl.addEventListener('click', async (e) => {
      const btn = e.target.closest('.abm-pick-add');
      if (!btn) return;
      const articulo = btn.dataset.articulo;
      if (!articulo) return;
      try {
        const res = await fetchJSON(`/api/mercaderia/abm/articulo?articulo=${encodeURIComponent(articulo)}`);
        setBatchFormFromArticulo(res.data || {});
        if (abmBatchFormStatus) abmBatchFormStatus.textContent = '';
        closeAbmPick();
        if (abmBatchCantidadInput) {
          abmBatchCantidadInput.focus();
          abmBatchCantidadInput.select();
        }
      } catch (error) {
        if (abmPickStatus) abmPickStatus.textContent = error.message || 'No se pudo cargar articulo';
      }
    });
  if (abmBatchAdd)
    abmBatchAdd.addEventListener('click', () => {
      if (!abmBatchCurrentArticulo) {
        if (abmBatchFormStatus) abmBatchFormStatus.textContent = 'Selecciona un articulo.';
        return;
      }
      if (!abmBatchProvidersLoaded || !abmBatchProveedorSelect?.value) {
        if (abmBatchFormStatus) abmBatchFormStatus.textContent = 'Espera a que cargue el proveedor.';
        return;
      }
      const opcion = abmBatchDolaresInput?.checked
        ? 'opcion_dolares'
        : abmBatchPesosInput?.checked
          ? 'opcion_pesos'
          : 'opcion_manual';
      const item = {
        articulo: abmBatchCurrentArticulo,
        detalle: abmBatchDetalleInput?.value || '',
        cantidadActual: Number(abmBatchCantidadActualInput?.value) || 0,
        cantidadDelta: Number(abmBatchCantidadInput?.value) || 0,
        resta: !!abmBatchRestaInput?.checked,
        precioOrigen: Number(abmBatchPrecioOrigenInput?.value) || 0,
        precioConvertido: Number(abmBatchPrecioConvertidoInput?.value) || 0,
        precioManual: Number(abmBatchPrecioManualInput?.value) || 0,
        gastos: Number(abmBatchGastosInput?.value) || 0,
        ganancia: Number(abmBatchGananciaInput?.value) || 0,
        proveedor: abmBatchProveedorSelect?.value || '',
        observaciones: abmBatchObservacionesInput?.value || '',
        opcion,
        paisProveedor: abmBatchPaisInput?.value || '',
        gastosProveedor: Number(abmBatchGastosProveedorInput?.value) || 0,
        gananciaProveedor: Number(abmBatchGananciaProveedorInput?.value) || 0,
      };
      upsertBatchItem(item);
      clearAbmBatchForm();
      abmBatchEditingId = null;
      if (abmBatchFormStatus) abmBatchFormStatus.textContent = 'Agregado.';
    });
  if (abmBatchCantidadInput)
    abmBatchCantidadInput.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Enter') return;
      ev.preventDefault();
      if (abmBatchAdd && !abmBatchAdd.disabled) abmBatchAdd.click();
    });
  if (abmBatchTableEl)
    abmBatchTableEl.addEventListener('click', (e) => {
      const editBtn = e.target.closest('.abm-batch-edit');
      const delBtn = e.target.closest('.abm-batch-remove');
      if (editBtn) {
        const batchId = Number(editBtn.dataset.batchId || 0);
        const item = abmBatchItems.find((row) => row._batchId === batchId);
        if (item) {
          abmBatchEditingId = batchId;
          setBatchFormFromItem(item);
        }
      } else if (delBtn) {
        const batchId = Number(delBtn.dataset.batchId || 0);
        removeBatchItem(batchId);
      }
    });
  if (abmBatchSubmit)
    abmBatchSubmit.addEventListener('click', async () => {
      const items = getBatchItemsArray();
      if (!items.length) {
        if (abmBatchStatus) abmBatchStatus.textContent = 'No hay articulos para modificar.';
        return;
      }
      if (abmBatchSubmit) abmBatchSubmit.disabled = true;
      if (abmBatchStatus) abmBatchStatus.textContent = 'Guardando...';
      try {
        const res = await fetch('/api/mercaderia/abm/batch', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ordenCompra: Number(abmBatchOrdenInput?.value) || 0,
            items,
          }),
        });
        if (!res.ok) {
          const errText = await res.text().catch(() => '');
          throw new Error(errText || `Error ${res.status}`);
        }
        const data = await res.json();
        if (abmBatchStatus) abmBatchStatus.textContent = 'Operacion completada.';
        if (abmDataTable && Array.isArray(data?.data)) {
          data.data.forEach((row) => {
            abmDataTable.rows().every(function updateRow() {
              const current = this.data();
              if (String(current.articulo) === String(row.articulo)) {
                this.data({ ...current, ...row });
              }
            });
          });
          abmDataTable.draw(false);
        }
        if (abmBatchOrdenInput) {
          const currentOrden = Number(abmBatchOrdenInput.value) || 0;
          abmBatchOrdenInput.value = currentOrden + 1;
        }
        abmBatchItems = [];
        abmBatchEditingId = null;
        renderBatchTable();
        clearAbmBatchForm();
      } catch (error) {
        if (abmBatchStatus) abmBatchStatus.textContent = error.message || 'Error al guardar.';
      } finally {
        if (abmBatchSubmit) abmBatchSubmit.disabled = false;
      }
    });
  if (abmEditForm)
    abmEditForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!abmCurrentArticulo) return;
      if (!abmProvidersLoaded || !abmProveedorSelect?.value) {
        if (abmEditStatus) abmEditStatus.textContent = 'Espera a que cargue el proveedor.';
        return;
      }
      const opcion = abmDolaresInput?.checked
        ? 'opcion_dolares'
        : abmPesosInput?.checked
          ? 'opcion_pesos'
          : 'opcion_manual';
      const payload = {
        detalle: abmDetalleInput?.value || '',
        cantidadDelta: Number(abmCantidadInput?.value) || 0,
        resta: !!abmRestaInput?.checked,
        precioOrigen: Number(abmPrecioOrigenInput?.value) || 0,
        precioConvertido: Number(abmPrecioConvertidoInput?.value) || 0,
        precioManual: Number(abmPrecioManualInput?.value) || 0,
        gastos: Number(abmGastosInput?.value) || 0,
        ganancia: Number(abmGananciaInput?.value) || 0,
        proveedor: abmProveedorSelect?.value || '',
        observaciones: abmObservacionesInput?.value || '',
        ordenCompra: Number(abmOrdenInput?.value) || 0,
        opcion,
        paisProveedor: abmPaisInput?.value || '',
        gastosProveedor: Number(abmGastosProveedorInput?.value) || 0,
        gananciaProveedor: Number(abmGananciaProveedorInput?.value) || 0,
      };
      try {
        if (abmEditStatus) abmEditStatus.textContent = 'Guardando...';
        const res = await fetch(`/api/mercaderia/abm/articulo/${encodeURIComponent(abmCurrentArticulo)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const errText = await res.text().catch(() => '');
          throw new Error(errText || `Error ${res.status}`);
        }
        const data = await res.json();
        if (abmEditStatus) abmEditStatus.textContent = 'Actualizado';
        if (abmDataTable && data?.data) {
          abmDataTable.rows().every(function updateRow() {
            const row = this.data();
            if (String(row.articulo) === String(data.data.articulo)) {
              this.data({ ...row, ...data.data });
            }
          });
          abmDataTable.draw(false);
        }
        closeAbmEdit();
      } catch (error) {
        if (abmEditStatus) abmEditStatus.textContent = error.message || 'No se pudo guardar';
      }
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
  const response = await fetch(url, { credentials: 'include' });
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
  const pendientes = data.pendientes ?? 0;
  const sinTransporte = data.sinTransporte ?? 0;
  const vencidos = data.vencidos ?? 0;

  statPendientes.textContent = pendientes;
  statSinTransporte.textContent = sinTransporte;
  statVencidos.textContent = vencidos;

  if (statPendientesControl) statPendientesControl.textContent = pendientes;
  if (statSinTransporteControl) statSinTransporteControl.textContent = sinTransporte;
  if (statVencidosControl) statVencidosControl.textContent = vencidos;
}

function renderCarritosAbandonados(data) {
  const sinAsignar = data.sinAsignar ?? 0;
  const pendientes = data.pendientes ?? 0;
  const sinNotas = data.sinNotas ?? 0;
  const sinAsignarVencidos = data.sinAsignarVencidos ?? 0;

  if (statCarritosSinAsignar) statCarritosSinAsignar.textContent = sinAsignar;
  if (statCarritosPendientes) statCarritosPendientes.textContent = pendientes;
  if (statCarritosSinNotas) statCarritosSinNotas.textContent = sinNotas;
  if (statCarritosSinAsignarCard) {
    statCarritosSinAsignarCard.classList.toggle('alert', sinAsignarVencidos > 0);
  }
}

function formatCarritosFecha(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().slice(0, 10);
}

function buildWhatsappLink(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  return `https://wa.me/${digits}`;
}

async function ensureCarritosVendedoras() {
  if (carritosVendedorasLoaded) return;
  if (carritosVendedorasLoading) return carritosVendedorasLoading;
  carritosVendedorasLoading = (async () => {
    try {
      const res = await fetchJSON('/api/carritos-abandonados/vendedoras');
      const rows = Array.isArray(res.data) ? res.data : [];
      carritosVendedoras = rows.map((row) => row.nombre).filter(Boolean);
    } catch (error) {
      carritosVendedoras = [];
      console.error(error);
    } finally {
      if (!carritosVendedoras.includes('PAGINA')) carritosVendedoras.unshift('PAGINA');
      carritosVendedorasLoaded = true;
      carritosVendedorasLoading = null;
    }
  })();
  return carritosVendedorasLoading;
}

function buildVendedoraOptions(selected) {
  if (!carritosVendedoras.length) return '';
  const selectedValue = String(selected || '').trim();
  const selectedKey = selectedValue.toLowerCase();
  let hasMatch = false;

  const options = carritosVendedoras.map((name) => {
    const value = String(name || '').trim();
    const isSelected = value.toLowerCase() === selectedKey;
    if (isSelected) hasMatch = true;
    return `<option value="${escapeAttr(value)}"${isSelected ? ' selected' : ''}>${escapeAttr(value)}</option>`;
  });

  if (selectedValue && !hasMatch) {
    options.unshift(
      `<option value="${escapeAttr(selectedValue)}" selected>${escapeAttr(selectedValue)}</option>`
    );
  }

  return options.join('');
}

function renderCarritosTable(rows) {
  if (!carritosTableEl) return;
  const data = rows.map((row) => ({
    id: row.id,
    contacto: row.nombre_contacto || '',
    vendedora: row.vendedora || '',
    celular: row.cel_contacto || '',
    total: row.total ?? '',
    email: row.email_contacto || '',
    fecha: row.fecha || '',
    notas: Number(row.notas_count) || 0,
  }));

  if (carritosTable) {
    carritosTable.clear();
    carritosTable.rows.add(data);
    carritosTable.draw();
    return;
  }

  carritosTable = new DataTable('#carritos-table', {
    data,
    pageLength: 10,
    columns: [
      { data: 'contacto' },
      {
        data: 'vendedora',
        render: (_val, _type, row) => {
          const options = buildVendedoraOptions(row.vendedora);
          if (!options) return escapeAttr(row.vendedora || '');
          return `<select class="carritos-vendedora-select" data-id="${row.id}">${options}</select>`;
        },
      },
      {
        data: 'celular',
        render: (val) => {
          const link = buildWhatsappLink(val);
          if (!link) return '';
          return `<a href="${escapeAttr(link)}" target="_blank" rel="noopener">${escapeAttr(val)}</a>`;
        },
      },
      { data: 'total' },
      { data: 'email' },
      {
        data: 'fecha',
        render: (val) => escapeAttr(formatCarritosFecha(val)),
      },
      {
        data: 'notas',
        orderable: false,
        render: (_val, _type, row) =>
          `<button type="button" class="abm-link-btn carritos-notas-btn" data-id="${row.id}">📖 ${row.notas}</button>`,
      },
      {
        data: 'id',
        orderable: false,
        render: (val) =>
          `<button type="button" class="abm-link-btn carritos-cerrar-btn" data-id="${val}">✔</button>`,
      },
    ],
    language: {
      search: 'Buscar:',
      lengthMenu: 'Mostrar _MENU_',
      info: 'Mostrando _START_ a _END_ de _TOTAL_',
      infoEmpty: 'Sin resultados',
      emptyTable: 'Sin carritos.',
      paginate: {
        first: 'Primero',
        last: 'Ultimo',
        next: 'Siguiente',
        previous: 'Anterior',
      },
    },
  });
}

async function loadCarritosLista(tipo) {
  try {
    if (carritosStatus) carritosStatus.textContent = 'Cargando...';
    const res = await fetchJSON(`/api/carritos-abandonados/lista?tipo=${encodeURIComponent(tipo)}`);
    carritosRows = res.data || [];
    renderCarritosTable(carritosRows);
    if (carritosStatus) {
      carritosStatus.textContent = carritosRows.length
        ? `Carritos: ${carritosRows.length}`
        : 'Sin resultados.';
    }
  } catch (error) {
    if (carritosStatus) {
      carritosStatus.textContent = error.message || 'Error al cargar carritos.';
    }
    console.error(error);
  }
}

async function openCarritosModal(tipo) {
  if (!carritosOverlay) return;
  carritosCurrentTipo = tipo;
  const titleMap = {
    sinAsignar: 'Sin asignar',
    pendientes: 'Pendientes',
    sinNotas: 'Sin notas',
  };
  if (carritosTitle) {
    carritosTitle.textContent = `Carritos Abandonados - ${titleMap[tipo] || ''}`;
  }
  carritosOverlay.classList.add('open');
  await ensureCarritosVendedoras();
  loadCarritosLista(tipo);
}

function resolveNotaFecha(row) {
  return row.fecha || row.Fecha || row.created_at || row.updated_at || '';
}

function resolveNotaTexto(row) {
  return row.notas || row.nota || row.comentario || row.texto || '';
}

function resolveNotaVendedora(row) {
  return row.vendedora || row.usuario || row.user || '';
}

function renderCarritosNotas(rows) {
  if (!carritosNotasList) return;
  carritosNotasList.innerHTML = '';
  if (!rows.length) {
    const empty = document.createElement('p');
    empty.className = 'status';
    empty.textContent = 'Sin notas.';
    carritosNotasList.appendChild(empty);
    return;
  }
  rows.forEach((row) => {
    const note = document.createElement('div');
    note.className = 'carritos-nota';
    if (carritosNotasEditingId && Number(row.id) === carritosNotasEditingId) {
      note.classList.add('active');
    }
    note.dataset.id = row.id;
    note.dataset.text = resolveNotaTexto(row);
    const fecha = resolveNotaFecha(row);
    note.innerHTML = `
      <div class="meta">
        ${escapeAttr(resolveNotaVendedora(row))} · ${escapeAttr(formatDateTime(fecha))}
      </div>
      <div class="text"><strong>Comentario:</strong> ${escapeAttr(resolveNotaTexto(row))}</div>
    `;
    carritosNotasList.appendChild(note);
  });
}

async function loadCarritosNotas(id) {
  try {
    if (carritosNotasStatus) carritosNotasStatus.textContent = 'Cargando...';
    const res = await fetchJSON(`/api/carritos-abandonados/${encodeURIComponent(id)}/notas`);
    const rows = Array.isArray(res.data) ? res.data : [];
    const sorted = rows.sort((a, b) => {
      const fa = new Date(resolveNotaFecha(a)).getTime() || 0;
      const fb = new Date(resolveNotaFecha(b)).getTime() || 0;
      if (fb !== fa) return fb - fa;
      return Number(b.id || 0) - Number(a.id || 0);
    });
    renderCarritosNotas(sorted);
    if (carritosNotasStatus) {
      carritosNotasStatus.textContent = sorted.length ? `Notas: ${sorted.length}` : '';
    }
  } catch (error) {
    if (carritosNotasStatus) carritosNotasStatus.textContent = error.message || 'Error al cargar notas.';
    console.error(error);
  }
}

function openCarritosNotas(id, contacto) {
  if (!carritosNotasOverlay) return;
  carritosNotasCurrentId = Number(id) || null;
  carritosNotasEditingId = null;
  if (carritosNotasInput) carritosNotasInput.value = '';
  if (carritosNotasTitle) {
    carritosNotasTitle.textContent = contacto
      ? `Notas - ${contacto}`
      : 'Notas';
  }
  carritosNotasOverlay.classList.add('open');
  loadCarritosNotas(carritosNotasCurrentId);
}

async function saveCarritosNota() {
  if (!carritosNotasCurrentId) return;
  const nota = carritosNotasInput?.value?.trim() || '';
  if (!nota) {
    if (carritosNotasStatus) carritosNotasStatus.textContent = 'Escribe una nota.';
    return;
  }
  try {
    if (carritosNotasSave) carritosNotasSave.disabled = true;
    if (carritosNotasStatus) carritosNotasStatus.textContent = 'Guardando...';
    if (carritosNotasEditingId) {
      await fetch(`/api/carritos-abandonados/notas/${encodeURIComponent(carritosNotasEditingId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ nota }),
      });
    } else {
      await fetch(`/api/carritos-abandonados/${encodeURIComponent(carritosNotasCurrentId)}/notas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ nota }),
      });
    }
    carritosNotasEditingId = null;
    if (carritosNotasInput) carritosNotasInput.value = '';
    await loadCarritosNotas(carritosNotasCurrentId);
    await loadCarritosLista(carritosCurrentTipo);
    if (carritosNotasStatus) carritosNotasStatus.textContent = 'Guardado.';
  } catch (error) {
    if (carritosNotasStatus) carritosNotasStatus.textContent = error.message || 'Error al guardar nota.';
    console.error(error);
  } finally {
    if (carritosNotasSave) carritosNotasSave.disabled = false;
  }
}

async function cerrarCarrito(id) {
  if (!id) return;
  const confirmed = confirm('¿Cerrar este carrito?');
  if (!confirmed) return;
  try {
    if (carritosStatus) carritosStatus.textContent = 'Cerrando...';
    const res = await fetch(`/api/carritos-abandonados/${encodeURIComponent(id)}/cerrar`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || 'No se pudo cerrar el carrito.');
    }
    await loadCarritosLista(carritosCurrentTipo);
    if (carritosStatus) carritosStatus.textContent = 'Carrito cerrado.';
  } catch (error) {
    if (carritosStatus) carritosStatus.textContent = error.message || 'Error al cerrar carrito.';
    console.error(error);
  }
}

async function updateCarritoVendedora(id, vendedora) {
  if (!id || !vendedora) return;
  try {
    if (carritosStatus) carritosStatus.textContent = 'Actualizando vendedora...';
    const res = await fetch(`/api/carritos-abandonados/${encodeURIComponent(id)}/vendedora`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ vendedora }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || 'No se pudo actualizar la vendedora.');
    }
    await loadCarritosAbandonados();
    await loadCarritosLista(carritosCurrentTipo);
    if (carritosStatus) carritosStatus.textContent = 'Vendedora actualizada.';
  } catch (error) {
    if (carritosStatus) carritosStatus.textContent = error.message || 'Error al actualizar vendedora.';
    console.error(error);
  }
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

function parseSqlDateLocal(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const str = String(value).trim();
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (match) {
    const y = Number(match[1]);
    const m = Number(match[2]) - 1;
    const d = Number(match[3]);
    const hh = Number(match[4] || 0);
    const mm = Number(match[5] || 0);
    const ss = Number(match[6] || 0);
    return new Date(y, m, d, hh, mm, ss);
  }
  const parsed = new Date(str);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function formatDate(dateStr) {
  const d = parseSqlDateLocal(dateStr);
  if (!d) return dateStr || '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function formatDateTime(dateStr) {
  const d = parseSqlDateLocal(dateStr);
  if (!d) return dateStr || '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

function formatDateLong(dateStr) {
  const d = parseSqlDateLocal(dateStr);
  if (!d) return dateStr || '';
  try {
    return new Intl.DateTimeFormat('es-AR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(d);
  } catch (error) {
    return formatDate(d);
  }
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
  const d = parseSqlDateLocal(value);
  if (!d) return value || '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
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
    setStatus(statusPaqueteriaControl, 'Cargando...');
    const res = await fetchJSON('/api/paqueteria');
    renderPaqueteria(res);
    const stamp = formatDateTimeLocalShort(new Date());
    setStatus(statusPaqueteria, `Actualizado: ${stamp}`);
    setStatus(statusPaqueteriaControl, `Actualizado: ${stamp}`);
  } catch (error) {
    if (USE_SAMPLE_FALLBACK) {
      renderPaqueteria(samplePaqueteria);
      setStatus(statusPaqueteria, 'Usando datos de ejemplo (sin conexión a la base).', true);
      setStatus(statusPaqueteriaControl, 'Usando datos de ejemplo (sin conexión a la base).', true);
    } else {
      setStatus(
        statusPaqueteria,
        'Error cargando empaquetados. Revisa conexión al servidor/base.',
        true
      );
      setStatus(
        statusPaqueteriaControl,
        'Error cargando empaquetados. Revisa conexión al servidor/base.',
        true
      );
    }
    console.error(error);
  }
}

async function loadCarritosAbandonados() {
  try {
    setStatus(statusCarritosControl, 'Cargando...');
    const res = await fetchJSON('/api/carritos-abandonados');
    renderCarritosAbandonados(res);
    const stamp = formatDateTimeLocalShort(new Date());
    setStatus(statusCarritosControl, `Actualizado: ${stamp}`);
  } catch (error) {
    setStatus(
      statusCarritosControl,
      'Error cargando carritos abandonados. Revisa conexión al servidor/base.',
      true
    );
    console.error(error);
  }
}

function renderPedidosControl(rows) {
  if (!pedidosControlTableBody) return;
  const sorted = [...rows].sort((a, b) => {
    const key = pedidosControlSort.key;
    const dir = pedidosControlSort.dir === 'desc' ? -1 : 1;
    if (key === 'vendedora') {
      return dir * String(a.vendedora || '').localeCompare(String(b.vendedora || ''));
    }
    const aVal = Number(a[key]) || 0;
    const bVal = Number(b[key]) || 0;
    return dir * (aVal - bVal);
  });

  pedidosControlTableBody.innerHTML = '';
  sorted.forEach((row) => {
    const tr = document.createElement('tr');
    const notasVencidosProceso = Number(row.notasVencidosEnProceso) || 0;
    const notasVencidosFactura = Number(row.notasVencidosParaFacturar) || 0;
    const procesoAlert = notasVencidosProceso > 0;
    const facturaAlert = notasVencidosFactura > 0;

    tr.innerHTML = `
      <td class="pedidos-vendedora-cell">${escapeAttr(row.vendedora || '')}</td>
      <td class="${procesoAlert ? 'cell-alert' : ''}">${row.enProceso ?? 0}</td>
      <td class="${facturaAlert ? 'cell-alert' : ''}">${row.paraFacturar ?? 0}</td>
    `;
    pedidosControlTableBody.appendChild(tr);
  });
  updateSortIndicators(pedidosControlTableHead, pedidosControlSort);
}

async function loadPedidosControl() {
  try {
    if (pedidosControlStatus) pedidosControlStatus.textContent = 'Cargando...';
    const res = await fetchJSON('/api/panel-control/pedidos');
    pedidosControlRows = Array.isArray(res.data) ? res.data : [];
    renderPedidosControl(pedidosControlRows);
    if (pedidosControlStatus) {
      const stamp = formatDateTimeLocalShort(new Date());
      pedidosControlStatus.textContent = pedidosControlRows.length
        ? `Vendedoras: ${pedidosControlRows.length} · ${stamp}`
        : `Sin resultados. · ${stamp}`;
    }
  } catch (error) {
    if (pedidosControlStatus) {
      pedidosControlStatus.textContent = error.message || 'Error al cargar pedidos.';
    }
    console.error(error);
  }
}

function initGaugeSegments(gaugeEl) {
  const redLimit = Number(gaugeEl.dataset.red) || 15;
  const yellowLimit = Number(gaugeEl.dataset.yellow) || 25;
  const redSeg = gaugeEl.querySelector('.seg-red');
  const yellowSeg = gaugeEl.querySelector('.seg-yellow');
  const greenSeg = gaugeEl.querySelector('.seg-green');
  if (redSeg) {
    redSeg.style.strokeDasharray = `${redLimit} ${100 - redLimit}`;
    redSeg.style.strokeDashoffset = '0';
  }
  if (yellowSeg) {
    const span = Math.max(0, yellowLimit - redLimit);
    yellowSeg.style.strokeDasharray = `${span} ${100 - span}`;
    yellowSeg.style.strokeDashoffset = `-${redLimit}`;
  }
  if (greenSeg) {
    const span = Math.max(0, 100 - yellowLimit);
    greenSeg.style.strokeDasharray = `${span} ${100 - span}`;
    greenSeg.style.strokeDashoffset = `-${yellowLimit}`;
  }
}

function initGaugeTicks(gaugeEl) {
  const svg = gaugeEl.querySelector('.gauge-svg');
  if (!svg || svg.dataset.ticksReady === 'true') return;
  const cx = 90;
  const cy = 90;
  const rOuter = 80;
  const rInner = 70;
  for (let i = 0; i <= 10; i += 1) {
    const angle = Math.PI - (i / 10) * Math.PI;
    const x1 = cx + rOuter * Math.cos(angle);
    const y1 = cy - rOuter * Math.sin(angle);
    const x2 = cx + rInner * Math.cos(angle);
    const y2 = cy - rInner * Math.sin(angle);
    const tick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    tick.setAttribute('x1', x1.toFixed(2));
    tick.setAttribute('y1', y1.toFixed(2));
    tick.setAttribute('x2', x2.toFixed(2));
    tick.setAttribute('y2', y2.toFixed(2));
    tick.setAttribute('class', 'gauge-tick');
    svg.appendChild(tick);
  }
  svg.dataset.ticksReady = 'true';
}

function setGaugeValue(gaugeEl, value) {
  const max = Number(gaugeEl.dataset.max) || 100;
  const redLimit = Number(gaugeEl.dataset.red) || 15;
  const yellowLimit = Number(gaugeEl.dataset.yellow) || 25;
  const displayVal = Number(value) || 0;
  const percent = max > 0 ? Math.min(100, (displayVal / max) * 100) : 0;
  const needle = gaugeEl.querySelector('.gauge-needle');
  if (needle) {
    const angle = Math.PI - (percent / 100) * Math.PI;
    const cx = 90;
    const cy = 90;
    const r = 64;
    const x2 = cx + r * Math.cos(angle);
    const y2 = cy - r * Math.sin(angle);
    needle.setAttribute('x1', cx);
    needle.setAttribute('y1', cy);
    needle.setAttribute('x2', x2.toFixed(2));
    needle.setAttribute('y2', y2.toFixed(2));
    if (displayVal <= redLimit) {
      needle.style.stroke = '#ef4444';
    } else if (displayVal <= yellowLimit) {
      needle.style.stroke = '#f59e0b';
    } else {
      needle.style.stroke = '#22c55e';
    }
  }
  const numberEl = gaugeEl.querySelector('.gauge-number');
  if (numberEl) numberEl.textContent = displayVal;
}

function renderOperativos(data) {
  const gauges = document.querySelectorAll('#operativos-gauges .gauge');
  if (gauges.length) {
    gauges.forEach((gauge) => {
      initGaugeSegments(gauge);
      initGaugeTicks(gauge);
    });
  }
  const ventasGauge = document.querySelector('#gauge-ventas-salon')?.closest('.gauge');
  const facturadosGauge = document.querySelector('#gauge-pedidos-facturados')?.closest('.gauge');
  const pasadosGauge = document.querySelector('#gauge-pedidos-pasados')?.closest('.gauge');
  if (ventasGauge) setGaugeValue(ventasGauge, data.ventasSalon);
  if (facturadosGauge) setGaugeValue(facturadosGauge, data.pedidosFacturados);
  if (pasadosGauge) setGaugeValue(pasadosGauge, data.pedidosPasados);
  if (pedidosPendientesCount) pedidosPendientesCount.textContent = data.pedidosPendientes ?? 0;
  if (pedidosPasadosCount) pedidosPasadosCount.textContent = data.pedidosPasados ?? 0;
}

async function loadOperativos() {
  try {
    if (operativosStatus) operativosStatus.textContent = 'Cargando...';
    const res = await fetchJSON('/api/panel-control/contadores');
    renderOperativos(res);
    if (operativosStatus) {
      const stamp = formatDateTimeLocalShort(new Date());
      operativosStatus.textContent = `Fecha: ${res.desde.split(' ')[0]} · ${stamp}`;
    }
  } catch (error) {
    if (operativosStatus) {
      operativosStatus.textContent = error.message || 'Error al cargar contadores.';
    }
  }
}

function renderPedidosTodosSummary(data) {
  if (pedidosTodosFacturados) pedidosTodosFacturados.textContent = data.facturados ?? 0;
  if (pedidosTodosProceso) pedidosTodosProceso.textContent = data.enProceso ?? 0;
  if (pedidosTodosPagados) pedidosTodosPagados.textContent = data.pagados ?? 0;
  if (pedidosTodosEmpaquetados) pedidosTodosEmpaquetados.textContent = data.empaquetados ?? 0;
  if (pedidosTodosCancelados) pedidosTodosCancelados.textContent = data.cancelados ?? 0;
  if (pedidosTodosTotal) pedidosTodosTotal.textContent = data.todos ?? 0;
}

async function loadPedidosTodosSummary() {
  try {
    if (pedidosTodosStatus) pedidosTodosStatus.textContent = 'Cargando...';
    const res = await fetchJSON('/api/pedidos/todos/resumen');
    renderPedidosTodosSummary(res.data || {});
    if (pedidosTodosStatus) {
      const stamp = formatDateTimeLocalShort(new Date());
      pedidosTodosStatus.textContent = `Actualizado: ${stamp}`;
    }
  } catch (error) {
    if (pedidosTodosStatus) {
      pedidosTodosStatus.textContent = error.message || 'Error al cargar resumen.';
    }
  }
}

let panelControlAutoRefresh = null;

function formatDateTimeLocalShort(dateObj) {
  const yyyy = dateObj.getFullYear();
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
  const dd = String(dateObj.getDate()).padStart(2, '0');
  const hh = String(dateObj.getHours()).padStart(2, '0');
  const mi = String(dateObj.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

function startPanelControlAutoRefresh() {
  if (panelControlAutoRefresh) return;
  panelControlAutoRefresh = setInterval(() => {
    if (!viewPanelControl || viewPanelControl.classList.contains('hidden')) return;
    loadCarritosAbandonados();
    loadPedidosControl();
    loadOperativos();
    if (pedidosVendedoraActual) {
      loadPedidosVendedora(pedidosVendedoraActual);
    }
  }, 60000);
}

function renderPedidosVendedora(data) {
  if (!pedidosVendedoraTableBody) return;
  const row = data || {};
  pedidosVendedoraTableBody.innerHTML = `
    <tr>
      <td class="pedidos-vendedora-count" data-tipo="asignados">${row.asignados ?? 0}</td>
      <td class="pedidos-vendedora-count" data-tipo="empaquetados">${row.empaquetados ?? 0}</td>
      <td class="pedidos-vendedora-count" data-tipo="enProceso">${row.enProceso ?? 0}</td>
      <td class="pedidos-vendedora-count" data-tipo="paraFacturar">${row.paraFacturar ?? 0}</td>
    </tr>
  `;
}

async function loadPedidosVendedora(vendedora) {
  if (!vendedora) return;
  try {
    if (pedidosVendedoraStatus) pedidosVendedoraStatus.textContent = 'Cargando...';
    const res = await fetchJSON(`/api/panel-control/pedidos/${encodeURIComponent(vendedora)}`);
    pedidosVendedoraActual = vendedora;
    renderPedidosVendedora(res.data);
    if (pedidosVendedoraStatus) pedidosVendedoraStatus.textContent = '';
  } catch (error) {
    if (pedidosVendedoraStatus) {
      pedidosVendedoraStatus.textContent = error.message || 'Error al cargar pedidos.';
    }
    console.error(error);
  }
}

function renderPedidosVendedoraLista(rows) {
  if (!pedidosVendedoraListaTableEl) return;
  if (pedidosListaServerSide && pedidosVendedoraListaTable) {
    pedidosVendedoraListaTable.destroy();
    pedidosVendedoraListaTable = null;
    pedidosListaServerSide = false;
    pedidosVendedoraListaTableEl.innerHTML = '';
  }
  if (!transportesList.length) loadTransportes();
  const data = rows.map((row) => ({
    id: row.id,
    pedido: row.nropedido,
    cliente: row.cliente || '',
    fecha: row.fecha || '',
    vendedora: row.vendedora || '',
    factura: row.nrofactura || '',
    total: row.total ?? '',
    ordenWeb: row.ordenweb || '',
    totalWeb: row.totalweb ?? '',
    transporte: row.transporte || '',
    instancia: row.instancia ?? '',
    estado: row.estado ?? '',
    empaquetado: row.empaquetado ?? '',
    vencido: row.vencido ?? 0,
    id_cliente: row.id_cliente,
    pagado: row.pagado ?? 0,
    notasCount: Number(row.notas_count) || 0,
  }));
  data.forEach((row) => {
    if (row?.id) pedidoTransporteCache.set(Number(row.id), row.transporte || '');
  });

  pedidoCardsRowsCache = data;
  setPedidoCardsServerMode(false);
  if (pedidoCardsEl) resetPedidoCards();
  updatePedidoCardsVisibility();

  if (pedidosVendedoraListaTable) {
    pedidosVendedoraListaTable.clear();
    pedidosVendedoraListaTable.rows.add(data);
    pedidosVendedoraListaTable.order([[0, 'desc']]).draw();
    return;
  }

  pedidosVendedoraListaTableEl.innerHTML = `
    <thead>
      <tr>
        <th>Pedido</th>
        <th>Cliente</th>
        <th>Fecha</th>
        <th>Vendedora</th>
        <th>Factura</th>
        <th>Total</th>
        <th>OrdenWeb</th>
        <th>TotalWeb</th>
        <th>Transporte</th>
        <th>Instancia</th>
        <th>Estado</th>
        <th>Accion</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  pedidosVendedoraListaTable = new DataTable('#pedidos-vendedora-lista-table', {
    data,
    pageLength: 10,
    order: [[0, 'desc']],
    columns: [
      { data: 'pedido' },
      { data: 'cliente' },
      {
        data: 'fecha',
        render: (val) => escapeAttr(formatDateLong(val)),
      },
      { data: 'vendedora' },
      { data: 'factura' },
      { data: 'total' },
      { data: 'ordenWeb' },
      { data: 'totalWeb' },
      {
        data: 'transporte',
        orderable: false,
        searchable: false,
        render: (_val, _type, row) => {
          const current = String(row.transporte || '').trim();
          const options = buildTransporteOptions(current);
          return `<select class="pedido-transporte-select${getPedidoSelectClass()}"${getPedidoSelectStyle()} data-id="${row.id}">${options}</select>`;
        },
      },
      {
        data: 'instancia',
        orderable: false,
        searchable: false,
        render: (val, _type, row) => {
          const current = Number(val);
          return `
            <select class="pedido-instancia-select${getPedidoSelectClass()}"${getPedidoSelectStyle()} data-id="${row.id}" data-prev="${current}">
              <option value="0"${current === 0 ? ' selected' : ''}>Pendiente</option>
              <option value="1"${current === 1 ? ' selected' : ''}>Iniciado</option>
              <option value="2"${current === 2 ? ' selected' : ''}>Finalizado</option>
            </select>
          `;
        },
      },
      {
        data: 'estado',
        render: (_val, _type, row) => escapeAttr(mapEstado(row.estado, row.empaquetado)),
      },
      {
        data: null,
        orderable: false,
        searchable: false,
        render: (_val, _type, row) =>
          `<div class="abm-actions">
            <button type="button" class="abm-link-btn pedido-items-btn" title="Ver mercaderia" data-pedido="${row.pedido}" data-vendedora="${escapeAttr(
            row.vendedora
          )}" data-cliente="${escapeAttr(row.cliente)}">👁️</button>
            <button type="button" class="abm-link-btn pedido-notas-btn" title="Notas" data-id="${row.id}" data-pedido="${row.pedido}" data-vendedora="${escapeAttr(
            row.vendedora
          )}" data-cliente="${escapeAttr(row.cliente)}">📖<span class="nota-count">${row.notasCount}</span></button>
            <button type="button" class="abm-link-btn pedido-checkout-btn" title="Check Out" data-pedido="${row.pedido}" data-vendedora="${escapeAttr(
            row.vendedora
          )}" data-cliente="${escapeAttr(row.cliente)}">✔</button>
            <button type="button" class="abm-link-btn pedido-pago-btn ${Number(row.pagado) === 1 ? 'pago-ok' : 'pago-pendiente'}" title="${
              Number(row.pagado) === 1 ? 'Marcar como no pagado' : 'Marcar como pagado'
            }" data-id="${row.id}" data-pagado="${Number(row.pagado)}">${
              Number(row.pagado) === 1 ? '😊' : '😞'
            }</button>
            <button type="button" class="abm-link-btn pedido-cancel-btn" title="Cancelar pedido" data-id="${row.id}">🧽</button>
            <button type="button" class="abm-link-btn pedido-ia-btn" title="IA cliente" data-id="${row.id}" data-cliente-id="${row.id_cliente || ''}" data-pedido="${row.pedido}" data-vendedora="${escapeAttr(
            row.vendedora
          )}" data-cliente="${escapeAttr(row.cliente)}">🤖</button>
          </div>`,
      },
    ],
    rowCallback: (row, rowData) => {
      if (Number(rowData.vencido) > 0) {
        row.classList.add('row-alert');
      } else {
        row.classList.remove('row-alert');
      }
    },
    language: {
      search: 'Buscar:',
      lengthMenu: 'Mostrar _MENU_',
      info: 'Mostrando _START_ a _END_ de _TOTAL_',
      infoEmpty: 'Sin resultados',
      emptyTable: 'Sin pedidos.',
      paginate: {
        first: 'Primero',
        last: 'Ultimo',
        next: 'Siguiente',
        previous: 'Anterior',
      },
    },
  });
}

function renderPedidoItems(rows) {
  if (!pedidoItemsTableEl) return;
  const data = rows.map((row) => ({
    articulo: row.articulo || '',
    detalle: row.detalle || '',
    cantidad: row.cantidad ?? '',
  }));

  if (pedidoItemsTable) {
    pedidoItemsTable.clear();
    pedidoItemsTable.rows.add(data);
    pedidoItemsTable.draw();
    return;
  }

  pedidoItemsTable = new DataTable('#pedido-items-table', {
    data,
    pageLength: 10,
    columns: [
      { data: 'articulo' },
      { data: 'detalle' },
      { data: 'cantidad' },
    ],
    language: {
      search: 'Buscar:',
      lengthMenu: 'Mostrar _MENU_',
      info: 'Mostrando _START_ a _END_ de _TOTAL_',
      infoEmpty: 'Sin resultados',
      emptyTable: 'Sin articulos.',
      paginate: {
        first: 'Primero',
        last: 'Ultimo',
        next: 'Siguiente',
        previous: 'Anterior',
      },
    },
  });
}

function renderPedidoCheckoutTable(tableEl, tableInstance, rows, columns) {
  if (!tableEl) return tableInstance;
  if (tableInstance) {
    tableInstance.clear();
    tableInstance.rows.add(rows);
    tableInstance.draw();
    return tableInstance;
  }
  return new DataTable(tableEl, {
    data: rows,
    pageLength: 5,
    columns,
    language: {
      search: 'Buscar:',
      lengthMenu: 'Mostrar _MENU_',
      info: 'Mostrando _START_ a _END_ de _TOTAL_',
      infoEmpty: 'Sin resultados',
      emptyTable: 'Sin resultados.',
      paginate: {
        first: 'Primero',
        last: 'Ultimo',
        next: 'Siguiente',
        previous: 'Anterior',
      },
    },
  });
}

function renderPedidoIaMessages(messages) {
  if (!pedidoIaWindow) return;
  pedidoIaWindow.innerHTML = '';
  messages.forEach((msg) => {
    const div = document.createElement('div');
    div.className = `chat-message ${msg.from}`;
    const name = msg.name ? `<strong>${escapeAttr(msg.name)}</strong><br>` : '';
    const fecha = msg.fecha ? `<small>${escapeAttr(formatDateTime(msg.fecha))}</small>` : '';
    div.innerHTML = `${name}${escapeAttr(msg.text || '')}<br>${fecha}`;
    pedidoIaWindow.appendChild(div);
  });
  pedidoIaWindow.scrollTop = pedidoIaWindow.scrollHeight;
}

async function loadPedidoIaHistory(controlId) {
  if (!controlId) return;
  try {
    if (pedidoIaStatus) pedidoIaStatus.textContent = 'Cargando...';
    const res = await fetchJSON(`/api/pedidos/ia/historial?controlId=${encodeURIComponent(controlId)}`);
    const rows = Array.isArray(res.data) ? res.data : [];
    pedidoIaMessages = rows.map((row) => ({
      from: row.nombre === 'Mia' ? 'ia' : 'user',
      name: row.nombre || '',
      text: row.chat || '',
      fecha: row.fecha || '',
    }));
    renderPedidoIaMessages(pedidoIaMessages);
    if (pedidoIaStatus) pedidoIaStatus.textContent = '';
  } catch (error) {
    if (pedidoIaStatus) pedidoIaStatus.textContent = error.message || 'Error cargando historial.';
    console.error(error);
  }
}

async function sendPedidoIaMessage() {
  const text = pedidoIaInput?.value?.trim();
  if (!text || !pedidoIaControlId) return;
  const name = userNameEl?.textContent?.trim() || 'Usuario';
  pedidoIaMessages.push({ from: 'user', name, text, fecha: '' });
  renderPedidoIaMessages(pedidoIaMessages);
  if (pedidoIaInput) pedidoIaInput.value = '';
  if (pedidoIaStatus) pedidoIaStatus.textContent = 'Enviando...';
  try {
    const res = await fetch('/api/pedidos/ia/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        controlId: pedidoIaControlId,
        clienteId: pedidoIaClienteId,
        message: text,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || 'Error en IA');
    }
    const data = await res.json();
    pedidoIaMessages.push({ from: 'ia', name: 'Mia', text: data.reply || '', fecha: '' });
    renderPedidoIaMessages(pedidoIaMessages);
    if (pedidoIaStatus) pedidoIaStatus.textContent = '';
  } catch (error) {
    if (pedidoIaStatus) pedidoIaStatus.textContent = error.message || 'Error en IA.';
  }
}

async function loadPedidoCheckout(nropedido) {
  if (!nropedido) return;
  try {
    if (pedidoCheckoutStatus) pedidoCheckoutStatus.textContent = 'Cargando...';
    const [tnRes, localRes, diffRes] = await Promise.all([
      fetchJSON(`/api/ordencheckoutInTN?nroPedido=${encodeURIComponent(nropedido)}`),
      fetchJSON(`/api/ordencheckoutInLocalSystem?nroPedido=${encodeURIComponent(nropedido)}`),
      fetchJSON(`/api/ordencheckoutInDiff?nroPedido=${encodeURIComponent(nropedido)}`),
    ]);

    pedidoCheckoutTnTable = renderPedidoCheckoutTable(
      pedidoCheckoutTnTableEl,
      pedidoCheckoutTnTable,
      tnRes || [],
      [
        { data: 'nropedido' },
        { data: 'OrdenWeb' },
        { data: 'articulo' },
        { data: 'detalle' },
        { data: 'cantidad' },
        { data: 'precio' },
        { data: 'stock' },
      ]
    );
    pedidoCheckoutLocalTable = renderPedidoCheckoutTable(
      pedidoCheckoutLocalTableEl,
      pedidoCheckoutLocalTable,
      localRes || [],
      [
        { data: 'nropedido' },
        { data: 'OrdenWeb' },
        { data: 'Articulo' },
        { data: 'detalle' },
        { data: 'cantidad' },
        { data: 'PrecioVenta' },
      ]
    );
    pedidoCheckoutDiffTable = renderPedidoCheckoutTable(
      pedidoCheckoutDiffTableEl,
      pedidoCheckoutDiffTable,
      diffRes || [],
      [
        { data: 'nropedido' },
        { data: 'articulo' },
        { data: 'detalle' },
        { data: 'TNCantidad' },
        { data: 'TNPrecio' },
        { data: 'CantidadLocal' },
        { data: 'PrecioLocal' },
      ]
    );

    if (pedidoCheckoutStatus) pedidoCheckoutStatus.textContent = 'Actualizado.';
  } catch (error) {
    if (pedidoCheckoutStatus) {
      pedidoCheckoutStatus.textContent = error.message || 'Error al cargar checkout.';
    }
    console.error(error);
  }
}

function resolvePedidoNotaTexto(row) {
  return row.comentario || row.nota || row.texto || '';
}

function renderPedidoNotas(rows) {
  if (!pedidoNotasList) return;
  pedidoNotasList.innerHTML = '';
  if (!rows.length) {
    const empty = document.createElement('p');
    empty.className = 'status';
    empty.textContent = 'Sin notas.';
    pedidoNotasList.appendChild(empty);
    return;
  }
  rows.forEach((row) => {
    const note = document.createElement('div');
    note.className = 'carritos-nota';
    if (pedidoNotasEditingId && Number(row.id) === pedidoNotasEditingId) {
      note.classList.add('active');
    }
    note.dataset.id = row.id;
    note.dataset.text = resolvePedidoNotaTexto(row);
    const fecha = row.fecha || '';
    const usuario = row.usuario || '';
    note.innerHTML = `
      <div class="meta">${escapeAttr(usuario)} · ${escapeAttr(formatDateTime(fecha))}</div>
      <div class="text"><strong>Comentario:</strong> ${escapeAttr(resolvePedidoNotaTexto(row))}</div>
      <button type="button" class="nota-delete-btn" title="Eliminar nota">🗑️</button>
    `;
    pedidoNotasList.appendChild(note);
  });
}

async function loadPedidoNotas(id) {
  if (!id) return;
  try {
    if (pedidoNotasStatus) pedidoNotasStatus.textContent = 'Cargando...';
    const res = await fetchJSON(`/api/pedidos/${encodeURIComponent(id)}/comentarios`);
    const rows = Array.isArray(res.data) ? res.data : [];
    renderPedidoNotas(rows);
    if (pedidoNotasStatus) {
      pedidoNotasStatus.textContent = rows.length ? `Notas: ${rows.length}` : '';
    }
  } catch (error) {
    if (pedidoNotasStatus) pedidoNotasStatus.textContent = error.message || 'Error al cargar notas.';
    console.error(error);
  }
}

function openPedidoNotas(controlId, pedido, vendedora) {
  if (!pedidoNotasOverlay) return;
  pedidoNotasCurrentId = Number(controlId) || null;
  pedidoNotasEditingId = null;
  if (pedidoNotasInput) pedidoNotasInput.value = '';
  if (pedidoNotasTitle) {
    const title = pedido ? `Pedido ${pedido}` : 'Comentarios';
    pedidoNotasTitle.textContent = vendedora ? `${title} - ${vendedora}` : title;
  }
  pedidoNotasOverlay.classList.add('open');
  loadPedidoNotas(pedidoNotasCurrentId);
}

async function savePedidoNota() {
  if (!pedidoNotasCurrentId) return;
  const comentario = pedidoNotasInput?.value?.trim() || '';
  if (!comentario) {
    if (pedidoNotasStatus) pedidoNotasStatus.textContent = 'Escribe una nota.';
    return;
  }
  try {
    if (pedidoNotasSave) pedidoNotasSave.disabled = true;
    if (pedidoNotasStatus) pedidoNotasStatus.textContent = 'Guardando...';
    if (pedidoNotasEditingId) {
      await fetch(`/api/pedidos/comentarios/${encodeURIComponent(pedidoNotasEditingId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ comentario }),
      });
    } else {
      await fetch(`/api/pedidos/${encodeURIComponent(pedidoNotasCurrentId)}/comentarios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ comentario }),
      });
    }
    pedidoNotasEditingId = null;
    if (pedidoNotasInput) pedidoNotasInput.value = '';
    await loadPedidoNotas(pedidoNotasCurrentId);
    await reloadPedidosLista();
    if (pedidoNotasStatus) pedidoNotasStatus.textContent = 'Guardado.';
  } catch (error) {
    if (pedidoNotasStatus) pedidoNotasStatus.textContent = error.message || 'Error al guardar nota.';
    console.error(error);
  } finally {
    if (pedidoNotasSave) pedidoNotasSave.disabled = false;
  }
}

async function loadPedidoItems(nropedido) {
  if (!nropedido) return;
  try {
    if (pedidoItemsStatus) pedidoItemsStatus.textContent = 'Cargando...';
    const res = await fetchJSON(`/api/pedidos/items?nropedido=${encodeURIComponent(nropedido)}`);
    const rows = Array.isArray(res.data) ? res.data : [];
    renderPedidoItems(rows);
    if (pedidoItemsStatus) {
      pedidoItemsStatus.textContent = rows.length ? `Articulos: ${rows.length}` : 'Sin articulos.';
    }
  } catch (error) {
    if (pedidoItemsStatus) pedidoItemsStatus.textContent = error.message || 'Error al cargar articulos.';
    console.error(error);
  }
}

async function loadPedidosVendedoraLista(tipo) {
  if (!pedidosVendedoraActual || !tipo) return;
  currentPedidosScope = 'vendedora';
  currentPedidosTipo = tipo;
  pedidoCardsFilterTerm = '';
  if (pedidoCardsSearchInput) pedidoCardsSearchInput.value = '';
  if (!pedidoCardsServerMode) {
    pedidoCardsServerSearch = '';
  }
  updatePedidoCardsVisibility();
  try {
    if (pedidosVendedoraListaStatus) pedidosVendedoraListaStatus.textContent = 'Cargando...';
    const res = await fetchJSON(
      `/api/panel-control/pedidos/${encodeURIComponent(pedidosVendedoraActual)}/lista?tipo=${encodeURIComponent(tipo)}`
    );
    const rows = Array.isArray(res.data) ? res.data : [];
    renderPedidosVendedoraLista(rows);
    if (pedidosVendedoraListaStatus) {
      pedidosVendedoraListaStatus.textContent = rows.length ? `Pedidos: ${rows.length}` : 'Sin resultados.';
    }
  } catch (error) {
    if (pedidosVendedoraListaStatus) {
      pedidosVendedoraListaStatus.textContent = error.message || 'Error al cargar pedidos.';
    }
    console.error(error);
  }
}

async function loadPedidosTodosLista(tipo) {
  if (!tipo) return;
  currentPedidosScope = 'todos';
  currentPedidosTipo = tipo;
  if (isMobileView()) {
    setPedidoCardsServerMode(true);
    pedidoCardsServerSearch = '';
    pedidoCardsFilterTerm = '';
    if (pedidoCardsSearchInput) pedidoCardsSearchInput.value = '';
    await loadPedidosTodosCards(true);
    updatePedidoCardsVisibility();
    return;
  }
  setPedidoCardsServerMode(false);
  pedidoCardsRowsCache = [];
  if (pedidoCardsEl) pedidoCardsEl.innerHTML = '';
  updatePedidoCardsVisibility();
  if (!pedidosVendedoraListaTableEl) return;
  if (!transportesList.length) loadTransportes();
  try {
    if (pedidosVendedoraListaStatus) pedidosVendedoraListaStatus.textContent = 'Cargando...';
    if (pedidosListaServerSide && pedidosVendedoraListaTable && pedidosListaVariant === 'todos') {
      pedidosVendedoraListaTable.ajax.reload();
      if (pedidosVendedoraListaStatus) pedidosVendedoraListaStatus.textContent = '';
      return;
    }
    if (pedidosVendedoraListaTable) {
      pedidosVendedoraListaTable.destroy();
      pedidosVendedoraListaTable = null;
    }
    const showFechaPago = currentPedidosTipo === 'pagados';
    pedidosVendedoraListaTableEl.innerHTML = `
      <thead>
        <tr>
          <th>Pedido</th>
          <th>Cliente</th>
          <th>Fecha</th>
          ${showFechaPago ? '<th>Fecha Pago</th>' : ''}
          <th>Vendedora</th>
          <th>Factura</th>
          <th>Total</th>
          <th>OrdenWeb</th>
          <th>TotalWeb</th>
          <th>Transporte</th>
          <th>Instancia</th>
          <th>Estado</th>
          <th>Accion</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;
    pedidosListaServerSide = true;
    pedidosListaVariant = 'todos';
    pedidosVendedoraListaTable = new DataTable('#pedidos-vendedora-lista-table', {
      serverSide: true,
      processing: true,
      pageLength: 10,
      order: [[0, 'desc']],
      dataSrc: 'data',
      ajax: {
        url: '/api/pedidos/todos/lista',
        dataSrc: 'data',
        data: (d) => {
          d.tipo = currentPedidosTipo;
        },
      },
      columns: [
        { data: 'pedido' },
        { data: 'cliente' },
        {
          data: 'fecha',
          render: (val) => escapeAttr(formatDateLong(val)),
        },
        ...(showFechaPago
          ? [
              {
                data: 'fecha_pago',
                render: (val) => escapeAttr(formatDateTime(val)),
              },
            ]
          : []),
        { data: 'vendedora' },
        { data: 'factura' },
        { data: 'total' },
        { data: 'ordenWeb' },
        { data: 'totalWeb' },
        {
          data: 'transporte',
          orderable: false,
          render: (_val, _type, row) => {
            const current = String(row.transporte || '').trim();
          const options = buildTransporteOptions(current);
          return `<select class="pedido-transporte-select${getPedidoSelectClass()}"${getPedidoSelectStyle()} data-id="${row.id}">${options}</select>`;
        },
      },
        {
          data: 'instancia',
          orderable: false,
          render: (val, _type, row) => {
            const current = Number(val);
            return `
              <select class="pedido-instancia-select${getPedidoSelectClass()}"${getPedidoSelectStyle()} data-id="${row.id}" data-prev="${current}">
                <option value="0"${current === 0 ? ' selected' : ''}>Pendiente</option>
                <option value="1"${current === 1 ? ' selected' : ''}>Iniciado</option>
                <option value="2"${current === 2 ? ' selected' : ''}>Finalizado</option>
              </select>
            `;
          },
        },
        {
          data: 'estado',
          render: (_val, _type, row) => escapeAttr(mapEstado(row.estado, row.empaquetado)),
        },
        {
          data: null,
          orderable: false,
          render: (_val, _type, row) =>
            `<div class="abm-actions">
              <button type="button" class="abm-link-btn pedido-items-btn" title="Ver mercaderia" data-pedido="${row.pedido}" data-vendedora="${escapeAttr(
              row.vendedora
            )}" data-cliente="${escapeAttr(row.cliente)}">👁️</button>
              <button type="button" class="abm-link-btn pedido-notas-btn" title="Notas" data-id="${row.id}" data-pedido="${row.pedido}" data-vendedora="${escapeAttr(
              row.vendedora
            )}" data-cliente="${escapeAttr(row.cliente)}">📖<span class="nota-count">${row.notasCount}</span></button>
              <button type="button" class="abm-link-btn pedido-checkout-btn" title="Check Out" data-pedido="${row.pedido}" data-vendedora="${escapeAttr(
              row.vendedora
            )}" data-cliente="${escapeAttr(row.cliente)}">✔️</button>
              <button type="button" class="abm-link-btn pedido-pago-btn ${Number(row.pagado) === 1 ? 'pago-ok' : 'pago-pendiente'}" title="${
                Number(row.pagado) === 1 ? 'Marcar como no pagado' : 'Marcar como pagado'
              }" data-id="${row.id}" data-pagado="${Number(row.pagado)}">${
                Number(row.pagado) === 1 ? '🙂' : '☹️'
              }</button>
              <button type="button" class="abm-link-btn pedido-cancel-btn" title="Cancelar pedido" data-id="${row.id}">🚫</button>
              <button type="button" class="abm-link-btn pedido-ia-btn" title="IA cliente" data-id="${row.id}" data-cliente-id="${row.id_cliente || ''}" data-pedido="${row.pedido}" data-vendedora="${escapeAttr(
              row.vendedora
            )}" data-cliente="${escapeAttr(row.cliente)}">🤖</button>
            </div>`,
        },
      ],
      rowCallback: (row, rowData) => {
        if (Number(rowData.vencido) > 0) {
          row.classList.add('row-alert');
        } else {
          row.classList.remove('row-alert');
        }
      },
      language: {
        search: 'Buscar:',
        lengthMenu: 'Mostrar _MENU_',
        info: 'Mostrando _START_ a _END_ de _TOTAL_',
        infoEmpty: 'Sin resultados',
        emptyTable: 'Sin pedidos.',
        paginate: {
          first: 'Primero',
          last: 'Ultimo',
          next: 'Siguiente',
          previous: 'Anterior',
        },
      },
    });
    if (pedidosVendedoraListaStatus) pedidosVendedoraListaStatus.textContent = '';
  } catch (error) {
    if (pedidosVendedoraListaStatus) {
      pedidosVendedoraListaStatus.textContent = error.message || 'Error al cargar pedidos.';
    }
    console.error(error);
  }
}

async function loadPedidosEmpaquetadosLista() {
  currentPedidosScope = 'todos';
  currentPedidosTipo = 'empaquetados';
  if (isMobileView()) {
    setPedidoCardsServerMode(true);
    pedidoCardsServerSearch = '';
    pedidoCardsFilterTerm = '';
    if (pedidoCardsSearchInput) pedidoCardsSearchInput.value = '';
    await loadPedidosTodosCards(true);
    updatePedidoCardsVisibility();
    return;
  }
  setPedidoCardsServerMode(false);
  pedidoCardsRowsCache = [];
  if (pedidoCardsEl) pedidoCardsEl.innerHTML = '';
  updatePedidoCardsVisibility();
  if (!pedidosVendedoraListaTableEl) return;
  if (!transportesList.length) loadTransportes();
  try {
    if (pedidosVendedoraListaStatus) pedidosVendedoraListaStatus.textContent = 'Cargando...';
    if (pedidosListaServerSide && pedidosVendedoraListaTable && pedidosListaVariant === 'empaquetados') {
      pedidosVendedoraListaTable.ajax.reload();
      if (pedidosVendedoraListaStatus) pedidosVendedoraListaStatus.textContent = '';
      return;
    }
    if (pedidosVendedoraListaTable) {
      pedidosVendedoraListaTable.destroy();
      pedidosVendedoraListaTable = null;
    }
    pedidosVendedoraListaTableEl.innerHTML = `
      <thead>
        <tr>
          <th>Pedido</th>
          <th>Cliente</th>
          <th>Fecha</th>
          <th>Vendedora</th>
          <th>Total</th>
          <th>OrdenWeb</th>
          <th>TotalWeb</th>
          <th>Transporte</th>
          <th>Instancia</th>
          <th>Estado</th>
          <th>Accion</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;
    pedidosListaServerSide = true;
    pedidosListaVariant = 'empaquetados';
    pedidosVendedoraListaTable = new DataTable('#pedidos-vendedora-lista-table', {
      serverSide: true,
      processing: true,
      pageLength: 10,
      order: [[0, 'desc']],
      ajax: {
        url: '/api/pedidos/todos/empaquetados',
        dataSrc: 'data',
      },
      columns: [
        { data: 'pedido' },
        { data: 'cliente' },
        {
          data: 'fecha',
          render: (val) => escapeAttr(formatDateLong(val)),
        },
        { data: 'vendedora' },
        { data: 'total' },
        { data: 'ordenWeb' },
        { data: 'totalWeb' },
        {
          data: 'transporte',
          orderable: false,
          render: (_val, _type, row) => {
            const current = String(row.transporte || '').trim();
          const options = buildTransporteOptions(current);
          return `<select class="pedido-transporte-select${getPedidoSelectClass()}"${getPedidoSelectStyle()} data-id="${row.id}">${options}</select>`;
        },
      },
        {
          data: 'instancia',
          orderable: false,
          render: (val, _type, row) => {
            const current = Number(val);
            return `
              <select class="pedido-instancia-select${getPedidoSelectClass()}"${getPedidoSelectStyle()} data-id="${row.id}">
                <option value="0"${current === 0 ? ' selected' : ''}>Pendiente</option>
                <option value="1"${current === 1 ? ' selected' : ''}>Iniciado</option>
                <option value="2"${current === 2 ? ' selected' : ''}>Finalizado</option>
              </select>
            `;
          },
        },
        {
          data: 'estado',
          render: (_val, _type, row) => escapeAttr(mapEstado(row.estado, row.empaquetado)),
        },
        {
          data: null,
          orderable: false,
          render: (_val, _type, row) =>
            `<div class="abm-actions">
              <button type="button" class="abm-link-btn pedido-items-btn" title="Ver mercaderia" data-pedido="${row.pedido}" data-vendedora="${escapeAttr(
              row.vendedora
            )}" data-cliente="${escapeAttr(row.cliente)}">👁️</button>
              <button type="button" class="abm-link-btn pedido-notas-btn" title="Notas" data-id="${row.id}" data-pedido="${row.pedido}" data-vendedora="${escapeAttr(
              row.vendedora
            )}" data-cliente="${escapeAttr(row.cliente)}">📖<span class="nota-count">${row.notasCount}</span></button>
              <button type="button" class="abm-link-btn pedido-entregado-btn" title="Entregado" data-id="${row.id}" data-pedido="${row.pedido}">✅</button>
            </div>`,
        },
      ],
      rowCallback: (row, rowData) => {
        if (Number(rowData.vencimiento) === 2) {
          row.classList.add('row-alert');
        } else {
          row.classList.remove('row-alert');
        }
      },
      language: {
        search: 'Buscar:',
        lengthMenu: 'Mostrar _MENU_',
        info: 'Mostrando _START_ a _END_ de _TOTAL_',
        infoEmpty: 'Sin resultados',
        emptyTable: 'Sin pedidos.',
        paginate: {
          first: 'Primero',
          last: 'Ultimo',
          next: 'Siguiente',
          previous: 'Anterior',
        },
      },
    });
    if (pedidosVendedoraListaStatus) pedidosVendedoraListaStatus.textContent = '';
  } catch (error) {
    if (pedidosVendedoraListaStatus) {
      pedidosVendedoraListaStatus.textContent = error.message || 'Error al cargar pedidos.';
    }
    console.error(error);
  }
}

function reloadPedidosLista() {
  if (currentPedidosScope === 'todos') {
    if (currentPedidosTipo === 'empaquetados') {
      return loadPedidosEmpaquetadosLista();
    }
    return loadPedidosTodosLista(currentPedidosTipo);
  }
  return loadPedidosVendedoraLista(currentPedidosTipo);
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


function normalizeControlOrdenRow(row) {
  return {
    id: row.id_compra ?? row.id ?? row.ID ?? null,
    orden: row.OrdenCompra ?? row.ordenCompra ?? row.orden ?? '',
    articulo: row.Articulo ?? row.articulo ?? '',
    detalle: row.Detalle ?? row.detalle ?? '',
    cantidad: Number(row.Cantidad ?? row.cantidad ?? 0),
    fecha: row.Fecha ?? row.fecha ?? '',
    observaciones: row.Observaciones ?? row.observaciones ?? '',
    pventa: Number(row.PVenta ?? row.pventa ?? row.precioVenta ?? 0),
    cantNotas: Number(row.cant_notas ?? row.cantNotas ?? 0),
    ordenControlada: Number(row.ordenControlada ?? row.ordencontrolada ?? 0),
    proveedor: row.Proveedor ?? row.proveedor ?? '',
    precioArgen: Number(row.PrecioArgen ?? row.precioArgen ?? row.precioOrigen ?? 0),
  };
}

function getControlOrdenEstadoLabel(value) {
  if (Number(value) === 1) return 'Confirmada';
  if (Number(value) === 2) return 'Incompleta';
  return 'Sin Procesar';
}

function getControlOrdenesEstadoSelection() {
  const values = Array.from(controlOrdenesEstado?.selectedOptions || []).map((opt) => opt.value);
  if (!values.length) return [];
  if (values.includes('all')) return [];
  return values;
}

function hasControlOrdenesFilters() {
  const estados = getControlOrdenesEstadoSelection();
  const hasEstados = estados.length > 0;
  const hasFechas = !!(controlOrdenesDesde?.value && controlOrdenesHasta?.value);
  const hasOrden = !!String(controlOrdenesOrdenInput?.value || '').trim();
  return hasEstados || hasFechas || hasOrden;
}

function updateControlOrdenesBuscarState() {
  return;
}

function buildControlOrdenesParams(forceOrden) {
  const params = new URLSearchParams();
  const estados = getControlOrdenesEstadoSelection();
  const estadoMap = { confirmada: 1, incompleta: 2, sin_procesar: 0 };
  const mappedEstados = estados
    .map((value) => estadoMap[value])
    .filter((val) => Number.isFinite(val));
  if (mappedEstados.length) {
    params.set('estado', mappedEstados.join(','));
  }
  const desde = controlOrdenesDesde?.value;
  const hasta = controlOrdenesHasta?.value;
  if (desde && hasta) {
    params.set('desde', desde);
    params.set('hasta', hasta);
  }
  const ordenValue = String(controlOrdenesOrdenInput?.value || '').trim();
  if (ordenValue) {
    params.set('nroOrden', ordenValue);
  }
  if (controlOrdenesSearchTerm) {
    params.set('q', controlOrdenesSearchTerm);
  }
  params.set('page', String(controlOrdenesPage));
  params.set('pageSize', String(controlOrdenesPageSize));
  return params;
}

function buildControlOrdenesExportParams() {
  const params = new URLSearchParams();
  const estados = getControlOrdenesEstadoSelection();
  const estadoMap = { confirmada: 1, incompleta: 2, sin_procesar: 0 };
  const mappedEstados = estados
    .map((value) => estadoMap[value])
    .filter((val) => Number.isFinite(val));
  if (mappedEstados.length) {
    params.set('estado', mappedEstados.join(','));
  }
  const desde = controlOrdenesDesde?.value;
  const hasta = controlOrdenesHasta?.value;
  if (desde && hasta) {
    params.set('desde', desde);
    params.set('hasta', hasta);
  }
  const ordenValue = String(controlOrdenesOrdenInput?.value || '').trim();
  if (ordenValue) {
    params.set('nroOrden', ordenValue);
  }
  if (controlOrdenesSearchTerm) {
    params.set('q', controlOrdenesSearchTerm);
  }
  params.set('page', '1');
  params.set('pageSize', '100000');
  return params;
}

function applyControlOrdenesFilters() {
  let rows = controlOrdenesRows.slice();
  if (controlOrdenesFilters.orden) {
    rows = rows.filter((row) => String(row.orden || '').includes(controlOrdenesFilters.orden));
  }
  if (controlOrdenesFilters.articulo) {
    rows = rows.filter((row) => textMatchesAllTokens(row.articulo, controlOrdenesFilters.articulo));
  }
  if (controlOrdenesFilters.detalle) {
    rows = rows.filter((row) => textMatchesAllTokens(row.detalle, controlOrdenesFilters.detalle));
  }
  if (controlOrdenesFilters.fecha) {
    rows = rows.filter((row) => String(row.fecha || '').includes(controlOrdenesFilters.fecha));
  }
  if (controlOrdenesFilters.proveedor) {
    rows = rows.filter((row) => textMatchesAllTokens(row.proveedor, controlOrdenesFilters.proveedor));
  }
  if (controlOrdenesSearchTerm) {
    rows = rows.filter((row) =>
      textMatchesAllTokens(
        `${row.orden} ${row.articulo} ${row.detalle} ${row.proveedor} ${row.observaciones}`,
        controlOrdenesSearchTerm
      )
    );
  }
  controlOrdenesFiltered = rows;
  renderControlOrdenesTable(rows);
  renderControlOrdenesCards(rows);
  if (controlOrdenesStatus) {
    const totalLabel = controlOrdenesTotal ? ` de ${controlOrdenesTotal}` : '';
    controlOrdenesStatus.textContent = `Mostrando ${rows.length}${totalLabel} orden(es)`;
  }
  if (controlOrdenesPageInfo) {
    controlOrdenesPageInfo.textContent = `Pagina ${controlOrdenesPage} de ${controlOrdenesTotalPages}`;
  }
  if (controlOrdenesPrev) controlOrdenesPrev.disabled = controlOrdenesPage <= 1;
  if (controlOrdenesNext) controlOrdenesNext.disabled = controlOrdenesPage >= controlOrdenesTotalPages;
}

async function loadControlOrdenes(options = {}) {
  if (!viewControlOrdenes || viewControlOrdenes.classList.contains('hidden')) return;
  if (controlOrdenesStatus) controlOrdenesStatus.textContent = 'Cargando...';
  try {
    if (options.page) controlOrdenesPage = options.page;
    const params = buildControlOrdenesParams(options.forceOrden);
    const url = params.toString() ? `/api/control-ordenes?${params.toString()}` : '/api/control-ordenes';
    const res = await fetch(url, { credentials: 'include' });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'No se pudieron cargar las ordenes');
    }
    const rows = (data.data || data.rows || []).map((row) => normalizeControlOrdenRow(row));
    controlOrdenesTotal = Number(data.total || rows.length || 0);
    controlOrdenesTotalPages = Math.max(1, Math.ceil(controlOrdenesTotal / controlOrdenesPageSize));
    controlOrdenesPage = Math.min(controlOrdenesPage, controlOrdenesTotalPages);
    controlOrdenesRows = rows;
    applyControlOrdenesFilters();
    if (!rows.length && controlOrdenesStatus) {
      controlOrdenesStatus.textContent = 'Sin resultados.';
    }
  } catch (error) {
    if (controlOrdenesStatus) controlOrdenesStatus.textContent = error.message || 'Error al cargar ordenes.';
  }
}

function renderControlOrdenesTable(rows) {
  if (!controlOrdenesTableBody) return;
  controlOrdenesTableBody.innerHTML = '';
  rows.forEach((row) => {
    const tr = document.createElement('tr');
    if (row.ordenControlada === 1) tr.classList.add('control-ordenes-row-ok');
    if (row.ordenControlada === 2) tr.classList.add('control-ordenes-row-warn');
    const closeIcon = row.ordenControlada === 1 || row.ordenControlada === 2 ? '✖' : '✓';
    tr.innerHTML = `
      <td>${escapeAttr(row.orden)}</td>
      <td>${escapeAttr(row.articulo)}</td>
      <td>${escapeAttr(row.detalle)}</td>
      <td>${row.cantidad ?? 0}</td>
      <td>${escapeAttr(row.fecha)}</td>
      <td>${escapeAttr(row.observaciones)}</td>
      <td>${formatMoney(row.pventa)}</td>
      <td>
        <button type="button" class="co-notas-btn" data-id="${row.id}" data-orden="${escapeAttr(
      row.orden
    )}" title="Notas">
          <span class="badge">${row.cantNotas ?? 0}</span>📘
        </button>
      </td>
      <td>
        <button type="button" class="co-close-btn" data-id="${row.id}" data-orden="${escapeAttr(
      row.orden
    )}" data-estado="${row.ordenControlada}">${closeIcon}</button>
      </td>
      <td>${escapeAttr(row.proveedor)}</td>
      <td>${formatMoney(row.precioArgen)}</td>
    `;
    controlOrdenesTableBody.appendChild(tr);
  });
}

function renderControlOrdenesCards(rows) {
  if (!controlOrdenesCards) return;
  controlOrdenesCards.innerHTML = '';
  rows.forEach((row) => {
    const estadoLabel = getControlOrdenEstadoLabel(row.ordenControlada);
    const estadoClass =
      row.ordenControlada === 1
        ? 'orden-card--ok'
        : row.ordenControlada === 2
        ? 'orden-card--warn'
        : '';
    const closeLabel = row.ordenControlada === 1 || row.ordenControlada === 2 ? 'Reabrir' : 'Cerrar';
    const card = document.createElement('div');
    card.className = `orden-card ${estadoClass}`.trim();
    card.dataset.id = row.id;
    card.dataset.orden = row.orden;
    card.dataset.estado = row.ordenControlada;
    card.dataset.notas = row.cantNotas ?? 0;
    card.innerHTML = `
      <div class="orden-card-header">
        <div>
          <p class="orden-card-title">Orden ${escapeAttr(row.orden)}</p>
          <p class="orden-card-sub">${escapeAttr(row.articulo)} · ${escapeAttr(estadoLabel)}</p>
        </div>
        <div class="orden-card-actions">
          <button type="button" class="orden-card-menu-toggle" aria-label="Acciones">...</button>
          <div class="orden-card-menu">
            <button type="button" class="orden-card-notas-btn">Notas</button>
            <button type="button" class="orden-card-close-btn">${closeLabel}</button>
          </div>
        </div>
      </div>
      <div class="orden-card-grid">
        <div>
          <div class="orden-card-label">Detalle</div>
          <div class="orden-card-value">${escapeAttr(row.detalle)}</div>
        </div>
        <div>
          <div class="orden-card-label">Observaciones</div>
          <div class="orden-card-value">${escapeAttr(row.observaciones)}</div>
        </div>
        <div>
          <div class="orden-card-label">Cantidad</div>
          <div class="orden-card-value">${row.cantidad ?? 0}</div>
        </div>
        <div>
          <div class="orden-card-label">Fecha</div>
          <div class="orden-card-value">${escapeAttr(row.fecha)}</div>
        </div>
        <div>
          <div class="orden-card-label">Proveedor</div>
          <div class="orden-card-value">${escapeAttr(row.proveedor)}</div>
        </div>
        <div>
          <div class="orden-card-label">PVenta</div>
          <div class="orden-card-value">${formatMoney(row.pventa)}</div>
        </div>
        <div>
          <div class="orden-card-label">Notas</div>
          <div class="orden-card-value orden-card-notas"><span class="badge">${row.cantNotas ?? 0}</span></div>
        </div>
      </div>
    `;
    controlOrdenesCards.appendChild(card);
  });
}

function openControlOrdenNotas(id, orden) {
  controlOrdenesNotasCompraId = id;
  controlOrdenesNotasEditingId = null;
  if (controlOrdenesNotasTitle) controlOrdenesNotasTitle.textContent = `Orden ${orden}`;
  if (controlOrdenesNotasStatus) controlOrdenesNotasStatus.textContent = '';
  if (controlOrdenesNotasInput) controlOrdenesNotasInput.value = '';
  if (controlOrdenesNotasList) controlOrdenesNotasList.innerHTML = '';
  controlOrdenesNotasOverlay?.classList.add('open');
  loadControlOrdenNotas();
}

function closeControlOrdenNotas() {
  controlOrdenesNotasOverlay?.classList.remove('open');
}

function openControlOrdenDecision(articulo) {
  return new Promise((resolve) => {
    controlOrdenesDecisionResolver = resolve;
    if (controlOrdenesDecisionText) {
      controlOrdenesDecisionText.textContent = `Seleccione una opcion para el Articulo ${articulo || ''}`.trim();
    }
    controlOrdenesDecisionOverlay?.classList.add('open');
  });
}

function closeControlOrdenDecision(result = null) {
  if (controlOrdenesDecisionOverlay) controlOrdenesDecisionOverlay.classList.remove('open');
  if (controlOrdenesDecisionResolver) {
    controlOrdenesDecisionResolver(result);
    controlOrdenesDecisionResolver = null;
  }
}

async function loadControlOrdenNotas() {
  if (!controlOrdenesNotasCompraId) return;
  try {
    if (controlOrdenesNotasStatus) controlOrdenesNotasStatus.textContent = 'Cargando...';
    const res = await fetch(`/api/control-ordenes/notas?id_compra=${controlOrdenesNotasCompraId}`, {
      credentials: 'include',
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Error cargando notas');
    const notes = data.data || [];
    if (!controlOrdenesNotasList) return;
    controlOrdenesNotasList.innerHTML = '';
    if (!notes.length) {
      controlOrdenesNotasList.innerHTML = '<p class="status">Sin notas.</p>';
      if (controlOrdenesNotasStatus) controlOrdenesNotasStatus.textContent = '';
      return;
    }
    notes.forEach((note) => {
      const item = document.createElement('div');
      item.className = 'carritos-nota';
      if (controlOrdenesNotasEditingId && Number(note.id) === controlOrdenesNotasEditingId) {
        item.classList.add('active');
      }
      item.dataset.id = note.id;
      item.dataset.text = note.comentario || note.notas || '';
      item.innerHTML = `
        <div class="meta">${escapeAttr(note.nombre || '')} · ${escapeAttr(formatDateTime(note.fecha || ''))}</div>
        <div class="text"><strong>Comentario:</strong> ${escapeAttr(note.comentario || note.notas || '')}</div>
        <button type="button" class="nota-delete-btn" title="Eliminar nota">🗑️</button>
      `;
      controlOrdenesNotasList.appendChild(item);
    });
    if (controlOrdenesNotasStatus) controlOrdenesNotasStatus.textContent = `Notas: ${notes.length}`;
  } catch (error) {
    if (controlOrdenesNotasStatus) {
      controlOrdenesNotasStatus.textContent = error.message || 'Error cargando notas.';
    }
  }
}

async function saveControlOrdenNota() {
  if (!controlOrdenesNotasCompraId) return;
  const nota = (controlOrdenesNotasInput?.value || '').trim();
  if (!nota) {
    if (controlOrdenesNotasStatus) controlOrdenesNotasStatus.textContent = 'Debe agregar una nota.';
    return;
  }
  try {
    if (controlOrdenesNotasSave) controlOrdenesNotasSave.disabled = true;
    if (controlOrdenesNotasStatus) controlOrdenesNotasStatus.textContent = 'Guardando...';
    if (controlOrdenesNotasEditingId) {
      const res = await fetch(`/api/control-ordenes/notas/${encodeURIComponent(controlOrdenesNotasEditingId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ nota }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'No se pudo actualizar la nota');
    } else {
      const res = await fetch('/api/control-ordenes/notas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id_compra: controlOrdenesNotasCompraId, nota }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'No se pudo guardar la nota');
      const row = controlOrdenesRows.find((r) => Number(r.id) === Number(controlOrdenesNotasCompraId));
      if (row) row.cantNotas = (row.cantNotas || 0) + 1;
    }
    controlOrdenesNotasEditingId = null;
    if (controlOrdenesNotasInput) controlOrdenesNotasInput.value = '';
    applyControlOrdenesFilters();
    await loadControlOrdenNotas();
    if (controlOrdenesNotasStatus) controlOrdenesNotasStatus.textContent = 'Nota guardada.';
  } catch (error) {
    if (controlOrdenesNotasStatus) controlOrdenesNotasStatus.textContent = error.message || 'Error al guardar nota.';
  } finally {
    if (controlOrdenesNotasSave) controlOrdenesNotasSave.disabled = false;
  }
}

async function cerrarControlOrden(row) {
  if (!row?.id) return;
  const decision = await openControlOrdenDecision(row.articulo || '');
  if (!decision) return;
  const estado = decision === 'complete' ? 1 : decision === 'incomplete' ? 2 : 0;
  if (estado !== 0 && (!row.cantNotas || row.cantNotas <= 0)) {
    alert('Para finalizar debe agregar una nota');
    return;
  }
  try {
    const res = await fetch('/api/control-ordenes/cerrar', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ id_compra: row.id, estado }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'No se pudo cerrar la orden');
    row.ordenControlada = data.ordenControlada ?? estado;
    applyControlOrdenesFilters();
  } catch (error) {
    alert(error.message || 'Error al cerrar la orden.');
  }
}

async function exportControlOrdenesXlsx() {
  if (!window.XLSX) await loadXlsxLibrary();
  if (!window.XLSX) throw new Error('XLSX no disponible');
  const params = buildControlOrdenesExportParams();
  const url = params.toString() ? `/api/control-ordenes?${params.toString()}` : '/api/control-ordenes';
  const res = await fetch(url, { credentials: 'include' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'No se pudo exportar.');
  const rows = (data.data || []).map((row) => normalizeControlOrdenRow(row));
  const headers = [
    'Orden',
    'Articulo',
    'Detalle',
    'Cantidad',
    'Fecha',
    'Observaciones',
    'PVenta',
    'Notas',
    'Proveedor',
    'PreOrigen',
    'Estado',
  ];
  const sheetRows = rows.map((row) => [
    row.orden,
    row.articulo,
    row.detalle,
    row.cantidad ?? 0,
    row.fecha,
    row.observaciones,
    row.pventa ?? 0,
    row.cantNotas ?? 0,
    row.proveedor,
    row.precioArgen ?? 0,
    getControlOrdenEstadoLabel(row.ordenControlada),
  ]);
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...sheetRows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Ordenes');
  XLSX.writeFile(workbook, 'ordenes_compra.xlsx');
}

function initControlOrdenes() {
  if (!viewControlOrdenes) return;
  updateControlOrdenesBuscarState();
  if (controlOrdenesEstado && !controlOrdenesEstadoDefaulted) {
    Array.from(controlOrdenesEstado.options || []).forEach((opt) => {
      opt.selected = opt.value === 'all';
    });
    controlOrdenesEstadoDefaulted = true;
  }
  if (controlOrdenesRefreshBtn) {
    controlOrdenesRefreshBtn.addEventListener('click', () => loadControlOrdenes());
  }
  if (controlOrdenesEstado) {
    controlOrdenesEstado.addEventListener('change', () => {
      updateControlOrdenesBuscarState();
      loadControlOrdenes();
    });
  }
  if (controlOrdenesDesde) {
    controlOrdenesDesde.addEventListener('change', () => {
      updateControlOrdenesBuscarState();
      loadControlOrdenes();
    });
  }
  if (controlOrdenesHasta) {
    controlOrdenesHasta.addEventListener('change', () => {
      updateControlOrdenesBuscarState();
      loadControlOrdenes();
    });
  }
  if (controlOrdenesOrdenInput) {
    controlOrdenesOrdenInput.addEventListener('input', () => {
      if (controlOrdenesOrdenTimer) clearTimeout(controlOrdenesOrdenTimer);
      controlOrdenesOrdenTimer = setTimeout(() => {
        controlOrdenesPage = 1;
        loadControlOrdenes({ page: 1 });
      }, 300);
    });
  }
  if (controlOrdenesSearchInput) {
    controlOrdenesSearchInput.addEventListener('input', (e) => {
      controlOrdenesSearchTerm = (e.target.value || '').trim().toLowerCase();
      controlOrdenesPage = 1;
      loadControlOrdenes({ page: 1 });
    });
  }
  const filterInputs = [
    { el: controlOrdenesFilterOrden, key: 'orden' },
    { el: controlOrdenesFilterArticulo, key: 'articulo' },
    { el: controlOrdenesFilterDetalle, key: 'detalle' },
    { el: controlOrdenesFilterFecha, key: 'fecha' },
    { el: controlOrdenesFilterProveedor, key: 'proveedor' },
  ];
  filterInputs.forEach(({ el, key }) => {
    if (!el) return;
    el.addEventListener('input', (e) => {
      controlOrdenesFilters[key] = (e.target.value || '').trim().toLowerCase();
      applyControlOrdenesFilters();
    });
  });
  if (controlOrdenesTableBody) {
    controlOrdenesTableBody.addEventListener('click', (e) => {
      const notasBtn = e.target.closest('.co-notas-btn');
      if (notasBtn) {
        const id = Number(notasBtn.dataset.id);
        const orden = notasBtn.dataset.orden || '';
        openControlOrdenNotas(id, orden);
        return;
      }
      const closeBtn = e.target.closest('.co-close-btn');
      if (closeBtn) {
        const id = Number(closeBtn.dataset.id);
        const row = controlOrdenesRows.find((r) => Number(r.id) === id);
        if (row) cerrarControlOrden(row);
      }
    });
  }
  if (controlOrdenesCards) {
    controlOrdenesCards.addEventListener('click', (e) => {
      const toggle = e.target.closest('.orden-card-menu-toggle');
      if (toggle) {
        const menu = toggle.closest('.orden-card-actions')?.querySelector('.orden-card-menu');
        if (menu) {
          const isOpen = menu.classList.contains('open');
          controlOrdenesCards.querySelectorAll('.orden-card-menu.open').forEach((m) => m.classList.remove('open'));
          menu.classList.toggle('open', !isOpen);
        }
        return;
      }
      const notasBtn = e.target.closest('.orden-card-notas-btn');
      if (notasBtn) {
        const card = notasBtn.closest('.orden-card');
        const id = Number(card?.dataset.id);
        const orden = card?.dataset.orden || '';
        openControlOrdenNotas(id, orden);
        return;
      }
      const closeBtn = e.target.closest('.orden-card-close-btn');
      if (closeBtn) {
        const card = closeBtn.closest('.orden-card');
        const id = Number(card?.dataset.id);
        const row = controlOrdenesRows.find((r) => Number(r.id) === id);
        if (row) cerrarControlOrden(row);
        return;
      }
    });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.orden-card')) {
        controlOrdenesCards.querySelectorAll('.orden-card-menu.open').forEach((m) => m.classList.remove('open'));
      }
    });
  }
  if (controlOrdenesExportBtn) {
    controlOrdenesExportBtn.addEventListener('click', () => {
      exportControlOrdenesXlsx().catch((err) => {
        alert(err.message || 'No se pudo exportar.');
      });
    });
  }
  if (controlOrdenesPrev) {
    controlOrdenesPrev.addEventListener('click', () => {
      if (controlOrdenesPage > 1) {
        loadControlOrdenes({ page: controlOrdenesPage - 1 });
      }
    });
  }
  if (controlOrdenesNext) {
    controlOrdenesNext.addEventListener('click', () => {
      if (controlOrdenesPage < controlOrdenesTotalPages) {
        loadControlOrdenes({ page: controlOrdenesPage + 1 });
      }
    });
  }
  if (controlOrdenesNotasClose) controlOrdenesNotasClose.addEventListener('click', closeControlOrdenNotas);
  if (controlOrdenesNotasOverlay) {
    controlOrdenesNotasOverlay.addEventListener('click', (e) => {
      if (e.target === controlOrdenesNotasOverlay) closeControlOrdenNotas();
    });
  }
  if (controlOrdenesNotasSave) controlOrdenesNotasSave.addEventListener('click', saveControlOrdenNota);
  if (controlOrdenesNotasList) {
    controlOrdenesNotasList.addEventListener('click', async (e) => {
      const delBtn = e.target.closest('.nota-delete-btn');
      if (delBtn) {
        const note = delBtn.closest('.carritos-nota');
        const noteId = Number(note?.dataset.id);
        if (!noteId) return;
        if (!confirm('Eliminar nota?')) return;
        try {
          if (controlOrdenesNotasStatus) controlOrdenesNotasStatus.textContent = 'Eliminando...';
          const res = await fetch(`/api/control-ordenes/notas/${encodeURIComponent(noteId)}`, {
            method: 'DELETE',
            credentials: 'include',
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.message || 'No se pudo eliminar la nota');
          await loadControlOrdenNotas();
          if (controlOrdenesNotasStatus) controlOrdenesNotasStatus.textContent = 'Nota eliminada.';
        } catch (error) {
          if (controlOrdenesNotasStatus) controlOrdenesNotasStatus.textContent = error.message || 'Error al eliminar nota.';
        }
        return;
      }
      const note = e.target.closest('.carritos-nota');
      if (note) {
        controlOrdenesNotasEditingId = Number(note.dataset.id) || null;
        if (controlOrdenesNotasInput) {
          controlOrdenesNotasInput.value = note.dataset.text || '';
          controlOrdenesNotasInput.focus();
        }
        Array.from(controlOrdenesNotasList.querySelectorAll('.carritos-nota')).forEach((node) => {
          node.classList.toggle('active', node === note);
        });
        if (controlOrdenesNotasStatus) controlOrdenesNotasStatus.textContent = 'Editando nota.';
      }
    });
  }
  if (controlOrdenesDecisionClose) {
    controlOrdenesDecisionClose.addEventListener('click', () => closeControlOrdenDecision(null));
  }
  if (controlOrdenesDecisionSinEstado) {
    controlOrdenesDecisionSinEstado.addEventListener('click', () =>
      closeControlOrdenDecision('none')
    );
  }
  if (controlOrdenesDecisionIncompleto) {
    controlOrdenesDecisionIncompleto.addEventListener('click', () =>
      closeControlOrdenDecision('incomplete')
    );
  }
  if (controlOrdenesDecisionCompleto) {
    controlOrdenesDecisionCompleto.addEventListener('click', () =>
      closeControlOrdenDecision('complete')
    );
  }
  if (controlOrdenesDecisionOverlay) {
    controlOrdenesDecisionOverlay.addEventListener('click', (e) => {
      if (e.target === controlOrdenesDecisionOverlay) closeControlOrdenDecision(null);
    });
  }
}


function normalizeCajaRow(row) {
  return {
    fecha: row.Fecha ?? row.fecha ?? '',
    total: Number(row.Total ?? row.total ?? 0),
    estado: row.Estado ?? row.estado ?? '',
  };
}

const cajasCierreState = { rows: [], query: '', page: 1, pageSize: 10 };
const cajasGastosState = { rows: [], query: '', page: 1, pageSize: 10, fecha: '' };
const cajasFacturasState = { rows: [], query: '', page: 1, pageSize: 10 };
const cajasFacturaItemsState = { rows: [], query: '', page: 1, pageSize: 10 };
const cajasControlState = { rows: [], query: '', page: 1, pageSize: 10, fecha: '' };
const cajasControlFacturasState = { rows: [], query: '', page: 1, pageSize: 10, fecha: '', tipo: 0 };

function filterRows(rows, query, keys) {
  if (!query) return rows;
  const q = query.toLowerCase();
  return rows.filter((row) =>
    keys.some((key) => String(row[key] ?? '').toLowerCase().includes(q))
  );
}

function paginateRows(rows, page, pageSize) {
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    page: safePage,
    totalPages,
    slice: rows.slice(start, start + pageSize),
  };
}

function renderCajasCierreTable(rows) {
  if (!cajasCierreTableBody) return;
  cajasCierreTableBody.innerHTML = '';
  rows.forEach((row) => {
    const isAbierta = row.estado === 'Caja Abierta';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeAttr(row.fecha)}</td>
      <td>${formatMoney(row.total)}</td>
      <td>${escapeAttr(row.estado)}</td>
      <td>
        <button type="button" class="caja-ver-btn" data-fecha="${escapeAttr(row.fecha)}">Ver</button>
        <button type="button" class="caja-control-btn" data-fecha="${escapeAttr(row.fecha)}">Control</button>
        <button type="button" class="caja-gastos-btn" data-fecha="${escapeAttr(row.fecha)}">Gastos</button>
        ${
          isAbierta
            ? `<button type="button" class="caja-cerrar-btn" data-fecha="${escapeAttr(row.fecha)}">Cerrar Caja</button>`
            : `<button type="button" class="caja-abrir-btn" data-fecha="${escapeAttr(row.fecha)}">Abrir Caja</button>`
        }
      </td>
    `;
    cajasCierreTableBody.appendChild(tr);
  });
}

function renderCajasCierreCards(rows) {
  if (!cajasCierreCards) return;
  cajasCierreCards.innerHTML = '';
  rows.forEach((row) => {
    const cls = row.estado === 'Caja Abierta' ? 'caja-card--abierta' : 'caja-card--cerrada';
    const isAbierta = row.estado === 'Caja Abierta';
    const card = document.createElement('div');
    card.className = `caja-card ${cls}`.trim();
    card.innerHTML = `
      <div class="caja-card-header">
        <div>
          <p class="caja-card-title">${escapeAttr(row.fecha)}</p>
          <p class="caja-card-sub">${escapeAttr(row.estado)}</p>
        </div>
      </div>
      <div class="caja-card-grid">
        <div>
          <div class="caja-card-label">Total</div>
          <div class="caja-card-value">${formatMoney(row.total)}</div>
        </div>
      </div>
      <div class="caja-card-actions">
        <button type="button" class="caja-ver-btn" data-fecha="${escapeAttr(row.fecha)}">Ver</button>
        <button type="button" class="caja-control-btn" data-fecha="${escapeAttr(row.fecha)}">Control</button>
        <button type="button" class="caja-gastos-btn" data-fecha="${escapeAttr(row.fecha)}">Gastos</button>
        ${
          isAbierta
            ? `<button type="button" class="caja-cerrar-btn" data-fecha="${escapeAttr(row.fecha)}">Cerrar</button>`
            : `<button type="button" class="caja-abrir-btn" data-fecha="${escapeAttr(row.fecha)}">Abrir Caja</button>`
        }
      </div>
    `;
    cajasCierreCards.appendChild(card);
  });
}

function renderCajasCierreView() {
  const filtered = filterRows(cajasCierreState.rows, cajasCierreState.query, [
    'fecha',
    'total',
    'estado',
  ]);
  const { page, totalPages, slice } = paginateRows(
    filtered,
    cajasCierreState.page,
    cajasCierreState.pageSize
  );
  cajasCierreState.page = page;
  renderCajasCierreTable(slice);
  renderCajasCierreCards(slice);
  if (cajasCierrePageInfo) cajasCierrePageInfo.textContent = `Pagina ${page} de ${totalPages}`;
  if (cajasCierrePrev) cajasCierrePrev.disabled = page <= 1;
  if (cajasCierreNext) cajasCierreNext.disabled = page >= totalPages;
  if (cajasCierreStatus)
    cajasCierreStatus.textContent = filtered.length ? `${filtered.length} cierres` : 'Sin cierres.';
}

function renderCajasGastosTable() {
  if (!cajasGastosTableBody) return;
  const filtered = filterRows(cajasGastosState.rows, cajasGastosState.query, [
    'gasto',
    'detalle',
    'importe',
    'fecha',
  ]);
  cajasGastosState.filtered = filtered;
  const { page, totalPages, slice } = paginateRows(filtered, cajasGastosState.page, cajasGastosState.pageSize);
  cajasGastosState.page = page;
  cajasGastosTableBody.innerHTML = '';
  slice.forEach((row, idx) => {
    const absoluteIndex = (page - 1) * cajasGastosState.pageSize + idx;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeAttr(row.gasto)}</td>
      <td>${escapeAttr(row.detalle)}</td>
      <td>${formatMoney(row.importe)}</td>
      <td>${escapeAttr(row.fecha)}</td>
      <td>
        <button type="button" class="caja-gasto-edit-btn" data-id="${row.id}" data-index="${absoluteIndex}">Editar</button>
        <button type="button" class="caja-gasto-delete-btn btn-trash" data-id="${row.id}" data-index="${absoluteIndex}" title="Eliminar" aria-label="Eliminar">Del</button>
      </td>
    `;
    cajasGastosTableBody.appendChild(tr);
  });
  if (cajasGastosPageInfo) cajasGastosPageInfo.textContent = `Pagina ${page} de ${totalPages}`;
  if (cajasGastosPrev) cajasGastosPrev.disabled = page <= 1;
  if (cajasGastosNext) cajasGastosNext.disabled = page >= totalPages;
  if (cajasGastosStatus) cajasGastosStatus.textContent = filtered.length ? `${filtered.length} gastos` : 'Sin gastos.';
}

function renderCajasFacturasTable() {
  if (!cajasFacturasTableBody) return;
  const filtered = filterRows(cajasFacturasState.rows, cajasFacturasState.query, [
    'nroFactura',
    'cliente',
    'total',
    'porcentaje',
    'descuento',
  ]);
  const { page, totalPages, slice } = paginateRows(filtered, cajasFacturasState.page, cajasFacturasState.pageSize);
  cajasFacturasState.page = page;
  cajasFacturasTableBody.innerHTML = '';
  slice.forEach((row) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeAttr(row.nroFactura)}</td>
      <td>${formatMoney(row.total)}</td>
      <td>${row.porcentaje ?? ''}</td>
      <td>${row.descuento ?? ''}</td>
      <td>${escapeAttr(row.cliente)}</td>
      <td><button type="button" class="caja-factura-items-btn" data-factura="${escapeAttr(row.nroFactura)}">Ver</button></td>
    `;
    cajasFacturasTableBody.appendChild(tr);
  });
  if (cajasFacturasPageInfo) cajasFacturasPageInfo.textContent = `Pagina ${page} de ${totalPages}`;
  if (cajasFacturasPrev) cajasFacturasPrev.disabled = page <= 1;
  if (cajasFacturasNext) cajasFacturasNext.disabled = page >= totalPages;
  if (cajasFacturasStatus) cajasFacturasStatus.textContent = filtered.length ? `${filtered.length} facturas` : 'Sin facturas.';
}

function renderCajasFacturaItemsTable() {
  if (!cajasFacturaItemsTableBody) return;
  const filtered = filterRows(cajasFacturaItemsState.rows, cajasFacturaItemsState.query, [
    'articulo',
    'detalle',
    'cantidad',
    'precioUnitario',
    'precioVenta',
  ]);
  const { page, totalPages, slice } = paginateRows(
    filtered,
    cajasFacturaItemsState.page,
    cajasFacturaItemsState.pageSize
  );
  cajasFacturaItemsState.page = page;
  cajasFacturaItemsTableBody.innerHTML = '';
  slice.forEach((row) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeAttr(row.articulo)}</td>
      <td>${escapeAttr(row.detalle)}</td>
      <td>${row.cantidad ?? 0}</td>
      <td>${formatMoney(row.precioUnitario)}</td>
      <td>${formatMoney(row.precioVenta)}</td>
    `;
    cajasFacturaItemsTableBody.appendChild(tr);
  });
  if (cajasFacturaItemsPageInfo) cajasFacturaItemsPageInfo.textContent = `Pagina ${page} de ${totalPages}`;
  if (cajasFacturaItemsPrev) cajasFacturaItemsPrev.disabled = page <= 1;
  if (cajasFacturaItemsNext) cajasFacturaItemsNext.disabled = page >= totalPages;
  if (cajasFacturaItemsStatus)
    cajasFacturaItemsStatus.textContent = filtered.length ? `${filtered.length} items` : 'Sin items.';
}

function renderCajasControlTable() {
  if (!cajasControlTableBody) return;
  const filtered = filterRows(cajasControlState.rows, cajasControlState.query, [
    'tipoPago',
    'cantidad',
    'total',
  ]);
  cajasControlState.filtered = filtered;
  const { page, totalPages, slice } = paginateRows(filtered, cajasControlState.page, cajasControlState.pageSize);
  cajasControlState.page = page;
  cajasControlTableBody.innerHTML = '';
  slice.forEach((row, idx) => {
    const absoluteIndex = (page - 1) * cajasControlState.pageSize + idx;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><img class="caja-control-img" src="/refresh/${escapeAttr(row.icono)}" alt="${escapeAttr(row.tipoPago)}" /></td>
      <td><button type="button" class="caja-control-cantidad" data-index="${absoluteIndex}">${row.cantidad}</button></td>
      <td>${formatMoney(row.total)}</td>
    `;
    cajasControlTableBody.appendChild(tr);
  });
  if (cajasControlPageInfo) cajasControlPageInfo.textContent = `Pagina ${page} de ${totalPages}`;
  if (cajasControlPrev) cajasControlPrev.disabled = page <= 1;
  if (cajasControlNext) cajasControlNext.disabled = page >= totalPages;
  if (cajasControlStatus) cajasControlStatus.textContent = filtered.length ? `${filtered.length} pagos` : 'Sin pagos.';
}

function renderCajasControlFacturasTable() {
  if (!cajasControlFacturasTableBody) return;
  const filtered = filterRows(cajasControlFacturasState.rows, cajasControlFacturasState.query, [
    'nroFactura',
    'cliente',
    'total',
    'porcentaje',
    'descuento',
  ]);
  cajasControlFacturasState.filtered = filtered;
  const { page, totalPages, slice } = paginateRows(
    filtered,
    cajasControlFacturasState.page,
    cajasControlFacturasState.pageSize
  );
  cajasControlFacturasState.page = page;
  cajasControlFacturasTableBody.innerHTML = '';
  slice.forEach((row) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeAttr(row.nroFactura)}</td>
      <td>${formatMoney(row.total)}</td>
      <td>${row.porcentaje ?? ''}</td>
      <td>${row.descuento ?? ''}</td>
      <td>${escapeAttr(row.cliente)}</td>
    `;
    cajasControlFacturasTableBody.appendChild(tr);
  });
  if (cajasControlFacturasPageInfo)
    cajasControlFacturasPageInfo.textContent = `Pagina ${page} de ${totalPages}`;
  if (cajasControlFacturasPrev) cajasControlFacturasPrev.disabled = page <= 1;
  if (cajasControlFacturasNext) cajasControlFacturasNext.disabled = page >= totalPages;
  if (cajasControlFacturasStatus)
    cajasControlFacturasStatus.textContent = filtered.length ? `${filtered.length} facturas` : 'Sin facturas.';
}

async function loadCajasCierre() {
  if (!viewCajasCierre || viewCajasCierre.classList.contains('hidden')) return;
  if (cajasCierreStatus) cajasCierreStatus.textContent = 'Cargando...';
  try {
    const res = await fetch('/api/cajas/cierres', { credentials: 'include' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'No se pudieron cargar los cierres');
    cajasCierreRows = (data.data || []).map((row) => normalizeCajaRow(row));
    cajasCierreState.rows = cajasCierreRows;
    cajasCierreState.page = 1;
    renderCajasCierreView();
  } catch (error) {
    if (cajasCierreStatus) cajasCierreStatus.textContent = error.message || 'Error al cargar cierres.';
  }
}

async function loadCajasGastos(fecha) {
  if (!fecha) return;
  if (cajasGastosStatus) cajasGastosStatus.textContent = 'Cargando...';
  if (cajasGastosTitle) cajasGastosTitle.textContent = `Gastos - ${fecha}`;
  if (cajasGastosTableBody) cajasGastosTableBody.innerHTML = '';
  try {
    const res = await fetch(`/api/cajas/gastos?fecha=${encodeURIComponent(fecha)}`, {
      credentials: 'include',
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'No se pudieron cargar los gastos');
    cajasGastosState.fecha = fecha;
    cajasGastosState.rows = (data.data || []).map((row) => ({
      id: row.Id ?? row.id ?? 0,
      gasto: row.Nbr_Gasto ?? row.gasto ?? '',
      detalle: row.Detalle ?? row.descripcion ?? '',
      importe: Number(row.Importe ?? row.importe ?? 0),
      fecha: row.Fecha ?? row.fecha ?? '',
    }));
    cajasGastosState.page = 1;
    renderCajasGastosTable();
  } catch (error) {
    if (cajasGastosStatus) cajasGastosStatus.textContent = error.message || 'Error al cargar gastos.';
  }
}

function openCajasGastos(fecha) {
  if (!cajasGastosOverlay) return;
  if (cajasGastosSearch) cajasGastosSearch.value = '';
  if (cajasGastoId) cajasGastoId.value = '';
  if (cajasGastoNombre) cajasGastoNombre.value = '';
  if (cajasGastoDetalle) cajasGastoDetalle.value = '';
  if (cajasGastoImporte) cajasGastoImporte.value = '';
  cajasGastosState.query = '';
  cajasGastosState.page = 1;
  cajasGastosOverlay.classList.add('open');
  loadCajasGastos(fecha);
}

async function cerrarCaja(fecha) {
  if (!fecha) return;
  if (!confirm(`Esta seguro que desea cerrar la caja con fecha: ${fecha}?`)) return;
  try {
    if (cajasCierreStatus) cajasCierreStatus.textContent = 'Cerrando caja...';
    const res = await fetch('/api/cajas/cerrar', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ fecha }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'No se pudo cerrar la caja');
    await loadCajasCierre();
    alert(`Caja ${fecha} Cerrada`);
  } catch (error) {
    if (cajasCierreStatus) cajasCierreStatus.textContent = error.message || 'Error al cerrar caja.';
  }
}

async function abrirCaja(fecha) {
  if (!fecha) return;
  if (!confirm(`Esta seguro que desea abrir la caja con fecha: ${fecha}?`)) return;
  try {
    if (cajasCierreStatus) cajasCierreStatus.textContent = 'Abriendo caja...';
    const res = await fetch('/api/cajas/abrir', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ fecha }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'No se pudo abrir la caja');
    await loadCajasCierre();
    alert(`Caja ${fecha} Abierta`);
  } catch (error) {
    if (cajasCierreStatus) cajasCierreStatus.textContent = error.message || 'Error al abrir caja.';
  }
}

async function loadCajasFacturas(fecha) {
  if (!fecha) return;
  if (cajasFacturasStatus) cajasFacturasStatus.textContent = 'Cargando...';
  if (cajasFacturasTitle) cajasFacturasTitle.textContent = `Cierre de Caja - ${fecha}`;
  if (cajasFacturasTableBody) cajasFacturasTableBody.innerHTML = '';
  try {
    const res = await fetch(`/api/cajas/facturas?fecha=${encodeURIComponent(fecha)}`, {
      credentials: 'include',
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'No se pudieron cargar las facturas');
    cajasFacturasState.rows = (data.data || []).map((row) => ({
      nroFactura: row.NroFactura ?? row.nroFactura ?? '',
      total: Number(row.Total ?? row.total ?? 0),
      porcentaje: row.Porcentaje ?? row.porcentaje ?? '',
      descuento: row.Descuento ?? row.descuento ?? '',
      cliente: row.Cliente ?? row.cliente ?? '',
    }));
    cajasFacturasState.page = 1;
    renderCajasFacturasTable();
  } catch (error) {
    if (cajasFacturasStatus) cajasFacturasStatus.textContent = error.message || 'Error al cargar facturas.';
  }
}

function openCajasFacturas(fecha) {
  if (!cajasFacturasOverlay) return;
  if (cajasFacturasSearch) cajasFacturasSearch.value = '';
  cajasFacturasState.query = '';
  cajasFacturasState.page = 1;
  cajasFacturasOverlay.classList.add('open');
  loadCajasFacturas(fecha);
}

async function loadCajasFacturaItems(nroFactura) {
  if (!nroFactura) return;
  if (cajasFacturaItemsStatus) cajasFacturaItemsStatus.textContent = 'Cargando...';
  if (cajasFacturaItemsTitle) cajasFacturaItemsTitle.textContent = `Factura Nro ${nroFactura}`;
  if (cajasFacturaItemsTableBody) cajasFacturaItemsTableBody.innerHTML = '';
  try {
    const res = await fetch(`/api/cajas/factura-items?nroFactura=${encodeURIComponent(nroFactura)}`, {
      credentials: 'include',
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'No se pudieron cargar los items');
    cajasFacturaItemsState.rows = (data.data || []).map((row) => ({
      articulo: row.Articulo ?? row.articulo ?? '',
      detalle: row.Detalle ?? row.detalle ?? '',
      cantidad: row.Cantidad ?? row.cantidad ?? 0,
      precioUnitario: Number(row.PrecioUnitario ?? row.precioUnitario ?? 0),
      precioVenta: Number(row.PrecioVenta ?? row.precioVenta ?? 0),
    }));
    cajasFacturaItemsState.page = 1;
    renderCajasFacturaItemsTable();
  } catch (error) {
    if (cajasFacturaItemsStatus) cajasFacturaItemsStatus.textContent = error.message || 'Error al cargar items.';
  }
}
function openCajasFacturaItems(nroFactura) {
  if (!cajasFacturaItemsOverlay) return;
  if (cajasFacturaItemsSearch) cajasFacturaItemsSearch.value = '';
  cajasFacturaItemsState.query = '';
  cajasFacturaItemsState.page = 1;
  cajasFacturaItemsOverlay.classList.add('open');
  loadCajasFacturaItems(nroFactura);
}

async function loadCajasControl(fecha) {
  if (!fecha) return;
  if (cajasControlStatus) cajasControlStatus.textContent = 'Cargando...';
  if (cajasControlTitle) cajasControlTitle.textContent = `Control de Caja - ${fecha}`;
  if (cajasControlTableBody) cajasControlTableBody.innerHTML = '';
  try {
    const res = await fetch(`/api/cajas/control?fecha=${encodeURIComponent(fecha)}`, {
      credentials: 'include',
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'No se pudieron cargar los pagos');
    cajasControlState.fecha = fecha;
    cajasControlState.rows = (data.data || []).map((row) => ({
      tipoPago: row.tipo_pago || row.tipoPago || '',
      icono: row.tipo_pago_imagen || row.icono || '',
      idTipoPago: row.id_tipo_pago || row.idTipoPago || 0,
      cantidad: Number(row.cantidad || 0),
      total: Number(row.Total || row.total || 0),
    }));
    cajasControlState.page = 1;
    renderCajasControlTable();
  } catch (error) {
    if (cajasControlStatus) cajasControlStatus.textContent = error.message || 'Error al cargar pagos.';
  }
}

function openCajasControl(fecha) {
  if (!cajasControlOverlay) return;
  if (cajasControlSearch) cajasControlSearch.value = '';
  cajasControlState.query = '';
  cajasControlState.page = 1;
  cajasControlOverlay.classList.add('open');
  loadCajasControl(fecha);
}

async function loadCajasControlFacturas(fecha, tipoPago) {
  if (!fecha || !tipoPago) return;
  if (cajasControlFacturasStatus) cajasControlFacturasStatus.textContent = 'Cargando...';
  if (cajasControlFacturasTitle)
    cajasControlFacturasTitle.textContent = `Facturas - ${fecha}`;
  if (cajasControlFacturasTableBody) cajasControlFacturasTableBody.innerHTML = '';
  try {
    const res = await fetch(
      `/api/cajas/control-facturas?fecha=${encodeURIComponent(fecha)}&id_tipo_pago=${encodeURIComponent(
        tipoPago
      )}`,
      { credentials: 'include' }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'No se pudieron cargar las facturas');
    cajasControlFacturasState.fecha = fecha;
    cajasControlFacturasState.tipo = tipoPago;
    cajasControlFacturasState.rows = (data.data || []).map((row) => ({
      nroFactura: row.NroFactura || row.nroFactura || '',
      total: Number(row.Total || row.total || 0),
      porcentaje: row.Porcentaje ?? row.porcentaje ?? '',
      descuento: row.Descuento ?? row.descuento ?? '',
      cliente: row.Cliente || row.cliente || '',
    }));
    cajasControlFacturasState.page = 1;
    renderCajasControlFacturasTable();
  } catch (error) {
    if (cajasControlFacturasStatus)
      cajasControlFacturasStatus.textContent = error.message || 'Error al cargar facturas.';
  }
}

function openCajasControlFacturas(fecha, tipoPago) {
  if (!cajasControlFacturasOverlay) return;
  if (cajasControlFacturasSearch) cajasControlFacturasSearch.value = '';
  cajasControlFacturasState.query = '';
  cajasControlFacturasState.page = 1;
  cajasControlFacturasOverlay.classList.add('open');
  loadCajasControlFacturas(fecha, tipoPago);
}

async function saveCajasGasto() {
  if (!cajasGastoNombre || !cajasGastoImporte) return;
  const id = Number(cajasGastoId?.value || cajasGastoSave?.dataset?.id || 0);
  const payload = {
    Nbr_Gasto: cajasGastoNombre.value.trim(),
    Detalle: cajasGastoDetalle?.value.trim() || '',
    Importe: Number(cajasGastoImporte.value || 0),
    Fecha: cajasGastosState.fecha || '',
  };
  if (!payload.Nbr_Gasto) {
    alert('Debe ingresar el nombre del gasto.');
    return;
  }
  if (!payload.Fecha) {
    alert('Debe seleccionar la fecha.');
    return;
  }
  try {
    if (cajasGastosStatus) cajasGastosStatus.textContent = id ? 'Actualizando gasto...' : 'Guardando gasto...';
    const res = await fetch(id ? `/api/cajas/gastos/${id}` : '/api/cajas/gastos', {
      method: id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'No se pudo guardar el gasto');
    resetCajasGastoForm();
    await loadCajasGastos(cajasGastosState.fecha || payload.Fecha);
  } catch (error) {
    if (cajasGastosStatus) cajasGastosStatus.textContent = error.message || 'Error al guardar gasto.';
  }
}

function fillCajasGastoForm(row) {
  if (!row) return;
  if (cajasGastoId) cajasGastoId.value = row.id ? String(row.id) : '';
  if (cajasGastoSave) cajasGastoSave.dataset.id = row.id ? String(row.id) : '';
  if (cajasGastoNombre) cajasGastoNombre.value = row.gasto || '';
  if (cajasGastoDetalle) cajasGastoDetalle.value = row.detalle || '';
  if (cajasGastoImporte) cajasGastoImporte.value = row.importe ?? '';
}

function resetCajasGastoForm() {
  if (cajasGastoId) cajasGastoId.value = '';
  if (cajasGastoSave) delete cajasGastoSave.dataset.id;
  if (cajasGastoNombre) cajasGastoNombre.value = '';
  if (cajasGastoDetalle) cajasGastoDetalle.value = '';
  if (cajasGastoImporte) cajasGastoImporte.value = '';
}

async function deleteCajasGasto(id) {
  if (!id) return;
  if (!confirm('Esta seguro que desea eliminar el gasto?')) return;
  try {
    if (cajasGastosStatus) cajasGastosStatus.textContent = 'Eliminando gasto...';
    const res = await fetch(`/api/cajas/gastos/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'No se pudo eliminar el gasto');
    await loadCajasGastos(cajasGastosState.fecha);
    resetCajasGastoForm();
  } catch (error) {
    if (cajasGastosStatus) cajasGastosStatus.textContent = error.message || 'Error al eliminar gasto.';
  }
}


function initCajasCierre() {
  if (!viewCajasCierre) return;
  if (cajasCierreRefreshBtn) cajasCierreRefreshBtn.addEventListener('click', loadCajasCierre);
  if (cajasCierreExportBtn) {
    cajasCierreExportBtn.addEventListener('click', () => {
      exportCajasCierreXlsx().catch((err) => alert(err.message || 'No se pudo exportar.'));
    });
  }
  if (cajasCierreTableBody) {
    cajasCierreTableBody.addEventListener('click', (e) => {
      const gastosBtn = e.target.closest('.caja-gastos-btn');
      if (gastosBtn) {
        openCajasGastos(gastosBtn.dataset.fecha || '');
        return;
      }
      const cerrarBtn = e.target.closest('.caja-cerrar-btn');
      if (cerrarBtn) {
        cerrarCaja(cerrarBtn.dataset.fecha || '');
        return;
      }
      const controlBtn = e.target.closest('.caja-control-btn');
      if (controlBtn) {
        openCajasControl(controlBtn.dataset.fecha || '');
        return;
      }
      const abrirBtn = e.target.closest('.caja-abrir-btn');
      if (abrirBtn) {
        abrirCaja(abrirBtn.dataset.fecha || '');
        return;
      }
      const verBtn = e.target.closest('.caja-ver-btn');
      if (verBtn) {
        const fecha = verBtn.dataset.fecha || '';
        openCajasFacturas(fecha);
      }
    });
  }
  if (cajasCierreCards) {
    cajasCierreCards.addEventListener('click', (e) => {
      const gastosBtn = e.target.closest('.caja-gastos-btn');
      if (gastosBtn) {
        openCajasGastos(gastosBtn.dataset.fecha || '');
        return;
      }
      const cerrarBtn = e.target.closest('.caja-cerrar-btn');
      if (cerrarBtn) {
        cerrarCaja(cerrarBtn.dataset.fecha || '');
        return;
      }
      const controlBtn = e.target.closest('.caja-control-btn');
      if (controlBtn) {
        openCajasControl(controlBtn.dataset.fecha || '');
        return;
      }
      const abrirBtn = e.target.closest('.caja-abrir-btn');
      if (abrirBtn) {
        abrirCaja(abrirBtn.dataset.fecha || '');
        return;
      }
      const verBtn = e.target.closest('.caja-ver-btn');
      if (verBtn) {
        const fecha = verBtn.dataset.fecha || '';
        openCajasFacturas(fecha);
      }
    });
  }
  if (cajasGastosClose) cajasGastosClose.addEventListener('click', () => cajasGastosOverlay?.classList.remove('open'));
  if (cajasGastosOverlay) {
    cajasGastosOverlay.addEventListener('click', (e) => {
      if (e.target === cajasGastosOverlay) cajasGastosOverlay.classList.remove('open');
    });
  }
  if (cajasCierreSearch) {
    cajasCierreSearch.addEventListener('input', () => {
      cajasCierreState.query = cajasCierreSearch.value.trim();
      cajasCierreState.page = 1;
      renderCajasCierreView();
    });
  }
  if (cajasCierrePrev) {
    cajasCierrePrev.addEventListener('click', () => {
      cajasCierreState.page = Math.max(1, cajasCierreState.page - 1);
      renderCajasCierreView();
    });
  }
  if (cajasCierreNext) {
    cajasCierreNext.addEventListener('click', () => {
      cajasCierreState.page += 1;
      renderCajasCierreView();
    });
  }
  if (cajasFacturasTableBody) {
    cajasFacturasTableBody.addEventListener('click', (e) => {
      const itemsBtn = e.target.closest('.caja-factura-items-btn');
      if (itemsBtn) {
        openCajasFacturaItems(itemsBtn.dataset.factura || '');
      }
    });
  }
  if (cajasFacturasClose) cajasFacturasClose.addEventListener('click', () => cajasFacturasOverlay?.classList.remove('open'));
  if (cajasFacturasOverlay) {
    cajasFacturasOverlay.addEventListener('click', (e) => {
      if (e.target === cajasFacturasOverlay) cajasFacturasOverlay.classList.remove('open');
    });
  }
  if (cajasControlTableBody) {
    cajasControlTableBody.addEventListener('click', (e) => {
      const qtyBtn = e.target.closest('.caja-control-cantidad');
      if (!qtyBtn) return;
      const idx = Number(qtyBtn.dataset.index || -1);
      const row = cajasControlState.filtered ? cajasControlState.filtered[idx] : null;
      if (row) openCajasControlFacturas(cajasControlState.fecha, row.idTipoPago);
    });
  }
  if (cajasControlSearch) {
    cajasControlSearch.addEventListener('input', () => {
      cajasControlState.query = cajasControlSearch.value.trim();
      cajasControlState.page = 1;
      renderCajasControlTable();
    });
  }
  if (cajasControlPrev) {
    cajasControlPrev.addEventListener('click', () => {
      cajasControlState.page = Math.max(1, cajasControlState.page - 1);
      renderCajasControlTable();
    });
  }
  if (cajasControlNext) {
    cajasControlNext.addEventListener('click', () => {
      cajasControlState.page += 1;
      renderCajasControlTable();
    });
  }
  if (cajasControlExport) {
    cajasControlExport.addEventListener('click', () => {
      exportCajasControlXlsx().catch((err) => alert(err.message || 'No se pudo exportar.'));
    });
  }
  if (cajasControlClose) cajasControlClose.addEventListener('click', () => cajasControlOverlay?.classList.remove('open'));
  if (cajasControlOverlay) {
    cajasControlOverlay.addEventListener('click', (e) => {
      if (e.target === cajasControlOverlay) cajasControlOverlay.classList.remove('open');
    });
  }
  if (cajasControlFacturasSearch) {
    cajasControlFacturasSearch.addEventListener('input', () => {
      cajasControlFacturasState.query = cajasControlFacturasSearch.value.trim();
      cajasControlFacturasState.page = 1;
      renderCajasControlFacturasTable();
    });
  }
  if (cajasControlFacturasPrev) {
    cajasControlFacturasPrev.addEventListener('click', () => {
      cajasControlFacturasState.page = Math.max(1, cajasControlFacturasState.page - 1);
      renderCajasControlFacturasTable();
    });
  }
  if (cajasControlFacturasNext) {
    cajasControlFacturasNext.addEventListener('click', () => {
      cajasControlFacturasState.page += 1;
      renderCajasControlFacturasTable();
    });
  }
  if (cajasControlFacturasExport) {
    cajasControlFacturasExport.addEventListener('click', () => {
      exportCajasControlFacturasXlsx().catch((err) => alert(err.message || 'No se pudo exportar.'));
    });
  }
  if (cajasControlFacturasClose)
    cajasControlFacturasClose.addEventListener('click', () => cajasControlFacturasOverlay?.classList.remove('open'));
  if (cajasControlFacturasOverlay) {
    cajasControlFacturasOverlay.addEventListener('click', (e) => {
      if (e.target === cajasControlFacturasOverlay) cajasControlFacturasOverlay.classList.remove('open');
    });
  }
  attachFloatingModalDrag(cajasGastosOverlay);
  attachFloatingModalDrag(cajasFacturasOverlay);
  attachFloatingModalDrag(cajasFacturaItemsOverlay);
  attachFloatingModalDrag(cajasControlOverlay);
  attachFloatingModalDrag(cajasControlFacturasOverlay);
  if (cajasGastosSearch) {
    cajasGastosSearch.addEventListener('input', () => {
      cajasGastosState.query = cajasGastosSearch.value.trim();
      cajasGastosState.page = 1;
      renderCajasGastosTable();
    });
  }
  if (cajasGastosPrev) {
    cajasGastosPrev.addEventListener('click', () => {
      cajasGastosState.page = Math.max(1, cajasGastosState.page - 1);
      renderCajasGastosTable();
    });
  }
  if (cajasGastosNext) {
    cajasGastosNext.addEventListener('click', () => {
      cajasGastosState.page += 1;
      renderCajasGastosTable();
    });
  }
  if (cajasGastosExport) {
    cajasGastosExport.addEventListener('click', () => {
      exportCajasGastosXlsx().catch((err) => alert(err.message || 'No se pudo exportar.'));
    });
  }
  if (cajasGastosTableBody) {
    cajasGastosTableBody.addEventListener('click', (e) => {
      const editBtn = e.target.closest('.caja-gasto-edit-btn');
      if (editBtn) {
        const id = Number(editBtn.dataset.id || 0);
        let row = null;
        if (Number.isFinite(id) && id > 0) {
          row = cajasGastosState.rows.find((item) => Number(item.id) === id);
        }
        if (!row && cajasGastosState.filtered) {
          const idx = Number(editBtn.dataset.index || -1);
          row = cajasGastosState.filtered[idx];
        }
        if (row) fillCajasGastoForm(row);
        return;
      }
      const deleteBtn = e.target.closest('.caja-gasto-delete-btn');
      if (deleteBtn) {
        const id = Number(deleteBtn.dataset.id || 0);
        let rowId = id;
        if (!Number.isFinite(rowId) || rowId <= 0) {
          const idx = Number(deleteBtn.dataset.index || -1);
          const row = cajasGastosState.filtered ? cajasGastosState.filtered[idx] : null;
          rowId = row?.id || 0;
        }
        deleteCajasGasto(rowId);
      }
    });
  }
  if (cajasGastoSave) cajasGastoSave.addEventListener('click', saveCajasGasto);
  if (cajasGastoCancel) cajasGastoCancel.addEventListener('click', resetCajasGastoForm);
  if (cajasFacturasSearch) {
    cajasFacturasSearch.addEventListener('input', () => {
      cajasFacturasState.query = cajasFacturasSearch.value.trim();
      cajasFacturasState.page = 1;
      renderCajasFacturasTable();
    });
  }
  if (cajasFacturasPrev) {
    cajasFacturasPrev.addEventListener('click', () => {
      cajasFacturasState.page = Math.max(1, cajasFacturasState.page - 1);
      renderCajasFacturasTable();
    });
  }
  if (cajasFacturasNext) {
    cajasFacturasNext.addEventListener('click', () => {
      cajasFacturasState.page += 1;
      renderCajasFacturasTable();
    });
  }
  if (cajasFacturasExport) {
    cajasFacturasExport.addEventListener('click', () => {
      exportCajasFacturasXlsx().catch((err) => alert(err.message || 'No se pudo exportar.'));
    });
  }
  if (cajasFacturaItemsSearch) {
    cajasFacturaItemsSearch.addEventListener('input', () => {
      cajasFacturaItemsState.query = cajasFacturaItemsSearch.value.trim();
      cajasFacturaItemsState.page = 1;
      renderCajasFacturaItemsTable();
    });
  }
  if (cajasFacturaItemsPrev) {
    cajasFacturaItemsPrev.addEventListener('click', () => {
      cajasFacturaItemsState.page = Math.max(1, cajasFacturaItemsState.page - 1);
      renderCajasFacturaItemsTable();
    });
  }
  if (cajasFacturaItemsNext) {
    cajasFacturaItemsNext.addEventListener('click', () => {
      cajasFacturaItemsState.page += 1;
      renderCajasFacturaItemsTable();
    });
  }
  if (cajasFacturaItemsExport) {
    cajasFacturaItemsExport.addEventListener('click', () => {
      exportCajasFacturaItemsXlsx().catch((err) => alert(err.message || 'No se pudo exportar.'));
    });
  }
  if (cajasFacturaItemsClose) cajasFacturaItemsClose.addEventListener('click', () => cajasFacturaItemsOverlay?.classList.remove('open'));
  if (cajasFacturaItemsOverlay) {
    cajasFacturaItemsOverlay.addEventListener('click', (e) => {
      if (e.target === cajasFacturaItemsOverlay) cajasFacturaItemsOverlay.classList.remove('open');
    });
  }
}

async function exportCajasCierreXlsx() {
  if (!window.XLSX) await loadXlsxLibrary();
  if (!window.XLSX) throw new Error('XLSX no disponible');
  const headers = ['Fecha', 'Total', 'Estado'];
  const rows = cajasCierreRows.map((row) => [row.fecha, row.total, row.estado]);
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Cierres');
  XLSX.writeFile(workbook, 'cierres_caja.xlsx');
}

async function exportCajasGastosXlsx() {
  if (!window.XLSX) await loadXlsxLibrary();
  if (!window.XLSX) throw new Error('XLSX no disponible');
  const filtered = filterRows(cajasGastosState.rows, cajasGastosState.query, [
    'gasto',
    'detalle',
    'importe',
    'fecha',
  ]);
  const headers = ['Gasto', 'Detalle', 'Importe', 'Fecha'];
  const rows = filtered.map((row) => [row.gasto, row.detalle, row.importe, row.fecha]);
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Gastos');
  XLSX.writeFile(workbook, 'cajas_gastos.xlsx');
}

async function exportCajasFacturasXlsx() {
  if (!window.XLSX) await loadXlsxLibrary();
  if (!window.XLSX) throw new Error('XLSX no disponible');
  const filtered = filterRows(cajasFacturasState.rows, cajasFacturasState.query, [
    'nroFactura',
    'cliente',
    'total',
    'porcentaje',
    'descuento',
  ]);
  const headers = ['Factura', 'Total', 'Porcentaje', 'Descuento', 'Cliente'];
  const rows = filtered.map((row) => [row.nroFactura, row.total, row.porcentaje, row.descuento, row.cliente]);
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Facturas');
  XLSX.writeFile(workbook, 'cajas_facturas.xlsx');
}

async function exportCajasFacturaItemsXlsx() {
  if (!window.XLSX) await loadXlsxLibrary();
  if (!window.XLSX) throw new Error('XLSX no disponible');
  const filtered = filterRows(cajasFacturaItemsState.rows, cajasFacturaItemsState.query, [
    'articulo',
    'detalle',
    'cantidad',
    'precioUnitario',
    'precioVenta',
  ]);
  const headers = ['Articulo', 'Detalle', 'Cantidad', 'Precio Unitario', 'Precio Venta'];
  const rows = filtered.map((row) => [
    row.articulo,
    row.detalle,
    row.cantidad,
    row.precioUnitario,
    row.precioVenta,
  ]);
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Factura');
  XLSX.writeFile(workbook, 'cajas_factura_items.xlsx');
}

async function exportCajasControlXlsx() {
  if (!window.XLSX) await loadXlsxLibrary();
  if (!window.XLSX) throw new Error('XLSX no disponible');
  const filtered = filterRows(cajasControlState.rows, cajasControlState.query, [
    'tipoPago',
    'cantidad',
    'total',
  ]);
  const headers = ['Tipo Pago', 'Cantidad', 'Total'];
  const rows = filtered.map((row) => [row.tipoPago, row.cantidad, row.total]);
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Control');
  XLSX.writeFile(workbook, 'cajas_control.xlsx');
}

async function exportCajasControlFacturasXlsx() {
  if (!window.XLSX) await loadXlsxLibrary();
  if (!window.XLSX) throw new Error('XLSX no disponible');
  const filtered = filterRows(cajasControlFacturasState.rows, cajasControlFacturasState.query, [
    'nroFactura',
    'cliente',
    'total',
    'porcentaje',
    'descuento',
  ]);
  const headers = ['Factura', 'Total', 'Porcentaje', 'Descuento', 'Cliente'];
  const rows = filtered.map((row) => [
    row.nroFactura,
    row.total,
    row.porcentaje,
    row.descuento,
    row.cliente,
  ]);
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Control');
  XLSX.writeFile(workbook, 'cajas_control_facturas.xlsx');
}

function resolvePermissionKey(target) {
  return target;
}

function attachFloatingModalDrag(overlay) {
  if (!overlay) return;
  const modal = overlay.querySelector('.modal');
  const header = overlay.querySelector('.modal-header');
  if (!modal || !header) return;
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let originLeft = 0;
  let originTop = 0;

  const onMove = (event) => {
    if (!isDragging) return;
    const clientX = event.touches ? event.touches[0].clientX : event.clientX;
    const clientY = event.touches ? event.touches[0].clientY : event.clientY;
    const nextLeft = originLeft + (clientX - startX);
    const nextTop = originTop + (clientY - startY);
    modal.style.left = `${nextLeft}px`;
    modal.style.top = `${nextTop}px`;
    modal.style.transform = 'none';
  };

  const stopDrag = () => {
    isDragging = false;
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', stopDrag);
    document.removeEventListener('touchmove', onMove);
    document.removeEventListener('touchend', stopDrag);
  };

  const startDrag = (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    isDragging = true;
    const rect = modal.getBoundingClientRect();
    originLeft = rect.left;
    originTop = rect.top;
    startX = event.touches ? event.touches[0].clientX : event.clientX;
    startY = event.touches ? event.touches[0].clientY : event.clientY;
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', stopDrag);
    document.addEventListener('touchmove', onMove, { passive: true });
    document.addEventListener('touchend', stopDrag);
  };

  header.addEventListener('mousedown', startDrag);
  header.addEventListener('touchstart', startDrag, { passive: true });
}

function applyMenuPermissions(perms = {}) {
  const navItems = document.querySelectorAll('.menu-item[data-target]');
  navItems.forEach((btn) => {
    const target = btn.dataset.target;
    if (!target) return;
    let allowed = perms[resolvePermissionKey(target)] === true;
    btn.style.display = allowed ? '' : 'none';
  });
  const groups = document.querySelectorAll('.menu-group');
  groups.forEach((group) => {
    const groupKey = group.dataset.group;
    const visibleItems = group.querySelectorAll('.menu-item[data-target]');
    const anyVisible = Array.from(visibleItems).some((btn) => btn.style.display !== 'none');
    const forcedVisible = groupKey === 'pedidos' && perms['pedidos-menu'] === true;
    group.style.display = anyVisible || forcedVisible ? '' : 'none';
  });
}

function getFirstAllowedView(perms = {}) {
    const order = [
      'dashboard',
      'panel-control',
      'cargar-ticket',
      'empleados',
      'clientes',
      'ia',
    'salon',
    'pedidos',
    'pedidos-todos',
    'mercaderia',
    'abm',
    'control-ordenes',
    'cajas',
    'cajas-cierre',
    'facturas',
    'comisiones',
    'configuracion',
  ];
  if (perms['pedidos-menu'] === true && !perms.pedidos && !perms['pedidos-todos']) {
    return 'pedidos';
  }
  return order.find((key) => perms[key] === true) || '';
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
    if (userRoleEl) {
      userRoleEl.textContent = data?.user?.role || 'Equipo';
    }
    currentPermissions = { ...buildEmptyPermissions(), ...(data?.permissions || {}) };
    applyMenuPermissions(currentPermissions);
    const firstAllowed = getFirstAllowedView(currentPermissions);
    if (!firstAllowed && viewNoPermission) {
      switchView('no-permission');
    } else {
      switchView(firstAllowed);
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
if (refreshPaqueteriaControl) {
  refreshPaqueteriaControl.addEventListener('click', () => {
    loadPaqueteria();
  });
}
if (refreshCarritosControl) {
  refreshCarritosControl.addEventListener('click', () => {
    loadCarritosAbandonados();
  });
}
if (refreshPedidosControl) {
  refreshPedidosControl.addEventListener('click', () => {
    loadPedidosControl();
  });
}
if (refreshOperativosControl) {
  refreshOperativosControl.addEventListener('click', () => {
    loadOperativos();
  });
}
if (pedidosTodosRefresh) {
  pedidosTodosRefresh.addEventListener('click', () => {
    loadPedidosTodosSummary();
  });
}
if (pedidosTodosGrid) {
  pedidosTodosGrid.addEventListener('click', (e) => {
    const btn = e.target.closest('.tile-btn');
    if (!btn) return;
    const tipo = btn.dataset.tipo || '';
    if (!tipo) return;
    const labelMap = {
      facturados: 'Facturados',
      enProceso: 'En Proceso',
      pagados: 'Ya Estan Pagos',
      cancelados: 'Cancelados',
      empaquetados: 'Empaquetados',
      todos: 'Todos',
    };
    if (pedidosVendedoraListaTitle) {
      pedidosVendedoraListaTitle.textContent = `Pedidos - ${labelMap[tipo] || ''}`;
    }
    pedidosVendedoraListaOverlay?.classList.add('open');
    if (tipo === 'empaquetados') {
      loadPedidosEmpaquetadosLista();
    } else {
      loadPedidosTodosLista(tipo);
    }
  });
}
  if (pedidosControlTableHead) {
    pedidosControlTableHead.addEventListener('click', (e) => {
      const th = e.target.closest('th[data-sort]');
      if (!th) return;
      const key = th.dataset.sort;
    if (pedidosControlSort.key === key) {
      pedidosControlSort.dir = pedidosControlSort.dir === 'asc' ? 'desc' : 'asc';
    } else {
      pedidosControlSort.key = key;
      pedidosControlSort.dir = 'asc';
    }
    renderPedidosControl(pedidosControlRows);
    });
  }
  if (pedidosControlTableBody) {
    pedidosControlTableBody.addEventListener('click', (e) => {
      const cell = e.target.closest('td');
      if (!cell) return;
      const row = cell.closest('tr');
      if (!row) return;
      const nameCell = row.querySelector('td');
      const vendedora = nameCell?.textContent?.trim() || '';
      if (!vendedora) return;
      if (pedidosVendedoraTitle) pedidosVendedoraTitle.textContent = vendedora;
      if (pedidosVendedoraOverlay) pedidosVendedoraOverlay.classList.add('open');
      loadPedidosVendedora(vendedora);
    });
  }
  if (pedidosVendedoraClose) {
    pedidosVendedoraClose.addEventListener('click', () => {
      pedidosVendedoraOverlay?.classList.remove('open');
    });
  }
  if (pedidosVendedoraOverlay) {
    pedidosVendedoraOverlay.addEventListener('click', (e) => {
      if (e.target === pedidosVendedoraOverlay) pedidosVendedoraOverlay.classList.remove('open');
    });
  }
  if (pedidosVendedoraTableBody) {
    pedidosVendedoraTableBody.addEventListener('click', (e) => {
      const cell = e.target.closest('.pedidos-vendedora-count');
      if (!cell) return;
      const tipo = cell.dataset.tipo;
      if (!tipo) return;
      if (pedidosVendedoraListaTitle) {
        const labelMap = {
          asignados: 'Asignados',
          empaquetados: 'Empaquetados',
          enProceso: 'En Proceso',
          paraFacturar: 'Para Facturar',
        };
        pedidosVendedoraListaTitle.textContent = `${pedidosVendedoraActual} - ${labelMap[tipo] || ''}`;
      }
      pedidosVendedoraListaOverlay?.classList.add('open');
      loadPedidosVendedoraLista(tipo);
    });
  }
  if (pedidosVendedoraListaClose) {
    pedidosVendedoraListaClose.addEventListener('click', () => {
      pedidosVendedoraListaOverlay?.classList.remove('open');
    });
  }
  if (pedidosVendedoraListaOverlay) {
    pedidosVendedoraListaOverlay.addEventListener('click', (e) => {
      if (e.target === pedidosVendedoraListaOverlay) pedidosVendedoraListaOverlay.classList.remove('open');
    });
  }
  if (pedidosVendedoraListaTableEl) {
    pedidosVendedoraListaTableEl.addEventListener('change', async (e) => {
      const select = e.target.closest('.pedido-transporte-select');
      const instanciaSelect = e.target.closest('.pedido-instancia-select');
      if (select) {
        const id = Number(select.dataset.id);
        const transporte = select.value || '';
        const label = select.options?.[select.selectedIndex]?.textContent?.trim() || '';
        select.dataset.transporteLabel = label;
        pedidoTransporteCache.set(Number(id), transporte);
        const card = select.closest('.pedido-card');
        const instanciaSelect = card?.querySelector('.pedido-instancia-select');
        if (instanciaSelect) {
          instanciaSelect.dataset.transporte = transporte;
          if (label) instanciaSelect.dataset.transporteLabel = label;
        }
        await savePedidoTransporte(id, transporte, select);
        return;
      }
      if (instanciaSelect) {
        const id = Number(instanciaSelect.dataset.id);
        const instancia = Number(instanciaSelect.value);
        if (instancia === 2) {
          const card = instanciaSelect.closest('.pedido-card');
          const transporteSelect = card?.querySelector('.pedido-transporte-select') || findTransporteSelectById(id);
          const transporteSnapshot =
            getTransporteSnapshot(transporteSelect) ||
            instanciaSelect.dataset.transporteLabel ||
            instanciaSelect.dataset.transporte ||
            '';
          if (!isTransporteSnapshotValido(transporteSnapshot)) {
            alert('Para finalizar, seleccione un transporte.');
            instanciaSelect.value = instanciaSelect.dataset.prev || '0';
            return;
          }
          if (transporteSelect) {
            const saved = await savePedidoTransporte(id, transporteSnapshot, transporteSelect);
            if (!saved) {
              alert('No se pudo guardar el transporte.');
              instanciaSelect.value = instanciaSelect.dataset.prev || '0';
              return;
            }
          }
        }
        try {
          if (pedidosVendedoraListaStatus) pedidosVendedoraListaStatus.textContent = 'Actualizando instancia...';
          const res = await fetch('/api/pedidos/instancia', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ id, instancia }),
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.message || 'No se pudo actualizar instancia.');
          }
          instanciaSelect.dataset.prev = String(instancia);
          if (pedidosVendedoraListaStatus) pedidosVendedoraListaStatus.textContent = 'Instancia actualizada.';
        } catch (error) {
          instanciaSelect.value = instanciaSelect.dataset.prev || '0';
          alert(error.message || 'Error al actualizar instancia.');
        }
      }
    });
    pedidosVendedoraListaTableEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.pedido-items-btn');
      if (!btn) return;
      const tr = btn.closest('tr');
      const rowData = pedidosVendedoraListaTable?.row(tr).data();
      const nropedido = rowData?.pedido || btn.dataset.pedido;
      const vendedora = rowData?.vendedora || btn.dataset.vendedora || '';
      const cliente = rowData?.cliente || btn.dataset.cliente || '';
      if (pedidoItemsTitle) {
        const parts = [`Pedido ${nropedido}`];
        if (cliente) parts.push(cliente);
        if (vendedora) parts.push(vendedora);
        pedidoItemsTitle.textContent = parts.join(' - ');
      }
      pedidoItemsOverlay?.classList.add('open');
      loadPedidoItems(nropedido);
    });
    pedidosVendedoraListaTableEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.pedido-notas-btn');
      if (!btn) return;
      const tr = btn.closest('tr');
      const rowData = pedidosVendedoraListaTable?.row(tr).data();
      const controlId = rowData?.id || btn.dataset.id;
      const pedido = rowData?.pedido || btn.dataset.pedido;
      const vendedora = rowData?.vendedora || btn.dataset.vendedora || '';
      const cliente = rowData?.cliente || btn.dataset.cliente || '';
      openPedidoNotas(controlId, pedido, cliente ? `${vendedora} - ${cliente}` : vendedora);
    });
    pedidosVendedoraListaTableEl.addEventListener('click', async (e) => {
      const btn = e.target.closest('.pedido-entregado-btn');
      if (!btn) return;
      const tr = btn.closest('tr');
      const rowData = pedidosVendedoraListaTable?.row(tr).data();
      const pedido = rowData?.pedido || btn.dataset.pedido;
      const cliente = rowData?.cliente || btn.dataset.cliente || '';
      if (!pedido) return;
      const label = cliente ? `${cliente} - Pedido ${pedido}` : `Pedido ${pedido}`;
      if (!confirm(`¿Marcar como entregado ${label}?`)) return;
      try {
        if (pedidosVendedoraListaStatus) pedidosVendedoraListaStatus.textContent = 'Marcando entregado...';
        const res = await fetch('/api/pedidos/entregado', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ nropedido: pedido }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.message || 'No se pudo marcar como entregado.');
        }
        if (pedidosVendedoraListaStatus) pedidosVendedoraListaStatus.textContent = 'Pedido entregado.';
        await reloadPedidosLista();
        loadPedidosTodosSummary();
      } catch (error) {
        if (pedidosVendedoraListaStatus) {
          pedidosVendedoraListaStatus.textContent = error.message || 'Error al marcar entregado.';
        }
      }
    });
    pedidosVendedoraListaTableEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.pedido-checkout-btn');
      if (!btn) return;
      const tr = btn.closest('tr');
      const rowData = pedidosVendedoraListaTable?.row(tr).data();
      const pedido = rowData?.pedido || btn.dataset.pedido;
      const vendedora = rowData?.vendedora || btn.dataset.vendedora || '';
      const cliente = rowData?.cliente || btn.dataset.cliente || '';
      if (pedidoCheckoutTitle) {
        const parts = [`Pedido ${pedido}`];
        if (cliente) parts.push(cliente);
        if (vendedora) parts.push(vendedora);
        pedidoCheckoutTitle.textContent = parts.join(' - ');
      }
      pedidoCheckoutOverlay?.classList.add('open');
      loadPedidoCheckout(pedido);
    });
    pedidosVendedoraListaTableEl.addEventListener('click', async (e) => {
      const btn = e.target.closest('.pedido-pago-btn');
      if (!btn) return;
      const id = Number(btn.dataset.id);
      const current = Number(btn.dataset.pagado) || 0;
      const next = current === 1 ? 0 : 1;
      try {
        if (pedidosVendedoraListaStatus) pedidosVendedoraListaStatus.textContent = 'Actualizando pago...';
        const res = await fetch('/api/pedidos/pago', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ id, pagado: next }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.message || 'No se pudo actualizar pago.');
        }
        btn.dataset.pagado = String(next);
        btn.textContent = next === 1 ? '😊' : '😞';
        btn.classList.toggle('pago-ok', next === 1);
        btn.classList.toggle('pago-pendiente', next === 0);
        if (pedidosVendedoraListaStatus) pedidosVendedoraListaStatus.textContent = 'Pago actualizado.';
      } catch (error) {
        if (pedidosVendedoraListaStatus) {
          pedidosVendedoraListaStatus.textContent = error.message || 'Error al actualizar pago.';
        }
      }
    });
    pedidosVendedoraListaTableEl.addEventListener('click', async (e) => {
      const btn = e.target.closest('.pedido-cancel-btn');
      if (!btn) return;
      const tr = btn.closest('tr');
      const rowData = pedidosVendedoraListaTable?.row(tr).data();
      const id = Number(rowData?.id || btn.dataset.id);
      const pedido = rowData?.pedido || '';
      const cliente = rowData?.cliente || '';
      const label = cliente ? `${cliente} - Pedido ${pedido}` : `Pedido ${pedido || id}`;
      if (!confirm(`¿Cancelar ${label}?`)) return;
      try {
        if (pedidosVendedoraListaStatus) pedidosVendedoraListaStatus.textContent = 'Cancelando pedido...';
        const res = await fetch('/api/pedidos/cancelar', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ id }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.message || 'No se pudo cancelar pedido.');
        }
        await reloadPedidosLista();
        if (pedidosVendedoraListaStatus) pedidosVendedoraListaStatus.textContent = 'Pedido cancelado.';
      } catch (error) {
        if (pedidosVendedoraListaStatus) {
          pedidosVendedoraListaStatus.textContent = error.message || 'Error al cancelar pedido.';
        }
      }
    });
    pedidosVendedoraListaTableEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.pedido-ia-btn');
      if (!btn) return;
      const tr = btn.closest('tr');
      const rowData = pedidosVendedoraListaTable?.row(tr).data();
      const pedido = rowData?.pedido || btn.dataset.pedido;
      const vendedora = rowData?.vendedora || btn.dataset.vendedora || '';
      const cliente = rowData?.cliente || btn.dataset.cliente || '';
      pedidoIaControlId = Number(rowData?.id || btn.dataset.id) || null;
      pedidoIaClienteId = Number(rowData?.id_cliente || btn.dataset.clienteId) || null;
      if (pedidoIaTitle) {
        const parts = [`Pedido ${pedido}`];
        if (cliente) parts.push(cliente);
        if (vendedora) parts.push(vendedora);
        pedidoIaTitle.textContent = parts.join(' - ');
      }
      pedidoIaOverlay?.classList.add('open');
      loadPedidoIaHistory(pedidoIaControlId);
    });
  }
  if (pedidoItemsClose) {
    pedidoItemsClose.addEventListener('click', () => {
      pedidoItemsOverlay?.classList.remove('open');
    });
  }
  if (pedidoItemsOverlay) {
    pedidoItemsOverlay.addEventListener('click', (e) => {
      if (e.target === pedidoItemsOverlay) pedidoItemsOverlay.classList.remove('open');
    });
  }
  if (pedidoNotasClose) {
    pedidoNotasClose.addEventListener('click', () => {
      pedidoNotasOverlay?.classList.remove('open');
    });
  }
  if (pedidoNotasOverlay) {
    pedidoNotasOverlay.addEventListener('click', (e) => {
      if (e.target === pedidoNotasOverlay) pedidoNotasOverlay.classList.remove('open');
    });
  }
  if (pedidoCheckoutClose) {
    pedidoCheckoutClose.addEventListener('click', () => {
      pedidoCheckoutOverlay?.classList.remove('open');
    });
  }
  if (pedidoCheckoutOverlay) {
    pedidoCheckoutOverlay.addEventListener('click', (e) => {
      if (e.target === pedidoCheckoutOverlay) pedidoCheckoutOverlay.classList.remove('open');
    });
  }
  if (pedidoIaClose) {
    pedidoIaClose.addEventListener('click', () => {
      pedidoIaOverlay?.classList.remove('open');
      pedidoIaMessages = [];
      if (pedidoIaWindow) pedidoIaWindow.innerHTML = '';
    });
  }
  if (pedidoIaOverlay) {
    pedidoIaOverlay.addEventListener('click', (e) => {
      if (e.target === pedidoIaOverlay) pedidoIaOverlay.classList.remove('open');
    });
  }
  if (pedidoIaSend) pedidoIaSend.addEventListener('click', sendPedidoIaMessage);
  if (pedidoIaInput) {
    pedidoIaInput.addEventListener('keyup', (e) => {
      if (e.key === 'Enter') sendPedidoIaMessage();
    });
  }
  if (pedidoNotasSave) pedidoNotasSave.addEventListener('click', savePedidoNota);
  if (pedidoNotasList) {
    pedidoNotasList.addEventListener('click', (e) => {
      const delBtn = e.target.closest('.nota-delete-btn');
      if (delBtn) {
        const note = delBtn.closest('.carritos-nota');
        if (!note) return;
        const noteId = Number(note.dataset.id);
        if (!noteId) return;
        if (!confirm('¿Eliminar esta nota?')) return;
        (async () => {
          try {
            if (pedidoNotasStatus) pedidoNotasStatus.textContent = 'Eliminando...';
            const res = await fetch(`/api/pedidos/comentarios/${encodeURIComponent(noteId)}`, {
              method: 'DELETE',
              credentials: 'include',
            });
            if (!res.ok) {
              const data = await res.json().catch(() => ({}));
              throw new Error(data.message || 'No se pudo eliminar.');
            }
            await loadPedidoNotas(pedidoNotasCurrentId);
            await reloadPedidosLista();
            if (pedidoNotasStatus) pedidoNotasStatus.textContent = 'Nota eliminada.';
          } catch (error) {
            if (pedidoNotasStatus) pedidoNotasStatus.textContent = error.message || 'Error al eliminar nota.';
          }
        })();
        return;
      }
      const note = e.target.closest('.carritos-nota');
      if (!note) return;
      pedidoNotasEditingId = Number(note.dataset.id) || null;
      if (pedidoNotasInput) {
        pedidoNotasInput.value = note.dataset.text || '';
        pedidoNotasInput.focus();
      }
      Array.from(pedidoNotasList.querySelectorAll('.carritos-nota')).forEach((node) => {
        node.classList.toggle('active', node === note);
      });
      if (pedidoNotasStatus) pedidoNotasStatus.textContent = 'Editando nota.';
    });
  }
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

function applyTheme(mode) {
  const isLight = mode === 'light';
  document.body.classList.toggle('theme-light', isLight);
  if (themeToggle) themeToggle.checked = isLight;
  if (themeLabel) themeLabel.textContent = isLight ? 'Claro' : 'Dark';
  refreshThemeTables();
}

function initThemeToggle() {
  if (!themeToggle) return;
  const saved = localStorage.getItem('themeMode');
  if (saved === 'light' || saved === 'dark') {
    applyTheme(saved);
  }
  themeToggle.addEventListener('change', () => {
    const mode = themeToggle.checked ? 'light' : 'dark';
    applyTheme(mode);
    localStorage.setItem('themeMode', mode);
  });
}

function getPedidoSelectClass() {
  return document.body.classList.contains('theme-light') ? ' pedido-select-light' : '';
}

function getPedidoSelectStyle() {
  if (!document.body.classList.contains('theme-light')) return '';
  return ' style="background:#f5f5f5;color:#111;border-color:rgba(15,23,42,0.2);color-scheme:light;"';
}

function refreshThemeTables() {
  setTimeout(() => {
    const tableHeads = document.querySelectorAll('#pedidos-vendedora-lista-table thead');
    tableHeads.forEach((head) => {
      head.style.display = '';
      head.style.visibility = 'visible';
    });
    if (pedidosVendedoraListaTable) {
      pedidosVendedoraListaTable.columns.adjust().draw(false);
    }
  }, 0);
}

function syncMobileLayout() {
  const isMobile = window.innerWidth <= 720;
  document.body.classList.toggle('is-mobile', isMobile);
  const abmTable = document.getElementById('abm-table');
  const abmTableWrapper = document.getElementById('abm-table_wrapper');
  if (abmTable) abmTable.style.display = isMobile ? 'none' : '';
  if (abmTableWrapper) abmTableWrapper.style.display = isMobile ? 'none' : '';
  if (abmCardsEl) abmCardsEl.style.display = isMobile ? 'grid' : '';
  if (isMobile && abmRowsCache.length && abmCardsEl && !abmCardsEl.innerHTML) {
    resetAbmCards();
  }
  const controlOrdenesTable = document.getElementById('control-ordenes-table');
  if (controlOrdenesTable) controlOrdenesTable.style.display = isMobile ? 'none' : '';
  if (controlOrdenesCards) controlOrdenesCards.style.display = isMobile ? 'grid' : '';
  const cajasCierreTable = document.getElementById('cajas-cierre-table');
  if (cajasCierreTable) cajasCierreTable.style.display = isMobile ? 'none' : '';
  if (cajasCierreCards) cajasCierreCards.style.display = isMobile ? 'grid' : '';
  updatePedidoCardsVisibility();
  if (
    !isMobile &&
    currentPedidosScope === 'todos' &&
    pedidosVendedoraListaOverlay?.classList.contains('open') &&
    !pedidosVendedoraListaTable
  ) {
    if (currentPedidosTipo === 'empaquetados') {
      loadPedidosEmpaquetadosLista();
    } else {
      loadPedidosTodosLista(currentPedidosTipo);
    }
  }
}

const permissionGroups = [
    {
      title: 'General',
      items: [
        { key: 'dashboard', label: 'Dashboard' },
        { key: 'panel-control', label: 'Panel de Control' },
        { key: 'cargar-ticket', label: 'CargarTicket' },
        { key: 'empleados', label: 'Empleados' },
      { key: 'clientes', label: 'Clientes' },
      { key: 'ia', label: 'IA' },
      { key: 'salon', label: 'Salon' },
      { key: 'cajas', label: 'Cajas' },
      { key: 'cajas-cierre', label: 'Cajas - Cierre' },
      { key: 'pedidos-menu', label: 'Menu Pedidos' },
      { key: 'pedidos', label: 'Pedidos - Informe' },
      { key: 'pedidos-todos', label: 'Pedidos - Todos' },
    ],
  },
  {
    title: 'Contabilidad',
    items: [
      { key: 'facturas', label: 'Facturas' },
      { key: 'comisiones', label: 'Comisiones' },
    ],
  },
  {
    title: 'Mercaderia',
    items: [
      { key: 'mercaderia', label: 'Articulos Mas Vendido' },
      { key: 'abm', label: 'ABM Articulos' },
      { key: 'control-ordenes', label: 'Control Ordenes' },
    ],
  },
  {
    title: 'Configuracion',
    items: [{ key: 'configuracion', label: 'Roles' }],
  },
];

let rolesData = [];
let currentRoleId = '';
let usersData = [];
let currentUserId = '';
let rolesOptions = [];
let vendedorasOptions = [];
let usersSearchTerm = '';
let usersPage = 1;
const usersPageSize = 10;
const discontinuedRoleId = 4;

function buildEmptyPermissions() {
  return Object.fromEntries(permissionGroups.flatMap((g) => g.items.map((i) => [i.key, false])));
}

async function loadRoles() {
  if (rolesStatus) rolesStatus.textContent = 'Cargando roles...';
  const res = await fetchJSON('/api/roles');
  rolesData = (res.data || []).map((r) => ({
    id: String(r.id),
    name: r.name,
    permissions: buildEmptyPermissions(),
  }));
  currentRoleId = rolesData[0]?.id || '';
  if (!rolesData.length && rolesStatus) rolesStatus.textContent = 'No hay roles.';
}

async function loadRolePermissions(roleId) {
  if (!roleId) return;
  if (rolesStatus) rolesStatus.textContent = 'Cargando permisos...';
  const res = await fetchJSON(`/api/roles/${encodeURIComponent(roleId)}/permissions`);
  const perms = buildEmptyPermissions();
  (res.data || []).forEach((row) => {
    if (row.permiso in perms) {
      perms[row.permiso] = !!row.habilitado;
    }
  });
  const role = rolesData.find((r) => r.id === roleId);
  if (role) role.permissions = perms;
  if (rolesStatus) rolesStatus.textContent = '';
}

function renderRolesList() {
  if (!rolesList) return;
  rolesList.innerHTML = '';
  rolesData.forEach((role) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `role-item${role.id === currentRoleId ? ' active' : ''}`;
    btn.textContent = role.name;
    btn.addEventListener('click', () => {
      currentRoleId = role.id;
      renderRolesList();
      loadRolePermissions(currentRoleId).then(renderPermissions);
    });
    rolesList.appendChild(btn);
  });
}

function renderPermissions() {
  if (!rolesPermsGroups) return;
  const role = rolesData.find((r) => r.id === currentRoleId) || rolesData[0];
  if (!role) return;
  if (rolesTitle) rolesTitle.textContent = `Permisos - ${role.name}`;
  rolesPermsGroups.innerHTML = '';
  const labelMap = {};
  permissionGroups.forEach((group) => {
    group.items.forEach((item) => {
      labelMap[item.key] = item.label;
    });
  });
  const submenuMap = {
    'pedidos-menu': ['pedidos', 'pedidos-todos'],
    cajas: ['cajas-cierre'],
  };
  const submenuKeys = new Set(Object.values(submenuMap).flat());

  permissionGroups.forEach((group) => {
    const section = document.createElement('div');
    section.className = 'perm-section';
    const title = document.createElement('h5');
    title.textContent = group.title;
    section.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'perm-grid';
    group.items.forEach((item) => {
      if (submenuKeys.has(item.key)) return;
      const wrapper = document.createElement('div');
      wrapper.className = 'perm-item';

      const label = document.createElement('label');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      if (submenuMap[item.key]) {
        const subChecked = submenuMap[item.key].some((subKey) => role.permissions[subKey]);
        if (subChecked && !role.permissions[item.key]) {
          role.permissions[item.key] = true;
        }
      }
      checkbox.checked = !!role.permissions[item.key];
      const subCheckboxes = [];
      checkbox.addEventListener('change', () => {
        role.permissions[item.key] = checkbox.checked;
        if (submenuMap[item.key]) {
          subCheckboxes.forEach((sub) => {
            sub.checked = checkbox.checked;
            role.permissions[sub.dataset.key] = sub.checked;
          });
        }
      });
      const span = document.createElement('span');
      span.textContent = item.label;
      label.appendChild(checkbox);
      label.appendChild(span);
      wrapper.appendChild(label);
      if (submenuMap[item.key]) {
        wrapper.classList.add('perm-parent');
        const subWrap = document.createElement('div');
        subWrap.className = 'perm-subitems';
        submenuMap[item.key].forEach((subKey) => {
          const subItem = document.createElement('div');
          subItem.className = 'perm-subitem';
          const subLabel = document.createElement('label');
          const subCheckbox = document.createElement('input');
          subCheckbox.type = 'checkbox';
          subCheckbox.checked = !!role.permissions[subKey];
          subCheckbox.dataset.key = subKey;
          subCheckbox.addEventListener('change', () => {
            role.permissions[subKey] = subCheckbox.checked;
            const anyChecked = subCheckboxes.some((item) => item.checked);
            if (anyChecked && !checkbox.checked) {
              checkbox.checked = true;
              role.permissions[item.key] = true;
            }
          });
          const subSpan = document.createElement('span');
          subSpan.textContent = labelMap[subKey] || subKey;
          subLabel.appendChild(subCheckbox);
          subLabel.appendChild(subSpan);
          subItem.appendChild(subLabel);
          subWrap.appendChild(subItem);
          subCheckboxes.push(subCheckbox);
        });
        wrapper.appendChild(subWrap);
      }
      grid.appendChild(wrapper);
    });
    section.appendChild(grid);
    rolesPermsGroups.appendChild(section);
  });
}

async function initRolesModule() {
  if (!rolesList || !rolesPermsGroups) return;
  try {
    await loadRoles();
    renderRolesList();
    if (currentRoleId) {
      await loadRolePermissions(currentRoleId);
    }
    renderPermissions();
  } catch (error) {
    if (rolesStatus) rolesStatus.textContent = error.message || 'No se pudieron cargar roles.';
  }
  if (rolesAdd)
    rolesAdd.addEventListener('click', () => {
      if (rolesStatus) rolesStatus.textContent = 'Alta de roles pendiente de implementar.';
    });
  if (rolesSave)
    rolesSave.addEventListener('click', async () => {
      const role = rolesData.find((r) => r.id === currentRoleId);
      if (!role) return;
      try {
        if (rolesStatus) rolesStatus.textContent = 'Guardando...';
        const res = await fetch(`/api/roles/${encodeURIComponent(role.id)}/permissions`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ permissions: role.permissions }),
        });
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(text || `Error ${res.status}`);
        }
        if (rolesStatus) rolesStatus.textContent = 'Permisos guardados.';
      } catch (error) {
        if (rolesStatus) rolesStatus.textContent = error.message || 'No se pudo guardar.';
      }
    });
}

function initConfigTabs() {
  const tabs = document.querySelectorAll('#config-tabs .tab');
  const panels = document.querySelectorAll('.tab-panel');
  if (!tabs.length) return;
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('active'));
      panels.forEach((p) => p.classList.remove('active'));
      tab.classList.add('active');
      const target = tab.dataset.tab;
      const panel = document.getElementById(`tab-${target}`);
      if (panel) panel.classList.add('active');
    });
  });
}

async function loadUsers() {
  if (!usersStatus) return;
  usersStatus.textContent = 'Cargando usuarios...';
  const [usersRes, rolesRes, vendRes] = await Promise.all([
    fetchJSON('/api/config/usuarios'),
    fetchJSON('/api/roles'),
    fetchJSON('/api/config/vendedoras'),
  ]);
  usersData = usersRes.data || [];
  rolesOptions = rolesRes.data || [];
  vendedorasOptions = vendRes.data || [];
  currentUserId = usersData[0]?.id ? String(usersData[0].id) : '';
  usersStatus.textContent = '';
}

function renderUsersList() {
  if (!usersList) return;
  usersList.innerHTML = '';
  const term = (usersSearchTerm || '').toLowerCase();
  const filtered = usersData.filter((u) => {
    const roleId = Number(u.id_roles) || 0;
    const status = usersStatusFilter?.value || 'activos';
    if (status === 'descontinuados') {
      if (roleId !== discontinuedRoleId) return false;
    } else if (status === 'activos') {
      if (roleId === discontinuedRoleId) return false;
    }
    if (!term) return true;
    return (
      String(u.name || '').toLowerCase().includes(term) ||
      String(u.email || '').toLowerCase().includes(term)
    );
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / usersPageSize));
  usersPage = Math.min(usersPage, totalPages);
  const start = (usersPage - 1) * usersPageSize;
  const pageRows = filtered.slice(start, start + usersPageSize);
  pageRows.forEach((u) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `role-item${String(u.id) === currentUserId ? ' active' : ''}`;
    btn.textContent = u.name || u.email || `Usuario ${u.id}`;
    btn.addEventListener('click', () => {
      currentUserId = String(u.id);
      renderUsersList();
      renderUserForm();
    });
    usersList.appendChild(btn);
  });
  if (usersPageInfo) usersPageInfo.textContent = `Pagina ${usersPage} de ${totalPages}`;
}

function renderSelectOptions(select, items, valueKey, labelKey, includeEmpty = true) {
  if (!select) return;
  select.innerHTML = '';
  if (includeEmpty) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'Sin asignar';
    select.appendChild(opt);
  }
  items.forEach((item) => {
    const opt = document.createElement('option');
    opt.value = String(item[valueKey]);
    opt.textContent = item[labelKey];
    select.appendChild(opt);
  });
}

function renderUserForm() {
  const user = usersData.find((u) => String(u.id) === currentUserId);
  if (!user) return;
  if (usersTitle) usersTitle.textContent = `Detalle - ${user.name || user.email || user.id}`;
  if (userNameInput) userNameInput.value = user.name || '';
  if (userEmailInput) userEmailInput.value = user.email || '';
  renderSelectOptions(userRoleSelect, rolesOptions, 'id', 'name', false);
  renderSelectOptions(userVendedoraSelect, vendedorasOptions, 'id', 'nombre');
  if (userRoleSelect) userRoleSelect.value = user.id_roles ? String(user.id_roles) : '';
  if (userVendedoraSelect) userVendedoraSelect.value = user.id_vendedoras ? String(user.id_vendedoras) : '';
  if (userHoraIngreso) userHoraIngreso.value = user.hora_ingreso || '';
  if (userHoraEgreso) userHoraEgreso.value = user.hora_egreso || '';
}

async function initUsersModule() {
  if (!usersList) return;
  try {
    await loadUsers();
    renderUsersList();
    renderUserForm();
  } catch (error) {
    if (usersStatus) usersStatus.textContent = error.message || 'No se pudieron cargar usuarios.';
  }
  if (usersSave)
    usersSave.addEventListener('click', async () => {
      const user = usersData.find((u) => String(u.id) === currentUserId);
      if (!user) return;
      try {
        if (usersStatus) usersStatus.textContent = 'Guardando...';
        const payload = {
          name: userNameInput?.value || '',
          email: userEmailInput?.value || '',
          id_roles: Number(userRoleSelect?.value) || null,
          id_vendedoras: Number(userVendedoraSelect?.value) || null,
          hora_ingreso: userHoraIngreso?.value || null,
          hora_egreso: userHoraEgreso?.value || null,
        };
        const res = await fetch(`/api/config/usuarios/${encodeURIComponent(user.id)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(text || `Error ${res.status}`);
        }
        const updated = await res.json();
        const idx = usersData.findIndex((u) => String(u.id) === String(user.id));
        if (idx >= 0) usersData[idx] = updated.user;
        renderUsersList();
        renderUserForm();
        if (usersStatus) usersStatus.textContent = 'Usuario actualizado.';
      } catch (error) {
        if (usersStatus) usersStatus.textContent = error.message || 'No se pudo guardar.';
      }
    });
  if (usersSearch)
    usersSearch.addEventListener('input', () => {
      usersSearchTerm = usersSearch.value || '';
      usersPage = 1;
      renderUsersList();
    });
  if (usersStatusFilter)
    usersStatusFilter.addEventListener('change', () => {
      usersPage = 1;
      renderUsersList();
    });
  if (usersPrev)
    usersPrev.addEventListener('click', () => {
      usersPage = Math.max(1, usersPage - 1);
      renderUsersList();
    });
  if (usersNext)
    usersNext.addEventListener('click', () => {
      usersPage += 1;
      renderUsersList();
    });
  if (userPassSave)
    userPassSave.addEventListener('click', async () => {
      const user = usersData.find((u) => String(u.id) === currentUserId);
      if (!user) return;
      const pass = userPassInput?.value || '';
      const confirm = userPassConfirm?.value || '';
      if (!pass || pass.length < 6) {
        if (usersStatus) usersStatus.textContent = 'La contraseña debe tener al menos 6 caracteres.';
        return;
      }
      if (pass !== confirm) {
        if (usersStatus) usersStatus.textContent = 'Las contraseñas no coinciden.';
        return;
      }
      try {
        if (usersStatus) usersStatus.textContent = 'Actualizando contraseña...';
        const res = await fetch(`/api/config/usuarios/${encodeURIComponent(user.id)}/password`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: pass }),
        });
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(text || `Error ${res.status}`);
        }
        if (userPassInput) userPassInput.value = '';
        if (userPassConfirm) userPassConfirm.value = '';
        if (usersStatus) usersStatus.textContent = 'Contraseña actualizada.';
      } catch (error) {
        if (usersStatus) usersStatus.textContent = error.message || 'No se pudo actualizar.';
      }
    });
}

function initUserTabs() {
  const tabs = document.querySelectorAll('.user-tabs .tab');
  const editPanel = document.getElementById('tab-user-edit');
  const passPanel = document.getElementById('tab-user-pass');
  if (!tabs.length || !editPanel || !passPanel) return;
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('active'));
      editPanel.classList.remove('active');
      passPanel.classList.remove('active');
      tab.classList.add('active');
      const target = tab.dataset.tab;
      if (target === 'user-pass') {
        passPanel.classList.add('active');
      } else {
        editPanel.classList.add('active');
      }
    });
  });
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
  initThemeToggle();

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

function initCarritosModal() {
  const statButtons = document.querySelectorAll('.carritos-stat-click');
  statButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tipo = btn.dataset.tipo;
      openCarritosModal(tipo);
    });
  });

  if (carritosClose) carritosClose.addEventListener('click', () => carritosOverlay?.classList.remove('open'));
  if (carritosOverlay) {
    carritosOverlay.addEventListener('click', (e) => {
      if (e.target === carritosOverlay) carritosOverlay.classList.remove('open');
    });
  }

  if (carritosTableEl) {
    carritosTableEl.addEventListener('click', (e) => {
      const notasBtn = e.target.closest('.carritos-notas-btn');
      if (notasBtn) {
        const id = Number(notasBtn.dataset.id);
        const row = carritosRows.find((item) => Number(item.id) === id);
        openCarritosNotas(id, row?.nombre_contacto || '');
        return;
      }
      const cerrarBtn = e.target.closest('.carritos-cerrar-btn');
      if (cerrarBtn) {
        const id = Number(cerrarBtn.dataset.id);
        cerrarCarrito(id);
      }
    });
    carritosTableEl.addEventListener('change', (e) => {
      const select = e.target.closest('.carritos-vendedora-select');
      if (!select) return;
      const id = Number(select.dataset.id);
      const value = select.value || '';
      updateCarritoVendedora(id, value);
    });
  }

  if (carritosNotasClose) {
    carritosNotasClose.addEventListener('click', () => carritosNotasOverlay?.classList.remove('open'));
  }
  if (carritosNotasOverlay) {
    carritosNotasOverlay.addEventListener('click', (e) => {
      if (e.target === carritosNotasOverlay) carritosNotasOverlay.classList.remove('open');
    });
  }
  if (carritosNotasSave) carritosNotasSave.addEventListener('click', saveCarritosNota);
  if (carritosNotasList) {
    carritosNotasList.addEventListener('click', (e) => {
      const note = e.target.closest('.carritos-nota');
      if (!note) return;
      carritosNotasEditingId = Number(note.dataset.id) || null;
      if (carritosNotasInput) {
        carritosNotasInput.value = note.dataset.text || '';
        carritosNotasInput.focus();
      }
      Array.from(carritosNotasList.querySelectorAll('.carritos-nota')).forEach((node) => {
        node.classList.toggle('active', node === note);
      });
      if (carritosNotasStatus) carritosNotasStatus.textContent = 'Editando nota.';
    });
  }
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
  if (target === 'no-permission' && viewNoPermission) {
    const views = [
      viewDashboard,
      viewCargarTicket,
      viewEmpleados,
      viewClientes,
      viewIa,
      viewSalon,
      viewPedidos,
      viewPedidosTodos,
      viewMercaderia,
      viewAbm,
      viewControlOrdenes,
      viewCajas,
      viewCajasCierre,
      viewConfiguracion,
      viewFacturas,
      viewComisiones,
    ];
    views.forEach((v) => v.classList.add('hidden'));
    viewNoPermission.classList.remove('hidden');
    return;
  }
  if (currentPermissions && currentPermissions[resolvePermissionKey(target)] !== true) {
    const fallback = getFirstAllowedView(currentPermissions);
    if (fallback && fallback !== target) {
      switchView(fallback);
    }
    return;
  }
  const views = [
    viewDashboard,
    viewPanelControl,
    viewCargarTicket,
    viewEmpleados,
    viewClientes,
    viewIa,
    viewSalon,
    viewPedidos,
    viewPedidosTodos,
    viewMercaderia,
    viewAbm,
    viewControlOrdenes,
    viewCajas,
    viewCajasCierre,
    viewConfiguracion,
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
  } else if (target === 'pedidos-todos') {
    viewPedidosTodos.classList.remove('hidden');
    loadPedidosTodosSummary();
  } else if (target === 'mercaderia') {
    viewMercaderia.classList.remove('hidden');
    loadMercaderia();
  } else if (target === 'abm') {
    viewAbm.classList.remove('hidden');
    loadAbmDataTable();
  } else if (target === 'control-ordenes') {
    viewControlOrdenes.classList.remove('hidden');
    loadControlOrdenes();
  } else if (target === 'cajas') {
    viewCajas.classList.remove('hidden');
  } else if (target === 'cajas-cierre') {
    viewCajasCierre.classList.remove('hidden');
    loadCajasCierre();
  } else if (target === 'panel-control') {
    viewPanelControl.classList.remove('hidden');
  } else if (target === 'cargar-ticket') {
    viewCargarTicket.classList.remove('hidden');
  } else if (target === 'configuracion') {
    viewConfiguracion.classList.remove('hidden');
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
  } else if (target === 'no-permission' && viewNoPermission) {
    viewNoPermission.classList.remove('hidden');
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
initCarritosModal();
initCargarTicket();
initNoEncuestadosModal();
initFechaEmpleados();
initClientes();
initPedidosClientes();
initIaChat();
initSalonResumen();
initPedidosResumen();
initMercaderia();
initAbm();
initControlOrdenes();
initCajasCierre();
initFacturas();
initComisiones();
initRolesModule();
syncMobileLayout();
window.addEventListener('resize', syncMobileLayout);
window.addEventListener(
  'scroll',
  () => {
    if (!document.body.classList.contains('is-mobile')) return;
    if (!viewAbm || viewAbm.classList.contains('hidden')) return;
    if (abmCardVisibleCount >= abmCardFilteredRows.length) return;
    if (window.innerHeight + window.scrollY < document.body.offsetHeight - 200) return;
    appendAbmCards();
  },
  { passive: true }
);
initConfigTabs();
initUsersModule();
initUserTabs();
loadTransportes();
loadEncuestas(defaultYearEncuestas);
initDateRange();
loadProductividad(document.getElementById('fecha-desde').value, document.getElementById('fecha-hasta').value);
loadMensual(defaultYearMensual);
loadVentas(defaultYearVentas);
loadPaqueteria();
loadCarritosAbandonados();
loadPedidosControl();
loadOperativos();
startPanelControlAutoRefresh();
loadPedidosClientes();




