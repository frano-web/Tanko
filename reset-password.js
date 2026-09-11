const $ = (id) => document.getElementById(id);
const toast = (message) => {
  const el = $('toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
};

const configured = !!(window.APP_CONFIG?.SUPABASE_URL && window.APP_CONFIG?.SUPABASE_ANON_KEY && window.supabase);
const sb = configured ? window.supabase.createClient(window.APP_CONFIG.SUPABASE_URL, window.APP_CONFIG.SUPABASE_ANON_KEY) : null;

function setBusy(busy) {
  const btn = $('savePasswordBtn');
  btn.disabled = busy;
  btn.textContent = busy ? 'Zapisywanie…' : 'Zapisz nowe hasło';
}

document.querySelectorAll('[data-toggle]').forEach((button) => {
  button.addEventListener('click', () => {
    const input = $(button.dataset.toggle);
    input.type = input.type === 'password' ? 'text' : 'password';
    button.textContent = input.type === 'password' ? '◉' : '◎';
  });
});

$('newPasswordForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const password = $('newPassword').value;
  const confirmation = $('confirmPassword').value;

  if (password.length < 8) return toast('Hasło musi mieć co najmniej 8 znaków.');
  if (password !== confirmation) return toast('Hasła nie są takie same.');
  if (!sb) return toast('Nie udało się połączyć z usługą logowania.');

  setBusy(true);
  const { error } = await sb.auth.updateUser({ password });
  setBusy(false);

  if (error) return toast(error.message || 'Nie udało się zmienić hasła.');
  toast('Hasło zostało zmienione.');
  setTimeout(() => { window.location.href = './'; }, 900);
});

(async () => {
  if (!sb) return;
  const { data } = await sb.auth.getSession();
  if (!data.session) {
    sb.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') toast('Możesz ustawić nowe hasło.');
    });
  }
})();
