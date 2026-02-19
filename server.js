require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const express = require('express');
const { computeNuevaCantidad, resolveArticuloValores, resolveCompraValores } = require('./lib/abmBatch');
const { computePedidoSubtotal } = require('./lib/pedidosNuevo');
const { processAbmCreate } = require('./lib/abmCreateService');
const { processAbmBatch } = require('./lib/abmBatchService');
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
const PREDICTOR_URL = process.env.PREDICTOR_URL || 'http://192.168.0.154:8000/prediccion/sku';
const TNUBE_BASE_URL = 'https://api.tiendanube.com/v1';

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

function getTnubeConnection(storeId) {
  const id = String(storeId || '').trim();
  const connections = {
    '972788': {
      accessToken: process.env.TNUBE_TOKEN_972788 || '',
      appName: process.env.TNUBE_APPNAME_972788 || 'SincroDemo',
      tienda: 'Nacha',
    },
    '938857': {
      accessToken: process.env.TNUBE_TOKEN_938857 || '',
      appName: process.env.TNUBE_APPNAME_938857 || 'SincroApps',
      tienda: 'Samira',
    },
    '963000': {
      accessToken: process.env.TNUBE_TOKEN_963000 || '',
      appName: process.env.TNUBE_APPNAME_963000 || 'SincoAppsDonatella',
      tienda: 'Donatella',
    },
    '1043936': {
      accessToken: process.env.TNUBE_TOKEN_1043936 || '',
      appName: process.env.TNUBE_APPNAME_1043936 || 'SincoAppsViamore',
      tienda: 'Viamore',
    },
    '1379491': {
      accessToken: process.env.TNUBE_TOKEN_1379491 || '',
      appName: process.env.TNUBE_APPNAME_1379491 || 'SincroDemo',
      tienda: 'LabLocales',
    },
    '4999055': {
      accessToken: process.env.TNUBE_TOKEN_4999055 || '',
      appName: process.env.TNUBE_APPNAME_4999055 || 'SincroDemo',
      tienda: 'MegaNay',
    },
  };
  const connection = connections[id];
  if (!connection || !connection.accessToken) {
    throw new Error('Conexion TiendaNube no configurada para el store_id');
  }
  return connection;
}

  // Envoltorio simple para llamadas a la API de Tienda Nube (headers + JSON).
  async function tnubeRequest(storeId, token, appName, method, pathUrl, payload) {
    const url = `${TNUBE_BASE_URL}/${storeId}/${pathUrl.replace(/^\/+/, '')}`;
    const headers = {
      'Content-Type': 'application/json',
      Authentication: `bearer ${token}`,
    'User-Agent': appName || 'Dashboard',
    Accept: 'application/json',
  };
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
    if (response.status === 204) return null;
    return response.json().catch(() => null);
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
  'panel-control',
  'cargar-ticket',
  'empleados',
  'clientes',
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
  'abm',
  'control-ordenes',
  'ecommerce',
  'ecommerce-imagenweb',
  'ecommerce-panel',
  'cajas',
  'cajas-cierre',
  'cajas-nueva-factura',
  'configuracion',
];

const FIDELIZACION_DEFAULT_CONFIG = {
  cooldown_days: 30,
  conversion_window_days: 14,
  max_clients_per_run: 200,
  w_month_match: 30,
  w_frequency_12m: 20,
  w_recency_30_90: 20,
  w_monetary_12m: 10,
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

function parseMaybeJson(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (_err) {
    return null;
  }
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
    updated_by: row.updated_by || '',
    updated_at: row.updated_at || null,
  };
}

async function getFidelizacionActiveConfig(conn) {
  const [[row]] = await conn.query(
    `SELECT id, is_active, cooldown_days, conversion_window_days, max_clients_per_run,
            w_month_match, w_frequency_12m, w_recency_30_90, w_monetary_12m, updated_by, updated_at
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

app.get('/api/paqueteria', async (_req, res) => {
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

app.get('/api/paqueteria/lista', async (req, res) => {
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
           f.id_user,
           CAST(SUM(
             CASE
               WHEN DAYOFWEEK(f.fecha_ingreso) = 7 AND TIMEDIFF(TIME(f.fecha_ingreso), '09:00:00') BETWEEN '00:00:01' AND '00:05:00' THEN 1
               WHEN DAYOFWEEK(f.fecha_ingreso) <> 7 AND TIMEDIFF(TIME(f.fecha_ingreso), COALESCE(u2.hora_ingreso, '09:00:00')) BETWEEN '00:00:01' AND '00:05:00' THEN 1
               ELSE 0
             END
           ) AS SIGNED) AS alertas,
           CAST(SUM(
             CASE
               WHEN DAYOFWEEK(f.fecha_ingreso) = 7 AND TIMEDIFF(TIME(f.fecha_ingreso), '09:00:00') > '00:05:00' THEN 1
               WHEN DAYOFWEEK(f.fecha_ingreso) <> 7 AND TIMEDIFF(TIME(f.fecha_ingreso), COALESCE(u2.hora_ingreso, '09:00:00')) > '00:05:00' THEN 1
            ELSE 0
          END
        ) AS SIGNED) AS tardes
         FROM fichaje f
        JOIN users u2 ON u2.id = f.id_user
        WHERE f.fecha_ingreso >= ?
          AND f.fecha_ingreso < ?
        GROUP BY f.id_user
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
  if (req.path === '/login' || req.path === '/health') return next();
  return requireAuth(req, res, next); 
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
        w_month_match, w_frequency_12m, w_recency_30_90, w_monetary_12m, updated_by)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        config.cooldown_days,
        config.conversion_window_days,
        config.max_clients_per_run,
        config.w_month_match,
        config.w_frequency_12m,
        config.w_recency_30_90,
        config.w_monetary_12m,
        config.updated_by || '',
      ]
    );
    await conn.commit();
    const [[saved]] = await pool.query(
      `SELECT id, is_active, cooldown_days, conversion_window_days, max_clients_per_run,
              w_month_match, w_frequency_12m, w_recency_30_90, w_monetary_12m, updated_by, updated_at
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
          w_month_match, w_frequency_12m, w_recency_30_90, w_monetary_12m, updated_by)
         VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          config.cooldown_days,
          config.conversion_window_days,
          config.max_clients_per_run,
          config.w_month_match,
          config.w_frequency_12m,
          config.w_recency_30_90,
          config.w_monetary_12m,
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
             WHEN f.Fecha >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH) THEN 1
             ELSE 0
           END
         ) AS frequency_12m,
         SUM(
           CASE
             WHEN f.Fecha >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
               THEN COALESCE(NULLIF(f.totalEnvio, 0), NULLIF(f.Descuento, 0), f.Total, 0)
             ELSE 0
           END
         ) AS monetary_12m,
         SUM(
           CASE
             WHEN f.Fecha >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
              AND MONTH(f.Fecha) = MONTH(CURDATE())
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
       HAVING DATEDIFF(CURDATE(), DATE(MAX(f.Fecha))) >= ?
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
        const recency = Number(row.recency_days) || 0;
        const monthMatch = (Number(row.month_hits_12m) || 0) > 0;
        const recency3090 = recency >= 30 && recency <= 90;
        const frequencyScore = Math.min(1, frequency / maxFrequency);
        const monetaryScore = Math.min(1, monetary / maxMonetary);
        const score =
          (monthMatch ? config.w_month_match : 0) +
          frequencyScore * config.w_frequency_12m +
          (recency3090 ? config.w_recency_30_90 : 0) +
          monetaryScore * config.w_monetary_12m;

        const razones = [];
        if (monthMatch) razones.push(`estacionalidad(+${config.w_month_match})`);
        if (frequency > 0) razones.push(`frecuencia 12m: ${frequency}`);
        if (recency3090) razones.push(`recencia ideal: ${recency} dias`);
        if (monetary > 0) razones.push(`monto 12m: ${round2(monetary)}`);

        return {
          cliente_id: Number(row.cliente_id) || 0,
          last_purchase_date: row.last_purchase_date || null,
          recency_days: recency,
          frequency_12m: frequency,
          monetary_12m: round2(monetary),
          avg_ticket_12m: frequency > 0 ? round2(monetary / frequency) : 0,
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
    const [countRowsMias] = await pool.query(
      `SELECT r.estado, COUNT(*) AS total
       FROM fidelizacion_recomendacion r
       ${miasFilters.length ? `WHERE ${miasFilters.join(' AND ')}` : ''}
       GROUP BY r.estado`,
      miasParams
    );

    const todosFilters = [...commonFilters, `r.estado IN ('PENDIENTE', 'EN_GESTION', 'CONTACTADA')`];
    const todosParams = [...commonParams];
    const [countRowsTodos] = await pool.query(
      `SELECT r.estado, COUNT(*) AS total
       FROM fidelizacion_recomendacion r
       ${todosFilters.length ? `WHERE ${todosFilters.join(' AND ')}` : ''}
       GROUP BY r.estado`,
      todosParams
    );

    const [countRowsAdmin] = await pool.query(
      `SELECT r.estado, COUNT(*) AS total
       FROM fidelizacion_recomendacion r
       ${commonFilters.length ? `WHERE ${commonFilters.join(' AND ')}` : ''}
       GROUP BY r.estado`,
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
      data: rows || [],
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar cola de fidelizacion', error: error.message });
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
    if (!['PENDIENTE', 'EN_GESTION'].includes(String(current.estado || '').toUpperCase())) {
      await conn.rollback();
      return res.status(400).json({ message: 'Solo se puede transferir desde PENDIENTE o EN_GESTION' });
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
           estado = 'PENDIENTE',
           estado_updated_at = NOW(),
           estado_updated_by = ?
       WHERE id = ?`,
      [destinoId, context.userName || req.user?.name || '', recId]
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
         AND cp.fecha >= ?
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
    const conversionReasonCatalog = pedido ? await listFidelizacionConversionReasonsCatalogo(conn) : [];
    const conversionReasonCodeSet = new Set(
      conversionReasonCatalog.map((row) => String(row.codigo || '').trim().toUpperCase()).filter(Boolean)
    );

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
      `UPDATE fidelizacion_recomendacion
       SET estado = 'PENDIENTE',
           resultado = NULL,
           conversion_reason_code = NULL,
           conversion_reason_note = NULL,
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
         COUNT(r.id) AS total,
         SUM(r.estado='CERRADA') AS finalizadas,
         SUM(r.resultado IN (?,?)) AS convertidas,
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
       GROUP BY fr.id, fr.run_date, fr.created_at, fr.config_id
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
                   THEN r.conversion_amount
                   ELSE 0
                 END
               ), 0
             ) AS monto_conversion,
             ROUND(AVG(r.score), 2) AS score_prom,
             ROUND(AVG(TIMESTAMPDIFF(HOUR, r.created_at, r.contactado_at)), 1) AS hs_a_contacto
           FROM fidelizacion_recomendacion r
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
                   THEN r.conversion_amount
                   ELSE 0
                 END
               ), 0
             ) AS monto_conversion,
             ROUND(AVG(r.score), 2) AS score_prom,
             ROUND(AVG(TIMESTAMPDIFF(HOUR, r.created_at, r.contactado_at)), 1) AS hs_a_contacto
           FROM fidelizacion_recomendacion r
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
         ROUND(SUM(CASE WHEN r.resultado IN (?,?) THEN COALESCE(r.conversion_amount, 0) ELSE 0 END), 2) AS conversion_amount,
         ROUND(AVG(r.score), 2) AS score_promedio,
       ROUND(AVG(CASE WHEN r.contactado_at IS NOT NULL THEN TIMESTAMPDIFF(HOUR, r.created_at, r.contactado_at) END), 2) AS horas_a_contacto
       FROM fidelizacion_recomendacion r
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
         r.conversion_amount
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
      `SELECT id, name, email, id_roles, id_vendedoras, hora_ingreso, hora_egreso
       FROM users
       ORDER BY name`
    );
    res.json({ data: rows || [] });
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
      `SELECT id, name, email, id_roles, id_vendedoras, hora_ingreso, hora_egreso
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [userId]
    );
    res.json({ ok: true, user: row || {} });
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar usuario', error: error.message });
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

app.get('/api/encuestas/mes', async (_req, res) => {
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
         Observaciones
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
      observaciones = '',
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
         AND table_name = 'articulos'
         AND column_name = 'Observaciones'
       LIMIT 1`
    );
    const maxObservaciones = Number(obsRow?.maxLen) || 255;
    const observacionesFinal = (observaciones || '').toString().slice(0, maxObservaciones);

    await conn.query(
      `UPDATE articulos
       SET Detalle = ?,
           Cantidad = ?,
           PrecioOrigen = ?,
           PrecioConvertido = ?,
           Moneda = ?,
           PrecioManual = ?,
           Gastos = ?,
           Ganancia = ?,
           Proveedor = ?,
           Observaciones = ?
       WHERE Articulo = ?
       LIMIT 1`,
      [
        detalle || '',
        nuevaCantidad,
        Number(precioOrigen) || 0,
        precioConvertidoFinal,
        moneda,
        precioManualFinal,
        gastosFinal,
        gananciaFinal,
        proveedor || '',
        observacionesFinal,
        articulo,
      ]
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

app.get('/api/pedidos/productividad', async (req, res) => {
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

app.get('/api/pedidos/mensual', async (_req, res) => {
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

app.get('/api/ventas/mensual', async (req, res) => {
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

app.get('/api/pedidos/clientes', async (req, res) => {
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
         END AS tipo
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
    const totalWeb = Number(ordenWeb) ? total : 0;
    await connection.query(
      `UPDATE ${DB_NAME}.controlpedidos
       SET id_cliente = ?,
           vendedora = ?,
           total = ?,
           ordenWeb = ?,
           local = ?,
           totalweb = ?,
           instancia = ?,
           ultactualizacion = ?
       WHERE nropedido = ?
       LIMIT 1`,
      [clienteId, vendedora, total, ordenWeb, local, totalWeb, instancia, fecha, nroPedido]
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
  try {
    const { cliente_id, vendedora, ordenWeb = 0, items = [], nroPedido } = req.body || {};
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
    const totalWeb = Number(ordenWeb) ? total : 0;
    await connection.query(
      `INSERT INTO ${DB_NAME}.controlpedidos
       (id_cliente, nropedido, vendedora, cajera, fecha, estado, total, ordenWeb, empaquetado, local, totalweb, instancia)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?, 0, ?, ?, ?)`,
      [clienteId, pedidoNumero, vendedora, cajera, fecha, total, ordenWeb, local, totalWeb, instancia]
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
    res.status(500).json({ message: 'Error al crear pedido', error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

app.post('/api/facturas', requireAuth, async (req, res) => {
  let connection;
  try {
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
    } = req.body || {};
    if (!cliente_id || !vendedora || !tipo_pago_id) {
      return res.status(400).json({ message: 'cliente_id, vendedora y tipo_pago_id requeridos' });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'items requeridos' });
    }
    connection = await pool.getConnection();
    await connection.beginTransaction();
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
    let subtotal = 0;
    let gananciaTotal = 0;
    let precioArgentina = 0;
    for (const item of items) {
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
    const pct = Number(porcentajeDescuento) || 0;
    const envioValue = Number(envio) || 0;
    const totalDescuento = pct > 0 ? subtotal * (1 - pct / 100) : null;
    const totalEnvio = (totalDescuento ?? subtotal) + envioValue;
    if (pct > 0) {
      gananciaTotal = Number(totalDescuento) - precioArgentina;
    }
    for (const item of processedItems) {
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
       (NroFactura, Total, Porcentaje, Descuento, Ganancia, Fecha, Estado, id_clientes, envio, totalEnvio, id_tipo_pago, vendedora, pagomixto, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
    if (connection) {
      try {
        await connection.rollback();
      } catch (_err) {
        /* ignore */
      }
    }
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
           f.id_user,
           CAST(SUM(
             CASE
               WHEN DAYOFWEEK(f.fecha_ingreso) = 7 AND TIMEDIFF(TIME(f.fecha_ingreso), '09:00:00') > '00:05:00' THEN 1
               WHEN DAYOFWEEK(f.fecha_ingreso) <> 7 AND TIMEDIFF(TIME(f.fecha_ingreso), COALESCE(u2.hora_ingreso, '09:00:00')) > '00:05:00' THEN 1
               ELSE 0
             END
           ) AS SIGNED) AS tardes
         FROM fichaje f
         INNER JOIN users u2 ON u2.id = f.id_user
         WHERE f.fecha_ingreso >= ?
           AND f.fecha_ingreso < ?
         GROUP BY f.id_user
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

    const [[row]] = await pool.query(
      `SELECT
         ROUND(SUM(CASE WHEN f.Descuento IS NOT NULL OR f.Descuento = 0 THEN f.Descuento ELSE f.total END), 2) AS total,
         COUNT(*) AS cantidad
       FROM facturah f
       LEFT JOIN controlpedidos cp ON cp.nrofactura = f.NroFactura
       WHERE DATE(f.fecha) BETWEEN ? AND ?
         AND (cp.nrofactura IS NULL OR cp.ordenWeb IS NULL OR cp.ordenWeb = 0)`,
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
         f.vendedora,
         COUNT(*) AS cantidad
       FROM facturah f
       LEFT JOIN controlpedidos cp ON cp.nrofactura = f.NroFactura
       WHERE DATE(f.fecha) BETWEEN ? AND ?
         AND (cp.nrofactura IS NULL OR cp.ordenWeb IS NULL OR cp.ordenWeb = 0)
       GROUP BY f.vendedora
       ORDER BY cantidad DESC, f.vendedora`,
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
        '(cp.nrofactura IS NULL OR cp.ordenWeb IS NULL OR cp.ordenWeb = 0)',
      ];
      const params = [fechaDesde, fechaHasta];
      if (vendedora === 'Sin vendedora') {
        conditions.push('(f.vendedora IS NULL OR f.vendedora = "")');
      } else {
        conditions.push('f.vendedora = ?');
        params.push(vendedora);
      }

      const [rows] = await pool.query(
        `SELECT
           CONCAT(cli.nombre, ' ', cli.apellido) AS cliente,
           f.NroFactura AS factura,
           f.Total AS total,
           DATE_FORMAT(f.fecha, '%Y-%m-%d') AS fecha,
           DATE_FORMAT(f.created_at, '%H:%i:%s') AS hora
         FROM facturah f
         INNER JOIN clientes cli ON cli.id_clientes = f.id_clientes
         LEFT JOIN controlpedidos cp ON cp.nrofactura = f.NroFactura
         WHERE ${conditions.join(' AND ')}
         ORDER BY f.fecha DESC, f.NroFactura DESC`,
        params
      );

      res.json({ desde: fechaDesde, hasta: fechaHasta, data: rows || [] });
    } catch (error) {
      res.status(500).json({ message: 'Error al cargar ventas por vendedora (salón)', error: error.message });
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
        resumen.total,
        resumen.ok,
        resumen.errores,
        resumen.excluidos,
        resumen.pendientes
      FROM ${DB_NAME}.provecomerce AS ecomerce
      INNER JOIN ${DB_NAME}.users AS usuario ON usuario.id = ecomerce.id_users
      INNER JOIN (
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

  // Sincro Tienda Nube: actualiza publicado y precio/stock de variantes.
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
    const statusOk = 'OK';
    let rows = [];

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
      const [result] = await conn.query(sql, [ordenCant, idCorrida, statusOk]);
      rows = result;
    } else {
      const sql = `
        SELECT
          statusecomerce.id AS e_id,
          statusecomerce.articulo,
          statusecomerce.status,
          statusecomerce.fecha,
          statusecomerce.product_id,
          statusecomerce.articulo_id,
          statusecomerce.images
        FROM ${DB_NAME}.statusecomercesincro AS statusecomerce
        WHERE statusecomerce.id_provecomerce = ?
          AND statusecomerce.status <> ?
      `;
      const [result] = await conn.query(sql, [idCorrida, statusOk]);
      rows = result;
    }

    if (dryRun) {
      return res.json([{ OK: 0, Error: 0, 'No Requiere': 0, dryRun: true, total: rows.length }]);
    }

    let countOk = 0;
    let countError = 0;
    let countCheck = 0;

    const updateStatus = async (id, status) => {
      const fecha = formatDateTimeLocal(new Date());
      await conn.query(
        `UPDATE ${DB_NAME}.statusecomercesincro SET status = ?, fecha = ? WHERE id = ?`,
        [status, fecha, id]
      );
    };

    for (const row of rows) {
      try {
        const [statusRows] = await conn.query(
          `SELECT status FROM ${DB_NAME}.statusecomercesincro WHERE id = ? LIMIT 1`,
          [row.e_id]
        );
        const currentStatus = statusRows[0]?.status || '';
        if (currentStatus === statusOk) {
          countCheck += 1;
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
          if (currentStatus === 'Pending') {
            countCheck += 1;
          }
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
        if (pedidoCantidad) {
          cantidad = cantidad - pedidoCantidad;
        }

        if (conOrden && Number(row.images) === 1 && cantidad >= artiCant) {
          await tnubeRequest(
            storeId,
            tnubeConnection.accessToken,
            tnubeConnection.appName,
            'PUT',
            `products/${row.product_id}`,
            { published: true }
          );
        }

        if (Number(articuloLocal.Web) === 1) {
          const precioVenta = await computePrecioVenta(conn, articuloLocal);
          await tnubeRequest(
            storeId,
            tnubeConnection.accessToken,
            tnubeConnection.appName,
            'PUT',
            `products/${row.product_id}/variants/${row.articulo_id}`,
            {
              price: precioVenta ?? 0,
              stock: verificoStock(cantidad, artiCant),
            }
          );
          await updateStatus(row.e_id, 'OK');
          countOk += 1;
        } else {
          await updateStatus(row.e_id, 'Excluido');
          countOk += 1;
        }
        } catch (_err) {
          try {
            await updateStatus(row.e_id, 'ErrorAPI');
          } catch (_updateErr) {
            /* ignore */
          }
        countError += 1;
      }
    }

    return res.json([{ OK: countOk, Error: countError, 'No Requiere': countCheck }]);
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

app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://0.0.0.0:${PORT}`);
});
// cerrar último bloque










