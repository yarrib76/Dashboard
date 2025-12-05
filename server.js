require('dotenv').config();

const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const path = require('path');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { log } = require('console');

const app = express();
app.use(cors());
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

function setAuthCookie(res, token) {
  const parts = ['auth_token=' + encodeURIComponent(token), 'HttpOnly', 'Path=/', 'SameSite=Lax', 'Max-Age=604800'];
  if (process.env.NODE_ENV === 'production') {
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
         f.fecha AS fechaFactura,
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
       GROUP BY cp.id, cp.fecha, f.fecha, cp.nropedido, cp.nrofactura, cp.vendedora, cp.transporte, cp.total, cp.totalweb, cp.ordenweb, cp.instancia, cp.estado, c.nombre, c.apellido, c.encuesta
       ORDER BY f.fecha DESC`
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

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ message: 'Email y contraseña son requeridos' });
    }

    const [rows] = await pool.query(
      'SELECT id, name, email, password FROM users WHERE email = ? LIMIT 1',
      [email]
    );
    const user = rows[0];
    if (!user) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    const match = await bcrypt.compare(password, user.password || '');
    if (!match) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    const token = signToken({
      id: user.id,
      email: user.email,
      name: user.name,
      iat: Date.now(),
    });
    setAuthCookie(res, token);
    res.json({ ok: true, user: { id: user.id, name: user.name, email: user.email } });
  } catch (error) {
    res.status(500).json({ message: 'Error al iniciar sesión', error: error.message });
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
  res.json({ user: { id: payload.id, name: payload.name, email: payload.email } });
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

    res.json({ year, data: rows });
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar encuestas por mes', error: error.message });
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
