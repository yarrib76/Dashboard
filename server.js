require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const express = require('express');
const { computeNuevaCantidad, resolveArticuloValores, resolveCompraValores } = require('./lib/abmBatch');
const { computePedidoSubtotal } = require('./lib/pedidosNuevo');
const { processAbmCreate } = require('./lib/abmCreateService');
const { processAbmBatch } = require('./lib/abmBatchService');
const {
  validateDashboardComparativoParams,
  buildDashboardComparativoPayload,
  buildDashboardComparativoAllYearsPayload,
  buildInflacionApiPayload,
} = require('./lib/dashboardComparativo');
const { normalizeIdempotencyKey, validateFacturaPayload } = require('./lib/facturas');
const {
  CLIENTE_ESTADOS,
  enrichClienteReporteRow,
  buildClientesResumen,
} = require('./lib/clientesReportes');
const cors = require('cors');
const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');
const os = require('os');
const dns = require('dns');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { log } = require('console');
const OpenAI = require('openai');
const { toFile } = require('openai');
const { Blob } = require('buffer');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);
const fsp = fs.promises;
const EMP_PHOTO_PUBLIC_PREFIX = '/empleados-fotos';

if (typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}

const app = express();
// Habilita cookies en peticiones cross-site si el front vive en otro dominio/puerto
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '35mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use((req, res, next) => {
  res.header('Cache-Control', 'no-store');
  next();
});

function requiredEnv(key, fallback) {
  const value = process.env[key];
  if ((value === undefined || value === '') && fallback === undefined) {
    throw new Error(`Falta la variable de entorno ${key} en .env`);
  }
  return value !== undefined && value !== '' ? value : fallback;
}

const PORT = requiredEnv('PORT', 3000);
const DB_HOST = requiredEnv('DB_HOST');
const DB_PORT = Number(requiredEnv('DB_PORT', 3306));
const DB_USER = requiredEnv('DB_USER');
const DB_PASSWORD = requiredEnv('DB_PASSWORD');
const DB_NAME = requiredEnv('DB_NAME');
const DB_CONNECTION_LIMIT = Number(requiredEnv('DB_CONNECTION_LIMIT', 10));
const DB_SECONDARY_HOST = process.env.DB_SECONDARY_HOST;
const DB_SECONDARY_PORT = Number(process.env.DB_SECONDARY_PORT || 3306);
const DB_SECONDARY_USER = process.env.DB_SECONDARY_USERNAME;
const DB_SECONDARY_PASSWORD = process.env.DB_SECONDARY_PASSWORD;
const DB_SECONDARY_NAME = process.env.DB_SECONDARY_DATABASE;
const DB_SECONDARY_LIMIT = Number(process.env.DB_SECONDARY_CONNECTION_LIMIT || DB_CONNECTION_LIMIT);
const SESSION_SECRET = requiredEnv('SESSION_SECRET', 'changeme');
const OPENAI_API_KEY = requiredEnv('OPENAI_API_KEY', '');
const OPENAI_MODEL = requiredEnv('OPENAI_MODEL', 'gpt-4o-mini');
const OPENAI_TIMEOUT_MS = Number(process.env.OPENAI_TIMEOUT_MS || 30000);
const OPENAI_MAX_RETRIES = Number(process.env.OPENAI_MAX_RETRIES || 2);
const SESSION_MAX_IDLE_MINUTES = Math.max(1, Number(requiredEnv('TIEMP_SESSION', 30)) || 30);
const DB_CONNECT_TIMEOUT_MS = Number(process.env.DB_CONNECT_TIMEOUT_MS || 20000);
const COOKIE_SECURE_MODE = (process.env.COOKIE_SECURE || 'auto').toLowerCase();
const COOKIE_SAMESITE = (process.env.COOKIE_SAMESITE || 'Lax').trim();
const EMP_PHOTO_STORAGE_DIR = process.env.EMP_PHOTO_DIR || '/app/fotos_empleados';
const EMP_PHOTO_MAX_BYTES = Number(process.env.EMP_PHOTO_MAX_BYTES || 5 * 1024 * 1024);
const TN_PUBLICACIONES_IMG_DIR = process.env.TN_PUBLICACIONES_IMG_DIR || path.join(__dirname, 'fotos_tiendanube_publicaciones');
const TN_PUBLICACIONES_IMG_PUBLIC_PREFIX = '/tn-publicaciones-img';
const TN_PUBLICACIONES_IMG_MAX_BYTES = Number(process.env.TN_PUBLICACIONES_IMG_MAX_BYTES || 10 * 1024 * 1024);
const PREDICTOR_URL = process.env.PREDICTOR_URL || 'http://192.168.0.154:8000/prediccion/sku';
const TNUBE_BASE_URL = 'https://api.tiendanube.com/v1';
const TNUBE_STORE_ID = String(process.env.TNUBE_STORE_ID || '').trim();
const TNUBE_TOKEN = String(process.env.TNUBE_TOKEN || '').trim();
const TNUBE_APPNAME = String(process.env.TNUBE_APPNAME || '').trim();
const TNUBE_STORE_NAME = String(process.env.TNUBE_STORE_NAME || process.env.LOCAL || '').trim();
const TNUBE_IMPORT_START_YEAR = Math.max(2000, Number(process.env.TNUBE_IMPORT_START_YEAR || 2019) || 2019);
const TNUBE_PRODUCTS_PER_PAGE = Math.min(200, Math.max(1, Number(process.env.TNUBE_PRODUCTS_PER_PAGE || 200) || 200));
const TNUBE_REQUEST_RETRIES = Math.max(0, Number(process.env.TNUBE_REQUEST_RETRIES || 2) || 0);
const TNUBE_INSERT_CHUNK_SIZE = Math.max(50, Number(process.env.TNUBE_INSERT_CHUNK_SIZE || 500) || 500);
const LOGS_DIR = path.join(__dirname, 'logs');
const ECOMMERCE_JOBS_DIR = path.join(LOGS_DIR, 'ecommerce-jobs');
const FACTURAS_ERROR_LOG_PATH = path.join(LOGS_DIR, 'facturas-error.log');
const PEDIDOS_ERROR_LOG_PATH = path.join(LOGS_DIR, 'pedidos-error.log');
const ecommerceImportJobs = new Map();
const ecommerceSyncJobs = new Map();

fs.mkdirSync(EMP_PHOTO_STORAGE_DIR, { recursive: true });
fs.mkdirSync(TN_PUBLICACIONES_IMG_DIR, { recursive: true });
app.use(EMP_PHOTO_PUBLIC_PREFIX, express.static(EMP_PHOTO_STORAGE_DIR));
app.use(TN_PUBLICACIONES_IMG_PUBLIC_PREFIX, express.static(TN_PUBLICACIONES_IMG_DIR));

const openai =
  OPENAI_API_KEY && OPENAI_API_KEY.trim()
    ? new OpenAI({
        apiKey: OPENAI_API_KEY.trim(),
        timeout: OPENAI_TIMEOUT_MS,
        maxRetries: OPENAI_MAX_RETRIES,
      })
    : null;

const secondaryPool =
  DB_SECONDARY_HOST && DB_SECONDARY_USER && DB_SECONDARY_PASSWORD && DB_SECONDARY_NAME
    ? mysql.createPool({
        host: DB_SECONDARY_HOST,
        port: DB_SECONDARY_PORT,
        user: DB_SECONDARY_USER,
        password: DB_SECONDARY_PASSWORD,
        database: DB_SECONDARY_NAME,
        connectionLimit: DB_SECONDARY_LIMIT,
        connectTimeout: DB_CONNECT_TIMEOUT_MS,
        enableKeepAlive: true,
        keepAliveInitialDelay: 0,
        supportBigNumbers: true,
        bigNumberStrings: true,
      })
    : null;

function parseISODate(value) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Fecha inválida: ${value}`);
  }
  return date;
}

function formatDateTimeLocal(dateObj) {
  const yyyy = dateObj.getFullYear();
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
  const dd = String(dateObj.getDate()).padStart(2, '0');
  const hh = String(dateObj.getHours()).padStart(2, '0');
  const mi = String(dateObj.getMinutes()).padStart(2, '0');
  const ss = String(dateObj.getSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

function formatDateLocal(dateObj) {
  const yyyy = dateObj.getFullYear();
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
  const dd = String(dateObj.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function ensureFacturasErrorLogInitialized() {
  try {
    if (!fs.existsSync(LOGS_DIR)) {
      fs.mkdirSync(LOGS_DIR, { recursive: true });
    }
    if (!fs.existsSync(FACTURAS_ERROR_LOG_PATH)) {
      const initLine = `[${formatDateTimeLocal(new Date())}] Inicializacion de Log${os.EOL}`;
      fs.writeFileSync(FACTURAS_ERROR_LOG_PATH, initLine, { encoding: 'utf8' });
    }
  } catch (error) {
    console.error('[facturas-log-init] error', error);
  }
}

function ensurePedidosErrorLogInitialized() {
  try {
    if (!fs.existsSync(LOGS_DIR)) {
      fs.mkdirSync(LOGS_DIR, { recursive: true });
    }
    if (!fs.existsSync(PEDIDOS_ERROR_LOG_PATH)) {
      const initLine = `[${formatDateTimeLocal(new Date())}] Inicializacion de Log${os.EOL}`;
      fs.writeFileSync(PEDIDOS_ERROR_LOG_PATH, initLine, { encoding: 'utf8' });
    }
  } catch (error) {
    console.error('[pedidos-log-init] error', error);
  }
}

function appendFacturaErrorLog(entry) {
  try {
    const line = `${JSON.stringify(entry)}${os.EOL}`;
    fs.appendFileSync(FACTURAS_ERROR_LOG_PATH, line, { encoding: 'utf8' });
  } catch (error) {
    console.error('[facturas-log-write] error', error);
  }
}

function appendPedidoErrorLog(entry) {
  try {
    const line = `${JSON.stringify(entry)}${os.EOL}`;
    fs.appendFileSync(PEDIDOS_ERROR_LOG_PATH, line, { encoding: 'utf8' });
  } catch (error) {
    console.error('[pedidos-log-write] error', error);
  }
}

function buildFacturaErrorEntry(req, payloadValidation, error) {
  const payload = payloadValidation?.data || req.body || {};
  const rawItems = Array.isArray(payload?.items) ? payload.items : [];
  const items = rawItems.map((item) => ({
    articulo: String(item?.articulo || ''),
    cantidad: Number(item?.cantidad) || 0,
    precioUnitario: Number(item?.precioUnitario) || 0,
  }));
  const subtotalEstimado = items.reduce(
    (acc, item) => acc + Number(item.cantidad || 0) * Number(item.precioUnitario || 0),
    0
  );
  const normalizedKey = normalizeIdempotencyKey(
    req.body?.idempotency_key || req.get('x-idempotency-key') || ''
  );
  return {
    timestamp: formatDateTimeLocal(new Date()),
    route: `${req.method} ${req.originalUrl || req.url || '/api/facturas'}`,
    user: {
      id: req.user?.id ?? null,
      name: req.user?.name ?? null,
      role: req.user?.role ?? null,
    },
    request: {
      idempotency_key: normalizedKey || null,
      cliente_id: payload?.cliente_id ?? null,
      vendedora: payload?.vendedora ?? null,
      tipo_pago_id: payload?.tipo_pago_id ?? null,
      esPedido: payload?.esPedido ?? null,
      nroPedido: payload?.nroPedido ?? null,
      listoParaEnvio: payload?.listoParaEnvio ?? null,
      porcentajeDescuento: payload?.porcentajeDescuento ?? null,
      envio: payload?.envio ?? null,
      pagoMixto: payload?.pagoMixto ?? null,
      items_count: items.length,
      subtotal_estimado: Number(subtotalEstimado.toFixed(2)),
      items,
    },
    validation: {
      ok: payloadValidation?.ok ?? null,
      message: payloadValidation?.message || null,
    },
    error: {
      code: error?.code || null,
      errno: error?.errno || null,
      sqlState: error?.sqlState || null,
      sqlMessage: error?.sqlMessage || null,
      message: error?.message || 'Unknown error',
      stack: String(error?.stack || '')
        .split('\n')
        .slice(0, 8)
        .join('\n'),
    },
  };
}

function buildPedidoErrorEntry(req, error) {
  const payload = req.body || {};
  const rawItems = Array.isArray(payload?.items) ? payload.items : [];
  const items = rawItems.map((item) => ({
    articulo: String(item?.articulo || ''),
    cantidad: Number(item?.cantidad) || 0,
    precioUnitario: Number(item?.precioUnitario) || 0,
  }));
  const totalEstimado = items.reduce(
    (acc, item) => acc + Number(item.cantidad || 0) * Number(item.precioUnitario || 0),
    0
  );
  const normalizedKey = normalizeIdempotencyKey(
    req.body?.idempotency_key || req.get('x-idempotency-key') || ''
  );
  return {
    timestamp: formatDateTimeLocal(new Date()),
    route: `${req.method} ${req.originalUrl || req.url || '/api/pedidos'}`,
    user: {
      id: req.user?.id ?? null,
      name: req.user?.name ?? null,
      role: req.user?.role ?? null,
    },
    request: {
      idempotency_key: normalizedKey || null,
      cliente_id: payload?.cliente_id ?? null,
      vendedora: payload?.vendedora ?? null,
      ordenWeb: payload?.ordenWeb ?? null,
      nroPedido: payload?.nroPedido ?? null,
      items_count: items.length,
      total_estimado: Number(totalEstimado.toFixed(2)),
      items,
    },
    error: {
      code: error?.code || null,
      errno: error?.errno || null,
      sqlState: error?.sqlState || null,
      sqlMessage: error?.sqlMessage || null,
      message: error?.message || 'Unknown error',
      stack: String(error?.stack || '')
        .split('\n')
        .slice(0, 8)
        .join('\n'),
    },
  };
}

function getConfiguredTnubeConnection() {
  if (!TNUBE_STORE_ID || !TNUBE_TOKEN) {
    throw new Error('Configura TNUBE_STORE_ID y TNUBE_TOKEN en .env');
  }
  return {
    storeId: TNUBE_STORE_ID,
    accessToken: TNUBE_TOKEN,
    appName: TNUBE_APPNAME || 'Dashboard',
    tienda: TNUBE_STORE_NAME || TNUBE_STORE_ID,
  };
}

function getTnubeConnection(storeId) {
  const id = String(storeId || '').trim();
  const configured = TNUBE_STORE_ID && TNUBE_TOKEN ? getConfiguredTnubeConnection() : null;
  if (configured) {
    if (id && id !== configured.storeId) {
      throw new Error(`La corrida pertenece al store_id ${id}, pero este servidor esta configurado para ${configured.storeId}`);
    }
    return configured;
  }

  const legacyToken = id ? String(process.env[`TNUBE_TOKEN_${id}`] || '').trim() : '';
  if (!id || !legacyToken) {
    throw new Error('Conexion TiendaNube no configurada. Usa TNUBE_STORE_ID, TNUBE_TOKEN y TNUBE_APPNAME en .env');
  }
  return {
    storeId: id,
    accessToken: legacyToken,
    appName: String(process.env[`TNUBE_APPNAME_${id}`] || 'Dashboard').trim(),
    tienda: TNUBE_STORE_NAME || process.env.LOCAL || id,
  };
}

function buildTnubeQuery(params) {
  const query = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
  });
  const value = query.toString();
  return value ? `?${value}` : '';
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function enrichTnubeNetworkError(error, url) {
  if (!error || error.status) return error;
  const cause = error.cause || {};
  const code = cause.code || cause.errno || '';
  const detail = [code, cause.message].filter(Boolean).join(' - ');
  const message = detail
    ? `No se pudo conectar con TiendaNube (${detail})`
    : `No se pudo conectar con TiendaNube (${error.message || 'fetch failed'})`;
  const enriched = new Error(message);
  enriched.url = url;
  enriched.cause = cause;
  enriched.originalMessage = error.message;
  return enriched;
}

// Envoltorio simple para llamadas a la API de Tienda Nube (headers + JSON).
async function tnubeJsonRequest(storeId, token, appName, method, pathUrl, payload) {
  const url = `${TNUBE_BASE_URL}/${storeId}/${pathUrl.replace(/^\/+/, '')}`;
  const headers = {
    'Content-Type': 'application/json',
    Authentication: `bearer ${token}`,
    'User-Agent': appName || 'Dashboard',
    Accept: 'application/json',
  };
  let lastError = null;
  for (let attempt = 0; attempt <= TNUBE_REQUEST_RETRIES; attempt += 1) {
    try {
      const response = await fetch(url, {
        method,
        headers,
        body: payload ? JSON.stringify(payload) : undefined,
      });
      if (!response.ok) {
        const text = await response.text();
        const err = new Error(text || `TiendaNube error ${response.status}`);
        err.status = response.status;
        err.body = text;
        err.url = url;
        throw err;
      }
      const body = response.status === 204 ? null : await response.json().catch(() => null);
      return { body, headers: response.headers, status: response.status };
    } catch (error) {
      lastError = enrichTnubeNetworkError(error, url);
      const status = Number(error?.status) || 0;
      const retryable = !status || status === 429 || status >= 500;
      if (!retryable || attempt >= TNUBE_REQUEST_RETRIES) break;
      await sleep(500 * (attempt + 1));
    }
  }
  throw lastError;
}

async function tnubeRequest(storeId, token, appName, method, pathUrl, payload) {
  const response = await tnubeJsonRequest(storeId, token, appName, method, pathUrl, payload);
  return response.body;
}

function formatTnubeSyncError(error, fallback = 'Error al sincronizar con Tienda Nube') {
  const raw = String(error?.body || error?.message || fallback || '').trim();
  if (!raw) return fallback;
  const jsonStart = raw.indexOf('{');
  if (jsonStart >= 0) {
    const jsonText = raw.slice(jsonStart).split(' | attemptedValueCounts=')[0];
    try {
      const parsed = JSON.parse(jsonText);
      if (Array.isArray(parsed?.values) && parsed.values.length) return parsed.values.join(', ');
      if (parsed?.description) return String(parsed.description);
      if (parsed?.message) return String(parsed.message);
    } catch (_error) {
      /* keep raw message */
    }
  }
  return raw.length > 450 ? `${raw.slice(0, 447)}...` : raw;
}

function validateReplicaTnDate(value, fieldName) {
  const text = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new Error(`${fieldName} debe tener formato YYYY-MM-DD`);
  }
  const date = new Date(`${text}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${fieldName} invalida`);
  }
  return text;
}

function buildReplicaTnDateRange(fechaMin, fechaMax) {
  return {
    createdAtMin: `${fechaMin}T00:00:00-03:00`,
    createdAtMax: `${fechaMax}T23:59:59-03:00`,
  };
}

function normalizeLocalName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
}

function splitReplicaTnName(name) {
  const fullName = String(name || '').trim().replace(/\s+/g, ' ');
  if (!fullName) return { nombre: 'Cliente', apellido: 'TiendaNube' };
  const parts = fullName.split(' ');
  if (parts.length === 1) return { nombre: parts[0], apellido: 'TiendaNube' };
  return {
    nombre: parts.slice(0, -1).join(' '),
    apellido: parts.slice(-1)[0],
  };
}

function normalizeReplicaTnOrder(order, tienda, existingOrderNumbers = new Set()) {
  const customer = order?.customer || {};
  const defaultAddress = customer.default_address || {};
  const nameParts = splitReplicaTnName(customer.name || order?.contact_name || '');
  const locality = defaultAddress.locality || defaultAddress.city || customer.billing_city || order?.billing_city || '';
  const province = customer.billing_province || defaultAddress.province || order?.billing_province || '';
  const addressText = [defaultAddress.address || order?.billing_address || '', defaultAddress.number || '']
    .filter(Boolean)
    .join(' ')
    .trim();
  const ordenWeb = Number(order?.number || order?.id) || 0;
  const createdAt = order?.created_at ? new Date(order.created_at) : null;
  const fechaProveedor = createdAt && !Number.isNaN(createdAt.getTime()) ? formatDateTimeLocal(createdAt) : null;
  const items = Array.isArray(order?.products)
    ? order.products.map((item) => ({
        articulo: String(item?.sku || '').trim(),
        detalle: String(item?.name || '').trim(),
        precio: Number(item?.price) || 0,
        cantidad: Number(item?.quantity) || 0,
      }))
    : [];
  const mail = String(customer.email || order?.contact_email || '').trim();
  return {
    ordenWeb,
    tienda,
    nombre: nameParts.nombre,
    apellido: nameParts.apellido,
    mail,
    direccion: addressText,
    telefono: String(customer.phone || order?.contact_phone || '').trim(),
    cuit: String(customer.identification || order?.billing_customer_document || '').trim(),
    provincia: province,
    localidad: locality,
    codigoPostal: String(order?.billing_zipcode || defaultAddress.zipcode || '').trim(),
    totalWeb: Number(order?.total) || 0,
    fechaProveedor,
    items,
    itemsCount: items.length,
    duplicated: existingOrderNumbers.has(String(ordenWeb)),
    warnings: [
      !mail ? 'Sin mail: se usara cliente generico' : '',
      !items.length ? 'Sin articulos' : '',
    ].filter(Boolean),
  };
}

async function fetchReplicaTnOrders(tnubeConnection, fechaMin, fechaMax) {
  const perPage = 50;
  const dateRange = buildReplicaTnDateRange(fechaMin, fechaMax);
  const firstQuery = buildTnubeQuery({
    page: 1,
    per_page: perPage,
    status: 'open',
    created_at_min: dateRange.createdAtMin,
    created_at_max: dateRange.createdAtMax,
  });
  let firstResponse;
  try {
    firstResponse = await tnubeJsonRequest(
      tnubeConnection.storeId,
      tnubeConnection.accessToken,
      tnubeConnection.appName,
      'GET',
      `orders${firstQuery}`
    );
  } catch (error) {
    const raw = String(error?.body || error?.message || '');
    if (Number(error?.status) === 404 && raw.includes('Last page is 0')) {
      return [];
    }
    throw error;
  }
  const total = Number(firstResponse.headers.get('x-total-count')) || (Array.isArray(firstResponse.body) ? firstResponse.body.length : 0);
  const pages = Math.max(1, Math.ceil(total / perPage));
  const orders = Array.isArray(firstResponse.body) ? [...firstResponse.body] : [];
  for (let page = 2; page <= pages; page += 1) {
    const query = buildTnubeQuery({
      page,
      per_page: perPage,
      status: 'open',
      created_at_min: dateRange.createdAtMin,
      created_at_max: dateRange.createdAtMax,
    });
    const response = await tnubeJsonRequest(
      tnubeConnection.storeId,
      tnubeConnection.accessToken,
      tnubeConnection.appName,
      'GET',
      `orders${query}`
    );
    if (Array.isArray(response.body)) orders.push(...response.body);
  }
  return orders;
}

async function getReplicaTnProvinciaId(conn, provincia) {
  const nombre = String(provincia || '').trim();
  if (!nombre) return 1;
  const [[row]] = await conn.query(
    `SELECT id FROM ${DB_NAME}.provincias WHERE nombre = ? LIMIT 1`,
    [nombre]
  );
  return Number(row?.id) || 1;
}

function limitReplicaTnText(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength);
}

function normalizeReplicaTnCuit(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return null;
  const number = Number(digits);
  if (!Number.isSafeInteger(number) || number > 2147483647) return null;
  return number;
}

async function getOrCreateReplicaTnCliente(conn, order) {
  const mail = limitReplicaTnText(order.mail, 45);
  if (!mail) return { id: 1, created: false, generic: true };
  const [[existing]] = await conn.query(
    `SELECT id_clientes FROM ${DB_NAME}.clientes WHERE mail = ? LIMIT 1`,
    [mail]
  );
  if (existing?.id_clientes) {
    return { id: Number(existing.id_clientes), created: false, generic: false };
  }
  const provinciaId = await getReplicaTnProvinciaId(conn, order.provincia);
  const [result] = await conn.query(
    `INSERT INTO ${DB_NAME}.clientes
     (nombre, apellido, apodo, direccion, mail, telefono, cuit, localidad, CodigoPostal, id_provincia, encuesta, created_at, updated_at)
     VALUES (?, ?, '', ?, ?, ?, ?, ?, ?, ?, 'Ninguna', NOW(), NOW())`,
    [
      limitReplicaTnText(order.nombre || 'Cliente', 45),
      limitReplicaTnText(order.apellido || 'TiendaNube', 45),
      limitReplicaTnText(order.direccion, 45),
      mail,
      limitReplicaTnText(order.telefono, 45),
      normalizeReplicaTnCuit(order.cuit),
      limitReplicaTnText(order.localidad, 45),
      limitReplicaTnText(order.codigoPostal, 10),
      provinciaId,
    ]
  );
  return { id: Number(result.insertId) || 1, created: true, generic: false };
}

async function reserveReplicaTnPedidoNumber(conn) {
  const [[row]] = await conn.query(
    `SELECT Nropedido FROM ${DB_NAME}.nropedido LIMIT 1 FOR UPDATE`
  );
  let nroPedido = (Number(row?.Nropedido) || 0) + 1;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const [[existsRow]] = await conn.query(
      `SELECT 1 FROM ${DB_NAME}.controlpedidos WHERE nropedido = ? LIMIT 1`,
      [nroPedido]
    );
    if (!existsRow) {
      await conn.query(`UPDATE ${DB_NAME}.nropedido SET Nropedido = ?`, [nroPedido]);
      return nroPedido;
    }
    nroPedido += 1;
  }
  throw new Error('No se pudo reservar un nroPedido libre');
}

async function createReplicaTnPedido(conn, rawOrder, tnubeConnection) {
  const order = {
    ...rawOrder,
    tienda: tnubeConnection.tienda,
    ordenWeb: Number(rawOrder?.ordenWeb) || 0,
    totalWeb: Number(rawOrder?.totalWeb) || 0,
    items: Array.isArray(rawOrder?.items) ? rawOrder.items : [],
  };
  if (!order.ordenWeb) throw new Error('OrdenWeb invalida');
  if (!order.items.length) throw new Error(`La orden ${order.ordenWeb} no tiene articulos`);
  await conn.query(`SELECT Nropedido FROM ${DB_NAME}.nropedido LIMIT 1 FOR UPDATE`);
  const [[duplicate]] = await conn.query(
    `SELECT id, nropedido
     FROM ${DB_NAME}.controlpedidos
     WHERE ordenWeb = ? AND local = ?
     LIMIT 1
     FOR UPDATE`,
    [order.ordenWeb, tnubeConnection.tienda]
  );
  if (duplicate) {
    return {
      status: 'duplicated',
      ordenWeb: order.ordenWeb,
      nroPedido: Number(duplicate.nropedido) || 0,
      message: 'La orden ya existe en el sistema',
    };
  }
  const cliente = await getOrCreateReplicaTnCliente(conn, order);
  const nroPedido = await reserveReplicaTnPedidoNumber(conn);
  const fecha = formatDateTimeLocal(new Date());
  const fechaProveedor = order.fechaProveedor || null;
  const [pedidoResult] = await conn.query(
    `INSERT INTO ${DB_NAME}.controlpedidos
     (id_cliente, nropedido, vendedora, cajera, fecha, estado, total, ordenWeb, empaquetado, totalweb, local, fecha_proveedor)
     VALUES (?, ?, 'PAGINA', 'ReplicaTN', ?, 1, 0, ?, 0, ?, ?, ?)`,
    [cliente.id, nroPedido, fecha, order.ordenWeb, order.totalWeb, tnubeConnection.tienda, fechaProveedor]
  );
  const pedidoId = Number(pedidoResult.insertId) || 0;
  for (const item of order.items) {
    const articulo = limitReplicaTnText(item?.articulo, 255);
    const detalle = limitReplicaTnText(item?.detalle, 255);
    const precio = Number(item?.precio) || 0;
    const cantidad = Number(item?.cantidad) || 0;
    if (!articulo && !detalle) continue;
    if (cantidad <= 0) continue;
    await conn.query(
      `INSERT INTO ${DB_NAME}.ordenesarticulos
       (articulo, detalle, precio, cantidad, id_controlPedidos)
       VALUES (?, ?, ?, ?, ?)`,
      [articulo, detalle, precio, cantidad, pedidoId]
    );
  }
  return {
    status: 'created',
    ordenWeb: order.ordenWeb,
    nroPedido,
    clienteId: cliente.id,
    clienteCreado: cliente.created,
    clienteGenerico: cliente.generic,
    message: cliente.generic ? 'Pedido creado con cliente generico' : 'Pedido creado',
  };
}

function isTnPublicacionesDebugEnabled() {
  return process.env.TN_PUBLICACIONES_DEBUG === '1';
}

function redondeoDecimal(precioVenta) {
  let precio = Number(precioVenta) || 0;
  precio = Math.round(precio * 100) / 100;
  let result = Math.round((precio / 0.05) * 100) / 100 - Math.trunc(Math.round((precio / 0.05) * 100) / 100);
  while (result !== 0) {
    precio = precio - 0.01;
    precio = Number(precio.toFixed(2));
    const x = Number((precio / 0.05).toFixed(2));
    const f = Math.trunc(x);
    result = Number((x - f).toFixed(2));
  }
  return precio;
}

  // Replica helper Precio en PHP: calcula precio de venta segun manual/convertido y tipo de cambio.
  async function computePrecioVenta(conn, articuloRow) {
  const precioManual = Number(articuloRow.PrecioManual) || 0;
  const precioConvertido = Number(articuloRow.PrecioConvertido) || 0;
  if (!precioManual && !precioConvertido) return null;
  if (precioManual !== 0) {
    const gastos = Number(articuloRow.Gastos) || 0;
    const ganancia = Number(articuloRow.Ganancia) || 0;
    return redondeoDecimal(precioManual * gastos * ganancia);
  }
  const [provRows] = await conn.query(
    `SELECT Gastos, Ganancia FROM ${DB_NAME}.proveedores WHERE Nombre = ? LIMIT 1`,
    [articuloRow.Proveedor]
  );
  const proveedor = provRows[0];
  if (!proveedor) return null;
  const gastos = Number(proveedor.Gastos) || 0;
  const ganancia = Number(proveedor.Ganancia) || 0;
  const moneda = String(articuloRow.Moneda || '').toUpperCase();
  if (moneda === 'ARG') {
    return redondeoDecimal(precioConvertido * gastos * ganancia);
  }
    const [dolarRows] = await conn.query(`SELECT PrecioDolar FROM ${DB_NAME}.preciodolar LIMIT 1`);
  const dolar = dolarRows[0] || {};
  const precioEnPesos = precioConvertido * (Number(dolar.PrecioDolar) || 0);
  return redondeoDecimal(precioEnPesos * gastos * ganancia);
}

async function computePrecioArgen(conn, articuloRow) {
  const precioManual = Number(articuloRow.PrecioManual) || 0;
  const precioConvertido = Number(articuloRow.PrecioConvertido) || 0;
  if (precioManual !== 0) return precioManual;
  if (!precioConvertido) return 0;
  const moneda = String(articuloRow.Moneda || '').toUpperCase();
  if (moneda === 'ARG') return precioConvertido;
  const [dolarRows] = await conn.query(`SELECT PrecioDolar FROM ${DB_NAME}.preciodolar LIMIT 1`);
  const dolar = dolarRows[0] || {};
  return precioConvertido * (Number(dolar.PrecioDolar) || 0);
}

function getRequestIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  const raw = req.socket?.remoteAddress || req.ip || '';
  return raw.replace('::ffff:', '');
}

function buildIpCandidates(ip) {
  const trimmed = String(ip || '').trim();
  if (!trimmed) return [];
  const candidates = new Set([trimmed]);
  const normalized = trimmed.replace('::ffff:', '');
  candidates.add(normalized);
  const isLoopback = normalized === '::1' || normalized === '127.0.0.1';
  if (normalized === '::1') candidates.add('127.0.0.1');
  if (normalized === '127.0.0.1') candidates.add('::1');
  if (isLoopback) {
    const nets = os.networkInterfaces();
    Object.values(nets).forEach((list) => {
      list.forEach((net) => {
        if (net.family === 'IPv4' && !net.internal) {
          candidates.add(net.address);
        }
      });
    });
  }
  return Array.from(candidates);
}

function verificoStock(cantidad, artiCant) {
  return Number(cantidad) >= Number(artiCant) ? 1000 : 0;
}

async function fetchTnubeProductCount(connection, tipoBajada, year) {
  const params = {
    page: 1,
    per_page: 1,
    created_at_min: `${year}-01-01`,
    created_at_max: `${year}-12-31`,
  };
  if (tipoBajada === 'visible') params.published = 'true';
  const response = await tnubeJsonRequest(
    connection.storeId,
    connection.accessToken,
    connection.appName,
    'GET',
    `products${buildTnubeQuery(params)}`
  );
  return Number(response.headers.get('x-total-count')) || 0;
}

async function fetchTnubeProductsPage(connection, tipoBajada, year, page) {
  const params = {
    page,
    per_page: TNUBE_PRODUCTS_PER_PAGE,
    created_at_min: `${year}-01-01`,
    created_at_max: `${year}-12-31`,
  };
  if (tipoBajada === 'visible') params.published = 'true';
  const response = await tnubeJsonRequest(
    connection.storeId,
    connection.accessToken,
    connection.appName,
    'GET',
    `products${buildTnubeQuery(params)}`
  );
  return Array.isArray(response.body) ? response.body : [];
}

function buildTnubeStatusRows(products) {
  const rows = [];
  (products || []).forEach((product) => {
    const variants = Array.isArray(product?.variants) ? product.variants : [];
    const imageSrc = Array.isArray(product?.images) && product.images[0]?.src ? String(product.images[0].src) : '';
    const hasImages = imageSrc || (Array.isArray(product?.images) && product.images.length > 0) ? 1 : 0;
    variants.forEach((variant) => {
      const variantValues = Array.isArray(variant?.values) ? variant.values : [];
      const variantValue = variantValues
        .map((item) => item?.es || item?.pt || item?.en || Object.values(item || {})[0] || '')
        .filter(Boolean)
        .join(' / ');
      rows.push({
        articulo: variant?.sku == null ? '' : String(variant.sku),
        productId: variant?.product_id || product?.id || '',
        articuloId: variant?.id || '',
        visible: product?.published ? 1 : 0,
        images: hasImages,
        imagessrc: imageSrc,
        valorVariante: variantValue,
        publishedPadre: product?.published ? 1 : 0,
        visibleVariante: variant?.visible ? 1 : 0,
        stockTn: variant?.stock == null ? null : Number(variant.stock),
        positionVariante: variant?.position == null ? null : Number(variant.position),
      });
    });
  });
  return rows;
}

function createEcommerceImportJob(tipoBajada, userId) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const job = {
    id,
    tipoBajada,
    userId,
    status: 'running',
    phase: 'Iniciando',
    percent: 0,
    processedPages: 0,
    totalPages: 0,
    productos: 0,
    variantes: 0,
    corrida: null,
    tienda: '',
    storeId: '',
    message: '',
    error: '',
    createdAt: now,
    updatedAt: now,
  };
  ecommerceImportJobs.set(id, job);
  persistEcommerceJob(job);
  return job;
}

function updateEcommerceImportJob(job, patch) {
  Object.assign(job, patch, { updatedAt: new Date().toISOString() });
  persistEcommerceJob(job);
}

function serializeEcommerceImportJob(job) {
  return {
    id: job.id,
    status: job.status,
    phase: job.phase,
    percent: Math.max(0, Math.min(100, Math.round(Number(job.percent) || 0))),
    processedPages: job.processedPages,
    totalPages: job.totalPages,
    productos: job.productos,
    variantes: job.variantes,
    corrida: job.corrida,
    tienda: job.tienda,
    storeId: job.storeId,
    message: job.message,
    error: job.error,
  };
}

async function fetchTnubeImportRows(connection, tipoBajada, onProgress) {
  const now = new Date();
  const endYear = now.getFullYear();
  const rows = [];
  const years = [];
  onProgress?.({ phase: 'Calculando paginas', percent: 2 });
  for (let year = TNUBE_IMPORT_START_YEAR; year <= endYear; year += 1) {
    const total = await fetchTnubeProductCount(connection, tipoBajada, year);
    const pages = Math.ceil(total / TNUBE_PRODUCTS_PER_PAGE);
    years.push({ year, products: total, pages });
    const products = years.reduce((acc, item) => acc + item.products, 0);
    const totalPages = years.reduce((acc, item) => acc + item.pages, 0);
    onProgress?.({ phase: `Calculando paginas ${year}`, productos: products, totalPages, percent: 5 });
  }

  const totalPages = years.reduce((acc, item) => acc + item.pages, 0);
  let processedPages = 0;
  onProgress?.({ phase: 'Descargando productos', totalPages, processedPages, percent: totalPages ? 5 : 80 });
  for (const item of years) {
    for (let page = 1; page <= item.pages; page += 1) {
      const products = await fetchTnubeProductsPage(connection, tipoBajada, item.year, page);
      rows.push(...buildTnubeStatusRows(products));
      processedPages += 1;
      const downloadPercent = totalPages ? 5 + (processedPages / totalPages) * 80 : 80;
      onProgress?.({
        phase: `Descargando ${item.year} pagina ${page}/${item.pages}`,
        processedPages,
        totalPages,
        variantes: rows.length,
        percent: downloadPercent,
      });
    }
  }
  return { rows, years };
}

async function insertTnubeStatusRows(conn, idProvecomerce, rows, onProgress) {
  const fecha = formatDateTimeLocal(new Date());
  for (let offset = 0; offset < rows.length; offset += TNUBE_INSERT_CHUNK_SIZE) {
    const chunk = rows.slice(offset, offset + TNUBE_INSERT_CHUNK_SIZE);
    const values = [];
    const placeholders = chunk
      .map((row) => {
        values.push(
          idProvecomerce,
          'Pending',
          fecha,
          row.articulo,
          row.productId,
          row.articuloId,
          row.visible,
          row.visibleVariante,
          row.publishedPadre,
          row.stockTn,
          row.positionVariante,
          row.valorVariante,
          row.images,
          row.imagessrc
        );
        return '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
      })
      .join(', ');
    await conn.query(
      `INSERT INTO ${DB_NAME}.statusecomercesincro
       (id_provecomerce, status, fecha, articulo, product_id, articulo_id, visible,
        visible_variante, published_padre, stock_tn, position_variante, valor_variante,
        images, imagessrc)
       VALUES ${placeholders}`,
      values
    );
    const inserted = Math.min(rows.length, offset + chunk.length);
    const insertPercent = rows.length ? 85 + (inserted / rows.length) * 14 : 99;
    onProgress?.({ phase: `Guardando ${inserted}/${rows.length}`, percent: insertPercent });
  }
}

async function runEcommerceImportJob(job) {
  let conn;
  try {
    const tnubeConnection = getConfiguredTnubeConnection();
    updateEcommerceImportJob(job, {
      tienda: tnubeConnection.tienda,
      storeId: tnubeConnection.storeId,
      phase: 'Conectando con Tienda Nube',
      percent: 1,
    });
    const importResult = await fetchTnubeImportRows(tnubeConnection, job.tipoBajada, (progress) => {
      updateEcommerceImportJob(job, progress);
    });
    const fecha = formatDateTimeLocal(new Date());

    updateEcommerceImportJob(job, {
      phase: 'Creando corrida',
      productos: importResult.years.reduce((acc, item) => acc + item.products, 0),
      variantes: importResult.rows.length,
      percent: 85,
    });
    conn = await pool.getConnection();
    await conn.beginTransaction();
    const [proveResult] = await conn.query(
      `INSERT INTO ${DB_NAME}.provecomerce (proveedor, id_users, fecha, id_cliente, tienda)
       VALUES (?, ?, ?, ?, ?)`,
      ['TiendaNube', job.userId || null, fecha, tnubeConnection.storeId, tnubeConnection.tienda]
    );
    const idProvecomerce = proveResult.insertId;
    if (importResult.rows.length) {
      await insertTnubeStatusRows(conn, idProvecomerce, importResult.rows, (progress) => {
        updateEcommerceImportJob(job, progress);
      });
    }
    await conn.commit();
    updateEcommerceImportJob(job, {
      status: 'done',
      phase: 'Finalizado',
      percent: 100,
      corrida: idProvecomerce,
      message: `Corrida ${idProvecomerce} creada para ${tnubeConnection.tienda}. Variantes: ${importResult.rows.length}.`,
    });
  } catch (error) {
    if (conn) {
      try {
        await conn.rollback();
      } catch (_err) {
        /* ignore */
      }
    }
    updateEcommerceImportJob(job, {
      status: 'error',
      phase: 'Error',
      error: error.message || 'Error al crear bajada TiendaNube',
    });
  } finally {
    if (conn) conn.release();
  }
}

function createEcommerceSyncJob(params, userId) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const job = {
    id,
    userId,
    params,
    status: 'running',
    phase: 'Iniciando',
    percent: 0,
    processed: 0,
    total: 0,
    ok: 0,
    error: 0,
    noRequiere: 0,
    currentArticulo: '',
    message: '',
    errorMessage: '',
    createdAt: now,
    updatedAt: now,
  };
  ecommerceSyncJobs.set(id, job);
  persistEcommerceJob(job);
  return job;
}

function updateEcommerceSyncJob(job, patch) {
  Object.assign(job, patch, { updatedAt: new Date().toISOString() });
  persistEcommerceJob(job);
}

function serializeEcommerceSyncJob(job) {
  return {
    id: job.id,
    status: job.status,
    phase: job.phase,
    percent: Math.max(0, Math.min(100, Math.round(Number(job.percent) || 0))),
    processed: job.processed,
    total: job.total,
    ok: job.ok,
    error: job.error,
    noRequiere: job.noRequiere,
    currentArticulo: job.currentArticulo,
    message: job.message,
    errorMessage: job.errorMessage,
  };
}

function getEcommerceJobPath(jobId) {
  const safeId = String(jobId || '').replace(/[^a-zA-Z0-9_-]/g, '');
  return safeId ? path.join(ECOMMERCE_JOBS_DIR, `${safeId}.json`) : '';
}

function persistEcommerceJob(job) {
  try {
    if (!fs.existsSync(ECOMMERCE_JOBS_DIR)) fs.mkdirSync(ECOMMERCE_JOBS_DIR, { recursive: true });
    const filePath = getEcommerceJobPath(job?.id);
    if (!filePath) return;
    fs.writeFileSync(filePath, JSON.stringify(job), 'utf8');
  } catch (_err) {
    /* ignore progress persistence errors */
  }
}

function readPersistedEcommerceJob(jobId) {
  try {
    const filePath = getEcommerceJobPath(jobId);
    if (!filePath || !fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_err) {
    return null;
  }
}

function signEcommerceJobToken(jobId, extra = {}) {
  const body = Buffer.from(JSON.stringify({ jobId, ...extra, iat: Date.now() })).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verifyEcommerceJobToken(jobId, token) {
  const [body, sig] = String(token || '').split('.');
  if (!body || !sig) return false;
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    return String(payload.jobId || '') === String(jobId || '') ? payload : false;
  } catch (_err) {
    return false;
  }
}

async function getEcommerceSyncRows(conn, idCorrida, conOrden, ordenCant) {
  const statusOk = 'OK';
  if (conOrden) {
    const sql = `
      SELECT
        OrdenCompras.OrdenCompra,
        StatusEComerce.id AS e_id,
        StatusEComerce.id_provecomerce,
        OrdenCompras.articulo,
        StatusEComerce.product_id,
        StatusEComerce.articulo_id,
        StatusEComerce.visible,
        StatusEComerce.visible_variante,
        StatusEComerce.published_padre,
        StatusEComerce.images
      FROM ${DB_NAME}.compras AS OrdenCompras
      INNER JOIN ${DB_NAME}.statusecomercesincro AS StatusEComerce
        ON OrdenCompras.Articulo = StatusEComerce.Articulo
      WHERE OrdenCompras.OrdenCompra IN (
        SELECT OrdenCompra
        FROM (
          SELECT OrdenCompra
          FROM ${DB_NAME}.compras
          GROUP BY OrdenCompra
          ORDER BY OrdenCompra DESC
          LIMIT ?
        ) AS subquery
      )
        AND OrdenCompras.Cantidad <> 0
        AND StatusEComerce.id_provecomerce = ?
        AND StatusEComerce.status <> ?
    `;
    const [rows] = await conn.query(sql, [ordenCant, idCorrida, statusOk]);
    return rows;
  }
  const sql = `
    SELECT
      statusecomerce.id AS e_id,
      statusecomerce.id_provecomerce,
      statusecomerce.articulo,
      statusecomerce.status,
      statusecomerce.fecha,
      statusecomerce.product_id,
      statusecomerce.articulo_id,
      statusecomerce.visible,
      statusecomerce.visible_variante,
      statusecomerce.published_padre,
      statusecomerce.images
    FROM ${DB_NAME}.statusecomercesincro AS statusecomerce
    WHERE statusecomerce.id_provecomerce = ?
      AND statusecomerce.status <> ?
  `;
  const [rows] = await conn.query(sql, [idCorrida, statusOk]);
  return rows;
}

function hasEcommerceStock(cantidad, artiCant) {
  return Number(cantidad) >= Number(artiCant);
}

async function updateEcommerceVariantSnapshot(conn, id, stock, visible) {
  await conn.query(
    `UPDATE ${DB_NAME}.statusecomercesincro
     SET stock_tn = ?, visible_variante = ?
     WHERE id = ?`,
    [stock, visible ? 1 : 0, id]
  );
}

async function updateEcommerceProductSnapshot(conn, idCorrida, productId, published) {
  await conn.query(
    `UPDATE ${DB_NAME}.statusecomercesincro
     SET visible = ?, published_padre = ?
     WHERE id_provecomerce = ? AND product_id = ?`,
    [published ? 1 : 0, published ? 1 : 0, idCorrida, productId]
  );
}

async function getEcommerceProductAvailability(conn, idCorrida, productIds, artiCant) {
  const cleanProductIds = Array.from(new Set((productIds || []).map((id) => String(id || '').trim()).filter(Boolean)));
  if (!cleanProductIds.length) return [];
  const placeholders = cleanProductIds.map(() => '?').join(',');
  const sql = `
    SELECT
      StatusEComerce.product_id,
      MAX(COALESCE(StatusEComerce.images, 0)) AS has_images,
      MAX(COALESCE(StatusEComerce.published_padre, StatusEComerce.visible, 0)) AS current_published,
      SUM(
        CASE
          WHEN COALESCE(articulos.Web, 0) = 1
           AND (COALESCE(articulos.Cantidad, 0) - COALESCE(pedidos.Cantidad, 0)) >= ?
          THEN 1
          ELSE 0
        END
      ) AS available_variants
    FROM ${DB_NAME}.statusecomercesincro AS StatusEComerce
    LEFT JOIN ${DB_NAME}.articulos AS articulos
      ON articulos.Articulo = StatusEComerce.articulo
    LEFT JOIN (
      SELECT pedtemp.Articulo, SUM(pedtemp.cantidad) AS Cantidad
      FROM ${DB_NAME}.pedidotemp AS pedtemp
      INNER JOIN ${DB_NAME}.controlpedidos AS control ON pedtemp.NroPedido = control.nropedido
      WHERE control.estado = 1
      GROUP BY pedtemp.Articulo
    ) AS pedidos
      ON pedidos.Articulo = StatusEComerce.articulo
    WHERE StatusEComerce.id_provecomerce = ?
      AND StatusEComerce.product_id IN (${placeholders})
    GROUP BY StatusEComerce.product_id
  `;
  const [rows] = await conn.query(sql, [artiCant, idCorrida, ...cleanProductIds]);
  return rows || [];
}

async function syncEcommerceParentPublishedStates(conn, idCorrida, productIds, tnubeConnection, artiCant, onProgress) {
  const availabilityRows = await getEcommerceProductAvailability(conn, idCorrida, productIds, artiCant);
  for (let index = 0; index < availabilityRows.length; index += 1) {
    const row = availabilityRows[index];
    const productId = row.product_id;
    const published = Number(row.available_variants) > 0;
    const currentPublished = Number(row.current_published) === 1;
    onProgress?.({
      phase: `Padres ${index + 1}/${availabilityRows.length} | ${published ? 'Publicando' : 'Ocultando'} ${productId}`,
    });
    if (currentPublished === published) {
      continue;
    }
    await tnubeRequest(
      tnubeConnection.storeId,
      tnubeConnection.accessToken,
      tnubeConnection.appName,
      'PUT',
      `products/${productId}`,
      { published }
    );
    await updateEcommerceProductSnapshot(conn, idCorrida, productId, published);
  }
}

async function processEcommerceSyncRows(conn, rows, tnubeConnection, options, onProgress) {
  const statusOk = 'OK';
  let countOk = 0;
  let countError = 0;
  let countCheck = 0;
  const processedProductIds = new Set();
  const productsWithErrors = new Set();
  const publishedProducts = new Set();

  const updateStatus = async (id, status) => {
    const fecha = formatDateTimeLocal(new Date());
    await conn.query(
      `UPDATE ${DB_NAME}.statusecomercesincro SET status = ?, fecha = ? WHERE id = ?`,
      [status, fecha, id]
    );
  };

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const processed = index + 1;
    const baseProgress = {
      processed,
      total: rows.length,
      currentArticulo: row.articulo || '',
      percent: rows.length ? (processed / rows.length) * 100 : 100,
    };
    try {
      onProgress?.({ ...baseProgress, phase: `Leyendo ${row.articulo || ''}` });
      const [statusRows] = await conn.query(
        `SELECT status FROM ${DB_NAME}.statusecomercesincro WHERE id = ? LIMIT 1`,
        [row.e_id]
      );
      const currentStatus = statusRows[0]?.status || '';
      if (currentStatus === statusOk) {
        countCheck += 1;
        onProgress?.({ ...baseProgress, phase: 'Sin cambios', ok: countOk, error: countError, noRequiere: countCheck });
        continue;
      }

      const [artRows] = await conn.query(
        `SELECT Articulo, PrecioManual, PrecioConvertido, Gastos, Ganancia, Moneda, Proveedor, Cantidad, Web
         FROM ${DB_NAME}.articulos
         WHERE Articulo = ?
         LIMIT 1`,
        [row.articulo]
      );
      if (!artRows.length) {
        if (currentStatus === 'Pending') countCheck += 1;
        onProgress?.({ ...baseProgress, phase: 'No existe en sistema', ok: countOk, error: countError, noRequiere: countCheck });
        continue;
      }
      const articuloLocal = artRows[0];

      const [pedidoRows] = await conn.query(
        `SELECT pedtemp.Articulo AS Articulo, SUM(pedtemp.cantidad) AS Cantidad
         FROM ${DB_NAME}.pedidotemp AS pedtemp
         INNER JOIN ${DB_NAME}.controlpedidos AS control ON pedtemp.NroPedido = control.nropedido
         WHERE pedtemp.articulo = ?
           AND control.estado = 1`,
        [row.articulo]
      );
      let cantidad = Number(articuloLocal.Cantidad) || 0;
      const pedidoCantidad = Number(pedidoRows[0]?.Cantidad) || 0;
      if (pedidoCantidad) cantidad -= pedidoCantidad;

      const hasStock = hasEcommerceStock(cantidad, options.artiCant);
      const variantStock = verificoStock(cantidad, options.artiCant);
      const productId = String(row.product_id || '').trim();
      if (productId) processedProductIds.add(productId);

      if (
        options.conOrden &&
        productId &&
        !publishedProducts.has(productId) &&
        Number(row.images) === 1 &&
        hasStock
      ) {
        onProgress?.({ ...baseProgress, phase: `Publicando ${row.articulo || ''}` });
        await tnubeRequest(
          tnubeConnection.storeId,
          tnubeConnection.accessToken,
          tnubeConnection.appName,
          'PUT',
          `products/${row.product_id}`,
          { published: true }
        );
        publishedProducts.add(productId);
        await updateEcommerceProductSnapshot(conn, row.id_provecomerce, productId, true);
      }

      if (Number(articuloLocal.Web) === 1) {
        onProgress?.({ ...baseProgress, phase: `Actualizando precio/stock/visible ${row.articulo || ''}` });
        const precioVenta = await computePrecioVenta(conn, articuloLocal);
        await tnubeRequest(
          tnubeConnection.storeId,
          tnubeConnection.accessToken,
          tnubeConnection.appName,
          'PATCH',
          `products/${row.product_id}/variants`,
          [{
            id: Number(row.articulo_id),
            price: precioVenta ?? 0,
            stock: variantStock,
            visible: hasStock,
          }]
        );
        await updateEcommerceVariantSnapshot(conn, row.e_id, variantStock, hasStock);
        await updateStatus(row.e_id, 'OK');
        countOk += 1;
      } else {
        await updateStatus(row.e_id, 'Excluido');
        countOk += 1;
      }
      onProgress?.({ ...baseProgress, phase: 'Procesado', ok: countOk, error: countError, noRequiere: countCheck });
    } catch (_err) {
      try {
        await updateStatus(row.e_id, 'ErrorAPI');
      } catch (_updateErr) {
        /* ignore */
      }
      if (row.product_id) productsWithErrors.add(String(row.product_id).trim());
      countError += 1;
      onProgress?.({ ...baseProgress, phase: 'ErrorAPI', ok: countOk, error: countError, noRequiere: countCheck });
    }
  }

  if (!options.conOrden) {
    const productIdsToSync = Array.from(processedProductIds).filter((productId) => !productsWithErrors.has(productId));
    if (productIdsToSync.length) {
      onProgress?.({
        processed: rows.length,
        total: rows.length,
        percent: 99,
        phase: 'Actualizando padres',
        ok: countOk,
        error: countError,
        noRequiere: countCheck,
      });
      try {
        await syncEcommerceParentPublishedStates(
          conn,
          rows[0]?.id_provecomerce,
          productIdsToSync,
          tnubeConnection,
          options.artiCant,
          (progress) => onProgress?.({
            processed: rows.length,
            total: rows.length,
            percent: 99,
            ok: countOk,
            error: countError,
            noRequiere: countCheck,
            ...progress,
          })
        );
      } catch (_err) {
        countError += 1;
      }
    }
  }

  return { OK: countOk, Error: countError, 'No Requiere': countCheck };
}

async function runEcommerceSyncJob(job) {
  let conn;
  try {
    const { idCorrida, storeId, conOrden, ordenCant, artiCant } = job.params;
    const tnubeConnection = getTnubeConnection(storeId);
    conn = await pool.getConnection();
    updateEcommerceSyncJob(job, { phase: 'Buscando articulos', percent: 1 });
    const rows = await getEcommerceSyncRows(conn, idCorrida, conOrden, ordenCant);
    updateEcommerceSyncJob(job, { total: rows.length, phase: 'Procesando articulos', percent: rows.length ? 1 : 100 });
    const result = await processEcommerceSyncRows(
      conn,
      rows,
      tnubeConnection,
      { conOrden, artiCant },
      (progress) => updateEcommerceSyncJob(job, progress)
    );
    updateEcommerceSyncJob(job, {
      status: 'done',
      phase: 'Finalizado',
      percent: 100,
      ok: result.OK,
      error: result.Error,
      noRequiere: result['No Requiere'],
      message: `OK: ${result.OK} | Error: ${result.Error} | Sin cambios: ${result['No Requiere']}`,
    });
  } catch (error) {
    updateEcommerceSyncJob(job, {
      status: 'error',
      phase: 'Error',
      errorMessage: error.message || 'Error en sincro TiendaNube',
    });
  } finally {
    if (conn) conn.release();
  }
}

function getTnubeLocalizedText(value) {
  const text = String(value || '').trim();
  return { es: text };
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatTnubeDescriptionHtml(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const bulletParts = text
    .replace(/\r\n/g, '\n')
    .split(/\n+|(?=\s*[•●]\s+)/)
    .map((line) => line.replace(/^[\s•●*-]+/, '').trim())
    .filter(Boolean);
  if (bulletParts.length > 1 || /^[\s•●*-]+/.test(text)) {
    return `<ul>${bulletParts.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>`;
  }
  return escapeHtml(text).replace(/\n/g, '<br>');
}

function getTnubeProductId(product) {
  if (Array.isArray(product)) return getTnubeProductId(product[0]);
  return product?.id || product?.product_id || null;
}

function getTnubeVariantRows(product) {
  if (Array.isArray(product)) return getTnubeVariantRows(product[0]);
  return Array.isArray(product?.variants) ? product.variants : [];
}

async function fetchTnubeProductVariants(connection, productId) {
  const rows = [];
  const perPage = 200;
  for (let page = 1; page <= 20; page += 1) {
    const pageRows = await tnubeRequest(
      connection.storeId,
      connection.accessToken,
      connection.appName,
      'GET',
      `products/${encodeURIComponent(productId)}/variants${buildTnubeQuery({ per_page: perPage, page })}`
    );
    const normalizedRows = Array.isArray(pageRows) ? pageRows : [];
    rows.push(...normalizedRows);
    if (normalizedRows.length < perPage) break;
  }
  return rows;
}

function normalizeSku(value) {
  return String(value || '').trim();
}

function mapPublicacionRow(row) {
  return {
    id: row.id,
    storeId: row.store_id || '',
    tienda: row.tienda || '',
    articuloPrincipal: row.articulo_principal || '',
    nombre: row.nombre || '',
    descripcion: row.descripcion || '',
    marca: row.marca || '',
    categorias: row.categorias || '',
    categoriaLabel: row.categoria_label || '',
    tags: row.tags || '',
    productId: row.product_id || '',
    handle: row.handle || '',
    estado: row.estado || '',
    errorMensaje: row.error_mensaje || '',
    creadoPor: row.creado_por || null,
    creadoEn: row.creado_en || '',
    actualizadoEn: row.actualizado_en || '',
    sincronizadoEn: row.sincronizado_en || '',
    variantes: Number(row.variantes) || 0,
    variantesOk: Number(row.variantes_ok) || 0,
    variantesError: Number(row.variantes_error) || 0,
    variantesPendientes: Number(row.variantes_pendientes) || 0,
  };
}

function mapPublicacionVarianteRow(row) {
  return {
    id: row.id,
    publicacionId: row.publicacion_id,
    articulo: row.articulo || '',
    sku: row.sku || '',
    detalle: row.detalle || '',
    variantId: row.variant_id || '',
    productId: row.product_id || '',
    atributo1Nombre: row.atributo_1_nombre || '',
    atributo1Valor: row.atributo_1_valor || '',
    atributo2Nombre: row.atributo_2_nombre || '',
    atributo2Valor: row.atributo_2_valor || '',
    atributo3Nombre: row.atributo_3_nombre || '',
    atributo3Valor: row.atributo_3_valor || '',
    precio: row.precio == null ? null : Number(row.precio),
    precioPromocional: row.precio_promocional == null ? null : Number(row.precio_promocional),
    stock: row.stock == null ? null : Number(row.stock),
    peso: row.peso == null ? null : Number(row.peso),
    codigoBarras: row.codigo_barras || '',
    estado: row.estado || '',
    errorMensaje: row.error_mensaje || '',
    sincronizadoEn: row.sincronizado_en || '',
  };
}

function buildPublicacionImageUrl(archivoPath) {
  const fileName = path.basename(String(archivoPath || ''));
  return fileName ? `${TN_PUBLICACIONES_IMG_PUBLIC_PREFIX}/${encodeURIComponent(fileName)}` : '';
}

function mapPublicacionImagenRow(row) {
  return {
    id: row.id,
    publicacionId: row.publicacion_id,
    varianteId: row.variante_id || null,
    tipo: row.tipo || '',
    posicion: Number(row.posicion) || 1,
    archivoPath: row.archivo_path || '',
    archivoNombre: row.archivo_nombre || '',
    mimeType: row.mime_type || '',
    tamanioBytes: row.tamanio_bytes == null ? null : Number(row.tamanio_bytes),
    tnImageId: row.tn_image_id || '',
    estado: row.estado || '',
    errorMensaje: row.error_mensaje || '',
    url: buildPublicacionImageUrl(row.archivo_path),
  };
}

async function removeManagedTnPublicacionImage(archivoPath) {
  const fileName = path.basename(String(archivoPath || ''));
  if (!fileName) return;
  const target = path.resolve(TN_PUBLICACIONES_IMG_DIR, fileName);
  const root = path.resolve(TN_PUBLICACIONES_IMG_DIR);
  if (!target.startsWith(root + path.sep)) return;
  await fsp.unlink(target).catch((error) => {
    if (error?.code !== 'ENOENT') throw error;
  });
}

function getTnubeImageId(image) {
  if (Array.isArray(image)) return getTnubeImageId(image[0]);
  return image?.id || image?.image_id || null;
}

async function uploadPublicacionImageToTnube(conn, tnubeConnection, productId, imageRow, variantId = null) {
  if (!imageRow?.archivo_path) return null;
  const fileName = path.basename(String(imageRow.archivo_path));
  const filePath = path.resolve(TN_PUBLICACIONES_IMG_DIR, fileName);
  const root = path.resolve(TN_PUBLICACIONES_IMG_DIR);
  if (!filePath.startsWith(root + path.sep)) throw new Error('Ruta de imagen invalida');
  const buffer = await fsp.readFile(filePath);
  const payload = {
    filename: imageRow.archivo_nombre || fileName,
    attachment: buffer.toString('base64'),
  };
  if (!variantId) {
    payload.position = Number(imageRow.posicion) || 1;
  }
  const created = await tnubeRequest(
    tnubeConnection.storeId,
    tnubeConnection.accessToken,
    tnubeConnection.appName,
    'POST',
    `products/${encodeURIComponent(productId)}/images`,
    payload
  );
  const imageId = getTnubeImageId(created);
  if (!imageId) throw new Error('Tienda Nube no devolvio image_id');
  if (variantId) {
    await tnubeRequest(
      tnubeConnection.storeId,
      tnubeConnection.accessToken,
      tnubeConnection.appName,
      'PUT',
      `products/${encodeURIComponent(productId)}/variants/${encodeURIComponent(variantId)}`,
      { image_id: imageId }
    );
  }
  await conn.query(
    `UPDATE ${DB_NAME}.tiendanube_publicacion_imagenes
     SET tn_image_id = ?, estado = 'subida', archivo_path = NULL, error_mensaje = NULL
     WHERE id = ?`,
    [imageId, imageRow.id]
  );
  await removeManagedTnPublicacionImage(fileName);
  return imageId;
}

async function insertPublicacionEvento(conn, publicacionId, varianteId, tipo, estadoAnterior, estadoNuevo, mensaje, detalle, userId) {
  await conn.query(
    `INSERT INTO ${DB_NAME}.tiendanube_publicacion_eventos
       (publicacion_id, variante_id, tipo, estado_anterior, estado_nuevo, mensaje, detalle_json, creado_por)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      publicacionId,
      varianteId || null,
      tipo,
      estadoAnterior || null,
      estadoNuevo || null,
      mensaje || null,
      detalle ? JSON.stringify(detalle) : null,
      userId || null,
    ]
  );
}

function buildTnubeVariantPayload(variante) {
  const values = [];
  const cleanValue = String(variante.atributo_1_valor || '').trim();
  if (cleanValue) values.push(getTnubeLocalizedText(cleanValue));
  if (!values.length) values.push(getTnubeLocalizedText(variante.detalle || variante.articulo));

  const payload = {
    sku: normalizeSku(variante.sku || variante.articulo),
    price: variante.precio == null ? 0 : Number(variante.precio),
    stock_management: true,
    stock: variante.stock == null ? 0 : Number(variante.stock),
    values,
  };
  if (variante.precio_promocional != null) payload.promotional_price = Number(variante.precio_promocional);
  if (variante.peso != null) payload.weight = Number(variante.peso);
  if (variante.codigo_barras) payload.barcode = String(variante.codigo_barras);
  return payload;
}

function isTnubeWrongVariantValuesCountError(error) {
  const text = String(error?.message || error?.body || '');
  return /wrong number of elements/i.test(text);
}

function buildTnubeProductPayload(publicacion, variantes) {
  const attrName =
    variantes
      .map((variante) => String(variante.atributo_1_nombre || '').trim())
      .find((name) => name && name.toLowerCase() !== 'articulo') ||
    String(variantes[0]?.atributo_1_nombre || '').trim() ||
    'Color';

  const payload = {
    name: getTnubeLocalizedText(publicacion.nombre),
    description: getTnubeLocalizedText(formatTnubeDescriptionHtml(publicacion.descripcion || publicacion.nombre)),
    published: false,
    free_shipping: false,
    attributes: [getTnubeLocalizedText(attrName)],
    variants: variantes.map((variante) => buildTnubeVariantPayload(variante)),
  };
  if (publicacion.tags) payload.tags = String(publicacion.tags);
  if (publicacion.marca) payload.brand = String(publicacion.marca);
  const categoryIds = String(publicacion.categorias || '')
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item) && item > 0);
  if (categoryIds.length) payload.categories = categoryIds;
  return payload;
}

function buildTnubeProductUpdatePayload(publicacion) {
  const payload = {
    name: getTnubeLocalizedText(publicacion.nombre),
    description: getTnubeLocalizedText(formatTnubeDescriptionHtml(publicacion.descripcion || publicacion.nombre)),
  };
  if (publicacion.tags) payload.tags = String(publicacion.tags);
  if (publicacion.marca) payload.brand = String(publicacion.marca);
  const categoryIds = String(publicacion.categorias || '')
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item) && item > 0);
  if (categoryIds.length) payload.categories = categoryIds;
  return payload;
}

async function findTnubeProductBySku(connection, sku) {
  const cleanSku = normalizeSku(sku);
  if (!cleanSku) return null;
  try {
    return await tnubeRequest(
      connection.storeId,
      connection.accessToken,
      connection.appName,
      'GET',
      `products/sku/${encodeURIComponent(cleanSku)}`
    );
  } catch (error) {
    if (Number(error?.status) === 404) return null;
    throw error;
  }
}

async function fetchTnubeProduct(connection, productId) {
  try {
    return await tnubeRequest(
      connection.storeId,
      connection.accessToken,
      connection.appName,
      'GET',
      `products/${encodeURIComponent(productId)}`
    );
  } catch (error) {
    if (Number(error?.status) === 404) return null;
    throw error;
  }
}

function getTnubeCategoryName(category) {
  const name = category?.name || {};
  if (typeof name === 'string') return name;
  return name.es || name.pt || name.en || Object.values(name)[0] || '';
}

function mapTnubeCategories(categories) {
  const byId = new Map((categories || []).map((category) => [Number(category.id), category]));
  const buildPath = (category) => {
    const parts = [];
    let current = category;
    const seen = new Set();
    while (current && !seen.has(Number(current.id))) {
      seen.add(Number(current.id));
      const name = getTnubeCategoryName(current);
      if (name) parts.unshift(name);
      current = current.parent ? byId.get(Number(current.parent)) : null;
    }
    return parts.join(' > ') || String(category?.id || '');
  };
  return (categories || [])
    .map((category) => ({
      id: Number(category.id) || 0,
      name: getTnubeCategoryName(category),
      label: buildPath(category),
      parent: category.parent || null,
      visibility: category.visibility || '',
    }))
    .filter((category) => category.id)
    .sort((a, b) => String(a.label).localeCompare(String(b.label)));
}

async function fetchTnubeCategories(connection) {
  const rows = [];
  const perPage = 200;
  for (let page = 1; page <= 50; page += 1) {
    const response = await tnubeJsonRequest(
      connection.storeId,
      connection.accessToken,
      connection.appName,
      'GET',
      `categories${buildTnubeQuery({ fields: 'id,name,parent,visibility', per_page: perPage, page })}`
    );
    const pageRows = Array.isArray(response.body) ? response.body : [];
    rows.push(...pageRows);
    if (pageRows.length < perPage) break;
  }
  return mapTnubeCategories(rows);
}

function parseCookies(req) {
  const cookieHeader = req.headers.cookie || '';
  return cookieHeader.split(';').reduce((acc, item) => {
    const [key, ...rest] = item.trim().split('=');
    if (!key) return acc;
    acc[key] = decodeURIComponent(rest.join('='));
    return acc;
  }, {});
}

function signToken(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verifyToken(token) {
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');
  if (expected !== sig) return null;
  try {
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch (err) {
    return null;
  }
}

function requireAuth(req, res, next) {
  const cookies = parseCookies(req);
  const token = cookies.auth_token;
  const payload = token && verifyToken(token);
  if (!payload) {
    return res.status(401).json({ message: 'No autorizado' });
  }
  req.user = payload;
  next();
}

function requireAuthKeepAlive(req, res, next) {
  const cookies = parseCookies(req);
  const token = cookies.auth_token;
  const payload = token && verifyToken(token);
  if (!payload) {
    return res.status(401).json({ message: 'No autorizado' });
  }
  req.user = payload;
  setAuthCookie(res, signToken({ ...payload, iat: Date.now() }), req);
  next();
}

function shouldUseSecureCookie(req) {
  if (COOKIE_SECURE_MODE === 'false') return false;
  if (COOKIE_SECURE_MODE === 'true') return true;
  const forwarded = req?.headers?.['x-forwarded-proto'];
  if (typeof forwarded === 'string' && forwarded.split(',')[0].trim() === 'https') return true;
  return !!req?.secure;
}

function setAuthCookie(res, token, req) {
  const samesiteSafe = (() => {
    const val = COOKIE_SAMESITE.toLowerCase();
    if (val === 'none') return 'None';
    if (val === 'strict') return 'Strict';
    return 'Lax';
  })();
  const parts = [
    'auth_token=' + encodeURIComponent(token),
    'HttpOnly',
    'Path=/',
    `SameSite=${samesiteSafe}`,
    'Max-Age=604800',
  ];
  if (shouldUseSecureCookie(req)) {
    parts.push('Secure');
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearAuthCookie(res) {
  res.setHeader('Set-Cookie', 'auth_token=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax');
}

const pool = mysql.createPool({
  host: DB_HOST,
  port: DB_PORT,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  waitForConnections: true,
  connectionLimit: DB_CONNECTION_LIMIT,
  connectTimeout: DB_CONNECT_TIMEOUT_MS,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  timezone: 'Z',
});

let userRoleColumn = null;
let userRoleChecked = false;
let cachedFichajeUserColumns = { codigo: null, foto: null };
let fichajeUserColumnsChecked = false;
const FICHAJE_IDEMPOTENCY_WINDOW_MS = 60 * 1000;

async function getTableColumnSet(dbClient, tableName, columnNames) {
  if (!Array.isArray(columnNames) || columnNames.length === 0) return new Set();
  const [rows] = await dbClient.query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME IN (${columnNames.map(() => '?').join(',')})`,
    [tableName, ...columnNames]
  );
  return new Set((rows || []).map((row) => row.COLUMN_NAME));
}

async function getUserRoleColumn() {
  if (userRoleChecked) return userRoleColumn;
  userRoleChecked = true;
  try {
    const [rows] = await pool.query(
      `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'users'
         AND COLUMN_NAME IN ('role', 'rol')
       ORDER BY FIELD(COLUMN_NAME, 'role', 'rol')
       LIMIT 1`
    );
    userRoleColumn = rows?.[0]?.COLUMN_NAME || null;
  } catch (_err) {
    userRoleColumn = null;
  }
  return userRoleColumn;
}

async function getUserRoleNameById(userId) {
  if (!userId) return '';
  try {
    const [rows] = await safeQuery(
      `SELECT r.tipo_role AS roleName
       FROM RolesWeb r
       INNER JOIN users u ON u.id_roles = r.id_roles
       WHERE u.id = ?
       LIMIT 1`,
      [userId]
    );
    return rows?.[0]?.roleName || '';
  } catch (_err) {
    return '';
  }
}

const ROLE_PERMISSIONS = [
  'dashboard',
  'dashboard-encuestas',
  'dashboard-empaquetados',
  'dashboard-pedidos-dia',
  'dashboard-pedidos-vendedora',
  'dashboard-ventas-vendedora',
  'dashboard-pedidos-clientes',
  'dashboard-comparativo',
  'panel-control',
  'cargar-ticket',
  'empleados',
  'clientes-menu',
  'clientes',
  'clientes-reportes',
  'ia',
  'salon',
  'fidelizacion-menu',
  'fidelizacion-panel',
  'fidelizacion-mis',
  'fidelizacion-admin',
  'fidelizacion-dashboard',
  'pedidos',
  'pedidos-menu',
  'pedidos-todos',
  'pedidos-nuevo',
  'facturas',
  'comisiones',
  'mercaderia',
  'mercaderia-articulos-proveedor',
  'mercaderia-fotos',
  'abm',
  'control-ordenes',
  'ecommerce',
  'ecommerce-imagenweb',
  'ecommerce-panel',
  'ecommerce-publicaciones',
  'ecommerce-ordenes-tn',
  'ecommerce-asignacion-pedidos',
  'cajas',
  'cajas-cierre',
  'cajas-nueva-factura',
  'apis',
  'configuracion',
];

const DASHBOARD_REPORT_PERMISSIONS = [
  'dashboard-encuestas',
  'dashboard-empaquetados',
  'dashboard-pedidos-dia',
  'dashboard-pedidos-vendedora',
  'dashboard-ventas-vendedora',
  'dashboard-pedidos-clientes',
  'dashboard-comparativo',
];

const ECOMMERCE_SUB_PERMISSIONS = [
  'ecommerce-imagenweb',
  'ecommerce-panel',
  'ecommerce-publicaciones',
  'ecommerce-ordenes-tn',
  'ecommerce-asignacion-pedidos',
];

function normalizeDashboardPermissions(permissions = {}, hasDashboardSubPerms = true) {
  if (hasDashboardSubPerms || permissions.dashboard !== true) return permissions;
  DASHBOARD_REPORT_PERMISSIONS.forEach((permission) => {
    permissions[permission] = true;
  });
  return permissions;
}

function normalizeEcommercePermissions(permissions = {}, hasEcommerceSubPerms = true) {
  if (hasEcommerceSubPerms || permissions.ecommerce !== true) return permissions;
  ECOMMERCE_SUB_PERMISSIONS.forEach((permission) => {
    permissions[permission] = true;
  });
  return permissions;
}

async function getPermissionsForUser(userId) {
  if (!userId) return {};
  const [rows] = await pool.query(
    `SELECT rp.permiso, rp.habilitado
     FROM RolesPermisos rp
     INNER JOIN users u ON u.id_roles = rp.id_roles
     WHERE u.id = ?`,
    [userId]
  );
  const permissions = (rows || []).reduce((acc, row) => {
    acc[row.permiso] = !!row.habilitado;
    return acc;
  }, {});
  const hasDashboardSubPerms = DASHBOARD_REPORT_PERMISSIONS.some((permission) =>
    Object.prototype.hasOwnProperty.call(permissions, permission)
  );
  const hasEcommerceSubPerms = ECOMMERCE_SUB_PERMISSIONS.some((permission) =>
    Object.prototype.hasOwnProperty.call(permissions, permission)
  );
  normalizeDashboardPermissions(permissions, hasDashboardSubPerms);
  normalizeEcommercePermissions(permissions, hasEcommerceSubPerms);
  return permissions;
}

function requirePermission(permission) {
  return async (req, res, next) => {
    try {
      const permissions = await getPermissionsForUser(req.user?.id);
      if (permissions[permission] === true) return next();
      return res.status(403).json({ message: 'No tenes permisos para ver este reporte' });
    } catch (error) {
      return res.status(500).json({ message: 'Error al validar permisos', error: error.message });
    }
  };
}

const FIDELIZACION_DEFAULT_CONFIG = {
  cooldown_days: 30,
  conversion_window_days: 14,
  max_clients_per_run: 200,
  w_month_match: 30,
  w_frequency_12m: 20,
  w_recency_30_90: 20,
  w_monetary_12m: 10,
  ticket_penalty_threshold: 100000,
  ticket_penalty_points: 10,
};
const FIDELIZACION_EXCLUDED_SELLER_NAMES = new Set(['pagina', 'pagina web']);

function normalizeFidelizacionSellerName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function isFidelizacionExcludedSellerName(value) {
  return FIDELIZACION_EXCLUDED_SELLER_NAMES.has(normalizeFidelizacionSellerName(value));
}

function toSafeInt(value, fallback, min = 0, max = Number.MAX_SAFE_INTEGER) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  const intVal = Math.trunc(num);
  return Math.min(max, Math.max(min, intVal));
}

function round2(value) {
  const num = Number(value) || 0;
  return Number(num.toFixed(2));
}

function toSafeDecimal(value, fallback, min = 0, max = Number.MAX_SAFE_INTEGER) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  const clamped = Math.min(max, Math.max(min, num));
  return round2(clamped);
}

function parseMaybeJson(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (_err) {
    return null;
  }
}

async function getFichajeUserColumns() {
  if (fichajeUserColumnsChecked) return cachedFichajeUserColumns;
  fichajeUserColumnsChecked = true;
  try {
    const [rows] = await pool.query(
      `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'users'
         AND COLUMN_NAME IN ('codigo', 'foto')
       ORDER BY FIELD(COLUMN_NAME, 'codigo', 'foto')`
    );
    const names = new Set((rows || []).map((row) => String(row.COLUMN_NAME || '').trim()));
    cachedFichajeUserColumns = {
      codigo: names.has('codigo') ? 'codigo' : null,
      foto: names.has('foto') ? 'foto' : null,
    };
  } catch (_err) {
    cachedFichajeUserColumns = { codigo: null, foto: null };
  }
  return cachedFichajeUserColumns;
}

function buildDayBounds(baseDate = new Date()) {
  const start = new Date(
    baseDate.getFullYear(),
    baseDate.getMonth(),
    baseDate.getDate(),
    0,
    0,
    0,
    0
  );
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return {
    start,
    end,
    startSql: formatDateTimeLocal(start),
    endSql: formatDateTimeLocal(end),
  };
}

function resolvePublicAssetUrl(rawValue) {
  const raw = String(rawValue || '').trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;

  const normalized = raw.replace(/^\/+/, '').replace(/\\/g, '/');
  const candidates = [];
  if (normalized) {
    candidates.push(normalized);
    candidates.push(`imagenes/${normalized}`);
    candidates.push(`refresh/${normalized}`);
  }

  for (const candidate of candidates) {
    const absolutePath = path.join(__dirname, 'public', candidate);
    if (fs.existsSync(absolutePath)) {
      return `/${candidate.replace(/\\/g, '/')}`;
    }
  }
  return null;
}

function normalizeEmployeePhotoValue(rawValue) {
  const raw = String(rawValue || '').trim().replace(/\\/g, '/');
  if (!raw) return '';
  if (raw.startsWith(`${EMP_PHOTO_PUBLIC_PREFIX}/`)) {
    return path.posix.basename(raw);
  }
  if (raw.startsWith('/')) {
    return path.posix.basename(raw);
  }
  return path.posix.basename(raw);
}

function buildEmployeePhotoUrl(rawValue) {
  const normalized = normalizeEmployeePhotoValue(rawValue);
  if (!normalized) return null;
  const diskPath = path.join(EMP_PHOTO_STORAGE_DIR, normalized);
  if (!fs.existsSync(diskPath)) return null;
  return `${EMP_PHOTO_PUBLIC_PREFIX}/${encodeURIComponent(normalized)}`;
}

function getEmployeePhotoDiskPath(rawValue) {
  const normalized = normalizeEmployeePhotoValue(rawValue);
  if (!normalized) return null;
  return path.join(EMP_PHOTO_STORAGE_DIR, normalized);
}

function ensureSafeUploadFileName(fileName, fallbackExt = '.jpg') {
  const safeBase = String(fileName || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  const ext = path.extname(safeBase || '').toLowerCase() || fallbackExt;
  return { baseName: path.basename(safeBase || 'archivo', ext), ext };
}

function inferImageExtension(contentType, originalName) {
  const byType = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
  };
  const normalizedType = String(contentType || '').trim().toLowerCase();
  if (byType[normalizedType]) return byType[normalizedType];
  const ext = path.extname(String(originalName || '')).toLowerCase();
  if (['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext)) {
    return ext === '.jpeg' ? '.jpg' : ext;
  }
  return '.jpg';
}

async function parseSingleMultipartFile(req, fieldName, maxBytes = EMP_PHOTO_MAX_BYTES) {
  const contentType = String(req.headers['content-type'] || '');
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!boundaryMatch) {
    const error = new Error('Boundary multipart faltante');
    error.code = 'UPLOAD_BOUNDARY_MISSING';
    throw error;
  }

  const boundary = `--${boundaryMatch[1] || boundaryMatch[2]}`;
  const chunks = [];
  let totalBytes = 0;
  for await (const chunk of req) {
    totalBytes += chunk.length;
    if (totalBytes > maxBytes + 1024 * 1024) {
      const error = new Error('Archivo demasiado grande');
      error.code = 'UPLOAD_TOO_LARGE';
      throw error;
    }
    chunks.push(chunk);
  }

  const bodyBuffer = Buffer.concat(chunks);
  const bodyText = bodyBuffer.toString('latin1');
  const parts = bodyText.split(boundary).slice(1, -1);

  for (const part of parts) {
    const cleaned = part.startsWith('\r\n') ? part.slice(2) : part;
    const headerEnd = cleaned.indexOf('\r\n\r\n');
    if (headerEnd === -1) continue;
    const headerText = cleaned.slice(0, headerEnd);
    const nameMatch = headerText.match(/name="([^"]+)"/i);
    if (!nameMatch || nameMatch[1] !== fieldName) continue;
    const fileNameMatch = headerText.match(/filename="([^"]*)"/i);
    const typeMatch = headerText.match(/Content-Type:\s*([^\r\n]+)/i);
    let contentText = cleaned.slice(headerEnd + 4);
    if (contentText.endsWith('\r\n')) {
      contentText = contentText.slice(0, -2);
    }
    const fileBuffer = Buffer.from(contentText, 'latin1');
    return {
      fileName: fileNameMatch?.[1] || '',
      contentType: typeMatch?.[1] || 'application/octet-stream',
      buffer: fileBuffer,
    };
  }

  const error = new Error('Archivo no enviado');
  error.code = 'UPLOAD_FILE_MISSING';
  throw error;
}

async function removeManagedEmployeePhoto(rawValue) {
  const diskPath = getEmployeePhotoDiskPath(rawValue);
  if (!diskPath) return;
  try {
    await fsp.unlink(diskPath);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

function serializeFichajeRow(row) {
  if (!row) return null;
  return {
    id_fichaje: Number(row.id_fichaje) || null,
    fecha_ingreso: row.fecha_ingreso || null,
    fecha_egreso: row.fecha_egreso || null,
  };
}

function buildFichajeApiResponse({ ok, status, message, empleado = null, fichaje = null }) {
  return {
    ok: !!ok,
    status: status || 'unknown',
    message: message || '',
    empleado: empleado
      ? {
          id: Number(empleado.id) || null,
          name: empleado.name || '',
          fotoUrl: empleado.fotoUrl || null,
        }
      : null,
    fichaje: serializeFichajeRow(fichaje),
  };
}

async function findEmployeeByCode(codigo, conn = pool) {
  const normalizedCode = String(codigo || '').trim();
  if (!normalizedCode) return null;

  const columns = await getFichajeUserColumns();
  if (!columns.codigo) {
    const error = new Error('La columna users.codigo no está disponible');
    error.code = 'FICHAJE_CODIGO_COLUMN_MISSING';
    throw error;
  }

  const fotoSelect = columns.foto ? `, ${columns.foto} AS foto` : ', NULL AS foto';
  const [rows] = await conn.query(
    `SELECT id, name${fotoSelect}
     FROM users
     WHERE ${columns.codigo} = ?
     LIMIT 1`,
    [normalizedCode]
  );
  const row = rows?.[0];
  if (!row) return null;

  return {
    id: Number(row.id) || null,
    name: row.name || '',
    fotoUrl: buildEmployeePhotoUrl(row.foto) || resolvePublicAssetUrl(row.foto),
  };
}

async function findOpenFichajeForToday(userId, conn, dayBounds, lock = false) {
  const forUpdate = lock ? ' FOR UPDATE' : '';
  const [rows] = await conn.query(
    `SELECT id_fichaje, fecha_ingreso, fecha_egreso
     FROM fichaje
     WHERE id_user = ?
       AND fecha_ingreso >= ?
       AND fecha_ingreso < ?
       AND fecha_egreso IS NULL
     ORDER BY fecha_ingreso DESC
     LIMIT 1${forUpdate}`,
    [userId, dayBounds.startSql, dayBounds.endSql]
  );
  return rows?.[0] || null;
}

async function findRecentFichajeAction(userId, action, conn, baseDate = new Date(), lock = false) {
  const actionColumn = action === 'egreso' ? 'fecha_egreso' : 'fecha_ingreso';
  const threshold = formatDateTimeLocal(new Date(baseDate.getTime() - FICHAJE_IDEMPOTENCY_WINDOW_MS));
  const forUpdate = lock ? ' FOR UPDATE' : '';
  const [rows] = await conn.query(
    `SELECT id_fichaje, fecha_ingreso, fecha_egreso
     FROM fichaje
     WHERE id_user = ?
       AND ${actionColumn} IS NOT NULL
       AND ${actionColumn} >= ?
     ORDER BY ${actionColumn} DESC
     LIMIT 1${forUpdate}`,
    [userId, threshold]
  );
  return rows?.[0] || null;
}

function extractJsonObjectFromText(raw) {
  const text = String(raw || '').trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (_err) {}
  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch && fencedMatch[1]) {
    try {
      return JSON.parse(fencedMatch[1].trim());
    } catch (_err) {}
  }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch (_err) {}
  }
  return null;
}

function buildFidelizacionParamsJson(config) {
  return {
    cooldown_days: toSafeInt(config.cooldown_days, FIDELIZACION_DEFAULT_CONFIG.cooldown_days, 1, 365),
    lookback_months: 12,
    conversion_window_days: toSafeInt(
      config.conversion_window_days,
      FIDELIZACION_DEFAULT_CONFIG.conversion_window_days,
      1,
      365
    ),
    min_score_to_show: 0,
    max_clients_per_run: toSafeInt(
      config.max_clients_per_run,
      FIDELIZACION_DEFAULT_CONFIG.max_clients_per_run,
      1,
      5000
    ),
    weights: {
      month_match: toSafeInt(config.w_month_match, FIDELIZACION_DEFAULT_CONFIG.w_month_match, 0, 1000),
      frequency_12m: toSafeInt(config.w_frequency_12m, FIDELIZACION_DEFAULT_CONFIG.w_frequency_12m, 0, 1000),
      recency_30_90: toSafeInt(config.w_recency_30_90, FIDELIZACION_DEFAULT_CONFIG.w_recency_30_90, 0, 1000),
      monetary_12m: toSafeInt(config.w_monetary_12m, FIDELIZACION_DEFAULT_CONFIG.w_monetary_12m, 0, 1000),
    },
    ticket_penalty: {
      threshold: toSafeDecimal(
        config.ticket_penalty_threshold,
        FIDELIZACION_DEFAULT_CONFIG.ticket_penalty_threshold,
        0,
        999999999
      ),
      points: toSafeInt(config.ticket_penalty_points, FIDELIZACION_DEFAULT_CONFIG.ticket_penalty_points, 0, 1000),
    },
  };
}

function normalizeFidelizacionConfig(row = {}) {
  return {
    id: row.id ? Number(row.id) : null,
    is_active: Number(row.is_active) === 1 ? 1 : 0,
    cooldown_days: toSafeInt(row.cooldown_days, FIDELIZACION_DEFAULT_CONFIG.cooldown_days, 1, 365),
    conversion_window_days: toSafeInt(
      row.conversion_window_days,
      FIDELIZACION_DEFAULT_CONFIG.conversion_window_days,
      1,
      365
    ),
    max_clients_per_run: toSafeInt(
      row.max_clients_per_run,
      FIDELIZACION_DEFAULT_CONFIG.max_clients_per_run,
      1,
      5000
    ),
    w_month_match: toSafeInt(row.w_month_match, FIDELIZACION_DEFAULT_CONFIG.w_month_match, 0, 1000),
    w_frequency_12m: toSafeInt(
      row.w_frequency_12m,
      FIDELIZACION_DEFAULT_CONFIG.w_frequency_12m,
      0,
      1000
    ),
    w_recency_30_90: toSafeInt(
      row.w_recency_30_90,
      FIDELIZACION_DEFAULT_CONFIG.w_recency_30_90,
      0,
      1000
    ),
    w_monetary_12m: toSafeInt(
      row.w_monetary_12m,
      FIDELIZACION_DEFAULT_CONFIG.w_monetary_12m,
      0,
      1000
    ),
    ticket_penalty_threshold: toSafeDecimal(
      row.ticket_penalty_threshold,
      FIDELIZACION_DEFAULT_CONFIG.ticket_penalty_threshold,
      0,
      999999999
    ),
    ticket_penalty_points: toSafeInt(
      row.ticket_penalty_points,
      FIDELIZACION_DEFAULT_CONFIG.ticket_penalty_points,
      0,
      1000
    ),
    updated_by: row.updated_by || '',
    updated_at: row.updated_at || null,
  };
}

async function getFidelizacionActiveConfig(conn) {
  const [[row]] = await conn.query(
    `SELECT id, is_active, cooldown_days, conversion_window_days, max_clients_per_run,
            w_month_match, w_frequency_12m, w_recency_30_90, w_monetary_12m,
            ticket_penalty_threshold, ticket_penalty_points, updated_by, updated_at
     FROM fidelizacion_config
     WHERE is_active = 1
     ORDER BY id DESC
     LIMIT 1`
  );
  if (!row) return normalizeFidelizacionConfig({ ...FIDELIZACION_DEFAULT_CONFIG, is_active: 1 });
  return normalizeFidelizacionConfig(row);
}

async function getFidelizacionRunDetail(conn, runId) {
  const [[summary]] = await conn.query(
    `SELECT
       COUNT(*) AS total,
       ROUND(AVG(score), 2) AS promedio_score,
       MAX(score) AS max_score,
       MIN(score) AS min_score
     FROM fidelizacion_recomendacion
     LEFT JOIN vendedores v ON v.Id = fidelizacion_recomendacion.vendedora_id
     WHERE run_id = ?
       AND (fidelizacion_recomendacion.vendedora_id IS NULL OR LOWER(TRIM(COALESCE(v.Nombre, ''))) NOT IN ('pagina', 'pagina web'))`,
    [runId]
  );

  const [rows] = await conn.query(
    `SELECT
       r.id,
       r.run_id,
       r.cliente_id,
       CONCAT(COALESCE(c.nombre, ''), ' ', COALESCE(c.apellido, '')) AS cliente,
       r.score,
       r.razones,
       r.vendedora_id,
       v.nombre AS vendedora_nombre,
       r.tag_top_1,
       r.tag_top_2,
       r.tag_top_3,
       r.attr_top_1,
       r.attr_top_2,
       r.attr_top_3,
       r.oferta_tipo,
       r.oferta_detalle,
       r.last_purchase_date,
       r.recency_days,
       r.frequency_12m,
       r.monetary_12m,
       r.avg_ticket_12m
     FROM fidelizacion_recomendacion r
     LEFT JOIN clientes c ON c.id_clientes = r.cliente_id
     LEFT JOIN vendedores v ON v.id = r.vendedora_id
     WHERE r.run_id = ?
       AND (r.vendedora_id IS NULL OR LOWER(TRIM(COALESCE(v.Nombre, ''))) NOT IN ('pagina', 'pagina web'))
     ORDER BY r.score DESC, r.id ASC
     LIMIT 400`,
    [runId]
  );

  return {
    resumen: {
      total: Number(summary?.total) || 0,
      promedio_score: Number(summary?.promedio_score) || 0,
      max_score: Number(summary?.max_score) || 0,
      min_score: Number(summary?.min_score) || 0,
    },
    recomendaciones: (rows || []).map((row) => ({
      id: row.id,
      run_id: row.run_id,
      cliente_id: row.cliente_id,
      cliente: String(row.cliente || '').trim(),
      score: Number(row.score) || 0,
      razones: row.razones || '',
      vendedora_id: row.vendedora_id ? Number(row.vendedora_id) : null,
      vendedora_nombre: row.vendedora_nombre || '',
      tag_top_1: row.tag_top_1 || '',
      tag_top_2: row.tag_top_2 || '',
      tag_top_3: row.tag_top_3 || '',
      attr_top_1: row.attr_top_1 || '',
      attr_top_2: row.attr_top_2 || '',
      attr_top_3: row.attr_top_3 || '',
      oferta_tipo: row.oferta_tipo || '',
      oferta_detalle: row.oferta_detalle || '',
      last_purchase_date: row.last_purchase_date || null,
      recency_days: Number(row.recency_days) || 0,
      frequency_12m: Number(row.frequency_12m) || 0,
      monetary_12m: Number(row.monetary_12m) || 0,
      avg_ticket_12m: Number(row.avg_ticket_12m) || 0,
    })),
  };
}

async function resolveFidelizacionUserSeller(conn, userName, preferredSellerId) {
  const preferredId = Number(preferredSellerId) || null;
  if (preferredId) {
    const [[sellerById]] = await conn.query(
      `SELECT Id, Nombre
       FROM vendedores
       WHERE Id = ?
       LIMIT 1`,
      [preferredId]
    );
    if (sellerById && !isFidelizacionExcludedSellerName(sellerById.Nombre)) {
      return {
        id: Number(sellerById.Id),
        nombre: sellerById.Nombre || '',
      };
    }
  }

  const safeName = String(userName || '').trim();
  if (!safeName) return { id: null, nombre: '' };

  const [[sellerByName]] = await conn.query(
    `SELECT Id, Nombre
     FROM vendedores
     WHERE LOWER(TRIM(Nombre)) = LOWER(TRIM(?))
     LIMIT 1`,
    [safeName]
  );
  if (sellerByName && !isFidelizacionExcludedSellerName(sellerByName.Nombre)) {
    return {
      id: Number(sellerByName.Id),
      nombre: sellerByName.Nombre || '',
    };
  }

  const [[activeByName]] = await conn.query(
    `SELECT vendedora_id AS Id, Nombre
     FROM vw_vendedores_activos
     WHERE vendedora_id IS NOT NULL
       AND LOWER(TRIM(Nombre)) = LOWER(TRIM(?))
     LIMIT 1`,
    [safeName]
  );
  if (activeByName && !isFidelizacionExcludedSellerName(activeByName.Nombre)) {
    return {
      id: Number(activeByName.Id),
      nombre: activeByName.Nombre || '',
    };
  }

  return { id: null, nombre: '' };
}

async function getFidelizacionUserContext(conn, userId) {
  if (!userId) return null;
  const [[row]] = await conn.query(
    `SELECT
       u.id,
       u.name,
       u.id_roles,
       u.id_vendedoras,
       COALESCE(r.tipo_role, '') AS role_name,
       COALESCE(v.Nombre, '') AS vendedora_nombre
     FROM users u
     LEFT JOIN RolesWeb r ON r.id_roles = u.id_roles
     LEFT JOIN vendedores v ON v.Id = u.id_vendedoras
     WHERE u.id = ?
     LIMIT 1`,
    [userId]
  );
  if (!row) return null;
  const roleName = String(row.role_name || '').toLowerCase();
  const isAdmin = Number(row.id_roles) === 1 || roleName.includes('admin');
  const seller = await resolveFidelizacionUserSeller(conn, row.name, row.id_vendedoras);
  return {
    userId: Number(row.id),
    userName: row.name || '',
    roleId: Number(row.id_roles) || 0,
    roleName: row.role_name || '',
    isAdmin,
    vendedoraId: seller.id,
    vendedoraNombre: seller.nombre || '',
  };
}

async function getFidelizacionLatestRun(conn) {
  const [[runRow]] = await conn.query(
    `SELECT id, run_date, created_at, params_json, config_id
     FROM fidelizacion_run
     ORDER BY id DESC
     LIMIT 1`
  );
  if (!runRow) return null;
  return {
    id: Number(runRow.id),
    run_date: runRow.run_date,
    created_at: runRow.created_at,
    config_id: runRow.config_id ? Number(runRow.config_id) : null,
    params_json: parseMaybeJson(runRow.params_json),
  };
}

async function insertFidelizacionTransferLog(conn, payload = {}) {
  await conn.query(
    `INSERT INTO fidelizacion_transferencia
     (recomendacion_id, run_id, cliente_id, action, from_vendedora_id, to_vendedora_id, motivo, actor_user_id, actor_nombre)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      Number(payload.recomendacion_id) || 0,
      Number(payload.run_id) || 0,
      Number(payload.cliente_id) || 0,
      String(payload.action || '').trim().toUpperCase(),
      payload.from_vendedora_id ? Number(payload.from_vendedora_id) : null,
      payload.to_vendedora_id ? Number(payload.to_vendedora_id) : null,
      String(payload.motivo || '').trim() || null,
      payload.actor_user_id ? Number(payload.actor_user_id) : null,
      String(payload.actor_nombre || '').trim() || null,
    ]
  );
}

async function safeQuery(sql, params = []) {
  try {
    return await pool.query(sql, params);
  } catch (err) {
    const transientCodes = ['ECONNRESET', 'ETIMEDOUT', 'PROTOCOL_CONNECTION_LOST', 'ER_SERVER_SHUTDOWN', 'PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR'];
    if (err && transientCodes.includes(err.code)) {
      console.warn('[db] reconnect on', err.code);
      // Intento rápido de reintentar una vez
      return pool.query(sql, params);
    }
    throw err;
  }
}

const SCHEMA_CACHE_TTL_MS = 10 * 60 * 1000;
let cachedSchema = { text: '', fetchedAt: 0 };
const PROJECT_SCHEMA_PATH = path.join(__dirname, 'Proyecto.txt');
const CUSTOM_SCHEMA_PATH = path.join(__dirname, 'consultasBaseDatos.txt');
let cachedFileSchema = { text: '', loaded: false };
let cachedCustomSchema = { text: '', mtimeMs: 0, tables: new Map(), columns: new Set() };

function getLocalSchemaSummary() {
  if (cachedFileSchema.loaded && cachedFileSchema.text) return cachedFileSchema.text;
  try {
    const raw = fs.readFileSync(PROJECT_SCHEMA_PATH, 'utf8');
    const lines = raw.split(/\r?\n/);
    const startIdx = lines.findIndex((line) => line.toLowerCase().includes('extructura de la base de datos'));
    if (startIdx === -1) return '';
    const slice = lines.slice(startIdx + 1, startIdx + 401); // tomar hasta 400 l¡neas para evitar exceso
    const text = slice.join('\n').trim();
    cachedFileSchema = { text, loaded: true };
    return text;
  } catch (_err) {
    return '';
  }
}

function parseColumns(raw) {
  return raw
    .split(',')
    .map((c) => {
      const cleaned = c.trim();
      const firstToken = cleaned.split(/\s+/)[0]; // tomar solo el nombre, descartar tipos
      const sanitized = firstToken.replace(/[^A-Za-z0-9_]/g, '');
      return sanitized || '';
    })
    .filter(Boolean);
}

function getCustomSchemaSummary() {
  try {
    const stats = fs.statSync(CUSTOM_SCHEMA_PATH);
    if (!stats.isFile()) return { text: '', tables: new Map(), columns: new Set() };

    const raw = fs.readFileSync(CUSTOM_SCHEMA_PATH, 'utf8').trim();
    const lines = raw.split(/\r?\n/);
    const tables = new Map();
    const allColumns = new Set();
    let currentTable = null;

    lines.forEach((line) => {
      const tableMatch = line.match(/^\s*\d+\.\s*([a-zA-Z0-9_]+)/);
      if (tableMatch) {
        currentTable = tableMatch[1].toLowerCase();
        tables.set(currentTable, new Set());
        return;
      }
      const camposLine = line.match(/^\s*Campos:\s*\((.*)\)\s*$/i);
      if (camposLine && currentTable) {
        const content = camposLine[1];
        const cols = parseColumns(content);
        const tableSet = tables.get(currentTable);
        cols.forEach((col) => {
          const key = col.toLowerCase();
          tableSet.add(key);
          allColumns.add(key);
        });
      }
    });

    cachedCustomSchema = { text: raw, mtimeMs: stats.mtimeMs, tables, columns: allColumns };
    return cachedCustomSchema;
  } catch (_err) {
    return { text: '', tables: new Map(), columns: new Set() };
  }
}

async function getSchemaSummary() {
  const now = Date.now();
  if (cachedSchema.text && now - cachedSchema.fetchedAt < SCHEMA_CACHE_TTL_MS) {
    return cachedSchema.text;
  }
  const [rows] = await pool.query(
    `SELECT TABLE_NAME AS tableName, COLUMN_NAME AS columnName, DATA_TYPE AS dataType
     FROM information_schema.columns
     WHERE table_schema = ?
     ORDER BY TABLE_NAME, ORDINAL_POSITION
     LIMIT 800`,
    [DB_NAME]
  );

  const grouped = rows.reduce((acc, row) => {
    if (!acc[row.tableName]) {
      acc[row.tableName] = [];
    }
    acc[row.tableName].push(`${row.columnName} (${row.dataType})`);
    return acc;
  }, {});

  const summary = Object.entries(grouped)
    .map(([table, cols]) => `${table}: ${cols.join(', ')}`)
    .join('\n');

  cachedSchema = { text: summary, fetchedAt: now };
  return summary;
}

function isSafeSelect(sql) {
  if (typeof sql !== 'string') return false;
  const cleaned = sql.trim().replace(/;+\s*$/, '');
  const upper = cleaned.toUpperCase();
  const forbidden = ['INSERT ', 'UPDATE ', 'DELETE ', 'DROP ', 'ALTER ', 'TRUNCATE ', 'REPLACE ', 'GRANT ', 'REVOKE '];
  if (!/^SELECT|^WITH/.test(upper)) return false;
  if (forbidden.some((kw) => upper.includes(kw))) return false;
  if (cleaned.split(';').filter((p) => p.trim()).length > 1) return false;
  return true;
}

async function withRetry(fn, { retries = 2, baseDelayMs = 500 } = {}) {
  let lastErr;
  for (let i = 0; i <= retries; i += 1) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const code = err?.code;
      const msg = String(err?.message || '');
      const retriable =
        code === 'ETIMEDOUT' ||
        code === 'ECONNRESET' ||
        code === 'EAI_AGAIN' ||
        msg.includes('timed out') ||
        msg.includes('429') ||
        msg.includes('5');
      if (!retriable || i === retries) throw err;
      await new Promise((resolve) => setTimeout(resolve, baseDelayMs * (i + 1)));
    }
  }
  throw lastErr;
}

function clampLimit(sql, maxRows = 50) {
  let cleaned = sql.trim().replace(/;+\s*$/, '');
  const limitMatch = cleaned.match(/\blimit\s+(\d+)(\s*,\s*\d+)?/i);
  if (limitMatch) {
    const first = Number(limitMatch[1]);
    if (Number.isFinite(first) && first > maxRows) {
      cleaned = cleaned.replace(/\blimit\s+(\d+)(\s*,\s*\d+)?/i, `LIMIT ${maxRows}`);
    }
    return cleaned;
  }
  return `${cleaned} LIMIT ${maxRows}`;
}

function slugifyApiEndpoint(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);
}

function normalizeApiEndpointPath(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const pathOnly = raw.split('?')[0].split('#')[0].trim();
  if (!pathOnly) return '';
  const prefixed = pathOnly.startsWith('/') ? pathOnly : `/${pathOnly}`;
  return prefixed.replace(/\/{2,}/g, '/');
}

async function buildUniqueApiEndpoint(nombreApi, excludeId = 0) {
  const baseSlug = slugifyApiEndpoint(nombreApi) || `endpoint-${Date.now()}`;
  const basePath = `/api/public/${baseSlug}`;
  let endpoint = basePath;
  let counter = 2;
  while (counter < 1000) {
    const params = [endpoint];
    let sql = `SELECT id FROM api_endpoints WHERE endpoint = ? LIMIT 1`;
    if (Number(excludeId) > 0) {
      sql = `SELECT id FROM api_endpoints WHERE endpoint = ? AND id <> ? LIMIT 1`;
      params.push(Number(excludeId));
    }
    const [rows] = await pool.query(sql, params);
    if (!rows?.length) return endpoint;
    endpoint = `${basePath}-${counter}`;
    counter += 1;
  }
  throw new Error('No se pudo generar un endpoint único');
}

function validateApiEndpointSql(sqlRaw) {
  const sql = String(sqlRaw || '')
    .trim()
    .replace(/;+\s*$/, '');
  if (!sql) throw new Error('La consulta SQL es obligatoria');
  if (!isSafeSelect(sql)) throw new Error('Solo se permiten consultas SELECT de solo lectura');
  const upper = sql.toUpperCase();
  if (!upper.startsWith('SELECT')) throw new Error('Solo se permite SELECT');
  if (/--|\/\*|\*\/|#/.test(sql)) throw new Error('No se permiten comentarios SQL en el endpoint');
  if (/\bINTO\s+OUTFILE\b|\bINTO\s+DUMPFILE\b|\bLOAD_FILE\s*\(/i.test(sql)) {
    throw new Error('La consulta contiene clausulas no permitidas');
  }
  return sql;
}

function hasSubquery(sql) {
  return /\(\s*select[\s\S]+?\)/i.test(sql);
}

function normalizeRows(rows) {
  return rows.map((row) => {
    const out = {};
    Object.entries(row).forEach(([key, value]) => {
      if (value instanceof Date) {
        out[key] = value.toISOString().slice(0, 10); // yyyy-mm-dd
      } else {
        out[key] = value;
      }
    });
    return out;
  });
}

async function processUploadedFiles(files = []) {
  const allowedExt = new Set(['pdf', 'csv', 'xls', 'xlsx', 'doc', 'docx']);
  const tmpFiles = [];
  try {
    for (let i = 0; i < Math.min(files.length, 5); i += 1) {
      const f = files[i] || {};
      const name = String(f.name || '').slice(0, 200);
      const ext = (name.split('.').pop() || '').toLowerCase();
      const base64 = typeof f.content === 'string' ? f.content : '';
      if (!allowedExt.has(ext)) {
        throw new Error(`Tipo de archivo no permitido: ${ext || 'sin extensión'}`);
      }
      if (!base64) {
        continue;
      }
      const buffer = Buffer.from(base64, 'base64');
      const tmpPath = path.join(os.tmpdir(), `ia_file_${Date.now()}_${i}.${ext || 'tmp'}`);
      await fsp.writeFile(tmpPath, buffer);
      tmpFiles.push({ path: tmpPath, name, ext });
    }
    if (!tmpFiles.length) {
      return { outputs: [], summary: '' };
    }

    const scriptPath = path.join(__dirname, 'tools', 'read_attachments.py');
    const args = [scriptPath, ...tmpFiles.map((f) => f.path)];
    const { stdout } = await execFileAsync('python', args, { timeout: 20000 });
    let parsed = [];
    try {
      parsed = JSON.parse(stdout);
    } catch (_err) {
      parsed = [];
    }

    const summarizeItem = (item) => {
      if (!item) return '';
      const name = item.file || '';
      if (item.error) return `${name}: error - ${item.error}`;
      if (item.content) {
        const snippet = String(item.content).slice(0, 3000);
        return `${name}: contenido (primeros 3000 chars):\n${snippet}`;
      }
      if (item.rows) {
        const rowsText = JSON.stringify(item.rows.slice(0, 30));
        return `${name}: filas (primeras 30):\n${rowsText.slice(0, 3000)}`;
      }
      return `${name}: sin datos`;
    };

    const summary = Array.isArray(parsed) && parsed.length ? parsed.map(summarizeItem).join('\n\n') : '';
    return { outputs: parsed, summary };
  } finally {
    await Promise.all(
      tmpFiles.map(async (f) => {
        try {
          await fsp.unlink(f.path);
        } catch (_err) {
          /* ignore */
        }
      })
    );
  }
}

function validateAgainstSchema(sql, schemaMeta) {
  if (!schemaMeta || !schemaMeta.tables || !schemaMeta.columns) return { ok: false, invalidTables: [], invalidColumns: [] };
  const tables = schemaMeta.tables;
  const columns = schemaMeta.columns;
  const upperSql = sql.toUpperCase();
  if (!upperSql.startsWith('SELECT') && !upperSql.startsWith('WITH')) return { ok: false, invalidTables: [], invalidColumns: [] };

  const usedTables = new Set();
  const tableRegex = /\bfrom\s+([a-zA-Z0-9_]+)|\bjoin\s+([a-zA-Z0-9_]+)/gi;
  let m;
  while ((m = tableRegex.exec(sql)) !== null) {
    const name = (m[1] || m[2] || '').toLowerCase();
    if (name) usedTables.add(name);
  }
  const invalidTables = Array.from(usedTables).filter((t) => !tables.has(t));

  const usedColumns = new Set();
  const dotRegex = /([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)/g;
  while ((m = dotRegex.exec(sql)) !== null) {
    const col = (m[2] || '').toLowerCase();
    if (col) usedColumns.add(col);
  }
  const tickRegex = /`([^`]+)`/g;
  while ((m = tickRegex.exec(sql)) !== null) {
    const col = (m[1] || '').toLowerCase();
    if (col) usedColumns.add(col);
  }
  const invalidColumns = Array.from(usedColumns).filter((c) => !columns.has(c));

  return { ok: invalidTables.length === 0 && invalidColumns.length === 0, invalidTables, invalidColumns };
}

let cachedMiaUserId = null;
async function getMiaUserId() {
  if (cachedMiaUserId) return cachedMiaUserId;
  const [rows] = await pool.query(`SELECT id FROM users WHERE name = 'Mia' LIMIT 1`);
  if (rows?.[0]?.id) cachedMiaUserId = rows[0].id;
  return cachedMiaUserId;
}

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.get('/api/paqueteria', requireAuth, requirePermission('dashboard-empaquetados'), async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         SUM(CASE WHEN cp.estado = 0 AND cp.empaquetado = 1 THEN 1 ELSE 0 END) AS pendientes,
         SUM(CASE WHEN cp.estado = 0 AND cp.empaquetado = 1 AND (cp.transporte IS NULL OR cp.transporte = '') THEN 1 ELSE 0 END) AS sinTransporte,
         SUM(CASE WHEN cp.estado = 0 AND cp.empaquetado = 1 AND f.fecha < DATE_SUB(CURDATE(), INTERVAL 3 DAY) THEN 1 ELSE 0 END) AS vencidos
       FROM controlpedidos cp
       LEFT JOIN facturah f ON f.NroFactura = cp.nrofactura`
    );

    const data = rows[0] || {};
    res.json({
      pendientes: Number(data.pendientes) || 0,
      sinTransporte: Number(data.sinTransporte) || 0,
      vencidos: Number(data.vencidos) || 0,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar empaquetados', error: error.message });
  }
});

app.get('/api/carritos-abandonados', requireAuth, async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         SUM(CASE WHEN ca.estado = 0 AND ca.vendedora = 'PAGINA' THEN 1 ELSE 0 END) AS sinAsignar,
         SUM(CASE WHEN ca.estado = 0 THEN 1 ELSE 0 END) AS pendientes,
         SUM(CASE WHEN notas.id_carritos_abandonados IS NULL THEN 1 ELSE 0 END) AS sinNotas,
         SUM(CASE WHEN ca.estado = 0 AND ca.vendedora = 'PAGINA' AND ca.fecha < DATE_SUB(NOW(), INTERVAL 2 DAY) THEN 1 ELSE 0 END) AS sinAsignarVencidos
       FROM carritos_abandonados ca
       LEFT JOIN (
         SELECT id_carritos_abandonados
         FROM notas_carritos_abandonados
         GROUP BY id_carritos_abandonados
       ) AS notas ON notas.id_carritos_abandonados = ca.id_carritos_abandonados`
    );

    const data = rows[0] || {};
    res.json({
      sinAsignar: Number(data.sinAsignar) || 0,
      pendientes: Number(data.pendientes) || 0,
      sinNotas: Number(data.sinNotas) || 0,
      sinAsignarVencidos: Number(data.sinAsignarVencidos) || 0,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar carritos abandonados', error: error.message });
  }
});

app.get('/api/carritos-abandonados/lista', requireAuth, async (req, res) => {
  try {
    const tipo = req.query.tipo;
    const baseWhere = 'ca.estado = 0';
    let extra = '';
    if (tipo === 'sinAsignar') {
      extra = "AND ca.vendedora = 'PAGINA'";
    } else if (tipo === 'sinNotas') {
      extra = 'AND COALESCE(notas.notas_count, 0) = 0';
    }

    const [rows] = await pool.query(
      `SELECT
         ca.id_carritos_abandonados AS id,
         ca.nombre_contacto,
         ca.vendedora,
         ca.cel_contacto,
         ca.total,
         ca.email_contacto,
         ca.fecha,
         COALESCE(notas.notas_count, 0) AS notas_count
      FROM carritos_abandonados ca
       LEFT JOIN (
         SELECT id_carritos_abandonados, COUNT(*) AS notas_count
         FROM notas_carritos_abandonados
         GROUP BY id_carritos_abandonados
       ) AS notas ON notas.id_carritos_abandonados = ca.id_carritos_abandonados
       WHERE ${baseWhere} ${extra}
       ORDER BY ca.fecha DESC`
    );

    res.json({ tipo, data: rows || [] });
  } catch (error) {
    res.status(500).json({ message: 'Error al listar carritos abandonados', error: error.message });
  }
});

app.get('/api/carritos-abandonados/:id/notas', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: 'Id de carrito requerido' });
    const [rows] = await pool.query(
      `SELECT
         id_notas_carritos_abandonados AS id,
         id_carritos_abandonados,
         fecha,
         notas,
         users_id,
         u.name AS vendedora
       FROM notas_carritos_abandonados
       LEFT JOIN users u ON u.id = notas_carritos_abandonados.users_id
       WHERE id_carritos_abandonados = ?
       ORDER BY id_notas_carritos_abandonados DESC`,
      [id]
    );
    res.json({ data: rows || [] });
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar notas', error: error.message });
  }
});

app.post('/api/carritos-abandonados/:id/notas', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const nota = (req.body?.nota || '').trim();
    const userId = req.user?.id;
    if (!id) return res.status(400).json({ message: 'Id de carrito requerido' });
    if (!nota) return res.status(400).json({ message: 'Nota requerida' });
    if (!userId) return res.status(401).json({ message: 'Usuario no autenticado' });
    const fecha = formatDateTimeLocal(new Date());
    const [result] = await pool.query(
      `INSERT INTO notas_carritos_abandonados (id_carritos_abandonados, notas, users_id, fecha)
       VALUES (?, ?, ?, ?)`,
      [id, nota, userId, fecha]
    );
    res.json({ ok: true, id: result.insertId });
  } catch (error) {
    res.status(500).json({ message: 'Error al guardar nota', error: error.message });
  }
});

app.put('/api/carritos-abandonados/notas/:notaId', requireAuth, async (req, res) => {
  try {
    const notaId = Number(req.params.notaId);
    const nota = (req.body?.nota || '').trim();
    if (!notaId) return res.status(400).json({ message: 'Id de nota requerido' });
    if (!nota) return res.status(400).json({ message: 'Nota requerida' });
    await pool.query(
      'UPDATE notas_carritos_abandonados SET notas = ? WHERE id_notas_carritos_abandonados = ? LIMIT 1',
      [nota, notaId]
    );
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar nota', error: error.message });
  }
});

app.post('/api/carritos-abandonados/:id/cerrar', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: 'Id de carrito requerido' });
    const [rows] = await pool.query(
      'SELECT COUNT(*) AS total FROM notas_carritos_abandonados WHERE id_carritos_abandonados = ?',
      [id]
    );
    const total = Number(rows?.[0]?.total) || 0;
    if (!total) {
      return res
        .status(400)
        .json({ message: 'Antes de cerrar un carrito debes agregar al menos una nota.' });
    }
    await pool.query('UPDATE carritos_abandonados SET estado = 1 WHERE id_carritos_abandonados = ? LIMIT 1', [
      id,
    ]);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: 'Error al cerrar carrito', error: error.message });
  }
});

app.put('/api/carritos-abandonados/:id/vendedora', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const vendedora = (req.body?.vendedora || '').trim();
    if (!id) return res.status(400).json({ message: 'Id de carrito requerido' });
    if (!vendedora) return res.status(400).json({ message: 'Vendedora requerida' });
    await pool.query(
      'UPDATE carritos_abandonados SET vendedora = ? WHERE id_carritos_abandonados = ? LIMIT 1',
      [vendedora, id]
    );
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar vendedora', error: error.message });
  }
});

app.get('/api/carritos-abandonados/vendedoras', requireAuth, async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT name AS nombre
       FROM users
       WHERE id_roles <> 4
       ORDER BY name`
    );
    res.json({ data: rows || [] });
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar vendedoras', error: error.message });
  }
});

app.get('/api/panel-control/pedidos', requireAuth, async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         v.nombre AS vendedora,
         SUM(CASE WHEN ctrl.total < 1 THEN 1 ELSE 0 END) AS enProceso,
         SUM(CASE WHEN ctrl.total > 1 THEN 1 ELSE 0 END) AS paraFacturar,
         SUM(CASE WHEN ctrl.total < 1 AND ctrl.fecha < DATE_SUB(NOW(), INTERVAL 3 DAY) THEN 1 ELSE 0 END) AS vencidosEnProceso,
         SUM(CASE WHEN ctrl.total > 1 AND ctrl.fecha < DATE_SUB(NOW(), INTERVAL 3 DAY) THEN 1 ELSE 0 END) AS vencidosParaFacturar,
         SUM(
           CASE
             WHEN ctrl.total < 1
              AND ctrl.fecha < DATE_SUB(NOW(), INTERVAL 3 DAY)
              AND COALESCE(ctrl.fecha_ultima_nota, '1900-01-01') < DATE_SUB(NOW(), INTERVAL 3 DAY)
             THEN 1
             ELSE 0
           END
         ) AS notasVencidosEnProceso,
         SUM(
           CASE
             WHEN ctrl.total > 1
              AND ctrl.fecha < DATE_SUB(NOW(), INTERVAL 3 DAY)
              AND COALESCE(ctrl.fecha_ultima_nota, '1900-01-01') < DATE_SUB(NOW(), INTERVAL 3 DAY)
             THEN 1
             ELSE 0
           END
         ) AS notasVencidosParaFacturar
       FROM vendedores v
       LEFT JOIN controlpedidos ctrl
         ON ctrl.vendedora = v.nombre
        AND ctrl.fecha > '2020-05-01'
        AND ctrl.estado = 1
       WHERE v.tipo <> 0
         AND v.nombre NOT IN ('Veronica', ' ')
       GROUP BY v.nombre
       ORDER BY v.nombre`
    );
    res.json({ data: rows || [] });
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar pedidos', error: error.message });
  }
});

app.get('/api/panel-control/contadores', requireAuth, async (req, res) => {
  try {
    const now = new Date();
    const baseDate = req.query.fecha ? parseISODate(req.query.fecha) : now;
    const fromDate = new Date(baseDate);
    fromDate.setHours(0, 0, 0, 0);
    const toDate = new Date(baseDate);
    toDate.setHours(23, 59, 59, 999);

    const desde = formatDateTimeLocal(fromDate);
    const hasta = formatDateTimeLocal(toDate);

    const [[ventasSalon]] = await pool.query(
      `SELECT COUNT(*) AS cantidad
       FROM facturah f
       LEFT JOIN controlpedidos cp ON cp.nrofactura = f.NroFactura
       WHERE f.fecha >= ? AND f.fecha <= ?
         AND (cp.nrofactura IS NULL OR cp.ordenWeb IS NULL OR cp.ordenWeb = 0)`,
      [desde, hasta]
    );

    const [[pedidosFacturados]] = await pool.query(
      `SELECT COUNT(*) AS cantidad
       FROM facturah f
       LEFT JOIN controlpedidos cp ON cp.nrofactura = f.NroFactura
       WHERE f.fecha >= ? AND f.fecha <= ?
         AND cp.ordenWeb IS NOT NULL
         AND cp.ordenWeb <> 0`,
      [desde, hasta]
    );

    const [[pedidosPasados]] = await pool.query(
      `SELECT COUNT(*) AS cantidad
       FROM controlpedidos
       WHERE ultactualizacion >= ? AND ultactualizacion <= ?
         AND total > 1
         AND estado <> 2
         AND ordenWeb > 0`,
      [desde, hasta]
    );

    const [[pedidosPendientes]] = await pool.query(
      `SELECT COUNT(*) AS cantidad
       FROM controlpedidos
       WHERE total < 1
         AND estado = 1
         AND fecha > '2020-05-01'`
    );

    res.json({
      desde,
      hasta,
      ventasSalon: Number(ventasSalon?.cantidad) || 0,
      pedidosFacturados: Number(pedidosFacturados?.cantidad) || 0,
      pedidosPasados: Number(pedidosPasados?.cantidad) || 0,
      pedidosPendientes: Number(pedidosPendientes?.cantidad) || 0,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar contadores operativos', error: error.message });
  }
});

app.get('/api/panel-control/pedidos/:vendedora', requireAuth, async (req, res) => {
  try {
    const vendedora = req.params.vendedora;
    if (!vendedora) return res.status(400).json({ message: 'Vendedora requerida' });
    const [rows] = await pool.query(
      `SELECT
         SUM(CASE WHEN ctrl.estado = 1 THEN 1 ELSE 0 END) AS asignados,
         SUM(CASE WHEN ctrl.estado = 0 AND ctrl.empaquetado = 1 THEN 1 ELSE 0 END) AS empaquetados,
         SUM(CASE WHEN ctrl.estado = 1 AND ctrl.total < 1 THEN 1 ELSE 0 END) AS enProceso,
         SUM(CASE WHEN ctrl.estado = 1 AND ctrl.total > 1 THEN 1 ELSE 0 END) AS paraFacturar
       FROM controlpedidos ctrl
       INNER JOIN vendedores v ON v.nombre = ctrl.vendedora
       WHERE ctrl.fecha > '2020-05-01'
         AND ctrl.vendedora NOT IN ('Veronica', ' ')
         AND v.tipo <> 0
         AND ctrl.vendedora = ?`,
      [vendedora]
    );
    res.json({ data: rows?.[0] || {} });
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar pedidos de vendedora', error: error.message });
  }
});

app.get('/api/panel-control/pedidos/:vendedora/lista', requireAuth, async (req, res) => {
  try {
    const vendedora = req.params.vendedora;
    const tipo = req.query.tipo;
    if (!vendedora) return res.status(400).json({ message: 'Vendedora requerida' });
    let extra = '';
    if (tipo === 'empaquetados') {
      extra = 'AND ctrl.estado = 0 AND ctrl.empaquetado = 1';
    } else if (tipo === 'enProceso') {
      extra = 'AND ctrl.estado = 1 AND ctrl.total < 1';
    } else if (tipo === 'paraFacturar') {
      extra = 'AND ctrl.estado = 1 AND ctrl.total > 1';
    } else {
      extra = 'AND ctrl.estado = 1';
    }

    const [rows] = await pool.query(
      `SELECT
         ctrl.id,
         ctrl.nropedido,
         ctrl.fecha,
         ctrl.fecha_ultima_nota,
         ctrl.vendedora,
         ctrl.nrofactura,
         ctrl.total,
         ctrl.ordenweb,
         ctrl.totalweb,
         ctrl.transporte,
         ctrl.instancia,
         ctrl.estado,
         ctrl.empaquetado,
         ctrl.pagado,
         ctrl.id_cliente,
         COALESCE(comentarios.total, 0) AS notas_count,
         CASE
           WHEN ctrl.estado = 1
            AND ctrl.fecha < DATE_SUB(NOW(), INTERVAL 3 DAY)
            AND COALESCE(ctrl.fecha_ultima_nota, '1900-01-01') < DATE_SUB(NOW(), INTERVAL 3 DAY)
           THEN 1
           ELSE 0
         END AS vencido,
         c.nombre,
         c.apellido
       FROM controlpedidos ctrl
       INNER JOIN clientes c ON c.id_clientes = ctrl.id_cliente
       INNER JOIN vendedores v ON v.nombre = ctrl.vendedora
       LEFT JOIN (
         SELECT controlpedidos_id, COUNT(*) AS total
         FROM ComentariosPedidos
         GROUP BY controlpedidos_id
       ) AS comentarios ON comentarios.controlpedidos_id = ctrl.id
       WHERE ctrl.fecha > '2020-05-01'
         AND ctrl.vendedora NOT IN ('Veronica', ' ')
         AND v.tipo <> 0
         AND ctrl.vendedora = ?
         ${extra}
       ORDER BY ctrl.nropedido DESC`,
      [vendedora]
    );

    const data = rows.map((row) => ({
      id: row.id,
      nropedido: row.nropedido,
      fecha: row.fecha,
      vendedora: row.vendedora,
      nrofactura: row.nrofactura,
      total: row.total,
      ordenweb: row.ordenweb,
      totalweb: row.totalweb,
      transporte: row.transporte,
      instancia: row.instancia,
      estado: row.estado,
      empaquetado: row.empaquetado,
      vencido: row.vencido,
      pagado: row.pagado,
      id_cliente: row.id_cliente,
      notas_count: row.notas_count,
      cliente: `${row.nombre || ''} ${row.apellido || ''}`.trim(),
    }));

    res.json({ tipo, data });
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar pedidos de vendedora', error: error.message });
  }
});

app.patch('/api/pedidos/instancia', requireAuth, async (req, res) => {
  try {
    const { id, instancia } = req.body || {};
    const pedidoId = Number(id);
    const nuevaInstancia = Number(instancia);
    if (!pedidoId) return res.status(400).json({ message: 'Id de pedido requerido' });
    if (![0, 1, 2].includes(nuevaInstancia)) {
      return res.status(400).json({ message: 'Instancia invalida' });
    }
    if (nuevaInstancia === 2) {
      const [[row]] = await pool.query(
        'SELECT transporte FROM controlpedidos WHERE id = ? LIMIT 1',
        [pedidoId]
      );
      const transporteRaw = String(row?.transporte || '').trim();
      const transporte = transporteRaw.toLowerCase().replace(/\s+/g, '');
      if (!transporte || transporte === 'sintransporte') {
        return res
          .status(400)
          .json({ message: 'Debe seleccionar un transporte para finalizar.' });
      }
    }
    const now = formatDateTimeLocal(
      new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }))
    );
    await pool.query(
      `UPDATE controlpedidos
       SET instancia = ?,
           fecha_inicio_instancia = CASE
             WHEN ? = 0 THEN NULL
             WHEN ? = 1 THEN ?
             ELSE fecha_inicio_instancia
           END,
           fecha_fin_instancia = CASE
             WHEN ? = 0 THEN NULL
             WHEN ? = 2 THEN ?
             ELSE fecha_fin_instancia
           END
       WHERE id = ?
       LIMIT 1`,
      [nuevaInstancia, nuevaInstancia, nuevaInstancia, now, nuevaInstancia, nuevaInstancia, now, pedidoId]
    );
    res.json({ ok: true });
  } catch (error) {
    console.error('[pedidos/instancia] error', error);
    res.status(500).json({ message: 'Error al actualizar instancia', error: error.message });
  }
});

app.get('/api/pedidos/items', requireAuth, async (req, res) => {
  try {
    const nropedido = req.query.nropedido;
    if (!nropedido) return res.status(400).json({ message: 'NroPedido requerido' });
    const [rows] = await pool.query(
      `SELECT
         Articulo AS articulo,
         Detalle AS detalle,
         Cantidad AS cantidad,
         ROUND(COALESCE(PrecioUnitario, PrecioVenta, 0), 2) AS precio_unitario
       FROM pedidotemp
       WHERE NroPedido = ?
       ORDER BY Articulo`,
      [nropedido]
    );
    res.json({ data: rows || [] });
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar mercaderia del pedido', error: error.message });
  }
});

app.get('/api/ordencheckoutInTN', requireAuth, async (req, res) => {
  try {
    const nropedido = req.query.nroPedido || req.query.nropedido;
    if (!nropedido) return res.status(400).json({ message: 'nroPedido requerido' });
    const [rows] = await pool.query(
      `SELECT
         ctrl.nropedido,
         ctrl.ordenweb AS OrdenWeb,
         oa.articulo,
         oa.detalle,
         oa.cantidad,
         oa.precio,
         art.cantidad AS stock
       FROM controlpedidos ctrl
       INNER JOIN ordenesarticulos oa ON oa.id_controlPedidos = ctrl.id
       INNER JOIN articulos art ON oa.articulo = art.Articulo
       LEFT JOIN pedidotemp ptemp
         ON oa.articulo = ptemp.articulo
        AND ptemp.NroPedido = ctrl.nropedido
       WHERE ctrl.nropedido = ?
         AND ptemp.Articulo IS NULL`,
      [nropedido]
    );
    res.json(rows || []);
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar checkout tienda', error: error.message });
  }
});

app.get('/api/ordencheckoutInLocalSystem', requireAuth, async (req, res) => {
  try {
    const nropedido = req.query.nroPedido || req.query.nropedido;
    if (!nropedido) return res.status(400).json({ message: 'nroPedido requerido' });
    const [rows] = await pool.query(
      `SELECT
         ptemp.nropedido,
         ctrl.ordenweb AS OrdenWeb,
         ptemp.Articulo,
         ptemp.detalle,
         ptemp.cantidad,
         ptemp.PrecioVenta
       FROM controlpedidos ctrl
       INNER JOIN pedidotemp ptemp ON ptemp.NroPedido = ctrl.nropedido
       LEFT JOIN ordenesarticulos oa
         ON oa.articulo = ptemp.Articulo
        AND oa.id_controlPedidos = ctrl.id
       WHERE ctrl.nropedido = ?
         AND oa.Articulo IS NULL`,
      [nropedido]
    );
    res.json(rows || []);
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar checkout sistema', error: error.message });
  }
});

app.get('/api/ordencheckoutInDiff', requireAuth, async (req, res) => {
  try {
    const nropedido = req.query.nroPedido || req.query.nropedido;
    if (!nropedido) return res.status(400).json({ message: 'nroPedido requerido' });
    const [rows] = await pool.query(
      `SELECT
         ctrl.nropedido,
         oa.articulo,
         MAX(oa.detalle) AS detalle,
         SUM(oa.cantidad) AS TNCantidad,
         MAX(oa.precio) AS TNPrecio,
         local.CantidadLocal,
         local.PrecioLocal
       FROM controlpedidos ctrl
       INNER JOIN ordenesarticulos oa ON oa.id_controlPedidos = ctrl.id
       INNER JOIN (
         SELECT
           nropedido,
           articulo,
           SUM(cantidad) AS CantidadLocal,
           MAX(PrecioUnitario) AS PrecioLocal
         FROM pedidotemp
         WHERE nropedido = ?
         GROUP BY nropedido, articulo
       ) AS local
         ON local.nropedido = ctrl.nropedido
        AND local.articulo = oa.articulo
       WHERE ctrl.nropedido = ?
       GROUP BY ctrl.nropedido, oa.articulo
       HAVING TNCantidad <> CantidadLocal OR TNPrecio <> PrecioLocal`,
      [nropedido, nropedido]
    );
    res.json(rows || []);
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar checkout diferencias', error: error.message });
  }
});

app.get('/api/pedidos/ia/historial', requireAuth, async (req, res) => {
  try {
    const controlId = Number(req.query.controlId);
    if (!controlId) return res.status(400).json({ message: 'controlId requerido' });
    const [rows] = await pool.query(
      `SELECT u.name AS nombre, c.chat, c.fecha, c.id_users
       FROM chatpedidosia c
       LEFT JOIN users u ON u.id = c.id_users
       WHERE c.id_controlpedidos = ?
       ORDER BY c.fecha ASC`,
      [controlId]
    );
    if (rows && rows.length) {
      return res.json({ data: rows });
    }
    const [fallbackRows] = await pool.query(
      `SELECT u.name AS nombre, c.chat, c.fecha, c.id_users
       FROM chatclientesia c
       LEFT JOIN users u ON u.id = c.id_users
       WHERE c.id_cliente = (
         SELECT id_cliente FROM controlpedidos WHERE id = ? LIMIT 1
       )
       ORDER BY c.fecha ASC`,
      [controlId]
    );
    res.json({ data: fallbackRows || [] });
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar historial IA', error: error.message });
  }
});

app.get('/api/clientes/ia/historial', requireAuth, async (req, res) => {
  try {
    const clienteId = Number(req.query.clienteId);
    if (!clienteId) return res.status(400).json({ message: 'clienteId requerido' });
    const [rows] = await pool.query(`SELECT u.name AS nombre, c.chat, c.fecha, c.id_users FROM chatclientesia c LEFT JOIN users u ON u.id = c.id_users WHERE c.id_cliente = ? ORDER BY c.fecha ASC`, [clienteId]);
    res.json({ data: rows || [] });
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar historial IA', error: error.message });
  }
});

app.get('/api/pedidos/todos/resumen', requireAuth, async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         SUM(CASE WHEN estado = 0 AND (empaquetado = 0 OR empaquetado = 2) THEN 1 ELSE 0 END) AS facturados,
         SUM(CASE WHEN estado = 1 THEN 1 ELSE 0 END) AS enProceso,
         SUM(CASE WHEN estado = 1 AND pagado = 1 THEN 1 ELSE 0 END) AS pagados,
         SUM(CASE WHEN estado = 0 AND empaquetado = 1 THEN 1 ELSE 0 END) AS empaquetados,
         SUM(CASE WHEN estado = 2 THEN 1 ELSE 0 END) AS cancelados,
         COUNT(*) AS todos
       FROM controlpedidos`
    );
    res.json({ data: rows?.[0] || {} });
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar resumen de pedidos', error: error.message });
  }
});

app.get('/api/pedidos/todos/lista', requireAuth, async (req, res) => {
  try {
    const tipo = req.query.tipo || 'todos';
    const draw = Number(req.query.draw || 0);
    const start = Math.max(0, Number(req.query.start || 0));
    const length = Math.min(100, Math.max(1, Number(req.query.length || 10)));
    const searchValue =
      (req.query['search[value]'] || req.query.search?.value || '').toString().trim();
    const orderCol =
      Number(req.query['order[0][column]'] ?? req.query.order?.[0]?.column ?? 0) || 0;
    const orderDir =
      (req.query['order[0][dir]'] || req.query.order?.[0]?.dir || 'desc') === 'asc'
        ? 'ASC'
        : 'DESC';
    let extra = '';
    if (tipo === 'facturados') {
      extra = 'AND ctrl.estado = 0 AND ctrl.empaquetado IN (0, 2)';
    } else if (tipo === 'enProceso') {
      extra = 'AND ctrl.estado = 1';
    } else if (tipo === 'pagados') {
      extra = 'AND ctrl.estado = 1 AND ctrl.pagado = 1';
    } else if (tipo === 'cancelados') {
      extra = 'AND ctrl.estado = 2';
    } else if (tipo === 'empaquetados') {
      extra = 'AND ctrl.estado = 0 AND ctrl.empaquetado = 1';
    }

    const baseSelect = `
      SELECT
        ctrl.id,
        ctrl.nropedido,
        ctrl.fecha,
        ctrl.fecha_ultima_nota,
        ctrl.fecha_pago,
        ctrl.vendedora,
        ctrl.nrofactura,
        ctrl.total,
        ctrl.ordenweb,
        ctrl.totalweb,
        ctrl.transporte,
        ctrl.instancia,
        ctrl.estado,
        ctrl.empaquetado,
        ctrl.pagado,
        ctrl.id_cliente,
        COALESCE(comentarios.total, 0) AS notas_count,
        CASE
          WHEN ctrl.estado = 1
           AND ctrl.fecha < DATE_SUB(NOW(), INTERVAL 3 DAY)
           AND COALESCE(ctrl.fecha_ultima_nota, '1900-01-01') < DATE_SUB(NOW(), INTERVAL 3 DAY)
          THEN 1
          ELSE 0
        END AS vencido,
        c.nombre,
        c.apellido
      FROM controlpedidos ctrl
      INNER JOIN clientes c ON c.id_clientes = ctrl.id_cliente
      LEFT JOIN (
        SELECT controlpedidos_id, COUNT(*) AS total
        FROM ComentariosPedidos
        GROUP BY controlpedidos_id
      ) AS comentarios ON comentarios.controlpedidos_id = ctrl.id
    `;

    const orderMap =
      tipo === 'pagados'
        ? {
            0: 'ctrl.nropedido',
            1: 'c.nombre',
            2: 'ctrl.fecha',
            3: 'ctrl.fecha_pago',
            4: 'ctrl.vendedora',
            5: 'ctrl.nrofactura',
            6: 'ctrl.total',
            7: 'ctrl.ordenweb',
            8: 'ctrl.totalweb',
            9: 'ctrl.transporte',
            10: 'ctrl.instancia',
            11: 'ctrl.estado',
          }
        : {
            0: 'ctrl.nropedido',
            1: 'c.nombre',
            2: 'ctrl.fecha',
            3: 'ctrl.vendedora',
            4: 'ctrl.nrofactura',
            5: 'ctrl.total',
            6: 'ctrl.ordenweb',
            7: 'ctrl.totalweb',
            8: 'ctrl.transporte',
            9: 'ctrl.instancia',
            10: 'ctrl.estado',
          };
    const orderBy = orderMap[orderCol] || 'ctrl.nropedido';

    const searchSql = searchValue
      ? `AND (
          CAST(ctrl.nropedido AS CHAR) LIKE ?
          OR ctrl.vendedora LIKE ?
          OR CAST(ctrl.nrofactura AS CHAR) LIKE ?
          OR CAST(ctrl.ordenweb AS CHAR) LIKE ?
          OR c.nombre LIKE ?
          OR c.apellido LIKE ?
          OR CONCAT(c.nombre, ' ', c.apellido) LIKE ?
        )`
      : '';
    const searchParams = searchValue
      ? Array(7).fill(`%${searchValue}%`)
      : [];

    const countBase = `
      FROM controlpedidos ctrl
      INNER JOIN clientes c ON c.id_clientes = ctrl.id_cliente
      WHERE 1=1
      ${extra}
    `;

    const [[totalRow]] = await pool.query(
      `SELECT COUNT(*) AS total ${countBase}`
    );

    const [[filteredRow]] = await pool.query(
      `SELECT COUNT(*) AS total ${countBase} ${searchSql}`,
      searchParams
    );
    let filteredTotal = Number(filteredRow?.total) || 0;
    let activeSearchSql = searchSql;
    let activeSearchParams = searchParams.slice();

    // Fallback acotado a Pedidos->Todos: si la busqueda general no encuentra nada,
    // probar por tokens de cliente para tolerar orden/espacios sin penalizar el caso normal.
    if (searchValue && filteredTotal === 0) {
      const tokens = searchValue
        .toLowerCase()
        .split(/\s+/)
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 4);
      if (tokens.length >= 2) {
        const tokenSql = `AND (${tokens
          .map(() => "LOWER(CONCAT_WS(' ', c.nombre, c.apellido)) LIKE ?")
          .join(' AND ')})`;
        const tokenParams = tokens.map((t) => `%${t}%`);
        const [[tokenFilteredRow]] = await pool.query(
          `SELECT COUNT(*) AS total ${countBase} ${tokenSql}`,
          tokenParams
        );
        const tokenTotal = Number(tokenFilteredRow?.total) || 0;
        if (tokenTotal > 0) {
          activeSearchSql = tokenSql;
          activeSearchParams = tokenParams;
          filteredTotal = tokenTotal;
        }
      }
    }

    const [rows] = await pool.query(
      `${baseSelect}
       WHERE 1=1
         ${extra}
         ${activeSearchSql}
       ORDER BY ${orderBy} ${orderDir}
       LIMIT ? OFFSET ?`,
      [...activeSearchParams, length, start]
    );

    const data = rows.map((row) => ({
      id: row.id,
      pedido: row.nropedido,
      nropedido: row.nropedido,
      fecha: row.fecha,
      fecha_pago: row.fecha_pago,
      vendedora: row.vendedora,
      factura: row.nrofactura,
      nrofactura: row.nrofactura,
      total: row.total,
      ordenWeb: row.ordenweb,
      totalWeb: row.totalweb,
      ordenweb: row.ordenweb,
      totalweb: row.totalweb,
      transporte: row.transporte,
      instancia: row.instancia,
      estado: row.estado,
      empaquetado: row.empaquetado,
      vencido: row.vencido,
      pagado: row.pagado,
      id_cliente: row.id_cliente,
      notas_count: row.notas_count,
      notasCount: row.notas_count,
      cliente: `${row.nombre || ''} ${row.apellido || ''}`.trim(),
    }));

    if (draw) {
      res.json({
        draw,
        recordsTotal: Number(totalRow?.total) || 0,
        recordsFiltered: filteredTotal,
        data,
      });
    } else {
      res.json({ tipo, data });
    }
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar pedidos', error: error.message });
  }
});

app.get('/api/pedidos/todos/empaquetados', requireAuth, async (req, res) => {
  try {
    const draw = Number(req.query.draw || 0);
    const start = Math.max(0, Number(req.query.start || 0));
    const length = Math.min(100, Math.max(1, Number(req.query.length || 10)));
    const searchValue =
      (req.query['search[value]'] || req.query.search?.value || '').toString().trim();
    const orderCol =
      Number(req.query['order[0][column]'] ?? req.query.order?.[0]?.column ?? 0) || 0;
    const orderDir =
      (req.query['order[0][dir]'] || req.query.order?.[0]?.dir || 'desc') === 'asc'
        ? 'ASC'
        : 'DESC';
    const orderMap = {
      0: 'ctrl.nropedido',
      1: 'c.nombre',
      2: 'ctrl.fecha',
      3: 'ctrl.vendedora',
      4: 'ctrl.total',
      5: 'ctrl.ordenweb',
      6: 'ctrl.totalweb',
      7: 'ctrl.transporte',
      8: 'ctrl.instancia',
      9: 'ctrl.estado',
    };
    const orderBy = orderMap[orderCol] || 'ctrl.nropedido';

    const searchSql = searchValue
      ? `AND (
          CAST(ctrl.nropedido AS CHAR) LIKE ?
          OR ctrl.vendedora LIKE ?
          OR CAST(ctrl.ordenweb AS CHAR) LIKE ?
          OR c.nombre LIKE ?
          OR c.apellido LIKE ?
          OR CONCAT(c.nombre, ' ', c.apellido) LIKE ?
        )`
      : '';
    const searchParams = searchValue
      ? Array(6).fill(`%${searchValue}%`)
      : [];

    const baseWhere = `
      WHERE ctrl.estado = 0
        AND ctrl.empaquetado = 1
        ${searchSql}
    `;

    const [[totalRow]] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM controlpedidos ctrl
       INNER JOIN clientes c ON c.id_clientes = ctrl.id_cliente
       INNER JOIN facturah f ON f.NroFactura = ctrl.nrofactura
       WHERE ctrl.estado = 0
         AND ctrl.empaquetado = 1`
    );

    const [[filteredRow]] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM controlpedidos ctrl
       INNER JOIN clientes c ON c.id_clientes = ctrl.id_cliente
       INNER JOIN facturah f ON f.NroFactura = ctrl.nrofactura
       ${baseWhere}`,
      searchParams
    );

    const [rows] = await pool.query(
      `SELECT
         ctrl.id,
         ctrl.nropedido,
         f.fecha AS fecha_factura,
         ctrl.vendedora,
         ctrl.total,
         ctrl.ordenweb,
         ctrl.totalweb,
         ctrl.transporte,
         ctrl.instancia,
         ctrl.estado,
         ctrl.empaquetado,
         ctrl.pagado,
         ctrl.id_cliente,
         COALESCE(comentarios.total, 0) AS notas_count,
         CASE
           WHEN f.fecha >= DATE_SUB(NOW(), INTERVAL 3 DAY) THEN 1
           ELSE 2
         END AS vencimiento,
         c.nombre,
         c.apellido
       FROM controlpedidos ctrl
       INNER JOIN clientes c ON c.id_clientes = ctrl.id_cliente
       INNER JOIN facturah f ON f.NroFactura = ctrl.nrofactura
       LEFT JOIN (
         SELECT controlpedidos_id, COUNT(*) AS total
         FROM ComentariosPedidos
         GROUP BY controlpedidos_id
       ) AS comentarios ON comentarios.controlpedidos_id = ctrl.id
       ${baseWhere}
      ORDER BY ${orderBy} ${orderDir}
      LIMIT ? OFFSET ?`,
      [...searchParams, length, start]
    );

    const data = rows.map((row) => ({
      id: row.id,
      pedido: row.nropedido,
      fecha: row.fecha_factura,
      vendedora: row.vendedora,
      total: row.total,
      ordenWeb: row.ordenweb,
      totalWeb: row.totalweb,
      transporte: row.transporte,
      instancia: row.instancia,
      estado: row.estado,
      empaquetado: row.empaquetado,
      pagado: row.pagado,
      id_cliente: row.id_cliente,
      notasCount: row.notas_count,
      vencimiento: row.vencimiento,
      cliente: `${row.nombre || ''} ${row.apellido || ''}`.trim(),
    }));

    res.json({
      draw,
      recordsTotal: Number(totalRow?.total) || 0,
      recordsFiltered: Number(filteredRow?.total) || 0,
      data,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar empaquetados', error: error.message });
  }
});

app.post('/api/pedidos/ia/ask', requireAuth, express.json({ limit: '1mb' }), async (req, res) => {
  try {
    const { controlId, clienteId, message } = req.body || {};
    if (!controlId) return res.status(400).json({ message: 'controlId requerido' });
    if (!message || typeof message !== 'string') return res.status(400).json({ message: 'Mensaje requerido' });
    if (!openai) return res.status(400).json({ message: 'OPENAI_API_KEY no configurada' });
    if (!secondaryPool) {
      return res.status(400).json({
        message: 'DB secundaria no configurada. Configura DB_SECONDARY_* para usar IA.',
      });
    }

    const userId = req.user?.id;
    const ahora = formatDateTimeLocal(
      new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }))
    );
    await pool.query(
      `INSERT INTO chatpedidosia (id_controlpedidos, id_users, chat, fecha) VALUES (?, ?, ?, ?)`,
      [controlId, userId, message, ahora]
    );

    const schemaMeta = getCustomSchemaSummary();
    if (!schemaMeta.text) {
      return res.status(400).json({ message: 'No hay información para su consulta' });
    }

    const question =
      (clienteId ? `${message} para la clienta con id ${clienteId}.` : message) +
      ' La salida debe ser solo la consulta sql.';

    const sqlSystemPrompt =
      'Genera SOLO una consulta SELECT de lectura usando exclusivamente las tablas/columnas del esquema. ' +
      'Evita GROUP BY si no es imprescindible. Si usas GROUP BY, TODAS las columnas seleccionadas deben ' +
      'estar en el GROUP BY o ser agregadas (compatible con ONLY_FULL_GROUP_BY). ' +
      'Usa COALESCE para nulos en agregaciones. Responde en JSON con claves: sql (string) y explanation (string).';

    async function generateSql(extraContext = '') {
      const completionSql = await withRetry(() => openai.chat.completions.create({
        model: OPENAI_MODEL || 'gpt-4o-mini',
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: sqlSystemPrompt },
          {
            role: 'user',
            content: `Pregunta: "${question}"
Esquema:
${schemaMeta.text}
${extraContext}`,
          },
        ],
      }));
      const raw = completionSql.choices?.[0]?.message?.content || '';
      let payload;
      try {
        payload = JSON.parse(raw);
      } catch (_err) {
        throw new Error('IA devolvio una respuesta invalida');
      }
      const sql = String(payload.sql || '').trim();
      if (!isSafeSelect(sql)) {
        throw new Error('Consulta no permitida por seguridad');
      }
      const schemaCheck = validateAgainstSchema(sql, schemaMeta);
      if (!schemaCheck.ok) {
        const err = new Error('Consulta invalida (tablas/columnas no permitidas)');
        err.tables = schemaCheck.invalidTables;
        err.columns = schemaCheck.invalidColumns;
        throw err;
      }
      return sql;
    }

    let sql = await generateSql();
    let rows;
    try {
      [rows] = await secondaryPool.query(sql);
    } catch (err) {
      const msg = String(err?.message || '');
      if (err?.code === 'ER_WRONG_FIELD_WITH_GROUP' || msg.includes('ONLY_FULL_GROUP_BY')) {
        sql = await generateSql(
          `La consulta anterior falló por ONLY_FULL_GROUP_BY. Asegura que todas las columnas seleccionadas ` +
            `estén agregadas o en el GROUP BY.`
        );
        [rows] = await secondaryPool.query(sql);
      } else {
        throw err;
      }
    }

    const rowsJson = JSON.stringify(rows || []);

    const completionAnswer = await withRetry(() => openai.chat.completions.create({
      model: OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            'Tu nombre es Mia y eres asistente de ventas. Este es un sistema interno autorizado. ' +
            'Puedes brindar datos de contacto del cliente (telefono, mail, direccion) si existen en la base. ' +
            'Responde en espanol, claro y breve. No menciones id_clientes ni ganancias. ' +
            'Finaliza con "Te puedo ayudar en alguna otra cosa?".',
        },
        {
          role: 'user',
          content: `Pregunta original: "${message}"
Informacion en JSON:
${rowsJson}`,
        },
      ],
    }));

    const reply = completionAnswer.choices?.[0]?.message?.content || 'Sin respuesta';

    const miaId = (await getMiaUserId()) || null;
    await pool.query(
      `INSERT INTO chatpedidosia (id_controlpedidos, id_users, chat, fecha) VALUES (?, ?, ?, ?)`,
      [controlId, miaId, reply, ahora]
    );

    res.json({ reply });
  } catch (error) {
    res.status(500).json({ message: 'Error en IA', error: error.message });
  }
});

app.post('/api/clientes/ia/ask', requireAuth, express.json({ limit: '1mb' }), async (req, res) => {
  try {
    const { clienteId, message } = req.body || {};
    if (!clienteId) return res.status(400).json({ message: 'clienteId requerido' });
    if (!message || typeof message !== 'string') return res.status(400).json({ message: 'Mensaje requerido' });
    if (!openai) return res.status(400).json({ message: 'OPENAI_API_KEY no configurada' });
    if (!secondaryPool) {
      return res.status(400).json({
        message: 'DB secundaria no configurada. Configura DB_SECONDARY_* para usar IA.',
      });
    }

    const userId = req.user?.id;
    const ahora = formatDateTimeLocal(
      new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }))
    );
    const safeMessage = String(message || '').slice(0, 450);
    await pool.query(
      `INSERT INTO chatclientesia (id_cliente, id_users, chat, fecha) VALUES (?, ?, ?, ?)`,
      [clienteId, userId, safeMessage, ahora]
    );

    const schemaMeta = getCustomSchemaSummary();
    if (!schemaMeta.text) {
      return res.status(400).json({ message: 'No hay informaci▒ para su consulta' });
    }

    const question = `${message} para la clienta con id ${clienteId}. La salida debe ser solo la consulta sql.`;

    const sqlSystemPrompt =
      'Genera SOLO una consulta SELECT de lectura usando exclusivamente las tablas/columnas del esquema. ' +
      'Evita GROUP BY si no es imprescindible. Si usas GROUP BY, TODAS las columnas seleccionadas deben ' +
      'estar en el GROUP BY o ser agregadas (compatible con ONLY_FULL_GROUP_BY). ' +
      'Usa COALESCE para nulos en agregaciones. Responde en JSON con claves: sql (string) y explanation (string).';

    async function generateSql(extraContext = '') {
      const completionSql = await withRetry(() =>
        openai.chat.completions.create({
          model: OPENAI_MODEL || 'gpt-4o-mini',
          temperature: 0,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: sqlSystemPrompt },
            {
              role: 'user',
              content: `${schemaMeta.text}\n\n${extraContext}\n\nPregunta: ${question}`,
            },
          ],
        })
      );
      const raw = completionSql.choices?.[0]?.message?.content || '';
      try {
        return JSON.parse(raw);
      } catch (_err) {
        return { sql: raw.replace(/```/g, '').replace(/sql/gi, '').trim(), explanation: '' };
      }
    }

    const sqlPayload = await generateSql();
    const sqlQuery = (sqlPayload.sql || '').trim();
    if (!sqlQuery.toLowerCase().startsWith('select')) {
      return res.json({ reply: 'Perdon, no entendi la pregunta, volver a consultar!' });
    }

    let rows = [];
    try {
      const [dbRows] = await secondaryPool.query(sqlQuery);
      rows = dbRows || [];
    } catch (_err) {
      return res.json({ reply: 'Perdon, no entendi la pregunta, volver a consultar!' });
    }

    const responsePrompt =
      'Tu nombre es Mia y eres una asistente de ventas. Responde en español, claro y breve. ' +
      'Puedes brindar datos de contacto del cliente (telefono, mail, direccion) si existen en la base. ' +
      'No menciones id_clientes ni ganancias. Finaliza con: ¿Te puedo ayudar en alguna otra cosa?';

    const replyCompletion = await withRetry(() =>
      openai.chat.completions.create({
        model: OPENAI_MODEL || 'gpt-4o-mini',
        temperature: 0.2,
        messages: [
          { role: 'system', content: responsePrompt },
          { role: 'user', content: `Datos: ${JSON.stringify(rows)}\n\nPregunta: ${message}` },
        ],
      })
    );
    const reply = replyCompletion.choices?.[0]?.message?.content || '';
    const safeReply = String(reply || '').slice(0, 450);
    const miaId = (await getMiaUserId()) || null;
    await pool.query(
      `INSERT INTO chatclientesia (id_cliente, id_users, chat, fecha) VALUES (?, ?, ?, ?)`,
      [clienteId, miaId, safeReply, ahora]
    );
    res.json({ reply });
  } catch (error) {
    res.status(500).json({ message: 'Error en IA', error: error.message });
  }
});

app.get('/api/pedidos/:id/comentarios', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: 'Id de pedido requerido' });
    const [rows] = await pool.query(
      `SELECT
         cp.id AS id,
         cp.controlpedidos_id,
         cp.comentario,
         cp.fecha,
         u.name AS usuario
       FROM ComentariosPedidos cp
       LEFT JOIN users u ON u.id = cp.users_id
       WHERE cp.controlpedidos_id = ?
       ORDER BY cp.id DESC`,
      [id]
    );
    res.json({ data: rows || [] });
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar comentarios', error: error.message });
  }
});

app.post('/api/pedidos/:id/comentarios', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const comentario = (req.body?.comentario || '').trim();
    const userId = req.user?.id;
    if (!id) return res.status(400).json({ message: 'Id de pedido requerido' });
    if (!comentario) return res.status(400).json({ message: 'Comentario requerido' });
    if (!userId) return res.status(401).json({ message: 'Usuario no autenticado' });
    const fecha = formatDateTimeLocal(
      new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }))
    );
    const [result] = await pool.query(
      `INSERT INTO ComentariosPedidos (users_id, controlpedidos_id, comentario, fecha)
       VALUES (?, ?, ?, ?)`,
      [userId, id, comentario, fecha]
    );
    await pool.query('UPDATE controlpedidos SET fecha_ultima_nota = ? WHERE id = ? LIMIT 1', [
      fecha,
      id,
    ]);
    res.json({ ok: true, id: result.insertId });
  } catch (error) {
    res.status(500).json({ message: 'Error al guardar comentario', error: error.message });
  }
});

app.put('/api/pedidos/comentarios/:id', requireAuth, async (req, res) => {
  try {
    const comentarioId = Number(req.params.id);
    const comentario = (req.body?.comentario || '').trim();
    if (!comentarioId) return res.status(400).json({ message: 'Id de comentario requerido' });
    if (!comentario) return res.status(400).json({ message: 'Comentario requerido' });
    await pool.query(
      'UPDATE ComentariosPedidos SET comentario = ? WHERE id = ? LIMIT 1',
      [comentario, comentarioId]
    );
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar comentario', error: error.message });
  }
});

app.delete('/api/pedidos/comentarios/:id', requireAuth, async (req, res) => {
  try {
    const comentarioId = Number(req.params.id);
    if (!comentarioId) return res.status(400).json({ message: 'Id de comentario requerido' });
    await pool.query('DELETE FROM ComentariosPedidos WHERE id = ? LIMIT 1', [comentarioId]);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar comentario', error: error.message });
  }
});

app.patch('/api/pedidos/pago', requireAuth, async (req, res) => {
  try {
    const { id, pagado } = req.body || {};
    const pedidoId = Number(id);
    const nuevoPagado = Number(pagado) === 1 ? 1 : 0;
    if (!pedidoId) return res.status(400).json({ message: 'Id de pedido requerido' });
    const fechaPago =
      nuevoPagado === 1
        ? formatDateTimeLocal(
            new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }))
          )
        : null;
    await pool.query(
      `UPDATE controlpedidos
       SET pagado = ?,
           fecha_pago = ?
       WHERE id = ?
       LIMIT 1`,
      [nuevoPagado, fechaPago, pedidoId]
    );
    res.json({ ok: true, pagado: nuevoPagado, fecha_pago: fechaPago });
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar pago', error: error.message });
  }
});

app.patch('/api/pedidos/cancelar', requireAuth, async (req, res) => {
  try {
    const { id } = req.body || {};
    const pedidoId = Number(id);
    if (!pedidoId) return res.status(400).json({ message: 'Id de pedido requerido' });
    await pool.query('UPDATE controlpedidos SET estado = 2 WHERE id = ? LIMIT 1', [pedidoId]);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: 'Error al cancelar pedido', error: error.message });
  }
});

app.patch('/api/pedidos/entregado', requireAuth, async (req, res) => {
  let connection;
  try {
    const { nropedido } = req.body || {};
    const pedidoNumero = String(nropedido || '').trim();
    if (!pedidoNumero) return res.status(400).json({ message: 'NroPedido requerido' });

    connection = await pool.getConnection();
    await connection.beginTransaction();
    await connection.query('UPDATE controlpedidos SET empaquetado = 2 WHERE nropedido = ?', [pedidoNumero]);
    await connection.query('DELETE FROM mi_correo WHERE nropedido = ?', [pedidoNumero]);
    await connection.commit();

    res.json({ ok: true });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (_err) {
        /* ignore */
      }
    }
    res.status(500).json({ message: 'Error al marcar entregado', error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

app.get('/api/paqueteria/lista', requireAuth, requirePermission('dashboard-empaquetados'), async (req, res) => {
  try {
    const tipo = req.query.tipo;
    const baseWhere = `cp.estado = 0 AND cp.empaquetado = 1`;
    let extra = '';
    if (tipo === 'sinTransporte') {
      extra = 'AND (cp.transporte IS NULL OR cp.transporte = "")';
    } else if (tipo === 'vencidos') {
      extra = 'AND f.fecha < DATE_SUB(CURDATE(), INTERVAL 3 DAY)';
    }

    const [rows] = await pool.query(
      `SELECT
         cp.id,
         cp.fecha AS fechaPedido,
         DATE_FORMAT(f.created_at, '%Y-%m-%d %H:%i') AS fechaFactura,
         cp.nropedido,
         cp.nrofactura,
         cp.vendedora,
         cp.transporte,
         cp.total,
         cp.totalweb,
         cp.ordenweb,
         cp.instancia,
         cp.estado,
         c.nombre,
         c.apellido,
         c.encuesta,
         COALESCE(MAX(com.comentario), '') AS comentario
       FROM controlpedidos cp
       INNER JOIN facturah f ON f.NroFactura = cp.nrofactura
       INNER JOIN clientes c ON c.id_clientes = cp.id_cliente
       LEFT JOIN comentariospedidos com ON com.controlpedidos_id = cp.id
       WHERE ${baseWhere} ${extra}
       GROUP BY cp.id, cp.fecha, f.created_at, cp.nropedido, cp.nrofactura, cp.vendedora, cp.transporte, cp.total, cp.totalweb, cp.ordenweb, cp.instancia, cp.estado, c.nombre, c.apellido, c.encuesta
       ORDER BY f.created_at DESC`
    );

    const data = rows.map((row) => ({
      id: row.id,
      fechaPedido: row.fechaPedido,
      fechaFactura: row.fechaFactura,
      nropedido: row.nropedido,
      nrofactura: row.nrofactura,
      vendedora: row.vendedora,
      transporte: row.transporte,
      total: row.total,
      ordenWeb: row.ordenweb,
      totalWeb: row.totalweb,
      instancia: row.instancia,
      estado: row.estado,
      empaquetado: 1,
      cliente: `${row.nombre || ''} ${row.apellido || ''}`.trim(),
      encuesta: row.encuesta,
      comentario: row.comentario,
    }));

    res.json({ tipo, data });
  } catch (error) {
    res.status(500).json({ message: 'Error al listar empaquetados', error: error.message });
  }
});

app.get('/api/transportes', async (_req, res) => {
  try {
    const [rows] = await pool.query('SELECT id_transportes AS id, nombre FROM transportes ORDER BY nombre');
    res.json({ data: rows });
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar transportes', error: error.message });
  }
});

app.patch('/api/paqueteria/transporte', async (req, res) => {
  try {
    const { id, transporte } = req.body || {};
    if (!id) return res.status(400).json({ message: 'Id de pedido requerido' });
    const transporteRaw = String(transporte || '').trim();
    const normalized = transporteRaw.toLowerCase().replace(/\s+/g, '');
    const transporteValue =
      !normalized || normalized === 'sintransporte' ? null : transporteRaw;
    await pool.query('UPDATE controlpedidos SET transporte = ? WHERE id = ? LIMIT 1', [
      transporteValue,
      id,
    ]);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar transporte', error: error.message });
  }
});

app.get('/api/empleados', async (req, res) => {
  try {
    const fecha = req.query.fecha ? parseISODate(req.query.fecha) : new Date();
    const desdeDate = new Date(fecha.getFullYear(), fecha.getMonth(), 1, 0, 0, 0);
    const hastaDate = new Date(fecha.getFullYear(), fecha.getMonth() + 1, 1, 0, 0, 0);
    const desde = formatDateTimeLocal(desdeDate);
    const hasta = formatDateTimeLocal(hastaDate);

    const verTodos = req.query.todos === 'true';
    const term = req.query.q ? `%${req.query.q}%` : null;

    const params = [
      desde,
      hasta, // fichaje
      desde,
      hasta, // no encuestados
      desde,
      hasta, // pedidos por usuario
      desde,
      hasta, // total pedidos
      desde,
      hasta, // ventas por usuario
      desde,
      hasta, // total ventas
    ];
    const filters = [];
    if (!verTodos) filters.push('u.id_roles <> 4');
    if (term) {
      filters.push('u.name LIKE ?');
      params.push(term);
    }
    const whereUsers = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const [rows] = await pool.query(
      `SELECT
         u.id,
         u.name,
         u.hora_ingreso,
         CAST(COALESCE(fa.alertas, 0) AS UNSIGNED) AS alertas,
         CAST(COALESCE(fa.tardes, 0) AS UNSIGNED) AS tardes,
         CAST(COALESCE(ne.noEncuestados, 0) AS UNSIGNED) AS noEncuestados,
         COALESCE(up.pedidos, 0) AS pedidos,
         COALESCE(tp.totalPedidos, 0) AS totalPedidos,
         COALESCE(uv.ventas, 0) AS ventas,
         COALESCE(tv.totalVentas, 0) AS totalVentas,
         CASE
           WHEN COALESCE(tp.totalPedidos, 0) = 0 THEN 0
           ELSE ROUND((COALESCE(up.pedidos, 0) / COALESCE(tp.totalPedidos, 1)) * 100, 1)
         END AS porcentajePedidos,
         CASE
           WHEN COALESCE(tv.totalVentas, 0) = 0 THEN 0
           ELSE ROUND((COALESCE(uv.ventas, 0) / COALESCE(tv.totalVentas, 1)) * 100, 1)
         END AS porcentajeVentas
       FROM users u
       LEFT JOIN (
         SELECT
           fd.id_user,
           CAST(SUM(
             CASE
               WHEN DAYOFWEEK(fd.primera_entrada) = 7 AND TIMEDIFF(TIME(fd.primera_entrada), '09:00:00') BETWEEN '00:00:01' AND '00:05:00' THEN 1
               WHEN DAYOFWEEK(fd.primera_entrada) <> 7 AND TIMEDIFF(TIME(fd.primera_entrada), COALESCE(u2.hora_ingreso, '09:00:00')) BETWEEN '00:00:01' AND '00:05:00' THEN 1
               ELSE 0
             END
           ) AS SIGNED) AS alertas,
           CAST(SUM(
             CASE
               WHEN DAYOFWEEK(fd.primera_entrada) = 7 AND TIMEDIFF(TIME(fd.primera_entrada), '09:00:00') > '00:05:00' THEN 1
               WHEN DAYOFWEEK(fd.primera_entrada) <> 7 AND TIMEDIFF(TIME(fd.primera_entrada), COALESCE(u2.hora_ingreso, '09:00:00')) > '00:05:00' THEN 1
               ELSE 0
             END
           ) AS SIGNED) AS tardes
         FROM (
           SELECT
             f.id_user,
             DATE(f.fecha_ingreso) AS dia_fichaje,
             MIN(f.fecha_ingreso) AS primera_entrada
           FROM fichaje f
           WHERE f.fecha_ingreso >= ?
             AND f.fecha_ingreso < ?
           GROUP BY f.id_user, DATE(f.fecha_ingreso)
         ) fd
        JOIN users u2 ON u2.id = fd.id_user
        GROUP BY fd.id_user
       ) fa ON fa.id_user = u.id
       LEFT JOIN (
         SELECT
           u2.id AS userId,
           COUNT(*) AS noEncuestados
         FROM controlpedidos cp
         INNER JOIN facturah fa2 ON fa2.NroFactura = cp.nrofactura
         INNER JOIN clientes c ON c.id_clientes = fa2.id_clientes
         INNER JOIN vendedores v ON v.nombre = cp.vendedora
         INNER JOIN users u2 ON u2.id_vendedoras = v.id
         WHERE COALESCE(cp.fecha, fa2.fecha) >= ?
           AND COALESCE(cp.fecha, fa2.fecha) < ?
           AND cp.ordenWeb IS NOT NULL
           AND cp.ordenWeb <> 0
           AND c.encuesta = 'Ninguna'
         GROUP BY u2.id
       ) ne ON ne.userId = u.id
       LEFT JOIN (
         SELECT
           u2.id AS userId,
           COUNT(*) AS pedidos
         FROM controlpedidos cp
         JOIN vendedores v ON v.nombre = cp.vendedora
         JOIN users u2 ON u2.id_vendedoras = v.id
         WHERE cp.fecha >= ?
           AND cp.fecha < ?
           AND cp.nrofactura IS NOT NULL
           AND cp.ordenWeb IS NOT NULL
           AND cp.ordenWeb <> 0
         GROUP BY u2.id
       ) up ON up.userId = u.id
       LEFT JOIN (
         SELECT COUNT(*) AS totalPedidos
         FROM controlpedidos cp
         WHERE cp.fecha >= ?
           AND cp.fecha < ?
         AND cp.nrofactura IS NOT NULL
         AND cp.ordenWeb IS NOT NULL
         AND cp.ordenWeb <> 0
       ) tp ON 1=1
       LEFT JOIN (
         SELECT
           u2.id AS userId,
           COUNT(DISTINCT fact.nrofactura) AS ventas
         FROM factura fact
         LEFT JOIN controlpedidos ctrl ON ctrl.nrofactura = fact.nrofactura
         INNER JOIN vendedores v ON v.nombre = fact.vendedora
         INNER JOIN users u2 ON u2.id_vendedoras = v.id
         WHERE fact.fecha >= ?
           AND fact.fecha < ?
           AND (ctrl.nrofactura IS NULL OR ctrl.ordenWeb IS NULL OR ctrl.ordenWeb = 0)
         GROUP BY u2.id
       ) uv ON uv.userId = u.id
       LEFT JOIN (
         SELECT COUNT(DISTINCT fact.nrofactura) AS totalVentas
         FROM facturah fact
         LEFT JOIN controlpedidos ctrl ON ctrl.nrofactura = fact.nrofactura
         inner join samira.vendedores On vendedores.nombre = fact.vendedora
				 inner join samira.users on users.id_vendedoras = vendedores.id
         WHERE fact.fecha >= ?
           AND fact.fecha < ?
           AND (ctrl.nrofactura IS NULL OR ctrl.ordenWeb IS NULL OR ctrl.ordenWeb = 0)
       ) tv ON 1=1
       ${whereUsers}
       ORDER BY u.name`,
      params
    );
     /* console.log('Empleados query', {
       desde,
       hasta,
       verTodos,
       term,
       total: rows.length,
       sample: rows.slice(0, 5),
     }); */

    const data = rows.map((row) => {
      const expectedTime = row.hora_ingreso || expectedDefault || '09:00:00';
      const [h, m, s] = expectedTime.split(':').map((n) => Number(n) || 0);
      const expectedDate = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), h, m, s);
      const firstEntry = row.primeraEntrada ? new Date(row.primeraEntrada) : null;
      let minutosTarde = null;
      let status = 'sin_registro';

      if (firstEntry) {
        const diffMs = firstEntry - expectedDate;
        minutosTarde = Math.max(0, Math.round(diffMs / 60000));
        if (minutosTarde === 0) status = 'a_tiempo';
        else if (minutosTarde <= 5) status = 'amarillo';
        else status = 'rojo';
      }
      
      return {
        id: row.id,
        nombre: row.name,
        horaIngreso: expectedTime,
        registro: firstEntry,
        minutosTarde,
        status,
        alertas: Number(row.alertas) || 0,
        tardes: Number(row.tardes) || 0,
        noEncuestados: Number(row.noEncuestados) || 0,
        pedidos: Number(row.pedidos) || 0,
        totalPedidos: Number(row.totalPedidos) || 0,
        porcentajePedidos: Number(row.porcentajePedidos) || 0,
        ventas: Number(row.ventas) || 0,
        totalVentas: Number(row.totalVentas) || 0,
        porcentajeVentas: Number(row.porcentajeVentas) || 0,
      };
    });

    res.json({ fecha: desde.slice(0, 10), data });
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar empleados', error: error.message });
  }
});

app.get('/api/clientes', async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(5, Number.parseInt(req.query.pageSize, 10) || 10));
    const terms =
      typeof req.query.q === 'string'
        ? req.query.q
            .trim()
            .split(/\s+/)
            .filter(Boolean)
        : [];

    const sortKey = typeof req.query.sort === 'string' ? req.query.sort : null;
    const sortDir = req.query.dir === 'desc' ? 'DESC' : 'ASC';
    const sortMap = {
      nombre: 'c.nombre',
      apellido: 'c.apellido',
      mail: 'c.mail',
      telefono: 'c.telefono',
      updated_at: 'c.updated_at',
      ultimaCompra: 'ult.ultimaCompra',
      cantFacturas: 'COALESCE(fact.cantFacturas, 0)',
      ticketPromedio: 'COALESCE(fact.ticketPromedio, 0)',
    };
    const orderBy = sortKey && sortMap[sortKey] ? `${sortMap[sortKey]} ${sortDir}` : 'c.updated_at DESC';

    const filters = ['c.id_clientes <> 1'];
    const params = [];
    if (terms.length) {
      terms.forEach((t) => {
        const like = `%${t}%`;
        filters.push(
          '(c.nombre LIKE ? OR c.apellido LIKE ? OR c.mail LIKE ? OR c.telefono LIKE ? OR c.apodo LIKE ?)'
        );
        params.push(like, like, like, like, like);
      });
    }
    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    const [[countRow]] = await pool.query(
      `SELECT COUNT(*) AS total FROM clientes c ${where}`,
      params
    );
    const total = Number(countRow.total) || 0;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, totalPages);
    const offset = (safePage - 1) * pageSize;

    const [rows] = await pool.query(
      `SELECT
         c.id_clientes AS id,
         c.nombre,
         c.apellido,
         c.mail,
         c.telefono,
         c.encuesta,
         c.updated_at,
         ult.ultimaCompra,
         COALESCE(fact.cantFacturas, 0) AS cantFacturas,
         COALESCE(fact.ticketPromedio, 0) AS ticketPromedio
       FROM clientes c
       LEFT JOIN (
         SELECT
           id_clientes,
           COUNT(*) AS cantFacturas,
           SUM(COALESCE(Total, 0)) AS sumFacturas,
           CASE WHEN COUNT(*) > 0 THEN SUM(COALESCE(Total, 0)) / COUNT(*) ELSE 0 END AS ticketPromedio
         FROM facturah
         GROUP BY id_clientes
       ) fact ON fact.id_clientes = c.id_clientes
       LEFT JOIN (
         SELECT id_clientes, MAX(fecha) AS ultimaCompra
         FROM facturah
         GROUP BY id_clientes
       ) ult ON ult.id_clientes = c.id_clientes
       ${where}
       ORDER BY ${orderBy}
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    res.json({
      page: safePage,
      pageSize,
      total,
      totalPages,
      data: rows,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar clientes', error: error.message });
  }
});

app.get('/api/clientes/encuesta', requireAuth, async (req, res) => {
  try {
    const idCliente = Number.parseInt(req.query.id_cliente, 10);
    if (!idCliente) return res.status(400).json({ message: 'id_cliente requerido' });
    const [rows] = await pool.query(
      `SELECT
         nombre,
         apellido,
         COALESCE(NULLIF(TRIM(encuesta), ''), 'Ninguna') AS encuesta
       FROM clientes
       WHERE id_clientes = ?
       LIMIT 1`,
      [idCliente]
    );
    const row = rows?.[0];
    if (!row) return res.status(404).json({ message: 'Cliente no encontrado' });
    res.json({
      id_cliente: idCliente,
      nombre: row.nombre || '',
      apellido: row.apellido || '',
      encuesta: row.encuesta || 'Ninguna',
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar encuesta', error: error.message });
  }
});

app.patch('/api/clientes/encuesta', requireAuth, async (req, res) => {
  try {
    const { id_cliente, encuesta } = req.body || {};
    const idCliente = Number.parseInt(id_cliente, 10);
    if (!idCliente) return res.status(400).json({ message: 'id_cliente requerido' });
    const encuestaValue = String(encuesta || '').trim();
    await pool.query(
      'UPDATE clientes SET encuesta = ? WHERE id_clientes = ? LIMIT 1',
      [encuestaValue, idCliente]
    );
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: 'Error al guardar encuesta', error: error.message });
  }
});

function normalizeClientesReporteCorte(value) {
  const raw = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return formatDateLocal(new Date());
}

function getClientesReporteMonthEnds(corte, count = 12) {
  const [year, month, day] = String(corte).split('-').map((value) => Number(value));
  const base = new Date(year, month - 1, day || 1);
  const months = [];
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const d = new Date(base.getFullYear(), base.getMonth() - offset + 1, 0);
    const isCurrentCutoffMonth =
      d.getFullYear() === base.getFullYear() && d.getMonth() === base.getMonth();
    months.push({
      label: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      corte: isCurrentCutoffMonth ? formatDateLocal(base) : formatDateLocal(d),
    });
  }
  return months;
}

function toClientesReporteDateKey(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return formatDateLocal(value);
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return formatDateLocal(date);
}

function diffClientesReporteDays(corte, fecha) {
  const corteKey = toClientesReporteDateKey(corte);
  const fechaKey = toClientesReporteDateKey(fecha);
  if (!corteKey || !fechaKey) return null;
  const corteDate = parseISODate(corteKey);
  const fechaDate = parseISODate(fechaKey);
  return Math.max(0, Math.floor((corteDate.getTime() - fechaDate.getTime()) / 86400000));
}

function findClientesReporteLastDateOnOrBefore(dates = [], corte) {
  let left = 0;
  let right = dates.length - 1;
  let match = null;
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    if (dates[mid] <= corte) {
      match = dates[mid];
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }
  return match;
}

function buildClientesReporteFidelizacionSnapshot(rows = [], corte) {
  let latest = null;
  let ultimaConversion = null;
  rows.forEach((row) => {
    const createdAt = toClientesReporteDateKey(row.created_at);
    const convertedAt = toClientesReporteDateKey(row.converted_at);
    if (createdAt && createdAt <= corte) {
      if (!latest || Number(row.id) > Number(latest.id)) latest = row;
    }
    if (convertedAt && convertedAt <= corte && (!ultimaConversion || convertedAt > ultimaConversion)) {
      ultimaConversion = convertedAt;
    }
  });
  return {
    fidelizacionEstado: latest?.estado || '',
    fidelizacionResultado: latest?.resultado || '',
    fidelizacionFecha: latest?.created_at || null,
    fidelizacionCerradaFecha: latest?.closed_at || null,
    fidelizacionConvertidaFecha: latest?.converted_at || null,
    fidelizacionUltimaConversion: ultimaConversion || null,
  };
}

const CLIENTES_REPORTE_TIPOS_VENTA = {
  GENERAL: 'general',
  PEDIDOS: 'pedidos',
  LOCAL: 'local',
};

function normalizeClientesReporteTipoVenta(value) {
  const tipo = String(value || '').trim().toLowerCase();
  if (Object.values(CLIENTES_REPORTE_TIPOS_VENTA).includes(tipo)) return tipo;
  return CLIENTES_REPORTE_TIPOS_VENTA.GENERAL;
}

function getClientesReporteTipoVentaSql(tipoVenta, facturaAlias = 'f') {
  if (tipoVenta === CLIENTES_REPORTE_TIPOS_VENTA.PEDIDOS) {
    return `AND EXISTS (
      SELECT 1
      FROM controlpedidos cp_web
      WHERE cp_web.nrofactura = ${facturaAlias}.NroFactura
        AND cp_web.ordenWeb IS NOT NULL
        AND cp_web.ordenWeb <> 0
    )`;
  }
  if (tipoVenta === CLIENTES_REPORTE_TIPOS_VENTA.LOCAL) {
    return `AND NOT EXISTS (
      SELECT 1
      FROM controlpedidos cp_web
      WHERE cp_web.nrofactura = ${facturaAlias}.NroFactura
        AND cp_web.ordenWeb IS NOT NULL
        AND cp_web.ordenWeb <> 0
    )`;
  }
  return '';
}

app.get('/api/clientes/reportes/estado', requireAuth, async (req, res) => {
  try {
    const corte = normalizeClientesReporteCorte(req.query.corte);
    const tipoVenta = normalizeClientesReporteTipoVenta(req.query.tipoVenta);
    const tipoVentaSql = getClientesReporteTipoVentaSql(tipoVenta, 'f');
    const estadoFilter = String(req.query.estado || '').trim();
    const vendedoraFilter = String(req.query.vendedora || '').trim();
    const localidadFilter = String(req.query.localidad || '').trim();
    const provinciaFilter = String(req.query.provincia || '').trim();
    const terms =
      typeof req.query.q === 'string'
        ? req.query.q
            .trim()
            .split(/\s+/)
            .filter(Boolean)
        : [];

    const filters = ['c.id_clientes <> 1', '(c.created_at IS NULL OR c.created_at < DATE_ADD(?, INTERVAL 1 DAY))'];
    const params = [corte];
    terms.forEach((term) => {
      const like = `%${term}%`;
      filters.push(
        '(c.nombre LIKE ? OR c.apellido LIKE ? OR c.mail LIKE ? OR c.telefono LIKE ? OR c.apodo LIKE ?)'
      );
      params.push(like, like, like, like, like);
    });
    if (localidadFilter) {
      filters.push('c.localidad = ?');
      params.push(localidadFilter);
    }
    if (provinciaFilter) {
      filters.push('p.nombre = ?');
      params.push(provinciaFilter);
    }
    if (vendedoraFilter) {
      filters.push('COALESCE(vend.vendedoraFrecuente, "") = ?');
      params.push(vendedoraFilter);
    }
    const where = `WHERE ${filters.join(' AND ')}`;

    const [rawRows] = await pool.query(
      `SELECT
         c.id_clientes AS id,
         c.nombre,
         c.apellido,
         c.apodo,
         c.mail,
         c.telefono,
         c.localidad,
         COALESCE(p.nombre, '') AS provincia,
         agg.ultimaCompra,
         agg.diasSinComprar,
         COALESCE(agg.cantComprasHistorico, 0) AS cantComprasHistorico,
         COALESCE(agg.compras12m, 0) AS compras12m,
         COALESCE(agg.monto12m, 0) AS monto12m,
         COALESCE(agg.montoHistorico, 0) AS montoHistorico,
         COALESCE(vend.vendedoraFrecuente, '') AS vendedoraFrecuente
       FROM clientes c
       LEFT JOIN provincias p ON p.id = c.id_provincia
       LEFT JOIN (
         SELECT
           f.id_clientes,
           DATE(MAX(f.Fecha)) AS ultimaCompra,
           DATEDIFF(?, DATE(MAX(f.Fecha))) AS diasSinComprar,
           COUNT(*) AS cantComprasHistorico,
           SUM(CASE WHEN f.Fecha >= DATE_SUB(?, INTERVAL 12 MONTH) THEN 1 ELSE 0 END) AS compras12m,
           SUM(CASE WHEN f.Fecha >= DATE_SUB(?, INTERVAL 12 MONTH) THEN COALESCE(f.Total, 0) ELSE 0 END) AS monto12m,
           SUM(COALESCE(f.Total, 0)) AS montoHistorico
         FROM facturah f
         WHERE f.id_clientes IS NOT NULL
           AND f.Fecha < DATE_ADD(?, INTERVAL 1 DAY)
           ${tipoVentaSql}
         GROUP BY f.id_clientes
       ) agg ON agg.id_clientes = c.id_clientes
       LEFT JOIN (
         SELECT
           ranked.id_clientes,
           SUBSTRING_INDEX(
             GROUP_CONCAT(ranked.vendedora ORDER BY ranked.cantidad DESC, ranked.vendedora ASC SEPARATOR '||'),
             '||',
             1
           ) AS vendedoraFrecuente
         FROM (
           SELECT
             f.id_clientes,
             TRIM(f.vendedora) AS vendedora,
             COUNT(*) AS cantidad
           FROM facturah f
           WHERE f.id_clientes IS NOT NULL
             AND f.Fecha < DATE_ADD(?, INTERVAL 1 DAY)
             ${tipoVentaSql}
             AND f.vendedora IS NOT NULL
             AND TRIM(f.vendedora) <> ''
           GROUP BY f.id_clientes, TRIM(f.vendedora)
         ) ranked
         GROUP BY ranked.id_clientes
       ) vend ON vend.id_clientes = c.id_clientes
       ${where}
       ORDER BY
         CASE WHEN agg.ultimaCompra IS NULL THEN 1 ELSE 0 END ASC,
         agg.ultimaCompra DESC,
         c.nombre ASC,
         c.apellido ASC`,
      [corte, corte, corte, corte, corte, ...params]
    );

    const rows = rawRows.map(enrichClienteReporteRow);
    const filteredRows = estadoFilter ? rows.filter((row) => row.estado === estadoFilter) : rows;
    const resumen = buildClientesResumen(rows);
    const recuperacion = rows
      .filter((row) => row.estado === CLIENTE_ESTADOS.EN_RIESGO || row.estado === CLIENTE_ESTADOS.INACTIVO)
      .sort((a, b) => Number(b.montoHistorico || 0) - Number(a.montoHistorico || 0));
    const frecuenciaBaja = rows
      .filter((row) => row.estado === CLIENTE_ESTADOS.BAJA_FRECUENCIA)
      .sort((a, b) => Number(b.monto12m || 0) - Number(a.monto12m || 0));
    const unique = (key) =>
      Array.from(new Set(rows.map((row) => String(row[key] || '').trim()).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b)
      );

    res.json({
      corte,
      tipoVenta,
      estados: Object.values(CLIENTE_ESTADOS),
      resumen,
      data: filteredRows,
      recuperacion,
      frecuenciaBaja,
      filtros: {
        vendedoras: unique('vendedoraFrecuente'),
        localidades: unique('localidad'),
        provincias: unique('provincia'),
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar reporte de clientes', error: error.message });
  }
});

app.get('/api/clientes/reportes/evolucion', requireAuth, async (req, res) => {
  try {
    const corte = normalizeClientesReporteCorte(req.query.corte);
    const tipoVenta = normalizeClientesReporteTipoVenta(req.query.tipoVenta);
    const tipoVentaSql = getClientesReporteTipoVentaSql(tipoVenta, 'f');
    const months = getClientesReporteMonthEnds(corte, 12);
    const data = [];
    const snapshots = [];

    const [clientesRows] = await pool.query(
      `SELECT
         c.id_clientes AS id,
         c.nombre,
         c.apellido,
         c.mail,
         c.telefono,
         c.created_at
       FROM clientes c
       WHERE c.id_clientes <> 1
         AND (c.created_at IS NULL OR c.created_at < DATE_ADD(?, INTERVAL 1 DAY))`,
      [corte]
    );
    const [facturasRows] = await pool.query(
      `SELECT
         f.id_clientes AS id,
         DATE(f.Fecha) AS fecha
       FROM facturah f
       WHERE f.id_clientes IS NOT NULL
         AND f.Fecha < DATE_ADD(?, INTERVAL 1 DAY)
         ${tipoVentaSql}
       ORDER BY f.id_clientes ASC, f.Fecha ASC`,
      [corte]
    );
    const [fidelizacionRows] = await pool.query(
      `SELECT
         id,
         cliente_id,
         estado,
         resultado,
         created_at,
         closed_at,
         converted_at
       FROM fidelizacion_recomendacion
       WHERE created_at < DATE_ADD(?, INTERVAL 1 DAY)
          OR converted_at < DATE_ADD(?, INTERVAL 1 DAY)
       ORDER BY cliente_id ASC, created_at ASC, id ASC`,
      [corte, corte]
    );
    const facturasByCliente = new Map();
    facturasRows.forEach((row) => {
      const id = Number(row.id);
      const fecha = toClientesReporteDateKey(row.fecha);
      if (!id || !fecha) return;
      if (!facturasByCliente.has(id)) facturasByCliente.set(id, []);
      facturasByCliente.get(id).push(fecha);
    });
    const fidelizacionByCliente = new Map();
    fidelizacionRows.forEach((row) => {
      const id = Number(row.cliente_id);
      if (!id) return;
      if (!fidelizacionByCliente.has(id)) fidelizacionByCliente.set(id, []);
      fidelizacionByCliente.get(id).push(row);
    });

    for (const item of months) {
      const counts = Object.fromEntries(Object.values(CLIENTE_ESTADOS).map((estado) => [estado, 0]));
      const clientes = clientesRows
        .filter((cliente) => {
          const createdAt = toClientesReporteDateKey(cliente.created_at);
          return !createdAt || createdAt <= item.corte;
        })
        .map((cliente) => {
          const id = Number(cliente.id);
          const ultimaCompra = findClientesReporteLastDateOnOrBefore(facturasByCliente.get(id) || [], item.corte);
          return enrichClienteReporteRow({
            ...cliente,
            ultimaCompra,
            diasSinComprar: diffClientesReporteDays(item.corte, ultimaCompra),
            ...buildClientesReporteFidelizacionSnapshot(fidelizacionByCliente.get(id) || [], item.corte),
          });
        });
      clientes.forEach((row) => {
        counts[row.estado] = (counts[row.estado] || 0) + 1;
      });
      snapshots.push({ ...item, clientes });
      data.push({ mes: item.label, corte: item.corte, ...counts });
    }

    const transitions = [];
    for (let idx = 1; idx < snapshots.length; idx += 1) {
      const prev = snapshots[idx - 1];
      const current = snapshots[idx];
      const prevById = new Map(prev.clientes.map((row) => [Number(row.id), row]));
      const currentById = new Map(current.clientes.map((row) => [Number(row.id), row]));
      const detail = {};
      Object.values(CLIENTE_ESTADOS).forEach((estado) => {
        detail[estado] = {
          desde: Object.fromEntries(Object.values(CLIENTE_ESTADOS).map((key) => [key, 0])),
          hacia: Object.fromEntries(Object.values(CLIENTE_ESTADOS).map((key) => [key, 0])),
          permanecen: 0,
          clientes: [],
          salidas: [],
        };
      });

      current.clientes.forEach((row) => {
        const prevRow = prevById.get(Number(row.id));
        const from = prevRow?.estado || CLIENTE_ESTADOS.SIN_COMPRAS;
        const to = row.estado || CLIENTE_ESTADOS.SIN_COMPRAS;
        if (!detail[to]) return;
        detail[to].desde[from] = (detail[to].desde[from] || 0) + 1;
        if (from === to) detail[to].permanecen += 1;
        detail[to].clientes.push({
          id: Number(row.id) || 0,
          cliente: `${row.nombre || ''} ${row.apellido || ''}`.trim() || row.apodo || 'Cliente',
          email: row.mail || '',
          telefono: row.telefono || '',
          ultimaCompra: row.ultimaCompra || null,
          diasSinComprar: row.diasSinComprar,
          fidelizacionEstado: row.fidelizacionEstado || '',
          fidelizacionResultado: row.fidelizacionResultado || '',
          fidelizacionFecha: row.fidelizacionFecha || null,
          fidelizacionCerradaFecha: row.fidelizacionCerradaFecha || null,
          fidelizacionConvertidaFecha: row.fidelizacionConvertidaFecha || null,
          fidelizacionUltimaConversion: row.fidelizacionUltimaConversion || null,
          from,
          to,
        });
      });

      prev.clientes.forEach((row) => {
        const currentRow = currentById.get(Number(row.id));
        const from = row.estado || CLIENTE_ESTADOS.SIN_COMPRAS;
        const to = currentRow?.estado || CLIENTE_ESTADOS.SIN_COMPRAS;
        if (!detail[from]) return;
        detail[from].hacia[to] = (detail[from].hacia[to] || 0) + 1;
        detail[from].salidas.push({
          id: Number(row.id) || 0,
          cliente: `${row.nombre || ''} ${row.apellido || ''}`.trim() || row.apodo || 'Cliente',
          email: row.mail || '',
          telefono: row.telefono || '',
          ultimaCompra: currentRow?.ultimaCompra || row.ultimaCompra || null,
          diasSinComprar: currentRow?.diasSinComprar ?? row.diasSinComprar,
          fidelizacionEstado:
            currentRow?.fidelizacionEstado || row.fidelizacionEstado || '',
          fidelizacionResultado:
            currentRow?.fidelizacionResultado || row.fidelizacionResultado || '',
          fidelizacionFecha:
            currentRow?.fidelizacionFecha || row.fidelizacionFecha || null,
          fidelizacionCerradaFecha:
            currentRow?.fidelizacionCerradaFecha || row.fidelizacionCerradaFecha || null,
          fidelizacionConvertidaFecha:
            currentRow?.fidelizacionConvertidaFecha || row.fidelizacionConvertidaFecha || null,
          fidelizacionUltimaConversion:
            currentRow?.fidelizacionUltimaConversion || row.fidelizacionUltimaConversion || null,
          from,
          to,
        });
      });

      transitions.push({
        mes: current.label,
        corte: current.corte,
        mesAnterior: prev.label,
        corteAnterior: prev.corte,
        detail,
      });
    }

    res.json({ corte, tipoVenta, data, transitions });
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar evolucion de clientes', error: error.message });
  }
});

app.get('/api/empleados/tardes', async (req, res) => {
  try {
    const userId = Number.parseInt(req.query.userId, 10);
    if (!userId) return res.status(400).json({ message: 'userId requerido' });
    const now = new Date();
    const year = Number.isFinite(Number(req.query.year)) ? Number(req.query.year) : now.getUTCFullYear();
    const month = Number.isFinite(Number(req.query.month)) ? Number(req.query.month) : now.getUTCMonth() + 1; // 1-based para SQL

    const [[userRow]] = await pool.query('SELECT id, name, hora_ingreso FROM users WHERE id = ? LIMIT 1', [
      userId,
    ]);
    if (!userRow) return res.status(404).json({ message: 'Usuario no encontrado' });

    // Consulta inspirada en la referencia proporcionada
    const [rows] = await pool.query(
      `SELECT
         t.diaNum,
         t.diaStr,
         t.primeraEntrada,
         t.comentario,
         CASE
           WHEN DAYOFWEEK(t.diaStr) = 7 AND TIMEDIFF(TIME(t.primeraEntrada), '09:00:00') > '00:05:00' THEN 1
           WHEN DAYOFWEEK(t.diaStr) = 7 AND TIMEDIFF(TIME(t.primeraEntrada), '09:00:00') > '00:00:01' AND TIMEDIFF(TIME(t.primeraEntrada), '09:00:00') < '00:05:00' THEN 2
           WHEN DAYOFWEEK(t.diaStr) <> 7 AND TIMEDIFF(TIME(t.primeraEntrada), t.horaIngresoRef) > '00:05:00' THEN 1
           WHEN DAYOFWEEK(t.diaStr) <> 7 AND TIMEDIFF(TIME(t.primeraEntrada), t.horaIngresoRef) > '00:00:01' AND TIMEDIFF(TIME(t.primeraEntrada), t.horaIngresoRef) < '00:05:00' THEN 2
           ELSE 0
         END AS fichaje,
         GREATEST(
           0,
           TIMESTAMPDIFF(
             SECOND,
             CASE WHEN DAYOFWEEK(t.diaStr) = 7
                  THEN CAST(CONCAT(t.diaStr, ' 09:00:00') AS DATETIME)
                  ELSE CAST(CONCAT(t.diaStr, ' ', t.horaIngresoRef) AS DATETIME)
             END,
             t.primeraEntrada
           )
         ) AS diffSeconds
       FROM (
         SELECT
           DATE(f.fecha_ingreso) AS diaStr,
           DAY(f.fecha_ingreso) AS diaNum,
           MIN(f.fecha_ingreso) AS primeraEntrada,
           COALESCE(MAX(u.hora_ingreso), '09:00:00') AS horaIngresoRef,
           MAX(f.Comentarios) AS comentario
         FROM fichaje f
         INNER JOIN users u ON u.id = f.id_user
         WHERE f.id_user = ?
           AND YEAR(f.fecha_ingreso) = ?
           AND MONTH(f.fecha_ingreso) = ?
         GROUP BY DATE(f.fecha_ingreso), DAY(f.fecha_ingreso)
       ) t
       ORDER BY t.diaStr ASC`,
      [userId, year, month]
    );

    const entradasMap = new Map();
    rows.forEach((r) => {
      const key =
        typeof r.diaStr === 'string'
          ? r.diaStr
          : r.diaStr instanceof Date
          ? r.diaStr.toISOString().slice(0, 10)
          : String(r.diaStr);
      let status = 'sin_registro';
      if (r.fichaje === 0) status = 'a_tiempo';
      else if (r.fichaje === 2) status = 'amarillo';
      else if (r.fichaje === 1) status = 'rojo';
      const minutos = r.diffSeconds != null ? Math.ceil(Math.max(0, Number(r.diffSeconds) || 0) / 60) : null;
      entradasMap.set(key, { status, minutos, comentario: r.comentario || '' });
    });

    const daysInMonth = new Date(year, month, 0).getDate();
    const dias = [];
    for (let d = 1; d <= daysInMonth; d += 1) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const entry = entradasMap.get(dateStr);
      if (entry) {
        dias.push({ dia: d, status: entry.status, minutos: entry.minutos, comentario: entry.comentario || '' });
      } else {
        dias.push({ dia: d, status: 'sin_registro', minutos: null, comentario: '' });
      }
    }

    res.json({ userId, year, month, dias });
  } catch (error) {
    console.error('Error /api/empleados/tardes', error);
    res.status(500).json({ message: 'Error al cargar llegadas', error: error.message });
  }
});

app.put('/api/empleados/tardes/comentario', async (req, res) => {
  try {
    const userId = Number.parseInt(req.body.userId, 10);
    const comentario = req.body.comentario || '';
    if (!userId) return res.status(400).json({ message: 'userId requerido' });
    if (!req.body.fecha) return res.status(400).json({ message: 'fecha requerida' });
    const fecha = parseISODate(req.body.fecha);
    const fechaStr = fecha.toISOString().slice(0, 10);

    await pool.query('UPDATE fichaje SET Comentarios = ? WHERE id_user = ? AND DATE(fecha_ingreso) = ?', [
      comentario,
      userId,
      fechaStr,
    ]);

    res.json({ ok: true, fecha: fechaStr, comentario });
  } catch (error) {
    res.status(500).json({ message: 'Error al guardar comentario', error: error.message });
  }
});

app.get('/api/empleados/no-encuestados', async (req, res) => {
  try {
    const userId = Number.parseInt(req.query.userId, 10);
    if (!userId) return res.status(400).json({ message: 'userId requerido' });

    const fechaParam = req.query.fecha ? parseISODate(req.query.fecha) : new Date();
    const desdeDate = new Date(fechaParam.getFullYear(), fechaParam.getMonth(), 1, 0, 0, 0);
    const hastaDate = new Date(fechaParam.getFullYear(), fechaParam.getMonth() + 1, 1, 0, 0, 0);
    const desde = formatDateTimeLocal(desdeDate);
    const hasta = formatDateTimeLocal(hastaDate);

    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(5, Number.parseInt(req.query.pageSize, 10) || 10));
    const offset = (page - 1) * pageSize;
    const term = req.query.q ? `%${req.query.q}%` : null;

    const filters = [
      'u.id = ?',
      'COALESCE(cp.fecha, fa.fecha) >= ?',
      'COALESCE(cp.fecha, fa.fecha) < ?',
      'cp.ordenWeb IS NOT NULL',
      'cp.ordenWeb <> 0',
      "c.encuesta = 'Ninguna'",
    ];
    const params = [userId, desde, hasta];
    if (term) {
      filters.push(
        '(cp.nropedido LIKE ? OR c.nombre LIKE ? OR c.apellido LIKE ? OR cp.vendedora LIKE ? OR c.encuesta LIKE ?)'
      );
      params.push(term, term, term, term, term);
    }
    const where = filters.join(' AND ');

    const [[countRow]] = await safeQuery(
      `SELECT COUNT(*) AS total
       FROM controlpedidos cp
       INNER JOIN facturah fa ON fa.NroFactura = cp.nrofactura
       INNER JOIN clientes c ON c.id_clientes = fa.id_clientes
       INNER JOIN vendedores v ON v.nombre = cp.vendedora
       INNER JOIN users u ON u.id_vendedoras = v.id
       WHERE ${where}`,
      params
    );

    const total = Number(countRow.total) || 0;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, totalPages);
    const safeOffset = (safePage - 1) * pageSize;

    const dataParams = params.slice();
    dataParams.push(pageSize, safeOffset);

    const [rows] = await safeQuery(
      `SELECT
         cp.nropedido,
         c.nombre,
         c.apellido,
         COALESCE(cp.fecha, fa.fecha) AS fechaPedido,
         cp.vendedora,
         c.encuesta
       FROM controlpedidos cp
       INNER JOIN facturah fa ON fa.NroFactura = cp.nrofactura
       INNER JOIN clientes c ON c.id_clientes = fa.id_clientes
       INNER JOIN vendedores v ON v.nombre = cp.vendedora
       INNER JOIN users u ON u.id_vendedoras = v.id
       WHERE ${where}
       ORDER BY COALESCE(cp.fecha, fa.fecha) DESC
       LIMIT ? OFFSET ?`,
      dataParams
    );

    res.json({
      page: safePage,
      pageSize,
      total,
      totalPages,
      data: rows,
      fechaDesde: desde.slice(0, 10),
      fechaHasta: new Date(hastaDate.getTime() - 1).toISOString().slice(0, 10),
    });
  } catch (error) {
    console.error('Error /api/empleados/no-encuestados', error);
    res.status(500).json({ message: 'Error al cargar no encuestados', error: error.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ message: 'Email y contraseña son requeridos' });
    }

    const roleColumn = await getUserRoleColumn();
    const selectCols = roleColumn
      ? `id, name, email, password, id_roles, ${roleColumn}`
      : 'id, name, email, password, id_roles';
    const [rows] = await safeQuery(`SELECT ${selectCols} FROM users WHERE email = ? LIMIT 1`, [email]);
    const user = rows[0];
    if (!user) {
      console.warn('[login] usuario no encontrado', email);
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    const match = await bcrypt.compare(password, user.password || '');
    if (!match) {
      console.warn('[login] contraseña inválida', email);
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    let userRole = roleColumn ? user[roleColumn] : '';
    if (!userRole) {
      userRole = await getUserRoleNameById(user.id);
    }
    const token = signToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: userRole || '',
      iat: Date.now(),
    });
    setAuthCookie(res, token, req);
    res.json({ ok: true, user: { id: user.id, name: user.name, email: user.email, role: userRole || '' } });
  } catch (error) {
    console.error('[login] error', error);
    res.status(500).json({ message: 'Error al iniciar sesión', error: error.message, code: error.code });
  }
});

app.post('/api/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

app.use('/api', (req, res, next) => {
  if (
    req.path === '/login' ||
    req.path === '/health' ||
    req.path === '/artisinc' ||
    req.path === '/inArtisinc' ||
    req.path.startsWith('/public/') ||
    req.path.startsWith('/fichaje')
  ) {
    return next();
  }
  const syncJobMatch = req.path.match(/^\/tiendanubesincroArticulos\/job\/([^/]+)$/);
  const importJobMatch = req.path.match(/^\/ecommerce\/panel\/import\/([^/]+)$/);
  const jobMatch = syncJobMatch || importJobMatch;
  if (req.method === 'GET' && jobMatch && verifyEcommerceJobToken(jobMatch[1], req.query.job_token)) {
    return next();
  }
  if (req.path.startsWith('/ecommerce') || req.path.startsWith('/tiendanubesincroArticulos')) {
    return requireAuthKeepAlive(req, res, next);
  }
  return requireAuth(req, res, next); 
});

app.get('/api/fichaje/empleado', async (req, res) => {
  try {
    const codigo = String(req.query.codigo || '').trim();
    if (!codigo) {
      return res.status(400).json({ ok: false, message: 'Codigo requerido', empleado: null });
    }

    const empleado = await findEmployeeByCode(codigo);
    if (!empleado) {
      return res.status(404).json({ ok: false, message: 'Empleado no encontrado', empleado: null });
    }

    return res.json({
      ok: true,
      message: 'Empleado encontrado',
      empleado: {
        id: empleado.id,
        name: empleado.name,
        fotoUrl: empleado.fotoUrl || null,
      },
    });
  } catch (error) {
    const status = error?.code === 'FICHAJE_CODIGO_COLUMN_MISSING' ? 500 : 500;
    return res.status(status).json({
      ok: false,
      message:
        error?.code === 'FICHAJE_CODIGO_COLUMN_MISSING'
          ? 'La configuración de fichaje no está disponible en esta base.'
          : 'No se pudo consultar el empleado',
      empleado: null,
      error: error.message,
    });
  }
});

async function processFichajeAction(action, codigo) {
  const normalizedAction = action === 'egreso' ? 'egreso' : 'ingreso';
  const normalizedCode = String(codigo || '').trim();
  if (!normalizedCode) {
    return {
      httpStatus: 400,
      payload: buildFichajeApiResponse({
        ok: false,
        status: 'invalid_request',
        message: 'Codigo requerido',
      }),
    };
  }

  const conn = await pool.getConnection();
  let transactionStarted = false;
  try {
    await conn.beginTransaction();
    transactionStarted = true;

    const empleado = await findEmployeeByCode(normalizedCode, conn);
    if (!empleado) {
      await conn.rollback();
      return {
        httpStatus: 404,
        payload: buildFichajeApiResponse({
          ok: false,
          status: 'not_found',
          message: 'Empleado no encontrado',
        }),
      };
    }

    const now = new Date();
    const nowSql = formatDateTimeLocal(now);
    const dayBounds = buildDayBounds(now);

    if (normalizedAction === 'ingreso') {
      const fichajeAbierto = await findOpenFichajeForToday(empleado.id, conn, dayBounds, true);
      if (fichajeAbierto) {
        const diffMs = now.getTime() - new Date(fichajeAbierto.fecha_ingreso).getTime();
        const isDuplicate = diffMs <= FICHAJE_IDEMPOTENCY_WINDOW_MS;
        await conn.commit();
        transactionStarted = false;
        return {
          httpStatus: isDuplicate ? 200 : 409,
          payload: buildFichajeApiResponse({
            ok: isDuplicate,
            status: isDuplicate ? 'duplicate_ignored' : 'already_open',
            message:
              isDuplicate
                ? 'Ingreso ya registrado hace instantes.'
                : 'Ya existe un ingreso abierto para hoy.',
            empleado,
            fichaje: fichajeAbierto,
          }),
        };
      }

      const [result] = await conn.query(
        `INSERT INTO fichaje (fecha_ingreso, id_user)
         VALUES (?, ?)`,
        [nowSql, empleado.id]
      );
      const created = {
        id_fichaje: result.insertId,
        fecha_ingreso: nowSql,
        fecha_egreso: null,
      };
      await conn.commit();
      transactionStarted = false;
      return {
        httpStatus: 200,
        payload: buildFichajeApiResponse({
          ok: true,
          status: 'created',
          message: 'Ingreso registrado correctamente.',
          empleado,
          fichaje: created,
        }),
      };
    }

    const fichajeAbierto = await findOpenFichajeForToday(empleado.id, conn, dayBounds, true);
    if (fichajeAbierto) {
      await conn.query(
        `UPDATE fichaje
         SET fecha_egreso = ?
         WHERE id_fichaje = ?
         LIMIT 1`,
        [nowSql, fichajeAbierto.id_fichaje]
      );
      const updated = {
        ...fichajeAbierto,
        fecha_egreso: nowSql,
      };
      await conn.commit();
      transactionStarted = false;
      return {
        httpStatus: 200,
        payload: buildFichajeApiResponse({
          ok: true,
          status: 'updated',
          message: 'Egreso registrado correctamente.',
          empleado,
          fichaje: updated,
        }),
      };
    }

    const fichajeReciente = await findRecentFichajeAction(empleado.id, 'egreso', conn, now, true);
    if (fichajeReciente) {
      await conn.commit();
      transactionStarted = false;
      return {
        httpStatus: 200,
        payload: buildFichajeApiResponse({
          ok: true,
          status: 'duplicate_ignored',
          message: 'Egreso ya registrado hace instantes.',
          empleado,
          fichaje: fichajeReciente,
        }),
      };
    }

    await conn.commit();
    transactionStarted = false;
    return {
      httpStatus: 409,
      payload: buildFichajeApiResponse({
        ok: false,
        status: 'no_open_shift',
        message: 'No hay un ingreso pendiente para cerrar hoy.',
        empleado,
      }),
    };
  } catch (error) {
    if (transactionStarted) {
      try {
        await conn.rollback();
      } catch (_rollbackError) {
        /* ignore */
      }
    }
    if (error?.code === 'FICHAJE_CODIGO_COLUMN_MISSING') {
      return {
        httpStatus: 500,
        payload: buildFichajeApiResponse({
          ok: false,
          status: 'config_error',
          message: 'La configuración de fichaje no está disponible en esta base.',
        }),
      };
    }
    throw error;
  } finally {
    conn.release();
  }
}

app.post('/api/fichaje/ingreso', async (req, res) => {
  try {
    const result = await processFichajeAction('ingreso', req.body?.codigo);
    res.status(result.httpStatus).json(result.payload);
  } catch (error) {
    res.status(500).json(
      buildFichajeApiResponse({
        ok: false,
        status: 'server_error',
        message: 'No se pudo registrar el ingreso.',
        empleado: null,
      })
    );
  }
});

app.post('/api/fichaje/egreso', async (req, res) => {
  try {
    const result = await processFichajeAction('egreso', req.body?.codigo);
    res.status(result.httpStatus).json(result.payload);
  } catch (error) {
    res.status(500).json(
      buildFichajeApiResponse({
        ok: false,
        status: 'server_error',
        message: 'No se pudo registrar el egreso.',
        empleado: null,
      })
    );
  }
});

app.get('/api/me', (req, res) => {
  const cookies = parseCookies(req);
  const token = cookies.auth_token;
  const payload = token && verifyToken(token);
  if (!payload) {
    return res.status(401).json({ message: 'No autorizado' });
  }
  const local = String(process.env.LOCAL || '').trim().toLowerCase();
  (async () => {
    let role = payload.role || '';
    if (!role) {
      role = await getUserRoleNameById(payload.id);
    }
    let permissions = {};
    try {
      const [rows] = await pool.query(
        `SELECT rp.permiso, rp.habilitado
         FROM RolesPermisos rp
         INNER JOIN users u ON u.id_roles = rp.id_roles
         WHERE u.id = ?`,
        [payload.id]
      );
      permissions = (rows || []).reduce((acc, row) => {
        acc[row.permiso] = !!row.habilitado;
        return acc;
      }, {});
      const hasDashboardSubPerms = DASHBOARD_REPORT_PERMISSIONS.some((permission) =>
        Object.prototype.hasOwnProperty.call(permissions, permission)
      );
      normalizeDashboardPermissions(permissions, hasDashboardSubPerms);
      const hasEcommerceSubPerms = ECOMMERCE_SUB_PERMISSIONS.some((permission) =>
        Object.prototype.hasOwnProperty.call(permissions, permission)
      );
      normalizeEcommercePermissions(permissions, hasEcommerceSubPerms);
      const hasFidelizacionSubPerms =
        Object.prototype.hasOwnProperty.call(permissions, 'fidelizacion-panel') ||
        Object.prototype.hasOwnProperty.call(permissions, 'fidelizacion-mis') ||
        Object.prototype.hasOwnProperty.call(permissions, 'fidelizacion-admin') ||
        Object.prototype.hasOwnProperty.call(permissions, 'fidelizacion-dashboard');
      if (!hasFidelizacionSubPerms && permissions.fidelizacion === true) {
        permissions['fidelizacion-menu'] = true;
        permissions['fidelizacion-panel'] = true;
        permissions['fidelizacion-mis'] = true;
        permissions['fidelizacion-admin'] = true;
        permissions['fidelizacion-dashboard'] = true;
      }
    } catch (_err) {
      permissions = {};
    }
    res.json({
      user: { id: payload.id, name: payload.name, email: payload.email, role },
      permissions,
      local,
      tnubeStoreId: TNUBE_STORE_ID,
      sessionIdleMinutes: SESSION_MAX_IDLE_MINUTES,
    });
  })();
});

app.get('/api/roles', async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id_roles AS id, tipo_role AS name
       FROM RolesWeb
       ORDER BY tipo_role`
    );
    res.json({ data: rows || [] });
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar roles', error: error.message });
  }
});

app.get('/api/roles/:id/permissions', async (req, res) => {
  try {
    const roleId = Number(req.params.id);
    if (!Number.isFinite(roleId)) return res.status(400).json({ message: 'id_roles invalido' });
    const [rows] = await pool.query(
      `SELECT permiso, habilitado
       FROM RolesPermisos
       WHERE id_roles = ?`,
      [roleId]
    );
    res.json({ roleId, data: rows || [] });
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar permisos', error: error.message });
  }
});

app.put('/api/roles/:id/permissions', async (req, res) => {
  let conn;
  try {
    const roleId = Number(req.params.id);
    if (!Number.isFinite(roleId)) return res.status(400).json({ message: 'id_roles invalido' });
    const permissions = req.body?.permissions;
    if (!permissions || typeof permissions !== 'object') {
      return res.status(400).json({ message: 'permissions requerido' });
    }
    conn = await pool.getConnection();
    await conn.beginTransaction();
    const [[roleRow]] = await conn.query(
      'SELECT id_roles FROM RolesWeb WHERE id_roles = ? LIMIT 1',
      [roleId]
    );
    if (!roleRow) {
      await conn.rollback();
      return res.status(404).json({ message: 'rol no encontrado' });
    }

    await conn.query('DELETE FROM RolesPermisos WHERE id_roles = ?', [roleId]);

    const rows = ROLE_PERMISSIONS.map((permiso) => [
      roleId,
      permiso,
      permissions[permiso] ? 1 : 0,
    ]);
    if (rows.length) {
      await conn.query(
        'INSERT INTO RolesPermisos (id_roles, permiso, habilitado) VALUES ?',
        [rows]
      );
    }
    await conn.commit();
    res.json({ ok: true });
  } catch (error) {
    if (conn) {
      try {
        await conn.rollback();
      } catch (_err) {
        /* ignore */
      }
    }
    res.status(500).json({ message: 'Error al guardar permisos', error: error.message });
  } finally {
    if (conn) conn.release();
  }
});

app.get('/api/config/tiendanube-prompt', requireAuth, async (_req, res) => {
  try {
    const [[row]] = await pool.query(
      `SELECT clave, prompt, actualizado_por, actualizado_en, creado_en
       FROM ${DB_NAME}.tiendanube_prompt_config
       WHERE clave = 'publicaciones_descripcion_ia'
       LIMIT 1`
    );
    res.json({ data: row || { clave: 'publicaciones_descripcion_ia', prompt: '' } });
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar prompt TN', error: error.message });
  }
});

app.put('/api/config/tiendanube-prompt', requireAuth, async (req, res) => {
  try {
    const prompt = String(req.body?.prompt || '');
    await pool.query(
      `INSERT INTO ${DB_NAME}.tiendanube_prompt_config (clave, prompt, actualizado_por)
       VALUES ('publicaciones_descripcion_ia', ?, ?)
       ON DUPLICATE KEY UPDATE
         prompt = VALUES(prompt),
         actualizado_por = VALUES(actualizado_por),
         actualizado_en = CURRENT_TIMESTAMP`,
      [prompt, req.user?.id || null]
    );
    res.json({ ok: true, data: { clave: 'publicaciones_descripcion_ia', prompt } });
  } catch (error) {
    res.status(500).json({ message: 'Error al guardar prompt TN', error: error.message });
  }
});

const TASK_BAJADA_TN = 'BajadaTN';
const TASK_ELIMINAR_BAJADA_TN = 'EliminarBajadaTN';

function parseScheduledTaskConfig(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_error) {
    return {};
  }
}

function normalizeScheduledTaskRow(row = {}, defaults = {}) {
  const horaRaw = String(row.hora || defaults.hora || '03:00:00');
  const hora = horaRaw.match(/^\d{2}:\d{2}/) ? horaRaw.slice(0, 5) : String(defaults.hora || '03:00').slice(0, 5);
  return {
    id: Number(row.id) || 0,
    taskKey: row.task_key || defaults.taskKey || '',
    taskName: row.task_name || defaults.taskName || defaults.taskKey || '',
    taskType: row.task_type || defaults.taskType || '',
    enabled: Number(row.enabled) === 1,
    hora,
    diasSemana: String(row.dias_semana || '').trim(),
    config: { ...(defaults.config || {}), ...parseScheduledTaskConfig(row.config_json) },
    ultimaEjecucion: row.ultima_ejecucion || null,
    ultimoJobId: row.ultimo_job_id || '',
    ultimoEstado: row.ultimo_estado || '',
    ultimoMensaje: row.ultimo_mensaje || '',
    actualizadoEn: row.actualizado_en || null,
  };
}

async function getScheduledTaskConfig(taskKey, defaults = {}) {
  const [[row]] = await pool.query(
    `SELECT id, task_key, task_name, task_type, enabled, hora, dias_semana, config_json,
            ultima_ejecucion, ultimo_job_id, ultimo_estado, ultimo_mensaje, actualizado_en
     FROM ${DB_NAME}.scheduled_tasks
     WHERE task_key = ?
     LIMIT 1`
    ,
    [taskKey]
  );
  const normalizedDefaults = {
    taskKey,
    taskName: taskKey,
    taskType: '',
    enabled: 0,
    hora: '03:00',
    diasSemana: null,
    config: {},
    ...defaults,
  };
  if (row) return normalizeScheduledTaskRow(row, normalizedDefaults);
  await pool.query(
    `INSERT INTO ${DB_NAME}.scheduled_tasks
       (task_key, task_name, task_type, enabled, hora, dias_semana, config_json)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      taskKey,
      normalizedDefaults.taskName,
      normalizedDefaults.taskType,
      normalizedDefaults.enabled ? 1 : 0,
      `${String(normalizedDefaults.hora || '03:00').slice(0, 5)}:00`,
      normalizedDefaults.diasSemana || null,
      JSON.stringify(normalizedDefaults.config || {}),
    ]
  );
  const [[created]] = await pool.query(
    `SELECT id, task_key, task_name, task_type, enabled, hora, dias_semana, config_json,
            ultima_ejecucion, ultimo_job_id, ultimo_estado, ultimo_mensaje, actualizado_en
     FROM ${DB_NAME}.scheduled_tasks
     WHERE task_key = ?
     LIMIT 1`,
    [taskKey]
  );
  return normalizeScheduledTaskRow(created, normalizedDefaults);
}

function normalizeImportScheduleConfig(task = {}) {
  const tipoBajada = String(task.config?.tipoBajada || 'todo').trim();
  return {
    id: task.id,
    taskKey: task.taskKey,
    enabled: task.enabled,
    tipoBajada: ['todo', 'visible'].includes(tipoBajada) ? tipoBajada : 'todo',
    hora: task.hora || '03:00',
    diasSemana: task.diasSemana || '',
    ultimaEjecucion: task.ultimaEjecucion || null,
    ultimoJobId: task.ultimoJobId || '',
    ultimoEstado: task.ultimoEstado || '',
    ultimoMensaje: task.ultimoMensaje || '',
    actualizadoEn: task.actualizadoEn || null,
  };
}

async function getEcommerceImportScheduleConfig() {
  const task = await getScheduledTaskConfig(TASK_BAJADA_TN, {
    taskName: 'BajadaTN',
    taskType: 'ecommerce_import',
    hora: '03:00',
    config: { tipoBajada: 'todo' },
  });
  return normalizeImportScheduleConfig(task);
}

function normalizeScheduleDays(value) {
  const days = Array.isArray(value)
    ? value
    : String(value || '')
        .split(',')
        .map((item) => item.trim());
  const clean = Array.from(
    new Set(
      days
        .map((item) => Number.parseInt(item, 10))
        .filter((item) => Number.isInteger(item) && item >= 0 && item <= 6)
    )
  ).sort((a, b) => a - b);
  return clean.length ? clean.join(',') : null;
}

function hasImportJobRunning() {
  return Array.from(ecommerceImportJobs.values()).some((job) => job?.status === 'running');
}

function hasSyncJobRunning() {
  return Array.from(ecommerceSyncJobs.values()).some((job) => job?.status === 'running');
}

app.get('/api/config/ecommerce-import-schedule', requireAuth, async (_req, res) => {
  try {
    const data = await getEcommerceImportScheduleConfig();
    res.json({ data });
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar programacion de tareas', error: error.message });
  }
});

function normalizeCleanupScheduleConfig(task = {}) {
  const mantenerUltimas = Number.parseInt(task.config?.mantenerUltimas, 10);
  return {
    id: task.id,
    taskKey: task.taskKey,
    enabled: task.enabled,
    mantenerUltimas: Math.max(1, mantenerUltimas || 5),
    hora: task.hora || '03:30',
    diasSemana: task.diasSemana || '',
    ultimaEjecucion: task.ultimaEjecucion || null,
    ultimoEstado: task.ultimoEstado || '',
    ultimoMensaje: task.ultimoMensaje || '',
    actualizadoEn: task.actualizadoEn || null,
  };
}

async function getEcommerceCleanupScheduleConfig() {
  const task = await getScheduledTaskConfig(TASK_ELIMINAR_BAJADA_TN, {
    taskName: 'EliminarBajadaTN',
    taskType: 'ecommerce_cleanup',
    hora: '03:30',
    config: { mantenerUltimas: 5 },
  });
  return normalizeCleanupScheduleConfig(task);
}

app.get('/api/config/ecommerce-cleanup-schedule', requireAuth, async (_req, res) => {
  try {
    const data = await getEcommerceCleanupScheduleConfig();
    res.json({ data });
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar programacion de limpieza', error: error.message });
  }
});

app.put('/api/config/ecommerce-cleanup-schedule', requireAuth, async (req, res) => {
  try {
    const enabled = req.body?.enabled === true || req.body?.enabled === 1 || req.body?.enabled === '1' ? 1 : 0;
    const mantenerUltimas = Number.parseInt(req.body?.mantenerUltimas ?? req.body?.mantener_ultimas ?? 5, 10);
    if (!Number.isInteger(mantenerUltimas) || mantenerUltimas < 1 || mantenerUltimas > 500) {
      return res.status(400).json({ message: 'Mantener ultimas debe estar entre 1 y 500' });
    }
    const hora = String(req.body?.hora || '03:30').trim();
    if (!/^\d{2}:\d{2}$/.test(hora)) {
      return res.status(400).json({ message: 'Hora invalida' });
    }
    const [hour, minute] = hora.split(':').map((item) => Number.parseInt(item, 10));
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      return res.status(400).json({ message: 'Hora invalida' });
    }
    const diasSemana = normalizeScheduleDays(req.body?.diasSemana ?? req.body?.dias_semana);
    await getEcommerceCleanupScheduleConfig();
    await pool.query(
      `UPDATE ${DB_NAME}.scheduled_tasks
       SET enabled = ?, hora = ?, dias_semana = ?, config_json = ?
       WHERE task_key = ?`,
      [
        enabled,
        `${hora}:00`,
        diasSemana,
        JSON.stringify({ mantenerUltimas }),
        TASK_ELIMINAR_BAJADA_TN,
      ]
    );
    const data = await getEcommerceCleanupScheduleConfig();
    res.json({ ok: true, data });
  } catch (error) {
    res.status(500).json({ message: 'Error al guardar programacion de limpieza', error: error.message });
  }
});

app.put('/api/config/ecommerce-import-schedule', requireAuth, async (req, res) => {
  try {
    const enabled = req.body?.enabled === true || req.body?.enabled === 1 || req.body?.enabled === '1' ? 1 : 0;
    const tipoBajada = String(req.body?.tipoBajada || req.body?.tipo_bajada || 'todo').trim();
    if (!['todo', 'visible'].includes(tipoBajada)) {
      return res.status(400).json({ message: 'tipo_bajada debe ser todo o visible' });
    }
    const hora = String(req.body?.hora || '03:00').trim();
    if (!/^\d{2}:\d{2}$/.test(hora)) {
      return res.status(400).json({ message: 'Hora invalida' });
    }
    const [hour, minute] = hora.split(':').map((item) => Number.parseInt(item, 10));
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      return res.status(400).json({ message: 'Hora invalida' });
    }
    const diasSemana = normalizeScheduleDays(req.body?.diasSemana ?? req.body?.dias_semana);
    await getEcommerceImportScheduleConfig();
    await pool.query(
      `UPDATE ${DB_NAME}.scheduled_tasks
       SET enabled = ?, hora = ?, dias_semana = ?, config_json = ?
       WHERE task_key = ?`,
      [enabled, `${hora}:00`, diasSemana, JSON.stringify({ tipoBajada }), TASK_BAJADA_TN]
    );
    const data = await getEcommerceImportScheduleConfig();
    res.json({ ok: true, data });
  } catch (error) {
    res.status(500).json({ message: 'Error al guardar programacion de tareas', error: error.message });
  }
});

app.post('/api/ecommerce/publicaciones/descripcion-ia', requireAuth, async (req, res) => {
  try {
    if (!openai) {
      return res.status(400).json({ message: 'OPENAI_API_KEY no configurada en el servidor' });
    }
    const nombreWeb = String(req.body?.nombreWeb || '').trim();
    const descripcionWeb = String(req.body?.descripcionWeb || '').trim();
    const articulo = String(req.body?.articulo || '').trim();
    const detalle = String(req.body?.detalle || '').trim();
    if (!nombreWeb && !descripcionWeb && !detalle) {
      return res.status(400).json({ message: 'Carga nombre o descripcion para generar el texto.' });
    }

    const [[promptRow]] = await pool.query(
      `SELECT prompt
       FROM ${DB_NAME}.tiendanube_prompt_config
       WHERE clave = 'publicaciones_descripcion_ia'
       LIMIT 1`
    );
    const prompt = String(promptRow?.prompt || '').trim();
    if (!prompt) {
      return res.status(400).json({ message: 'No hay prompt TN configurado.' });
    }

    const userContent = [
      `Articulo/SKU: ${articulo || 'Sin dato'}`,
      `Nombre web actual: ${nombreWeb || 'Sin dato'}`,
      `Detalle del sistema: ${detalle || 'Sin dato'}`,
      `Descripcion web actual: ${descripcionWeb || 'Sin dato'}`,
    ].join('\n');

    const completion = await withRetry(() =>
      openai.chat.completions.create({
        model: OPENAI_MODEL || 'gpt-4o-mini',
        temperature: 0.4,
        messages: [
          {
            role: 'system',
            content:
              `${prompt}\n\n` +
              'Devuelve unicamente la descripcion final para pegar en Tienda Nube. ' +
              'El formato obligatorio es una lista con viñetas, usando una linea por punto y empezando cada linea con "• ". ' +
              'Ordena los puntos de lo general a lo especifico: tipo de producto, estilo/material, medidas, largo/talle y marca/proveedor cuando aplique. ' +
              'No incluyas explicaciones, titulos de respuesta, comillas envolventes ni markdown de bloque.',
          },
          { role: 'user', content: userContent },
        ],
      })
    );
    const descripcion = String(completion.choices?.[0]?.message?.content || '').trim();
    if (!descripcion) return res.status(500).json({ message: 'OpenAI no devolvio descripcion.' });
    res.json({ ok: true, descripcion });
  } catch (error) {
    res.status(500).json({ message: 'Error al generar descripcion IA', error: error.message });
  }
});

app.get('/api/apis/endpoints', requireAuth, async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, nombre_api, endpoint, query_sql, api_key, formato_salida, activo, created_at, updated_at
       FROM api_endpoints
       ORDER BY id DESC`
    );
    res.json({
      data: (rows || []).map((row) => ({
        id: Number(row.id) || 0,
        nombre_api: String(row.nombre_api || ''),
        endpoint: String(row.endpoint || ''),
        query_sql: String(row.query_sql || ''),
        api_key: String(row.api_key || ''),
        formato_salida: String(row.formato_salida || 'json').toLowerCase(),
        activo: !!row.activo,
        created_at: row.created_at,
        updated_at: row.updated_at,
      })),
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar endpoints', error: error.message });
  }
});

app.post('/api/apis/endpoints', requireAuth, async (req, res) => {
  try {
    const nombreApi = String(req.body?.nombre_api || '').trim();
    const apiKey = String(req.body?.api_key || '').trim();
    const formatoSalida = String(req.body?.formato_salida || 'json').trim().toLowerCase();
    const activo = req.body?.activo === undefined ? true : Boolean(req.body?.activo);
    if (!nombreApi) return res.status(400).json({ message: 'nombre_api es obligatorio' });
    if (!apiKey) return res.status(400).json({ message: 'api_key es obligatorio' });
    if (formatoSalida !== 'json') return res.status(400).json({ message: 'Solo se soporta formato json' });

    const querySql = validateApiEndpointSql(req.body?.query_sql);
    const endpoint = await buildUniqueApiEndpoint(nombreApi);

    const [result] = await pool.query(
      `INSERT INTO api_endpoints (nombre_api, endpoint, query_sql, api_key, formato_salida, activo)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [nombreApi, endpoint, querySql, apiKey, formatoSalida, activo ? 1 : 0]
    );

    res.json({
      ok: true,
      data: {
        id: Number(result.insertId) || 0,
        nombre_api: nombreApi,
        endpoint,
        query_sql: querySql,
        api_key: apiKey,
        formato_salida: formatoSalida,
        activo: !!activo,
      },
    });
  } catch (error) {
    const status = error?.message?.includes('SELECT') || error?.message?.includes('permit') ? 400 : 500;
    res.status(status).json({ message: error.message || 'Error al crear endpoint' });
  }
});

app.put('/api/apis/endpoints/:id', requireAuth, async (req, res) => {
  try {
    const endpointId = Number(req.params.id);
    if (!Number.isFinite(endpointId) || endpointId <= 0) {
      return res.status(400).json({ message: 'id inválido' });
    }
    const [[existing]] = await pool.query(
      `SELECT id, endpoint, api_key
       FROM api_endpoints
       WHERE id = ?
       LIMIT 1`,
      [endpointId]
    );
    if (!existing) return res.status(404).json({ message: 'Endpoint no encontrado' });

    const nombreApi = String(req.body?.nombre_api || '').trim();
    const apiKeyInput = String(req.body?.api_key || '').trim();
    const formatoSalida = String(req.body?.formato_salida || 'json').trim().toLowerCase();
    const activo = req.body?.activo === undefined ? true : Boolean(req.body?.activo);
    if (!nombreApi) return res.status(400).json({ message: 'nombre_api es obligatorio' });
    if (formatoSalida !== 'json') return res.status(400).json({ message: 'Solo se soporta formato json' });

    const querySql = validateApiEndpointSql(req.body?.query_sql);
    const apiKey = apiKeyInput || String(existing.api_key || '').trim();
    if (!apiKey) return res.status(400).json({ message: 'api_key es obligatorio' });

    await pool.query(
      `UPDATE api_endpoints
       SET nombre_api = ?, query_sql = ?, api_key = ?, formato_salida = ?, activo = ?
       WHERE id = ?
       LIMIT 1`,
      [nombreApi, querySql, apiKey, formatoSalida, activo ? 1 : 0, endpointId]
    );

    res.json({
      ok: true,
      data: {
        id: endpointId,
        nombre_api: nombreApi,
        endpoint: String(existing.endpoint || ''),
        query_sql: querySql,
        api_key: apiKey,
        formato_salida: formatoSalida,
        activo: !!activo,
      },
    });
  } catch (error) {
    const status = error?.message?.includes('SELECT') || error?.message?.includes('permit') ? 400 : 500;
    res.status(status).json({ message: error.message || 'Error al actualizar endpoint' });
  }
});

app.patch('/api/apis/endpoints/:id/activo', requireAuth, async (req, res) => {
  try {
    const endpointId = Number(req.params.id);
    if (!Number.isFinite(endpointId) || endpointId <= 0) {
      return res.status(400).json({ message: 'id inválido' });
    }
    const activo = Boolean(req.body?.activo);
    const [result] = await pool.query(
      `UPDATE api_endpoints
       SET activo = ?
       WHERE id = ?
       LIMIT 1`,
      [activo ? 1 : 0, endpointId]
    );
    if (!result.affectedRows) return res.status(404).json({ message: 'Endpoint no encontrado' });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar estado', error: error.message });
  }
});

app.get('/api/artisinc', async (req, res) => {
  try {
    const autCode = String(req.query.Codigo || '').trim();
    if (autCode !== '3869') {
      return res.json('AutErro');
    }

    const [rows] = await pool.query(
      `SELECT Articulo, Detalle, Proveedor
       FROM ${DB_NAME}.articulos`
    );
    res.json(rows || []);
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar articulos', error: error.message });
  }
});

app.get('/api/inArtisinc', async (req, res) => {
  let conn;
  try {
    const articulo = String(req.query.Articulo || '').trim();
    if (!articulo) {
      return res.status(400).json({ message: 'Articulo requerido' });
    }

    const detalle = String(req.query.Detalle || '').trim();
    const proveedor = String(req.query.Proveedor || '').trim();
    const precioOrigen = Number(req.query.PrecioOrigen) || 0;
    const precioConvertido = Number(req.query.PrecioConvertido) || 0;
    const proveedorSku = String(req.query.ProveedorSKU || '').trim();
    const moneda = String(req.query.Moneda || '').trim();

    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [[existing]] = await conn.query(
      `SELECT Articulo
       FROM ${DB_NAME}.articulos
       WHERE Articulo = ?
       LIMIT 1`,
      [articulo]
    );
    if (existing) {
      await conn.rollback();
      return res.json('El articulo ya existe');
    }

    const columns = [
      'Articulo',
      'Detalle',
      'ProveedorSKU',
      'Cantidad',
      'PrecioOrigen',
      'PrecioConvertido',
      'Moneda',
      'PrecioManual',
      'Gastos',
      'Ganancia',
      'Proveedor',
    ];
    const values = [
      articulo,
      detalle,
      proveedorSku,
      0,
      precioOrigen,
      precioConvertido,
      moneda,
      0,
      0,
      0,
      proveedor,
    ];
    const placeholders = columns.map(() => '?').join(',');

    await conn.query(
      `INSERT INTO ${DB_NAME}.articulos (${columns.join(',')})
       VALUES (${placeholders})`,
      values
    );
    await conn.query(
      `INSERT INTO ${DB_NAME}.deposito (${columns.join(',')})
       VALUES (${placeholders})`,
      values
    );

    await conn.commit();
    res.json('Finalizado');
  } catch (error) {
    if (conn) {
      try {
        await conn.rollback();
      } catch (_err) {
        /* ignore */
      }
    }
    res.status(500).json({ message: 'Error al crear articulo sincronizado', error: error.message });
  } finally {
    if (conn) conn.release();
  }
});

app.get('/api/public/*', async (req, res) => {
  try {
    const requestedEndpoint = normalizeApiEndpointPath(req.path);
    const [[endpointCfg]] = await pool.query(
      `SELECT id, nombre_api, endpoint, query_sql, api_key, formato_salida, activo
       FROM api_endpoints
       WHERE endpoint = ? AND activo = 1
       LIMIT 1`,
      [requestedEndpoint]
    );
    if (!endpointCfg) {
      return res.status(404).json({ message: 'Endpoint no encontrado o inactivo' });
    }

    const incomingApiKey = String(req.get('x-api-key') || req.query.api_key || '').trim();
    const configuredApiKey = String(endpointCfg.api_key || '').trim();
    if (!incomingApiKey || incomingApiKey !== configuredApiKey) {
      return res.status(403).json({ message: 'API key inválida' });
    }

    const validatedSql = validateApiEndpointSql(endpointCfg.query_sql);
    const safeSql = clampLimit(validatedSql, 1000);
    const [rows] = await pool.query(safeSql);
    const normalizedRows = Array.isArray(rows) ? normalizeRows(rows) : [];

    res.json({
      ok: true,
      endpoint: String(endpointCfg.endpoint || ''),
      nombre_api: String(endpointCfg.nombre_api || ''),
      formato_salida: String(endpointCfg.formato_salida || 'json').toLowerCase(),
      rowCount: normalizedRows.length,
      rows: normalizedRows,
    });
  } catch (error) {
    const isMysqlError = error && typeof error.code === 'string';
    res.status(isMysqlError ? 400 : 500).json({
      message: 'Error al ejecutar endpoint',
      error: error.message || String(error),
    });
  }
});

app.get('/api/fidelizacion/context', async (req, res) => {
  try {
    const context = await getFidelizacionUserContext(pool, req.user?.id);
    if (!context) return res.status(401).json({ message: 'Usuario invalido' });
    const latestRun = await getFidelizacionLatestRun(pool);
    res.json({ user: context, latestRun });
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar contexto de fidelizacion', error: error.message });
  }
});

app.get('/api/fidelizacion/vendedoras', async (req, res) => {
  try {
    const context = await getFidelizacionUserContext(pool, req.user?.id);
    if (!context) return res.status(401).json({ message: 'Usuario invalido' });
    const [rows] = await pool.query(
      `SELECT DISTINCT vendedora_id AS id, TRIM(Nombre) AS nombre
       FROM vw_vendedores_activos
       WHERE vendedora_id IS NOT NULL
         AND Nombre IS NOT NULL
         AND TRIM(Nombre) <> ''
         AND LOWER(TRIM(Nombre)) NOT IN ('pagina', 'pagina web')
       ORDER BY Nombre`
    );
    res.json({
      data: (rows || []).map((row) => ({
        id: Number(row.id) || 0,
        nombre: String(row.nombre || '').trim(),
      })),
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar vendedoras de fidelizacion', error: error.message });
  }
});

async function getFidelizacionResultadoCatalogColumns(conn) {
  const [cols] = await conn.query(
    `SELECT LOWER(COLUMN_NAME) AS col
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'fidelizacion_resultado_catalogo'`
  );
  const colSet = new Set((cols || []).map((row) => String(row.col || '').toLowerCase()));
  const pick = (candidates = []) => candidates.find((c) => colSet.has(c)) || '';
  const codigoCol = pick(['codigo', 'resultado', 'code', 'id']);
  const nombreCol = pick(['nombre', 'descripcion', 'detalle', 'label', 'resultado', 'codigo', 'id']);
  const activoCol = pick(['activo', 'is_active', 'habilitado']);
  const ordenCol = pick(['orden', 'sort_order', 'id', 'codigo']);
  return { codigoCol, nombreCol, activoCol, ordenCol };
}

async function listFidelizacionResultadosCatalogo(conn) {
  const { codigoCol, nombreCol, activoCol, ordenCol } = await getFidelizacionResultadoCatalogColumns(conn);
  if (!codigoCol || !nombreCol) {
    throw new Error('Catalogo de resultados sin columnas compatibles');
  }
  const whereSql = activoCol ? `WHERE ${activoCol} = 1` : '';
  const orderSql = ordenCol ? `ORDER BY ${ordenCol} ASC, ${nombreCol} ASC` : `ORDER BY ${nombreCol} ASC`;
  const [rows] = await conn.query(
    `SELECT ${codigoCol} AS codigo, ${nombreCol} AS nombre
     FROM fidelizacion_resultado_catalogo
     ${whereSql}
     ${orderSql}`
  );
  return (rows || []).map((row) => ({
    codigo: String(row.codigo || '').trim(),
    nombre: String(row.nombre || '').trim(),
  }));
}

async function getFidelizacionResultadoCodes(conn) {
  const catalogo = await listFidelizacionResultadosCatalogo(conn);
  const byUpper = new Map(catalogo.map((row) => [String(row.codigo || '').trim().toUpperCase(), row.codigo]));
  const convertida = byUpper.get('CONVERTIDA') || '';
  const convertidaFueraVentana = byUpper.get('CONVERTIDA_FUERA_VENTANA') || '';
  const noConvertida = byUpper.get('NO_CONVERTIDA') || '';
  if (!convertida || !convertidaFueraVentana || !noConvertida) {
    throw new Error('Catalogo de resultados incompleto: requiere CONVERTIDA, CONVERTIDA_FUERA_VENTANA y NO_CONVERTIDA');
  }
  return { convertida, convertidaFueraVentana, noConvertida };
}

async function listFidelizacionConversionReasonsCatalogo(conn) {
  const [cols] = await conn.query(
    `SELECT LOWER(COLUMN_NAME) AS col
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'fidelizacion_conversion_reason_catalogo'`
  );
  const colSet = new Set((cols || []).map((row) => String(row.col || '').toLowerCase()));
  const pick = (candidates = []) => candidates.find((c) => colSet.has(c)) || '';
  const codigoCol = pick(['codigo', 'code', 'id', 'motivo_code']);
  const nombreCol = pick(['nombre', 'descripcion', 'detalle', 'label', 'motivo', 'codigo']);
  const activoCol = pick(['activo', 'is_active', 'habilitado']);
  const ordenCol = pick(['orden', 'sort_order', 'id', 'codigo']);
  if (!codigoCol || !nombreCol) {
    throw new Error('Catalogo de motivos de conversion sin columnas compatibles');
  }
  const whereSql = activoCol ? `WHERE ${activoCol} = 1` : '';
  const orderSql = ordenCol ? `ORDER BY ${ordenCol} ASC, ${nombreCol} ASC` : `ORDER BY ${nombreCol} ASC`;
  const [rows] = await conn.query(
    `SELECT ${codigoCol} AS codigo, ${nombreCol} AS nombre
     FROM fidelizacion_conversion_reason_catalogo
     ${whereSql}
     ${orderSql}`
  );
  return (rows || []).map((row) => ({
    codigo: String(row.codigo || '').trim(),
    nombre: String(row.nombre || '').trim(),
  }));
}

async function listFidelizacionClosedReasonsCatalogo(conn) {
  const [cols] = await conn.query(
    `SELECT LOWER(COLUMN_NAME) AS col
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'fidelizacion_closed_reason_catalogo'`
  );
  const colSet = new Set((cols || []).map((row) => String(row.col || '').toLowerCase()));
  const pick = (candidates = []) => candidates.find((c) => colSet.has(c)) || '';
  const codigoCol = pick(['codigo', 'code', 'id', 'motivo_code']);
  const nombreCol = pick(['nombre', 'descripcion', 'detalle', 'label', 'motivo', 'codigo']);
  const activoCol = pick(['activo', 'is_active', 'habilitado']);
  const ordenCol = pick(['orden', 'sort_order', 'id', 'codigo']);
  if (!codigoCol || !nombreCol) {
    throw new Error('Catalogo de motivos de cierre sin columnas compatibles');
  }
  const whereSql = activoCol ? `WHERE ${activoCol} = 1` : '';
  const orderSql = ordenCol ? `ORDER BY ${ordenCol} ASC, ${nombreCol} ASC` : `ORDER BY ${nombreCol} ASC`;
  const [rows] = await conn.query(
    `SELECT ${codigoCol} AS codigo, ${nombreCol} AS nombre
     FROM fidelizacion_closed_reason_catalogo
     ${whereSql}
     ${orderSql}`
  );
  return (rows || []).map((row) => ({
    codigo: String(row.codigo || '').trim(),
    nombre: String(row.nombre || '').trim(),
  }));
}

app.get('/api/fidelizacion/resultados/catalogo', async (req, res) => {
  try {
    const context = await getFidelizacionUserContext(pool, req.user?.id);
    if (!context) return res.status(401).json({ message: 'Usuario invalido' });
    const data = await listFidelizacionResultadosCatalogo(pool);
    res.json({ data });
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar catalogo de resultados', error: error.message });
  }
});

app.get('/api/fidelizacion/conversion-reasons/catalogo', async (req, res) => {
  try {
    const context = await getFidelizacionUserContext(pool, req.user?.id);
    if (!context) return res.status(401).json({ message: 'Usuario invalido' });
    const data = await listFidelizacionConversionReasonsCatalogo(pool);
    res.json({ data });
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar catalogo de motivos de conversion', error: error.message });
  }
});

app.get('/api/fidelizacion/closed-reasons/catalogo', async (req, res) => {
  try {
    const context = await getFidelizacionUserContext(pool, req.user?.id);
    if (!context) return res.status(401).json({ message: 'Usuario invalido' });
    const data = await listFidelizacionClosedReasonsCatalogo(pool);
    res.json({ data });
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar catalogo de motivos de cierre', error: error.message });
  }
});

app.get('/api/fidelizacion/config', async (req, res) => {
  try {
    const context = await getFidelizacionUserContext(pool, req.user?.id);
    if (!context) return res.status(401).json({ message: 'Usuario invalido' });
    if (!context.isAdmin) return res.status(403).json({ message: 'Solo Admin puede ver configuracion' });
    const config = await getFidelizacionActiveConfig(pool);
    res.json({ data: config });
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar configuracion de fidelizacion', error: error.message });
  }
});

app.put('/api/fidelizacion/config', async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const context = await getFidelizacionUserContext(conn, req.user?.id);
    if (!context) return res.status(401).json({ message: 'Usuario invalido' });
    if (!context.isAdmin) return res.status(403).json({ message: 'Solo Admin puede editar configuracion' });
    const payload = req.body || {};
    const config = normalizeFidelizacionConfig({
      ...FIDELIZACION_DEFAULT_CONFIG,
      ...payload,
      is_active: 1,
      updated_by: context.userName || req.user?.name || '',
    });
    await conn.beginTransaction();
    await conn.query('UPDATE fidelizacion_config SET is_active = 0 WHERE is_active = 1');
    const [insert] = await conn.query(
      `INSERT INTO fidelizacion_config
       (is_active, cooldown_days, conversion_window_days, max_clients_per_run,
        w_month_match, w_frequency_12m, w_recency_30_90, w_monetary_12m,
        ticket_penalty_threshold, ticket_penalty_points, updated_by)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        config.cooldown_days,
        config.conversion_window_days,
        config.max_clients_per_run,
        config.w_month_match,
        config.w_frequency_12m,
        config.w_recency_30_90,
        config.w_monetary_12m,
        config.ticket_penalty_threshold,
        config.ticket_penalty_points,
        config.updated_by || '',
      ]
    );
    await conn.commit();
    const [[saved]] = await pool.query(
      `SELECT id, is_active, cooldown_days, conversion_window_days, max_clients_per_run,
              w_month_match, w_frequency_12m, w_recency_30_90, w_monetary_12m,
              ticket_penalty_threshold, ticket_penalty_points, updated_by, updated_at
       FROM fidelizacion_config
       WHERE id = ?
       LIMIT 1`,
      [insert.insertId]
    );
    res.json({ ok: true, data: normalizeFidelizacionConfig(saved || config) });
  } catch (error) {
    if (conn) {
      try {
        await conn.rollback();
      } catch (_err) {
        /* ignore */
      }
    }
    res.status(500).json({ message: 'Error al guardar configuracion de fidelizacion', error: error.message });
  } finally {
    if (conn) conn.release();
  }
});

app.get('/api/fidelizacion/run/latest', async (_req, res) => {
  try {
    const config = await getFidelizacionActiveConfig(pool);
    const [[runRow]] = await pool.query(
      `SELECT id, run_date, created_at, params_json, config_id
       FROM fidelizacion_run
       ORDER BY id DESC
       LIMIT 1`
    );
    if (!runRow) {
      return res.json({ config, run: null, resumen: null, data: [] });
    }
    const detail = await getFidelizacionRunDetail(pool, Number(runRow.id));
    res.json({
      config,
      run: {
        id: Number(runRow.id),
        run_date: runRow.run_date,
        created_at: runRow.created_at,
        config_id: runRow.config_id ? Number(runRow.config_id) : null,
        params_json: parseMaybeJson(runRow.params_json),
      },
      resumen: detail.resumen,
      data: detail.recomendaciones,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar corrida de fidelizacion', error: error.message });
  }
});

app.post('/api/fidelizacion/run', async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const context = await getFidelizacionUserContext(conn, req.user?.id);
    if (!context) return res.status(401).json({ message: 'Usuario invalido' });
    if (!context.isAdmin) return res.status(403).json({ message: 'Solo Admin puede generar corridas' });
    await conn.beginTransaction();

    const config = await getFidelizacionActiveConfig(conn);
    let configId = config.id ? Number(config.id) : null;
    if (!configId) {
      const [insertCfg] = await conn.query(
        `INSERT INTO fidelizacion_config
         (is_active, cooldown_days, conversion_window_days, max_clients_per_run,
          w_month_match, w_frequency_12m, w_recency_30_90, w_monetary_12m,
          ticket_penalty_threshold, ticket_penalty_points, updated_by)
         VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          config.cooldown_days,
          config.conversion_window_days,
          config.max_clients_per_run,
          config.w_month_match,
          config.w_frequency_12m,
          config.w_recency_30_90,
          config.w_monetary_12m,
          config.ticket_penalty_threshold,
          config.ticket_penalty_points,
          context.userName || req.user?.name || '',
        ]
      );
      configId = Number(insertCfg.insertId);
    }

    const paramsJson = buildFidelizacionParamsJson(config);
    const runDate = formatDateLocal(new Date());
    let runId = 0;
    try {
      const [insertRun] = await conn.query(
        `INSERT INTO fidelizacion_run (run_date, params_json, config_id)
         VALUES (?, ?, ?)`,
        [runDate, JSON.stringify(paramsJson), configId]
      );
      runId = Number(insertRun.insertId) || 0;
    } catch (error) {
      if (error?.code === 'ER_DUP_ENTRY') {
        await conn.rollback();
        return res.status(409).json({ message: `Ya existe una corrida para la fecha ${runDate}` });
      }
      throw error;
    }
    if (!runId) throw new Error('No se pudo crear la corrida');

    const [activeSellers] = await conn.query(
      `SELECT DISTINCT vendedora_id AS id, TRIM(Nombre) AS nombre
       FROM vw_vendedores_activos
       WHERE vendedora_id IS NOT NULL
         AND Nombre IS NOT NULL
         AND TRIM(Nombre) <> ''
         AND LOWER(TRIM(Nombre)) NOT IN ('pagina', 'pagina web')
       ORDER BY vendedora_id`
    );
    if (!activeSellers.length) {
      await conn.rollback();
      return res.status(400).json({ message: 'No hay vendedores activos para asignacion' });
    }

    const [featureRows] = await conn.query(
      `SELECT
         f.id_clientes AS cliente_id,
         DATE(MAX(f.Fecha)) AS last_purchase_date,
         DATEDIFF(CURDATE(), DATE(MAX(f.Fecha))) AS recency_days,
         DATE(MAX(ult_fid.last_fidelizacion_at)) AS last_fidelizacion_date,
         CASE
           WHEN MAX(ult_fid.last_fidelizacion_at) IS NULL THEN 99999
           ELSE DATEDIFF(CURDATE(), DATE(MAX(ult_fid.last_fidelizacion_at)))
         END AS recency_fidelizacion_days,
         SUM(
           CASE
             WHEN f.Fecha >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
              AND EXISTS (
                SELECT 1
                FROM controlpedidos cpw
                WHERE cpw.nrofactura = f.NroFactura
                  AND cpw.ordenWeb IS NOT NULL
                  AND cpw.ordenWeb <> 0
              ) THEN 1
             ELSE 0
           END
         ) AS frequency_12m,
         SUM(
           CASE
             WHEN f.Fecha >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
              AND EXISTS (
                SELECT 1
                FROM controlpedidos cpw
                WHERE cpw.nrofactura = f.NroFactura
                  AND cpw.ordenWeb IS NOT NULL
                  AND cpw.ordenWeb <> 0
              )
               THEN COALESCE(NULLIF(f.totalEnvio, 0), NULLIF(f.Descuento, 0), f.Total, 0)
             ELSE 0
           END
         ) AS monetary_12m,
         SUM(
           CASE
             WHEN f.Fecha >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
              AND MONTH(f.Fecha) = MONTH(CURDATE())
              AND EXISTS (
                SELECT 1
                FROM controlpedidos cpw
                WHERE cpw.nrofactura = f.NroFactura
                  AND cpw.ordenWeb IS NOT NULL
                  AND cpw.ordenWeb <> 0
              )
               THEN 1
             ELSE 0
           END
         ) AS month_hits_12m
       FROM facturah f
       LEFT JOIN (
         SELECT cliente_id, MAX(created_at) AS last_fidelizacion_at
         FROM fidelizacion_recomendacion
         GROUP BY cliente_id
       ) ult_fid ON ult_fid.cliente_id = f.id_clientes
       WHERE f.id_clientes IS NOT NULL
         AND f.id_clientes <> 1
       GROUP BY f.id_clientes
       HAVING SUM(
                CASE
                  WHEN f.Fecha >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
                   AND EXISTS (
                     SELECT 1
                     FROM controlpedidos cpw
                     WHERE cpw.nrofactura = f.NroFactura
                       AND cpw.ordenWeb IS NOT NULL
                       AND cpw.ordenWeb <> 0
                   ) THEN 1
                  ELSE 0
                END
              ) > 0
          AND DATEDIFF(CURDATE(), DATE(MAX(f.Fecha))) >= ?
          AND (MAX(ult_fid.last_fidelizacion_at) IS NULL OR DATEDIFF(CURDATE(), DATE(MAX(ult_fid.last_fidelizacion_at))) >= ?)`,
      [config.cooldown_days, config.cooldown_days]
    );

    const maxFrequency = Math.max(
      1,
      ...featureRows.map((row) => Number(row.frequency_12m) || 0)
    );
    const maxMonetary = Math.max(
      1,
      ...featureRows.map((row) => Number(row.monetary_12m) || 0)
    );

    const scoredCandidates = featureRows
      .map((row) => {
        const frequency = Number(row.frequency_12m) || 0;
        const monetary = Number(row.monetary_12m) || 0;
        const avgTicket = frequency > 0 ? round2(monetary / frequency) : 0;
        const recency = Number(row.recency_days) || 0;
        const monthMatch = (Number(row.month_hits_12m) || 0) > 0;
        const recency3090 = recency >= 30 && recency <= 90;
        const frequencyScore = Math.min(1, frequency / maxFrequency);
        const monetaryScore = Math.min(1, monetary / maxMonetary);
        const scoreBase =
          (monthMatch ? config.w_month_match : 0) +
          frequencyScore * config.w_frequency_12m +
          (recency3090 ? config.w_recency_30_90 : 0) +
          monetaryScore * config.w_monetary_12m;
        const ticketPenaltyPoints = Number(config.ticket_penalty_points) || 0;
        const ticketPenaltyThreshold = Number(config.ticket_penalty_threshold) || 0;
        const hasTicketPenalty = ticketPenaltyPoints > 0 && avgTicket <= ticketPenaltyThreshold;
        const score = hasTicketPenalty ? scoreBase - ticketPenaltyPoints : scoreBase;

        const razones = [];
        if (monthMatch) razones.push(`estacionalidad(+${config.w_month_match})`);
        if (frequency > 0) razones.push(`frecuencia 12m: ${frequency}`);
        if (recency3090) razones.push(`recencia ideal: ${recency} dias`);
        razones.push(`monto 12m: ${round2(monetary)}`);
        razones.push(`ticket promedio 12m: ${avgTicket}`);
        if (hasTicketPenalty) razones.push(`ticket bajo (-${ticketPenaltyPoints})`);

        return {
          cliente_id: Number(row.cliente_id) || 0,
          last_purchase_date: row.last_purchase_date || null,
          recency_days: recency,
          frequency_12m: frequency,
          monetary_12m: round2(monetary),
          avg_ticket_12m: avgTicket,
          score: round2(score),
          razones: razones.join(' | '),
        };
      })
      .filter((row) => row.cliente_id > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, config.max_clients_per_run);

    const sellerNameToId = new Map(
      activeSellers.map((seller) => [String(seller.nombre || '').trim().toLowerCase(), Number(seller.id)])
    );
    const sellerLoad = new Map(activeSellers.map((seller) => [Number(seller.id), 0]));
    let fallbackCursor = 0;

    const pickFallbackSeller = () => {
      const minLoad = Math.min(...Array.from(sellerLoad.values()));
      const candidates = activeSellers.filter((seller) => (sellerLoad.get(Number(seller.id)) || 0) === minLoad);
      if (!candidates.length) return Number(activeSellers[0].id) || null;
      const selected = candidates[fallbackCursor % candidates.length];
      fallbackCursor += 1;
      return Number(selected.id) || null;
    };

    const rowsToInsert = [];
    const conversionWindowDays = Math.max(0, Number(config.conversion_window_days) || 0);
    for (const candidate of scoredCandidates) {
      const [histRows] = await conn.query(
        `SELECT LOWER(TRIM(f.vendedora)) AS nombre_lc, COUNT(*) AS cantidad
         FROM facturah f
         WHERE f.id_clientes = ?
           AND f.Fecha >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
           AND f.vendedora IS NOT NULL
           AND TRIM(f.vendedora) <> ''
         GROUP BY LOWER(TRIM(f.vendedora))
         ORDER BY cantidad DESC
         LIMIT 5`,
        [candidate.cliente_id]
      );
      let vendedoraId = null;
      for (const hist of histRows || []) {
        const byName = sellerNameToId.get(String(hist.nombre_lc || '').trim());
        if (byName) {
          vendedoraId = byName;
          break;
        }
      }
      if (!vendedoraId) {
        vendedoraId = pickFallbackSeller();
      }
      if (vendedoraId) {
        sellerLoad.set(vendedoraId, (sellerLoad.get(vendedoraId) || 0) + 1);
      }

      const [topFamilias] = await conn.query(
        `SELECT stw.familia AS valor, COUNT(*) AS cantidad
         FROM factura fi
         INNER JOIN facturah fh ON fh.NroFactura = fi.NroFactura
         INNER JOIN sku_taxonomia_web stw ON TRIM(stw.sku) = TRIM(fi.Articulo)
         WHERE fh.id_clientes = ?
           AND fh.Fecha >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
           AND stw.familia IS NOT NULL
           AND TRIM(stw.familia) <> ''
         GROUP BY stw.familia
         ORDER BY cantidad DESC, stw.familia ASC
         LIMIT 3`,
        [candidate.cliente_id]
      );
      const [topMateriales] = await conn.query(
        `SELECT stw.material AS valor, COUNT(*) AS cantidad
         FROM factura fi
         INNER JOIN facturah fh ON fh.NroFactura = fi.NroFactura
         INNER JOIN sku_taxonomia_web stw ON TRIM(stw.sku) = TRIM(fi.Articulo)
         WHERE fh.id_clientes = ?
           AND fh.Fecha >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
           AND stw.material IS NOT NULL
           AND TRIM(stw.material) <> ''
         GROUP BY stw.material
         ORDER BY cantidad DESC, stw.material ASC
         LIMIT 3`,
        [candidate.cliente_id]
      );
      const [[novedadRow]] = await conn.query(
        `SELECT 1 AS has_novedad
         FROM factura fi
         INNER JOIN facturah fh ON fh.NroFactura = fi.NroFactura
         INNER JOIN sku_taxonomia_web stw ON TRIM(stw.sku) = TRIM(fi.Articulo)
         WHERE fh.id_clientes = ?
           AND fh.Fecha >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
           AND stw.es_novedad = 1
         LIMIT 1`,
        [candidate.cliente_id]
      );

      const familias = (topFamilias || []).map((row) => String(row.valor || '').trim()).filter(Boolean);
      const materiales = (topMateriales || []).map((row) => String(row.valor || '').trim()).filter(Boolean);
      const topFam1 = familias[0] || null;
      const topFam2 = familias[1] || null;
      const topFam3 = familias[2] || null;
      const topAttr1 = materiales[0] || null;
      const topAttr2 = materiales[1] || null;
      const topAttr3 = materiales[2] || null;
      const hasNovedad = Number(novedadRow?.has_novedad) === 1;

      let ofertaTipo = 'General';
      let ofertaDetalle = 'Campana de reactivacion personalizada';
      if (hasNovedad && topFam1 && topAttr1) {
        ofertaTipo = 'Novedades';
        ofertaDetalle = `Novedades de ${topFam1} en ${topAttr1}`;
      } else if (topFam1 && topFam2) {
        ofertaTipo = 'Reposicion';
        ofertaDetalle = `Reposicion sugerida: ${topFam1} + ${topFam2}`;
      } else if (topFam1 && topAttr1) {
        ofertaTipo = 'Afinidad';
        ofertaDetalle = `Seleccion sugerida de ${topFam1} en ${topAttr1}`;
      } else if (topFam1) {
        ofertaTipo = 'Afinidad';
        ofertaDetalle = `Seleccion sugerida de ${topFam1}`;
      }
      const createdAt = new Date();
      const deadlineAt = new Date(createdAt.getTime() + conversionWindowDays * 24 * 60 * 60 * 1000);

      rowsToInsert.push([
        runId,
        candidate.cliente_id,
        candidate.score,
        candidate.razones || '',
        vendedoraId,
        'PENDIENTE',
        context.userName || req.user?.name || '',
        topFam1,
        topFam2,
        topFam3,
        topAttr1,
        topAttr2,
        topAttr3,
        ofertaTipo,
        ofertaDetalle,
        candidate.last_purchase_date,
        candidate.recency_days,
        candidate.frequency_12m,
        candidate.monetary_12m,
        candidate.avg_ticket_12m,
        formatDateTimeLocal(createdAt),
        formatDateTimeLocal(deadlineAt),
      ]);
    }

    if (rowsToInsert.length) {
      await conn.query(
        `INSERT INTO fidelizacion_recomendacion
         (run_id, cliente_id, score, razones, vendedora_id, estado, estado_updated_by,
          tag_top_1, tag_top_2, tag_top_3,
          attr_top_1, attr_top_2, attr_top_3,
          oferta_tipo, oferta_detalle,
          last_purchase_date, recency_days, frequency_12m, monetary_12m, avg_ticket_12m,
          created_at, conversion_deadline_at)
         VALUES ?`,
        [rowsToInsert]
      );
    }

    await conn.commit();

    const [[runRow]] = await pool.query(
      `SELECT id, run_date, created_at, params_json, config_id
       FROM fidelizacion_run
       WHERE id = ?
       LIMIT 1`,
      [runId]
    );
    const detail = await getFidelizacionRunDetail(pool, runId);
    res.json({
      ok: true,
      run: {
        id: Number(runRow?.id) || runId,
        run_date: runRow?.run_date || runDate,
        created_at: runRow?.created_at || null,
        config_id: runRow?.config_id ? Number(runRow.config_id) : configId,
        params_json: parseMaybeJson(runRow?.params_json) || paramsJson,
      },
      resumen: detail.resumen,
      data: detail.recomendaciones,
    });
  } catch (error) {
    if (conn) {
      try {
        await conn.rollback();
      } catch (_err) {
        /* ignore */
      }
    }
    res.status(500).json({ message: 'Error al generar corrida de fidelizacion', error: error.message });
  } finally {
    if (conn) conn.release();
  }
});

app.get('/api/fidelizacion/mis', async (req, res) => {
  try {
    const context = await getFidelizacionUserContext(pool, req.user?.id);
    if (!context) return res.status(401).json({ message: 'Usuario invalido' });
    const latestRun = await getFidelizacionLatestRun(pool);
    const estado = String(req.query.estado || '').trim().toUpperCase();
    const scope = String(req.query.scope || 'MIAS').trim().toUpperCase();
    const runId = Number(req.query.run_id) || null;
    const commonFilters = [];
    const commonParams = [];
    commonFilters.push(
      `(r.vendedora_id IS NULL OR EXISTS (
         SELECT 1
         FROM vendedores vf
         WHERE vf.Id = r.vendedora_id
           AND LOWER(TRIM(COALESCE(vf.Nombre, ''))) NOT IN ('pagina', 'pagina web')
       ))`
    );

    const dataFilters = [...commonFilters];
    const dataParams = [...commonParams];
    if (scope !== 'TODOS' && scope !== 'ADMIN') {
      if (!context.vendedoraId) return res.status(400).json({ message: 'Usuario sin vendedora asociada' });
      dataFilters.push('r.vendedora_id = ?');
      dataParams.push(context.vendedoraId);
    } else if (context.isAdmin && req.query.vendedora_id) {
      dataFilters.push('r.vendedora_id = ?');
      dataParams.push(Number(req.query.vendedora_id));
    }
    if (scope === 'TODOS') {
      dataFilters.push(`r.estado IN ('PENDIENTE', 'EN_GESTION', 'CONTACTADA')`);
    }
    if (runId) {
      dataFilters.push('r.run_id = ?');
      dataParams.push(runId);
    }
    const filters = [...dataFilters];
    const params = [...dataParams];
    if (estado && estado !== 'TODOS') {
      if (estado === 'HISTORICO') {
        filters.push(`r.estado IN ('CERRADA', 'CONVERTIDA', 'NO_CONVERTIDA')`);
      } else {
        filters.push('r.estado = ?');
        params.push(estado);
      }
    }
    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
       const [rows] = await pool.query(
      `SELECT
         r.id,
         r.run_id,
         fr.run_date,
         r.cliente_id,
         CONCAT(COALESCE(c.nombre, ''), ' ', COALESCE(c.apellido, '')) AS cliente,
         COALESCE(c.telefono, '') AS telefono,
         r.score,
         r.razones,
         r.vendedora_id,
         COALESCE(v.Nombre, '') AS vendedora_nombre,
         r.estado,
         r.estado_updated_at,
         r.estado_updated_by,
         r.created_at,
         r.conversion_deadline_at,
         r.resultado,
         r.pedido_id,
         r.closed_reason,
         r.closed_at,
         r.contactado_at,
         r.converted_at,
         r.conversion_amount,
         r.tag_top_1,
         r.tag_top_2,
         r.tag_top_3,
         r.attr_top_1,
         r.attr_top_2,
         r.attr_top_3,
         r.oferta_tipo,
         r.oferta_detalle,
         r.last_purchase_date,
         r.recency_days,
         r.frequency_12m,
         r.monetary_12m,
         r.avg_ticket_12m,
         r.beneficio_texto,
         r.beneficio_regla,
         r.beneficio_estado,
         r.beneficio_generated_at,
         fn.last_note_at,
         CASE
           WHEN r.estado IN ('PENDIENTE', 'EN_GESTION', 'CONTACTADA')
            AND COALESCE(fn.last_note_at, r.created_at) < DATE_SUB(NOW(), INTERVAL 2 DAY)
             THEN 1
           ELSE 0
         END AS requires_note_update,
         CASE
           WHEN NOW() > r.conversion_deadline_at
            AND r.estado IN ('PENDIENTE', 'EN_GESTION', 'CONTACTADA')
             THEN 1
           ELSE 0
         END AS is_expired
       FROM fidelizacion_recomendacion r
       LEFT JOIN fidelizacion_run fr ON fr.id = r.run_id
       LEFT JOIN clientes c ON c.id_clientes = r.cliente_id
       LEFT JOIN vendedores v ON v.Id = r.vendedora_id
       LEFT JOIN (
         SELECT recomendacion_id, MAX(created_at) AS last_note_at
         FROM fidelizacion_notas
         GROUP BY recomendacion_id
       ) fn ON fn.recomendacion_id = r.id
       ${where}
      ORDER BY FIELD(r.estado, 'EN_GESTION', 'PENDIENTE', 'CONTACTADA', 'CERRADA', 'CONVERTIDA', 'NO_CONVERTIDA'), r.score DESC, r.id DESC
       LIMIT 600`,
      params
    );

    const miasFilters = [...commonFilters];
    const miasParams = [...commonParams];
    if (context.vendedoraId) {
      miasFilters.push('r.vendedora_id = ?');
      miasParams.push(context.vendedoraId);
    } else if (context.isAdmin && req.query.vendedora_id) {
      miasFilters.push('r.vendedora_id = ?');
      miasParams.push(Number(req.query.vendedora_id));
    }
    if (runId) {
      miasFilters.push('r.run_id = ?');
      miasParams.push(runId);
    }
    const [countRowsMias] = await pool.query(
      `SELECT r.estado, COUNT(*) AS total
       FROM fidelizacion_recomendacion r
       ${miasFilters.length ? `WHERE ${miasFilters.join(' AND ')}` : ''}
       GROUP BY r.estado`,
      miasParams
    );

    const todosFilters = [...commonFilters, `r.estado IN ('PENDIENTE', 'EN_GESTION', 'CONTACTADA')`];
    const todosParams = [...commonParams];
    if (runId) {
      todosFilters.push('r.run_id = ?');
      todosParams.push(runId);
    }
    const [countRowsTodos] = await pool.query(
      `SELECT r.estado, COUNT(*) AS total
       FROM fidelizacion_recomendacion r
       ${todosFilters.length ? `WHERE ${todosFilters.join(' AND ')}` : ''}
       GROUP BY r.estado`,
      todosParams
    );

    const adminFilters = [...commonFilters];
    const adminParams = [...commonParams];
    if (runId) {
      adminFilters.push('r.run_id = ?');
      adminParams.push(runId);
    }
    const [countRowsAdmin] = await pool.query(
      `SELECT r.estado, COUNT(*) AS total
       FROM fidelizacion_recomendacion r
       ${adminFilters.length ? `WHERE ${adminFilters.join(' AND ')}` : ''}
       GROUP BY r.estado`,
      adminParams
    );

    const [runRows] = await pool.query(
      `SELECT
         fr.id,
         fr.run_date,
         fr.created_at,
         COUNT(r.id) AS total
       FROM fidelizacion_run fr
       INNER JOIN fidelizacion_recomendacion r ON r.run_id = fr.id
       ${commonFilters.length ? `WHERE ${commonFilters.join(' AND ')}` : ''}
       GROUP BY fr.id, fr.run_date, fr.created_at
       ORDER BY fr.run_date DESC, fr.id DESC`,
      commonParams
    );

    const countsMias = (countRowsMias || []).reduce((acc, row) => {
      acc[String(row.estado || '').toUpperCase()] = Number(row.total) || 0;
      return acc;
    }, {});
    const countsTodos = (countRowsTodos || []).reduce((acc, row) => {
      acc[String(row.estado || '').toUpperCase()] = Number(row.total) || 0;
      return acc;
    }, {});
    const countsAdmin = (countRowsAdmin || []).reduce((acc, row) => {
      acc[String(row.estado || '').toUpperCase()] = Number(row.total) || 0;
      return acc;
    }, {});
    res.json({
      run: latestRun || null,
      context,
      counts: countsMias,
      counts_mias: countsMias,
      counts_todos: countsTodos,
      counts_admin: countsAdmin,
      runs: runRows || [],
      data: rows || [],
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar cola de fidelizacion', error: error.message });
  }
});

app.get('/api/fidelizacion/recomendaciones/:id/notas', async (req, res) => {
  try {
    const context = await getFidelizacionUserContext(pool, req.user?.id);
    if (!context) return res.status(401).json({ message: 'Usuario invalido' });
    const recId = Number(req.params.id);
    if (!recId) return res.status(400).json({ message: 'Recomendacion invalida' });

    const [[current]] = await pool.query(
      `SELECT id, vendedora_id
       FROM fidelizacion_recomendacion
       WHERE id = ?
       LIMIT 1`,
      [recId]
    );
    if (!current) return res.status(404).json({ message: 'Recomendacion no encontrada' });

    const [rows] = await pool.query(
      `SELECT
         n.id,
         n.recomendacion_id,
         n.users_id,
         n.nota,
         COALESCE(
           DATE_FORMAT(CONVERT_TZ(n.created_at, '+00:00', '-03:00'), '%Y-%m-%d %H:%i:%s'),
           DATE_FORMAT(n.created_at, '%Y-%m-%d %H:%i:%s')
         ) AS created_at,
         COALESCE(
           DATE_FORMAT(CONVERT_TZ(n.updated_at, '+00:00', '-03:00'), '%Y-%m-%d %H:%i:%s'),
           DATE_FORMAT(n.updated_at, '%Y-%m-%d %H:%i:%s')
         ) AS updated_at,
         COALESCE(u.name, '') AS vendedora
       FROM fidelizacion_notas n
       LEFT JOIN users u ON u.id = n.users_id
       WHERE n.recomendacion_id = ?
      ORDER BY n.id DESC`,
      [recId]
    );
    const mapped = (rows || []).map((row) => ({
      ...row,
      can_edit: context.isAdmin || Number(row.users_id || 0) === Number(context.userId || 0),
    }));
    res.json({ data: mapped });
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar notas de fidelizacion', error: error.message });
  }
});

app.post('/api/fidelizacion/recomendaciones/:id/notas', async (req, res) => {
  try {
    const context = await getFidelizacionUserContext(pool, req.user?.id);
    if (!context) return res.status(401).json({ message: 'Usuario invalido' });
    const recId = Number(req.params.id);
    const nota = String(req.body?.nota || '').trim();
    if (!recId) return res.status(400).json({ message: 'Recomendacion invalida' });
    if (!nota) return res.status(400).json({ message: 'Nota requerida' });

    const [[current]] = await pool.query(
      `SELECT id, vendedora_id
       FROM fidelizacion_recomendacion
       WHERE id = ?
       LIMIT 1`,
      [recId]
    );
    if (!current) return res.status(404).json({ message: 'Recomendacion no encontrada' });

    const [result] = await pool.query(
      `INSERT INTO fidelizacion_notas (recomendacion_id, users_id, nota)
       VALUES (?, ?, ?)`,
      [recId, context.userId || req.user?.id || null, nota]
    );
    res.json({ ok: true, id: Number(result.insertId) || 0 });
  } catch (error) {
    res.status(500).json({ message: 'Error al guardar nota de fidelizacion', error: error.message });
  }
});

app.put('/api/fidelizacion/notas/:id', async (req, res) => {
  try {
    const context = await getFidelizacionUserContext(pool, req.user?.id);
    if (!context) return res.status(401).json({ message: 'Usuario invalido' });
    const notaId = Number(req.params.id);
    const nota = String(req.body?.nota || '').trim();
    if (!notaId) return res.status(400).json({ message: 'Nota invalida' });
    if (!nota) return res.status(400).json({ message: 'Nota requerida' });

    const [[current]] = await pool.query(
      `SELECT id, users_id
       FROM fidelizacion_notas
       WHERE id = ?
       LIMIT 1`,
      [notaId]
    );
    if (!current) return res.status(404).json({ message: 'Nota no encontrada' });
    if (!context.isAdmin && Number(current.users_id || 0) !== Number(context.userId || 0)) {
      return res.status(403).json({ message: 'Solo podes editar tus propias notas' });
    }

    await pool.query(
      `UPDATE fidelizacion_notas
       SET nota = ?
       WHERE id = ?
       LIMIT 1`,
      [nota, notaId]
    );
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar nota de fidelizacion', error: error.message });
  }
});

app.delete('/api/fidelizacion/notas/:id', async (req, res) => {
  try {
    const context = await getFidelizacionUserContext(pool, req.user?.id);
    if (!context) return res.status(401).json({ message: 'Usuario invalido' });
    const notaId = Number(req.params.id);
    if (!notaId) return res.status(400).json({ message: 'Nota invalida' });

    const [[current]] = await pool.query(
      `SELECT id, users_id
       FROM fidelizacion_notas
       WHERE id = ?
       LIMIT 1`,
      [notaId]
    );
    if (!current) return res.status(404).json({ message: 'Nota no encontrada' });
    if (!context.isAdmin && Number(current.users_id || 0) !== Number(context.userId || 0)) {
      return res.status(403).json({ message: 'Solo podes eliminar tus propias notas' });
    }

    await pool.query(
      `DELETE FROM fidelizacion_notas
       WHERE id = ?
       LIMIT 1`,
      [notaId]
    );
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar nota de fidelizacion', error: error.message });
  }
});

app.post('/api/fidelizacion/recomendaciones/:id/tomar', async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const context = await getFidelizacionUserContext(conn, req.user?.id);
    if (!context) return res.status(401).json({ message: 'Usuario invalido' });
    if (!context.vendedoraId && !context.isAdmin) return res.status(400).json({ message: 'Usuario sin vendedora asociada' });
    const recId = Number(req.params.id);
    const motivo = String(req.body?.motivo || '').trim();
    const requestedVendedoraId = Number(req.body?.vendedora_id) || null;
    const targetVendedoraId = context.isAdmin
      ? (requestedVendedoraId || context.vendedoraId || null)
      : (context.vendedoraId || null);
    if (!recId || !targetVendedoraId) return res.status(400).json({ message: 'Recomendacion invalida' });
    if (!motivo) return res.status(400).json({ message: 'Motivo obligatorio para TOMAR' });
    const [[targetSeller]] = await conn.query(
      `SELECT Id, Nombre
       FROM vendedores
       WHERE Id = ?
       LIMIT 1`,
      [targetVendedoraId]
    );
    if (!targetSeller) {
      return res.status(400).json({ message: 'Vendedor destino invalido para TOMAR' });
    }
    if (isFidelizacionExcludedSellerName(targetSeller.Nombre)) {
      return res.status(400).json({ message: 'El vendedor Pagina Web no puede participar en fidelizacion' });
    }
    await conn.beginTransaction();
    const [[current]] = await conn.query(
      `SELECT id, run_id, cliente_id, estado, vendedora_id
       FROM fidelizacion_recomendacion
       WHERE id = ?
       LIMIT 1`,
      [recId]
    );
    if (!current) {
      await conn.rollback();
      return res.status(404).json({ message: 'Recomendacion no encontrada' });
    }
    const [update] = await conn.query(
      `UPDATE fidelizacion_recomendacion
       SET estado = 'EN_GESTION',
           estado_updated_at = NOW(),
           estado_updated_by = ?,
           vendedora_id = ?
       WHERE id = ?
         AND estado = 'PENDIENTE'`,
      [context.userName || req.user?.name || '', targetVendedoraId, recId]
    );
    if (!update.affectedRows) {
      await conn.rollback();
      return res.status(409).json({ message: 'La recomendacion ya fue tomada por otra persona' });
    }
    await insertFidelizacionTransferLog(conn, {
      recomendacion_id: current.id,
      run_id: current.run_id,
      cliente_id: current.cliente_id,
      action: 'TOMAR',
      from_vendedora_id: current.vendedora_id ? Number(current.vendedora_id) : null,
      to_vendedora_id: targetVendedoraId,
      motivo,
      actor_user_id: context.userId,
      actor_nombre: context.userName,
    });
    await conn.commit();
    res.json({ ok: true });
  } catch (error) {
    if (conn) {
      try {
        await conn.rollback();
      } catch (_err) {}
    }
    res.status(500).json({ message: 'Error al tomar recomendacion', error: error.message });
  } finally {
    if (conn) conn.release();
  }
});

app.post('/api/fidelizacion/recomendaciones/:id/transferir', async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const context = await getFidelizacionUserContext(conn, req.user?.id);
    if (!context) return res.status(401).json({ message: 'Usuario invalido' });
    const recId = Number(req.params.id);
    const destinoId = Number(req.body?.to_vendedora_id);
    const motivo = String(req.body?.motivo || '').trim();
    if (!recId || !destinoId) return res.status(400).json({ message: 'Datos invalidos para transferir' });
    if (!motivo) return res.status(400).json({ message: 'Motivo obligatorio para transferir' });
    const [[destino]] = await conn.query(
      `SELECT Id, Nombre
       FROM vendedores
       WHERE Id = ?
       LIMIT 1`,
      [destinoId]
    );
    if (!destino) return res.status(400).json({ message: 'Vendedor destino invalido' });
    if (isFidelizacionExcludedSellerName(destino.Nombre)) {
      return res.status(400).json({ message: 'No se puede transferir al vendedor Pagina Web' });
    }
    await conn.beginTransaction();
    const [[current]] = await conn.query(
      `SELECT id, run_id, cliente_id, estado, vendedora_id
       FROM fidelizacion_recomendacion
       WHERE id = ?
       LIMIT 1`,
      [recId]
    );
    if (!current) {
      await conn.rollback();
      return res.status(404).json({ message: 'Recomendacion no encontrada' });
    }
    const currentEstado = String(current.estado || '').toUpperCase();
    if (!['PENDIENTE', 'EN_GESTION', 'CONTACTADA'].includes(currentEstado)) {
      await conn.rollback();
      return res.status(400).json({ message: 'Solo se puede transferir desde PENDIENTE, EN_GESTION o CONTACTADA' });
    }
    if (!context.isAdmin && Number(current.vendedora_id) !== Number(context.vendedoraId)) {
      await conn.rollback();
      return res.status(403).json({ message: 'Solo podes transferir recomendaciones propias' });
    }
    if (Number(current.vendedora_id) === destinoId) {
      await conn.rollback();
      return res.status(400).json({ message: 'La recomendacion ya esta asignada a ese vendedor' });
    }
    await conn.query(
      `UPDATE fidelizacion_recomendacion
       SET vendedora_id = ?,
           estado = ?,
           estado_updated_at = NOW(),
           estado_updated_by = ?
       WHERE id = ?`,
      [destinoId, currentEstado === 'CONTACTADA' ? 'CONTACTADA' : 'PENDIENTE', context.userName || req.user?.name || '', recId]
    );
    await insertFidelizacionTransferLog(conn, {
      recomendacion_id: current.id,
      run_id: current.run_id,
      cliente_id: current.cliente_id,
      action: 'TRANSFERIR',
      from_vendedora_id: current.vendedora_id ? Number(current.vendedora_id) : null,
      to_vendedora_id: destinoId,
      motivo,
      actor_user_id: context.userId,
      actor_nombre: context.userName,
    });
    await conn.commit();
    res.json({ ok: true });
  } catch (error) {
    if (conn) {
      try {
        await conn.rollback();
      } catch (_err) {}
    }
    res.status(500).json({ message: 'Error al transferir recomendacion', error: error.message });
  } finally {
    if (conn) conn.release();
  }
});

app.post('/api/fidelizacion/recomendaciones/:id/contactar', async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const context = await getFidelizacionUserContext(conn, req.user?.id);
    if (!context) return res.status(401).json({ message: 'Usuario invalido' });
    const recId = Number(req.params.id);
    const recIdBody = Number(req.body?.recomendacion_id);
    const canal = String(req.body?.canal || '').trim().toLowerCase();
    const ofertaEnviada = String(req.body?.oferta_enviada || '').trim();
    const notas = String(req.body?.notas || '').trim();
    if (!recId || !canal) return res.status(400).json({ message: 'Recomendacion y canal son obligatorios' });
    if (!recIdBody) {
      return res.status(400).json({ message: 'recomendacion_id es obligatorio' });
    }
    if (recIdBody !== recId) {
      return res.status(400).json({ message: 'recomendacion_id no coincide con la URL' });
    }
    await conn.beginTransaction();
    const [[current]] = await conn.query(
      `SELECT id, run_id, cliente_id, estado, vendedora_id, oferta_detalle
       FROM fidelizacion_recomendacion
       WHERE id = ?
       LIMIT 1`,
      [recId]
    );
    if (!current) {
      await conn.rollback();
      return res.status(404).json({ message: 'Recomendacion no encontrada' });
    }
    if (!['PENDIENTE', 'EN_GESTION'].includes(String(current.estado || '').toUpperCase())) {
      await conn.rollback();
      return res.status(400).json({ message: 'Solo se puede contactar desde PENDIENTE o EN_GESTION' });
    }
    if (!context.isAdmin && Number(current.vendedora_id) !== Number(context.vendedoraId)) {
      await conn.rollback();
      return res.status(403).json({ message: 'Solo podes contactar recomendaciones propias' });
    }
    await conn.query(
      `INSERT INTO fidelizacion_contacto
       (recomendacion_id, run_id, cliente_id, vendedora_id, canal, oferta_enviada, contacted_at, notas)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), ?)`,
      [
        recId,
        Number(current.run_id),
        Number(current.cliente_id),
        current.vendedora_id ? Number(current.vendedora_id) : context.vendedoraId,
        canal,
        ofertaEnviada || current.oferta_detalle || '',
        notas || null,
      ]
    );
    await conn.query(
      `UPDATE fidelizacion_recomendacion
       SET estado = 'CONTACTADA',
           contactado_at = NOW(),
           estado_updated_at = NOW(),
           estado_updated_by = ?
       WHERE id = ?`,
      [context.userName || req.user?.name || '', recId]
    );
    await conn.commit();
    res.json({ ok: true });
  } catch (error) {
    if (conn) {
      try {
        await conn.rollback();
      } catch (_err) {}
    }
    res.status(500).json({ message: 'Error al registrar contacto', error: error.message });
  } finally {
    if (conn) conn.release();
  }
});

app.post('/api/fidelizacion/recomendaciones/:id/cerrar', async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const context = await getFidelizacionUserContext(conn, req.user?.id);
    if (!context) return res.status(401).json({ message: 'Usuario invalido' });
    const recId = Number(req.params.id);
    if (!recId) return res.status(400).json({ message: 'Recomendacion invalida' });
    const actorName = context.userName || req.user?.name || req.user?.email || '';
    const resultadoCodes = await getFidelizacionResultadoCodes(conn);
    await conn.beginTransaction();
    const [[current]] = await conn.query(
      `SELECT id, cliente_id, estado, vendedora_id, created_at, conversion_deadline_at
       FROM fidelizacion_recomendacion
       WHERE id = ?
       LIMIT 1`,
      [recId]
    );
    if (!current) {
      await conn.rollback();
      return res.status(404).json({ message: 'Recomendacion no encontrada' });
    }
    const currentEstado = String(current.estado || '').toUpperCase();
    if (currentEstado === 'CERRADA') {
      await conn.rollback();
      return res.status(400).json({ message: 'La recomendacion ya esta cerrada' });
    }
    if (!['PENDIENTE', 'EN_GESTION', 'CONTACTADA'].includes(currentEstado)) {
      await conn.rollback();
      return res.status(400).json({ message: 'Solo se puede cerrar desde PENDIENTE, EN_GESTION o CONTACTADA' });
    }
    if (!context.isAdmin && Number(current.vendedora_id) !== Number(context.vendedoraId)) {
      await conn.rollback();
      return res.status(403).json({ message: 'Solo podes cerrar recomendaciones propias' });
    }

    const [[pedido]] = await conn.query(
      `SELECT cp.id, cp.fecha, cp.total
       FROM controlpedidos cp
       WHERE cp.id_cliente = ?
         AND cp.fecha >= DATE(?)
       ORDER BY cp.fecha ASC
       LIMIT 1`,
      [Number(current.cliente_id), current.created_at]
    );

    const conversionDeadline = current.conversion_deadline_at ? new Date(current.conversion_deadline_at) : null;
    const pedidoFecha = pedido?.fecha ? new Date(pedido.fecha) : null;
    const withinWindow =
      Boolean(pedidoFecha) && Boolean(conversionDeadline) && pedidoFecha.getTime() <= conversionDeadline.getTime();
    const conversionReasonCode = String(req.body?.conversion_reason_code || '').trim();
    const conversionReasonNoteRaw = String(req.body?.conversion_reason_note || '').trim();
    const conversionReasonNote = conversionReasonNoteRaw ? conversionReasonNoteRaw.slice(0, 255) : null;
    const manualOrderNumber = String(req.body?.manual_order_number || req.body?.nropedido || '').trim();
    const manualMatchNoteRaw = String(req.body?.conversion_match_note || '').trim();
    const manualMatchNote = manualMatchNoteRaw ? manualMatchNoteRaw.slice(0, 255) : null;
    const conversionReasonCatalog = pedido ? await listFidelizacionConversionReasonsCatalogo(conn) : [];
    const conversionReasonCodeSet = new Set(
      conversionReasonCatalog.map((row) => String(row.codigo || '').trim().toUpperCase()).filter(Boolean)
    );

    const validatePedidoAvailability = async (pedidoId) => {
      const [[existing]] = await conn.query(
        `SELECT id
         FROM fidelizacion_recomendacion
         WHERE pedido_id = ?
           AND id <> ?
           AND estado = 'CERRADA'
           AND resultado IN (?, ?)
         LIMIT 1`,
        [Number(pedidoId), recId, resultadoCodes.convertida, resultadoCodes.convertidaFueraVentana]
      );
      return !existing;
    };

    if (pedido && withinWindow) {
      if (!conversionReasonCode) {
        await conn.rollback();
        return res.status(409).json({
          requires_conversion_reason: true,
          mode: 'AUTO_CONVERSION',
          message: 'Debe indicar motivo de conversion para cerrar una convertida.',
          pedido: { id: Number(pedido.id), fecha: pedido.fecha, total: pedido.total == null ? null : Number(pedido.total) },
        });
      }
      if (!conversionReasonCodeSet.has(conversionReasonCode.toUpperCase())) {
        await conn.rollback();
        return res.status(400).json({ message: 'Motivo de conversion invalido' });
      }
      await conn.query(
        `UPDATE fidelizacion_recomendacion
         SET estado = 'CERRADA',
             resultado = ?,
             conversion_reason_code = ?,
             conversion_reason_note = ?,
             conversion_match_type = 'DIRECT',
             conversion_match_note = NULL,
             conversion_match_by = NULL,
             conversion_match_at = NOW(),
             pedido_id = ?,
             converted_at = ?,
             conversion_amount = ?,
             closed_reason = 'AUTO_CONVERSION',
             closed_at = NOW(),
             estado_updated_at = NOW(),
             estado_updated_by = ?
         WHERE id = ?`,
        [
          resultadoCodes.convertida,
          conversionReasonCode,
          conversionReasonNote,
          Number(pedido.id),
          pedido.fecha,
          pedido.total == null ? null : Number(pedido.total),
          actorName,
          recId,
        ]
      );
      await conn.commit();
      return res.json({
        ok: true,
        mode: 'AUTO_CONVERSION',
        message: 'Felicitaciones por su venta!!!',
        pedido: { id: Number(pedido.id), fecha: pedido.fecha, total: pedido.total == null ? null : Number(pedido.total) },
      });
    }

    if (pedido && !withinWindow) {
      if (!conversionReasonCode) {
        await conn.rollback();
        return res.status(409).json({
          requires_conversion_reason: true,
          mode: 'AUTO_CONVERSION_OUT_OF_WINDOW',
          message: 'Debe indicar motivo de conversion para cerrar una convertida fuera de ventana.',
          pedido: { id: Number(pedido.id), fecha: pedido.fecha, total: pedido.total == null ? null : Number(pedido.total) },
        });
      }
      if (!conversionReasonCodeSet.has(conversionReasonCode.toUpperCase())) {
        await conn.rollback();
        return res.status(400).json({ message: 'Motivo de conversion invalido' });
      }
      await conn.query(
        `UPDATE fidelizacion_recomendacion
         SET estado = 'CERRADA',
             resultado = ?,
             conversion_reason_code = ?,
             conversion_reason_note = ?,
             conversion_match_type = 'DIRECT',
             conversion_match_note = NULL,
             conversion_match_by = NULL,
             conversion_match_at = NOW(),
             pedido_id = ?,
             converted_at = ?,
             conversion_amount = ?,
             closed_reason = 'AUTO_CONVERSION_OUT_OF_WINDOW',
             closed_at = NOW(),
             estado_updated_at = NOW(),
             estado_updated_by = ?
         WHERE id = ?`,
        [
          resultadoCodes.convertidaFueraVentana,
          conversionReasonCode,
          conversionReasonNote,
          Number(pedido.id),
          pedido.fecha,
          pedido.total == null ? null : Number(pedido.total),
          actorName,
          recId,
        ]
      );
      await conn.commit();
      return res.json({
        ok: true,
        mode: 'AUTO_CONVERSION_OUT_OF_WINDOW',
        message: 'Hubo venta, pero fuera de la ventana de conversion.',
        pedido: { id: Number(pedido.id), fecha: pedido.fecha, total: pedido.total == null ? null : Number(pedido.total) },
      });
    }

    if (manualOrderNumber) {
      const [manualCatalogRows] = conversionReasonCatalog.length
        ? [conversionReasonCatalog]
        : [await listFidelizacionConversionReasonsCatalogo(conn)];
      const manualReasonCodeSet = new Set(
        manualCatalogRows.map((row) => String(row.codigo || '').trim().toUpperCase()).filter(Boolean)
      );
      const [[manualPedido]] = await conn.query(
        `SELECT cp.id, cp.nropedido, cp.id_cliente, cp.fecha, cp.total, cp.vendedora,
                CONCAT(COALESCE(c.nombre, ''), ' ', COALESCE(c.apellido, '')) AS cliente
         FROM controlpedidos cp
         LEFT JOIN clientes c ON c.id_clientes = cp.id_cliente
         WHERE TRIM(COALESCE(cp.nropedido, '')) = ?
         ORDER BY cp.fecha DESC, cp.id DESC
         LIMIT 1`,
        [manualOrderNumber]
      );
      if (!manualPedido) {
        await conn.rollback();
        return res.status(404).json({ message: 'No se encontro un pedido con ese numero.' });
      }
      const manualPedidoDate = manualPedido.fecha ? new Date(manualPedido.fecha) : null;
      const createdAtDate = current.created_at ? new Date(current.created_at) : null;
      const createdAtDateOnly = createdAtDate ? new Date(createdAtDate.getFullYear(), createdAtDate.getMonth(), createdAtDate.getDate()) : null;
      const manualPedidoDateOnly = manualPedidoDate
        ? new Date(manualPedidoDate.getFullYear(), manualPedidoDate.getMonth(), manualPedidoDate.getDate())
        : null;
      if (
        !manualPedidoDate ||
        !manualPedidoDateOnly ||
        !createdAtDateOnly ||
        manualPedidoDateOnly.getTime() < createdAtDateOnly.getTime()
      ) {
        await conn.rollback();
        return res.status(400).json({ message: 'El pedido manual debe ser posterior a la creacion de la fidelizacion.' });
      }
      const isAvailable = await validatePedidoAvailability(manualPedido.id);
      if (!isAvailable) {
        await conn.rollback();
        return res.status(409).json({ message: 'Ese pedido ya esta vinculado a otra fidelizacion convertida.' });
      }
      const manualWithinWindow =
        Boolean(conversionDeadline) && manualPedidoDate.getTime() <= conversionDeadline.getTime();
      if (!conversionReasonCode) {
        await conn.rollback();
        return res.status(409).json({
          requires_conversion_reason: true,
          mode: manualWithinWindow ? 'MANUAL_CONVERSION' : 'MANUAL_CONVERSION_OUT_OF_WINDOW',
          message: 'Debe indicar motivo de conversion para guardar el pedido manual.',
          pedido: {
            id: Number(manualPedido.id),
            numero: String(manualPedido.nropedido || '').trim(),
            cliente: String(manualPedido.cliente || '').trim(),
            fecha: manualPedido.fecha,
            total: manualPedido.total == null ? null : Number(manualPedido.total),
            vendedora: String(manualPedido.vendedora || '').trim(),
          },
        });
      }
      if (!manualReasonCodeSet.has(conversionReasonCode.toUpperCase())) {
        await conn.rollback();
        return res.status(400).json({ message: 'Motivo de conversion invalido' });
      }
      await conn.query(
        `UPDATE fidelizacion_recomendacion
         SET estado = 'CERRADA',
             resultado = ?,
             conversion_reason_code = ?,
             conversion_reason_note = ?,
             conversion_match_type = 'MANUAL_PEDIDO',
             conversion_match_note = ?,
             conversion_match_by = ?,
             conversion_match_at = NOW(),
             pedido_id = ?,
             converted_at = ?,
             conversion_amount = ?,
             closed_reason = ?,
             closed_at = NOW(),
             estado_updated_at = NOW(),
             estado_updated_by = ?
         WHERE id = ?`,
        [
          manualWithinWindow ? resultadoCodes.convertida : resultadoCodes.convertidaFueraVentana,
          conversionReasonCode,
          conversionReasonNote,
          manualMatchNote,
          actorName,
          Number(manualPedido.id),
          manualPedido.fecha,
          manualPedido.total == null ? null : Number(manualPedido.total),
          manualWithinWindow ? 'MANUAL_PEDIDO' : 'MANUAL_PEDIDO_OUT_OF_WINDOW',
          actorName,
          recId,
        ]
      );
      await conn.commit();
      return res.json({
        ok: true,
        mode: manualWithinWindow ? 'MANUAL_CONVERSION' : 'MANUAL_CONVERSION_OUT_OF_WINDOW',
        message: manualWithinWindow
          ? 'Se vinculo manualmente un pedido como conversion.'
          : 'Se vinculo manualmente un pedido como conversion fuera de ventana.',
        pedido: {
          id: Number(manualPedido.id),
          numero: String(manualPedido.nropedido || '').trim(),
          cliente: String(manualPedido.cliente || '').trim(),
          fecha: manualPedido.fecha,
          total: manualPedido.total == null ? null : Number(manualPedido.total),
          vendedora: String(manualPedido.vendedora || '').trim(),
        },
      });
    }

    const motivo = String(req.body?.closed_reason || req.body?.motivo || '').trim();
    if (!motivo) {
      await conn.rollback();
      return res.status(409).json({
        requires_manual_close: true,
        message: 'Debe indicar motivo para cerrar sin pedido.',
      });
    }
    if (conversionReasonCode) {
      await conn.rollback();
      return res.status(400).json({ message: 'El motivo de conversion solo aplica a resultados convertidos' });
    }

    await conn.query(
      `UPDATE fidelizacion_recomendacion
       SET estado = 'CERRADA',
           resultado = ?,
           conversion_reason_code = NULL,
           conversion_reason_note = NULL,
           conversion_match_type = NULL,
           conversion_match_note = NULL,
           conversion_match_by = NULL,
           conversion_match_at = NULL,
           pedido_id = NULL,
           converted_at = NULL,
           conversion_amount = NULL,
           closed_reason = ?,
           closed_at = NOW(),
           estado_updated_at = NOW(),
           estado_updated_by = ?
       WHERE id = ?`,
      [resultadoCodes.noConvertida, motivo, actorName, recId]
    );
    await conn.commit();
    return res.json({ ok: true, mode: 'MANUAL_NO_ORDER', message: 'Fidelizacion cerrada manualmente sin pedido.' });
  } catch (error) {
    if (conn) {
      try {
        await conn.rollback();
      } catch (_err) {}
    }
    res.status(500).json({ message: 'Error al cerrar recomendacion', error: error.message });
  } finally {
    if (conn) conn.release();
  }
});

app.post('/api/fidelizacion/recomendaciones/:id/reabrir', async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const context = await getFidelizacionUserContext(conn, req.user?.id);
    if (!context) return res.status(401).json({ message: 'Usuario invalido' });
    const recId = Number(req.params.id);
    if (!recId) return res.status(400).json({ message: 'Recomendacion invalida' });
    await conn.beginTransaction();
    const [[current]] = await conn.query(
      `SELECT id, run_id, cliente_id, estado, vendedora_id
       FROM fidelizacion_recomendacion
       WHERE id = ?
       LIMIT 1`,
      [recId]
    );
    if (!current) {
      await conn.rollback();
      return res.status(404).json({ message: 'Recomendacion no encontrada' });
    }
    if (String(current.estado || '').toUpperCase() !== 'CERRADA') {
      await conn.rollback();
      return res.status(400).json({ message: 'Solo se puede reabrir una recomendacion cerrada' });
    }
    if (!context.isAdmin && Number(current.vendedora_id) !== Number(context.vendedoraId)) {
      await conn.rollback();
      return res.status(403).json({ message: 'Solo podes reabrir recomendaciones propias' });
    }
    await conn.query(
      `DELETE FROM fidelizacion_contacto
       WHERE recomendacion_id = ?`,
      [recId]
    );
    await conn.query(
      `DELETE FROM fidelizacion_notas
       WHERE recomendacion_id = ?`,
      [recId]
    );
    await conn.query(
      `UPDATE fidelizacion_recomendacion
       SET estado = 'PENDIENTE',
           resultado = NULL,
           conversion_reason_code = NULL,
           conversion_reason_note = NULL,
           conversion_match_type = NULL,
           conversion_match_note = NULL,
           conversion_match_by = NULL,
           conversion_match_at = NULL,
           pedido_id = NULL,
           converted_at = NULL,
           conversion_amount = NULL,
           closed_reason = NULL,
           closed_at = NULL,
           estado_updated_at = NOW(),
           estado_updated_by = ?
       WHERE id = ?`,
      [context.userName || req.user?.name || '', recId]
    );
    await insertFidelizacionTransferLog(conn, {
      recomendacion_id: current.id,
      run_id: current.run_id,
      cliente_id: current.cliente_id,
      action: 'LIBERAR',
      from_vendedora_id: current.vendedora_id ? Number(current.vendedora_id) : null,
      to_vendedora_id: current.vendedora_id ? Number(current.vendedora_id) : null,
      motivo: 'Reapertura manual',
      actor_user_id: context.userId,
      actor_nombre: context.userName,
    });
    await conn.commit();
    res.json({ ok: true });
  } catch (error) {
    if (conn) {
      try {
        await conn.rollback();
      } catch (_err) {}
    }
    res.status(500).json({ message: 'Error al reabrir recomendacion', error: error.message });
  } finally {
    if (conn) conn.release();
  }
});

app.post('/api/fidelizacion/resultados/recalcular', async (req, res) => {
  return res.status(410).json({
    message: 'Proceso deshabilitado. El resultado se define al cerrar la fidelizacion.',
  });
});

function resolveFidelizacionDashboardScope(scopeRaw, runIdRaw) {
  const scope = String(scopeRaw || 'run').trim().toLowerCase() === 'all' ? 'all' : 'run';
  const runId = Number(runIdRaw) || 0;
  return { scope, runId };
}

async function loadFidelizacionRunById(conn, runId) {
  if (!runId) return null;
  const [[runRow]] = await conn.query(
    `SELECT id, run_date, created_at, params_json, config_id
     FROM fidelizacion_run
     WHERE id = ?
     LIMIT 1`,
    [runId]
  );
  if (!runRow) return null;
  return {
    id: Number(runRow.id),
    run_date: runRow.run_date,
    created_at: runRow.created_at,
    config_id: runRow.config_id ? Number(runRow.config_id) : null,
    params_json: parseMaybeJson(runRow.params_json),
  };
}

function shiftMonths(dateValue, months) {
  const base = dateValue instanceof Date ? new Date(dateValue) : new Date(dateValue);
  const next = new Date(base);
  next.setMonth(next.getMonth() + Number(months || 0));
  return next;
}

function pushFidelizacionSignal(list, text) {
  const value = String(text || '').trim();
  if (!value) return;
  if (!list.includes(value)) list.push(value);
}

function getFidelizacionNoConversionReasonGuidance(reasonCodeRaw) {
  const code = String(reasonCodeRaw || '').trim().toUpperCase();
  const map = {
    PRECIO: {
      tooltip:
        'Si domina este motivo, revisar propuesta comercial, beneficio ofrecido y sensibilidad del cliente al ticket.',
      cross_analysis: 'Cruzar con ticket promedio, monto objetivo, score y vendedora.',
      practical:
        'El foco principal parece comercial: revisar propuesta, rango de beneficio y posicionamiento de valor antes de exigir mas gestion.',
    },
    NO_RESPONDIO: {
      tooltip:
        'Si domina este motivo, revisar velocidad, canal, horario y cantidad de intentos de seguimiento.',
      cross_analysis: 'Cruzar con tiempo al primer contacto, canal usado y performance por vendedora.',
      practical:
        'El principal ajuste parece operativo: mejorar velocidad y disciplina de contacto antes de cambiar la oferta.',
    },
    SIN_INTERES: {
      tooltip:
        'Si domina este motivo, revisar segmentacion y encaje real entre oferta, momento y perfil del cliente.',
      cross_analysis: 'Cruzar con score, frecuencia previa y origen/encuesta del cliente.',
      practical:
        'La oportunidad parece estar en segmentacion: conviene revisar a que clientes se contacta y con que propuesta.',
    },
    COMPRA_POSTERGADA: {
      tooltip:
        'Si domina este motivo, hay intencion pero el momento de compra no coincide con el de la accion comercial.',
      cross_analysis: 'Cruzar con recency, mes de ultima compra y conversiones posteriores.',
      practical:
        'La mejora probable esta en timing y recontacto: no necesariamente en precio, sino en volver a contactar en otra ventana.',
    },
    SIN_STOCK: {
      tooltip:
        'Si domina este motivo, la limitacion principal parece operativa y de disponibilidad, no de interes del cliente.',
      cross_analysis: 'Cruzar con oferta enviada, categoria de producto y fecha de contacto.',
      practical:
        'El cuello de botella parece operativo: revisar stock, sustitutos y coordinacion entre venta y disponibilidad.',
    },
    OTRO: {
      tooltip:
        'Si domina este motivo, la calidad de cierre no esta estandarizada y se pierde capacidad analitica.',
      cross_analysis: 'Cruzar con detalle textual del cierre y vendedora para depurar motivos.',
      practical:
        'Hace falta ordenar mejor la carga de motivos para no perder lectura accionable del proceso.',
    },
    SIN_DATO: {
      tooltip: 'Hay cierres sin motivo claro registrado, lo que reduce la capacidad de analisis.',
      cross_analysis: 'Cruzar con usuario/vendedora y fecha de cierre para detectar problemas de carga.',
      practical: 'Primero conviene mejorar la calidad del dato antes de sacar conclusiones comerciales fuertes.',
    },
  };
  return (
    map[code] || {
      tooltip:
        'Motivo nuevo o no clasificado automaticamente. Conviene revisar su significado y decidir si merece una categoria propia.',
      cross_analysis: 'Cruzar con vendedora, tiempo de contacto, score y detalle textual del cierre.',
      practical:
        'Hay motivos no estandarizados; conviene validar si corresponden a una nueva categoria analitica o a un problema de carga.',
      needs_ai: true,
    }
  );
}

function buildFidelizacionNoConversionReading(reasonRows = []) {
  const safeRows = Array.isArray(reasonRows) ? reasonRows.filter((row) => Number(row?.value || 0) > 0) : [];
  if (!safeRows.length) {
    return {
      cross_default: 'Pasa el mouse por una barra para ver la orientacion por motivo.',
      practical:
        'Todavia no hay suficientes no convertidas con motivo cargado para construir una lectura accionable.',
      needs_ai: false,
    };
  }
  const ordered = safeRows.slice().sort((a, b) => Number(b.value || 0) - Number(a.value || 0));
  const top = ordered[0];
  const topGuide = getFidelizacionNoConversionReasonGuidance(top?.label || '');
  const total = ordered.reduce((acc, row) => acc + (Number(row.value) || 0), 0);
  const topPct = total ? round2(((Number(top?.value || 0) || 0) / total) * 100) : 0;
  const second = ordered[1] || null;
  const secondCode = String(second?.label || '').trim();
  const practical =
    second && Number(second.value || 0) > 0
      ? `${topGuide.practical} Hoy domina ${String(top?.label || '')} (${topPct}%). El segundo motivo es ${secondCode}, por lo que conviene priorizar primero esa friccion dominante y despues validar el patron secundario.`
      : `${topGuide.practical} Hoy domina ${String(top?.label || '')} (${topPct}%), por lo que ese parece ser el principal foco de mejora de la corrida.`;
  return {
    cross_default: topGuide.cross_analysis,
    practical,
    needs_ai: Boolean(topGuide.needs_ai || ordered.some((row) => getFidelizacionNoConversionReasonGuidance(row.label).needs_ai)),
  };
}

function parseFidelizacionClosedReason(reasonRaw) {
  const raw = String(reasonRaw || '').trim();
  const code = raw.split('|')[0].trim().toUpperCase();
  const map = {
    AUTO_CONVERSION: 'Compra dentro de ventana',
    AUTO_CONVERSION_OUT_OF_WINDOW: 'Compra fuera de ventana',
    NO_RESPONDIO: 'No respondio',
    SIN_STOCK: 'Sin stock',
    PRECIO: 'Precio',
    SIN_INTERES: 'Sin interes',
    COMPRA_POSTERGADA: 'Compra postergada',
    OTRO: 'Otro',
  };
  return {
    raw,
    code,
    label: map[code] || raw || '-',
  };
}

function buildFidelizacionOutcomeCode(resultado, resultadoCodes = {}) {
  const normalized = String(resultado || '').trim().toUpperCase();
  if (normalized === String(resultadoCodes.convertida || '').trim().toUpperCase()) return 'CONVERTIDA_EN_VENTANA';
  if (normalized === String(resultadoCodes.convertidaFueraVentana || '').trim().toUpperCase()) {
    return 'CONVERTIDA_FUERA_VENTANA';
  }
  return 'NO_CONVERTIDA';
}

function classifyFidelizacionPurchasePhase(fechaRaw, createdAtRaw, deadlineRaw) {
  const fecha = fechaRaw ? new Date(fechaRaw) : null;
  const createdAt = createdAtRaw ? new Date(createdAtRaw) : null;
  const deadline = deadlineRaw ? new Date(deadlineRaw) : null;
  if (!fecha || Number.isNaN(fecha.getTime()) || !createdAt || Number.isNaN(createdAt.getTime())) {
    return { phase: 'before', phase_label: 'Previa' };
  }
  if (fecha.getTime() < createdAt.getTime()) return { phase: 'before', phase_label: 'Previa' };
  if (deadline && !Number.isNaN(deadline.getTime()) && fecha.getTime() <= deadline.getTime()) {
    return { phase: 'window', phase_label: 'En ventana' };
  }
  return { phase: 'after', phase_label: 'Posterior' };
}

function buildFidelizacionPurchasesSummary(rows = []) {
  const summary = {
    prev_count: 0,
    prev_total: 0,
    window_count: 0,
    window_total: 0,
    after_count: 0,
    after_total: 0,
  };
  (rows || []).forEach((row) => {
    const phase = String(row.phase || '').trim().toLowerCase();
    if (phase === 'window') {
      summary.window_count += 1;
      summary.window_total += Number(row.total) || 0;
      return;
    }
    if (phase === 'after') {
      summary.after_count += 1;
      summary.after_total += Number(row.total) || 0;
      return;
    }
    summary.prev_count += 1;
    summary.prev_total += Number(row.total) || 0;
  });
  summary.prev_total = round2(summary.prev_total);
  summary.window_total = round2(summary.window_total);
  summary.after_total = round2(summary.after_total);
  return summary;
}

function buildFidelizacionAnalysisSummary(payload = {}) {
  const recommendation = payload.recommendation || {};
  const metrics = payload.metrics || {};
  const purchasesSummary = payload.compras?.summary || {};
  const outcome = String(payload.outcome || '').trim().toUpperCase();
  const closedReason = parseFidelizacionClosedReason(recommendation.closed_reason);
  const favorables = [];
  const riesgos = [];

  if (metrics.contactos_count > 0) {
    pushFidelizacionSignal(favorables, `Se registraron ${metrics.contactos_count} contactos sobre la fidelizacion.`);
  } else {
    pushFidelizacionSignal(riesgos, 'No hay contactos registrados para esta fidelizacion.');
  }

  if (metrics.notas_count > 0) {
    pushFidelizacionSignal(favorables, `Hubo seguimiento documentado con ${metrics.notas_count} nota(s).`);
  } else {
    pushFidelizacionSignal(riesgos, 'No hay notas de seguimiento registradas.');
  }

  if (metrics.horas_a_contacto != null) {
    if (Number(metrics.horas_a_contacto) <= 24) {
      pushFidelizacionSignal(favorables, `El primer contacto llego rapido (${round2(metrics.horas_a_contacto)} hs).`);
    } else if (Number(metrics.horas_a_contacto) > 48) {
      pushFidelizacionSignal(riesgos, `El primer contacto fue tardio (${round2(metrics.horas_a_contacto)} hs).`);
    }
  }

  if (Number(recommendation.frequency_12m || 0) >= 3) {
    pushFidelizacionSignal(
      favorables,
      `El cliente venia con recurrencia previa (${Number(recommendation.frequency_12m || 0)} compras en 12 meses).`
    );
  } else if (Number(recommendation.frequency_12m || 0) <= 1) {
    pushFidelizacionSignal(riesgos, 'El cliente tenia baja recurrencia previa al contacto.');
  }

  if (Number(recommendation.recency_days || 0) > 0 && Number(recommendation.recency_days || 0) <= 15) {
    pushFidelizacionSignal(riesgos, 'La fidelizacion se activo muy cerca de una compra previa; puede haber poco sentido de recompra.');
  } else if (Number(recommendation.recency_days || 0) >= 30 && Number(recommendation.recency_days || 0) <= 90) {
    pushFidelizacionSignal(favorables, 'La ultima compra estaba en una ventana razonable para intentar recompra.');
  }

  if (outcome === 'CONVERTIDA_EN_VENTANA') {
    pushFidelizacionSignal(favorables, 'Hubo compra dentro de la ventana esperada de conversion.');
  }
  if (outcome === 'CONVERTIDA_FUERA_VENTANA') {
    pushFidelizacionSignal(riesgos, 'El cliente compro, pero fuera de la ventana definida para atribucion.');
    pushFidelizacionSignal(favorables, 'La gestion puede haber influido, aunque con timing tardio.');
  }
  if (outcome === 'NO_CONVERTIDA') {
    pushFidelizacionSignal(riesgos, `La fidelizacion se cerro sin compra. Motivo declarado: ${closedReason.label}.`);
  }

  if (closedReason.code === 'PRECIO') {
    pushFidelizacionSignal(riesgos, 'El cierre por precio sugiere friccion de propuesta o sensibilidad al valor ofrecido.');
  }
  if (closedReason.code === 'NO_RESPONDIO') {
    pushFidelizacionSignal(riesgos, 'No hubo respuesta del cliente; revisar canal, mensaje y velocidad del contacto.');
  }
  if (closedReason.code === 'SIN_INTERES') {
    pushFidelizacionSignal(riesgos, 'El cliente no mostro interes en la propuesta actual.');
  }
  if (closedReason.code === 'COMPRA_POSTERGADA') {
    pushFidelizacionSignal(riesgos, 'La necesidad de compra parece diferida en el tiempo.');
  }

  if (Number(purchasesSummary.window_count || 0) > 0) {
    pushFidelizacionSignal(favorables, `Se detectaron ${purchasesSummary.window_count} compra(s) dentro de la ventana de seguimiento.`);
  } else if (outcome === 'NO_CONVERTIDA') {
    pushFidelizacionSignal(riesgos, 'No hubo compras dentro de la ventana de conversion.');
  }

  if (Number(purchasesSummary.after_count || 0) > 0 && Number(purchasesSummary.window_count || 0) === 0) {
    pushFidelizacionSignal(riesgos, 'El cliente volvio a comprar despues de la ventana; revisar timing y oportunidad de contacto.');
  }

  if (
    recommendation.conversion_amount != null &&
    Number(recommendation.avg_ticket_12m || 0) > 0 &&
    Number(recommendation.conversion_amount || 0) >= Number(recommendation.avg_ticket_12m || 0)
  ) {
    pushFidelizacionSignal(favorables, 'La compra convertida quedo alineada o por encima del ticket promedio historico.');
  }

  const headlineMap = {
    CONVERTIDA_EN_VENTANA: 'El cliente convirtio dentro de la ventana y la gestion llego a tiempo.',
    CONVERTIDA_FUERA_VENTANA: 'La gestion termino en compra, pero la conversion llego tarde respecto de la ventana esperada.',
    NO_CONVERTIDA: `La fidelizacion no convirtio y el cierre principal fue: ${closedReason.label}.`,
  };

  const lectura = [];
  if (outcome === 'CONVERTIDA_EN_VENTANA') {
    lectura.push('El caso muestra una respuesta comercial positiva dentro del plazo esperado.');
  } else if (outcome === 'CONVERTIDA_FUERA_VENTANA') {
    lectura.push('El cliente termino comprando, pero el momento de la recompra quedo fuera de la ventana atribuida.');
  } else {
    lectura.push('El seguimiento no logro cerrar una compra dentro de la ventana de conversion.');
  }
  if (metrics.horas_a_contacto != null) {
    lectura.push(`Tiempo al primer contacto: ${round2(metrics.horas_a_contacto)} horas.`);
  } else {
    lectura.push('No hay registro de contacto formal en la recomendacion.');
  }
  lectura.push(
    `Historial previo: ${Number(recommendation.frequency_12m || 0)} compra(s) en 12 meses, ticket promedio ${round2(
      recommendation.avg_ticket_12m || 0
    )}.`
  );
  if (closedReason.raw && outcome === 'NO_CONVERTIDA') {
    lectura.push(`Motivo de cierre reportado: ${closedReason.label}.`);
  } else if (recommendation.conversion_reason_label) {
    lectura.push(`Motivo de conversion registrado: ${recommendation.conversion_reason_label}.`);
  }

  return {
    outcome,
    headline: headlineMap[outcome] || 'Analisis del caso disponible.',
    lectura_operativa: lectura.join('\n'),
    favorables,
    riesgos,
  };
}

async function loadFidelizacionRecommendationAnalysis(conn, recId) {
  const recommendationId = Number(recId) || 0;
  if (!recommendationId) return null;
  const resultadoCodes = await getFidelizacionResultadoCodes(conn);
  let conversionReasonMap = new Map();
  try {
    conversionReasonMap = new Map(
      (await listFidelizacionConversionReasonsCatalogo(conn)).map((row) => [
        String(row.codigo || '').trim().toUpperCase(),
        String(row.nombre || '').trim(),
      ])
    );
  } catch (_err) {}
  const [[row]] = await conn.query(
    `SELECT
       r.id AS recomendacion_id,
       r.run_id,
       fr.run_date,
       r.cliente_id,
       CONCAT(COALESCE(c.nombre, ''), ' ', COALESCE(c.apellido, '')) AS cliente,
       COALESCE(c.telefono, '') AS telefono,
       COALESCE(NULLIF(TRIM(c.encuesta), ''), 'Ninguna') AS encuesta,
       r.vendedora_id,
       COALESCE(v.Nombre, 'Sin asignar') AS vendedora,
       r.score,
       r.razones,
       r.oferta_detalle,
       r.tag_top_1,
       r.tag_top_2,
       r.tag_top_3,
       r.attr_top_1,
       r.attr_top_2,
       r.attr_top_3,
       r.last_purchase_date,
       r.recency_days,
       r.frequency_12m,
       r.monetary_12m,
       r.avg_ticket_12m,
       r.created_at,
       r.contactado_at,
       r.closed_at,
       r.conversion_deadline_at,
       r.resultado,
       r.closed_reason,
       r.conversion_reason_code,
       r.conversion_reason_note,
       r.pedido_id,
       cp.nropedido,
       r.converted_at,
       COALESCE(NULLIF(cp.total, 0), r.conversion_amount, 0) AS conversion_amount,
       ROUND(TIMESTAMPDIFF(MINUTE, r.created_at, r.contactado_at) / 60, 1) AS horas_a_contacto
     FROM fidelizacion_recomendacion r
     LEFT JOIN fidelizacion_run fr ON fr.id = r.run_id
     LEFT JOIN clientes c ON c.id_clientes = r.cliente_id
     LEFT JOIN vendedores v ON v.Id = r.vendedora_id
     LEFT JOIN controlpedidos cp ON cp.id = r.pedido_id
     WHERE r.id = ?
     LIMIT 1`,
    [recommendationId]
  );
  if (!row) return null;

  const createdAt = row.created_at ? new Date(row.created_at) : new Date();
  const windowStart = shiftMonths(createdAt, -6);
  const windowEndCandidate = shiftMonths(createdAt, 3);
  const now = new Date();
  const windowEnd = windowEndCandidate.getTime() > now.getTime() ? now : windowEndCandidate;

  const [noteRows] = await conn.query(
    `SELECT
       n.id,
       n.nota,
       n.created_at,
       n.updated_at,
       COALESCE(u.name, '') AS usuario
     FROM fidelizacion_notas n
     LEFT JOIN users u ON u.id = n.users_id
     WHERE n.recomendacion_id = ?
     ORDER BY COALESCE(n.updated_at, n.created_at) ASC, n.id ASC`,
    [recommendationId]
  );

  const [contactRows] = await conn.query(
    `SELECT
       c.id,
       c.canal,
       c.oferta_enviada,
       c.contacted_at,
       c.notas,
       COALESCE(v.Nombre, 'Sin asignar') AS vendedora
     FROM fidelizacion_contacto c
     LEFT JOIN vendedores v ON v.Id = c.vendedora_id
     WHERE c.recomendacion_id = ?
     ORDER BY c.contacted_at ASC, c.id ASC`,
    [recommendationId]
  );

  const [transferRows] = await conn.query(
    `SELECT
       t.id,
       t.action,
       t.motivo,
       t.actor_nombre,
       t.created_at,
       COALESCE(vf.Nombre, 'Sin asignar') AS from_vendedora,
       COALESCE(vt.Nombre, 'Sin asignar') AS to_vendedora
     FROM fidelizacion_transferencia t
     LEFT JOIN vendedores vf ON vf.Id = t.from_vendedora_id
     LEFT JOIN vendedores vt ON vt.Id = t.to_vendedora_id
     WHERE t.recomendacion_id = ?
     ORDER BY t.created_at ASC, t.id ASC`,
    [recommendationId]
  );

  const [purchaseRows] = await conn.query(
    `SELECT
       cp.id AS pedido_id,
       cp.nropedido,
       cp.fecha,
       COALESCE(cp.total, 0) AS total,
       COALESCE(cp.vendedora, '') AS vendedora
     FROM controlpedidos cp
     WHERE cp.id_cliente = ?
       AND cp.fecha >= ?
       AND cp.fecha <= ?
     ORDER BY cp.fecha ASC, cp.id ASC`,
    [Number(row.cliente_id), formatDateTimeLocal(windowStart), formatDateTimeLocal(windowEnd)]
  );

  const outcome = buildFidelizacionOutcomeCode(row.resultado, resultadoCodes);
  const comprasRows = (purchaseRows || []).map((purchase) => {
    const phaseMeta = classifyFidelizacionPurchasePhase(purchase.fecha, row.created_at, row.conversion_deadline_at);
    return {
      pedido_id: Number(purchase.pedido_id) || 0,
      nropedido: purchase.nropedido ? Number(purchase.nropedido) : null,
      fecha: purchase.fecha,
      total: Number(purchase.total) || 0,
      vendedora: String(purchase.vendedora || '').trim() || 'Sin asignar',
      phase: phaseMeta.phase,
      phase_label: phaseMeta.phase_label,
    };
  });
  const comprasSummary = buildFidelizacionPurchasesSummary(comprasRows);

  const timelineEvents = [
    {
      at: row.created_at,
      label: 'Fidelizacion creada',
      detail: row.oferta_detalle ? `Oferta propuesta: ${row.oferta_detalle}` : 'Se genero la recomendacion.',
      tone: 'neutral',
    },
  ];
  (transferRows || []).forEach((transfer) => {
    const action = String(transfer.action || '').trim().toUpperCase();
    const transferLabel = action === 'TOMAR' ? 'Fidelizacion tomada' : 'Fidelizacion transferida';
    const transferDetail =
      action === 'TOMAR'
        ? `${transfer.actor_nombre || transfer.to_vendedora || 'Usuario'} tomo el caso. Motivo: ${transfer.motivo || '-'}`
        : `De ${transfer.from_vendedora || 'Sin asignar'} a ${transfer.to_vendedora || 'Sin asignar'}. Motivo: ${
            transfer.motivo || '-'
          }`;
    timelineEvents.push({
      at: transfer.created_at,
      label: transferLabel,
      detail: transferDetail,
      tone: action === 'TOMAR' ? 'positive' : 'neutral',
    });
  });
  (contactRows || []).forEach((contact) => {
    timelineEvents.push({
      at: contact.contacted_at,
      label: `Contacto por ${String(contact.canal || '').trim() || 'canal sin dato'}`,
      detail: `${contact.vendedora || 'Sin asignar'} envio: ${contact.oferta_enviada || '-'}${
        contact.notas ? ` | Notas: ${contact.notas}` : ''
      }`,
      tone: 'positive',
    });
  });
  (noteRows || []).forEach((note) => {
    timelineEvents.push({
      at: note.updated_at || note.created_at,
      label: 'Nota de seguimiento',
      detail: `${note.usuario || 'Usuario'}: ${note.nota || ''}`,
      tone: 'neutral',
    });
  });
  if (row.closed_at) {
    timelineEvents.push({
      at: row.closed_at,
      label: 'Fidelizacion cerrada',
      detail: `Resultado: ${row.resultado || '-'} | Motivo: ${parseFidelizacionClosedReason(row.closed_reason).label}`,
      tone: outcome === 'NO_CONVERTIDA' ? 'risk' : 'positive',
    });
  }
  timelineEvents.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  const recommendation = {
    recomendacion_id: Number(row.recomendacion_id) || 0,
    run_id: row.run_id ? Number(row.run_id) : null,
    run_date: row.run_date,
    cliente_id: row.cliente_id ? Number(row.cliente_id) : null,
    cliente: String(row.cliente || '').trim(),
    telefono: String(row.telefono || '').trim(),
    encuesta: String(row.encuesta || '').trim() || 'Ninguna',
    vendedora_id: row.vendedora_id ? Number(row.vendedora_id) : null,
    vendedora: String(row.vendedora || '').trim() || 'Sin asignar',
    score: Number(row.score) || 0,
    razones: String(row.razones || '').trim(),
    oferta_detalle: String(row.oferta_detalle || '').trim(),
    tags: [row.tag_top_1, row.tag_top_2, row.tag_top_3].filter(Boolean),
    attrs: [row.attr_top_1, row.attr_top_2, row.attr_top_3].filter(Boolean),
    last_purchase_date: row.last_purchase_date,
    recency_days: row.recency_days == null ? null : Number(row.recency_days),
    frequency_12m: Number(row.frequency_12m) || 0,
    monetary_12m: Number(row.monetary_12m) || 0,
    avg_ticket_12m: Number(row.avg_ticket_12m) || 0,
    created_at: row.created_at,
    contactado_at: row.contactado_at,
    closed_at: row.closed_at,
    conversion_deadline_at: row.conversion_deadline_at,
    resultado: row.resultado || '',
    closed_reason: row.closed_reason || '',
    closed_reason_label: parseFidelizacionClosedReason(row.closed_reason).label,
    conversion_reason_code: row.conversion_reason_code || '',
    conversion_reason_note: row.conversion_reason_note || '',
    conversion_reason_label:
      conversionReasonMap.get(String(row.conversion_reason_code || '').trim().toUpperCase()) || '',
    pedido_id: row.pedido_id ? Number(row.pedido_id) : null,
    nropedido: row.nropedido ? Number(row.nropedido) : null,
    converted_at: row.converted_at,
    conversion_amount: row.conversion_amount == null ? null : Number(row.conversion_amount),
  };

  const payload = {
    ai_enabled: Boolean(openai),
    recommendation,
    metrics: {
      horas_a_contacto: row.horas_a_contacto == null ? null : Number(row.horas_a_contacto),
      notas_count: (noteRows || []).length,
      contactos_count: (contactRows || []).length,
      transferencias_count: (transferRows || []).length,
    },
    timeline: {
      events: timelineEvents,
    },
    compras: {
      window: {
        from: formatDateTimeLocal(windowStart),
        to: formatDateTimeLocal(windowEnd),
      },
      summary: comprasSummary,
      rows: comprasRows,
    },
    notes: (noteRows || []).map((note) => ({
      id: Number(note.id) || 0,
      usuario: String(note.usuario || '').trim(),
      nota: String(note.nota || '').trim(),
      created_at: note.created_at,
      updated_at: note.updated_at,
    })),
    contacts: (contactRows || []).map((contact) => ({
      id: Number(contact.id) || 0,
      canal: String(contact.canal || '').trim(),
      oferta_enviada: String(contact.oferta_enviada || '').trim(),
      contacted_at: contact.contacted_at,
      notas: String(contact.notas || '').trim(),
      vendedora: String(contact.vendedora || '').trim(),
    })),
    transfers: (transferRows || []).map((transfer) => ({
      id: Number(transfer.id) || 0,
      action: String(transfer.action || '').trim(),
      motivo: String(transfer.motivo || '').trim(),
      actor_nombre: String(transfer.actor_nombre || '').trim(),
      created_at: transfer.created_at,
      from_vendedora: String(transfer.from_vendedora || '').trim(),
      to_vendedora: String(transfer.to_vendedora || '').trim(),
    })),
  };
  payload.summary = buildFidelizacionAnalysisSummary({
    recommendation,
    metrics: payload.metrics,
    compras: payload.compras,
    outcome,
  });
  return payload;
}

app.get(['/api/fidelizacion/runs', '/fidelizacion/runs'], async (req, res) => {
  try {
    const context = await getFidelizacionUserContext(pool, req.user?.id);
    if (!context) return res.status(401).json({ message: 'Usuario invalido' });
    if (!context.isAdmin) return res.status(403).json({ message: 'Solo Admin puede ver corridas' });
    const resultadoCodes = await getFidelizacionResultadoCodes(pool);
    const [rows] = await pool.query(
      `SELECT
         fr.id,
         fr.run_date,
         fr.created_at,
         fr.config_id,
         fr.beneficios_updated_at,
         COUNT(r.id) AS total,
         SUM(r.estado='CERRADA') AS finalizadas,
         SUM(r.resultado IN (?,?)) AS convertidas,
         SUM(r.beneficio_estado='OK') AS beneficios_ok,
         SUM(r.beneficio_estado='ERROR') AS beneficios_error,
         COALESCE(
           SUM(
             CASE
               WHEN r.resultado IN (?,?)
               THEN r.conversion_amount
               ELSE 0
             END
           ), 0
         ) AS monto_convertido,
         ROUND(
           100 * SUM(r.resultado IN (?,?)) / NULLIF(COUNT(r.id),0),
           1
         ) AS tasa_conversion
       FROM fidelizacion_run fr
       LEFT JOIN fidelizacion_recomendacion r ON r.run_id = fr.id
       GROUP BY fr.id, fr.run_date, fr.created_at, fr.config_id, fr.beneficios_updated_at
       ORDER BY fr.run_date DESC, fr.id DESC`,
      [
        resultadoCodes.convertida,
        resultadoCodes.convertidaFueraVentana,
        resultadoCodes.convertida,
        resultadoCodes.convertidaFueraVentana,
        resultadoCodes.convertida,
        resultadoCodes.convertidaFueraVentana,
      ]
    );
    res.json({ data: rows || [] });
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar corridas de fidelizacion', error: error.message });
  }
});

app.get('/api/fidelizacion/runs/:id/beneficios-config', async (req, res) => {
  try {
    const context = await getFidelizacionUserContext(pool, req.user?.id);
    if (!context) return res.status(401).json({ message: 'Usuario invalido' });
    if (!context.isAdmin) return res.status(403).json({ message: 'Solo Admin puede gestionar beneficios IA' });
    const runId = Number(req.params.id);
    if (!runId) return res.status(400).json({ message: 'Corrida invalida' });

    const [[runRow]] = await pool.query(
      `SELECT id, beneficios_prompt, beneficios_model, beneficios_updated_by, beneficios_updated_at
       FROM fidelizacion_run
       WHERE id = ?
       LIMIT 1`,
      [runId]
    );
    if (!runRow) return res.status(404).json({ message: 'Corrida no encontrada' });

    const [[stats]] = await pool.query(
      `SELECT
         COUNT(*) AS total,
         SUM(beneficio_estado='OK') AS total_ok,
         SUM(beneficio_estado='ERROR') AS total_error
       FROM fidelizacion_recomendacion
       WHERE run_id = ?`,
      [runId]
    );
    const [[lastJob]] = await pool.query(
      `SELECT id
       FROM fidelizacion_beneficios_job
       WHERE run_id = ?
       ORDER BY id DESC
       LIMIT 1`,
      [runId]
    );

    res.json({
      data: {
        run_id: runId,
        prompt: runRow.beneficios_prompt || '',
        model: runRow.beneficios_model || OPENAI_MODEL || 'gpt-4o-mini',
        updated_by: runRow.beneficios_updated_by || '',
        updated_at: runRow.beneficios_updated_at || null,
        last_job_id: Number(lastJob?.id) || 0,
        total: Number(stats?.total) || 0,
        total_ok: Number(stats?.total_ok) || 0,
        total_error: Number(stats?.total_error) || 0,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar configuracion de beneficios IA', error: error.message });
  }
});

app.get('/api/fidelizacion/runs/:id/beneficios/detalle', async (req, res) => {
  try {
    const context = await getFidelizacionUserContext(pool, req.user?.id);
    if (!context) return res.status(401).json({ message: 'Usuario invalido' });
    if (!context.isAdmin) return res.status(403).json({ message: 'Solo Admin puede ver detalle de beneficios IA' });
    const runId = Number(req.params.id);
    const estado = String(req.query.estado || '').trim().toUpperCase();
    let jobId = Number(req.query.job_id) || 0;
    if (!runId) return res.status(400).json({ message: 'Corrida invalida' });
    if (!['OK', 'ERROR'].includes(estado)) return res.status(400).json({ message: 'Estado invalido' });

    if (!jobId) {
      const [[latestJob]] = await pool.query(
        `SELECT id
         FROM fidelizacion_beneficios_job
         WHERE run_id = ?
         ORDER BY id DESC
         LIMIT 1`,
        [runId]
      );
      jobId = Number(latestJob?.id) || 0;
    }
    if (!jobId) return res.json({ data: [], meta: { run_id: runId, job_id: 0, estado } });

    const [rows] = await pool.query(
      `SELECT
         d.id,
         d.job_id,
         d.recomendacion_id,
         d.ticket_promedio,
         d.beneficio_texto,
         d.beneficio_regla,
         d.estado,
         d.error_msg,
         d.created_at,
         CONCAT(COALESCE(c.nombre, ''), ' ', COALESCE(c.apellido, '')) AS cliente
       FROM fidelizacion_beneficios_job_detalle d
       LEFT JOIN fidelizacion_recomendacion r ON r.id = d.recomendacion_id
       LEFT JOIN clientes c ON c.id_clientes = r.cliente_id
       WHERE d.job_id = ?
         AND d.estado = ?
       ORDER BY d.id ASC`,
      [jobId, estado]
    );
    res.json({
      data: rows || [],
      meta: { run_id: runId, job_id: jobId, estado },
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar detalle de beneficios IA', error: error.message });
  }
});

app.put('/api/fidelizacion/runs/:id/beneficios-config', async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const context = await getFidelizacionUserContext(conn, req.user?.id);
    if (!context) return res.status(401).json({ message: 'Usuario invalido' });
    if (!context.isAdmin) return res.status(403).json({ message: 'Solo Admin puede gestionar beneficios IA' });
    const runId = Number(req.params.id);
    if (!runId) return res.status(400).json({ message: 'Corrida invalida' });
    const prompt = String(req.body?.prompt || '').trim();
    if (!prompt) return res.status(400).json({ message: 'Prompt requerido' });
    const model = String(req.body?.model || OPENAI_MODEL || 'gpt-4o-mini').trim();
    const actor = context.userName || req.user?.name || req.user?.email || '';

    const [upd] = await conn.query(
      `UPDATE fidelizacion_run
       SET beneficios_prompt = ?,
           beneficios_model = ?,
           beneficios_updated_by = ?,
           beneficios_updated_at = NOW()
       WHERE id = ?
       LIMIT 1`,
      [prompt, model, actor, runId]
    );
    if (!upd?.affectedRows) return res.status(404).json({ message: 'Corrida no encontrada' });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: 'Error al guardar prompt de beneficios IA', error: error.message });
  } finally {
    if (conn) conn.release();
  }
});

app.post('/api/fidelizacion/runs/:id/beneficios/actualizar', async (req, res) => {
  let conn;
  try {
    if (!openai) return res.status(400).json({ message: 'OPENAI_API_KEY no configurada' });
    const runId = Number(req.params.id);
    if (!runId) return res.status(400).json({ message: 'Corrida invalida' });

    conn = await pool.getConnection();
    const context = await getFidelizacionUserContext(conn, req.user?.id);
    if (!context) return res.status(401).json({ message: 'Usuario invalido' });
    if (!context.isAdmin) return res.status(403).json({ message: 'Solo Admin puede actualizar beneficios IA' });
    const actor = context.userName || req.user?.name || req.user?.email || '';

    const [[runRow]] = await conn.query(
      `SELECT id, beneficios_prompt, beneficios_model
       FROM fidelizacion_run
       WHERE id = ?
       LIMIT 1`,
      [runId]
    );
    if (!runRow) return res.status(404).json({ message: 'Corrida no encontrada' });

    const prompt = String(req.body?.prompt || runRow.beneficios_prompt || '').trim();
    if (!prompt) return res.status(400).json({ message: 'Prompt requerido para generar beneficios' });
    const model = String(req.body?.model || runRow.beneficios_model || OPENAI_MODEL || 'gpt-4o-mini').trim();

    const [targetRows] = await conn.query(
      `SELECT id, avg_ticket_12m
       FROM fidelizacion_recomendacion
       WHERE run_id = ?
       ORDER BY id ASC`,
      [runId]
    );
    const targets = (targetRows || []).map((row) => ({
      recomendacion_id: Number(row.id) || 0,
      ticket_promedio: Number(row.avg_ticket_12m) || 0,
    }));
    if (!targets.length) {
      return res.status(400).json({ message: 'La corrida no tiene fidelizaciones para procesar' });
    }

    const completion = await withRetry(() =>
      openai.chat.completions.create({
        model,
        temperature: 0,
        messages: [
          {
            role: 'system',
            content:
              'Eres un motor de beneficios comerciales. Debes responder SOLO JSON valido y sin texto adicional. ' +
              'Formato obligatorio: {"results":[{"recomendacion_id":123,"beneficio_texto":"...","beneficio_regla":"...","estado":"OK|ERROR","error_msg":""}]}. ' +
              'Si no puedes asignar beneficio, devuelve estado="ERROR" y error_msg.',
          },
          {
            role: 'user',
            content:
              `Politica de beneficios:\n${prompt}\n\n` +
              `Clientes a evaluar (ticket promedio 12m):\n${JSON.stringify(targets)}\n\n` +
              'Reglas de salida: devuelve un objeto por cada recomendacion_id recibido.',
          },
        ],
      })
    );
    const rawResponse = String(completion?.choices?.[0]?.message?.content || '').trim();
    const parsed = extractJsonObjectFromText(rawResponse);
    const results = Array.isArray(parsed?.results) ? parsed.results : [];
    const byId = new Map(
      results
        .map((row) => ({
          recomendacion_id: Number(row?.recomendacion_id) || 0,
          beneficio_texto: String(row?.beneficio_texto || '').trim(),
          beneficio_regla: String(row?.beneficio_regla || '').trim(),
          estado: String(row?.estado || 'OK').trim().toUpperCase() === 'ERROR' ? 'ERROR' : 'OK',
          error_msg: String(row?.error_msg || '').trim(),
        }))
        .filter((row) => row.recomendacion_id > 0)
        .map((row) => [row.recomendacion_id, row])
    );

    await conn.beginTransaction();
    const promptHash = crypto.createHash('sha256').update(prompt).digest('hex');
    const [jobInsert] = await conn.query(
      `INSERT INTO fidelizacion_beneficios_job
       (run_id, total_objetivo, total_ok, total_error, prompt_hash, model, status, created_by, created_at)
       VALUES (?, ?, 0, 0, ?, ?, 'RUNNING', ?, NOW())`,
      [runId, targets.length, promptHash, model, actor]
    );
    const jobId = Number(jobInsert.insertId) || 0;

    let totalOk = 0;
    let totalError = 0;
    for (const target of targets) {
      const mapped = byId.get(target.recomendacion_id);
      const hasBenefit = Boolean(mapped?.beneficio_texto) && mapped?.estado === 'OK';
      const estado = hasBenefit ? 'OK' : 'ERROR';
      const beneficioTexto = hasBenefit ? mapped.beneficio_texto : null;
      const beneficioRegla = hasBenefit ? mapped.beneficio_regla || null : null;
      const errorMsg = hasBenefit
        ? null
        : mapped?.error_msg || 'IA no devolvio beneficio valido para la recomendacion';
      if (hasBenefit) totalOk += 1;
      else totalError += 1;

      await conn.query(
        `UPDATE fidelizacion_recomendacion
         SET beneficio_texto = ?,
             beneficio_regla = ?,
             beneficio_ticket_promedio = ?,
             beneficio_estado = ?,
             beneficio_error = ?,
             beneficio_generated_at = NOW(),
             beneficio_generated_by = ?,
             beneficio_model = ?
         WHERE id = ?
         LIMIT 1`,
        [
          beneficioTexto,
          beneficioRegla,
          target.ticket_promedio,
          estado,
          errorMsg,
          actor,
          model,
          target.recomendacion_id,
        ]
      );

      await conn.query(
        `INSERT INTO fidelizacion_beneficios_job_detalle
         (job_id, recomendacion_id, ticket_promedio, ia_raw_response, beneficio_texto, beneficio_regla, estado, error_msg, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          jobId,
          target.recomendacion_id,
          target.ticket_promedio,
          JSON.stringify(mapped || null),
          beneficioTexto,
          beneficioRegla,
          estado,
          errorMsg,
        ]
      );
    }

    await conn.query(
      `UPDATE fidelizacion_beneficios_job
       SET total_ok = ?, total_error = ?, status = 'DONE', finished_at = NOW()
       WHERE id = ?
       LIMIT 1`,
      [totalOk, totalError, jobId]
    );
    await conn.query(
      `UPDATE fidelizacion_run
       SET beneficios_prompt = ?,
           beneficios_model = ?,
           beneficios_updated_by = ?,
           beneficios_updated_at = NOW()
       WHERE id = ?
       LIMIT 1`,
      [prompt, model, actor, runId]
    );

    await conn.commit();
    res.json({ ok: true, job_id: jobId, total_objetivo: targets.length, total_ok: totalOk, total_error: totalError });
  } catch (error) {
    if (conn) {
      try {
        await conn.rollback();
      } catch (_err) {}
    }
    res.status(500).json({ message: 'Error al actualizar beneficios IA', error: error.message });
  } finally {
    if (conn) conn.release();
  }
});

app.delete('/api/fidelizacion/runs/:id', async (req, res) => {
  let conn;
  try {
    const runId = Number(req.params.id);
    if (!runId) return res.status(400).json({ message: 'Corrida invalida' });

    conn = await pool.getConnection();
    const context = await getFidelizacionUserContext(conn, req.user?.id);
    if (!context) return res.status(401).json({ message: 'Usuario invalido' });
    if (!context.isAdmin) return res.status(403).json({ message: 'Solo Admin puede eliminar corridas' });

    await conn.beginTransaction();

    const [[runRow]] = await conn.query(
      `SELECT id
       FROM fidelizacion_run
       WHERE id = ?
       LIMIT 1`,
      [runId]
    );
    if (!runRow) {
      await conn.rollback();
      return res.status(404).json({ message: 'Corrida no encontrada' });
    }

    const [delNotasJoin] = await conn.query(
      `DELETE n
       FROM fidelizacion_notas n
       INNER JOIN fidelizacion_recomendacion r ON r.id = n.recomendacion_id
       WHERE r.run_id = ?`,
      [runId]
    );

    const [delContactoJoin] = await conn.query(
      `DELETE c
       FROM fidelizacion_contacto c
       INNER JOIN fidelizacion_recomendacion r ON r.id = c.recomendacion_id
       WHERE r.run_id = ?`,
      [runId]
    );

    const [delTransferJoin] = await conn.query(
      `DELETE t
       FROM fidelizacion_transferencia t
       INNER JOIN fidelizacion_recomendacion r ON r.id = t.recomendacion_id
       WHERE r.run_id = ?`,
      [runId]
    );

    const [delContactoRun] = await conn.query(
      'DELETE FROM fidelizacion_contacto WHERE run_id = ?',
      [runId]
    );
    const [delTransferRun] = await conn.query(
      'DELETE FROM fidelizacion_transferencia WHERE run_id = ?',
      [runId]
    );
    const [delBenefitDetail] = await conn.query(
      `DELETE d
       FROM fidelizacion_beneficios_job_detalle d
       INNER JOIN fidelizacion_beneficios_job j ON j.id = d.job_id
       WHERE j.run_id = ?`,
      [runId]
    );
    const [delBenefitJobs] = await conn.query(
      'DELETE FROM fidelizacion_beneficios_job WHERE run_id = ?',
      [runId]
    );

    const [delRecs] = await conn.query(
      'DELETE FROM fidelizacion_recomendacion WHERE run_id = ?',
      [runId]
    );
    const [delRun] = await conn.query(
      'DELETE FROM fidelizacion_run WHERE id = ? LIMIT 1',
      [runId]
    );

    await conn.commit();
    res.json({
      ok: true,
      deleted: {
        notas: Number(delNotasJoin?.affectedRows) || 0,
        contactos: (Number(delContactoJoin?.affectedRows) || 0) + (Number(delContactoRun?.affectedRows) || 0),
        transferencias: (Number(delTransferJoin?.affectedRows) || 0) + (Number(delTransferRun?.affectedRows) || 0),
        beneficios_detalle: Number(delBenefitDetail?.affectedRows) || 0,
        beneficios_jobs: Number(delBenefitJobs?.affectedRows) || 0,
        recomendaciones: Number(delRecs?.affectedRows) || 0,
        corrida: Number(delRun?.affectedRows) || 0,
      },
    });
  } catch (error) {
    if (conn) {
      try {
        await conn.rollback();
      } catch (_err) {}
    }
    res.status(500).json({ message: 'Error al eliminar corrida de fidelizacion', error: error.message });
  } finally {
    if (conn) conn.release();
  }
});

app.get(['/api/fidelizacion/dashboard', '/fidelizacion/dashboard'], async (req, res) => {
  try {
    const context = await getFidelizacionUserContext(pool, req.user?.id);
    if (!context) return res.status(401).json({ message: 'Usuario invalido' });
    if (!context.isAdmin) return res.status(403).json({ message: 'Solo Admin puede ver dashboard global' });
    const resultadoCodes = await getFidelizacionResultadoCodes(pool);

    const { scope, runId } = resolveFidelizacionDashboardScope(req.query.scope, req.query.run_id);
    let effectiveRunId = runId;
    if (scope !== 'all' && !effectiveRunId) {
      const latest = await getFidelizacionLatestRun(pool);
      effectiveRunId = latest?.id || 0;
    }
    if (scope !== 'all' && !effectiveRunId) {
      return res.json({ scope: 'run', run_id: null, run: null, cards: {}, performance: [] });
    }

    const cardsSql =
      scope === 'all'
        ? `SELECT
             SUM(r.estado='PENDIENTE')   AS pendientes,
             SUM(r.estado='EN_GESTION')  AS en_gestion,
             SUM(r.estado='CONTACTADA')  AS contactadas,
             SUM(r.estado='CERRADA')     AS finalizadas,
             SUM(r.resultado IN (?,?)) AS convertidas,
             SUM(r.resultado=?) AS convertidas_fuera_ventana,
             SUM(r.resultado=?) AS no_convertidas
           FROM fidelizacion_recomendacion r`
        : `SELECT
             SUM(r.estado='PENDIENTE')   AS pendientes,
             SUM(r.estado='EN_GESTION')  AS en_gestion,
             SUM(r.estado='CONTACTADA')  AS contactadas,
             SUM(r.estado='CERRADA')     AS finalizadas,
             SUM(r.resultado IN (?,?)) AS convertidas,
             SUM(r.resultado=?) AS convertidas_fuera_ventana,
             SUM(r.resultado=?) AS no_convertidas
           FROM fidelizacion_recomendacion r
           WHERE r.run_id = ?`;
    const cardParamsBase = [
      resultadoCodes.convertida,
      resultadoCodes.convertidaFueraVentana,
      resultadoCodes.convertidaFueraVentana,
      resultadoCodes.noConvertida,
    ];
    const [cardRows] = await pool.query(cardsSql, scope === 'all' ? cardParamsBase : [...cardParamsBase, effectiveRunId]);
    const cardsRow = cardRows?.[0] || {};
    const cards = {
      pendientes: Number(cardsRow.pendientes) || 0,
      en_gestion: Number(cardsRow.en_gestion) || 0,
      contactadas: Number(cardsRow.contactadas) || 0,
      finalizadas: Number(cardsRow.finalizadas) || 0,
      convertidas: Number(cardsRow.convertidas) || 0,
      convertidas_fuera_ventana: Number(cardsRow.convertidas_fuera_ventana) || 0,
      no_convertidas: Number(cardsRow.no_convertidas) || 0,
    };

    const perfSql =
      scope === 'all'
        ? `SELECT
             r.vendedora_id,
             CONCAT(v.Nombre, ' ', v.Apellido) AS vendedora,
             COUNT(*) AS total_gestionados,
             SUM(r.estado='CERRADA') AS finalizados,
             ROUND(100 * SUM(r.estado='CERRADA') / NULLIF(COUNT(*),0), 1) AS tasa_finalizacion,
             SUM(r.resultado IN (?,?)) AS convertidas,
             ROUND(100 * SUM(r.resultado IN (?,?)) / NULLIF(COUNT(*),0), 1) AS tasa_conversion,
             COALESCE(
               SUM(
                 CASE
                   WHEN r.resultado IN (?,?)
                   THEN COALESCE(NULLIF(cp.total, 0), r.conversion_amount, 0)
                   ELSE 0
                 END
               ), 0
             ) AS monto_conversion,
             ROUND(AVG(r.score), 2) AS score_prom,
             ROUND(AVG(TIMESTAMPDIFF(HOUR, r.created_at, r.contactado_at)), 1) AS hs_a_contacto
           FROM fidelizacion_recomendacion r
           LEFT JOIN controlpedidos cp ON cp.id = r.pedido_id
           LEFT JOIN vendedores v ON v.Id = r.vendedora_id
           GROUP BY r.vendedora_id, v.Nombre, v.Apellido
           ORDER BY convertidas DESC, tasa_conversion DESC, finalizados DESC`
        : `SELECT
             r.vendedora_id,
             CONCAT(v.Nombre, ' ', v.Apellido) AS vendedora,
             COUNT(*) AS total_gestionados,
             SUM(r.estado='CERRADA') AS finalizados,
             ROUND(100 * SUM(r.estado='CERRADA') / NULLIF(COUNT(*),0), 1) AS tasa_finalizacion,
             SUM(r.resultado IN (?,?)) AS convertidas,
             ROUND(100 * SUM(r.resultado IN (?,?)) / NULLIF(COUNT(*),0), 1) AS tasa_conversion,
             COALESCE(
               SUM(
                 CASE
                   WHEN r.resultado IN (?,?)
                   THEN COALESCE(NULLIF(cp.total, 0), r.conversion_amount, 0)
                   ELSE 0
                 END
               ), 0
             ) AS monto_conversion,
             ROUND(AVG(r.score), 2) AS score_prom,
             ROUND(AVG(TIMESTAMPDIFF(HOUR, r.created_at, r.contactado_at)), 1) AS hs_a_contacto
           FROM fidelizacion_recomendacion r
           LEFT JOIN controlpedidos cp ON cp.id = r.pedido_id
           LEFT JOIN vendedores v ON v.Id = r.vendedora_id
           WHERE r.run_id = ?
           GROUP BY r.vendedora_id, v.Nombre, v.Apellido
           ORDER BY convertidas DESC, tasa_conversion DESC, finalizados DESC`;
    const perfParamsBase = [
      resultadoCodes.convertida,
      resultadoCodes.convertidaFueraVentana,
      resultadoCodes.convertida,
      resultadoCodes.convertidaFueraVentana,
      resultadoCodes.convertida,
      resultadoCodes.convertidaFueraVentana,
    ];
    const [perfRows] = await pool.query(perfSql, scope === 'all' ? perfParamsBase : [...perfParamsBase, effectiveRunId]);
    const performance = (perfRows || []).map((row) => ({
      vendedora_id: row.vendedora_id == null ? null : Number(row.vendedora_id),
      vendedora: String(row.vendedora || '').trim() || 'Sin asignar',
      total_gestionados: Number(row.total_gestionados) || 0,
      finalizados: Number(row.finalizados) || 0,
      tasa_finalizacion: Number(row.tasa_finalizacion) || 0,
      convertidas: Number(row.convertidas) || 0,
      tasa_conversion: Number(row.tasa_conversion) || 0,
      monto_conversion: Number(row.monto_conversion) || 0,
      score_prom: Number(row.score_prom) || 0,
      hs_a_contacto: Number(row.hs_a_contacto) || 0,
    }));

    const runMeta = scope === 'all' ? null : await loadFidelizacionRunById(pool, effectiveRunId);
    res.json({
      scope,
      run_id: scope === 'all' ? null : effectiveRunId,
      run: runMeta,
      cards,
      performance,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar dashboard de fidelizacion', error: error.message });
  }
});

app.get('/api/fidelizacion/dashboard/conversiones-mensuales', async (req, res) => {
  try {
    const context = await getFidelizacionUserContext(pool, req.user?.id);
    if (!context) return res.status(401).json({ message: 'Usuario invalido' });
    if (!context.isAdmin) return res.status(403).json({ message: 'Solo Admin puede ver dashboard global' });
    const resultadoCodes = await getFidelizacionResultadoCodes(pool);

    const { scope, runId } = resolveFidelizacionDashboardScope(req.query.scope, req.query.run_id);
    let effectiveRunId = runId;
    if (scope !== 'all' && !effectiveRunId) {
      const latest = await getFidelizacionLatestRun(pool);
      effectiveRunId = latest?.id || 0;
    }
    if (scope !== 'all' && !effectiveRunId) {
      return res.json({ scope: 'run', run_id: null, run: null, data: [] });
    }

    const vendedoraRaw = String(req.query.vendedora_id ?? '').trim().toLowerCase();
    const conversionDateExpr = 'COALESCE(r.converted_at, r.closed_at, fr.run_date, r.created_at)';
    const where = [
      'r.resultado IN (?,?)',
      `(r.vendedora_id IS NULL OR LOWER(TRIM(COALESCE(v.Nombre, ''))) NOT IN ('pagina', 'pagina web'))`,
    ];
    const params = [
      resultadoCodes.convertida,
      resultadoCodes.convertidaFueraVentana,
    ];
    if (scope !== 'all') {
      where.push('r.run_id = ?');
      params.push(effectiveRunId);
    }
    if (vendedoraRaw) {
      if (vendedoraRaw === 'null') {
        where.push('r.vendedora_id IS NULL');
      } else {
        const vendedoraId = Number(vendedoraRaw);
        if (!vendedoraId) return res.status(400).json({ message: 'vendedora_id invalido' });
        where.push('r.vendedora_id = ?');
        params.push(vendedoraId);
      }
    }

    const [rows] = await pool.query(
      `SELECT
         DATE_FORMAT(${conversionDateExpr}, '%Y-%m') AS mes,
         r.vendedora_id,
         CONCAT(COALESCE(v.Nombre, ''), ' ', COALESCE(v.Apellido, '')) AS vendedora,
         COUNT(*) AS convertidas,
         SUM(r.resultado = ?) AS convertidas_en_ventana,
         SUM(r.resultado = ?) AS convertidas_fuera_ventana,
         ROUND(
           SUM(
             CASE
               WHEN r.resultado IN (?,?)
               THEN COALESCE(NULLIF(cp.total, 0), r.conversion_amount, 0)
               ELSE 0
             END
           ),
           2
         ) AS monto_conversion
       FROM fidelizacion_recomendacion r
       LEFT JOIN fidelizacion_run fr ON fr.id = r.run_id
       LEFT JOIN controlpedidos cp ON cp.id = r.pedido_id
       LEFT JOIN vendedores v ON v.Id = r.vendedora_id
       WHERE ${where.join(' AND ')}
       GROUP BY DATE_FORMAT(${conversionDateExpr}, '%Y-%m'), r.vendedora_id, v.Nombre, v.Apellido
       ORDER BY mes DESC, convertidas DESC, vendedora ASC`,
      [
        resultadoCodes.convertida,
        resultadoCodes.convertidaFueraVentana,
        resultadoCodes.convertida,
        resultadoCodes.convertidaFueraVentana,
        ...params,
      ]
    );

    const runMeta = scope === 'all' ? null : await loadFidelizacionRunById(pool, effectiveRunId);
    res.json({
      scope,
      run_id: scope === 'all' ? null : effectiveRunId,
      run: runMeta,
      data: (rows || []).map((row) => ({
        mes: String(row.mes || '').trim(),
        vendedora_id: row.vendedora_id == null ? null : Number(row.vendedora_id),
        vendedora: String(row.vendedora || '').trim() || 'Sin asignar',
        convertidas: Number(row.convertidas) || 0,
        convertidas_en_ventana: Number(row.convertidas_en_ventana) || 0,
        convertidas_fuera_ventana: Number(row.convertidas_fuera_ventana) || 0,
        monto_conversion: Number(row.monto_conversion) || 0,
      })),
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar conversiones mensuales de fidelizacion', error: error.message });
  }
});

app.get('/api/fidelizacion/dashboard/graficas', async (req, res) => {
  try {
    const context = await getFidelizacionUserContext(pool, req.user?.id);
    if (!context) return res.status(401).json({ message: 'Usuario invalido' });
    if (!context.isAdmin) return res.status(403).json({ message: 'Solo Admin puede ver estas graficas' });
    const resultadoCodes = await getFidelizacionResultadoCodes(pool);

    const { scope, runId } = resolveFidelizacionDashboardScope(req.query.scope, req.query.run_id);
    let effectiveRunId = runId;
    if (scope !== 'all' && !effectiveRunId) {
      const latest = await getFidelizacionLatestRun(pool);
      effectiveRunId = latest?.id || 0;
    }
    if (scope !== 'all' && !effectiveRunId) {
      return res.json({
        scope: 'run',
        run_id: null,
        run: null,
        kpis: {},
        funnel: [],
        resultados: [],
        razones_cierre: [],
        tiempo_contacto: [],
        vendedoras: [],
      });
    }

    const where = [`(r.vendedora_id IS NULL OR LOWER(TRIM(COALESCE(v.Nombre, ''))) NOT IN ('pagina', 'pagina web'))`];
    const params = [];
    if (scope !== 'all') {
      where.push('r.run_id = ?');
      params.push(effectiveRunId);
    }
    const whereSql = `WHERE ${where.join(' AND ')}`;

    const [funnelRows] = await pool.query(
      `SELECT
         SUM(r.estado='PENDIENTE') AS pendientes,
         SUM(r.estado='CONTACTADA') AS contactadas,
         SUM(r.estado='CERRADA') AS finalizadas
       FROM fidelizacion_recomendacion r
       LEFT JOIN vendedores v ON v.Id = r.vendedora_id
       ${whereSql}`,
      params
    );
    const funnelBase = funnelRows?.[0] || {};

    const [resultadosRows] = await pool.query(
      `SELECT
         SUM(r.resultado=?) AS convertida,
         SUM(r.resultado=?) AS convertida_fuera_ventana,
         SUM(r.resultado=?) AS no_convertida
       FROM fidelizacion_recomendacion r
       LEFT JOIN vendedores v ON v.Id = r.vendedora_id
       ${whereSql}`,
      [resultadoCodes.convertida, resultadoCodes.convertidaFueraVentana, resultadoCodes.noConvertida, ...params]
    );
    const resultadosBase = resultadosRows?.[0] || {};

    const [kpiRows] = await pool.query(
      `SELECT
         COUNT(*) AS total,
         SUM(r.contactado_at IS NOT NULL) AS contactadas_total,
         SUM(r.estado='CERRADA') AS finalizadas,
         SUM(r.resultado=?) AS convertida,
         SUM(r.resultado=?) AS convertida_fuera_ventana,
         SUM(r.resultado=?) AS no_convertida,
         SUM(
           CASE WHEN r.resultado = ? AND UPPER(TRIM(SUBSTRING_INDEX(COALESCE(r.closed_reason,''), '|', 1))) = 'PRECIO'
             THEN 1 ELSE 0 END
         ) AS no_convertida_precio,
         SUM(
           CASE WHEN r.resultado = ? AND UPPER(TRIM(SUBSTRING_INDEX(COALESCE(r.closed_reason,''), '|', 1))) = 'NO_RESPONDIO'
             THEN 1 ELSE 0 END
         ) AS no_convertida_no_respondio
       FROM fidelizacion_recomendacion r
       LEFT JOIN vendedores v ON v.Id = r.vendedora_id
       ${whereSql}`,
      [
        resultadoCodes.convertida,
        resultadoCodes.convertidaFueraVentana,
        resultadoCodes.noConvertida,
        resultadoCodes.noConvertida,
        resultadoCodes.noConvertida,
        ...params,
      ]
    );
    const kpiBase = kpiRows?.[0] || {};
    const total = Number(kpiBase.total) || 0;
    const totalFinalizadas = Number(kpiBase.finalizadas) || 0;
    const totalNoConvertida = Number(kpiBase.no_convertida) || 0;

    const [reasonRows] = await pool.query(
      `SELECT
         UPPER(TRIM(SUBSTRING_INDEX(COALESCE(r.closed_reason, ''), '|', 1))) AS motivo_codigo,
         COUNT(*) AS total
       FROM fidelizacion_recomendacion r
       LEFT JOIN vendedores v ON v.Id = r.vendedora_id
       ${whereSql}
         AND r.resultado = ?
         AND COALESCE(TRIM(r.closed_reason), '') <> ''
       GROUP BY motivo_codigo
       ORDER BY total DESC, motivo_codigo ASC
       LIMIT 10`,
      [...params, resultadoCodes.noConvertida]
    );
    let razonesCierre = (reasonRows || []).map((row) => {
      const code = String(row.motivo_codigo || '').trim() || 'SIN_DATO';
      const guide = getFidelizacionNoConversionReasonGuidance(code);
      return {
        label: code,
        value: Number(row.total) || 0,
        tooltip: guide.tooltip,
        cross_analysis: guide.cross_analysis,
        practical_hint: guide.practical,
        needs_ai: Boolean(guide.needs_ai),
      };
    });
    const razonesReadingBase = buildFidelizacionNoConversionReading(razonesCierre);

    if (openai && razonesCierre.some((row) => row.needs_ai)) {
      try {
        const unknownReasons = razonesCierre.filter((row) => row.needs_ai).map((row) => ({
          motivo: row.label,
          cantidad: row.value,
        }));
        const completion = await withRetry(() =>
          openai.chat.completions.create({
            model: OPENAI_MODEL || 'gpt-4o-mini',
            temperature: 0.2,
            response_format: { type: 'json_object' },
            messages: [
              {
                role: 'system',
                content:
                  'Eres un analista comercial interno. Devuelve solo JSON valido con esta forma: ' +
                  '{"motivos":[{"motivo":"...","tooltip":"...","cross_analysis":"...","practical_hint":"..."}],"lectura_practica":"..."} ' +
                  'Responde en espanol breve y no inventes categorias fuera de las recibidas.',
              },
              {
                role: 'user',
                content: `Analiza estos motivos de no conversion no estandarizados:\n${JSON.stringify(unknownReasons)}`,
              },
            ],
          })
        );
        const payload = extractJsonObjectFromText(String(completion?.choices?.[0]?.message?.content || '').trim());
        const byReason = new Map(
          (Array.isArray(payload?.motivos) ? payload.motivos : [])
            .map((row) => ({
              motivo: String(row?.motivo || '').trim().toUpperCase(),
              tooltip: String(row?.tooltip || '').trim(),
              cross_analysis: String(row?.cross_analysis || '').trim(),
              practical_hint: String(row?.practical_hint || '').trim(),
            }))
            .filter((row) => row.motivo)
            .map((row) => [row.motivo, row])
        );
        razonesCierre = razonesCierre.map((row) => {
          const ai = byReason.get(String(row.label || '').trim().toUpperCase());
          if (!ai) return row;
          return {
            ...row,
            tooltip: ai.tooltip || row.tooltip,
            cross_analysis: ai.cross_analysis || row.cross_analysis,
            practical_hint: ai.practical_hint || row.practical_hint,
            needs_ai: false,
          };
        });
        if (payload?.lectura_practica) {
          razonesReadingBase.practical = String(payload.lectura_practica || '').trim() || razonesReadingBase.practical;
        }
      } catch (_err) {}
    }

    const [timeRows] = await pool.query(
      `SELECT
         SUM(CASE WHEN r.contactado_at IS NULL THEN 1 ELSE 0 END) AS sin_contacto,
         SUM(CASE WHEN r.contactado_at IS NOT NULL AND TIMESTAMPDIFF(HOUR, r.created_at, r.contactado_at) < 1 THEN 1 ELSE 0 END) AS lt_1h,
         SUM(CASE WHEN r.contactado_at IS NOT NULL AND TIMESTAMPDIFF(HOUR, r.created_at, r.contactado_at) >= 1 AND TIMESTAMPDIFF(HOUR, r.created_at, r.contactado_at) < 6 THEN 1 ELSE 0 END) AS h_1_6,
         SUM(CASE WHEN r.contactado_at IS NOT NULL AND TIMESTAMPDIFF(HOUR, r.created_at, r.contactado_at) >= 6 AND TIMESTAMPDIFF(HOUR, r.created_at, r.contactado_at) < 24 THEN 1 ELSE 0 END) AS h_6_24,
         SUM(CASE WHEN r.contactado_at IS NOT NULL AND TIMESTAMPDIFF(HOUR, r.created_at, r.contactado_at) >= 24 AND TIMESTAMPDIFF(HOUR, r.created_at, r.contactado_at) < 48 THEN 1 ELSE 0 END) AS h_24_48,
         SUM(CASE WHEN r.contactado_at IS NOT NULL AND TIMESTAMPDIFF(HOUR, r.created_at, r.contactado_at) >= 48 THEN 1 ELSE 0 END) AS gt_48h
       FROM fidelizacion_recomendacion r
       LEFT JOIN vendedores v ON v.Id = r.vendedora_id
       ${whereSql}`,
      params
    );
    const timeBase = timeRows?.[0] || {};

    const [sellerRows] = await pool.query(
      `SELECT
         r.vendedora_id,
         COALESCE(CONCAT(v.Nombre, ' ', COALESCE(v.Apellido, '')), 'Sin asignar') AS vendedora,
         COUNT(*) AS gestionados,
         SUM(r.estado='CERRADA') AS finalizados,
         SUM(r.resultado IN (?,?)) AS convertidas,
         ROUND(100 * SUM(r.resultado IN (?,?)) / NULLIF(SUM(r.estado='CERRADA'), 0), 1) AS tasa_conversion
       FROM fidelizacion_recomendacion r
       LEFT JOIN vendedores v ON v.Id = r.vendedora_id
       ${whereSql}
       GROUP BY r.vendedora_id, v.Nombre, v.Apellido
       ORDER BY convertidas DESC, gestionados DESC, vendedora ASC
       LIMIT 12`,
      [
        resultadoCodes.convertida,
        resultadoCodes.convertidaFueraVentana,
        resultadoCodes.convertida,
        resultadoCodes.convertidaFueraVentana,
        ...params,
      ]
    );

    const runMeta = scope === 'all' ? null : await loadFidelizacionRunById(pool, effectiveRunId);

    res.json({
      scope,
      run_id: scope === 'all' ? null : effectiveRunId,
      run: runMeta,
      kpis: {
        tasa_contacto: total ? round2((Number(kpiBase.contactadas_total || 0) / total) * 100) : 0,
        tasa_finalizacion: total ? round2((totalFinalizadas / total) * 100) : 0,
        tasa_conversion: totalFinalizadas
          ? round2(
              ((Number(kpiBase.convertida || 0) + Number(kpiBase.convertida_fuera_ventana || 0)) / totalFinalizadas) * 100
            )
          : 0,
        pct_precio: totalNoConvertida ? round2((Number(kpiBase.no_convertida_precio || 0) / totalNoConvertida) * 100) : 0,
        pct_no_respondio: totalNoConvertida
          ? round2((Number(kpiBase.no_convertida_no_respondio || 0) / totalNoConvertida) * 100)
          : 0,
        pct_fuera_ventana:
          Number(kpiBase.convertida || 0) + Number(kpiBase.convertida_fuera_ventana || 0) > 0
            ? round2(
                (Number(kpiBase.convertida_fuera_ventana || 0) /
                  (Number(kpiBase.convertida || 0) + Number(kpiBase.convertida_fuera_ventana || 0))) *
                  100
              )
            : 0,
      },
      funnel: [
        { label: 'Pendientes', value: Number(funnelBase.pendientes) || 0 },
        { label: 'Contactadas', value: Number(funnelBase.contactadas) || 0 },
        { label: 'Finalizadas', value: Number(funnelBase.finalizadas) || 0 },
      ],
      resultados: [
        { label: 'Convertida', value: Number(resultadosBase.convertida) || 0 },
        { label: 'Convertida fuera ventana', value: Number(resultadosBase.convertida_fuera_ventana) || 0 },
        { label: 'No convertida', value: Number(resultadosBase.no_convertida) || 0 },
      ],
      razones_cierre: razonesCierre.map((row) => ({
        label: row.label,
        value: row.value,
        tooltip: row.tooltip,
        cross_analysis: row.cross_analysis,
        practical_hint: row.practical_hint,
      })),
      razones_cierre_lectura: {
        cross_default: razonesReadingBase.cross_default,
        practical: razonesReadingBase.practical,
      },
      tiempo_contacto: [
        { label: '< 1h', value: Number(timeBase.lt_1h) || 0 },
        { label: '1-6h', value: Number(timeBase.h_1_6) || 0 },
        { label: '6-24h', value: Number(timeBase.h_6_24) || 0 },
        { label: '24-48h', value: Number(timeBase.h_24_48) || 0 },
        { label: '> 48h', value: Number(timeBase.gt_48h) || 0 },
        { label: 'Sin contacto', value: Number(timeBase.sin_contacto) || 0 },
      ],
      vendedoras: (sellerRows || []).map((row) => ({
        vendedora_id: row.vendedora_id == null ? null : Number(row.vendedora_id),
        label: String(row.vendedora || '').trim() || 'Sin asignar',
        gestionados: Number(row.gestionados) || 0,
        finalizados: Number(row.finalizados) || 0,
        convertidas: Number(row.convertidas) || 0,
        tasa_conversion: Number(row.tasa_conversion) || 0,
      })),
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar graficas de fidelizacion', error: error.message });
  }
});

app.get('/api/fidelizacion/reportes/admin', async (req, res) => {
  try {
    const context = await getFidelizacionUserContext(pool, req.user?.id);
    if (!context) return res.status(401).json({ message: 'Usuario invalido' });
    if (!context.isAdmin) return res.status(403).json({ message: 'Solo Admin puede ver este reporte' });
    const resultadoCodes = await getFidelizacionResultadoCodes(pool);
    const runId = Number(req.query.run_id) || (await getFidelizacionLatestRun(pool))?.id || 0;
    if (!runId) return res.json({ run_id: null, data: [] });
    const [rows] = await pool.query(
      `SELECT
         r.vendedora_id,
         COALESCE(v.Nombre, 'Sin asignar') AS vendedora,
         COUNT(*) AS asignados,
         SUM(r.estado = 'CERRADA') AS finalizados,
         SUM(r.contactado_at IS NOT NULL) AS contactados,
         SUM(r.resultado IN (?,?)) AS convertidos,
         ROUND(
           SUM(
             CASE
               WHEN r.resultado IN (?,?) THEN COALESCE(NULLIF(cp.total, 0), r.conversion_amount, 0)
               ELSE 0
             END
           ),
           2
         ) AS conversion_amount,
         ROUND(AVG(r.score), 2) AS score_promedio,
       ROUND(AVG(CASE WHEN r.contactado_at IS NOT NULL THEN TIMESTAMPDIFF(HOUR, r.created_at, r.contactado_at) END), 2) AS horas_a_contacto
       FROM fidelizacion_recomendacion r
       LEFT JOIN controlpedidos cp ON cp.id = r.pedido_id
       LEFT JOIN vendedores v ON v.Id = r.vendedora_id
       WHERE r.run_id = ?
         AND (r.vendedora_id IS NULL OR LOWER(TRIM(COALESCE(v.Nombre, ''))) NOT IN ('pagina', 'pagina web'))
       GROUP BY r.vendedora_id, v.Nombre
       ORDER BY asignados DESC, vendedora ASC`,
      [
        resultadoCodes.convertida,
        resultadoCodes.convertidaFueraVentana,
        resultadoCodes.convertida,
        resultadoCodes.convertidaFueraVentana,
        runId,
      ]
    );
    const data = (rows || []).map((row) => {
      const asignados = Number(row.asignados) || 0;
      const finalizados = Number(row.finalizados) || 0;
      const contactados = Number(row.contactados) || 0;
      const convertidos = Number(row.convertidos) || 0;
      return {
        vendedora_id: row.vendedora_id ? Number(row.vendedora_id) : null,
        vendedora: row.vendedora || 'Sin asignar',
        asignados,
        finalizados,
        tasa_finalizacion: asignados ? round2((finalizados / asignados) * 100) : 0,
        contactados,
        tasa_contacto: asignados ? round2((contactados / asignados) * 100) : 0,
        convertidos,
        tasa_conversion: finalizados ? round2((convertidos / finalizados) * 100) : 0,
        conversion_amount: Number(row.conversion_amount) || 0,
        score_promedio: Number(row.score_promedio) || 0,
        horas_a_contacto: Number(row.horas_a_contacto) || 0,
      };
    });
    res.json({ run_id: runId, data });
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar reporte admin de fidelizacion', error: error.message });
  }
});

app.get('/api/fidelizacion/reportes/admin/finalizados', async (req, res) => {
  try {
    const context = await getFidelizacionUserContext(pool, req.user?.id);
    if (!context) return res.status(401).json({ message: 'Usuario invalido' });
    if (!context.isAdmin) return res.status(403).json({ message: 'Solo Admin puede ver este detalle' });
    const { scope, runId } = resolveFidelizacionDashboardScope(req.query.scope, req.query.run_id);
    let effectiveRunId = runId;
    if (scope !== 'all' && !effectiveRunId) {
      const latest = await getFidelizacionLatestRun(pool);
      effectiveRunId = latest?.id || 0;
    }
    if (scope !== 'all' && !effectiveRunId) return res.json({ scope: 'run', run_id: null, data: [] });

    const vendedoraRaw = String(req.query.vendedora_id ?? '').trim().toLowerCase();
    const hasVendedoraFilter = vendedoraRaw !== '';
    const where = [
      `r.estado = 'CERRADA'`,
      `(r.vendedora_id IS NULL OR LOWER(TRIM(COALESCE(v.Nombre, ''))) NOT IN ('pagina', 'pagina web'))`,
    ];
    const params = [];
    if (scope !== 'all') {
      where.push('r.run_id = ?');
      params.push(effectiveRunId);
    }

    if (hasVendedoraFilter) {
      if (vendedoraRaw === 'null') {
        where.push('r.vendedora_id IS NULL');
      } else {
        const vendedoraId = Number(vendedoraRaw);
        if (!vendedoraId) return res.status(400).json({ message: 'vendedora_id invalido' });
        where.push('r.vendedora_id = ?');
        params.push(vendedoraId);
      }
    }

    const [rows] = await pool.query(
      `SELECT
         r.id,
         r.cliente_id,
         CONCAT(COALESCE(c.nombre, ''), ' ', COALESCE(c.apellido, '')) AS cliente,
         r.vendedora_id,
         COALESCE(v.Nombre, 'Sin asignar') AS vendedora,
         r.estado,
         r.resultado,
         r.closed_reason,
         r.closed_at,
         r.pedido_id,
         cp.nropedido AS nro_pedido,
         r.converted_at,
         COALESCE(NULLIF(cp.total, 0), r.conversion_amount, 0) AS conversion_amount
       FROM fidelizacion_recomendacion r
       LEFT JOIN clientes c ON c.id_clientes = r.cliente_id
       LEFT JOIN vendedores v ON v.Id = r.vendedora_id
       LEFT JOIN controlpedidos cp ON cp.id = r.pedido_id
       WHERE ${where.join(' AND ')}
       ORDER BY r.closed_at DESC, r.id DESC
       LIMIT 1000`,
      params
    );

    res.json({ scope, run_id: scope === 'all' ? null : effectiveRunId, data: rows || [] });
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar detalle de finalizados', error: error.message });
  }
});

app.get('/api/fidelizacion/recomendaciones/:id/analisis', async (req, res) => {
  try {
    const context = await getFidelizacionUserContext(pool, req.user?.id);
    if (!context) return res.status(401).json({ message: 'Usuario invalido' });
    if (!context.isAdmin) return res.status(403).json({ message: 'Solo Admin puede ver este analisis' });
    const recId = Number(req.params.id) || 0;
    if (!recId) return res.status(400).json({ message: 'Recomendacion invalida' });
    const data = await loadFidelizacionRecommendationAnalysis(pool, recId);
    if (!data) return res.status(404).json({ message: 'Recomendacion no encontrada' });
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar analisis de fidelizacion', error: error.message });
  }
});

app.post('/api/fidelizacion/recomendaciones/:id/analisis-ia', async (req, res) => {
  try {
    const context = await getFidelizacionUserContext(pool, req.user?.id);
    if (!context) return res.status(401).json({ message: 'Usuario invalido' });
    if (!context.isAdmin) return res.status(403).json({ message: 'Solo Admin puede usar este analisis' });
    if (!openai) return res.status(400).json({ message: 'OPENAI_API_KEY no configurada' });
    const recId = Number(req.params.id) || 0;
    if (!recId) return res.status(400).json({ message: 'Recomendacion invalida' });
    const analysis = await loadFidelizacionRecommendationAnalysis(pool, recId);
    if (!analysis) return res.status(404).json({ message: 'Recomendacion no encontrada' });

    const aiPayload = {
      recommendation: {
        cliente: analysis.recommendation?.cliente,
        encuesta: analysis.recommendation?.encuesta,
        vendedora: analysis.recommendation?.vendedora,
        score: analysis.recommendation?.score,
        oferta_detalle: analysis.recommendation?.oferta_detalle,
        razones: analysis.recommendation?.razones,
        resultado: analysis.recommendation?.resultado,
        closed_reason_label: analysis.recommendation?.closed_reason_label,
        conversion_reason_label: analysis.recommendation?.conversion_reason_label,
        recency_days: analysis.recommendation?.recency_days,
        frequency_12m: analysis.recommendation?.frequency_12m,
        avg_ticket_12m: analysis.recommendation?.avg_ticket_12m,
        conversion_amount: analysis.recommendation?.conversion_amount,
      },
      metrics: analysis.metrics,
      summary: analysis.summary,
      compras_summary: analysis.compras?.summary || {},
      timeline_top: (analysis.timeline?.events || []).slice(0, 12),
    };

    const completion = await withRetry(() =>
      openai.chat.completions.create({
        model: OPENAI_MODEL || 'gpt-4o-mini',
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content:
              'Eres un analista comercial interno. Resume por que una fidelizacion convirtio o no convirtio. ' +
              'Responde en espanol, claro y breve, en 4 a 6 lineas. ' +
              'Incluye: lectura del caso, principal friccion u oportunidad y una sugerencia accionable. ' +
              'No inventes datos que no esten presentes.',
          },
          {
            role: 'user',
            content: `Analiza este caso de fidelizacion:\n${JSON.stringify(aiPayload)}`,
          },
        ],
      })
    );

    const reply = String(completion.choices?.[0]?.message?.content || '').trim() || 'Sin respuesta.';
    res.json({ reply });
  } catch (error) {
    res.status(500).json({ message: 'Error al generar analisis IA', error: error.message });
  }
});

app.get('/api/fidelizacion/reportes/admin/gestionados', async (req, res) => {
  try {
    const context = await getFidelizacionUserContext(pool, req.user?.id);
    if (!context) return res.status(401).json({ message: 'Usuario invalido' });
    if (!context.isAdmin) return res.status(403).json({ message: 'Solo Admin puede ver este detalle' });
    const { scope, runId } = resolveFidelizacionDashboardScope(req.query.scope, req.query.run_id);
    let effectiveRunId = runId;
    if (scope !== 'all' && !effectiveRunId) {
      const latest = await getFidelizacionLatestRun(pool);
      effectiveRunId = latest?.id || 0;
    }
    if (scope !== 'all' && !effectiveRunId) return res.json({ scope: 'run', run_id: null, data: [] });

    const vendedoraRaw = String(req.query.vendedora_id ?? '').trim().toLowerCase();
    const hasVendedoraFilter = vendedoraRaw !== '';
    const where = [`(r.vendedora_id IS NULL OR LOWER(TRIM(COALESCE(v.Nombre, ''))) NOT IN ('pagina', 'pagina web'))`];
    const params = [];
    if (scope !== 'all') {
      where.push('r.run_id = ?');
      params.push(effectiveRunId);
    }

    if (hasVendedoraFilter) {
      if (vendedoraRaw === 'null') {
        where.push('r.vendedora_id IS NULL');
      } else {
        const vendedoraId = Number(vendedoraRaw);
        if (!vendedoraId) return res.status(400).json({ message: 'vendedora_id invalido' });
        where.push('r.vendedora_id = ?');
        params.push(vendedoraId);
      }
    }

    const [rows] = await pool.query(
      `SELECT
         r.id,
         r.cliente_id,
         CONCAT(COALESCE(c.nombre, ''), ' ', COALESCE(c.apellido, '')) AS cliente,
         r.vendedora_id,
         COALESCE(v.Nombre, 'Sin asignar') AS vendedora,
         r.estado,
         r.resultado,
         r.closed_reason,
         r.closed_at,
         r.pedido_id,
         cp.nropedido AS nro_pedido,
         r.converted_at,
         COALESCE(NULLIF(cp.total, 0), r.conversion_amount, 0) AS conversion_amount
       FROM fidelizacion_recomendacion r
       LEFT JOIN clientes c ON c.id_clientes = r.cliente_id
       LEFT JOIN vendedores v ON v.Id = r.vendedora_id
       LEFT JOIN controlpedidos cp ON cp.id = r.pedido_id
       WHERE ${where.join(' AND ')}
       ORDER BY r.created_at DESC, r.id DESC
       LIMIT 1000`,
      params
    );

    res.json({ scope, run_id: scope === 'all' ? null : effectiveRunId, data: rows || [] });
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar detalle de gestionados', error: error.message });
  }
});

app.get('/api/fidelizacion/reportes/mios', async (req, res) => {
  try {
    const context = await getFidelizacionUserContext(pool, req.user?.id);
    if (!context) return res.status(401).json({ message: 'Usuario invalido' });
    if (!context.vendedoraId && !context.isAdmin) return res.status(400).json({ message: 'Usuario sin vendedora asociada' });
    const resultadoCodes = await getFidelizacionResultadoCodes(pool);
    const runId = Number(req.query.run_id) || (await getFidelizacionLatestRun(pool))?.id || 0;
    if (!runId) return res.json({ run_id: null, resumen: {}, mensaje: '' });
    const vendedoraId = context.vendedoraId || Number(req.query.vendedora_id) || null;
    if (!vendedoraId) {
      return res.status(400).json({ message: 'Vendedora invalida para reporte' });
    }
    const [[sellerRow]] = await pool.query(
      `SELECT Nombre
       FROM vendedores
       WHERE Id = ?
       LIMIT 1`,
      [vendedoraId]
    );
    if (!sellerRow || isFidelizacionExcludedSellerName(sellerRow.Nombre)) {
      return res.status(400).json({ message: 'Vendedora invalida para reporte' });
    }
    const [rows] = await pool.query(
      `SELECT estado, COUNT(*) AS total
       FROM fidelizacion_recomendacion
       WHERE run_id = ?
         AND vendedora_id = ?
       GROUP BY estado`,
      [runId, vendedoraId]
    );
    const [resultadoRows] = await pool.query(
      `SELECT resultado, COUNT(*) AS total
       FROM fidelizacion_recomendacion
       WHERE run_id = ?
         AND vendedora_id = ?
         AND resultado IS NOT NULL
         AND TRIM(resultado) <> ''
       GROUP BY resultado`,
      [runId, vendedoraId]
    );
    const resumen = {
      PENDIENTE: 0,
      EN_GESTION: 0,
      CONTACTADA: 0,
      CERRADA: 0,
      CONVERTIDA: 0,
      NO_CONVERTIDA: 0,
    };
    (rows || []).forEach((row) => {
      const key = String(row.estado || '').toUpperCase();
      if (key in resumen) resumen[key] = Number(row.total) || 0;
    });
    (resultadoRows || []).forEach((row) => {
      const key = String(row.resultado || '').toUpperCase();
      const total = Number(row.total) || 0;
      if (key === String(resultadoCodes.convertida || '').toUpperCase()) {
        resumen.CONVERTIDA += total;
      } else if (key === String(resultadoCodes.convertidaFueraVentana || '').toUpperCase()) {
        resumen.CONVERTIDA += total;
      } else if (key === String(resultadoCodes.noConvertida || '').toUpperCase()) {
        resumen.NO_CONVERTIDA += total;
      } else if (key in resumen) {
        resumen[key] = total;
      }
    });
    const mensaje =
      resumen.CONVERTIDA > 0
        ? `Excelente avance: ${resumen.CONVERTIDA} conversiones en esta corrida.`
        : resumen.CONTACTADA > 0
          ? `Vas muy bien: ${resumen.CONTACTADA} clientes ya fueron contactados.`
          : 'Arranque recomendado: toma clientes pendientes y registra tus contactos.';
    res.json({ run_id: runId, vendedora_id: vendedoraId, resumen, mensaje });
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar reporte de avance', error: error.message });
  }
});

app.get('/api/config/usuarios', async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, name, email, id_roles, id_vendedoras, hora_ingreso, hora_egreso, foto
       FROM users
       ORDER BY name`
    );
    res.json({
      data: (rows || []).map((row) => ({
        ...row,
        foto: row.foto || '',
        fotoUrl: buildEmployeePhotoUrl(row.foto) || resolvePublicAssetUrl(row.foto) || null,
      })),
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar usuarios', error: error.message });
  }
});

app.get('/api/config/vendedoras', async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, nombre
       FROM vendedores
       WHERE tipo <> 0
       ORDER BY nombre`
    );
    res.json({ data: rows || [] });
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar vendedoras', error: error.message });
  }
});

app.put('/api/config/usuarios/:id', async (req, res) => {
  try {
    const userId = Number(req.params.id);
    if (!Number.isFinite(userId)) return res.status(400).json({ message: 'id invalido' });
    const {
      name = '',
      email = '',
      id_roles = null,
      id_vendedoras = null,
      hora_ingreso = null,
      hora_egreso = null,
    } = req.body || {};
    await pool.query(
      `UPDATE users
       SET name = ?, email = ?, id_roles = ?, id_vendedoras = ?, hora_ingreso = ?, hora_egreso = ?
       WHERE id = ?
       LIMIT 1`,
      [
        name,
        email,
        id_roles || null,
        id_vendedoras || null,
        hora_ingreso || null,
        hora_egreso || null,
        userId,
      ]
    );
    const [[row]] = await pool.query(
      `SELECT id, name, email, id_roles, id_vendedoras, hora_ingreso, hora_egreso, foto
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [userId]
    );
    res.json({
      ok: true,
      user: row
        ? {
            ...row,
            foto: row.foto || '',
            fotoUrl: buildEmployeePhotoUrl(row.foto) || resolvePublicAssetUrl(row.foto) || null,
          }
        : {},
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar usuario', error: error.message });
  }
});

app.post('/api/config/usuarios/:id/foto', async (req, res) => {
  try {
    const userId = Number(req.params.id);
    if (!Number.isFinite(userId)) return res.status(400).json({ message: 'id invalido' });

    const upload = await parseSingleMultipartFile(req, 'foto');
    const mime = String(upload.contentType || '').toLowerCase();
    if (!mime.startsWith('image/')) {
      return res.status(400).json({ message: 'El archivo debe ser una imagen.' });
    }
    if (!upload.buffer?.length) {
      return res.status(400).json({ message: 'Archivo vacio.' });
    }
    if (upload.buffer.length > EMP_PHOTO_MAX_BYTES) {
      return res.status(400).json({ message: 'La imagen supera el tamaño máximo permitido.' });
    }

    const [[currentUser]] = await pool.query(
      `SELECT id, foto
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [userId]
    );
    if (!currentUser) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    const safeExt = inferImageExtension(mime, upload.fileName);
    const fileName = `user-${userId}-${Date.now()}${safeExt}`;
    const destination = path.join(EMP_PHOTO_STORAGE_DIR, fileName);

    await fsp.writeFile(destination, upload.buffer);
    await pool.query('UPDATE users SET foto = ? WHERE id = ? LIMIT 1', [fileName, userId]);
    await removeManagedEmployeePhoto(currentUser.foto);

    const [[row]] = await pool.query(
      `SELECT id, name, email, id_roles, id_vendedoras, hora_ingreso, hora_egreso, foto
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [userId]
    );

    res.json({
      ok: true,
      user: row
        ? {
            ...row,
            foto: row.foto || '',
            fotoUrl: buildEmployeePhotoUrl(row.foto) || null,
          }
        : {},
    });
  } catch (error) {
    const msgByCode = {
      UPLOAD_BOUNDARY_MISSING: 'Upload inválido: falta boundary multipart.',
      UPLOAD_FILE_MISSING: 'No se recibió ninguna imagen.',
      UPLOAD_TOO_LARGE: 'La imagen supera el tamaño máximo permitido.',
    };
    const statusByCode = {
      UPLOAD_BOUNDARY_MISSING: 400,
      UPLOAD_FILE_MISSING: 400,
      UPLOAD_TOO_LARGE: 413,
    };
    res
      .status(statusByCode[error?.code] || 500)
      .json({ message: msgByCode[error?.code] || 'Error al subir foto', error: error.message });
  }
});

app.delete('/api/config/usuarios/:id/foto', async (req, res) => {
  try {
    const userId = Number(req.params.id);
    if (!Number.isFinite(userId)) return res.status(400).json({ message: 'id invalido' });

    const [[currentUser]] = await pool.query(
      `SELECT id, foto
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [userId]
    );
    if (!currentUser) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    await removeManagedEmployeePhoto(currentUser.foto);
    await pool.query('UPDATE users SET foto = NULL WHERE id = ? LIMIT 1', [userId]);

    const [[row]] = await pool.query(
      `SELECT id, name, email, id_roles, id_vendedoras, hora_ingreso, hora_egreso, foto
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [userId]
    );

    res.json({
      ok: true,
      user: row
        ? {
            ...row,
            foto: row.foto || '',
            fotoUrl: buildEmployeePhotoUrl(row.foto) || null,
          }
        : {},
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar foto', error: error.message });
  }
});

app.put('/api/config/usuarios/:id/password', async (req, res) => {
  try {
    const userId = Number(req.params.id);
    if (!Number.isFinite(userId)) return res.status(400).json({ message: 'id invalido' });
    const { password } = req.body || {};
    if (!password || String(password).length < 6) {
      return res.status(400).json({ message: 'password invalido' });
    }
    const hash = await bcrypt.hash(String(password), 10);
    await pool.query('UPDATE users SET password = ? WHERE id = ? LIMIT 1', [hash, userId]);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar password', error: error.message });
  }
});

app.get('/api/encuestas/mes', requireAuth, requirePermission('dashboard-encuestas'), async (_req, res) => {
  try {
    const currentYear = new Date().getFullYear();
    const yearParam = Number.parseInt(_req.query.year, 10);
    const year = Number.isFinite(yearParam) ? yearParam : currentYear;

    if (_req.query.year && !Number.isFinite(yearParam)) {
      return res.status(400).json({ message: 'El año debe ser numérico (por ejemplo, 2024)' });
    }

    const [rows] = await pool.query(
      `SELECT
         COALESCE(NULLIF(TRIM(encuesta), ''), 'Sin dato') AS encuesta,
         MONTH(updated_at) AS mes,
         COUNT(*) AS cantidad
       FROM clientes
       WHERE YEAR(updated_at) = ?
        AND encuesta IS NOT NULL
       GROUP BY encuesta, MONTH(updated_at)
       ORDER BY encuesta, mes`,
      [year]
    );

    // Nota: sin CTE ni funciones de ventana para compatibilidad con MySQL < 8
    const [breakdown] = await pool.query(
      `SELECT
         base.encuesta,
         base.mes,
         COUNT(*) AS total,
         SUM(base.canal_match = 'pedidos') AS pedidos,
         SUM(base.canal_match = 'salon') AS salon,
         SUM(base.canal_match IS NULL) AS sin_match
       FROM (
         SELECT
           c.id_clientes AS id,
           COALESCE(NULLIF(TRIM(c.encuesta), ''), 'Sin dato') AS encuesta,
           MONTH(c.updated_at) AS mes,
           (
             SELECT CASE
                      WHEN EXISTS (
                        SELECT 1
                        FROM controlpedidos cp2
                        WHERE cp2.NroFactura = f.NroFactura
                          AND cp2.ordenWeb IS NOT NULL
                          AND cp2.ordenWeb <> 0
                      ) THEN 'pedidos'
                      ELSE 'salon'
                    END
             FROM facturah f
             WHERE f.id_clientes = c.id_clientes
               AND f.fecha BETWEEN DATE_SUB(DATE(c.updated_at), INTERVAL 15 DAY)
                                AND DATE_ADD(DATE(c.updated_at), INTERVAL 15 DAY)
             ORDER BY ABS(DATEDIFF(f.fecha, c.updated_at)), f.fecha DESC
             LIMIT 1
           ) AS canal_match
         FROM clientes c
         WHERE YEAR(c.updated_at) = ?
           AND c.encuesta IS NOT NULL
       ) base
       GROUP BY base.encuesta, base.mes
       ORDER BY base.encuesta, base.mes`,
      [year]
    );

    res.json({ year, data: rows, breakdown });
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar encuestas por mes', error: error.message });
  }
});

app.get('/api/encuestas/ventas', requireAuth, requirePermission('dashboard-encuestas'), async (req, res) => {
  try {
    const year = Number.parseInt(req.query.year, 10);
    const month = Number.parseInt(req.query.month, 10);
    const encuesta = String(req.query.encuesta || '').trim();

    if (!Number.isFinite(year) || year < 2000 || year > 2100) {
      return res.status(400).json({ message: 'El año debe ser numérico (por ejemplo, 2026)' });
    }
    if (!Number.isFinite(month) || month < 1 || month > 12) {
      return res.status(400).json({ message: 'El mes debe estar entre 1 y 12' });
    }
    if (!encuesta) {
      return res.status(400).json({ message: 'El canal de encuesta es obligatorio' });
    }

    const desde = `${year}-${String(month).padStart(2, '0')}-01`;
    const hastaDate = new Date(Date.UTC(year, month, 1));
    const hasta = hastaDate.toISOString().slice(0, 10);

    const [rows] = await pool.query(
      `SELECT
         matched.factura,
         DATE_FORMAT(f.fecha, '%Y-%m-%d') AS fecha,
         COALESCE(NULLIF(TRIM(f.vendedora), ''), 'Sin vendedora') AS vendedora,
         matched.clienteId,
         matched.cliente,
         CASE
           WHEN matched.factura IS NULL THEN NULL
           WHEN EXISTS (
             SELECT 1
             FROM controlpedidos cp
             WHERE cp.nrofactura = matched.factura
               AND cp.ordenWeb IS NOT NULL
               AND cp.ordenWeb <> 0
           ) THEN 'pedidos'
           ELSE 'salon'
         END AS tipoVenta,
         ROUND(CASE WHEN f.Descuento IS NOT NULL OR f.Descuento = 0 THEN f.Descuento ELSE f.Total END, 2) AS total
       FROM (
         SELECT
           c.id_clientes AS clienteId,
           TRIM(CONCAT(COALESCE(c.nombre, ''), ' ', COALESCE(c.apellido, ''))) AS cliente,
           (
             SELECT f2.NroFactura
             FROM facturah f2
             WHERE f2.id_clientes = c.id_clientes
               AND f2.fecha BETWEEN DATE_SUB(DATE(c.updated_at), INTERVAL 15 DAY)
                                AND DATE_ADD(DATE(c.updated_at), INTERVAL 15 DAY)
             ORDER BY ABS(DATEDIFF(f2.fecha, c.updated_at)), f2.fecha DESC
             LIMIT 1
           ) AS factura
         FROM clientes c
         WHERE c.updated_at >= ?
           AND c.updated_at < ?
           AND COALESCE(NULLIF(TRIM(c.encuesta), ''), 'Sin dato') = ?
       ) matched
       LEFT JOIN facturah f ON f.NroFactura = matched.factura
       ORDER BY f.fecha DESC, f.NroFactura DESC`,
      [desde, hasta, encuesta]
    );

    const data = rows.filter((row) => row.factura);
    const totals = data.reduce(
      (acc, row) => {
        const total = Number(row.total) || 0;
        acc.total += total;
        acc.cantidad += 1;
        if (row.tipoVenta === 'pedidos') {
          acc.pedidos += total;
          acc.cantidadPedidos += 1;
        } else {
          acc.salon += total;
          acc.cantidadSalon += 1;
        }
        return acc;
      },
      {
        total: 0,
        pedidos: 0,
        salon: 0,
        cantidad: 0,
        cantidadPedidos: 0,
        cantidadSalon: 0,
        clientes: rows.length,
        sinMatch: rows.length - data.length,
      }
    );

    res.json({
      year,
      month,
      encuesta,
      desde,
      hasta,
      totals,
      data,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar ventas por encuesta', error: error.message });
  }
});

app.get('/api/proveedores', async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT DISTINCT TRIM(Proveedor) AS proveedor
       FROM articulos
       WHERE Proveedor IS NOT NULL AND TRIM(Proveedor) <> ''
       ORDER BY proveedor`
    );
    res.json({ data: rows });
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar proveedores', error: error.message });
  }
});

app.get('/api/proveedores/select', async (req, res) => {
  try {
    const nombre = req.query.proveedor_name;
    if (nombre) {
      const [rows] = await pool.query(
        `SELECT Nombre, Pais, Gastos, Ganancia
         FROM proveedores
         WHERE Nombre = ?
         LIMIT 1`,
        [nombre]
      );
      res.json({ data: rows || [] });
      return;
    }
    const [rows] = await pool.query(
      `SELECT Nombre, Pais, Gastos, Ganancia
       FROM proveedores
       ORDER BY Nombre`
    );
    res.json({ data: rows || [] });
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar proveedores select', error: error.message });
  }
});

app.get('/api/ordencompras', async (_req, res) => {
  try {
    const [[row]] = await pool.query(
      `SELECT NumeroOrden
       FROM ordencompras
       LIMIT 1`
    );
    res.json({ numeroOrden: row?.NumeroOrden ?? 0 });
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar orden de compras', error: error.message });
  }
});

app.get('/api/dolar', async (_req, res) => {
  try {
    const [[row]] = await pool.query(
      `SELECT PrecioDolar
       FROM PrecioDolar
       LIMIT 1`
    );
    res.json({ precioDolar: row?.PrecioDolar ?? 0 });
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar dolar', error: error.message });
  }
});

app.get('/api/mercaderia/abm', async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(5, Number.parseInt(req.query.pageSize, 10) || 10));
    const termRaw = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const term = termRaw ? `%${termRaw}%` : null;
    const sortKey = typeof req.query.sort === 'string' ? req.query.sort.trim() : 'articulo';
    const sortDir = req.query.dir === 'desc' ? 'desc' : 'asc';

    const where = [];
    const params = [];
    if (term) {
      where.push('(Arti.Articulo LIKE ? OR Arti.Detalle LIKE ? OR Arti.ProveedorSKU LIKE ?)');
      params.push(term, term, term);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const sortMap = {
      articulo: 'Arti.Articulo',
      detalle: 'Arti.Detalle',
      proveedorSku: 'Arti.ProveedorSKU',
      cantidad: 'Arti.Cantidad',
      enPedido: 'enPedido',
      precioVenta: 'repoArt.PrecioVenta',
    };
    const orderBy = sortMap[sortKey] || sortMap.articulo;

    const [[countRow]] = await pool.query(
      `SELECT COUNT(DISTINCT Arti.Articulo) AS total
       FROM articulos AS Arti
       INNER JOIN reportearticulo AS repoArt ON Arti.Articulo = repoArt.Articulo
       ${whereSql}`,
      params
    );

    const total = Number(countRow?.total) || 0;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, totalPages);
    const offset = (safePage - 1) * pageSize;

    const [rows] = await pool.query(
      `SELECT
         Arti.Articulo AS articulo,
         Arti.Detalle AS detalle,
         Arti.ProveedorSKU AS proveedorSku,
         COALESCE(Arti.Cantidad, 0) AS cantidad,
         COALESCE(SUM(CASE WHEN Control.estado = 1 THEN pedidoTemp.Cantidad ELSE 0 END), 0) AS enPedido,
         repoArt.PrecioVenta AS precioVenta,
         Arti.ImageName AS imageName,
         Arti.Web AS web
       FROM articulos AS Arti
       LEFT JOIN pedidotemp AS pedidoTemp ON Arti.Articulo = pedidoTemp.Articulo
       LEFT JOIN controlpedidos AS Control ON pedidoTemp.NroPedido = Control.nropedido
       INNER JOIN reportearticulo AS repoArt ON Arti.Articulo = repoArt.Articulo
       ${whereSql}
       GROUP BY Arti.Articulo, Arti.Detalle, Arti.ProveedorSKU, Arti.Cantidad, repoArt.PrecioVenta, Arti.ImageName, Arti.Web
       ORDER BY ${orderBy} ${sortDir}
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    res.json({
      page: safePage,
      pageSize,
      total,
      totalPages,
      data: rows || [],
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar ABM de mercaderia', error: error.message });
  }
});

async function getReporteArticuloFecha(conn) {
  const [[row]] = await conn.query(
    `SELECT DATE_FORMAT(Fecha, '%Y-%m-%d %H:%i:%s') AS Fecha
     FROM ${DB_NAME}.statusreportes
     WHERE Reporte = 'ArticuloProveedor'
     ORDER BY Fecha DESC
     LIMIT 1`
  );
  return row?.Fecha || '';
}

async function fetchReporteArticuloRows(conn) {
  const [rows] = await conn.query(
    `SELECT
       Proveedor,
       Pais,
       Articulo,
       Detalle,
       Costo,
       Ganancia,
       Cantidad,
       PrecioOrigen,
       Moneda,
       PrecioConvertido,
       PrecioManual,
       PrecioArgDolar,
       PrecioArgenPesos,
       PrecioVenta,
       CotizacionDolar
     FROM ${DB_NAME}.reportearticulo
     ORDER BY Proveedor, Articulo`
  );
  return rows || [];
}

function buildReporteArticuloPrecioVentaSql(expr) {
  return `FLOOR((ROUND((${expr}), 2) * 20) + 0.000001) / 20`;
}

async function refreshReporteArticulo(conn) {
  const fecha = formatDateTimeLocal(new Date());
  const precioDolarExpr = 'COALESCE(dol.PrecioDolar, 0)';
  const costoExpr =
    'CASE WHEN COALESCE(art.PrecioManual, 0) <> 0 THEN COALESCE(art.Gastos, 0) ELSE COALESCE(prov.Gastos, 0) END';
  const gananciaExpr =
    'CASE WHEN COALESCE(art.PrecioManual, 0) <> 0 THEN COALESCE(art.Ganancia, 0) ELSE COALESCE(prov.Ganancia, 0) END';
  const precioBaseExpr = `
    CASE
      WHEN COALESCE(art.PrecioManual, 0) <> 0 THEN COALESCE(art.PrecioManual, 0) * ${costoExpr} * ${gananciaExpr}
      WHEN COALESCE(art.PrecioConvertido, 0) = 0 THEN 0
      WHEN UPPER(COALESCE(art.Moneda, '')) = 'ARG' THEN COALESCE(art.PrecioConvertido, 0) * ${costoExpr} * ${gananciaExpr}
      ELSE COALESCE(art.PrecioConvertido, 0) * ${precioDolarExpr} * ${costoExpr} * ${gananciaExpr}
    END`;
  const precioVentaExpr = buildReporteArticuloPrecioVentaSql(precioBaseExpr);

  await conn.query(`DELETE FROM ${DB_NAME}.reportearticulo`);
  const [insertResult] = await conn.query(
    `INSERT INTO ${DB_NAME}.reportearticulo
       (Proveedor, Pais, Articulo, Detalle, Costo, Ganancia, Cantidad, PrecioOrigen, Moneda,
        PrecioConvertido, PrecioManual, PrecioArgDolar, PrecioArgenPesos, PrecioVenta, CotizacionDolar)
     SELECT
       prov.Nombre AS Proveedor,
       prov.Pais AS Pais,
       art.Articulo,
       art.Detalle,
       ${costoExpr} AS Costo,
       ${gananciaExpr} AS Ganancia,
       COALESCE(art.Cantidad, 0) AS Cantidad,
       COALESCE(art.PrecioOrigen, 0) AS PrecioOrigen,
       art.Moneda,
       COALESCE(art.PrecioConvertido, 0) AS PrecioConvertido,
       COALESCE(art.PrecioManual, 0) AS PrecioManual,
       COALESCE(art.PrecioConvertido, 0) * ${costoExpr} AS PrecioArgDolar,
       COALESCE(art.PrecioManual, 0) * ${costoExpr} AS PrecioArgenPesos,
       ${precioVentaExpr} AS PrecioVenta,
       ${precioDolarExpr} AS CotizacionDolar
     FROM ${DB_NAME}.articulos AS art
     INNER JOIN ${DB_NAME}.proveedores AS prov ON prov.Nombre = art.Proveedor
     LEFT JOIN (
       SELECT PrecioDolar
       FROM ${DB_NAME}.preciodolar
       LIMIT 1
     ) AS dol ON TRUE
     WHERE art.Proveedor IS NOT NULL
       AND TRIM(art.Proveedor) <> ''
     ORDER BY prov.Nombre, art.Articulo`
  );

  const [statusResult] = await conn.query(
    `UPDATE ${DB_NAME}.statusreportes
     SET Fecha = ?
     WHERE Reporte = 'ArticuloProveedor'`,
    [fecha]
  );
  if (!statusResult.affectedRows) {
    await conn.query(
      `INSERT INTO ${DB_NAME}.statusreportes (Reporte, Fecha)
       VALUES ('ArticuloProveedor', ?)`,
      [fecha]
    );
  }

  return { fecha, rowCount: Number(insertResult.affectedRows) || 0 };
}

app.get('/api/mercaderia/articulos-proveedor', requireAuth, async (_req, res) => {
  try {
    const [rows, generatedAt] = await Promise.all([
      fetchReporteArticuloRows(pool),
      getReporteArticuloFecha(pool),
    ]);
    res.json({ data: rows, generatedAt });
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar articulos por proveedor', error: error.message });
  }
});

app.post('/api/mercaderia/articulos-proveedor/refresh', requireAuth, async (_req, res) => {
  let conn;
  let committed = false;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();
    const refreshResult = await refreshReporteArticulo(conn);
    await conn.commit();
    committed = true;
    const rows = await fetchReporteArticuloRows(pool);
    res.json({ ok: true, data: rows, generatedAt: refreshResult.fecha, rowCount: refreshResult.rowCount });
  } catch (error) {
    if (conn && !committed) {
      try {
        await conn.rollback();
      } catch (_err) {
        /* ignore */
      }
    }
    res.status(500).json({ message: 'Error al refrescar articulos por proveedor', error: error.message });
  } finally {
    if (conn) conn.release();
  }
});

app.get('/api/mercaderia/abm/all', async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         art.Articulo AS articulo,
         art.Detalle AS detalle,
         art.ProveedorSKU AS proveedorSku,
         COALESCE(art.Cantidad, 0) AS cantidad,
         COALESCE(ped.enPedido, 0) AS enPedido,
         repoArt.PrecioVenta AS precioVenta,
         art.ImageName AS imageName,
         art.Web AS web
       FROM articulos AS art
       INNER JOIN reportearticulo AS repoArt ON art.Articulo = repoArt.Articulo
       LEFT JOIN (
         SELECT
           pt.Articulo,
           SUM(pt.Cantidad) AS enPedido
         FROM pedidotemp pt
         INNER JOIN controlpedidos cp ON pt.NroPedido = cp.nropedido
         WHERE cp.estado = 1
         GROUP BY pt.Articulo
       ) ped ON ped.Articulo = art.Articulo
       ORDER BY art.Articulo`
    );
    res.json({ total: rows.length, data: rows || [] });
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar ABM completo', error: error.message });
  }
});

app.get('/api/mercaderia/abm/pick', async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         Articulo AS articulo,
         Detalle AS detalle,
         COALESCE(Cantidad, 0) AS cantidad
       FROM articulos
       ORDER BY Articulo`
    );
    res.json({ total: rows.length, data: rows || [] });
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar articulos para seleccionar', error: error.message });
  }
});

app.get('/api/mercaderia/abm/articulo', async (req, res) => {
  try {
    const articulo = req.query.articulo;
    if (!articulo) return res.status(400).json({ message: 'articulo requerido' });
    const articuloColumns = await getTableColumnSet(pool, 'articulos', ['NbreWeb', 'DescripcionWeb']);
    const nbreWebSelect = articuloColumns.has('NbreWeb') ? 'NbreWeb' : 'NULL AS NbreWeb';
    const descripcionWebSelect = articuloColumns.has('DescripcionWeb')
      ? 'DescripcionWeb'
      : 'NULL AS DescripcionWeb';
    const [rows] = await pool.query(
      `SELECT
         Articulo,
         Detalle,
         Cantidad,
         PrecioOrigen,
         PrecioConvertido,
         Moneda,
         PrecioManual,
         Gastos,
         Ganancia,
         Proveedor,
         ProveedorSKU,
         Observaciones,
         ${nbreWebSelect},
         ${descripcionWebSelect}
       FROM articulos
       WHERE Articulo = ?
       LIMIT 1`,
      [articulo]
    );
    const row = rows[0] || null;
    if (!row) return res.status(404).json({ message: 'articulo no encontrado' });
    res.json({ data: row });
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar articulo', error: error.message });
  }
});

  // Control Ordenes: listado con filtros/paginado del lado del servidor.
  app.get('/api/control-ordenes', requireAuth, async (req, res) => {
    try {
      const page = Math.max(1, Number(req.query.page) || 1);
      const pageSize = Math.min(100000, Math.max(1, Number(req.query.pageSize) || 10));
      const offset = (page - 1) * pageSize;
    const estadosRaw = String(req.query.estado || '').trim();
    const estados = estadosRaw
      ? estadosRaw
          .split(',')
          .map((v) => Number(v))
          .filter((v) => [0, 1, 2].includes(v))
      : [];
      const desde = req.query.desde || '';
      const hasta = req.query.hasta || '';
      const nroOrden = String(req.query.nroOrden || '').trim();
      const filterOrden = String(req.query.fOrden || '').trim();
      const filterArticulo = String(req.query.fArticulo || '').trim();
      const filterDetalle = String(req.query.fDetalle || '').trim();
      const filterFecha = String(req.query.fFecha || '').trim();
      const filterProveedor = String(req.query.fProveedor || '').trim();
      const searchTerm = String(req.query.q || '').trim();

      const conditions = [
        'c.TipoOrden IS NOT NULL',
        'c.TipoOrden = 2',
        'c.Cantidad <> 0',
      ];
      const params = [];
      const addTokenConditions = (field, value) => {
        const tokens = String(value || '')
          .split(/\s+/)
          .map((token) => token.trim())
          .filter(Boolean);
        tokens.forEach((token) => {
          conditions.push(`${field} LIKE ?`);
          params.push(`%${token}%`);
        });
      };

      if (estados.length) {
        conditions.push(`c.ordenControlada IN (${estados.map(() => '?').join(',')})`);
        params.push(...estados);
      }
    if (desde && hasta) {
      conditions.push('DATE(c.FechaCompra) BETWEEN ? AND ?');
      params.push(desde, hasta);
    }
      if (nroOrden) {
        conditions.push('c.OrdenCompra = ?');
        params.push(nroOrden);
      }
      if (filterOrden) {
        addTokenConditions('c.OrdenCompra', filterOrden);
      }
      if (filterArticulo) {
        addTokenConditions('c.Articulo', filterArticulo);
      }
      if (filterDetalle) {
        addTokenConditions('c.Detalle', filterDetalle);
      }
      if (filterFecha) {
        addTokenConditions(`DATE_FORMAT(c.FechaCompra, '%Y-%m-%d')`, filterFecha);
      }
      if (filterProveedor) {
        addTokenConditions('c.Proveedor', filterProveedor);
      }
      if (searchTerm) {
        const like = `%${searchTerm}%`;
        conditions.push(
          '(c.OrdenCompra LIKE ? OR c.Articulo LIKE ? OR c.Detalle LIKE ? OR c.Observaciones LIKE ? OR c.Proveedor LIKE ?)'
        );
      params.push(like, like, like, like, like);
    }

    const countSql = `
      SELECT COUNT(*) AS total
      FROM compras c
      WHERE ${conditions.join(' AND ')}
    `;
    const [countRows] = await pool.query(countSql, params);
    const total = Number(countRows?.[0]?.total || 0);

    const sql = `
      SELECT
        c.id_compra,
        c.OrdenCompra,
        c.Articulo,
        c.Detalle,
        c.Cantidad,
        DATE_FORMAT(c.FechaCompra, '%Y-%m-%d') AS Fecha,
        ra.PrecioVenta AS PVenta,
        c.Observaciones,
        (
          SELECT COUNT(*)
          FROM notas_control_orden n
          WHERE n.id_compras = c.id_compra
        ) AS cant_notas,
        c.ordenControlada,
        c.Proveedor,
        c.PrecioArgen
      FROM compras c
      INNER JOIN reportearticulo ra ON c.Articulo = ra.Articulo
      WHERE ${conditions.join(' AND ')}
      ORDER BY c.FechaCompra DESC, c.OrdenCompra DESC
      LIMIT ? OFFSET ?
    `;
    const dataParams = params.slice();
    dataParams.push(pageSize, offset);
    const [rows] = await pool.query(sql, dataParams);
    res.json({ data: rows || [], total, page, pageSize });
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar ordenes', error: error.message });
  }
});

app.get('/api/control-ordenes/notas', requireAuth, async (req, res) => {
  try {
    const idCompra = Number(req.query.id_compra);
    if (!idCompra) return res.status(400).json({ message: 'id_compra requerido' });
    const [rows] = await pool.query(
      `SELECT n.id_notas_control_orden AS id,
              u.name AS nombre,
              n.notas AS comentario,
              DATE_FORMAT(n.fecha_creacion, '%d de %M %Y %H:%i') AS fecha
       FROM notas_control_orden n
       INNER JOIN users u ON u.id = n.users_id
       WHERE n.id_compras = ?
       ORDER BY n.fecha_creacion DESC`,
      [idCompra]
    );
    res.json({ data: rows || [] });
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar notas', error: error.message });
  }
});

app.post('/api/control-ordenes/notas', requireAuth, async (req, res) => {
  try {
    const idCompra = Number(req.body?.id_compra);
    const nota = (req.body?.nota || '').trim();
    const userId = req.user?.id;
    if (!idCompra) return res.status(400).json({ message: 'id_compra requerido' });
    if (!nota) return res.status(400).json({ message: 'Nota requerida' });
    if (!userId) return res.status(401).json({ message: 'Usuario no autenticado' });
    const fecha = formatDateTimeLocal(
      new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }))
    );
    await pool.query(
      `INSERT INTO notas_control_orden (id_compras, users_id, notas, fecha_creacion)
       VALUES (?, ?, ?, ?)`,
      [idCompra, userId, nota, fecha]
    );
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: 'Error al guardar nota', error: error.message });
  }
});

app.get('/api/cajas/cierres', requireAuth, async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         ROUND(SUM(CASE WHEN Descuento <> "null" OR Descuento = 0 THEN Descuento ELSE Total END), 2) AS Total,
         DATE_FORMAT(f.fecha_dia, "%Y-%m-%d") AS Fecha,
         CASE WHEN MAX(f.Estado) = 1 THEN "Caja Cerrada" ELSE "Caja Abierta" END AS Estado
       FROM (
         SELECT DATE(Fecha) AS fecha_dia, Estado, Descuento, Total
         FROM facturah
       ) AS f
       GROUP BY f.fecha_dia
       ORDER BY f.fecha_dia DESC`
    );
    res.json({ data: rows || [] });
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar cierres', error: error.message });
  }
});

app.get('/api/cajas/gastos', requireAuth, async (req, res) => {
  try {
    const fecha = String(req.query.fecha || '').trim();
    if (!fecha) return res.status(400).json({ message: 'fecha requerida' });
    const [rows] = await pool.query(
      `SELECT Id, Nbr_Gasto, Detalle, Importe, DATE_FORMAT(Fecha, "%Y-%m-%d") AS Fecha
       FROM gastos
       WHERE DATE(Fecha) = ?
       ORDER BY Fecha DESC`,
      [fecha]
    );
    res.json({ data: rows || [] });
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar gastos', error: error.message });
  }
});

app.post('/api/cajas/gastos', requireAuth, async (req, res) => {
  try {
    const nombre = String(req.body?.Nbr_Gasto || '').trim();
    const detalle = String(req.body?.Detalle || '').trim();
    const importe = Number(req.body?.Importe || 0);
    const fecha = String(req.body?.Fecha || '').trim();
    if (!nombre) return res.status(400).json({ message: 'Gasto requerido' });
    if (!fecha) return res.status(400).json({ message: 'Fecha requerida' });
    const fechaFull = `${fecha} 00:00:00`;
    await pool.query(
      `INSERT INTO gastos (Nbr_Gasto, Detalle, Importe, Fecha, Estado)
       VALUES (?, ?, ?, ?, ?)`,
      [nombre, detalle, importe, fechaFull, 0]
    );
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: 'Error al crear gasto', error: error.message });
  }
});

app.put('/api/cajas/gastos/:id', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const nombre = String(req.body?.Nbr_Gasto || '').trim();
    const detalle = String(req.body?.Detalle || '').trim();
    const importe = Number(req.body?.Importe || 0);
    const fecha = String(req.body?.Fecha || '').trim();
    if (!id) return res.status(400).json({ message: 'Id requerido' });
    if (!nombre) return res.status(400).json({ message: 'Gasto requerido' });
    if (!fecha) return res.status(400).json({ message: 'Fecha requerida' });
    const fechaFull = `${fecha} 00:00:00`;
    await pool.query(
      `UPDATE gastos
          SET Nbr_Gasto = ?,
              Detalle = ?,
              Importe = ?,
              Fecha = ?
        WHERE Id = ?
        LIMIT 1`,
      [nombre, detalle, importe, fechaFull, id]
    );
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar gasto', error: error.message });
  }
});

app.delete('/api/cajas/gastos/:id', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: 'Id requerido' });
    await pool.query('DELETE FROM gastos WHERE Id = ? LIMIT 1', [id]);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar gasto', error: error.message });
  }
});

app.get('/api/cajas/facturas', requireAuth, async (req, res) => {
  try {
    const fecha = String(req.query.fecha || '').trim();
    if (!fecha) return res.status(400).json({ message: 'fecha requerida' });
    const [rows] = await pool.query(
      `SELECT f.NroFactura,
              f.Total,
              f.Porcentaje,
              f.Descuento,
              DATE_FORMAT(f.Fecha, "%Y-%m-%d") AS Fecha,
              CASE WHEN f.Estado = 1 THEN "Caja Cerrada" ELSE "Caja Abierta" END AS Estado,
              CONCAT(cli.nombre, ",", cli.apellido) AS Cliente
         FROM facturah f
         INNER JOIN clientes cli ON cli.id_clientes = f.id_clientes
        WHERE DATE(f.Fecha) = ?
        ORDER BY f.NroFactura ASC`,
      [fecha]
    );
    res.json({ data: rows || [] });
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar facturas', error: error.message });
  }
});

app.get('/api/cajas/factura-items', requireAuth, async (req, res) => {
  try {
    const nroFactura = String(req.query.nroFactura || '').trim();
    if (!nroFactura) return res.status(400).json({ message: 'nroFactura requerido' });
    const [rows] = await pool.query(
      `SELECT NroFactura,
              Articulo,
              Detalle,
              Cantidad,
              ROUND(PrecioUnitario, 2) AS PrecioUnitario,
              ROUND(PrecioVenta, 2) AS PrecioVenta
         FROM factura
        WHERE NroFactura = ?
        ORDER BY Articulo`,
      [nroFactura]
    );
    res.json({ data: rows || [] });
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar items', error: error.message });
  }
});

app.patch('/api/cajas/cerrar', requireAuth, async (req, res) => {
  let conn;
  try {
    const fecha = String(req.body?.fecha || '').trim();
    if (!fecha) return res.status(400).json({ message: 'fecha requerida' });
    conn = await pool.getConnection();
    await conn.beginTransaction();
    await conn.query('UPDATE facturah SET Estado = 1 WHERE DATE(Fecha) = ?', [fecha]);
    await conn.query('UPDATE gastos SET Estado = 1 WHERE DATE(Fecha) = ?', [fecha]);
    await conn.commit();
    res.json({ ok: true });
  } catch (error) {
    if (conn) {
      try {
        await conn.rollback();
      } catch (_err) {
        /* ignore */
      }
    }
    res.status(500).json({ message: 'Error al cerrar caja', error: error.message });
  } finally {
    if (conn) conn.release();
  }
});

app.patch('/api/cajas/abrir', requireAuth, async (req, res) => {
  let conn;
  try {
    const fecha = String(req.body?.fecha || '').trim();
    if (!fecha) return res.status(400).json({ message: 'fecha requerida' });
    conn = await pool.getConnection();
    await conn.beginTransaction();
    await conn.query('UPDATE facturah SET Estado = 0 WHERE DATE(Fecha) = ?', [fecha]);
    await conn.query('UPDATE gastos SET Estado = 0 WHERE DATE(Fecha) = ?', [fecha]);
    await conn.commit();
    res.json({ ok: true });
  } catch (error) {
    if (conn) {
      try {
        await conn.rollback();
      } catch (_err) {
        /* ignore */
      }
    }
    res.status(500).json({ message: 'Error al abrir caja', error: error.message });
  } finally {
    if (conn) conn.release();
  }
});

app.get('/api/cajas/control', requireAuth, async (req, res) => {
  try {
    const fecha = String(req.query.fecha || '').trim();
    if (!fecha) return res.status(400).json({ message: 'fecha requerida' });
    const [rows] = await pool.query(
      `SELECT
         CASE
           WHEN tp.tipo_pago = "Efectivo" THEN "billete.jpeg"
           WHEN tp.tipo_pago = "TransferenciaBco" THEN "bancos.jpeg"
           WHEN tp.tipo_pago = "MercadoPago" THEN "mercadopago.png"
           WHEN tp.tipo_pago = "Prestigio" THEN "financiera.png"
           WHEN tp.tipo_pago = "CobroSur" THEN "cobrosur.png"
           WHEN tp.tipo_pago = "Mixto" THEN "pagomixto.png"
         END AS tipo_pago_imagen,
         tp.id_tipo_pagos AS id_tipo_pago,
         tp.tipo_pago,
         COUNT(*) AS cantidad,
         IF(
           tp.tipo_pago <> "Mixto",
           ROUND(SUM(CASE WHEN f.Descuento <> "null" OR f.Descuento = 0 THEN f.Descuento ELSE f.Total END), 2),
           ROUND(SUM(f.pagomixto), 2)
         ) AS Total
       FROM facturah f
       INNER JOIN tipo_pagos tp ON tp.id_tipo_pagos = f.id_tipo_pago
       WHERE DATE(f.Fecha) = ?
         AND tp.id_tipo_pagos > 1
       GROUP BY tp.id_tipo_pagos, tp.tipo_pago
       ORDER BY tp.id_tipo_pagos`,
      [fecha]
    );
    res.json({ data: rows || [] });
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar control de caja', error: error.message });
  }
});

app.get('/api/cajas/control-facturas', requireAuth, async (req, res) => {
  try {
    const fecha = String(req.query.fecha || '').trim();
    const tipoPago = Number(req.query.id_tipo_pago || 0);
    if (!fecha) return res.status(400).json({ message: 'fecha requerida' });
    if (!tipoPago) return res.status(400).json({ message: 'id_tipo_pago requerido' });
    const [rows] = await pool.query(
      `SELECT f.NroFactura,
              f.Total,
              f.Porcentaje,
              f.Descuento,
              tp.tipo_pago,
              CONCAT(cli.nombre, ",", cli.apellido) AS Cliente,
              f.pagomixto AS PagoMixto
         FROM facturah f
         INNER JOIN tipo_pagos tp ON tp.id_tipo_pagos = f.id_tipo_pago
         INNER JOIN clientes cli ON cli.id_clientes = f.id_clientes
        WHERE DATE(f.Fecha) = ?
          AND tp.id_tipo_pagos = ?
        ORDER BY f.NroFactura ASC`,
      [fecha, tipoPago]
    );
    res.json({ data: rows || [] });
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar facturas', error: error.message });
  }
});

app.put('/api/control-ordenes/notas/:id', requireAuth, async (req, res) => {
  try {
    const notaId = Number(req.params.id);
    const nota = (req.body?.nota || '').trim();
    if (!notaId) return res.status(400).json({ message: 'Id de nota requerido' });
    if (!nota) return res.status(400).json({ message: 'Nota requerida' });
    await pool.query('UPDATE notas_control_orden SET notas = ? WHERE id_notas_control_orden = ? LIMIT 1', [
      nota,
      notaId,
    ]);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar nota', error: error.message });
  }
});

app.delete('/api/control-ordenes/notas/:id', requireAuth, async (req, res) => {
  try {
    const notaId = Number(req.params.id);
    if (!notaId) return res.status(400).json({ message: 'Id de nota requerido' });
    await pool.query('DELETE FROM notas_control_orden WHERE id_notas_control_orden = ? LIMIT 1', [notaId]);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar nota', error: error.message });
  }
});

app.patch('/api/control-ordenes/cerrar', requireAuth, async (req, res) => {
  try {
    const idCompra = Number(req.body?.id_compra);
    const estadoReq = Number(req.body?.estado);
    if (!idCompra) return res.status(400).json({ message: 'id_compra requerido' });
    const [[row]] = await pool.query(
      'SELECT ordenControlada FROM compras WHERE id_compra = ? LIMIT 1',
      [idCompra]
    );
    if (!row) return res.status(404).json({ message: 'Orden no encontrada' });
    let nextEstado = 0;
    if ([1, 2].includes(estadoReq)) {
      const [[countRow]] = await pool.query(
        'SELECT COUNT(*) AS total FROM notas_control_orden WHERE id_compras = ?',
        [idCompra]
      );
      if (!countRow || Number(countRow.total) <= 0) {
        return res.status(400).json({ message: 'Para finalizar debe agregar una nota' });
      }
      nextEstado = estadoReq;
    }
    const fecha = formatDateTimeLocal(
      new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }))
    );
    await pool.query(
      'UPDATE compras SET fechaControl = ?, ordenControlada = ? WHERE id_compra = ? LIMIT 1',
      [fecha, nextEstado, idCompra]
    );
    res.json({ ok: true, ordenControlada: nextEstado });
  } catch (error) {
    res.status(500).json({ message: 'Error al cerrar control', error: error.message });
  }
});

app.post('/api/mercaderia/abm/articulo', requireAuth, async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();
    const created = await processAbmCreate(conn, req.body || {});
    await conn.commit();

    res.json({
      ok: true,
      data: {
        articulo: created.articulo,
        detalle: created.detalle,
        cantidad: created.cantidad,
        proveedor: created.proveedor,
      },
    });
  } catch (error) {
    if (conn) {
      try {
        await conn.rollback();
      } catch (_err) {
        /* ignore */
      }
    }
    if (error.code === 'ARTICULO_INVALIDO') {
      return res.status(400).json({ message: error.message || 'Articulo invalido.' });
    }
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'El articulo ya existe.' });
    }
    res.status(500).json({ message: 'Error al crear articulo', error: error.message });
  } finally {
    if (conn) conn.release();
  }
});

app.put('/api/mercaderia/abm/articulo/:id', async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();
    const articulo = req.params.id;
    const {
      detalle,
      cantidadDelta = 0,
      resta = false,
      precioOrigen = 0,
      precioConvertido = 0,
      precioManual = 0,
      gastos = 0,
      ganancia = 0,
      proveedor = '',
      proveedorSku = '',
      observaciones = '',
      nbreWeb = '',
      descripcionWeb = '',
      ordenCompra = 0,
      opcion = 'opcion_manual',
      paisProveedor = '',
      gastosProveedor = 0,
      gananciaProveedor = 0,
    } = req.body || {};

    const [[row]] = await conn.query(
      `SELECT Cantidad
       FROM articulos
       WHERE Articulo = ?
       LIMIT 1`,
      [articulo]
    );
    if (!row) return res.status(404).json({ message: 'articulo no encontrado' });
    const baseCantidad = Number(row.Cantidad) || 0;
    const delta = Number(cantidadDelta) || 0;
    const nuevaCantidad = computeNuevaCantidad(baseCantidad, delta, resta);

    const { moneda, precioConvertidoFinal, precioManualFinal, gastosFinal, gananciaFinal } =
      resolveArticuloValores(opcion, {
        precioConvertido,
        precioManual,
        gastos,
        ganancia,
      });

    const [[obsRow]] = await conn.query(
      `SELECT CHARACTER_MAXIMUM_LENGTH AS maxLen
       FROM information_schema.columns
       WHERE table_schema = DATABASE()
         AND table_name = 'compras'
         AND column_name = 'Observaciones'
       LIMIT 1`
    );
    const maxObservaciones = Number(obsRow?.maxLen) || 255;
    const observacionesFinal = (observaciones || '').toString().slice(0, maxObservaciones);
    const nbreWebFinal = (nbreWeb || '').toString().slice(0, 255);
    const descripcionWebFinal = (descripcionWeb || '').toString().slice(0, 450);
    const articuloColumns = await getTableColumnSet(conn, 'articulos', ['NbreWeb', 'DescripcionWeb']);
    const updateFields = [
      'Detalle = ?',
      'Cantidad = ?',
      'PrecioOrigen = ?',
      'PrecioConvertido = ?',
      'Moneda = ?',
      'PrecioManual = ?',
      'Gastos = ?',
      'Ganancia = ?',
      'Proveedor = ?',
      'ProveedorSKU = ?',
    ];
    const updateValues = [
      detalle || '',
      nuevaCantidad,
      Number(precioOrigen) || 0,
      precioConvertidoFinal,
      moneda,
      precioManualFinal,
      gastosFinal,
      gananciaFinal,
      proveedor || '',
      proveedorSku || '',
    ];
    if (articuloColumns.has('NbreWeb')) {
      updateFields.push('NbreWeb = ?');
      updateValues.push(nbreWebFinal || null);
    }
    if (articuloColumns.has('DescripcionWeb')) {
      updateFields.push('DescripcionWeb = ?');
      updateValues.push(descripcionWebFinal || null);
    }
    updateValues.push(articulo);

    await conn.query(
      `UPDATE articulos
       SET ${updateFields.join(',\n           ')}
       WHERE Articulo = ?
       LIMIT 1`,
      updateValues
    );

    const tipoOrden = resta ? 1 : 2;
    const { precioArgen, compraGastos, compraGanancia } = resolveCompraValores(opcion, {
      precioManualFinal,
      precioConvertidoFinal,
      gastos,
      ganancia,
      gastosProveedor,
      gananciaProveedor,
    });
    const now = new Date();
    const fechaCompra = formatDateTimeLocal(now);

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
      delta,
      Number(precioOrigen) || 0,
      precioArgen,
      compraGastos,
      compraGanancia,
      proveedor || '',
      paisProveedor || '',
      fechaCompra,
      tipoOrden,
      observacionesFinal,
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
    await conn.commit();

    res.json({
      ok: true,
      data: {
        articulo,
        detalle: detalle || '',
        cantidad: nuevaCantidad,
        proveedor: proveedor || '',
        proveedorSku: proveedorSku || '',
      },
    });
  } catch (error) {
    if (conn) {
      try {
        await conn.rollback();
      } catch (_err) {
        /* ignore */
      }
    }
    res.status(500).json({ message: 'Error al actualizar articulo', error: error.message });
  } finally {
    if (conn) conn.release();
  }
});

app.put('/api/mercaderia/abm/batch', async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();
    const { ordenCompra = 0, items = [] } = req.body || {};
    const updated = await processAbmBatch(conn, ordenCompra, items);
    await conn.commit();

    res.json({ ok: true, data: updated });
  } catch (error) {
    if (conn) {
      try {
        await conn.rollback();
      } catch (_err) {
        /* ignore */
      }
    }
    res.status(500).json({ message: 'Error al actualizar articulos', error: error.message });
  } finally {
    if (conn) conn.release();
  }
});

app.get('/api/mercaderia/abm/image', async (req, res) => {
  try {
    const articulo = req.query.articulo;
    if (!articulo) return res.status(400).json({ message: 'articulo requerido' });
    const latestStatusSubquery =
      '(SELECT id_provecomerce FROM statusecomercesincro ORDER BY id_provecomerce DESC LIMIT 1)';
    const [rows] = await pool.query(
      `SELECT imagessrc
       FROM statusecomercesincro
       WHERE articulo = ?
         AND id_provecomerce = ${latestStatusSubquery}
       LIMIT 1`,
      [articulo]
    );
    const row = rows[0] || {};
    res.json({ articulo, imagessrc: row.imagessrc || '' });
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar imagen ABM', error: error.message });
  }
});

app.get('/api/mercaderia/abm/pedidos', async (req, res) => {
  try {
    const articulo = req.query.articulo;
    if (!articulo) return res.status(400).json({ message: 'articulo requerido' });
    const [rows] = await pool.query(
      `SELECT
         cp.nropedido,
         CONCAT(c.nombre, ' ', c.apellido) AS cliente,
         SUM(pt.Cantidad) AS cantidad,
         DATE_FORMAT(cp.fecha, '%Y-%m-%d') AS fecha,
         cp.vendedora,
         cp.total,
         cp.ordenweb
       FROM pedidotemp pt
       INNER JOIN controlpedidos cp ON pt.NroPedido = cp.nropedido
       LEFT JOIN clientes c ON c.id_clientes = cp.id_cliente
       WHERE pt.Articulo = ?
         AND cp.estado = 1
       GROUP BY cp.nropedido, c.nombre, c.apellido, cp.fecha, cp.vendedora, cp.total, cp.ordenweb
       ORDER BY cp.fecha DESC`,
      [articulo]
    );
    const data = rows.map((row) => ({
      nropedido: row.nropedido,
      cliente: row.cliente || '',
      cantidad: row.cantidad ?? 0,
      fecha: row.fecha || '',
      vendedora: row.vendedora || '',
      total: row.total,
      ordenWeb: row.ordenweb || '',
    }));
    res.json({ articulo, data });
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar pedidos del articulo', error: error.message });
  }
});

app.get('/api/mercaderia/top', async (req, res) => {
  try {
    const hoy = new Date();
    const firstDay = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const desdeDate = req.query.desde ? parseISODate(req.query.desde) : firstDay;
    const hastaDate = req.query.hasta ? parseISODate(req.query.hasta) : hoy;
    const desde = desdeDate.toISOString().slice(0, 10);
    const hasta = hastaDate.toISOString().slice(0, 10);

    const proveedoresParam =
      typeof req.query.proveedores === 'string' && req.query.proveedores.trim()
        ? req.query.proveedores.split(',').map((p) => p.trim()).filter(Boolean)
        : [];
    const webTn = req.query.webTn === 'true' || req.query.webTn === '1';

    const where = ['fac.Fecha BETWEEN ? AND ?', 'fac.Estado <> 2'];
    const params = [desde, hasta];
    if (proveedoresParam.length) {
      where.push(`art.Proveedor IN (${proveedoresParam.map(() => '?').join(',')})`);
      params.push(...proveedoresParam);
    }

    const latestStatusSubquery = `(SELECT id_provecomerce FROM statusecomercesincro ORDER BY id_provecomerce DESC LIMIT 1)`;

    const sql = `
      SELECT
        fac.Articulo,
        art.Detalle,
        art.ProveedorSKU,
        SUM(fac.Cantidad) AS TotalVendido,
        art.Cantidad AS TotalStock,
        repoArt.PrecioVenta,
        art.ImageName,
        ${webTn ? 'MAX(StatusSincr.imagessrc)' : 'NULL'} AS imagessrc
      FROM factura AS fac
      JOIN articulos AS art ON fac.Articulo = art.Articulo
      LEFT JOIN reportearticulo AS repoArt ON fac.Articulo = repoArt.Articulo
      ${webTn ? `LEFT JOIN statusecomercesincro AS StatusSincr ON repoArt.Articulo = StatusSincr.articulo AND StatusSincr.id_provecomerce = ${latestStatusSubquery}` : ''}
      WHERE ${where.join(' AND ')}
      ${webTn ? 'AND StatusSincr.id_provecomerce IS NOT NULL' : ''}
      GROUP BY fac.Articulo, art.Detalle, art.ProveedorSKU, art.Cantidad, repoArt.PrecioVenta, art.ImageName
      ORDER BY TotalVendido DESC
    `;

    const [rows] = await pool.query(sql, params);
    res.json({
      desde,
      hasta,
      count: rows.length,
      data: rows.map((r) => ({
        articulo: r.Articulo,
        detalle: r.Detalle,
        proveedorSku: r.ProveedorSKU,
        totalVendido: Number(r.TotalVendido) || 0,
        totalStock: Number(r.TotalStock) || 0,
        precioVenta: Number(r.PrecioVenta) || 0,
        imageName: r.ImageName || '',
        imagessrc: webTn ? '' : '',
      })),
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar artículos más vendidos', error: error.message });
  }
});

app.get('/api/mercaderia/series', async (req, res) => {
  try {
    const idsParam =
      typeof req.query.articulos === 'string' && req.query.articulos.trim()
        ? req.query.articulos.split(',').map((p) => p.trim()).filter(Boolean)
        : [];
    if (!idsParam.length) return res.status(400).json({ message: 'articulos requeridos' });

    const baseDesde = req.query.desde ? parseISODate(req.query.desde) : new Date();
    const start = new Date(baseDesde.getFullYear(), baseDesde.getMonth() - 5, 1);
    const end = new Date(baseDesde.getFullYear(), baseDesde.getMonth() + 1, 0);
    const desde = start.toISOString().slice(0, 10);
    const hasta = end.toISOString().slice(0, 10);

    const placeholders = idsParam.map(() => '?').join(',');
    const sql = `
      SELECT
        fac.Articulo,
        YEAR(fac.Fecha) AS anio,
        MONTH(fac.Fecha) AS mes,
        SUM(fac.Cantidad) AS total
      FROM factura AS fac
      WHERE fac.Articulo IN (${placeholders})
        AND fac.Fecha BETWEEN ? AND ?
        AND fac.Estado <> 2
      GROUP BY fac.Articulo, YEAR(fac.Fecha), MONTH(fac.Fecha)
      ORDER BY fac.Articulo, anio, mes
    `;
    const params = [...idsParam, desde, hasta];
    const [rows] = await pool.query(sql, params);

    const data = {};
    rows.forEach((r) => {
      if (!data[r.Articulo]) data[r.Articulo] = [];
      data[r.Articulo].push({
        anio: r.anio,
        mes: r.mes,
        total: Number(r.total) || 0,
      });
    });

    res.json({ desde, hasta, data });
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar series de mercadería', error: error.message });
  }
});

app.get('/api/mercaderia/image', async (req, res) => {
  try {
    const articulo = req.query.articulo;
    if (!articulo) return res.status(400).json({ message: 'articulo requerido' });
    const [[row]] = await pool.query(
      `SELECT imagessrc
       FROM statusecomercesincro
       WHERE articulo = ?
       ORDER BY id_provecomerce DESC
       LIMIT 1`,
      [articulo]
    );
    res.json({ articulo, imagessrc: row?.imagessrc || '' });
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar imagen', error: error.message });
  }
});

app.get('/api/mercaderia/fotos', requireAuth, async (req, res) => {
  try {
    const minStock = Number.parseInt(req.query.limit, 10);
    if (!Number.isInteger(minStock) || minStock <= 0) {
      return res.status(400).json({ message: 'limit debe ser un entero mayor a 0' });
    }

    const [rows] = await pool.query(
      `SELECT
         art.Articulo AS articulo,
         art.Detalle AS detalle,
         COALESCE(art.Cantidad, 0) AS cantidad,
         COALESCE(status.imagessrc, '') AS fotoUrl
       FROM articulos AS art
       LEFT JOIN statusecomercesincro AS status
         ON status.articulo = art.Articulo
        AND status.id_provecomerce = (
          SELECT prov.id
          FROM provecomerce AS prov
          WHERE TIME(prov.fecha) >= '06:00:00'
            AND TIME(prov.fecha) <= '06:00:10'
          ORDER BY prov.id DESC
          LIMIT 1
        )
       WHERE COALESCE(art.Cantidad, 0) >= ?
       ORDER BY art.Detalle ASC, art.Articulo ASC
      `,
      [minStock]
    );

    res.json({
      total: rows.length,
      data: (rows || []).map((row) => ({
        articulo: row.articulo || '',
        detalle: row.detalle || '',
        cantidad: Number(row.cantidad) || 0,
        fotoUrl: row.fotoUrl || '',
      })),
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar fotos de mercaderia', error: error.message });
  }
});

app.post('/api/mercaderia/prediccion', async (req, res) => {
  try {
    const { articulo, detalle, anio, meses = [], stockActual = 0 } = req.body || {};
    if (!articulo) return res.status(400).json({ message: 'articulo requerido' });
    const months = Array.isArray(meses) ? meses : [];
    if (!months.length) return res.status(400).json({ message: 'Selecciona al menos un mes' });

    const safeYear = Number(anio) || new Date().getFullYear();
    const payload = {
      sku: articulo,
      periodos: months.map((m) => ({ anio: safeYear, mes: m })),
    };

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(PREDICTOR_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    }).finally(() => clearTimeout(id));

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      return res
        .status(502)
        .json({ message: 'Error del predictor', detail: errText || `Status ${response.status}` });
    }
    const data = await response.json();
    // Normalizar un poco al formato esperado en el front
    const results = Array.isArray(data?.resultados)
      ? data.resultados
      : Array.isArray(data) // por si devuelve array simple
      ? data
      : [];
    const demandaTotal =
      data?.demanda_total_horizonte ??
      results.reduce((acc, r) => acc + (Number(r.prediccion || r.total || 0)), 0);

    res.json({
      articulo,
      detalle,
      resultados: results,
      demanda_total_horizonte: demandaTotal,
      compra_sugerida_total: Math.max(0, (Number(demandaTotal) || 0) - (Number(stockActual) || 0)),
      anio: payload.anio,
      raw: data,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error en predicción de mercadería', error: error.message });
  }
});

app.get('/api/pedidos/productividad', requireAuth, requirePermission('dashboard-pedidos-dia'), async (req, res) => {
  try {
    const hoy = new Date();
    const defaultDesde = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate(), 0, 0, 0));
    const defaultHasta = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate() + 1, 0, 0, 0));

    let desde = defaultDesde;
    let hasta = defaultHasta;

    if (req.query.fechaDesde) {
      desde = parseISODate(req.query.fechaDesde);
    }
    if (req.query.fechaHasta) {
      const hastaDate = parseISODate(req.query.fechaHasta);
      hasta = new Date(Date.UTC(hastaDate.getUTCFullYear(), hastaDate.getUTCMonth(), hastaDate.getUTCDate() + 1, 0, 0, 0));
    } else if (req.query.fechaDesde) {
      // Si sólo hay fechaDesde, tomar un día
      hasta = new Date(Date.UTC(desde.getUTCFullYear(), desde.getUTCMonth(), desde.getUTCDate() + 1, 0, 0, 0));
    }

    if (hasta <= desde) {
      return res.status(400).json({ message: 'La fecha hasta debe ser posterior a la fecha desde' });
    }

    const [rows] = await pool.query(
      `SELECT
         cp.vendedora AS vendedora,
         COUNT(DISTINCT cp.id) AS cantPedidos,
         COUNT(DISTINCT DATE(cp.ultactualizacion)) AS dias,
         ROUND(SUM(cp.total), 2) AS totalFacturado,
         COALESCE(SUM(pt.cantArticulos), 0) AS cantArticulos
       FROM controlpedidos cp
       LEFT JOIN (
         SELECT nropedido, COUNT(*) AS cantArticulos
         FROM pedidotemp
         GROUP BY nropedido
       ) pt ON pt.nropedido = cp.nropedido
       WHERE cp.ultactualizacion >= ?
         AND cp.ultactualizacion < ?
         AND cp.total > 1
         AND cp.estado <> 2
         AND cp.ordenWeb > 0
       GROUP BY cp.vendedora
       ORDER BY cp.vendedora`,
      [desde, hasta]
    );

    const data = rows.map((row) => {
      const pedidos = Number(row.cantPedidos) || 0;
      const dias = Number(row.dias) || 1;
      const totalFacturado = Number(row.totalFacturado) || 0;
      const cantArticulos = Number(row.cantArticulos) || 0;

      return {
        vendedora: row.vendedora || 'Sin asignar',
        cantPedidos: pedidos,
        dias,
        promedio: pedidos && dias ? Number((pedidos / dias).toFixed(1)) : 0,
        promedioFacturado: pedidos ? Number((totalFacturado / pedidos).toFixed(1)) : 0,
        promedioCantArticulos: pedidos ? Number((cantArticulos / pedidos).toFixed(1)) : 0,
      };
    });

    res.json({
      fechaDesde: desde.toISOString().slice(0, 10),
      fechaHasta: new Date(hasta.getTime() - 1).toISOString().slice(0, 10),
      data,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al calcular productividad diaria', error: error.message });
  }
});

app.get('/api/pedidos/mensual', requireAuth, requirePermission('dashboard-pedidos-vendedora'), async (_req, res) => {
  try {
    const currentYear = new Date().getFullYear();
    const yearParam = Number.parseInt(_req.query.year, 10);
    const year = Number.isFinite(yearParam) ? yearParam : currentYear;

    if (_req.query.year && !Number.isFinite(yearParam)) {
      return res.status(400).json({ message: 'El año debe ser numérico (por ejemplo, 2024)' });
    }

    const [rows] = await pool.query(
      `SELECT
         cp.vendedora AS vendedora,
         MONTH(cp.ultactualizacion) AS mes,
         COUNT(*) AS cantidad
       FROM controlpedidos cp
       INNER JOIN vendedores v ON v.nombre = cp.vendedora
       INNER JOIN users u ON u.id_vendedoras = v.id
       WHERE YEAR(cp.ultactualizacion) = ?
         AND cp.total > 1
         AND cp.estado <> 2
         AND cp.ordenWeb > 0
         AND u.id_roles <> 4
       GROUP BY cp.vendedora, MONTH(cp.ultactualizacion)
       ORDER BY cp.vendedora, mes`,
      [year]
    );

    res.json({ year, data: rows });
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar pedidos mensuales', error: error.message });
  }
});

app.get('/api/ventas/mensual', requireAuth, requirePermission('dashboard-ventas-vendedora'), async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();
    const yearParam = Number.parseInt(req.query.year, 10);
    const year = Number.isFinite(yearParam) ? yearParam : currentYear;

    if (req.query.year && !Number.isFinite(yearParam)) {
      return res.status(400).json({ message: 'El año debe ser numérico (por ejemplo, 2024)' });
    }

    const [rows] = await pool.query(
      `SELECT
         f.vendedora AS vendedora,
         MONTH(f.fecha) AS mes,
         COUNT(*) AS cantidad,
         ROUND(SUM(f.Total), 2) AS totalFacturado
       FROM facturah f
       LEFT JOIN controlpedidos cp ON cp.nrofactura = f.nrofactura
       INNER JOIN vendedores v ON v.nombre = f.vendedora
       INNER JOIN users u ON u.id_vendedoras = v.id
       WHERE YEAR(f.fecha) = ?
         AND (f.Estado IS NULL OR f.Estado <> 2)
         AND (cp.nrofactura IS NULL OR cp.ordenWeb IS NULL OR cp.ordenWeb = 0)
         AND f.Total > 0
         AND u.id_roles <> 4
       GROUP BY f.vendedora, MONTH(f.fecha)
       ORDER BY f.vendedora, mes`,
      [year]
    );

    res.json({ year, data: rows });
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar ventas mensuales', error: error.message });
  }
});

app.get('/api/dashboard/comparativo-anual', requireAuth, requirePermission('dashboard-comparativo'), async (req, res) => {
  try {
    const validation = validateDashboardComparativoParams(req.query || {});
    if (!validation.ok) {
      return res.status(400).json({ message: validation.message });
    }
    const { yearA, yearB, monthFrom, monthTo, mode, entity } = validation.data;
    const allYears = String(req.query?.all_years || '').trim().toLowerCase() === 'true';
    const minYear = Math.min(yearA, yearB);
    const maxYear = Math.max(yearA, yearB);

    const queryParams = [monthFrom, monthTo];
    let sql = '';

    if (mode === 'cantidad' && entity === 'pedidos') {
      sql = `SELECT
               YEAR(cp.ultactualizacion) AS anio,
               MONTH(cp.ultactualizacion) AS mes,
               COUNT(*) AS valor,
               ROUND(SUM(cp.total), 2) AS monto
             FROM controlpedidos cp
             WHERE MONTH(cp.ultactualizacion) BETWEEN ? AND ?
               AND cp.total > 1
               AND cp.estado <> 2
               AND cp.ordenWeb > 0
               AND YEAR(cp.ultactualizacion) ${allYears ? 'BETWEEN ? AND ?' : 'IN (?, ?)'}
             GROUP BY YEAR(cp.ultactualizacion), MONTH(cp.ultactualizacion)
             ORDER BY anio, mes`;
    } else if (mode === 'cantidad' && entity === 'facturas') {
      sql = `SELECT
               YEAR(f.fecha) AS anio,
               MONTH(f.fecha) AS mes,
               COUNT(*) AS valor,
               ROUND(SUM(CASE WHEN f.Descuento IS NOT NULL THEN f.Descuento ELSE f.Total END), 2) AS monto
             FROM facturah f
             LEFT JOIN controlpedidos cp ON cp.nrofactura = f.nrofactura
             WHERE MONTH(f.fecha) BETWEEN ? AND ?
               AND (f.Estado IS NULL OR f.Estado <> 2)
               AND (cp.nrofactura IS NULL OR cp.ordenWeb IS NULL OR cp.ordenWeb = 0)
               AND f.Total > 0
               AND YEAR(f.fecha) ${allYears ? 'BETWEEN ? AND ?' : 'IN (?, ?)'}
             GROUP BY YEAR(f.fecha), MONTH(f.fecha)
             ORDER BY anio, mes`;
    } else {
      sql = `SELECT
               YEAR(f.fecha) AS anio,
               MONTH(f.fecha) AS mes,
               COUNT(*) AS cantidad,
               ROUND(SUM(CASE WHEN f.Descuento IS NOT NULL THEN f.Descuento ELSE f.Total END), 2) AS valor
             FROM facturah f
             WHERE MONTH(f.fecha) BETWEEN ? AND ?
               AND (f.Estado IS NULL OR f.Estado <> 2)
               AND f.Total > 0
               AND YEAR(f.fecha) ${allYears ? 'BETWEEN ? AND ?' : 'IN (?, ?)'}
             GROUP BY YEAR(f.fecha), MONTH(f.fecha)
             ORDER BY anio, mes`;
    }

    queryParams.push(allYears ? minYear : yearA, allYears ? maxYear : yearB);
    const [rows] = await pool.query(sql, queryParams);
    if (allYears) {
      return res.json(buildDashboardComparativoAllYearsPayload(validation.data, rows || []));
    }
    const rowsYearA = rows.filter((row) => Number(row.anio) === yearA);
    const rowsYearB = rows.filter((row) => Number(row.anio) === yearB);

    res.json(buildDashboardComparativoPayload(validation.data, rowsYearA, rowsYearB));
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar comparativo anual', error: error.message });
  }
});

app.get('/api/dashboard/inflacion-estimada', requireAuth, requirePermission('dashboard-comparativo'), async (req, res) => {
  try {
    const validation = validateDashboardComparativoParams({
      ...(req.query || {}),
      mode: 'inflacion',
      entity: 'compras',
    });
    if (!validation.ok) {
      return res.status(400).json({ message: validation.message });
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    const response = await fetch('https://api.argentinadatos.com/v1/finanzas/indices/inflacion', {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    });
    clearTimeout(timeoutId);
    if (!response.ok) {
      return res.status(502).json({
        message: `Error consultando inflación externa: HTTP ${response.status}`,
      });
    }
    const rows = await response.json();
    const payload = buildInflacionApiPayload(Array.isArray(rows) ? rows : [], validation.data);
    res.json({
      labels: payload.labels,
      series: payload.series,
      allSeries: payload.allSeries,
      meta: {
        mode: 'inflacion',
        entity: 'inflacion_externa',
        month_from: validation.data.monthFrom,
        month_to: validation.data.monthTo,
      },
      summary: payload.summary,
      source: payload.source,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar inflacion estimada', error: error.message });
  }
});

app.get('/api/pedidos/clientes', requireAuth, requirePermission('dashboard-pedidos-clientes'), async (req, res) => {
  try {
    const fechaParam = req.query.fecha ? parseISODate(req.query.fecha) : new Date();
    const yyyy = fechaParam.getFullYear();
    const mm = String(fechaParam.getMonth() + 1).padStart(2, '0');
    const dd = String(fechaParam.getDate()).padStart(2, '0');
    const fechaISO = `${yyyy}-${mm}-${dd}`;

    const sortKey = typeof req.query.sort === 'string' ? req.query.sort : null;
    const sortDir = req.query.dir === 'desc' ? 'DESC' : 'ASC';
    const sortMap = {
      nombre: 'c.nombre',
      apellido: 'c.apellido',
      totalPedidos: 'tot.totalPedidos',
      tipo: 'tipo',
      fidelizacionActiva: 'fidelizacionActiva',
    };
    const orderBy = sortKey && sortMap[sortKey] ? `${sortMap[sortKey]} ${sortDir}` : 'c.nombre, c.apellido';

    const pageReq = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(5, Number.parseInt(req.query.pageSize, 10) || 10));

    const [[countRow]] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM controlpedidos cp
       WHERE DATE(cp.fecha) = ?
         AND cp.id_cliente <> 1`,
      [fechaISO]
    );
    const total = Number(countRow.total) || 0;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(pageReq, totalPages);
    const offset = (page - 1) * pageSize;

    const [[totalsRow]] = await pool.query(
      `SELECT
         COUNT(*) AS totalPedidos,
         SUM(tipo = 'Nuevo') AS totalNuevos,
         SUM(tipo = 'Recurrente') AS totalRecurrentes
       FROM (
         SELECT
           CASE
             WHEN EXISTS (
               SELECT 1
               FROM facturah f
               WHERE f.id_clientes = c.id_clientes
                 AND f.fecha < cp.fecha
             ) THEN 'Recurrente'
             ELSE 'Nuevo'
           END AS tipo
         FROM controlpedidos cp
         INNER JOIN clientes c ON c.id_clientes = cp.id_cliente
         WHERE DATE(cp.fecha) = ?
         AND cp.id_cliente <> 1
         AND (cp.ordenWeb IS NOT NULL AND cp.ordenWeb <> 0)
       ) t`,
      [fechaISO]
    );

    const monthStart = new Date(Date.UTC(fechaParam.getUTCFullYear(), fechaParam.getUTCMonth(), 1));
    const mesDesde = monthStart.toISOString().slice(0, 10);
    const mesHasta = fechaISO; // hasta la fecha seleccionada (mes a la fecha)
    const [rows] = await pool.query(
      `SELECT
         cp.id,
         cp.id_cliente AS idCliente,
         c.nombre,
         c.apellido,
         c.mail,
         tot.totalPedidos,
         CASE
           WHEN EXISTS (
             SELECT 1
             FROM facturah f
             WHERE f.id_clientes = c.id_clientes
               AND f.fecha < cp.fecha
           ) THEN 'Recurrente'
           ELSE 'Nuevo'
         END AS tipo,
         CASE
           WHEN EXISTS (
             SELECT 1
             FROM fidelizacion_recomendacion fr
             WHERE fr.cliente_id = cp.id_cliente
               AND fr.estado IN ('PENDIENTE', 'EN_GESTION', 'CONTACTADA')
           ) OR EXISTS (
             SELECT 1
             FROM fidelizacion_recomendacion fr
             WHERE fr.cliente_id = cp.id_cliente
               AND fr.estado = 'CERRADA'
               AND fr.closed_at IS NOT NULL
               AND cp.fecha >= fr.closed_at
               AND cp.fecha < DATE_ADD(fr.closed_at, INTERVAL 11 DAY)
           ) THEN 1
           ELSE 0
         END AS fidelizacionActiva,
         CASE
           WHEN EXISTS (
             SELECT 1
             FROM fidelizacion_recomendacion fr
             WHERE fr.cliente_id = cp.id_cliente
               AND fr.estado IN ('PENDIENTE', 'EN_GESTION', 'CONTACTADA')
           ) THEN 'ABIERTA'
           WHEN EXISTS (
             SELECT 1
             FROM fidelizacion_recomendacion fr
             WHERE fr.cliente_id = cp.id_cliente
               AND fr.estado = 'CERRADA'
               AND fr.closed_at IS NOT NULL
               AND cp.fecha >= fr.closed_at
               AND cp.fecha < DATE_ADD(fr.closed_at, INTERVAL 11 DAY)
           ) THEN 'CERRADA_RECIENTE'
           ELSE ''
         END AS fidelizacionEstadoRef,
         (
           SELECT COALESCE(NULLIF(TRIM(v.Nombre), ''), 'Sin asignar')
           FROM fidelizacion_recomendacion fr
           LEFT JOIN vendedores v ON v.Id = fr.vendedora_id
           WHERE fr.cliente_id = cp.id_cliente
             AND (
               fr.estado IN ('PENDIENTE', 'EN_GESTION', 'CONTACTADA')
               OR (
                 fr.estado = 'CERRADA'
                 AND fr.closed_at IS NOT NULL
                 AND cp.fecha >= fr.closed_at
                 AND cp.fecha < DATE_ADD(fr.closed_at, INTERVAL 11 DAY)
               )
             )
           ORDER BY
             CASE WHEN fr.estado IN ('PENDIENTE', 'EN_GESTION', 'CONTACTADA') THEN 0 ELSE 1 END,
             COALESCE(fr.estado_updated_at, fr.closed_at, fr.created_at) DESC
           LIMIT 1
         ) AS fidelizacionVendedora,
         (
           SELECT DATEDIFF(DATE(cp.fecha), DATE(fr.closed_at))
           FROM fidelizacion_recomendacion fr
           WHERE fr.cliente_id = cp.id_cliente
             AND fr.estado = 'CERRADA'
             AND fr.closed_at IS NOT NULL
             AND cp.fecha >= fr.closed_at
             AND cp.fecha < DATE_ADD(fr.closed_at, INTERVAL 11 DAY)
           ORDER BY fr.closed_at DESC
           LIMIT 1
         ) AS fidelizacionCerradaHaceDias
      FROM controlpedidos cp
      INNER JOIN clientes c ON c.id_clientes = cp.id_cliente
      LEFT JOIN (
        SELECT id_cliente, COUNT(*) AS totalPedidos
        FROM controlpedidos
        WHERE id_cliente <> 1
          AND (ordenWeb IS NOT NULL AND ordenWeb <> 0)
          AND DATE(fecha) <= ?
        GROUP BY id_cliente
      ) tot ON tot.id_cliente = cp.id_cliente
      WHERE DATE(cp.fecha) = ?
        AND cp.id_cliente <> 1
        AND (cp.ordenWeb IS NOT NULL AND cp.ordenWeb <> 0)
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?`,
      [fechaISO, fechaISO, pageSize, offset]
    );

    res.json({
      fecha: fechaISO,
      page,
      pageSize,
      total,
      totalPages,
      totalPedidos: Number(totalsRow.totalPedidos) || 0,
      totalNuevos: Number(totalsRow.totalNuevos) || 0,
      totalRecurrentes: Number(totalsRow.totalRecurrentes) || 0,
      data: rows,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar pedidos de clientes', error: error.message });
  }
});

app.get('/api/facturacion/autorizacion', requireAuth, async (req, res) => {
  try {
    const cookies = parseCookies(req);
    const cookieOk = String(cookies.facturaKey || '') === '123456';
    if (cookieOk) {
      return res.json({ autorizado: true, ip: getRequestIp(req) });
    }
    const ip = getRequestIp(req);
    const candidates = buildIpCandidates(ip);
    const values = candidates.length ? candidates : [ip];
    const placeholders = values.map(() => '?').join(',');
    const [rows] = await pool.query(
      `SELECT 1 FROM ${DB_NAME}.autorizacion_facturaweb WHERE ip_autorizada IN (${placeholders}) LIMIT 1`,
      values
    );
    res.json({ autorizado: rows.length > 0, ip });
  } catch (error) {
    res.status(500).json({ message: 'Error al validar autorizacion', error: error.message });
  }
});

app.get('/api/facturacion/clientes', requireAuth, async (req, res) => {
  try {
    const term = String(req.query.q || '').trim();
    const like = `%${term}%`;
    const params = term ? [like, like, like, like, like, like, like] : [];
    const where = term
      ? `WHERE nombre LIKE ?
         OR apellido LIKE ?
         OR CONCAT(nombre, ' ', apellido) LIKE ?
         OR CONCAT(apellido, ' ', nombre) LIKE ?
         OR mail LIKE ?
         OR telefono LIKE ?
         OR apodo LIKE ?`
      : '';
    const [rows] = await pool.query(
      `SELECT id_clientes AS id, nombre, apellido, mail
       FROM ${DB_NAME}.clientes
       ${where}
       ORDER BY nombre
       LIMIT 50`,
      params
    );
    res.json({ data: rows || [] });
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar clientes', error: error.message });
  }
});

app.post('/api/facturacion/clientes', requireAuth, async (req, res) => {
  try {
    const {
      nombre = '',
      apellido = '',
      apodo = '',
      cuit = null,
      direccion = '',
      localidad = '',
      provincia_id = null,
      cod_postal = '',
      mail = '',
      telefono = '',
      encuesta = 'Ninguna',
    } = req.body || {};
    if (!nombre || !apellido || !mail || !cod_postal) {
      return res
        .status(400)
        .json({ message: 'Nombre, apellido, mail y codigo postal son requeridos' });
    }
    const [existsRows] = await pool.query(
      `SELECT mail FROM ${DB_NAME}.clientes WHERE mail = ? LIMIT 1`,
      [mail]
    );
    if (existsRows.length) {
      return res.status(409).json({ message: 'El cliente ya existe' });
    }
    await pool.query(
      `INSERT INTO ${DB_NAME}.clientes
       (nombre, apellido, apodo, direccion, mail, telefono, cuit, localidad, CodigoPostal, id_provincia, encuesta, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        nombre,
        apellido,
        apodo,
        direccion,
        mail,
        telefono,
        cuit,
        localidad,
        cod_postal,
        provincia_id,
        encuesta,
      ]
    );
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: 'Error al crear cliente', error: error.message });
  }
});

app.post('/api/clientes', requireAuth, async (req, res) => {
  try {
    const {
      nombre = '',
      apellido = '',
      apodo = '',
      cuit = null,
      direccion = '',
      localidad = '',
      provincia_id = null,
      cod_postal = '',
      mail = '',
      telefono = '',
      encuesta = 'Ninguna',
    } = req.body || {};
    if (!nombre || !apellido || !mail || !cod_postal) {
      return res
        .status(400)
        .json({ message: 'Nombre, apellido, mail y codigo postal son requeridos' });
    }
    const [existsRows] = await pool.query(
      `SELECT mail FROM ${DB_NAME}.clientes WHERE mail = ? LIMIT 1`,
      [mail]
    );
    if (existsRows.length) {
      return res.status(409).json({ message: 'El cliente ya existe' });
    }
    await pool.query(
      `INSERT INTO ${DB_NAME}.clientes
       (nombre, apellido, apodo, direccion, mail, telefono, cuit, localidad, CodigoPostal, id_provincia, encuesta, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        nombre,
        apellido,
        apodo,
        direccion,
        mail,
        telefono,
        cuit,
        localidad,
        cod_postal,
        provincia_id,
        encuesta,
      ]
    );
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: 'Error al crear cliente', error: error.message });
  }
});

app.get('/api/clientes/:id', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: 'Cliente invalido' });
    const [rows] = await pool.query(
      `SELECT id_clientes, nombre, apellido, apodo, cuit, direccion, localidad, id_provincia,
              CodigoPostal, mail, telefono, encuesta
       FROM ${DB_NAME}.clientes
       WHERE id_clientes = ? LIMIT 1`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ message: 'Cliente no encontrado' });
    res.json({ data: rows[0] });
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar cliente', error: error.message });
  }
});

app.patch('/api/clientes/:id', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: 'Cliente invalido' });
    const {
      nombre = '',
      apellido = '',
      apodo = '',
      cuit = null,
      direccion = '',
      localidad = '',
      provincia_id = null,
      cod_postal = '',
      mail = '',
      telefono = '',
      encuesta = 'Ninguna',
    } = req.body || {};
    if (!nombre || !apellido || !mail || !cod_postal) {
      return res
        .status(400)
        .json({ message: 'Nombre, apellido, mail y codigo postal son requeridos' });
    }
    const [mailRows] = await pool.query(
      `SELECT id_clientes FROM ${DB_NAME}.clientes WHERE mail = ? LIMIT 1`,
      [mail]
    );
    if (mailRows.length && Number(mailRows[0].id_clientes) !== id) {
      return res.status(409).json({ message: 'El cliente ya existe' });
    }
    await pool.query(
      `UPDATE ${DB_NAME}.clientes
       SET nombre = ?, apellido = ?, apodo = ?, cuit = ?, direccion = ?, localidad = ?,
           id_provincia = ?, CodigoPostal = ?, mail = ?, telefono = ?, encuesta = ?, updated_at = NOW()
       WHERE id_clientes = ? LIMIT 1`,
      [
        nombre,
        apellido,
        apodo,
        cuit,
        direccion,
        localidad,
        provincia_id,
        cod_postal,
        mail,
        telefono,
        encuesta,
        id,
      ]
    );
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar cliente', error: error.message });
  }
});

app.get('/api/provinciasSelect', requireAuth, async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, nombre FROM ${DB_NAME}.provincias ORDER BY nombre`
    );
    res.json(rows || []);
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar provincias', error: error.message });
  }
});

app.get('/api/facturacion/articulos', requireAuth, async (req, res) => {
  try {
    const term = String(req.query.q || '').trim();
    const like = `%${term}%`;
    const params = term ? [like, like] : [];
    const where = term ? 'WHERE Articulo LIKE ? OR Detalle LIKE ?' : '';
    const [rows] = await pool.query(
      `SELECT Articulo, Detalle, Cantidad, PrecioManual, PrecioConvertido, Moneda, Gastos, Ganancia, Proveedor
       FROM ${DB_NAME}.articulos
       ${where}
       ORDER BY Articulo
       LIMIT 50`,
      params
    );
    let precioDolar = 0;
    try {
      const [[dolarRow]] = await pool.query(`SELECT PrecioDolar FROM ${DB_NAME}.preciodolar LIMIT 1`);
      precioDolar = Number(dolarRow?.PrecioDolar) || 0;
    } catch (_err) {
      precioDolar = 0;
    }
    const proveedorCache = new Map();
    const data = [];
    for (const row of rows) {
      let precioVenta = 0;
      const precioManual = Number(row.PrecioManual) || 0;
      const precioConvertido = Number(row.PrecioConvertido) || 0;
      if (precioManual !== 0) {
        const gastos = Number(row.Gastos) || 0;
        const ganancia = Number(row.Ganancia) || 0;
        precioVenta = redondeoDecimal(precioManual * gastos * ganancia);
      } else if (precioConvertido !== 0) {
        let gastos = 0;
        let ganancia = 0;
        if (row.Proveedor) {
          if (!proveedorCache.has(row.Proveedor)) {
            const [[provRow]] = await pool.query(
              `SELECT Gastos, Ganancia FROM ${DB_NAME}.proveedores WHERE Nombre = ? LIMIT 1`,
              [row.Proveedor]
            );
            proveedorCache.set(row.Proveedor, provRow || null);
          }
          const prov = proveedorCache.get(row.Proveedor);
          gastos = Number(prov?.Gastos) || 0;
          ganancia = Number(prov?.Ganancia) || 0;
        }
        const moneda = String(row.Moneda || '').toUpperCase();
        if (moneda === 'ARG') {
          precioVenta = redondeoDecimal(precioConvertido * gastos * ganancia);
        } else {
          const precioEnPesos = precioConvertido * precioDolar;
          precioVenta = redondeoDecimal(precioEnPesos * gastos * ganancia);
        }
      }
      data.push({
        articulo: row.Articulo,
        detalle: row.Detalle,
        cantidad: row.Cantidad,
        precioVenta,
      });
    }
    res.json({ data });
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar articulos', error: error.message });
  }
});

app.get('/api/facturacion/articulo', requireAuth, async (req, res) => {
  try {
    const articulo = String(req.query.articulo || '').trim();
    if (!articulo) return res.status(400).json({ message: 'articulo requerido' });
    const [rows] = await pool.query(
      `SELECT Articulo, Detalle, Cantidad, PrecioManual, PrecioConvertido, Moneda, Gastos, Ganancia, Proveedor
       FROM ${DB_NAME}.articulos
       WHERE Articulo = ?
       LIMIT 1`,
      [articulo]
    );
    const row = rows[0];
    if (!row) return res.status(404).json({ message: 'Articulo no encontrado' });
    const precioVenta = (await computePrecioVenta(pool, row)) ?? 0;
    const precioArgen = await computePrecioArgen(pool, row);
    res.json({
      data: {
        articulo: row.Articulo,
        detalle: row.Detalle,
        cantidad: row.Cantidad,
        precioVenta,
        precioArgen,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar articulo', error: error.message });
  }
});

app.get('/api/facturacion/pedidos', requireAuth, async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         ctrl.nropedido,
         CONCAT(cli.nombre, ', ', cli.apellido) AS cliente,
         ctrl.ordenweb,
         ctrl.total,
         DATE_FORMAT(ctrl.fecha, '%d/%m/%Y') AS fecha,
         ctrl.vendedora,
         ctrl.id_cliente
       FROM ${DB_NAME}.controlpedidos AS ctrl
       INNER JOIN ${DB_NAME}.clientes cli ON ctrl.id_cliente = cli.id_clientes
       WHERE ctrl.estado = 1
         AND (ctrl.instancia = 2 OR ctrl.ordenweb = 0 OR ctrl.ordenweb IS NULL)
       ORDER BY ctrl.nropedido DESC`
    );
    res.json({ data: rows || [] });
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar pedidos', error: error.message });
  }
});

app.get('/api/facturas/next', requireAuth, async (_req, res) => {
  try {
    const [[row]] = await pool.query(`SELECT NroFactura FROM ${DB_NAME}.nrofactura LIMIT 1`);
    res.json({ nroFactura: row?.NroFactura || '' });
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar nro factura', error: error.message });
  }
});

app.get('/api/pedidos/next', requireAuth, async (_req, res) => {
  try {
    const [[row]] = await pool.query(
      `SELECT nropedido FROM ${DB_NAME}.controlpedidos ORDER BY nropedido DESC LIMIT 1`
    );
    const nroPedido = (Number(row?.nropedido) || 0) + 1;
    res.json({ nroPedido });
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar nro pedido', error: error.message });
  }
});

app.get('/api/pedidos/buscar', requireAuth, async (req, res) => {
  try {
    const nro = String(req.query.nro || '').trim();
    const search = String(req.query.q || '').trim();
    if (nro) {
      const [rows] = await pool.query(
        `SELECT
           ctrl.nropedido,
           ctrl.id_cliente,
           ctrl.vendedora,
           ctrl.total,
           ctrl.ordenweb,
           CONCAT(c.nombre, ' ', c.apellido) AS cliente
         FROM ${DB_NAME}.controlpedidos ctrl
         LEFT JOIN ${DB_NAME}.clientes c ON c.id_clientes = ctrl.id_cliente
         WHERE ctrl.nropedido = ?
           AND ctrl.estado = 1
           AND (ctrl.instancia = 2 OR ctrl.ordenweb = 0 OR ctrl.ordenweb IS NULL)
         LIMIT 1`,
        [nro]
      );
      return res.json({ data: rows || [] });
    }
    const like = `%${search}%`;
    const baseWhere = `WHERE ctrl.estado = 1 AND (ctrl.instancia = 2 OR ctrl.ordenweb = 0 OR ctrl.ordenweb IS NULL)`;
    const where = search ? `${baseWhere} AND (ctrl.nropedido LIKE ? OR CONCAT(c.nombre, ' ', c.apellido) LIKE ?)` : baseWhere;
    const params = search ? [like, like] : [];
    const [rows] = await pool.query(
      `SELECT
         ctrl.nropedido,
         ctrl.id_cliente,
         ctrl.vendedora,
         ctrl.total,
         ctrl.ordenweb,
         CONCAT(c.nombre, ' ', c.apellido) AS cliente
       FROM ${DB_NAME}.controlpedidos ctrl
       LEFT JOIN ${DB_NAME}.clientes c ON c.id_clientes = ctrl.id_cliente
       ${where}
       ORDER BY ctrl.nropedido DESC
       LIMIT 100`,
      params
    );
    res.json({ data: rows || [] });
  } catch (error) {
    res.status(500).json({ message: 'Error al buscar pedidos', error: error.message });
  }
});

app.post('/api/pedidos/reservar', requireAuth, async (_req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [[row]] = await connection.query(
      `SELECT Nropedido FROM ${DB_NAME}.nropedido LIMIT 1 FOR UPDATE`
    );
    const nroPedido = (Number(row?.Nropedido) || 0) + 1;
    await connection.query(`UPDATE ${DB_NAME}.nropedido SET Nropedido = ?`, [nroPedido]);
    await connection.commit();
    res.json({ nroPedido });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (_err) {
        /* ignore */
      }
    }
    res.status(500).json({ message: 'Error al reservar nro pedido', error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

app.get('/api/facturacion/tipo-pagos', requireAuth, async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id_tipo_pagos AS id, tipo_pago FROM ${DB_NAME}.tipo_pagos ORDER BY tipo_pago`
    );
    res.json({ data: rows || [] });
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar tipos de pago', error: error.message });
  }
});

app.get('/api/pedidos/articulo-foto', requireAuth, async (req, res) => {
  try {
    const nroArticulo = String(req.query.nroArticulo || '').trim();
    if (!nroArticulo) return res.status(400).json({ message: 'nroArticulo requerido' });
    const [rows] = await pool.query(
      `SELECT imagessrc FROM ${DB_NAME}.statusecomercesincro
       WHERE articulo = ?
         AND id_provecomerce = (
           SELECT id_provecomerce FROM ${DB_NAME}.statusecomercesincro
           ORDER BY id_provecomerce DESC LIMIT 1
         )`,
      [nroArticulo]
    );
    res.json({ data: rows || [] });
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar foto de articulo', error: error.message });
  }
});

app.put('/api/pedidos/:nro', requireAuth, async (req, res) => {
  let connection;
  try {
    const nroPedido = Number(req.params.nro);
    const { cliente_id, vendedora, ordenWeb = 0, items = [] } = req.body || {};
    const clienteId = Number(cliente_id) || 1;
    if (!nroPedido) {
      return res.status(400).json({ message: 'nroPedido requerido' });
    }
    if (!vendedora) {
      return res.status(400).json({ message: 'vendedora requerida' });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'items requeridos' });
    }
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [[existsRow]] = await connection.query(
      `SELECT nropedido FROM ${DB_NAME}.controlpedidos WHERE nropedido = ? LIMIT 1 FOR UPDATE`,
      [nroPedido]
    );
    if (!existsRow) {
      await connection.rollback();
      return res.status(404).json({ message: 'Pedido no encontrado' });
    }
    const fecha = formatDateTimeLocal(new Date());
    const cajera = req.user?.name || '';
    const local = Number(ordenWeb) ? process.env.LOCAL || null : null;
    const instancia = Number(ordenWeb) ? 2 : 0;
    const processedItems = [];
    let total = 0;
    for (const item of items) {
      const articulo = String(item.articulo || '').trim();
      const cantidad = Number(item.cantidad) || 0;
      if (!articulo || cantidad <= 0) continue;
      const [artRows] = await connection.query(
        `SELECT Articulo, Detalle, PrecioManual, PrecioConvertido, Moneda, Gastos, Ganancia, Proveedor
         FROM ${DB_NAME}.articulos
         WHERE Articulo = ?
         LIMIT 1`,
        [articulo]
      );
      const art = artRows[0];
      if (!art) continue;
      const precioVenta = (await computePrecioVenta(connection, art)) ?? 0;
      const precioArgen = await computePrecioArgen(connection, art);
      const precioUnitario = Number(item.precioUnitario) || precioVenta || 0;
      const totalItem = precioUnitario * cantidad;
      const ganancia = (precioUnitario - precioArgen) * cantidad;
      processedItems.push({
        articulo,
        detalle: art.Detalle,
        cantidad,
        precioArgen,
        precioUnitario,
        precioVenta: precioUnitario,
        total: totalItem,
        ganancia,
      });
    }
    if (!processedItems.length) {
      await connection.rollback();
      return res.status(400).json({ message: 'items invalidos' });
    }
    total = computePedidoSubtotal(processedItems);
    await connection.query(
      `UPDATE ${DB_NAME}.controlpedidos
       SET id_cliente = ?,
           vendedora = ?,
           total = ?,
           ordenWeb = ?,
           local = ?,
           instancia = ?,
           ultactualizacion = ?
       WHERE nropedido = ?
       LIMIT 1`,
      [clienteId, vendedora, total, ordenWeb, local, instancia, fecha, nroPedido]
    );
    await connection.query(`DELETE FROM ${DB_NAME}.pedidotemp WHERE NroPedido = ?`, [nroPedido]);
    for (const item of processedItems) {
      await connection.query(
        `INSERT INTO ${DB_NAME}.pedidotemp
         (NroPedido, Articulo, Detalle, Cantidad, PrecioArgen, PrecioUnitario, PrecioVenta, Ganancia, Descuento, Cajera, Vendedora, Fecha, Estado)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 1)`,
        [
          nroPedido,
          item.articulo,
          item.detalle,
          item.cantidad,
          item.precioArgen,
          item.precioUnitario,
          item.total,
          item.ganancia,
          cajera,
          vendedora,
          fecha,
        ]
      );
    }
    await connection.commit();
    res.json({ ok: true, nroPedido });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (_err) {
        /* ignore */
      }
    }
    res.status(500).json({ message: 'Error al actualizar pedido', error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

app.post('/api/pedidos', requireAuth, async (req, res) => {
  let connection;
  let idempotencyKey = '';
  try {
    const { cliente_id, vendedora, ordenWeb = 0, items = [], nroPedido } = req.body || {};
    idempotencyKey = normalizeIdempotencyKey(
      req.body?.idempotency_key || req.get('x-idempotency-key') || ''
    );
    const clienteId = Number(cliente_id) || 1;
    if (!vendedora) {
      return res.status(400).json({ message: 'vendedora requerida' });
    }
    let pedidoNumero = Number(nroPedido) || 0;
    if (!pedidoNumero) {
      return res.status(400).json({ message: 'nroPedido requerido' });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'items requeridos' });
    }
    connection = await pool.getConnection();
    await connection.beginTransaction();
    if (idempotencyKey) {
      const [[existingPedido]] = await connection.query(
        `SELECT nropedido
         FROM ${DB_NAME}.controlpedidos
         WHERE idempotency_key = ?
         LIMIT 1`,
        [idempotencyKey]
      );
      if (existingPedido?.nropedido) {
        await connection.commit();
        return res.json({
          ok: true,
          nroPedido: Number(existingPedido.nropedido) || 0,
          idempotentReplay: true,
        });
      }
    }
    let attempts = 0;
    while (attempts < 5) {
      const [[existsRow]] = await connection.query(
        `SELECT 1 FROM ${DB_NAME}.controlpedidos WHERE nropedido = ? LIMIT 1`,
        [pedidoNumero]
      );
      if (!existsRow) break;
      const [[row]] = await connection.query(
        `SELECT Nropedido FROM ${DB_NAME}.nropedido LIMIT 1 FOR UPDATE`
      );
      pedidoNumero = (Number(row?.Nropedido) || 0) + 1;
      await connection.query(`UPDATE ${DB_NAME}.nropedido SET Nropedido = ?`, [pedidoNumero]);
      attempts += 1;
    }
    if (attempts >= 5) {
      await connection.rollback();
      return res.status(409).json({ message: 'No se pudo reservar un nroPedido libre' });
    }
    const fecha = formatDateTimeLocal(new Date());
    const cajera = req.user?.name || '';
    const local = Number(ordenWeb) ? process.env.LOCAL || null : null;
    const instancia = Number(ordenWeb) ? 2 : 0;
    const processedItems = [];
    let total = 0;
    for (const item of items) {
      const articulo = String(item.articulo || '').trim();
      const cantidad = Number(item.cantidad) || 0;
      if (!articulo || cantidad <= 0) continue;
      const [artRows] = await connection.query(
        `SELECT Articulo, Detalle, PrecioManual, PrecioConvertido, Moneda, Gastos, Ganancia, Proveedor
         FROM ${DB_NAME}.articulos
         WHERE Articulo = ?
         LIMIT 1`,
        [articulo]
      );
      const art = artRows[0];
      if (!art) continue;
      const precioVenta = (await computePrecioVenta(connection, art)) ?? 0;
      const precioArgen = await computePrecioArgen(connection, art);
      const precioUnitario = Number(item.precioUnitario) || precioVenta || 0;
      const totalItem = precioUnitario * cantidad;
      const ganancia = (precioUnitario - precioArgen) * cantidad;
      total += totalItem;
      processedItems.push({
        articulo,
        detalle: art.Detalle,
        cantidad,
        precioArgen,
        precioUnitario,
        precioVenta: precioUnitario,
        total: totalItem,
        ganancia,
      });
    }
    if (!processedItems.length) {
      await connection.rollback();
      return res.status(400).json({ message: 'items invalidos' });
    }
    total = computePedidoSubtotal(processedItems);
    await connection.query(
      `INSERT INTO ${DB_NAME}.controlpedidos
       (id_cliente, nropedido, vendedora, cajera, fecha, estado, total, ordenWeb, empaquetado, local, instancia, idempotency_key)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?, 0, ?, ?, ?)`,
      [clienteId, pedidoNumero, vendedora, cajera, fecha, total, ordenWeb, local, instancia, idempotencyKey || null]
    );
    for (const item of processedItems) {
      await connection.query(
        `INSERT INTO ${DB_NAME}.pedidotemp
         (NroPedido, Articulo, Detalle, Cantidad, PrecioArgen, PrecioUnitario, PrecioVenta, Ganancia, Descuento, Cajera, Vendedora, Fecha, Estado)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 1)`,
        [
          pedidoNumero,
          item.articulo,
          item.detalle,
          item.cantidad,
          item.precioArgen,
          item.precioUnitario,
          item.total,
          item.ganancia,
          cajera,
          vendedora,
          fecha,
        ]
      );
    }
    await connection.commit();
    res.json({ ok: true, nroPedido: pedidoNumero });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (_err) {
        /* ignore */
      }
    }
    if (idempotencyKey && error?.code === 'ER_DUP_ENTRY') {
      try {
        const [[existingPedido]] = await pool.query(
          `SELECT nropedido
           FROM ${DB_NAME}.controlpedidos
           WHERE idempotency_key = ?
           LIMIT 1`,
          [idempotencyKey]
        );
        if (existingPedido?.nropedido) {
          return res.json({
            ok: true,
            nroPedido: Number(existingPedido.nropedido) || 0,
            idempotentReplay: true,
          });
        }
      } catch (_err) {
        // ignore y responder error original
      }
    }
    appendPedidoErrorLog(buildPedidoErrorEntry(req, error));
    res.status(500).json({ message: 'Error al crear pedido', error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

app.post('/api/facturas', requireAuth, async (req, res) => {
  let connection;
  let payloadValidation = null;
  try {
    payloadValidation = validateFacturaPayload(req.body || {});
    if (!payloadValidation.ok) {
      return res.status(400).json({ message: payloadValidation.message });
    }
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
    } = payloadValidation.data;
    const idempotencyKey = normalizeIdempotencyKey(
      req.body?.idempotency_key || req.get('x-idempotency-key') || ''
    );
    connection = await pool.getConnection();
    await connection.beginTransaction();
    if (idempotencyKey) {
      const [[existingFactura]] = await connection.query(
        `SELECT NroFactura
         FROM ${DB_NAME}.facturah
         WHERE idempotency_key = ?
         LIMIT 1`,
        [idempotencyKey]
      );
      if (existingFactura?.NroFactura) {
        await connection.commit();
        return res.json({
          ok: true,
          nroFactura: Number(existingFactura.NroFactura) || 0,
          idempotentReplay: true,
        });
      }
    }
    const [[nroRow]] = await connection.query(
      `SELECT NroFactura FROM ${DB_NAME}.nrofactura LIMIT 1 FOR UPDATE`
    );
    let nroFactura = Number(nroRow?.NroFactura) || 0;
    if (!nroFactura) {
      await connection.rollback();
      return res.status(500).json({ message: 'NroFactura no configurado' });
    }
    let exists = true;
    while (exists) {
      const [[factRow]] = await connection.query(
        `SELECT 1 FROM ${DB_NAME}.facturah WHERE NroFactura = ? LIMIT 1`,
        [nroFactura]
      );
      if (!factRow) {
        exists = false;
      } else {
        nroFactura += 1;
      }
    }
    const fecha = formatDateLocal(new Date());
    const cajera = req.user?.name || '';
    const processedItems = [];
    const processedItemsBySourceOrder = [];
    let subtotal = 0;
    let gananciaTotal = 0;
    let precioArgentina = 0;
    const itemsForStockLock = (Array.isArray(items) ? items : [])
      .map((item, sourceIndex) => ({ item, sourceIndex }))
      .sort((a, b) => {
        const articuloA = String(a.item?.articulo || '').trim();
        const articuloB = String(b.item?.articulo || '').trim();
        if (articuloA < articuloB) return -1;
        if (articuloA > articuloB) return 1;
        return a.sourceIndex - b.sourceIndex;
      });
    for (const wrapped of itemsForStockLock) {
      const item = wrapped.item || {};
      const articulo = String(item.articulo || '').trim();
      const cantidad = Number(item.cantidad) || 0;
      if (!articulo || cantidad <= 0) continue;
      const [artRows] = await connection.query(
        `SELECT Articulo, Detalle, PrecioManual, PrecioConvertido, Moneda, Gastos, Ganancia, Proveedor, Cantidad
         FROM ${DB_NAME}.articulos
         WHERE Articulo = ?
         LIMIT 1
         FOR UPDATE`,
        [articulo]
      );
      const art = artRows[0];
      if (!art) continue;
      const precioVenta = (await computePrecioVenta(connection, art)) ?? 0;
      const precioArgen = await computePrecioArgen(connection, art);
      const precioUnitario = Number(item.precioUnitario) || precioVenta || 0;
      const totalItem = precioUnitario * cantidad;
      const ganancia = (precioUnitario - precioArgen) * cantidad;
      subtotal += totalItem;
      gananciaTotal += ganancia;
      precioArgentina += precioArgen * cantidad;
      processedItems.push({
        sourceIndex: wrapped.sourceIndex,
        articulo,
        detalle: art.Detalle,
        cantidad,
        precioArgen,
        precioUnitario,
        precioVenta: totalItem,
        ganancia,
      });
      await connection.query(
        `UPDATE ${DB_NAME}.articulos SET Cantidad = Cantidad - ? WHERE Articulo = ? LIMIT 1`,
        [cantidad, articulo]
      );
    }
    if (!processedItems.length) {
      await connection.rollback();
      return res.status(400).json({ message: 'items invalidos' });
    }
    processedItemsBySourceOrder.push(
      ...processedItems.slice().sort((a, b) => a.sourceIndex - b.sourceIndex)
    );
    const pct = Number(porcentajeDescuento) || 0;
    const envioValue = Number(envio) || 0;
    const totalDescuento = pct > 0 ? subtotal * (1 - pct / 100) : null;
    const totalEnvio = (totalDescuento ?? subtotal) + envioValue;
    if (pct > 0) {
      gananciaTotal = Number(totalDescuento) - precioArgentina;
    }
    for (const item of processedItemsBySourceOrder) {
      await connection.query(
        `INSERT INTO ${DB_NAME}.factura
         (NroFactura, Articulo, Detalle, Cantidad, PrecioArgen, PrecioUnitario, PrecioVenta, Ganancia, Descuento, Cajera, Vendedora, Fecha, Estado)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 0)`,
        [
          nroFactura,
          item.articulo,
          item.detalle,
          item.cantidad,
          item.precioArgen,
          item.precioUnitario,
          item.precioVenta,
          item.ganancia,
          cajera,
          vendedora,
          fecha,
        ]
      );
    }
    const nowStamp = formatDateTimeLocal(new Date());
    await connection.query(
      `INSERT INTO ${DB_NAME}.facturah
       (NroFactura, Total, Porcentaje, Descuento, Ganancia, Fecha, Estado, id_clientes, envio, totalEnvio, id_tipo_pago, vendedora, pagomixto, created_at, updated_at, idempotency_key)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nroFactura,
        subtotal,
        pct,
        totalDescuento,
        gananciaTotal,
        fecha,
        cliente_id,
        envioValue,
        totalEnvio,
        tipo_pago_id,
        vendedora,
        Number(pagoMixto) || 0,
        nowStamp,
        nowStamp,
        idempotencyKey || null,
      ]
    );
    await connection.query(`UPDATE ${DB_NAME}.nrofactura SET NroFactura = ?`, [nroFactura + 1]);
    if (String(esPedido).toUpperCase() === 'SI' && nroPedido) {
      await connection.query(
        `UPDATE ${DB_NAME}.controlpedidos
         SET nrofactura = ?, estado = 0, empaquetado = ?
         WHERE nropedido = ?
         LIMIT 1`,
        [nroFactura, listoParaEnvio ? 1 : 0, nroPedido]
      );
      if (Number(listoParaEnvio) === 1) {
        await connection.query(
          `UPDATE ${DB_NAME}.mi_correo
           SET tipo = 0
           WHERE nropedido = ?`,
          [nroPedido]
        );
      }
    }
    await connection.commit();
    res.json({ ok: true, nroFactura });
  } catch (error) {
    if (error?.code === 'ER_DUP_ENTRY') {
      try {
        if (connection) {
          try {
            await connection.rollback();
          } catch (_rollbackErr) {
            /* ignore */
          }
        }
        const key = normalizeIdempotencyKey(req.body?.idempotency_key || req.get('x-idempotency-key') || '');
        if (key) {
          const [rows] = await pool.query(
            `SELECT NroFactura
             FROM ${DB_NAME}.facturah
             WHERE idempotency_key = ?
             LIMIT 1`,
            [key]
          );
          const factura = rows?.[0];
          if (factura?.NroFactura) {
            return res.json({
              ok: true,
              nroFactura: Number(factura.NroFactura) || 0,
              idempotentReplay: true,
            });
          }
        }
      } catch (_replayErr) {
        // fallback a manejo de error general
      }
    }
    if (connection) {
      try {
        await connection.rollback();
      } catch (_err) {
        /* ignore */
      }
    }
    appendFacturaErrorLog(buildFacturaErrorEntry(req, payloadValidation, error));
    res.status(500).json({ message: 'Error al crear factura', error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

app.get('/api/facturas', async (_req, res) => {
  try {
    const [facturas] = await pool.query(
      `SELECT
         COALESCE(f.id, f.NroFactura) AS id,
         CONCAT(c.nombre, ' ', c.apellido) AS cliente,
         f.NroFactura AS nroFactura,
         ROUND(CASE WHEN f.Descuento IS NOT NULL OR f.Descuento = 0 THEN f.Descuento ELSE f.total END, 2) AS totales,
         COALESCE(f.Envio, 0) AS envio,
         COALESCE(f.totalEnvio, 0) AS totalConEnvio,
         f.id_tipo_pago AS tipoPagoId,
         tp.tipo_pago AS tipoPago,
         f.id_estados_financiera AS estadoId,
         ef.nombre AS estado,
         DATE_FORMAT(f.fecha, '%Y-%m-%d') AS fecha,
         f.pagomixto AS pagoMixto,
         ROUND(
           CASE
             WHEN COALESCE(f.totalEnvio, 0) = 0 THEN
               (ROUND(CASE WHEN f.Descuento IS NOT NULL OR f.Descuento = 0 THEN f.Descuento ELSE f.total END, 2) -
                ROUND(CASE WHEN f.Descuento IS NOT NULL OR f.Descuento = 0 THEN f.Descuento ELSE f.total END, 2) * 0.025)
             ELSE
               (COALESCE(f.totalEnvio, 0) - COALESCE(f.totalEnvio, 0) * 0.025)
           END,
           2
         ) AS cobrar,
         f.comentario
       FROM facturah f
       INNER JOIN clientes c ON c.id_clientes = f.id_clientes
       INNER JOIN tipo_pagos tp ON tp.id_tipo_pagos = f.id_tipo_pago
       INNER JOIN estados_financiera ef ON ef.id_estado = f.id_estados_financiera
       ORDER BY f.NroFactura DESC`
    );

    const [tipoPagos] = await pool.query(
      'SELECT id_tipo_pagos AS id, tipo_pago FROM tipo_pagos ORDER BY tipo_pago'
    );
    const [estados] = await pool.query(
      'SELECT id_estado AS id, nombre FROM estados_financiera ORDER BY nombre'
    );

    res.json({ facturas, tipoPagos, estados });
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar facturas', error: error.message });
  }
});

app.put('/api/facturas/:id', async (req, res) => {
  try {
    const facturaId = Number(req.params.id);
    if (!Number.isFinite(facturaId)) {
      return res.status(400).json({ message: 'Id de factura inválido' });
    }

    const updates = [];
    const params = [];
    const { tipoPagoId, estadoId, comentario, pagoMixto } = req.body || {};

    if (tipoPagoId !== undefined) {
      if (!Number.isFinite(Number(tipoPagoId))) {
        return res.status(400).json({ message: 'tipoPagoId debe ser numérico' });
      }
      updates.push('id_tipo_pago = ?');
      params.push(Number(tipoPagoId));
    }
    if (estadoId !== undefined) {
      if (!Number.isFinite(Number(estadoId))) {
        return res.status(400).json({ message: 'estadoId debe ser numérico' });
      }
      updates.push('id_estados_financiera = ?');
      params.push(Number(estadoId));
    }
    if (comentario !== undefined) {
      updates.push('comentario = ?');
      params.push(comentario || '');
    }
    if (pagoMixto !== undefined) {
      const val = pagoMixto === '' || pagoMixto === null ? null : Number(pagoMixto);
      if (val !== null && !Number.isFinite(val)) {
        return res.status(400).json({ message: 'pagoMixto debe ser num‚rico' });
      }
      updates.push('pagomixto = ?');
      params.push(val);
    }

    if (!updates.length) {
      return res.status(400).json({ message: 'No hay campos para actualizar' });
    }

    params.push(facturaId);
    await pool.query(`UPDATE facturah SET ${updates.join(', ')} WHERE NroFactura = ? LIMIT 1`, params);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar factura', error: error.message });
  }
});

app.get('/api/comisiones/resumen', async (req, res) => {
  try {
    const hoy = new Date();
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const desdeDate = req.query.desde ? parseISODate(req.query.desde) : inicioMes;
    const hastaDate = req.query.hasta ? parseISODate(req.query.hasta) : hoy;
    const desde = desdeDate.toISOString().slice(0, 10);
    const hasta = hastaDate.toISOString().slice(0, 10);

    const [[row]] = await pool.query(
      `SELECT ROUND(SUM(CASE WHEN Descuento IS NOT NULL OR Descuento = 0 THEN Descuento ELSE total END), 2) AS totalFacturado
       FROM facturah
       WHERE DATE(fecha) BETWEEN ? AND ?`,
      [desde, hasta]
    );

    const totalFacturado = Number(row?.totalFacturado) || 0;
    res.json({ totalFacturado, desde, hasta });
  } catch (error) {
    res.status(500).json({ message: 'Error al calcular comisiones', error: error.message });
  }
});

app.get('/api/comisiones/tardes', async (req, res) => {
  try {
    const year = Number.parseInt(req.query.year, 10);
    const month = Number.parseInt(req.query.month, 10);
    if (!year || !month) return res.status(400).json({ message: 'year y month requeridos' });

    const desdeDate = new Date(year, month - 1, 1, 0, 0, 0);
    const hastaDate = new Date(year, month, 1, 0, 0, 0);
    const desde = formatDateTimeLocal(desdeDate);
    const hasta = formatDateTimeLocal(hastaDate);

    const [rows] = await pool.query(
      `SELECT
         u.id,
         u.name AS nombre,
         COALESCE(t.tardes, 0) AS tardes
       FROM users u
       LEFT JOIN (
         SELECT
           fd.id_user,
           CAST(SUM(
             CASE
               WHEN DAYOFWEEK(fd.primera_entrada) = 7 AND TIMEDIFF(TIME(fd.primera_entrada), '09:00:00') > '00:05:00' THEN 1
               WHEN DAYOFWEEK(fd.primera_entrada) <> 7 AND TIMEDIFF(TIME(fd.primera_entrada), COALESCE(u2.hora_ingreso, '09:00:00')) > '00:05:00' THEN 1
               ELSE 0
             END
           ) AS SIGNED) AS tardes
         FROM (
           SELECT
             f.id_user,
             DATE(f.fecha_ingreso) AS dia_fichaje,
             MIN(f.fecha_ingreso) AS primera_entrada
           FROM fichaje f
           WHERE f.fecha_ingreso >= ?
             AND f.fecha_ingreso < ?
           GROUP BY f.id_user, DATE(f.fecha_ingreso)
         ) fd
         INNER JOIN users u2 ON u2.id = fd.id_user
         GROUP BY fd.id_user
       ) t ON t.id_user = u.id
       WHERE u.id_roles NOT IN (1, 4)
       ORDER BY COALESCE(t.tardes, 0) DESC, u.name ASC`,
      [desde, hasta]
    );

    res.json({ data: rows, year, month });
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar tardes de comisiones', error: error.message });
  }
});

app.get('/api/salon/resumen', async (req, res) => {
  try {
    const desdeDate = req.query.desde ? parseISODate(req.query.desde) : new Date();
    const hastaDate = req.query.hasta ? parseISODate(req.query.hasta) : desdeDate;
    const fechaDesde = desdeDate.toISOString().slice(0, 10);
    const fechaHasta = hastaDate.toISOString().slice(0, 10);
    const salonFilterSql = `NOT EXISTS (
      SELECT 1
      FROM controlpedidos cp
      WHERE cp.nrofactura = f.NroFactura
        AND cp.ordenWeb IS NOT NULL
        AND cp.ordenWeb <> 0
    )`;

    const [[row]] = await pool.query(
      `SELECT
         ROUND(SUM(CASE WHEN f.Descuento IS NOT NULL OR f.Descuento = 0 THEN f.Descuento ELSE f.total END), 2) AS total,
         COUNT(*) AS cantidad
       FROM facturah f
       WHERE DATE(f.fecha) BETWEEN ? AND ?
         AND ${salonFilterSql}`,
      [fechaDesde, fechaHasta]
    );

    const [[clientesRow]] = await pool.query(
      `SELECT
         COUNT(*) AS clientesUnicos,
         SUM(CASE WHEN ventas_rango > 1 THEN 1 ELSE 0 END) AS clientesConMasDeUnaCompra,
         SUM(CASE WHEN DATE(fecha_primera) BETWEEN ? AND ? THEN 1 ELSE 0 END) AS clientesNuevos,
         SUM(CASE WHEN DATE(fecha_primera) < ? THEN 1 ELSE 0 END) AS clientesRecurrentes
       FROM (
         SELECT
           f.id_clientes,
           COUNT(*) AS ventas_rango,
           primera.fecha_primera
         FROM facturah f
         INNER JOIN (
           SELECT id_clientes, MIN(fecha) AS fecha_primera
           FROM facturah
           WHERE id_clientes IS NOT NULL
             AND id_clientes <> 1
           GROUP BY id_clientes
         ) primera ON primera.id_clientes = f.id_clientes
         WHERE DATE(f.fecha) BETWEEN ? AND ?
           AND ${salonFilterSql}
           AND f.id_clientes IS NOT NULL
           AND f.id_clientes <> 1
         GROUP BY f.id_clientes, primera.fecha_primera
       ) clientes`,
      [fechaDesde, fechaHasta, fechaDesde, fechaDesde, fechaHasta]
    );

    const [[sinClienteRow]] = await pool.query(
      `SELECT
         SUM(CASE WHEN f.id_clientes = 1 THEN 1 ELSE 0 END) AS ventasClienteNinguno,
         SUM(CASE WHEN f.id_clientes IS NULL THEN 1 ELSE 0 END) AS ventasSinCliente
       FROM facturah f
       WHERE DATE(f.fecha) BETWEEN ? AND ?
         AND ${salonFilterSql}`,
      [fechaDesde, fechaHasta]
    );

    const total = Number(row?.total) || 0;
    const cantidad = Number(row?.cantidad) || 0;
    const ticketPromedio = cantidad > 0 ? total / cantidad : 0;
    const clientesNuevos = Number(clientesRow?.clientesNuevos) || 0;
    const clientesRecurrentes = Number(clientesRow?.clientesRecurrentes) || 0;
    const clientesUnicos = Number(clientesRow?.clientesUnicos) || 0;
    const clientesConMasDeUnaCompra = Number(clientesRow?.clientesConMasDeUnaCompra) || 0;
    const ventasClienteNinguno = Number(sinClienteRow?.ventasClienteNinguno) || 0;
    const ventasSinCliente = Number(sinClienteRow?.ventasSinCliente) || 0;
    const importeVentaExpr = '(CASE WHEN f.Descuento IS NOT NULL OR f.Descuento = 0 THEN f.Descuento ELSE f.total END)';
    const [rangosRows] = await pool.query(
      `SELECT
         bucket,
         COUNT(*) AS cantidad,
         ROUND(SUM(importe), 2) AS montoTotal
       FROM (
         SELECT
           ${importeVentaExpr} AS importe,
           CASE
             WHEN ${importeVentaExpr} <= 10000 THEN 0
             ELSE FLOOR((${importeVentaExpr} - 0.01) / 10000)
           END AS bucket
         FROM facturah f
         WHERE DATE(f.fecha) BETWEEN ? AND ?
           AND ${salonFilterSql}
           AND ${importeVentaExpr} > 0
       ) ventas
       GROUP BY bucket
       ORDER BY bucket`,
      [fechaDesde, fechaHasta]
    );
    const rangosByBucket = new Map(
      (rangosRows || []).map((rangeRow) => [
        Number(rangeRow.bucket) || 0,
        {
          cantidad: Number(rangeRow.cantidad) || 0,
          montoTotal: Number(rangeRow.montoTotal) || 0,
        },
      ])
    );
    const maxBucket = rangosByBucket.size ? Math.max(...rangosByBucket.keys()) : -1;
    const rangos = [];
    for (let bucket = 0; bucket <= maxBucket; bucket += 1) {
      const lower = bucket === 0 ? 0 : bucket * 10000 + 1;
      const upper = (bucket + 1) * 10000;
      const values = rangosByBucket.get(bucket) || { cantidad: 0, montoTotal: 0 };
      if (!values.cantidad) continue;
      rangos.push({
        rango: `$${lower.toLocaleString('es-AR')} - $${upper.toLocaleString('es-AR')}`,
        desde: lower,
        hasta: upper,
        cantidad: values.cantidad,
        montoTotal: values.montoTotal,
      });
    }

    res.json({
      desde: fechaDesde,
      hasta: fechaHasta,
      total,
      cantidad,
      ticketPromedio,
      clientesNuevos,
      clientesRecurrentes,
      clientesUnicos,
      clientesConMasDeUnaCompra,
      ventasClienteNinguno,
      ventasSinCliente,
      rangos,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar resumen de salón', error: error.message });
  }
});

app.get('/api/pedidos/resumen', async (req, res) => {
  try {
    const desdeDate = req.query.desde ? parseISODate(req.query.desde) : new Date();
    const hastaDate = req.query.hasta ? parseISODate(req.query.hasta) : desdeDate;
    const fechaDesde = desdeDate.toISOString().slice(0, 10);
    const fechaHasta = hastaDate.toISOString().slice(0, 10);

    const [[row]] = await pool.query(
      `SELECT
         ROUND(SUM(CASE WHEN f.Descuento IS NOT NULL OR f.Descuento = 0 THEN f.Descuento ELSE f.total END), 2) AS total,
         COUNT(*) AS cantidad
       FROM facturah f
       INNER JOIN controlpedidos cp ON cp.nrofactura = f.nrofactura
       WHERE DATE(f.fecha) BETWEEN ? AND ?
         AND cp.ordenWeb IS NOT NULL
         AND cp.ordenWeb <> 0`,
      [fechaDesde, fechaHasta]
    );

    const total = Number(row?.total) || 0;
    const cantidad = Number(row?.cantidad) || 0;
    const ticketPromedio = cantidad > 0 ? total / cantidad : 0;

    res.json({
      desde: fechaDesde,
      hasta: fechaHasta,
      total,
      cantidad,
      ticketPromedio,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar resumen de pedidos', error: error.message });
  }
});

app.get('/api/pedidos/vendedoras', async (req, res) => {
  try {
    const desdeDate = req.query.desde ? parseISODate(req.query.desde) : new Date();
    const hastaDate = req.query.hasta ? parseISODate(req.query.hasta) : desdeDate;
    const fechaDesde = desdeDate.toISOString().slice(0, 10);
    const fechaHasta = hastaDate.toISOString().slice(0, 10);

    const [rows] = await pool.query(
      `SELECT
         f.vendedora,
         COUNT(*) AS cantidad
       FROM facturah f
       INNER JOIN controlpedidos cp ON cp.nrofactura = f.nrofactura
       WHERE DATE(f.fecha) BETWEEN ? AND ?
         AND cp.ordenWeb IS NOT NULL
         AND cp.ordenWeb <> 0
       GROUP BY f.vendedora
       ORDER BY cantidad DESC, f.vendedora`,
      [fechaDesde, fechaHasta]
    );

    res.json({ desde: fechaDesde, hasta: fechaHasta, data: rows || [] });
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar pedidos por vendedora', error: error.message });
  }
});

  app.get('/api/salon/vendedoras', async (req, res) => {
  try {
    const desdeDate = req.query.desde ? parseISODate(req.query.desde) : new Date();
    const hastaDate = req.query.hasta ? parseISODate(req.query.hasta) : desdeDate;
    const fechaDesde = desdeDate.toISOString().slice(0, 10);
    const fechaHasta = hastaDate.toISOString().slice(0, 10);

    const [rows] = await pool.query(
      `SELECT
         COALESCE(NULLIF(TRIM(f.vendedora), ''), 'Sin vendedora') AS vendedora,
         COUNT(*) AS cantidad
       FROM facturah f
       WHERE DATE(f.fecha) BETWEEN ? AND ?
         AND NOT EXISTS (
           SELECT 1
           FROM controlpedidos cp
           WHERE cp.nrofactura = f.NroFactura
             AND cp.ordenWeb IS NOT NULL
             AND cp.ordenWeb <> 0
         )
       GROUP BY COALESCE(NULLIF(TRIM(f.vendedora), ''), 'Sin vendedora')
       ORDER BY cantidad DESC, vendedora`,
      [fechaDesde, fechaHasta]
    );

    res.json({ desde: fechaDesde, hasta: fechaHasta, data: rows || [] });
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar ventas por vendedora (salón)', error: error.message });
  }
  });

  app.get('/api/salon/vendedoras/detalle', async (req, res) => {
    try {
      const desdeDate = req.query.desde ? parseISODate(req.query.desde) : new Date();
      const hastaDate = req.query.hasta ? parseISODate(req.query.hasta) : desdeDate;
      const fechaDesde = desdeDate.toISOString().slice(0, 10);
      const fechaHasta = hastaDate.toISOString().slice(0, 10);
      const vendedora = String(req.query.vendedora || '').trim();
      if (!vendedora) return res.status(400).json({ message: 'vendedora requerida' });

      const conditions = [
        'DATE(f.fecha) BETWEEN ? AND ?',
        `NOT EXISTS (
          SELECT 1
          FROM controlpedidos cp
          WHERE cp.nrofactura = f.NroFactura
            AND cp.ordenWeb IS NOT NULL
            AND cp.ordenWeb <> 0
        )`,
      ];
      const params = [fechaDesde, fechaHasta];
      if (vendedora === 'Sin vendedora') {
        conditions.push("NULLIF(TRIM(f.vendedora), '') IS NULL");
      } else {
        conditions.push('TRIM(f.vendedora) = ?');
        params.push(vendedora);
      }

      const [rows] = await pool.query(
        `SELECT
           COALESCE(NULLIF(TRIM(CONCAT(COALESCE(cli.nombre, ''), ' ', COALESCE(cli.apellido, ''))), ''), 'Sin cliente') AS cliente,
           CASE
             WHEN f.id_clientes IS NULL OR f.id_clientes = 1 THEN 'No aplica'
             WHEN DATE(primera.fecha_primera) BETWEEN ? AND ? THEN 'Nuevo'
             WHEN DATE(primera.fecha_primera) < ? THEN 'Recurrente'
             ELSE 'No aplica'
           END AS tipoCliente,
           f.NroFactura AS factura,
           CASE WHEN f.Descuento IS NOT NULL OR f.Descuento = 0 THEN f.Descuento ELSE f.Total END AS total,
           DATE_FORMAT(f.fecha, '%Y-%m-%d') AS fecha,
           DATE_FORMAT(f.created_at, '%H:%i:%s') AS hora
         FROM facturah f
         LEFT JOIN clientes cli ON cli.id_clientes = f.id_clientes
         LEFT JOIN (
           SELECT id_clientes, MIN(fecha) AS fecha_primera
           FROM facturah
           WHERE id_clientes IS NOT NULL
             AND id_clientes <> 1
           GROUP BY id_clientes
         ) primera ON primera.id_clientes = f.id_clientes
         WHERE ${conditions.join(' AND ')}
         ORDER BY f.fecha DESC, f.NroFactura DESC`,
        [fechaDesde, fechaHasta, fechaDesde, ...params]
      );

      res.json({ desde: fechaDesde, hasta: fechaHasta, data: rows || [] });
    } catch (error) {
      res.status(500).json({ message: 'Error al cargar ventas por vendedora (salón)', error: error.message });
    }
  });

  app.get('/api/salon/detalle', async (req, res) => {
    try {
      const desdeDate = req.query.desde ? parseISODate(req.query.desde) : new Date();
      const hastaDate = req.query.hasta ? parseISODate(req.query.hasta) : desdeDate;
      const fechaDesde = desdeDate.toISOString().slice(0, 10);
      const fechaHasta = hastaDate.toISOString().slice(0, 10);
      const tipo = String(req.query.tipo || 'ventas').trim().toLowerCase();
      const tiposValidos = new Set(['ventas', 'nuevos', 'recurrentes']);
      if (!tiposValidos.has(tipo)) return res.status(400).json({ message: 'tipo invalido' });

      const salonFilterSql = `NOT EXISTS (
        SELECT 1
        FROM controlpedidos cp
        WHERE cp.nrofactura = f.NroFactura
          AND cp.ordenWeb IS NOT NULL
          AND cp.ordenWeb <> 0
      )`;
      const tipoClienteSql = `CASE
        WHEN f.id_clientes IS NULL OR f.id_clientes = 1 THEN 'No aplica'
        WHEN DATE(primera.fecha_primera) BETWEEN ? AND ? THEN 'Nuevo'
        WHEN DATE(primera.fecha_primera) < ? THEN 'Recurrente'
        ELSE 'No aplica'
      END`;
      const selectSql = `SELECT
        COALESCE(NULLIF(TRIM(CONCAT(COALESCE(cli.nombre, ''), ' ', COALESCE(cli.apellido, ''))), ''), 'Sin cliente') AS cliente,
        ${tipoClienteSql} AS tipoCliente,
        f.NroFactura AS factura,
        CASE WHEN f.Descuento IS NOT NULL OR f.Descuento = 0 THEN f.Descuento ELSE f.Total END AS total,
        DATE_FORMAT(f.fecha, '%Y-%m-%d') AS fecha,
        DATE_FORMAT(f.created_at, '%H:%i:%s') AS hora,
        CASE
          WHEN f.id_clientes IS NULL OR f.id_clientes = 1 THEN 0
          ELSE (
            SELECT COUNT(*)
            FROM facturah fr
            WHERE fr.id_clientes = f.id_clientes
              AND DATE(fr.fecha) BETWEEN ? AND ?
              AND NOT EXISTS (
                SELECT 1
                FROM controlpedidos cpr
                WHERE cpr.nrofactura = fr.NroFactura
                  AND cpr.ordenWeb IS NOT NULL
                  AND cpr.ordenWeb <> 0
              )
          )
        END AS comprasClienteRango
      FROM facturah f
      LEFT JOIN clientes cli ON cli.id_clientes = f.id_clientes
      LEFT JOIN (
        SELECT id_clientes, MIN(fecha) AS fecha_primera
        FROM facturah
        WHERE id_clientes IS NOT NULL
          AND id_clientes <> 1
        GROUP BY id_clientes
      ) primera ON primera.id_clientes = f.id_clientes`;

      let whereSql = `WHERE DATE(f.fecha) BETWEEN ? AND ?
        AND ${salonFilterSql}`;
      const params = [fechaDesde, fechaHasta, fechaDesde, fechaDesde, fechaHasta, fechaDesde, fechaHasta];

      if (tipo === 'ventas') {
        const [rows] = await pool.query(
          `${selectSql}
           ${whereSql}
           ORDER BY f.fecha DESC, f.NroFactura DESC`,
          params
        );
        return res.json({ desde: fechaDesde, hasta: fechaHasta, tipo, data: rows || [] });
      }

      whereSql += ` AND f.id_clientes IS NOT NULL
        AND f.id_clientes <> 1
        AND ${tipo === 'nuevos' ? 'DATE(primera.fecha_primera) BETWEEN ? AND ?' : 'DATE(primera.fecha_primera) < ?'}
        AND f.NroFactura = (
          SELECT f2.NroFactura
          FROM facturah f2
          WHERE f2.id_clientes = f.id_clientes
            AND DATE(f2.fecha) BETWEEN ? AND ?
            AND NOT EXISTS (
              SELECT 1
              FROM controlpedidos cp2
              WHERE cp2.nrofactura = f2.NroFactura
                AND cp2.ordenWeb IS NOT NULL
                AND cp2.ordenWeb <> 0
            )
          ORDER BY f2.fecha ${tipo === 'nuevos' ? 'ASC' : 'DESC'}, f2.NroFactura ${tipo === 'nuevos' ? 'ASC' : 'DESC'}
          LIMIT 1
        )`;
      if (tipo === 'nuevos') {
        params.push(fechaDesde, fechaHasta);
      } else {
        params.push(fechaDesde);
      }
      params.push(fechaDesde, fechaHasta);

      const [rows] = await pool.query(
        `${selectSql}
         ${whereSql}
         ORDER BY f.fecha DESC, f.NroFactura DESC`,
        params
      );
      return res.json({ desde: fechaDesde, hasta: fechaHasta, tipo, data: rows || [] });
    } catch (error) {
      return res.status(500).json({ message: 'Error al cargar detalle de salón', error: error.message });
    }
  });

app.post('/api/ia/chat', express.json({ limit: '2mb' }), async (req, res) => {
  try {
    const { message, files = [] } = req.body || {};
    const allowedExt = new Set(['pdf', 'csv', 'xls', 'xlsx', 'doc', 'docx']);
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ message: 'Mensaje requerido' });
    }
    if (!openai) {
      return res.status(400).json({ message: 'OPENAI_API_KEY no configurada en el servidor' });
    }
    let promptFiles = 'Sin adjuntos.';
    if (Array.isArray(files) && files.length) {
      try {
        const { summary } = await processUploadedFiles(files);
        promptFiles = summary ? `Contenido de adjuntos:\n${summary}` : promptFiles;
      } catch (err) {
        return res.status(400).json({ message: err.message || 'Error procesando adjuntos' });
      }
    }
    const systemPrompt =
      'Eres un asistente amable y conciso. El servidor ya procesó los adjuntos permitidos (PDF, CSV, XLS/XLSX, DOC/DOCX) ' +
      'y te entrega a continuación un resumen del contenido (primeros ~3000 caracteres o 30 filas). ' +
      'Usa ese resumen directamente para responder; no pidas al usuario que ejecute comandos ni que pegue texto adicional. ' +
      'Devuelve respuestas cortas y accionables.';

    const completion = await withRetry(() =>
      openai.chat.completions.create({
        model: OPENAI_MODEL || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `${message}\n\n${promptFiles}` },
        ],
      })
    );
    const reply = completion.choices?.[0]?.message?.content || 'Sin respuesta';
    return res.json({ reply });
  } catch (error) {
    return res.status(500).json({ message: 'Error en OpenAI', error: error.message });
  }
});

app.post('/api/ia/db-query', express.json({ limit: '1mb' }), async (req, res) => {
  try {
    let attemptedSql = '';
    const { question } = req.body || {};
    if (!question || typeof question !== 'string') {
      return res.status(400).json({ message: 'Pregunta requerida' });
    }
    if (!openai) {
      return res.status(400).json({ message: 'OPENAI_API_KEY no configurada en el servidor' });
    }

    const schemaMeta = getCustomSchemaSummary();
    if (!schemaMeta.text) {
      return res.status(400).json({ message: 'No hay información para su consulta' });
    }

    const baseSystemPrompt = (extraRules = '') =>
      'Eres un analista SQL para MySQL. Genera consultas de SOLO LECTURA usando únicamente las tablas y columnas listadas. ' +
      'Si la pregunta requiere tablas/columnas que no estén en la lista, responde con sql="/* sin informacion */" y explanation="No hay información para su consulta". ' +
      'Usa EXACTAMENTE los nombres de columnas/tablas listados (respetando mayúsculas/minúsculas tal como aparezcan). ' +
      'Si el texto del esquema trae ejemplos o reglas (como manejo de descuentos en facturación), respétalos literalmente al generar la consulta. ' +
      'Para calcular facturación con descuentos en la tabla facturah, usa la lógica: SUM(CASE WHEN Descuento IS NOT NULL OR Descuento = 0 THEN Descuento ELSE Total END). ' +
      'Si necesitas el último registro (pedido, factura, etc.), ordena por la fecha correspondiente en orden DESC y limita a 1. ' +
      'No uses subconsultas ni tablas derivadas; usa JOIN y ORDER BY ... DESC LIMIT 1 directamente en la consulta principal. ' +
      'Respeta ONLY_FULL_GROUP_BY: si usas GROUP BY, solo ordena por columnas agrupadas o agregadas (usa alias). Usa COALESCE para nulos en agregaciones y limita resultados con LIMIT si no se especifica. ' +
      (extraRules ? extraRules + ' ' : '') +
      'Responde SOLO en JSON con las claves: sql (string) y explanation (string breve). No inventes columnas ni tablas.';

    const userPrompt = (q) => `Pregunta del usuario: "${q}"
Esquema disponible:
${schemaMeta.text}`;

    async function requestCompletion(extraRules = '') {
      const completion = await withRetry(() =>
        openai.chat.completions.create({
          model: OPENAI_MODEL || 'gpt-4o-mini',
          temperature: 0,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: baseSystemPrompt(extraRules) },
            { role: 'user', content: userPrompt(question) },
          ],
        })
      );
      return completion.choices?.[0]?.message?.content || '{}';
    }

    let content;
    try {
      content = await requestCompletion();
    } catch (error) {
      return res.status(500).json({ message: 'No se pudo interpretar la respuesta de IA', error: error.message });
    }
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (error) {
      return res.status(500).json({ message: 'No se pudo interpretar la respuesta de IA', error: error.message });
    }

    let sql = typeof parsed.sql === 'string' ? parsed.sql : '';
    attemptedSql = sql;
    if (hasSubquery(sql)) {
      try {
        content = await requestCompletion('Reescribe SIN subconsultas ni tablas derivadas; usa solo JOIN y ORDER BY ... DESC LIMIT 1 en la consulta principal.');
        parsed = JSON.parse(content);
        sql = typeof parsed.sql === 'string' ? parsed.sql : '';
        attemptedSql = sql;
      } catch (error) {
        return res.status(400).json({ message: 'La consulta generada usa subconsultas no permitidas.', sql: attemptedSql });
      }
    }

    if (!isSafeSelect(sql)) {
      return res.status(400).json({ message: 'La consulta generada no es segura. Reformula tu pregunta.', sql: attemptedSql });
    }
    if (hasSubquery(sql)) {
      return res.status(400).json({ message: 'La consulta generada usa subconsultas no permitidas.', sql: attemptedSql });
    }
    const schemaCheck = validateAgainstSchema(sql, schemaMeta);
    if (!schemaCheck.ok) {
      return res.status(400).json({
        message: 'La consulta generada usa tablas o columnas no permitidas.',
        tables: schemaCheck.invalidTables,
        columns: schemaCheck.invalidColumns,
        sql: attemptedSql,
      });
    }
    const safeSql = clampLimit(sql);

    const [rows] = await pool.query(safeSql);
    const normalized = Array.isArray(rows) ? normalizeRows(rows) : [];
    const noData = normalized.length === 0;
    return res.json({
      query: safeSql,
      rows: normalized,
      rowCount: normalized.length,
      explanation: parsed.explanation || 'Consulta generada',
      message: noData ? 'No hay datos registrados' : undefined,
    });
  } catch (error) {
    const isMysqlError = error && typeof error.code === 'string';
    return res
      .status(isMysqlError ? 400 : 500)
      .json({ message: 'Error al ejecutar consulta IA', error: error.message || String(error), sql: attemptedSql || '' });
  }
});

app.post('/api/ocr/deepseek', requireAuth, express.json({ limit: '15mb' }), async (req, res) => {
  try {
    const { imageData } = req.body || {};
    if (!imageData) {
      return res.status(400).json({ message: 'Falta imageData.' });
    }
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ message: 'DeepSeek no configurado.' });
    }
    const baseUrl = process.env.DEEPSEEK_API_BASE || 'https://api.deepseek.com';
    const model = process.env.DEEPSEEK_VISION_MODEL || 'deepseek-vl2';
    const prompt =
      process.env.DEEPSEEK_VISION_PROMPT ||
      'Extrae el importe total del comprobante. Responde solo JSON con las claves amountText y fullText.';

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    const imageBase64 = String(imageData || '').replace(/^data:[^,]+,/, '');
    const payloads = [
      {
        model,
        temperature: 0,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: imageData } },
            ],
          },
        ],
      },
      {
        model,
        temperature: 0,
        messages: [{ role: 'user', content: prompt }],
        images: [imageData],
      },
      {
        model,
        temperature: 0,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image', image_url: imageData },
            ],
          },
        ],
      },
      {
        model,
        temperature: 0,
        messages: [{ role: 'user', content: prompt }],
        images: [imageBase64],
      },
    ];

    const callDeepSeek = async (payload) => {
      const r = await fetch(`${baseUrl.replace(/\/+$/, '')}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) {
        const msg = json?.error?.message || `DeepSeek error ${r.status}`;
        throw new Error(msg);
      }
      return json;
    };

    let response;
    let lastError;
    for (let i = 0; i < payloads.length; i += 1) {
      try {
        response = await withRetry(() => callDeepSeek(payloads[i]), { retries: 1, baseDelayMs: 400 });
        lastError = null;
        break;
      } catch (err) {
        lastError = err;
        const msg = String(err?.message || '');
        const retryable =
          msg.includes('unknown variant') ||
          msg.includes('expected `text`') ||
          msg.includes('expected text') ||
          msg.includes('image');
        if (!retryable) break;
      }
    }
    clearTimeout(timeout);
    if (!response) {
      throw lastError || new Error('DeepSeek sin respuesta');
    }

    const content = response?.choices?.[0]?.message?.content || '';
    const cleaned = String(content || '')
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();
    let parsed = null;
    try {
      parsed = JSON.parse(cleaned);
    } catch (_err) {
      parsed = null;
    }
    return res.json({
      content: cleaned,
      amountText: parsed?.amountText || '',
      fullText: parsed?.fullText || parsed?.text || '',
    });
  } catch (error) {
    return res.status(500).json({ message: 'Error en DeepSeek', error: error.message });
  }
});

app.post('/api/ocr/openai', requireAuth, express.json({ limit: '25mb' }), async (req, res) => {
  try {
    const { imageData } = req.body || {};
    if (!imageData) {
      return res.status(400).json({ message: 'Falta imageData.' });
    }
    if (!openai) {
      return res.status(500).json({ message: 'OPENAI_API_KEY no configurada en el servidor' });
    }
    const model = process.env.OPENAI_VISION_MODEL || OPENAI_MODEL || 'gpt-4o-mini';
    const prompt =
      process.env.OPENAI_VISION_PROMPT ||
      'Extrae el importe total del comprobante. Responde solo JSON con las claves amountText y fullText.';

    const completion = await withRetry(() =>
      openai.chat.completions.create({
        model,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: imageData } },
            ],
          },
        ],
      })
    );

    const content = completion.choices?.[0]?.message?.content || '';
    let parsed = null;
    try {
      parsed = JSON.parse(content);
    } catch (_err) {
      parsed = null;
    }
    return res.json({
      content,
      amountText: parsed?.amountText || '',
      fullText: parsed?.fullText || parsed?.text || '',
    });
  } catch (error) {
    return res.status(500).json({ message: 'Error en OpenAI', error: error.message });
  }
});

  // Endpoint legacy de OpenAI (se mantiene por compatibilidad).
  app.post('/api/ecommerce/imagenweb', requireAuth, express.json({ limit: '35mb' }), async (req, res) => {
  let tmpDir = null;
  try {
    const { imageDataUrl, prompt, maskDataUrl } = req.body || {};
    if (!imageDataUrl || !prompt) {
      return res.status(400).json({ message: 'Falta imageDataUrl o prompt.' });
    }
    if (!openai) {
      return res.status(500).json({ message: 'OPENAI_API_KEY no configurada en el servidor' });
    }

    const match = String(imageDataUrl).match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) {
      return res.status(400).json({ message: 'Formato de imagen inválido.' });
    }
    const mime = match[1].toLowerCase();
    const base64 = match[2];
    const extMap = {
      'image/png': '.png',
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/webp': '.webp',
    };
    const ext = extMap[mime];
    if (!ext) {
      return res.status(400).json({ message: 'Formato de imagen no soportado.' });
    }

    tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'ecommerce-'));
    const inputPath = path.join(tmpDir, `input${ext}`);
    await fsp.writeFile(inputPath, Buffer.from(base64, 'base64'));

    const model = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';
    const imageFile = await toFile(Buffer.from(base64, 'base64'), `input${ext}`, { type: mime });
    let maskFile = null;
    if (maskDataUrl) {
      const maskMatch = String(maskDataUrl).match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
      if (!maskMatch) {
        return res.status(400).json({ message: 'Formato de mascara invalido.' });
      }
      const maskMime = maskMatch[1].toLowerCase();
      const maskBase64 = maskMatch[2];
      const maskExt = extMap[maskMime];
      if (!maskExt) {
        return res.status(400).json({ message: 'Formato de mascara no soportado.' });
      }
      maskFile = await toFile(Buffer.from(maskBase64, 'base64'), `mask${maskExt}`, { type: maskMime });
    }
    const promptPrefix =
      'Conserva exactamente el articulo original con todos sus detalles y texturas. ' +
      'No modifiques forma, relieve, grabados ni materiales. ' +
      'No inventes ni suavices detalles. Solo aplica los cambios solicitados. ';
    const finalPrompt = `${promptPrefix}${prompt}`.trim();

    const response = await withRetry(() =>
      openai.images.edit({
        model,
        prompt: finalPrompt,
        image: imageFile,
        ...(maskFile ? { mask: maskFile } : {}),
        size: '1024x1024',
      })
    );

    const b64 = response?.data?.[0]?.b64_json;
    const url = response?.data?.[0]?.url;
    if (b64) {
      return res.json({ imageDataUrl: `data:image/png;base64,${b64}` });
    }
    if (url) {
      return res.json({ imageUrl: url });
    }
    throw new Error('OpenAI no devolvio imagen.');
  } catch (error) {
    return res.status(500).json({ message: 'Error al generar imagen', error: error.message });
  } finally {
    if (tmpDir) {
      try {
        await fsp.rm(tmpDir, { recursive: true, force: true });
      } catch (_err) {
        // ignore cleanup errors
      }
    }
  }
});

  // Proveedor Clipdrop para ImagenWeb (quita fondo).
  app.post('/api/ecommerce/imagenweb/clipdrop', requireAuth, express.json({ limit: '35mb' }), async (req, res) => {
  try {
    const { imageDataUrl } = req.body || {};
    if (!imageDataUrl) {
      return res.status(400).json({ message: 'Falta imageDataUrl.' });
    }
    const apiKey = (process.env.CLIPDROP_API_KEY || '').trim();
    if (!apiKey) {
      return res.status(500).json({ message: 'CLIPDROP_API_KEY no configurada en el servidor' });
    }

    const match = String(imageDataUrl).match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) {
      return res.status(400).json({ message: 'Formato de imagen invalido.' });
    }
    const mime = match[1].toLowerCase();
    const base64 = match[2];
    const extMap = {
      'image/png': '.png',
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/webp': '.webp',
    };
    const ext = extMap[mime];
    if (!ext) {
      return res.status(400).json({ message: 'Formato de imagen no soportado.' });
    }

    const buffer = Buffer.from(base64, 'base64');
    const form = new FormData();
    form.append('image_file', new Blob([buffer], { type: mime }), `input${ext}`);

    const response = await withRetry(() =>
      fetch('https://clipdrop-api.co/remove-background/v1', {
        method: 'POST',
        headers: { 'x-api-key': apiKey },
        body: form,
      })
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `Clipdrop error ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const outputBase64 = Buffer.from(arrayBuffer).toString('base64');
    const remainingCredits = response.headers.get('x-remaining-credits');
    const consumedCredits = response.headers.get('x-credits-consumed');
    return res.json({
      imageDataUrl: `data:image/png;base64,${outputBase64}`,
      remainingCredits: remainingCredits ?? '',
      consumedCredits: consumedCredits ?? '',
    });
  } catch (error) {
    return res.status(500).json({ message: 'Error en Clipdrop', error: error.message });
  }
});

  // Proveedor PhotoRoom para ImagenWeb (quita fondo).
  app.post('/api/ecommerce/imagenweb/photoroom', requireAuth, express.json({ limit: '35mb' }), async (req, res) => {
  try {
    const { imageDataUrl } = req.body || {};
    if (!imageDataUrl) {
      return res.status(400).json({ message: 'Falta imageDataUrl.' });
    }
    const apiKey = (process.env.PHOTOROOM_API_KEY || '').trim();
    if (!apiKey) {
      return res.status(500).json({ message: 'PHOTOROOM_API_KEY no configurada en el servidor' });
    }

    const match = String(imageDataUrl).match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) {
      return res.status(400).json({ message: 'Formato de imagen invalido.' });
    }
    const mime = match[1].toLowerCase();
    const base64 = match[2];
    const extMap = {
      'image/png': '.png',
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/webp': '.webp',
    };
    const ext = extMap[mime];
    if (!ext) {
      return res.status(400).json({ message: 'Formato de imagen no soportado.' });
    }

    const buffer = Buffer.from(base64, 'base64');
    const form = new FormData();
    form.append('image_file', new Blob([buffer], { type: mime }), `input${ext}`);

    const response = await withRetry(() =>
      fetch('https://sdk.photoroom.com/v1/segment', {
        method: 'POST',
        headers: {
          Accept: 'image/png, application/json',
          'x-api-key': apiKey,
        },
        body: form,
      })
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `PhotoRoom error ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const outputBase64 = Buffer.from(arrayBuffer).toString('base64');
    return res.json({ imageDataUrl: `data:image/png;base64,${outputBase64}` });
  } catch (error) {
    return res.status(500).json({ message: 'Error en PhotoRoom', error: error.message });
  }
});

  // Panel E-Commerce: crea una corrida nueva desde Tienda Nube.
  app.get('/api/ecommerce/publicaciones/articulos', requirePermission('ecommerce-publicaciones'), async (req, res) => {
    try {
      const termRaw = String(req.query.q || '').trim();
      const loadAll = String(req.query.all || '') === '1';
      const requestedLimit = Number(req.query.limit) || 30;
      const limit = Math.max(10, requestedLimit);
      const params = [];
      const where = [];
      if (termRaw) {
        const term = `%${termRaw}%`;
        where.push('(art.Articulo LIKE ? OR art.Detalle LIKE ? OR art.ProveedorSKU LIKE ? OR art.NbreWeb LIKE ? OR art.DescripcionWeb LIKE ?)');
        params.push(term, term, term, term, term);
      }
      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const [rows] = await pool.query(
        `SELECT
           art.Articulo AS articulo,
           art.Detalle AS detalle,
           art.NbreWeb AS nbreWeb,
           art.DescripcionWeb AS descripcionWeb,
           COALESCE(art.Cantidad, 0) AS stock,
           art.Proveedor AS proveedor,
           art.ProveedorSKU AS proveedorSku,
           art.Web AS web,
           repo.PrecioVenta AS precio
         FROM ${DB_NAME}.articulos AS art
         LEFT JOIN ${DB_NAME}.reportearticulo AS repo ON repo.Articulo = art.Articulo
         ${whereSql}
         ORDER BY art.Articulo
         ${loadAll ? '' : 'LIMIT ?'}`,
        loadAll ? params : [...params, limit]
      );
      res.json({ data: rows || [] });
    } catch (error) {
      res.status(500).json({ message: 'Error al buscar articulos', error: error.message });
    }
  });

  app.get('/api/ecommerce/publicaciones/categorias', requirePermission('ecommerce-publicaciones'), async (_req, res) => {
    try {
      const tnubeConnection = getConfiguredTnubeConnection();
      const categories = await fetchTnubeCategories(tnubeConnection);
      res.json({ data: categories });
    } catch (error) {
      res.status(500).json({ message: 'Error al cargar categorias de Tienda Nube', error: error.message });
    }
  });

  app.get('/api/ecommerce/publicaciones', requirePermission('ecommerce-publicaciones'), async (_req, res) => {
    try {
      const [rows] = await pool.query(
        `SELECT
           pub.*,
           COUNT(varia.id) AS variantes,
           SUM(CASE WHEN varia.estado IN ('creada', 'existente') THEN 1 ELSE 0 END) AS variantes_ok,
           SUM(CASE WHEN varia.estado = 'error' THEN 1 ELSE 0 END) AS variantes_error,
           SUM(CASE WHEN varia.estado IN ('borrador', 'pendiente', 'sincronizando') THEN 1 ELSE 0 END) AS variantes_pendientes
         FROM ${DB_NAME}.tiendanube_publicaciones AS pub
         LEFT JOIN ${DB_NAME}.tiendanube_publicacion_variantes AS varia ON varia.publicacion_id = pub.id
         GROUP BY pub.id
         ORDER BY pub.actualizado_en DESC, pub.id DESC`
      );
      res.json({ data: (rows || []).map(mapPublicacionRow) });
    } catch (error) {
      res.status(500).json({ message: 'Error al cargar publicaciones', error: error.message });
    }
  });

  app.get('/api/ecommerce/publicaciones/:id', requirePermission('ecommerce-publicaciones'), async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ message: 'id invalido' });
      const [[publicacion]] = await pool.query(
        `SELECT * FROM ${DB_NAME}.tiendanube_publicaciones WHERE id = ? LIMIT 1`,
        [id]
      );
      if (!publicacion) return res.status(404).json({ message: 'Publicacion no encontrada' });
      const [variantes] = await pool.query(
        `SELECT * FROM ${DB_NAME}.tiendanube_publicacion_variantes WHERE publicacion_id = ? ORDER BY id`,
        [id]
      );
      res.json({ data: mapPublicacionRow(publicacion), variantes: (variantes || []).map(mapPublicacionVarianteRow) });
    } catch (error) {
      res.status(500).json({ message: 'Error al cargar publicacion', error: error.message });
    }
  });

  app.delete('/api/ecommerce/publicaciones/:id', requirePermission('ecommerce-publicaciones'), async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ message: 'id invalido' });
      const [result] = await pool.query(
        `DELETE FROM ${DB_NAME}.tiendanube_publicaciones WHERE id = ?`,
        [id]
      );
      if (!result.affectedRows) return res.status(404).json({ message: 'Publicacion no encontrada' });
      res.json({ ok: true, deleted: result.affectedRows });
    } catch (error) {
      res.status(500).json({ message: 'Error al quitar publicacion', error: error.message });
    }
  });

  app.post('/api/ecommerce/publicaciones', requirePermission('ecommerce-publicaciones'), async (req, res) => {
    let conn;
    try {
      const body = req.body || {};
      const articuloPrincipal = normalizeSku(body.articuloPrincipal);
      const variantes = Array.isArray(body.variantes) ? body.variantes : [];
      if (!articuloPrincipal) return res.status(400).json({ message: 'articuloPrincipal requerido' });
      if (!variantes.length) return res.status(400).json({ message: 'Agrega al menos una variante' });
      const tnubeConnection = getConfiguredTnubeConnection();
      const nombre = String(body.nombre || '').trim() || articuloPrincipal;
      conn = await pool.getConnection();
      await conn.beginTransaction();
      const [result] = await conn.query(
        `INSERT INTO ${DB_NAME}.tiendanube_publicaciones
           (store_id, tienda, articulo_principal, nombre, descripcion, marca, categorias, tags, estado, creado_por)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'borrador', ?)`,
        [
          tnubeConnection.storeId,
          tnubeConnection.tienda,
          articuloPrincipal,
          nombre,
          String(body.descripcion || '').trim() || null,
          String(body.marca || '').trim() || null,
          String(body.categorias || '').trim() || null,
          String(body.tags || '').trim() || null,
          req.user?.id || null,
        ]
      );
      const publicacionId = result.insertId;
      const savedVariantes = [];
      for (const raw of variantes) {
        const articulo = normalizeSku(raw.articulo);
        if (!articulo) continue;
        const [varResult] = await conn.query(
          `INSERT INTO ${DB_NAME}.tiendanube_publicacion_variantes
             (publicacion_id, articulo, sku, detalle, atributo_1_nombre, atributo_1_valor,
              atributo_2_nombre, atributo_2_valor, atributo_3_nombre, atributo_3_valor,
              precio, precio_promocional, stock, peso, codigo_barras, estado)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'borrador')`,
          [
            publicacionId,
            articulo,
            normalizeSku(raw.sku || articulo),
            String(raw.detalle || '').trim() || null,
            String(raw.atributo1Nombre || '').trim() || null,
            String(raw.atributo1Valor || '').trim() || null,
            String(raw.atributo2Nombre || '').trim() || null,
            String(raw.atributo2Valor || '').trim() || null,
            String(raw.atributo3Nombre || '').trim() || null,
            String(raw.atributo3Valor || '').trim() || null,
            raw.precio === '' || raw.precio == null ? null : Number(raw.precio),
            raw.precioPromocional === '' || raw.precioPromocional == null ? null : Number(raw.precioPromocional),
            raw.stock === '' || raw.stock == null ? null : Number(raw.stock),
            raw.peso === '' || raw.peso == null ? null : Number(raw.peso),
            String(raw.codigoBarras || '').trim() || null,
          ]
        );
        savedVariantes.push({ id: varResult.insertId, articulo, sku: normalizeSku(raw.sku || articulo) });
      }
      await insertPublicacionEvento(
        conn,
        publicacionId,
        null,
        'crear_borrador',
        null,
        'borrador',
        'Publicacion creada localmente',
        null,
        req.user?.id
      );
      await conn.commit();
      res.status(201).json({ ok: true, id: publicacionId, variantes: savedVariantes });
    } catch (error) {
      if (conn) {
        try {
          await conn.rollback();
        } catch (_err) {
          /* ignore */
        }
      }
      const duplicate = error?.code === 'ER_DUP_ENTRY';
      res.status(duplicate ? 409 : 500).json({
        message: duplicate ? 'El articulo ya tiene una publicacion para esta tienda' : 'Error al crear publicacion',
        error: error.message,
      });
    } finally {
      if (conn) conn.release();
    }
  });

  app.put('/api/ecommerce/publicaciones/:id', requirePermission('ecommerce-publicaciones'), async (req, res) => {
    let conn;
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ message: 'id invalido' });
      const body = req.body || {};
      const articuloPrincipal = normalizeSku(body.articuloPrincipal);
      const variantes = Array.isArray(body.variantes) ? body.variantes : [];
      if (!articuloPrincipal) return res.status(400).json({ message: 'articuloPrincipal requerido' });
      if (!variantes.length) return res.status(400).json({ message: 'Agrega al menos una variante' });

      const tnubeConnection = getConfiguredTnubeConnection();
      const nombre = String(body.nombre || '').trim() || articuloPrincipal;
      conn = await pool.getConnection();
      await conn.beginTransaction();

      const [[actual]] = await conn.query(
        `SELECT * FROM ${DB_NAME}.tiendanube_publicaciones WHERE id = ? FOR UPDATE`,
        [id]
      );
      if (!actual) {
        await conn.rollback();
        return res.status(404).json({ message: 'Publicacion no encontrada' });
      }
      const estadoActual = String(actual.estado || '').toLowerCase();
      const hasSyncedProduct = Boolean(actual.product_id);
      const editableLocalStates = ['borrador', 'pendiente', 'error', 'parcial'];
      const replaceMode = !hasSyncedProduct && editableLocalStates.includes(estadoActual);
      const addOnlyMode = hasSyncedProduct || ['creado', 'existente'].includes(estadoActual);
      if (!replaceMode && !addOnlyMode) {
        await conn.rollback();
        return res.status(409).json({
          message: 'Solo se pueden modificar publicaciones en borrador, sincronizadas o con error.',
        });
      }
      if (addOnlyMode && articuloPrincipal !== normalizeSku(actual.articulo_principal)) {
        await conn.rollback();
        return res.status(409).json({ message: 'No se puede cambiar el articulo padre de una publicacion sincronizada.' });
      }
      const descripcion = String(body.descripcion || '').trim();

      await conn.query(
        `UPDATE ${DB_NAME}.articulos
         SET NbreWeb = ?,
             DescripcionWeb = ?
         WHERE Articulo = ?
         LIMIT 1`,
        [nombre || null, descripcion || null, articuloPrincipal]
      );

      let previousVariantsBySku = new Map();
      let previousVariantRows = [];
      if (replaceMode) {
        const [previousVariants] = await conn.query(
          `SELECT *
           FROM ${DB_NAME}.tiendanube_publicacion_variantes
           WHERE publicacion_id = ?`,
          [id]
        );
        previousVariantRows = previousVariants || [];
        previousVariantsBySku = new Map(
          previousVariantRows
            .map((row) => [normalizeSku(row.sku || row.articulo).toUpperCase(), row])
            .filter(([sku]) => sku)
        );
        await conn.query(
          `UPDATE ${DB_NAME}.tiendanube_publicaciones
           SET store_id = ?,
               tienda = ?,
               articulo_principal = ?,
               nombre = ?,
               descripcion = ?,
               marca = ?,
               categorias = ?,
               tags = ?,
               estado = 'borrador',
               error_mensaje = NULL
           WHERE id = ?`,
          [
            tnubeConnection.storeId,
            tnubeConnection.tienda,
            articuloPrincipal,
            nombre,
            descripcion || null,
            String(body.marca || '').trim() || null,
            String(body.categorias || '').trim() || null,
            String(body.tags || '').trim() || null,
            id,
          ]
        );
      } else {
        await conn.query(
          `UPDATE ${DB_NAME}.tiendanube_publicaciones
           SET nombre = ?,
               descripcion = ?,
               marca = ?,
               categorias = ?,
               tags = ?,
               estado = 'pendiente',
               error_mensaje = NULL
           WHERE id = ?`,
          [
            nombre,
            descripcion || null,
            String(body.marca || '').trim() || null,
            String(body.categorias || '').trim() || null,
            String(body.tags || '').trim() || null,
            id,
          ]
        );
      }

      const [existentes] = await conn.query(
        `SELECT * FROM ${DB_NAME}.tiendanube_publicacion_variantes WHERE publicacion_id = ?`,
        [id]
      );
      if (!replaceMode) {
        previousVariantRows = existentes || [];
        previousVariantsBySku = new Map(
          previousVariantRows
            .map((row) => [normalizeSku(row.sku || row.articulo).toUpperCase(), row])
            .filter(([sku]) => sku)
        );
      }
      const existingSkus = new Set(
        (existentes || [])
          .map((row) => normalizeSku(row.sku || row.articulo).toUpperCase())
          .filter(Boolean)
      );
      let addedCount = 0;
      const savedVariantes = [];
      const incomingSkuKeys = new Set();
      for (const raw of variantes) {
        const articulo = normalizeSku(raw.articulo);
        if (!articulo) continue;
        const sku = normalizeSku(raw.sku || articulo);
        const skuKey = sku.toUpperCase();
        incomingSkuKeys.add(skuKey);
        const commonVariantValues = [
          articulo,
          sku,
          String(raw.detalle || '').trim() || null,
          String(raw.atributo1Nombre || '').trim() || null,
          String(raw.atributo1Valor || '').trim() || null,
          String(raw.atributo2Nombre || '').trim() || null,
          String(raw.atributo2Valor || '').trim() || null,
          String(raw.atributo3Nombre || '').trim() || null,
          String(raw.atributo3Valor || '').trim() || null,
          raw.precio === '' || raw.precio == null ? null : Number(raw.precio),
          raw.precioPromocional === '' || raw.precioPromocional == null ? null : Number(raw.precioPromocional),
          raw.stock === '' || raw.stock == null ? null : Number(raw.stock),
          raw.peso === '' || raw.peso == null ? null : Number(raw.peso),
          String(raw.codigoBarras || '').trim() || null,
        ];
        const previousVariant = previousVariantsBySku.get(skuKey);
        if (previousVariant?.id) {
          const previousComparable = [
            normalizeSku(previousVariant.articulo),
            normalizeSku(previousVariant.sku || previousVariant.articulo),
            String(previousVariant.detalle || '').trim() || null,
            String(previousVariant.atributo_1_nombre || '').trim() || null,
            String(previousVariant.atributo_1_valor || '').trim() || null,
            String(previousVariant.atributo_2_nombre || '').trim() || null,
            String(previousVariant.atributo_2_valor || '').trim() || null,
            String(previousVariant.atributo_3_nombre || '').trim() || null,
            String(previousVariant.atributo_3_valor || '').trim() || null,
            previousVariant.precio == null ? null : Number(previousVariant.precio),
            previousVariant.precio_promocional == null ? null : Number(previousVariant.precio_promocional),
            previousVariant.stock == null ? null : Number(previousVariant.stock),
            previousVariant.peso == null ? null : Number(previousVariant.peso),
            String(previousVariant.codigo_barras || '').trim() || null,
          ];
          const variantChanged = commonVariantValues.some((value, index) => value !== previousComparable[index]);
          const previousState = String(previousVariant.estado || '').toLowerCase();
          const shouldResetVariant =
            replaceMode ||
            variantChanged ||
            previousState === 'error' ||
            previousState === 'parcial';
          const nextState = shouldResetVariant ? (replaceMode ? 'borrador' : 'pendiente') : previousVariant.estado || 'borrador';
          const nextVariantId = shouldResetVariant && !replaceMode ? null : previousVariant.variant_id || null;
          await conn.query(
            `UPDATE ${DB_NAME}.tiendanube_publicacion_variantes
             SET articulo = ?,
                 sku = ?,
                 detalle = ?,
                 atributo_1_nombre = ?,
                 atributo_1_valor = ?,
                 atributo_2_nombre = ?,
                 atributo_2_valor = ?,
                 atributo_3_nombre = ?,
                 atributo_3_valor = ?,
                 precio = ?,
                 precio_promocional = ?,
                 stock = ?,
                 peso = ?,
                 codigo_barras = ?,
                 variant_id = ?,
                 estado = ?,
                 error_mensaje = NULL
             WHERE id = ? AND publicacion_id = ?`,
            [...commonVariantValues, nextVariantId, nextState, previousVariant.id, id]
          );
          savedVariantes.push({ id: previousVariant.id, articulo, sku });
          existingSkus.add(skuKey);
          continue;
        }
        const [varResult] = await conn.query(
          `INSERT INTO ${DB_NAME}.tiendanube_publicacion_variantes
             (publicacion_id, articulo, sku, detalle, atributo_1_nombre, atributo_1_valor,
              atributo_2_nombre, atributo_2_valor, atributo_3_nombre, atributo_3_valor,
              precio, precio_promocional, stock, peso, codigo_barras, estado)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'borrador')`,
          [
            id,
            ...commonVariantValues,
          ]
        );
        existingSkus.add(skuKey);
        addedCount += 1;
        savedVariantes.push({ id: varResult.insertId, articulo, sku });
      }

      if (replaceMode) {
        const removedVariantIds = previousVariantRows
          .filter((row) => !incomingSkuKeys.has(normalizeSku(row.sku || row.articulo).toUpperCase()))
          .map((row) => Number(row.id))
          .filter(Number.isFinite);
        if (removedVariantIds.length) {
          const placeholders = removedVariantIds.map(() => '?').join(',');
          const [removedImages] = await conn.query(
            `SELECT * FROM ${DB_NAME}.tiendanube_publicacion_imagenes
             WHERE publicacion_id = ? AND tipo = 'variante' AND variante_id IN (${placeholders})`,
            [id, ...removedVariantIds]
          );
          await conn.query(
            `DELETE FROM ${DB_NAME}.tiendanube_publicacion_imagenes
             WHERE publicacion_id = ? AND tipo = 'variante' AND variante_id IN (${placeholders})`,
            [id, ...removedVariantIds]
          );
          await conn.query(
            `DELETE FROM ${DB_NAME}.tiendanube_publicacion_variantes
             WHERE publicacion_id = ? AND id IN (${placeholders})`,
            [id, ...removedVariantIds]
          );
          for (const imageRow of removedImages || []) {
            await removeManagedTnPublicacionImage(imageRow.archivo_path);
          }
        }
      }

      await insertPublicacionEvento(
        conn,
        id,
        null,
        addOnlyMode ? 'agregar_variantes_borrador' : 'actualizar_borrador',
        actual.estado,
        addOnlyMode ? 'pendiente' : 'borrador',
        addOnlyMode
          ? `Publicacion y articulo web actualizados. Variantes nuevas agregadas localmente: ${addedCount}`
          : 'Publicacion y articulo web actualizados localmente',
        addOnlyMode ? { addedCount } : null,
        req.user?.id
      );
      await conn.commit();
      const [allVariantes] = await pool.query(
        `SELECT id, articulo, sku FROM ${DB_NAME}.tiendanube_publicacion_variantes WHERE publicacion_id = ? ORDER BY id`,
        [id]
      );
      res.json({ ok: true, id, addedCount, variantes: allVariantes || savedVariantes });
    } catch (error) {
      if (conn) {
        try {
          await conn.rollback();
        } catch (_err) {
          /* ignore */
        }
      }
      const duplicate = error?.code === 'ER_DUP_ENTRY';
      res.status(duplicate ? 409 : 500).json({
        message: duplicate ? 'El articulo ya tiene una publicacion para esta tienda' : 'Error al actualizar publicacion',
        error: error.message,
      });
    } finally {
      if (conn) conn.release();
    }
  });

  app.get('/api/ecommerce/publicaciones/:id/imagenes', requirePermission('ecommerce-publicaciones'), async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ message: 'id invalido' });
      const [rows] = await pool.query(
        `SELECT * FROM ${DB_NAME}.tiendanube_publicacion_imagenes
         WHERE publicacion_id = ?
         ORDER BY tipo, posicion, id`,
        [id]
      );
      res.json({ data: (rows || []).map(mapPublicacionImagenRow) });
    } catch (error) {
      res.status(500).json({ message: 'Error al cargar imagenes', error: error.message });
    }
  });

  app.post('/api/ecommerce/publicaciones/:id/imagenes', requirePermission('ecommerce-publicaciones'), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const posicion = Math.max(1, Math.min(8, Number(req.query.posicion) || 1));
      if (!Number.isFinite(id)) return res.status(400).json({ message: 'id invalido' });
      const [[pub]] = await pool.query(`SELECT id FROM ${DB_NAME}.tiendanube_publicaciones WHERE id = ? LIMIT 1`, [id]);
      if (!pub) return res.status(404).json({ message: 'Publicacion no encontrada' });
      const upload = await parseSingleMultipartFile(req, 'foto', TN_PUBLICACIONES_IMG_MAX_BYTES);
      const mime = String(upload.contentType || '').toLowerCase();
      if (!mime.startsWith('image/')) return res.status(400).json({ message: 'El archivo debe ser una imagen.' });
      if (!upload.buffer?.length) return res.status(400).json({ message: 'Archivo vacio.' });
      if (upload.buffer.length > TN_PUBLICACIONES_IMG_MAX_BYTES) {
        return res.status(400).json({
          message: `La imagen supera el tamaño máximo permitido (${Math.round(TN_PUBLICACIONES_IMG_MAX_BYTES / 1024 / 1024)} MB).`,
        });
      }
      const [existing] = await pool.query(
        `SELECT * FROM ${DB_NAME}.tiendanube_publicacion_imagenes
         WHERE publicacion_id = ? AND tipo = 'producto' AND posicion = ?`,
        [id, posicion]
      );
      const safeExt = inferImageExtension(mime, upload.fileName);
      const fileName = `tn-pub-${id}-prod-${posicion}-${Date.now()}${safeExt}`;
      await fsp.writeFile(path.join(TN_PUBLICACIONES_IMG_DIR, fileName), upload.buffer);
      await pool.query(
        `DELETE FROM ${DB_NAME}.tiendanube_publicacion_imagenes
         WHERE publicacion_id = ? AND tipo = 'producto' AND posicion = ?`,
        [id, posicion]
      );
      for (const row of existing || []) await removeManagedTnPublicacionImage(row.archivo_path);
      const [result] = await pool.query(
        `INSERT INTO ${DB_NAME}.tiendanube_publicacion_imagenes
           (publicacion_id, variante_id, tipo, posicion, archivo_path, archivo_nombre, mime_type, tamanio_bytes, estado)
         VALUES (?, NULL, 'producto', ?, ?, ?, ?, ?, 'borrador')`,
        [id, posicion, fileName, upload.fileName || fileName, mime, upload.buffer.length]
      );
      const [[row]] = await pool.query(`SELECT * FROM ${DB_NAME}.tiendanube_publicacion_imagenes WHERE id = ?`, [result.insertId]);
      res.status(201).json({ ok: true, data: mapPublicacionImagenRow(row) });
    } catch (error) {
      const msgByCode = {
        UPLOAD_BOUNDARY_MISSING: 'Upload inválido: falta boundary multipart.',
        UPLOAD_FILE_MISSING: 'No se recibió ninguna imagen.',
        UPLOAD_TOO_LARGE: `La imagen supera el tamaño máximo permitido (${Math.round(TN_PUBLICACIONES_IMG_MAX_BYTES / 1024 / 1024)} MB).`,
      };
      const statusByCode = {
        UPLOAD_BOUNDARY_MISSING: 400,
        UPLOAD_FILE_MISSING: 400,
        UPLOAD_TOO_LARGE: 413,
      };
      res.status(statusByCode[error.code] || 500).json({
        message: msgByCode[error.code] || 'Error al subir imagen',
        error: error.message,
      });
    }
  });

  app.post('/api/ecommerce/publicaciones/:id/variantes/:varianteId/imagen', requirePermission('ecommerce-publicaciones'), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const varianteId = Number(req.params.varianteId);
      if (!Number.isFinite(id) || !Number.isFinite(varianteId)) return res.status(400).json({ message: 'id invalido' });
      const [[variante]] = await pool.query(
        `SELECT id FROM ${DB_NAME}.tiendanube_publicacion_variantes WHERE id = ? AND publicacion_id = ? LIMIT 1`,
        [varianteId, id]
      );
      if (!variante) return res.status(404).json({ message: 'Variante no encontrada' });
      const upload = await parseSingleMultipartFile(req, 'foto', TN_PUBLICACIONES_IMG_MAX_BYTES);
      const mime = String(upload.contentType || '').toLowerCase();
      if (!mime.startsWith('image/')) return res.status(400).json({ message: 'El archivo debe ser una imagen.' });
      if (!upload.buffer?.length) return res.status(400).json({ message: 'Archivo vacio.' });
      if (upload.buffer.length > TN_PUBLICACIONES_IMG_MAX_BYTES) {
        return res.status(400).json({
          message: `La imagen supera el tamaño máximo permitido (${Math.round(TN_PUBLICACIONES_IMG_MAX_BYTES / 1024 / 1024)} MB).`,
        });
      }
      const [existing] = await pool.query(
        `SELECT * FROM ${DB_NAME}.tiendanube_publicacion_imagenes
         WHERE variante_id = ? AND tipo = 'variante'`,
        [varianteId]
      );
      const safeExt = inferImageExtension(mime, upload.fileName);
      const fileName = `tn-pub-${id}-var-${varianteId}-${Date.now()}${safeExt}`;
      await fsp.writeFile(path.join(TN_PUBLICACIONES_IMG_DIR, fileName), upload.buffer);
      await pool.query(
        `DELETE FROM ${DB_NAME}.tiendanube_publicacion_imagenes WHERE variante_id = ? AND tipo = 'variante'`,
        [varianteId]
      );
      for (const row of existing || []) await removeManagedTnPublicacionImage(row.archivo_path);
      const [result] = await pool.query(
        `INSERT INTO ${DB_NAME}.tiendanube_publicacion_imagenes
           (publicacion_id, variante_id, tipo, posicion, archivo_path, archivo_nombre, mime_type, tamanio_bytes, estado)
         VALUES (?, ?, 'variante', ?, ?, ?, ?, ?, 'borrador')`,
        [id, varianteId, varianteId, fileName, upload.fileName || fileName, mime, upload.buffer.length]
      );
      const [[row]] = await pool.query(`SELECT * FROM ${DB_NAME}.tiendanube_publicacion_imagenes WHERE id = ?`, [result.insertId]);
      res.status(201).json({ ok: true, data: mapPublicacionImagenRow(row) });
    } catch (error) {
      const msgByCode = {
        UPLOAD_BOUNDARY_MISSING: 'Upload inválido: falta boundary multipart.',
        UPLOAD_FILE_MISSING: 'No se recibió ninguna imagen.',
        UPLOAD_TOO_LARGE: `La imagen supera el tamaño máximo permitido (${Math.round(TN_PUBLICACIONES_IMG_MAX_BYTES / 1024 / 1024)} MB).`,
      };
      const statusByCode = {
        UPLOAD_BOUNDARY_MISSING: 400,
        UPLOAD_FILE_MISSING: 400,
        UPLOAD_TOO_LARGE: 413,
      };
      res.status(statusByCode[error.code] || 500).json({
        message: msgByCode[error.code] || 'Error al subir imagen de variante',
        error: error.message,
      });
    }
  });

  app.delete('/api/ecommerce/publicaciones/imagenes/:imageId', requirePermission('ecommerce-publicaciones'), async (req, res) => {
    try {
      const imageId = Number(req.params.imageId);
      if (!Number.isFinite(imageId)) return res.status(400).json({ message: 'id invalido' });
      const [[row]] = await pool.query(
        `SELECT * FROM ${DB_NAME}.tiendanube_publicacion_imagenes WHERE id = ? LIMIT 1`,
        [imageId]
      );
      if (!row) return res.status(404).json({ message: 'Imagen no encontrada' });
      await pool.query(`DELETE FROM ${DB_NAME}.tiendanube_publicacion_imagenes WHERE id = ?`, [imageId]);
      await removeManagedTnPublicacionImage(row.archivo_path);
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ message: 'Error al borrar imagen', error: error.message });
    }
  });

  app.post('/api/ecommerce/publicaciones/:id/sync', requirePermission('ecommerce-publicaciones'), async (req, res) => {
    let conn;
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ message: 'id invalido' });
      const tnubeConnection = getConfiguredTnubeConnection();

      conn = await pool.getConnection();
      await conn.beginTransaction();
      const [[publicacion]] = await conn.query(
        `SELECT * FROM ${DB_NAME}.tiendanube_publicaciones WHERE id = ? FOR UPDATE`,
        [id]
      );
      if (!publicacion) {
        await conn.rollback();
        return res.status(404).json({ message: 'Publicacion no encontrada' });
      }
      const [variantes] = await conn.query(
        `SELECT * FROM ${DB_NAME}.tiendanube_publicacion_variantes WHERE publicacion_id = ? ORDER BY id FOR UPDATE`,
        [id]
      );
      if (!variantes.length) {
        await conn.rollback();
        return res.status(400).json({ message: 'La publicacion no tiene variantes' });
      }
      await conn.query(
        `UPDATE ${DB_NAME}.tiendanube_publicaciones SET estado = 'sincronizando', error_mensaje = NULL WHERE id = ?`,
        [id]
      );
      await conn.query(
        `UPDATE ${DB_NAME}.tiendanube_publicacion_variantes
         SET estado = 'sincronizando', error_mensaje = NULL
         WHERE publicacion_id = ? AND estado NOT IN ('creada', 'existente')`,
        [id]
      );
      await conn.commit();
      conn.release();
      conn = null;

      let product = null;
      let productId = publicacion.product_id || null;
      let missingStoredProductId = null;
      if (productId) {
        product = await fetchTnubeProduct(tnubeConnection, productId);
        if (!product) {
          missingStoredProductId = productId;
          productId = null;
          product = await findTnubeProductBySku(tnubeConnection, publicacion.articulo_principal);
          productId = getTnubeProductId(product);
          if (productId) {
            product = await fetchTnubeProduct(tnubeConnection, productId);
          }
        }
      } else {
        product = await findTnubeProductBySku(tnubeConnection, publicacion.articulo_principal);
        productId = getTnubeProductId(product);
        if (productId) {
          product = await fetchTnubeProduct(tnubeConnection, productId);
        }
      }
      const hasUnsyncedVariants = variantes.some((variante) => !variante.variant_id);
      const shouldRecreateProduct = Boolean(productId && hasUnsyncedVariants);

      conn = await pool.getConnection();
      await conn.beginTransaction();
      let productState = 'existente';
      if (!productId) {
        if (missingStoredProductId) {
          await conn.query(
            `UPDATE ${DB_NAME}.tiendanube_publicaciones
             SET product_id = NULL
             WHERE id = ?`,
            [id]
          );
          await conn.query(
            `UPDATE ${DB_NAME}.tiendanube_publicacion_variantes
             SET product_id = NULL, variant_id = NULL, estado = 'sincronizando', error_mensaje = NULL
             WHERE publicacion_id = ?`,
            [id]
          );
        }
        const payload = buildTnubeProductPayload(publicacion, variantes);
        product = await tnubeRequest(
          tnubeConnection.storeId,
          tnubeConnection.accessToken,
          tnubeConnection.appName,
          'POST',
          'products',
          payload
        );
        productId = getTnubeProductId(product);
        if (!productId) throw new Error('Tienda Nube no devolvio product_id');
        if (productId) {
          product = await fetchTnubeProduct(tnubeConnection, productId);
        }
        productState = 'creado';
        await conn.query(
          `UPDATE ${DB_NAME}.tiendanube_publicaciones
           SET product_id = ?, estado = 'creado', payload_json = ?, sincronizado_en = NOW()
           WHERE id = ?`,
          [productId, JSON.stringify(payload), id]
        );
      } else {
        const updatePayload = buildTnubeProductUpdatePayload(publicacion);
        if (shouldRecreateProduct) {
          if (isTnPublicacionesDebugEnabled()) {
            console.warn('[TN_PUBLICACIONES_RECREATE_EXISTING_PRODUCT]', {
              publicacionId: id,
              oldProductId: productId,
              message: 'Producto existente con variantes pendientes: se creara uno nuevo completo con las variantes locales.',
            });
          }
        } else {
          product = await tnubeRequest(
            tnubeConnection.storeId,
            tnubeConnection.accessToken,
            tnubeConnection.appName,
            'PUT',
            `products/${encodeURIComponent(productId)}`,
            updatePayload
          );
          product = product || (await fetchTnubeProduct(tnubeConnection, productId));
          await conn.query(
            `UPDATE ${DB_NAME}.tiendanube_publicaciones
             SET product_id = ?, estado = 'existente', payload_json = ?, sincronizado_en = NOW()
             WHERE id = ?`,
            [productId, JSON.stringify(updatePayload), id]
          );
        }
      }

      let remoteVariants = getTnubeVariantRows(product);
      if (productId) {
        try {
          const explicitVariants = await fetchTnubeProductVariants(tnubeConnection, productId);
          if (explicitVariants.length) remoteVariants = explicitVariants;
        } catch (error) {
          if (isTnPublicacionesDebugEnabled()) {
            console.error('[TN_PUBLICACIONES_FETCH_VARIANTS_ERROR]', {
              publicacionId: id,
              productId,
              message: error.message,
            });
          }
        }
      }
      const createdProductVariants = new Map(
        remoteVariants.map((variant) => [normalizeSku(variant?.sku).toUpperCase(), variant]).filter(([sku]) => sku)
      );
      const [imageRows] = await conn.query(
        `SELECT * FROM ${DB_NAME}.tiendanube_publicacion_imagenes
         WHERE publicacion_id = ? AND estado <> 'subida'
         ORDER BY tipo, posicion, id`,
        [id]
      );
      const productImages = (imageRows || []).filter((row) => row.tipo === 'producto' && row.archivo_path);
      const variantImages = new Map(
        (imageRows || [])
          .filter((row) => row.tipo === 'variante' && row.variante_id && row.archivo_path)
          .map((row) => [Number(row.variante_id), row])
      );
      let okCount = 0;
      let errorCount = 0;
      const variantErrors = [];
      let recreateFullProduct = shouldRecreateProduct;
      let recreateReason = shouldRecreateProduct
        ? 'Producto existente con variantes pendientes: recreacion completa solicitada'
        : '';

      if (!recreateFullProduct) {
        for (const variante of variantes) {
          const sku = normalizeSku(variante.sku || variante.articulo);
          const remote = createdProductVariants.get(sku.toUpperCase());
          try {
          let syncedVariantId = remote?.id || null;
          const storedVariantId = variante.variant_id || null;
          if (!remote?.id && storedVariantId) {
            const variantImage = variantImages.get(Number(variante.id));
            if (variantImage) {
              await uploadPublicacionImageToTnube(conn, tnubeConnection, productId, variantImage, storedVariantId);
            }
            await conn.query(
              `UPDATE ${DB_NAME}.tiendanube_publicacion_variantes
               SET product_id = ?, estado = 'existente', sincronizado_en = NOW(), error_mensaje = NULL
               WHERE id = ?`,
              [productId, variante.id]
            );
            await insertPublicacionEvento(
              conn,
              id,
              variante.id,
              'variante_existente',
              variante.estado,
              'existente',
              `Variante ya sincronizada en Tienda Nube: ${sku}`,
              { productId, variantId: storedVariantId },
              req.user?.id
            );
            okCount += 1;
            continue;
          }
          if (remote?.id) {
            await conn.query(
              `UPDATE ${DB_NAME}.tiendanube_publicacion_variantes
               SET product_id = ?, variant_id = ?, estado = ?, sincronizado_en = NOW(), error_mensaje = NULL
               WHERE id = ?`,
              [productId, remote.id, productState === 'creado' ? 'creada' : 'existente', variante.id]
            );
            await insertPublicacionEvento(
              conn,
              id,
              variante.id,
              productState === 'creado' ? 'variante_creada' : 'variante_existente',
              variante.estado,
              productState === 'creado' ? 'creada' : 'existente',
              `${productState === 'creado' ? 'Variante creada' : 'Variante existente'} en Tienda Nube: ${sku}`,
              { productId, variantId: remote.id },
              req.user?.id
            );
            const variantImage = variantImages.get(Number(variante.id));
            if (variantImage) await uploadPublicacionImageToTnube(conn, tnubeConnection, productId, variantImage, remote.id);
            okCount += 1;
            continue;
          }

          const payload = buildTnubeVariantPayload(variante);
          const created = await tnubeRequest(
            tnubeConnection.storeId,
            tnubeConnection.accessToken,
            tnubeConnection.appName,
            'POST',
            `products/${encodeURIComponent(productId)}/variants`,
            payload
          );
          syncedVariantId = created?.id || null;
          await conn.query(
            `UPDATE ${DB_NAME}.tiendanube_publicacion_variantes
             SET product_id = ?, variant_id = ?, estado = 'creada', payload_json = ?, sincronizado_en = NOW(), error_mensaje = NULL
             WHERE id = ?`,
            [productId, created?.id || null, JSON.stringify(payload), variante.id]
          );
          await insertPublicacionEvento(
            conn,
            id,
            variante.id,
            'variante_creada',
            variante.estado,
            'creada',
            `Variante creada en Tienda Nube: ${sku}`,
            { productId, variantId: created?.id || null },
            req.user?.id
          );
          const variantImage = variantImages.get(Number(variante.id));
          if (variantImage && syncedVariantId) {
            await uploadPublicacionImageToTnube(conn, tnubeConnection, productId, variantImage, syncedVariantId);
          }
          okCount += 1;
          } catch (error) {
          if (isTnubeWrongVariantValuesCountError(error) && publicacion.product_id) {
            recreateFullProduct = true;
            recreateReason = error.message || 'Estructura de variantes incompatible';
            if (isTnPublicacionesDebugEnabled()) {
              console.warn('[TN_PUBLICACIONES_RECREATE_PRODUCT_REQUIRED]', {
                publicacionId: id,
                oldProductId: productId,
                sku,
                message: recreateReason,
              });
            }
            break;
          }
          errorCount += 1;
          const errorMessage = formatTnubeSyncError(error, 'Error al sincronizar variante');
          const variantError = {
            id: variante.id,
            articulo: variante.articulo || '',
            sku,
            estadoAnterior: variante.estado || '',
            variantId: variante.variant_id || null,
            message: errorMessage,
            stack: error.stack || '',
          };
          variantErrors.push(variantError);
          if (isTnPublicacionesDebugEnabled()) {
            console.error('[TN_PUBLICACIONES_SYNC_VARIANTE_ERROR]', {
              publicacionId: id,
              productId,
              ...variantError,
            });
          }
          await conn.query(
            `UPDATE ${DB_NAME}.tiendanube_publicacion_variantes
             SET estado = 'error', error_mensaje = ?
             WHERE id = ?`,
            [errorMessage, variante.id]
          );
          await insertPublicacionEvento(
            conn,
            id,
            variante.id,
            'error_variante',
            variante.estado,
            'error',
            errorMessage,
            { productId, sku },
            req.user?.id
          );
          }
        }
      }

      if (recreateFullProduct) {
        const oldProductId = productId;
        const recreatePayload = buildTnubeProductPayload(publicacion, variantes);
        if (isTnPublicacionesDebugEnabled()) {
          console.warn('[TN_PUBLICACIONES_RECREATE_PRODUCT_START]', {
            publicacionId: id,
            oldProductId,
            reason: recreateReason,
            variantCount: variantes.length,
          });
        }
        product = await tnubeRequest(
          tnubeConnection.storeId,
          tnubeConnection.accessToken,
          tnubeConnection.appName,
          'POST',
          'products',
          recreatePayload
        );
        productId = getTnubeProductId(product);
        if (!productId) throw new Error('Tienda Nube no devolvio product_id al recrear producto');
        product = await fetchTnubeProduct(tnubeConnection, productId);
        let recreatedVariants = getTnubeVariantRows(product);
        try {
          const explicitVariants = await fetchTnubeProductVariants(tnubeConnection, productId);
          if (explicitVariants.length) recreatedVariants = explicitVariants;
        } catch (error) {
          if (isTnPublicacionesDebugEnabled()) {
            console.error('[TN_PUBLICACIONES_FETCH_RECREATED_VARIANTS_ERROR]', {
              publicacionId: id,
              productId,
              message: error.message,
            });
          }
        }
        const recreatedVariantsBySku = new Map(
          recreatedVariants.map((variant) => [normalizeSku(variant?.sku).toUpperCase(), variant]).filter(([sku]) => sku)
        );
        okCount = 0;
        errorCount = 0;
        variantErrors.length = 0;
        await conn.query(
          `UPDATE ${DB_NAME}.tiendanube_publicaciones
           SET product_id = ?, estado = 'creado', payload_json = ?, sincronizado_en = NOW(), error_mensaje = NULL
           WHERE id = ?`,
          [productId, JSON.stringify(recreatePayload), id]
        );
        for (const variante of variantes) {
          const sku = normalizeSku(variante.sku || variante.articulo);
          const remote = recreatedVariantsBySku.get(sku.toUpperCase());
          if (!remote?.id) {
            errorCount += 1;
            const variantError = {
              id: variante.id,
              articulo: variante.articulo || '',
              sku,
              estadoAnterior: variante.estado || '',
              variantId: null,
              message: 'Producto recreado, pero Tienda Nube no devolvio la variante creada',
              stack: '',
            };
            variantErrors.push(variantError);
            await conn.query(
              `UPDATE ${DB_NAME}.tiendanube_publicacion_variantes
               SET estado = 'error', error_mensaje = ?
               WHERE id = ?`,
              [variantError.message, variante.id]
            );
            continue;
          }
          await conn.query(
            `UPDATE ${DB_NAME}.tiendanube_publicacion_variantes
             SET product_id = ?, variant_id = ?, estado = 'creada', sincronizado_en = NOW(), error_mensaje = NULL
             WHERE id = ?`,
            [productId, remote.id, variante.id]
          );
          const variantImage = variantImages.get(Number(variante.id));
          if (variantImage) {
            try {
              await uploadPublicacionImageToTnube(conn, tnubeConnection, productId, variantImage, remote.id);
            } catch (error) {
              errorCount += 1;
              const errorMessage = formatTnubeSyncError(error, 'Error al subir imagen de variante');
              const variantError = {
                id: variante.id,
                articulo: variante.articulo || '',
                sku,
                estadoAnterior: variante.estado || '',
                variantId: remote.id,
                message: errorMessage,
                stack: error.stack || '',
              };
              variantErrors.push(variantError);
              await conn.query(
                `UPDATE ${DB_NAME}.tiendanube_publicacion_variantes
                 SET estado = 'error', error_mensaje = ?
                 WHERE id = ?`,
                [errorMessage, variante.id]
              );
              await conn.query(
                `UPDATE ${DB_NAME}.tiendanube_publicacion_imagenes
                 SET estado = 'error', error_mensaje = ?
                 WHERE id = ?`,
                [errorMessage, variantImage.id]
              );
              continue;
            }
          }
          okCount += 1;
        }
        await insertPublicacionEvento(
          conn,
          id,
          null,
          'recrear_producto',
          publicacion.estado,
          errorCount ? 'parcial' : 'creado',
          `Producto nuevo creado con todas las variantes locales. Producto anterior: ${oldProductId}. Producto nuevo: ${productId}.`,
          { oldProductId, productId, reason: recreateReason, okCount, errorCount, variantErrors },
          req.user?.id
        );
        productState = 'creado';
      }

      for (const imageRow of productImages) {
        try {
          await uploadPublicacionImageToTnube(conn, tnubeConnection, productId, imageRow);
        } catch (error) {
          const errorMessage = formatTnubeSyncError(error, 'Error al subir imagen de producto');
          await conn.query(
            `UPDATE ${DB_NAME}.tiendanube_publicacion_imagenes SET estado = 'error', error_mensaje = ? WHERE id = ?`,
            [errorMessage, imageRow.id]
          );
        }
      }

      const finalState = errorCount ? (okCount ? 'parcial' : 'error') : productState;
      await conn.query(
        `UPDATE ${DB_NAME}.tiendanube_publicaciones
         SET estado = ?, error_mensaje = ?, sincronizado_en = NOW()
         WHERE id = ?`,
        [finalState, errorCount ? `Variantes con error: ${errorCount}` : null, id]
      );
      await insertPublicacionEvento(
        conn,
        id,
        null,
        'sincronizacion',
        publicacion.estado,
        finalState,
        `Sincronizacion finalizada. OK: ${okCount}. Error: ${errorCount}.`,
        { productId, okCount, errorCount, variantErrors },
        req.user?.id
      );
      await conn.commit();
      res.json({ ok: true, productId, estado: finalState, okCount, errorCount, variantErrors });
    } catch (error) {
      const errorMessage = formatTnubeSyncError(error, 'Error en sincronizacion');
      if (isTnPublicacionesDebugEnabled()) {
        console.error('[TN_PUBLICACIONES_SYNC_FATAL_ERROR]', {
          publicacionId: req.params.id,
          message: errorMessage,
          status: error.status || null,
          url: error.url || '',
          body: error.body || '',
          stack: error.stack || '',
        });
      }
      if (conn) {
        try {
          await conn.rollback();
        } catch (_err) {
          /* ignore */
        }
      }
      try {
        const id = Number(req.params.id);
        if (Number.isFinite(id)) {
          await pool.query(
            `UPDATE ${DB_NAME}.tiendanube_publicaciones SET estado = 'error', error_mensaje = ? WHERE id = ?`,
            [errorMessage, id]
          );
          await pool.query(
            `UPDATE ${DB_NAME}.tiendanube_publicacion_variantes
             SET estado = 'error', error_mensaje = ?
             WHERE publicacion_id = ?`,
            [errorMessage, id]
          );
        }
      } catch (_updateErr) {
        /* ignore */
      }
      res.status(500).json({
        message: 'Error al sincronizar publicacion',
        error: errorMessage,
        status: error.status || null,
        url: error.url || null,
        body: error.body || null,
      });
    } finally {
      if (conn) conn.release();
    }
  });

  app.get('/api/ecommerce/ordenes-tn/preview', requirePermission('ecommerce-ordenes-tn'), async (req, res) => {
  try {
    const fechaMin = validateReplicaTnDate(req.query.fecha_min, 'fecha_min');
    const fechaMax = validateReplicaTnDate(req.query.fecha_max, 'fecha_max');
    if (fechaMin > fechaMax) {
      return res.status(400).json({ message: 'fecha_min no puede ser mayor a fecha_max' });
    }
    const tnubeConnection = getTnubeConnection(req.query.store_id);
    const orders = await fetchReplicaTnOrders(tnubeConnection, fechaMin, fechaMax);
    const orderNumbers = orders.map((order) => Number(order?.number || order?.id) || 0).filter(Boolean);
    const existingOrderNumbers = new Set();
    if (orderNumbers.length) {
      const placeholders = orderNumbers.map(() => '?').join(',');
      const [existingRows] = await pool.query(
        `SELECT ordenWeb
         FROM ${DB_NAME}.controlpedidos
         WHERE local = ?
           AND ordenWeb IN (${placeholders})`,
        [tnubeConnection.tienda, ...orderNumbers]
      );
      (existingRows || []).forEach((row) => existingOrderNumbers.add(String(Number(row.ordenWeb) || 0)));
    }
    const data = orders.map((order) => normalizeReplicaTnOrder(order, tnubeConnection.tienda, existingOrderNumbers));
    const resumen = data.reduce(
      (acc, row) => {
        acc.total += 1;
        if (row.duplicated) acc.duplicadas += 1;
        else acc.pendientes += 1;
        if (row.warnings?.length) acc.conAdvertencias += 1;
        return acc;
      },
      { total: 0, pendientes: 0, duplicadas: 0, conAdvertencias: 0 }
    );
    return res.json({
      data,
      resumen,
      meta: {
        tienda: tnubeConnection.tienda,
        storeId: tnubeConnection.storeId,
        fechaMin,
        fechaMax,
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Error al verificar ordenes TiendaNube',
      error: error.message,
      status: error.status || null,
      url: error.url || null,
      cause: error.cause?.code || error.cause?.message || null,
    });
  }
});

  app.post(
  '/api/ecommerce/ordenes-tn/replicar',
  requirePermission('ecommerce-ordenes-tn'),
  express.json({ limit: '5mb' }),
  async (req, res) => {
    const orders = Array.isArray(req.body?.ordenes) ? req.body.ordenes : [];
    if (!orders.length) {
      return res.status(400).json({ message: 'No hay ordenes para replicar' });
    }
    let tnubeConnection;
    try {
      tnubeConnection = getTnubeConnection(req.body?.store_id);
    } catch (error) {
      return res.status(500).json({ message: 'Conexion TiendaNube no configurada', error: error.message });
    }
    const results = [];
    for (const order of orders) {
      let conn;
      try {
        conn = await pool.getConnection();
        await conn.beginTransaction();
        const result = await createReplicaTnPedido(conn, order, tnubeConnection);
        await conn.commit();
        results.push(result);
      } catch (error) {
        if (conn) {
          try {
            await conn.rollback();
          } catch (_err) {
            /* ignore */
          }
        }
        results.push({
          status: 'error',
          ordenWeb: Number(order?.ordenWeb) || 0,
          message: error.message || 'No se pudo crear el pedido',
        });
      } finally {
        if (conn) conn.release();
      }
    }
    const resumen = results.reduce(
      (acc, row) => {
        if (row.status === 'created') acc.creadas += 1;
        else if (row.status === 'duplicated') acc.duplicadas += 1;
        else acc.errores += 1;
        return acc;
      },
      { creadas: 0, duplicadas: 0, errores: 0 }
    );
    return res.json({ ok: resumen.errores === 0, data: results, resumen });
  }
);

  app.get('/api/ecommerce/ordenes-tn/asignacion', requirePermission('ecommerce-asignacion-pedidos'), async (req, res) => {
  try {
    const mostrarTodos =
      req.query.mostrar_todos === '1' ||
      req.query.mostrar_todos === 1 ||
      req.query.mostrar_todos === true ||
      req.query.mostrar_todos === 'true';
    const local = normalizeLocalName(req.query.local);
    const filters = [
      'ctrl.estado = 1',
      'COALESCE(ctrl.ordenWeb, 0) > 0',
    ];
    const params = [];
    if (!mostrarTodos) {
      filters.push("(ctrl.vendedora IS NULL OR TRIM(ctrl.vendedora) = '' OR UPPER(TRIM(ctrl.vendedora)) = 'PAGINA')");
    }
    if (local) {
      filters.push("LOWER(REPLACE(TRIM(COALESCE(ctrl.local, '')), ' ', '')) = ?");
      params.push(local);
    }
    const [rows] = await pool.query(
      `SELECT
         ctrl.id,
         ctrl.nropedido,
         ctrl.ordenWeb,
         ctrl.fecha,
         ctrl.vendedora,
         ctrl.totalweb,
         ctrl.local,
         c.nombre,
         c.apellido,
         c.mail,
         COALESCE(comentarios.total, 0) AS notas_count
       FROM ${DB_NAME}.controlpedidos ctrl
       INNER JOIN ${DB_NAME}.clientes c ON c.id_clientes = ctrl.id_cliente
       LEFT JOIN (
         SELECT controlpedidos_id, COUNT(*) AS total
         FROM ${DB_NAME}.comentariospedidos
         GROUP BY controlpedidos_id
       ) AS comentarios ON comentarios.controlpedidos_id = ctrl.id
       WHERE ${filters.join('\n         AND ')}
       ORDER BY ctrl.nropedido DESC`,
      params
    );
    const data = (rows || []).map((row) => ({
      id: Number(row.id) || 0,
      nropedido: Number(row.nropedido) || 0,
      ordenWeb: Number(row.ordenWeb) || 0,
      cliente: `${row.nombre || ''} ${row.apellido || ''}`.trim(),
      mail: row.mail || '',
      vendedora: row.vendedora || '',
      totalweb: Number(row.totalweb) || 0,
      local: row.local || '',
      fecha: row.fecha || null,
      notas_count: Number(row.notas_count) || 0,
      sinAsignar: !String(row.vendedora || '').trim() || String(row.vendedora || '').trim().toUpperCase() === 'PAGINA',
    }));
    const resumen = data.reduce(
      (acc, row) => {
        acc.total += 1;
        if (row.sinAsignar) acc.sinAsignar += 1;
        else acc.asignados += 1;
        return acc;
      },
      { total: 0, sinAsignar: 0, asignados: 0 }
    );
    return res.json({ data, resumen });
  } catch (error) {
    return res.status(500).json({ message: 'Error al cargar asignacion de pedidos', error: error.message });
  }
});

  app.patch(
  '/api/ecommerce/ordenes-tn/asignacion',
  requirePermission('ecommerce-asignacion-pedidos'),
  express.json({ limit: '1mb' }),
  async (req, res) => {
    const pedidoIds = Array.from(
      new Set((Array.isArray(req.body?.pedido_ids) ? req.body.pedido_ids : []).map((id) => Number(id)).filter(Boolean))
    ).slice(0, 200);
    const vendedora = String(req.body?.vendedora || '').trim();
    if (!pedidoIds.length) {
      return res.status(400).json({ message: 'Selecciona al menos un pedido' });
    }
    if (!vendedora) {
      return res.status(400).json({ message: 'Selecciona una vendedora' });
    }
    let conn;
    try {
      conn = await pool.getConnection();
      await conn.beginTransaction();
      const [[seller]] = await conn.query(
        `SELECT Id, Nombre
         FROM ${DB_NAME}.vendedores
         WHERE Nombre = ? AND Tipo <> 0
         LIMIT 1`,
        [vendedora]
      );
      if (!seller) {
        await conn.rollback();
        return res.status(400).json({ message: 'Vendedora invalida' });
      }
      const placeholders = pedidoIds.map(() => '?').join(',');
      const [pedidos] = await conn.query(
        `SELECT id, nropedido, vendedora
         FROM ${DB_NAME}.controlpedidos
         WHERE id IN (${placeholders})
           AND estado = 1
           AND COALESCE(ordenWeb, 0) > 0
         FOR UPDATE`,
        pedidoIds
      );
      const toUpdate = (pedidos || []).filter((row) => String(row.vendedora || '').trim() !== seller.Nombre);
      if (toUpdate.length) {
        await conn.query(
          `UPDATE ${DB_NAME}.controlpedidos
           SET vendedora = ?
           WHERE id IN (${toUpdate.map(() => '?').join(',')})
             AND estado = 1
             AND COALESCE(ordenWeb, 0) > 0`,
          [seller.Nombre, ...toUpdate.map((row) => row.id)]
        );
        const [users] = await conn.query(
          `SELECT id
           FROM ${DB_NAME}.users
           WHERE id_vendedoras = ?`,
          [seller.Id]
        );
        if (users?.length) {
          const fecha = formatDateTimeLocal(new Date());
          const values = [];
          toUpdate.forEach((pedido) => {
            users.forEach((user) => {
              values.push([user.id, `Se le asigno el Pedido Nro: ${pedido.nropedido}`, fecha, 0]);
            });
          });
          if (values.length) {
            await conn.query(
              `INSERT INTO ${DB_NAME}.notificaciones (id_users, tipo, fecha, lectura)
               VALUES ?`,
              [values]
            );
          }
        }
      }
      await conn.commit();
      return res.json({
        ok: true,
        actualizados: toUpdate.length,
        omitidos: pedidoIds.length - toUpdate.length,
        vendedora: seller.Nombre,
      });
    } catch (error) {
      if (conn) {
        try {
          await conn.rollback();
        } catch (_err) {
          /* ignore */
        }
      }
      return res.status(500).json({ message: 'Error al asignar pedidos', error: error.message });
    } finally {
      if (conn) conn.release();
    }
  }
);

  app.post('/api/ecommerce/panel/import', requireAuth, async (req, res) => {
  try {
    const tipoBajada = String(req.body?.tipo_bajada || '').trim().toLowerCase();
    if (!['todo', 'visible'].includes(tipoBajada)) {
      return res.status(400).json({ message: 'tipo_bajada debe ser todo o visible' });
    }

    getConfiguredTnubeConnection();
    const job = createEcommerceImportJob(tipoBajada, req.user?.id || null);
    runEcommerceImportJob(job);
    return res.json({
      ok: true,
      job: serializeEcommerceImportJob(job),
      jobToken: signEcommerceJobToken(job.id, { type: 'import' }),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Error al crear bajada TiendaNube', error: error.message });
  }
});

  app.get('/api/ecommerce/panel/import/:jobId', async (req, res) => {
  const job = ecommerceImportJobs.get(String(req.params.jobId || '')) || readPersistedEcommerceJob(req.params.jobId);
  if (!job) {
    return res.status(404).json({ message: 'Bajada no encontrada' });
  }
  return res.json({ job: serializeEcommerceImportJob(job) });
});

  // Panel E-Commerce: elimina corridas y sus items asociados.
  app.delete('/api/ecommerce/panel', requireAuth, async (req, res) => {
  let conn;
  try {
    const ids = Array.isArray(req.body?.corridas)
      ? req.body.corridas.map((id) => Number.parseInt(id, 10)).filter((id) => Number.isInteger(id) && id > 0)
      : [];
    const uniqueIds = Array.from(new Set(ids));
    if (!uniqueIds.length) {
      return res.status(400).json({ message: 'Selecciona al menos una corrida' });
    }

    conn = await pool.getConnection();
    await conn.beginTransaction();
    const placeholders = uniqueIds.map(() => '?').join(',');
    const [childResult] = await conn.query(
      `DELETE FROM ${DB_NAME}.statusecomercesincro WHERE id_provecomerce IN (${placeholders})`,
      uniqueIds
    );
    const [parentResult] = await conn.query(
      `DELETE FROM ${DB_NAME}.provecomerce WHERE id IN (${placeholders})`,
      uniqueIds
    );
    await conn.commit();
    return res.json({
      ok: true,
      corridas: parentResult.affectedRows || 0,
      items: childResult.affectedRows || 0,
    });
  } catch (error) {
    if (conn) {
      try {
        await conn.rollback();
      } catch (_err) {
        /* ignore */
      }
    }
    return res.status(500).json({ message: 'Error al eliminar corridas e-commerce', error: error.message });
  } finally {
    if (conn) conn.release();
  }
});

  // Panel E-Commerce: resumen (una fila por corrida).
  app.get('/api/ecommerce/panel', requireAuth, async (req, res) => {
  try {
    const sql = `
      SELECT
        ecomerce.id AS corrida,
        ecomerce.proveedor,
        usuario.name AS nombre,
        ecomerce.id_cliente,
        ecomerce.tienda,
        DATE_FORMAT(ecomerce.fecha, '%Y-%m-%d %H:%i:%s') AS fecha,
        COALESCE(resumen.total, 0) AS total,
        COALESCE(resumen.ok, 0) AS ok,
        COALESCE(resumen.errores, 0) AS errores,
        COALESCE(resumen.excluidos, 0) AS excluidos,
        COALESCE(resumen.pendientes, 0) AS pendientes
      FROM ${DB_NAME}.provecomerce AS ecomerce
      INNER JOIN ${DB_NAME}.users AS usuario ON usuario.id = ecomerce.id_users
      LEFT JOIN (
        SELECT
          id_provecomerce,
          COUNT(*) AS total,
          SUM(status = 'OK') AS ok,
          SUM(status = 'Pending') AS pendientes,
          SUM(status = 'Excluido') AS excluidos,
          SUM(status <> 'OK' AND status <> 'Pending' AND status <> 'Excluido') AS errores
        FROM ${DB_NAME}.statusecomercesincro
        GROUP BY id_provecomerce
      ) AS resumen ON resumen.id_provecomerce = ecomerce.id
      ORDER BY ecomerce.id DESC
    `;
    const [rows] = await pool.query(sql);
    return res.json({
      data: rows.map((row) => ({
        corrida: row.corrida,
        proveedor: row.proveedor || '',
        nombre: row.nombre || '',
        idCliente: row.id_cliente,
        tienda: row.tienda || '',
        fecha: row.fecha || '',
        total: Number(row.total) || 0,
        ok: Number(row.ok) || 0,
        errores: Number(row.errores) || 0,
        pendientes: Number(row.pendientes) || 0,
        exclusiones: Number(row.excluidos) || 0,
      })),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Error al cargar panel e-comerce', error: error.message });
  }
});

  // Panel E-Commerce: detalle (items por corrida).
  app.get('/api/ecommerce/panel/detail', requireAuth, async (req, res) => {
  try {
    const idCorrida = req.query.id_corrida;
    if (!idCorrida) {
      return res.status(400).json({ message: 'id_corrida requerido' });
    }
    const sql = `
      SELECT
        statusecomerce.id AS e_id,
        provecomerce.id AS corrida,
        provecomerce.proveedor,
        usuario.name AS nombre,
        statusecomerce.articulo,
        statusecomerce.status,
        DATE_FORMAT(statusecomerce.fecha, '%Y-%m-%d %H:%i:%s') AS fecha,
        statusecomerce.product_id,
        statusecomerce.articulo_id,
        statusecomerce.visible,
        provecomerce.tienda,
        provecomerce.id_cliente
      FROM ${DB_NAME}.statusecomercesincro AS statusecomerce
      INNER JOIN ${DB_NAME}.provecomerce AS provecomerce ON provecomerce.id = statusecomerce.id_provecomerce
      INNER JOIN ${DB_NAME}.users AS usuario ON usuario.id = provecomerce.id_users
      WHERE statusecomerce.id_provecomerce = ?
      ORDER BY statusecomerce.fecha DESC
    `;
    const [rows] = await pool.query(sql, [idCorrida]);
    const header = rows[0] || {};
    return res.json({
      meta: {
        corrida: header.corrida || idCorrida,
        proveedor: header.proveedor || '',
        nombre: header.nombre || '',
        tienda: header.tienda || '',
        idCliente: header.id_cliente || '',
      },
      data: rows.map((row) => ({
        productId: row.product_id || '',
        articuloId: row.articulo_id || '',
        articulo: row.articulo || '',
        status: row.status || '',
        fecha: row.fecha || '',
        visible: row.visible ?? '',
      })),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Error al cargar detalle e-comerce', error: error.message });
  }
});

  // Sincro Tienda Nube: inicia job con progreso.
  app.post('/api/tiendanubesincroArticulos/job', requireAuth, async (req, res) => {
  try {
    const idCorrida = String(req.body?.id_corrida || '').trim();
    const storeId = String(req.body?.store_id || '').trim();
    const conOrden = req.body?.conOrden === '1' || req.body?.conOrden === 1 || req.body?.conOrden === true;
    const ordenCant = Math.max(1, Number(req.body?.ordenCant) || 5);
    const artiCant = Math.max(1, Number(req.body?.artiCant) || 10);
    if (!idCorrida || !storeId) {
      return res.status(400).json({ message: 'id_corrida y store_id requeridos' });
    }
    getTnubeConnection(storeId);
    const job = createEcommerceSyncJob({ idCorrida, storeId, conOrden, ordenCant, artiCant }, req.user?.id || null);
    runEcommerceSyncJob(job);
    return res.json({
      ok: true,
      job: serializeEcommerceSyncJob(job),
      jobToken: signEcommerceJobToken(job.id, { type: 'sync', idCorrida }),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Error al iniciar sincro TiendaNube', error: error.message });
  }
});

  app.get('/api/tiendanubesincroArticulos/job/:jobId', async (req, res) => {
  const job = ecommerceSyncJobs.get(String(req.params.jobId || '')) || readPersistedEcommerceJob(req.params.jobId);
  if (!job) {
    return res.status(404).json({ message: 'Sincronizacion no encontrada' });
  }
  return res.json({ job: serializeEcommerceSyncJob(job) });
});

  // Endpoint compatible: actualiza publicado y precio/stock de variantes.
  app.get('/api/tiendanubesincroArticulos', requireAuth, async (req, res) => {
  let conn;
  try {
    const idCorrida = String(req.query.id_corrida || '').trim();
    const storeId = String(req.query.store_id || '').trim();
    const conOrden = req.query.conOrden === '1' || req.query.conOrden === 1 || req.query.conOrden === true;
    const ordenCant = Math.max(1, Number(req.query.ordenCant) || 5);
    const artiCant = Math.max(1, Number(req.query.artiCant) || 10);
    const dryRun = req.query.dryRun === '1' || req.query.dryRun === 1 || req.query.dryRun === true;
    if (!idCorrida || !storeId) {
      return res.status(400).json({ message: 'id_corrida y store_id requeridos' });
    }

    const tnubeConnection = getTnubeConnection(storeId);
    conn = await pool.getConnection();
    const rows = await getEcommerceSyncRows(conn, idCorrida, conOrden, ordenCant);
    if (dryRun) {
      return res.json([{ OK: 0, Error: 0, 'No Requiere': 0, dryRun: true, total: rows.length }]);
    }
    const result = await processEcommerceSyncRows(conn, rows, tnubeConnection, { conOrden, artiCant });
    return res.json([result]);
  } catch (error) {
    return res.status(500).json({ message: 'Error en sincro TiendaNube', error: error.message });
  } finally {
    if (conn) conn.release();
  }
});

app.get('/login', (req, res) => {
  const token = parseCookies(req).auth_token;
  const payload = token && verifyToken(token);
  if (payload) {
    return res.redirect('/');
  }
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/fichaje', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'fichaje.html'));
});

app.get('/', (req, res) => {
  const token = parseCookies(req).auth_token;
  const payload = token && verifyToken(token);
  if (!payload) {
    return res.redirect('/login');
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('*', (req, res) => {
  const token = parseCookies(req).auth_token;
  const payload = token && verifyToken(token);
  if (!payload) {
    return res.redirect('/login');
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

let ecommerceImportScheduleRunning = false;
let ecommerceImportScheduleLastCheckMinute = '';
let ecommerceCleanupScheduleRunning = false;
let ecommerceCleanupScheduleLastCheckMinute = '';

function sameLocalDate(a, b) {
  if (!a || !b) return false;
  const dateA = new Date(a);
  const dateB = new Date(b);
  if (Number.isNaN(dateA.getTime()) || Number.isNaN(dateB.getTime())) return false;
  return (
    dateA.getFullYear() === dateB.getFullYear() &&
    dateA.getMonth() === dateB.getMonth() &&
    dateA.getDate() === dateB.getDate()
  );
}

function wasScheduleChangedAfterLastRun(config) {
  if (!config?.ultimaEjecucion || !config?.actualizadoEn) return false;
  const lastRun = new Date(config.ultimaEjecucion);
  const updated = new Date(config.actualizadoEn);
  if (Number.isNaN(lastRun.getTime()) || Number.isNaN(updated.getTime())) return false;
  return updated.getTime() > lastRun.getTime();
}

function isScheduleDayEnabled(diasSemana, date) {
  const clean = String(diasSemana || '').trim();
  if (!clean) return true;
  const enabledDays = clean
    .split(',')
    .map((item) => Number.parseInt(item, 10))
    .filter((item) => Number.isInteger(item));
  return enabledDays.includes(date.getDay());
}

async function getScheduledEcommerceImportUserId() {
  const [[adminUser]] = await pool.query(
    `SELECT id
     FROM ${DB_NAME}.users
     WHERE id_roles = 1
     ORDER BY id
     LIMIT 1`
  );
  if (adminUser?.id) return adminUser.id;
  const [[anyUser]] = await pool.query(
    `SELECT id
     FROM ${DB_NAME}.users
     ORDER BY id
     LIMIT 1`
  );
  return anyUser?.id || null;
}

async function runScheduledEcommerceImport(config) {
  ecommerceImportScheduleRunning = true;
  let job = null;
  try {
    const userId = await getScheduledEcommerceImportUserId();
    if (!userId) throw new Error('No hay usuario disponible para registrar la bajada automatica');
    job = createEcommerceImportJob(config.tipoBajada || 'todo', userId);
    await pool.query(
      `UPDATE ${DB_NAME}.scheduled_tasks
       SET ultima_ejecucion = ?, ultimo_job_id = ?, ultimo_estado = 'running', ultimo_mensaje = ?
       WHERE id = ?`,
      [
        formatDateTimeLocal(new Date()),
        job.id,
        `Bajada ${config.tipoBajada || 'todo'} iniciada automaticamente`,
        config.id,
      ]
    );
    await runEcommerceImportJob(job);
    await pool.query(
      `UPDATE ${DB_NAME}.scheduled_tasks
       SET ultimo_estado = ?, ultimo_mensaje = ?
       WHERE id = ?`,
      [job.status || 'done', job.message || job.error || '', config.id]
    );
  } catch (error) {
    await pool.query(
      `UPDATE ${DB_NAME}.scheduled_tasks
       SET ultimo_estado = 'error', ultimo_mensaje = ?
       WHERE id = ?`,
      [String(error.message || 'Error en bajada automatica').slice(0, 255), config.id]
    ).catch(() => {});
  } finally {
    ecommerceImportScheduleRunning = false;
  }
}

async function cleanupOldEcommerceRuns(mantenerUltimas) {
  let conn;
  const keep = Math.max(1, Number.parseInt(mantenerUltimas, 10) || 5);
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();
    const [runs] = await conn.query(
      `SELECT id
       FROM ${DB_NAME}.provecomerce
       ORDER BY id DESC`
    );
    const idsToDelete = runs.slice(keep).map((row) => Number(row.id)).filter((id) => Number.isInteger(id) && id > 0);
    if (!idsToDelete.length) {
      await conn.commit();
      return { corridas: 0, items: 0, mantenidas: runs.length };
    }

    let deletedItems = 0;
    let deletedRuns = 0;
    for (let offset = 0; offset < idsToDelete.length; offset += 500) {
      const chunk = idsToDelete.slice(offset, offset + 500);
      const placeholders = chunk.map(() => '?').join(',');
      const [childResult] = await conn.query(
        `DELETE FROM ${DB_NAME}.statusecomercesincro WHERE id_provecomerce IN (${placeholders})`,
        chunk
      );
      const [parentResult] = await conn.query(
        `DELETE FROM ${DB_NAME}.provecomerce WHERE id IN (${placeholders})`,
        chunk
      );
      deletedItems += Number(childResult.affectedRows) || 0;
      deletedRuns += Number(parentResult.affectedRows) || 0;
    }
    await conn.commit();
    return { corridas: deletedRuns, items: deletedItems, mantenidas: Math.min(keep, runs.length) };
  } catch (error) {
    if (conn) {
      try {
        await conn.rollback();
      } catch (_err) {
        /* ignore */
      }
    }
    throw error;
  } finally {
    if (conn) conn.release();
  }
}

async function runScheduledEcommerceCleanup(config) {
  ecommerceCleanupScheduleRunning = true;
  try {
    await pool.query(
      `UPDATE ${DB_NAME}.scheduled_tasks
       SET ultima_ejecucion = ?, ultimo_estado = 'running', ultimo_mensaje = ?
       WHERE id = ?`,
      [
        formatDateTimeLocal(new Date()),
        `Limpieza iniciada. Mantener ultimas ${config.mantenerUltimas || 5} corridas`,
        config.id,
      ]
    );
    const result = await cleanupOldEcommerceRuns(config.mantenerUltimas || 5);
    await pool.query(
      `UPDATE ${DB_NAME}.scheduled_tasks
       SET ultimo_estado = 'done', ultimo_mensaje = ?
       WHERE id = ?`,
      [
        `Eliminadas ${result.corridas} corridas y ${result.items} articulos. Conservadas ${result.mantenidas}.`,
        config.id,
      ]
    );
  } catch (error) {
    await pool.query(
      `UPDATE ${DB_NAME}.scheduled_tasks
       SET ultimo_estado = 'error', ultimo_mensaje = ?
       WHERE id = ?`,
      [String(error.message || 'Error en limpieza automatica').slice(0, 255), config.id]
    ).catch(() => {});
  } finally {
    ecommerceCleanupScheduleRunning = false;
  }
}

async function checkEcommerceImportSchedule() {
  const now = new Date();
  const minuteKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()} ${now.getHours()}:${now.getMinutes()}`;
  if (minuteKey === ecommerceImportScheduleLastCheckMinute) return;
  ecommerceImportScheduleLastCheckMinute = minuteKey;
  if (ecommerceImportScheduleRunning || ecommerceCleanupScheduleRunning || hasImportJobRunning()) return;
  let config;
  try {
    config = await getEcommerceImportScheduleConfig();
  } catch (_error) {
    return;
  }
  if (!config.enabled) return;
  if (!isScheduleDayEnabled(config.diasSemana, now)) return;
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  if (currentTime !== config.hora) return;
  if (sameLocalDate(config.ultimaEjecucion, now) && !wasScheduleChangedAfterLastRun(config)) return;
  runScheduledEcommerceImport(config);
}

async function checkEcommerceCleanupSchedule() {
  const now = new Date();
  const minuteKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()} ${now.getHours()}:${now.getMinutes()}`;
  if (minuteKey === ecommerceCleanupScheduleLastCheckMinute) return;
  ecommerceCleanupScheduleLastCheckMinute = minuteKey;
  if (
    ecommerceCleanupScheduleRunning ||
    ecommerceImportScheduleRunning ||
    hasImportJobRunning() ||
    hasSyncJobRunning()
  ) {
    return;
  }
  let config;
  try {
    config = await getEcommerceCleanupScheduleConfig();
  } catch (_error) {
    return;
  }
  if (!config.enabled) return;
  if (!isScheduleDayEnabled(config.diasSemana, now)) return;
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  if (currentTime !== config.hora) return;
  if (sameLocalDate(config.ultimaEjecucion, now) && !wasScheduleChangedAfterLastRun(config)) return;
  runScheduledEcommerceCleanup(config);
}

ensureFacturasErrorLogInitialized();
ensurePedidosErrorLogInitialized();
app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://0.0.0.0:${PORT}`);
  setInterval(() => {
    checkEcommerceImportSchedule();
    checkEcommerceCleanupSchedule();
  }, 60 * 1000);
  checkEcommerceImportSchedule();
  checkEcommerceCleanupSchedule();
});
// cerrar último bloque










