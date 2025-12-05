# Repository Guidelines

## Estructura del proyecto
- Backend en server.js (Express) con rutas REST hacia MySQL; credenciales por .env (usa .env.example como guía, nunca subas datos reales).
- Frontend en public/ (index.html, styles.css, pp.js, assets e imágenes); login separado en public/login.*.
- Respeta package-lock.json; no versiones 
ode_modules/ ni archivos .env reales.

## Comandos de desarrollo y prueba
- Instalar dependencias: 
pm install.
- Desarrollo con recarga: 
pm run dev (nodemon). Producción: 
pm start.
- Requiere MySQL accesible; valida que las variables de entorno coincidan con el servidor configurado.

## Estilo de código y convenciones
- JavaScript con indentación de 2 espacios; comillas simples y punto y coma coherentes con el código existente.
- Nombres claros por función (loadEmpleados, enderEncuestas); evita abreviaturas crípticas.
- Mantén estilos en styles.css; usa clases nuevas en lugar de CSS inline al sumar componentes.
- Para SQL, respeta filtros por rango de fechas (inicio y fin de mes), COALESCE para nulos y TIMESTAMPDIFF para tiempos; cuida ONLY_FULL_GROUP_BY.

## Lineamientos de pruebas
- No hay suite automatizada aún; prueba manualmente login, dashboard, encuestas, pedidos, paquetería y empleados (modales, calendarios y ediciones).
- Al tocar consultas, valida meses distintos, roles y filtros de búsqueda; verifica que totales, porcentajes y estados cambien con el selector de mes.
- Si agregas datos de ejemplo, protégelos con banderas (p. ej. USE_SAMPLE_FALLBACK) y déjalos apagados por defecto.

## Commits y Pull Requests
- Usa mensajes estilo Conventional Commits (eat:, ix:, chore:, docs:).
- Cambios pequeños y enfocados; describe impacto, comandos ejecutados y riesgos conocidos.
- Incluye capturas o GIFs cuando alteres UI; enlaza tareas o issues si existen.

## Seguridad y configuración
- Nunca subas credenciales reales; documenta en .env.example las claves necesarias (host, user, password, database).
- Revisa dependencias nuevas antes de añadirlas; elimina logs sensibles o de consola antes de subir.