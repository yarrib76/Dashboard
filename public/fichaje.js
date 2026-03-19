const actionButtons = Array.from(document.querySelectorAll('.action-btn'));
const codigoInput = document.getElementById('codigo-input');
const clearButton = document.getElementById('clear-button');
const confirmButton = document.getElementById('confirm-button');
const resetButton = document.getElementById('reset-button');
const employeeCard = document.getElementById('employee-card');
const employeePhoto = document.getElementById('employee-photo');
const employeeName = document.getElementById('employee-name');
const employeeSubtitle = document.getElementById('employee-subtitle');
const employeeCode = document.getElementById('employee-code');
const messageBoard = document.getElementById('message-board');
const messageTitle = document.getElementById('message-title');
const messageText = document.getElementById('message-text');
const clockValue = document.getElementById('clock-value');
const dateValue = document.getElementById('date-value');

const state = {
  action: null,
  employee: null,
  busy: false,
  lookupTimer: null,
  lookupSeq: 0,
};

function setMessage(kind, title, text) {
  messageBoard.className = `message-board ${kind}`;
  messageTitle.textContent = title;
  messageText.textContent = text;
}

function updateClock() {
  const now = new Date();
  clockValue.textContent = now.toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  dateValue.textContent = now.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function renderAction() {
  actionButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.action === state.action);
  });
  codigoInput.disabled = !state.action || state.busy;
  clearButton.disabled = !state.action || state.busy;
  confirmButton.disabled = !state.action || !state.employee || state.busy;
  confirmButton.textContent =
    state.action === 'egreso' ? 'Confirmar egreso' : state.action === 'ingreso' ? 'Confirmar ingreso' : 'Confirmar';
}

function renderEmployee(employee, codeValue = '') {
  state.employee = employee;
  employeeCard.classList.toggle('is-empty', !employee);
  employeePhoto.src = employee?.fotoUrl || '/sinfoto.png';
  employeeName.textContent = employee?.name || 'Esperando lectura';
  employeeSubtitle.textContent = employee
    ? 'Empleado validado. Puedes confirmar la operación.'
    : state.action
      ? 'Escanea o escribe el código para validar al empleado.'
      : 'Selecciona una acción para habilitar el lector.';
  employeeCode.textContent = codeValue ? `Codigo: ${codeValue}` : 'Sin código leído';
  renderAction();
}

function setBusy(busy) {
  state.busy = !!busy;
  renderAction();
}

function resetTerminal({ preserveAction = false, message = null } = {}) {
  if (state.lookupTimer) {
    clearTimeout(state.lookupTimer);
    state.lookupTimer = null;
  }
  state.lookupSeq += 1;
  if (!preserveAction) state.action = null;
  codigoInput.value = '';
  renderEmployee(null, '');
  renderAction();
  if (message) {
    setMessage(message.kind, message.title, message.text);
  } else if (!preserveAction) {
    setMessage('idle', 'Terminal lista', 'Elige si vas a registrar un ingreso o un egreso.');
  } else {
    setMessage('idle', 'Esperando lectura', 'Escanea o escribe el código del empleado para continuar.');
  }
}

async function fetchJSON(url, options = {}) {
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  let data = {};
  try {
    data = await res.json();
  } catch (_err) {
    data = {};
  }

  if (!res.ok) {
    const error = new Error(data.message || `Error ${res.status}`);
    error.response = data;
    throw error;
  }

  return data;
}

async function lookupEmployee(force = false) {
  const codigo = String(codigoInput.value || '').trim();
  if (!state.action) {
    setMessage('warning', 'Falta elegir acción', 'Selecciona ingreso o egreso antes de leer el código.');
    return;
  }
  if (!codigo) {
    renderEmployee(null, '');
    return;
  }
  if (!force && codigo.length < 4) return;

  const currentSeq = ++state.lookupSeq;
  setMessage('idle', 'Buscando empleado', 'Validando el código leído...');

  try {
    const data = await fetchJSON(`/api/fichaje/empleado?codigo=${encodeURIComponent(codigo)}`);
    if (currentSeq !== state.lookupSeq) return;
    renderEmployee(data.empleado || null, codigo);
    setMessage(
      'idle',
      data.empleado?.name || 'Empleado encontrado',
      'Datos validados. Ya puedes confirmar la operación.'
    );
  } catch (error) {
    if (currentSeq !== state.lookupSeq) return;
    renderEmployee(null, codigo);
    setMessage('error', 'Código no válido', error.message || 'No se pudo validar el empleado.');
  }
}

async function submitFichaje() {
  const codigo = String(codigoInput.value || '').trim();
  if (!state.action || !state.employee || !codigo || state.busy) return;

  setBusy(true);
  setMessage(
    'idle',
    state.action === 'egreso' ? 'Registrando egreso' : 'Registrando ingreso',
    'Procesando la operación en el servidor...'
  );

  try {
    const data = await fetchJSON(`/api/fichaje/${state.action}`, {
      method: 'POST',
      body: JSON.stringify({ codigo }),
    });

    const kind =
      data.status === 'duplicate_ignored' ? 'warning' : data.ok ? 'success' : 'error';
    const title =
      data.status === 'updated'
        ? 'Egreso registrado'
        : data.status === 'created'
          ? 'Ingreso registrado'
          : data.status === 'duplicate_ignored'
            ? 'Lectura repetida ignorada'
            : data.ok
              ? 'Operación completada'
              : 'No se pudo registrar';

    resetTerminal({
      message: {
        kind,
        title,
        text: data.message || 'Operación procesada.',
      },
    });
  } catch (error) {
    const response = error.response || {};
    setMessage('error', 'No se pudo registrar', response.message || error.message || 'Error inesperado.');
    setBusy(false);
    renderAction();
    codigoInput.focus();
    codigoInput.select();
    return;
  }

  setBusy(false);
  renderAction();
}

actionButtons.forEach((button) => {
  button.addEventListener('click', () => {
    state.lookupSeq += 1;
    state.action = button.dataset.action;
    state.employee = null;
    codigoInput.value = '';
    renderEmployee(null, '');
    renderAction();
    setMessage('idle', 'Esperando lectura', 'Escanea o escribe el código del empleado para continuar.');
    codigoInput.focus();
  });
});

codigoInput.addEventListener('input', () => {
  renderEmployee(null, String(codigoInput.value || '').trim());
  if (state.lookupTimer) clearTimeout(state.lookupTimer);
  state.lookupTimer = setTimeout(() => lookupEmployee(false), 220);
});

codigoInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    if (state.employee) {
      submitFichaje();
    } else {
      lookupEmployee(true);
    }
  }
});

confirmButton.addEventListener('click', submitFichaje);

clearButton.addEventListener('click', () => {
  state.lookupSeq += 1;
  codigoInput.value = '';
  renderEmployee(null, '');
  setMessage('idle', 'Esperando lectura', 'Escanea o escribe el código del empleado para continuar.');
  codigoInput.focus();
});

resetButton.addEventListener('click', () => resetTerminal());

updateClock();
setInterval(updateClock, 1000);
resetTerminal();
