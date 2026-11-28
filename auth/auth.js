const API = '../api/index.php';
document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('[data-auth]'); if (!form) return;
  const error = document.createElement('p'); error.className = 'auth-error'; form.append(error);
  form.addEventListener('submit', async (event) => {
    event.preventDefault(); error.textContent = '';
    const data = Object.fromEntries(new FormData(form));
    try { const res = await fetch(`${API}?action=${form.dataset.auth}`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}); const json=await res.json(); if(!res.ok) throw new Error(json.error); window.location.href=json.redirect; }
    catch (e) { error.textContent=e.message; }
  });
});
