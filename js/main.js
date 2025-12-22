// ===== Supabase client (מגיע מ-supabaseClient.js) =====
const sb = window.sb;

function hasSupabase() {
  return !!sb;
}

// ===== Auth Guard =====
(async function requireAuth() {
  if (!sb) return; // safety

  const { data: { user }, error } = await sb.auth.getUser();
  if (error || !user) {
    window.location.href = 'login.html';
  }
})();

async function getUserId() {
  const { data: { user }, error } = await sb.auth.getUser();
  if (error || !user) return null;
  return user.id;
}


// ===== Logout (optional) =====
const logoutBtn = document.getElementById('logoutBtn');

(async function initLogout() {
  if (!logoutBtn || !sb) return;

  const { data: { user } } = await sb.auth.getUser();
  if (user) logoutBtn.style.display = 'inline-block';

  logoutBtn.addEventListener('click', async () => {
    await sb.auth.signOut();
    window.location.href = 'login.html';
  });
})();

// ===== App config =====
const TABLE_NAME = 'fuel_cards';
const PROFILE_ID_KEY = 'fuelProfileId_v1';
const LOCAL_STORAGE_KEY = 'fuelCardsLocal_v1';

function generateId() {
  return String(Date.now()) + '_' + Math.random().toString(16).slice(2);
}

function getProfileId() {
  let id = localStorage.getItem(PROFILE_ID_KEY);
  if (!id) {
    id = 'profile_' + generateId();
    localStorage.setItem(PROFILE_ID_KEY, id);
  }
  return id;
}

function formatAmount(value) {
  return Number(value).toFixed(0);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ===== Local storage =====
function loadCardsLocal() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(c => ({
        id: c.id || generateId(),
        code: String(c.code || '').trim(),
        remaining: typeof c.remaining === 'number' ? c.remaining : 100
      }))
      .filter(c => c.code);
  } catch (e) {
    console.error('Failed to load local cards', e);
    return [];
  }
}

function saveCardsLocal(cards) {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cards));
}

// ===== Supabase (clean, uses sb) =====
async function loadCardsSupabase() {
  if (!hasSupabase()) return null;

  const userId = await getUserId();
  if (!userId) return null;

  try {
    const { data, error } = await sb
      .from(TABLE_NAME)
      .select('id, code, remaining')
      .eq('user_id', userId);

    if (error) {
      console.warn('Supabase load error:', error.message);
      return null;
    }

    return (data || []).map(row => ({
      id: row.id || generateId(),
      code: row.code || '',
      remaining: typeof row.remaining === 'number' ? row.remaining : 100
    }));
  } catch (e) {
    console.warn('Supabase load exception:', e);
    return null;
  }
}

async function saveCardsSupabase(cards) {
  if (!hasSupabase()) return false;

  const userId = await getUserId();
  if (!userId) return false;

  try {
    // מוחקים את כל השורות של המשתמש הנוכחי
    const { error: delError } = await sb
      .from(TABLE_NAME)
      .delete()
      .eq('user_id', userId);

    if (delError) {
      console.warn('Supabase delete error:', delError.message);
      return false;
    }

    if (!cards.length) return true;

    // מכניסים מחדש עם user_id
    const payload = cards.map(c => ({
      user_id: userId,
      code: c.code,
      remaining: c.remaining
    }));

    const { error: insError } = await sb
      .from(TABLE_NAME)
      .insert(payload);

    if (insError) {
      console.warn('Supabase insert error:', insError.message);
      return false;
    }

    return true;
  } catch (e) {
    console.warn('Supabase save exception:', e);
    return false;
  }
}

// ===== Unified load/save =====
async function loadCards() {
  const fromSupabase = await loadCardsSupabase();
  if (fromSupabase && Array.isArray(fromSupabase)) {
    saveCardsLocal(fromSupabase);
    return fromSupabase;
  }
  return loadCardsLocal();
}

async function saveCards(cards) {
  saveCardsLocal(cards);
  const ok = await saveCardsSupabase(cards);
  if (!ok && hasSupabase()) {
    console.warn('Cloud save failed, kept local only');
  }
}

// ===== UI =====
async function render() {
  const cards = await loadCards();
  const container = document.getElementById('cardsContainer');

  if (!cards.length) {
    container.innerHTML =
      '<div class="no-cards">עדיין לא הוספת מספרי דלק. התחל בהוספה למעלה 👆</div>';
  } else {
    let html =
      '<div style="overflow-x:auto;"><table><thead><tr>' +
      '<th>מספר דלק</th>' +
      '<th>סטטוס</th>' +
      '<th>יתרה (₪)</th>' +
      '<th>שומש (₪)</th>' +
      '<th>תדלוק</th>' +
      '<th>פעולות</th>' +
      '</tr></thead><tbody>';

    cards.forEach(card => {
      const used = 100 - (card.remaining || 0);
      const isEmpty = card.remaining <= 0;
      html +=
        '<tr class="' + (isEmpty ? 'used-up' : '') + '">' +
        '<td><strong>' + escapeHtml(card.code) + '</strong></td>' +
        '<td>' +
        (isEmpty
          ? '<span class="pill pill-empty">נוצל במלואו</span>'
          : '<span class="pill pill-ok">פעיל</span>') +
        '</td>' +
        '<td class="amount">' + formatAmount(Math.max(card.remaining, 0)) + '</td>' +
        '<td class="amount">' + formatAmount(Math.min(Math.max(used, 0), 100)) + '</td>' +
        '<td>' +
        '<div class="row" style="gap:6px; align-items:center;">' +
        '<div class="col" style="min-width:110px; flex:1;">' +
        '<input type="number" class="small-input" min="0" step="1" placeholder="סכום" ' +
        'data-type="refuel-input" data-id="' + card.id + '" />' +
        '</div>' +
        '<div style="flex:0 0 auto;">' +
        '<button class="btn-primary btn-sm" data-action="refuel" data-id="' + card.id + '">עדכן</button>' +
        '</div>' +
        '</div>' +
        '</td>' +
        '<td>' +
        '<button class="btn-outline btn-sm" data-action="reset-card" data-id="' + card.id + '">איפוס ל-100 ₪</button> ' +
        '<button class="btn-danger btn-sm" data-action="delete" data-id="' + card.id + '">מחק</button>' +
        '</td>' +
        '</tr>';
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;
  }

  const totalRemaining = cards.reduce((sum, c) => sum + (c.remaining || 0), 0);
  const totalUsed = cards.length * 100 - totalRemaining;
  document.getElementById('statsCount').textContent = cards.length;
  document.getElementById('statsTotalRemaining').textContent =
    formatAmount(Math.max(totalRemaining, 0));
  document.getElementById('statsTotalUsed').textContent =
    formatAmount(Math.max(totalUsed, 0));
}

async function addCardsFromInput() {
  const input = document.getElementById('newCode');
  const errorEl = document.getElementById('newCodeError');
  let text = input.value.trim();

  errorEl.style.display = 'none';
  errorEl.textContent = '';

  if (!text) {
    errorEl.textContent = 'נא להזין לפחות מספר דלק אחד.';
    errorEl.style.display = 'block';
    return;
  }

  const lines = text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);

  if (!lines.length) {
    errorEl.textContent = 'לא נמצאו מספרים תקינים להוספה.';
    errorEl.style.display = 'block';
    return;
  }

  let cards = await loadCards();
  const existingCodes = new Set(cards.map(c => c.code));

  const newCards = [];
  const duplicates = [];

  lines.forEach(code => {
    if (existingCodes.has(code)) {
      duplicates.push(code);
    } else {
      newCards.push({
        id: generateId(),
        code,
        remaining: 100
      });
      existingCodes.add(code);
    }
  });

  if (!newCards.length) {
    errorEl.textContent = 'כל המספרים שהזנת כבר קיימים במערכת.';
    errorEl.style.display = 'block';
    return;
  }

  cards = cards.concat(newCards);
  await saveCards(cards);
  await render();

  if (duplicates.length) {
    errorEl.textContent =
      'חלק מהמספרים לא נוספו כי כבר קיימים: ' + duplicates.join(', ');
    errorEl.style.display = 'block';
  }

  input.value = '';
}

async function resetAll() {
  if (!confirm('לאפס את כל המערכת? כל מספרי הדלק והיתרות יימחקו.')) return;
  await saveCards([]);
  await render();
}

async function handleTableClick(event) {
  const btn = event.target.closest('button[data-action]');
  if (!btn) return;

  const action = btn.getAttribute('data-action');
  const id = btn.getAttribute('data-id');
  if (!action || !id) return;

  let cards = await loadCards();
  const idx = cards.findIndex(c => c.id === id);
  if (idx === -1) return;

  if (action === 'delete') {
    if (!confirm('למחוק את מספר הדלק הזה?')) return;
    cards.splice(idx, 1);
    await saveCards(cards);
    await render();
  } else if (action === 'reset-card') {
    if (!confirm('לאפס את המספר הזה ל-100 ₪?')) return;
    cards[idx].remaining = 100;
    await saveCards(cards);
    await render();
  } else if (action === 'refuel') {
    const row = btn.closest('tr');
    const input = row.querySelector(
      'input[data-type="refuel-input"][data-id="' + id + '"]'
    );
    if (!input) return;

    const raw = input.value.trim();
    const amount = Number(raw.replace(',', '.'));

    if (!raw || isNaN(amount) || amount <= 0) {
      alert('נא להזין סכום תדלוק גדול מ-0');
      return;
    }

    const card = cards[idx];

    if (amount > card.remaining) {
      if (
        !confirm(
          'הסכום גבוה מהיתרה (' +
            formatAmount(card.remaining) +
            ' ₪). האם לחייב עד הסוף ולהשאיר את המספר ריק?'
        )
      ) {
        return;
      }
      card.remaining = 0;
    } else {
      card.remaining = Number((card.remaining - amount).toFixed(2));
    }

    cards[idx] = card;
    await saveCards(cards);
    await render();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  render();

  document
    .getElementById('addCardBtn')
    .addEventListener('click', () => { addCardsFromInput(); });

  document
    .getElementById('newCode')
    .addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        addCardsFromInput();
      }
    });

  document
    .getElementById('resetAllBtn')
    .addEventListener('click', () => { resetAll(); });

  document
    .getElementById('cardsContainer')
    .addEventListener('click', (e) => { handleTableClick(e); });
});
