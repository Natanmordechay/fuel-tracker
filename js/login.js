// js/login.js
document.addEventListener('DOMContentLoaded', () => {
  const loginBtn = document.getElementById('login');
  const out = document.getElementById('out');

  if (!loginBtn) {
    console.error('login button not found (#login)');
    return;
  }
  if (!window.sb) {
    console.error('Supabase client not found (window.sb). Check script order/paths.');
    out && (out.textContent = 'שגיאה: Supabase לא נטען. בדוק script tags.');
    return;
  }

  // בדיקה: אם כבר מחובר, נכנסים לאפליקציה
  (async () => {
    const { data: { user } } = await sb.auth.getUser();
    if (user) window.location.href = 'index.html';
  })();

  loginBtn.addEventListener('click', async () => {
    console.log('Login click fired ✅');
    out && (out.textContent = 'פותח התחברות עם Google...');

    const basePath = window.location.pathname.replace(/\/[^/]*$/, '/');
    const redirectTo = window.location.origin + basePath + 'index.html';

    const { error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo }
    });

    if (error) {
      console.error(error);
      out && (out.textContent = 'שגיאה: ' + error.message);
    }
  });
});
