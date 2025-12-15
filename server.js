require('dotenv').config();

const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');
const os = require('os');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { log } = require('console');
const OpenAI = require('openai');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);
const fsp = fs.promises;

const app = express();
// Habilita cookies en peticiones cross-site si el front vive en otro dominio/puerto
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
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
const SESSION_SECRET = requiredEnv('SESSION_SECRET', 'changeme');
const OPENAI_API_KEY = requiredEnv('OPENAI_API_KEY', '');
const OPENAI_MODEL = requiredEnv('OPENAI_MODEL', 'gpt-4o-mini');
const SESSION_MAX_IDLE_MINUTES = Math.max(1, Number(requiredEnv('TIEMP_SESSION', 30)) || 30);
const COOKIE_SECURE_MODE = (process.env.COOKIE_SECURE || 'auto').toLowerCase();
const COOKIE_SAMESITE = (process.env.COOKIE_SAMESITE || 'Lax').trim();

const openai =
  OPENAI_API_KEY && OPENAI_API_KEY.trim()
    ? new OpenAI({ apiKey: OPENAI_API_KEY.trim() })
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
  timezone: 'Z',
});

async function safeQuery(sql, params = []) {
  try {
    return await pool.query(sql, params);
  } catch (err) {
    const transientCodes = ['ECONNRESET', 'PROTOCOL_CONNECTION_LOST', 'ER_SERVER_SHUTDOWN', 'PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR'];
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
    await pool.query('UPDATE controlpedidos SET transporte = ? WHERE id = ? LIMIT 1', [
      transporte || null,
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
           COALESCE(MAX(u.hora_ingreso), '09:00:00') AS horaIngresoRef
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
      entradasMap.set(key, { status, minutos });
    });

    const daysInMonth = new Date(year, month, 0).getDate();
    const dias = [];
    for (let d = 1; d <= daysInMonth; d += 1) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const entry = entradasMap.get(dateStr);
      if (entry) {
        dias.push({ dia: d, status: entry.status, minutos: entry.minutos });
      } else {
        dias.push({ dia: d, status: 'sin_registro', minutos: null });
      }
    }

    res.json({ userId, year, month, dias });
  } catch (error) {
    console.error('Error /api/empleados/tardes', error);
    res.status(500).json({ message: 'Error al cargar llegadas', error: error.message });
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

    const [rows] = await safeQuery(
      'SELECT id, name, email, password FROM users WHERE email = ? LIMIT 1',
      [email]
    );
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

    const token = signToken({
      id: user.id,
      email: user.email,
      name: user.name,
      iat: Date.now(),
    });
    setAuthCookie(res, token, req);
    res.json({ ok: true, user: { id: user.id, name: user.name, email: user.email } });
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
  res.json({
    user: { id: payload.id, name: payload.name, email: payload.email },
    sessionIdleMinutes: SESSION_MAX_IDLE_MINUTES,
  });
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
    const safeYear = Number(anio) || new Date().getFullYear();
    const results = months.map((m) => {
      const base = 20 + Math.floor(Math.random() * 30);
      return { mes: m, prediccion: base };
    });
    const demandaTotal = results.reduce((acc, r) => acc + (Number(r.prediccion) || 0), 0);
    res.json({
      articulo,
      detalle,
      resultados: results,
      demanda_total_horizonte: demandaTotal,
      compra_sugerida_total: Math.max(0, demandaTotal - (Number(stockActual) || 0)),
      anio: safeYear,
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

    const completion = await openai.chat.completions.create({
      model: OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `${message}\n\n${promptFiles}` },
      ],
    });
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
      const completion = await openai.chat.completions.create({
        model: OPENAI_MODEL || 'gpt-4o-mini',
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: baseSystemPrompt(extraRules) },
          { role: 'user', content: userPrompt(question) },
        ],
      });
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
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
// cerrar último bloque
