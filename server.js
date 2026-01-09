require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const express = require('express');
const { computeNuevaCantidad, resolveArticuloValores, resolveCompraValores } = require('./lib/abmBatch');
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
  'pedidos',
  'pedidos-menu',
  'pedidos-todos',
  'facturas',
  'comisiones',
  'mercaderia',
  'abm',
  'control-ordenes',
  'configuracion',
];

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
      `SELECT Articulo AS articulo, Detalle AS detalle, Cantidad AS cantidad
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
         oa.detalle,
         SUM(oa.cantidad) AS TNCantidad,
         oa.precio AS TNPrecio,
         ptemp.cantidad AS CantidadLocal,
         ptemp.PrecioUnitario AS PrecioLocal
       FROM controlpedidos ctrl
       INNER JOIN pedidotemp ptemp ON ptemp.nropedido = ctrl.nropedido
       INNER JOIN ordenesarticulos oa
         ON oa.articulo = ptemp.articulo
        AND oa.id_controlPedidos = ctrl.id
       WHERE ctrl.nropedido = ?
       GROUP BY ctrl.nropedido, oa.articulo, oa.detalle, oa.precio, ptemp.cantidad, ptemp.PrecioUnitario
       HAVING TNCantidad <> CantidadLocal OR TNPrecio <> PrecioLocal`,
      [nropedido]
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

    const [rows] = await pool.query(
      `${baseSelect}
       WHERE 1=1
         ${extra}
         ${searchSql}
       ORDER BY ${orderBy} ${orderDir}
       LIMIT ? OFFSET ?`,
      [...searchParams, length, start]
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
        recordsFiltered: Number(filteredRow?.total) || 0,
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
      `INSERT INTO chatpedidosia (id_controlpedidos, id_users, chat, fecha)
       VALUES (?, ?, ?, ?)`,
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
      `INSERT INTO chatpedidosia (id_controlpedidos, id_users, chat, fecha)
       VALUES (?, ?, ?, ?)`,
      [controlId, miaId, reply, ahora]
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
    } catch (_err) {
      permissions = {};
    }
    res.json({
      user: { id: payload.id, name: payload.name, email: payload.email, role },
      permissions,
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

app.get('/api/control-ordenes', requireAuth, async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 10));
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
    const searchTerm = String(req.query.q || '').trim();

    const conditions = [
      'c.TipoOrden IS NOT NULL',
      'c.TipoOrden = 2',
      'c.Cantidad <> 0',
    ];
    const params = [];

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
        observaciones || '',
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
      observaciones || '',
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
    const { tipoPagoId, estadoId, comentario } = req.body || {};

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









