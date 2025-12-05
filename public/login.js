const form = document.getElementById('login-form');
const statusEl = document.getElementById('status');
const button = document.getElementById('login-button');

function setStatus(message, type = '') {
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  setStatus('Verificando credenciales...');
  button.disabled = true;
  try {
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || 'Credenciales inválidas');
    }
    setStatus('Ingreso exitoso, redirigiendo...', 'success');
    window.location.href = '/';
  } catch (error) {
    setStatus(error.message, 'error');
  } finally {
    button.disabled = false;
  }
});
