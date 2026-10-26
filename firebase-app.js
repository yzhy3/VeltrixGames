// ============================================
// VELTRIX GAMES - Firebase Auth + Profile + Chat + Admin
// ============================================

let currentUser = null;
let isAdmin = false;
let chatUnsub = null;
let commentsUnsub = null;
let longPressTimer = null;
let activeMsgId = null;

// Código secreto para registrarse como ADMIN automáticamente
// Cámbialo por el que quieras. Quien lo ponga al registrarse = admin
const ADMIN_SECRET = 'veltrixadmin2026';

// Initialize Firebase (compat SDK)
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// ========== AUTH STATE ==========
auth.onAuthStateChanged(async (user) => {
  currentUser = user;
  if (user) {
    const userDoc = await db.collection('users').doc(user.uid).get();
    if (userDoc.exists) {
      const data = userDoc.data();
      isAdmin = !!data.isAdmin;
      updateUIForUser(user, data);
    } else {
      await db.collection('users').doc(user.uid).set({
        displayName: user.displayName || (user.email ? user.email.split('@')[0] : 'Usuario'),
        email: user.email || '',
        photoURL: user.photoURL || null,
        isAdmin: false,
        bio: '',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      isAdmin = false;
      updateUIForUser(user, {
        displayName: user.displayName || (user.email ? user.email.split('@')[0] : 'Usuario'),
        photoURL: user.photoURL
      });
    }
  } else {
    isAdmin = false;
    updateUIForGuest();
  }
});

function updateUIForUser(user, data) {
  const avatarHtml = data.photoURL
    ? `<img src="${data.photoURL}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;">`
    : `<div style="width:32px;height:32px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;color:#fff;">${(data.displayName || 'U')[0].toUpperCase()}</div>`;

  const profileBtn = document.getElementById('bnav-profile');
  if (profileBtn) {
    profileBtn.innerHTML = avatarHtml + '<span>Perfil</span>';
  }

  // Admin button always visible in sidebar when admin
  const adminBtn = document.getElementById('adminNavBtn');
  if (adminBtn) {
    adminBtn.style.display = isAdmin ? 'flex' : 'none';
  }

  // Also show admin shortcut on profile page if needed
  const adminShortcut = document.getElementById('profileAdminBtn');
  if (adminShortcut) {
    adminShortcut.style.display = isAdmin ? 'block' : 'none';
  }

  const sbUser = document.getElementById('sidebarUser');
  if (sbUser) {
    sbUser.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;padding:16px;border-bottom:1px solid var(--border-color);">
        ${avatarHtml}
        <div style="flex:1;min-width:0;">
          <div style="font-weight:800;font-size:14px;">${escapeHTML(data.displayName || 'Usuario')}</div>
          <div style="font-size:11px;color:var(--text-muted);">${escapeHTML(user.email || '')}${isAdmin ? ' · <span style="color:var(--accent);">Admin</span>' : ''}</div>
        </div>
        <button onclick="logout()" class="btn-icon" title="Cerrar sesión"><svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg></button>
      </div>`;
  }

  const revName = document.getElementById('revName');
  if (revName) {
    revName.style.display = 'none';
    revName.value = data.displayName || '';
  }
}

function updateUIForGuest() {
  const profileBtn = document.getElementById('bnav-profile');
  if (profileBtn) {
    profileBtn.innerHTML = `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg><span>Perfil</span>`;
  }
  const adminBtn = document.getElementById('adminNavBtn');
  if (adminBtn) adminBtn.style.display = 'none';
  const adminShortcut = document.getElementById('profileAdminBtn');
  if (adminShortcut) adminShortcut.style.display = 'none';

  const sbUser = document.getElementById('sidebarUser');
  if (sbUser) {
    sbUser.innerHTML = `
      <div style="padding:16px;border-bottom:1px solid var(--border-color);">
        <button onclick="openAuthModal()" class="btn-primary" style="width:100%;">Iniciar Sesión</button>
      </div>`;
  }
  const revName = document.getElementById('revName');
  if (revName) revName.style.display = 'block';
}

// ========== AUTH MODAL ==========
function openAuthModal(mode = 'login') {
  const m = document.getElementById('authModal');
  if (m) m.style.display = 'flex';
  switchAuthTab(mode);
}

function closeAuthModal() {
  const m = document.getElementById('authModal');
  if (m) m.style.display = 'none';
}

function switchAuthTab(tab) {
  const loginF = document.getElementById('authLoginForm');
  const regF = document.getElementById('authRegisterForm');
  if (loginF) loginF.style.display = tab === 'login' ? 'block' : 'none';
  if (regF) regF.style.display = tab === 'register' ? 'block' : 'none';
  document.querySelectorAll('.auth-tab').forEach(el => el.classList.remove('active'));
  const t = document.getElementById(tab === 'login' ? 'tabLogin' : 'tabRegister');
  if (t) t.classList.add('active');
}

async function loginEmail() {
  const email = document.getElementById('loginEmail').value.trim();
  const pass = document.getElementById('loginPass').value;
  if (!email || !pass) return showToast('Completa todos los campos', true);
  try {
    await auth.signInWithEmailAndPassword(email, pass);
    closeAuthModal();
    showToast('¡Bienvenido!');
  } catch (e) {
    showToast(authErrorMsg(e.code), true);
  }
}

async function registerEmail() {
  const name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const pass = document.getElementById('regPass').value;
  const adminCode = (document.getElementById('regAdminCode') || {}).value || '';
  if (!name || !email || !pass) return showToast('Completa todos los campos', true);
  if (pass.length < 6) return showToast('La contraseña debe tener al menos 6 caracteres', true);

  const makeAdmin = adminCode.trim() === ADMIN_SECRET;

  try {
    const cred = await auth.createUserWithEmailAndPassword(email, pass);
    await cred.user.updateProfile({ displayName: name });
    await db.collection('users').doc(cred.user.uid).set({
      displayName: name,
      email,
      photoURL: null,
      isAdmin: makeAdmin,
      bio: '',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    isAdmin = makeAdmin;
    closeAuthModal();
    showToast(makeAdmin ? '¡Cuenta Admin creada!' : '¡Cuenta creada!');
  } catch (e) {
    showToast(authErrorMsg(e.code), true);
  }
}

async function loginGoogle() {
  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    await auth.signInWithPopup(provider);
    closeAuthModal();
    showToast('¡Bienvenido!');
  } catch (e) {
    if (e.code !== 'auth/popup-closed-by-user') showToast(authErrorMsg(e.code), true);
  }
}

async function logout() {
  await auth.signOut();
  showToast('Sesión cerrada');
  if (typeof showPage === 'function') showPage('home');
}

function authErrorMsg(code) {
  const map = {
    'auth/user-not-found': 'Usuario no encontrado',
    'auth/wrong-password': 'Contraseña incorrecta',
    'auth/invalid-credential': 'Email o contraseña incorrectos',
    'auth/email-already-in-use': 'El email ya está registrado',
    'auth/invalid-email': 'Email inválido',
    'auth/weak-password': 'Contraseña muy débil',
    'auth/too-many-requests': 'Demasiados intentos. Espera un momento',
    'auth/popup-blocked': 'Popup bloqueado. Permite popups para este sitio'
  };
  return map[code] || 'Error de autenticación';
}

// ========== PROFILE ==========
function openProfile() {
  if (!currentUser) {
    openAuthModal('login');
    return;
  }
  if (typeof showPage === 'function') showPage('profile');
  loadProfile();
}

async function loadProfile() {
  if (!currentUser) return;
  const doc = await db.collection('users').doc(currentUser.uid).get();
  const data = doc.data() || {};
  const nameEl = document.getElementById('profileName');
  const bioEl = document.getElementById('profileBio');
  const emailEl = document.getElementById('profileEmail');
  const avatar = document.getElementById('profileAvatar');
  if (nameEl) nameEl.value = data.displayName || '';
  if (bioEl) bioEl.value = data.bio || '';
  if (emailEl) emailEl.textContent = currentUser.email || '';
  if (avatar) {
    if (data.photoURL) {
      avatar.innerHTML = `<img src="${data.photoURL}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
    } else {
      avatar.innerHTML = `<span style="font-size:32px;font-weight:900;color:#fff;">${(data.displayName || 'U')[0].toUpperCase()}</span>`;
    }
  }
  const adminShortcut = document.getElementById('profileAdminBtn');
  if (adminShortcut) adminShortcut.style.display = isAdmin ? 'block' : 'none';
}

async function saveProfile() {
  if (!currentUser) return;
  const name = document.getElementById('profileName').value.trim();
  const bio = document.getElementById('profileBio').value.trim();
  if (!name) return showToast('El nombre es obligatorio', true);
  try {
    await db.collection('users').doc(currentUser.uid).update({ displayName: name, bio });
    await currentUser.updateProfile({ displayName: name });
    showToast('Perfil actualizado');
    updateUIForUser(currentUser, { displayName: name, photoURL: currentUser.photoURL, bio });
  } catch (e) {
    showToast('Error al guardar', true);
  }
}

// ========== COMMENTS ==========
async function submitReview() {
  if (!currentUser) {
    openAuthModal('login');
    showToast('Inicia sesión para comentar', true);
    return;
  }
  if (!curGame) return;
  if (!currentRating) return showToast('¡Elige primero las estrellas!', true);
  const text = document.getElementById('revText').value.trim();
  if (!text) return showToast('Escribe un comentario', true);

  try {
    const userDoc = await db.collection('users').doc(currentUser.uid).get();
    const userData = userDoc.data() || {};
    await db.collection('comments').add({
      gameId: String(curGame.game_id),
      userId: currentUser.uid,
      userName: userData.displayName || currentUser.displayName || 'Usuario',
      userPhoto: userData.photoURL || currentUser.photoURL || null,
      text,
      rating: currentRating,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    document.getElementById('revText').value = '';
    currentRating = 0;
    document.querySelectorAll('#starInput svg').forEach(s => s.style.color = 'var(--border-color)');
    await loadReviewsFirebase(curGame.game_id);
    showToast('¡Reseña publicada!');
  } catch (e) {
    console.error(e);
    showToast('Error al publicar', true);
  }
}

async function loadReviewsFirebase(gameId) {
  try {
    const snap = await db.collection('comments')
      .where('gameId', '==', String(gameId))
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const revs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const total = revs.length;
    const sum = revs.reduce((a, b) => a + (b.rating || 0), 0);
    const avg = total ? (sum / total).toFixed(1) : '0.0';

    const avgEl = document.getElementById('rateAvgTxt');
    const countEl = document.getElementById('rateCount');
    if (avgEl) avgEl.innerText = avg;
    if (countEl) countEl.innerText = total + ' reseñas';

    let starsHTML = '';
    for (let i = 1; i <= 5; i++) {
      starsHTML += `<svg style="width:16px;height:16px;color:${i <= Math.round(avg) ? '#eab308' : 'var(--border-color)'};" fill="currentColor" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
    }
    const starsEl = document.getElementById('rateStars');
    if (starsEl) starsEl.innerHTML = starsHTML;

    let counts = [0, 0, 0, 0, 0];
    revs.forEach(r => { if (r.rating >= 1 && r.rating <= 5) counts[r.rating - 1]++; });
    let barHTML = '';
    for (let i = 4; i >= 0; i--) {
      let pct = total ? (counts[i] / total * 100) : 0;
      barHTML += `<div style="display:flex;align-items:center;gap:8px;font-size:10px;color:var(--text-muted);"><span>${i + 1}</span><div style="flex:1;height:6px;background:var(--border-color);border-radius:3px;overflow:hidden;"><div style="height:100%;background:var(--accent);border-radius:3px;width:${pct}%"></div></div></div>`;
    }
    const barsEl = document.getElementById('rateBars');
    if (barsEl) barsEl.innerHTML = barHTML;

    const listEl = document.getElementById('reviewList');
    if (listEl) {
      listEl.innerHTML = revs.map(r => `
        <div style="background:var(--card-bg);border:1px solid var(--border-color);border-radius:12px;padding:16px;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
            ${r.userPhoto ? `<img src="${r.userPhoto}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;">` : `<div style="width:28px;height:28px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:#fff;">${(r.userName || 'U')[0]}</div>`}
            <div style="flex:1;">
              <div style="font-weight:800;font-size:13px;">${escapeHTML(r.userName || 'Usuario')}</div>
              <div style="color:#eab308;display:flex;gap:2px;margin-top:2px;">${Array(r.rating || 0).fill('<svg style="width:12px;height:12px;" fill="currentColor" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>').join('')}</div>
            </div>
          </div>
          <div style="font-size:13px;color:var(--text-muted);line-height:1.5;">${escapeHTML(r.text || '')}</div>
        </div>
      `).join('') || '<div style="text-align:center;color:var(--text-muted);font-size:12px;padding:24px 0;">Aún no hay reseñas. ¡Sé el primero!</div>';
    }
  } catch (e) {
    console.error('loadReviewsFirebase', e);
  }
}

// ========== GLOBAL CHAT ==========
function openChat() {
  if (!currentUser) {
    openAuthModal('login');
    showToast('Inicia sesión para usar el chat', true);
    return;
  }
  if (typeof showPage === 'function') showPage('chat');
  startChatListener();
  setTimeout(() => {
    const box = document.getElementById('chatMessages');
    if (box) box.scrollTop = box.scrollHeight;
  }, 300);
}

function startChatListener() {
  if (chatUnsub) chatUnsub();
  chatUnsub = db.collection('chat')
    .orderBy('createdAt', 'desc')
    .limit(100)
    .onSnapshot(snap => {
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() })).reverse();
      renderChatMessages(msgs);
    }, err => console.error(err));
}

function renderChatMessages(msgs) {
  const box = document.getElementById('chatMessages');
  if (!box) return;
  box.innerHTML = msgs.map(m => {
    const isMe = currentUser && m.userId === currentUser.uid;
    const edited = m.edited ? ' <span style="font-size:10px;opacity:0.7;">(editado)</span>' : '';
    return `
      <div class="chat-msg" data-id="${m.id}" data-mine="${isMe ? '1' : '0'}" data-text="${escapeHTML(m.text || '')}"
        style="display:flex;gap:10px;margin-bottom:12px;${isMe ? 'flex-direction:row-reverse;' : ''}"
        oncontextmenu="event.preventDefault(); showMsgMenu('${m.id}', ${isMe}, event);"
        ontouchstart="startLongPress('${m.id}', ${isMe}, event)"
        ontouchend="cancelLongPress()"
        ontouchmove="cancelLongPress()"
        onmousedown="if(event.button===0) startLongPress('${m.id}', ${isMe}, event)"
        onmouseup="cancelLongPress()"
        onmouseleave="cancelLongPress()">
        ${m.userPhoto
          ? `<img src="${m.userPhoto}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;flex-shrink:0;">`
          : `<div style="width:32px;height:32px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:#fff;flex-shrink:0;">${(m.userName || 'U')[0]}</div>`}
        <div style="max-width:75%;">
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:2px;${isMe ? 'text-align:right;' : ''}">${escapeHTML(m.userName || 'Usuario')}${edited}</div>
          <div style="background:${isMe ? 'var(--accent)' : 'var(--card-bg)'};color:${isMe ? '#fff' : 'var(--text-main)'};padding:10px 14px;border-radius:16px;font-size:14px;line-height:1.4;border:1px solid ${isMe ? 'transparent' : 'var(--border-color)'};word-break:break-word;">
            ${escapeHTML(m.text || '')}
          </div>
        </div>
      </div>`;
  }).join('');
  box.scrollTop = box.scrollHeight;
}

function startLongPress(msgId, isMine, e) {
  cancelLongPress();
  if (!isMine) return; // solo tus mensajes
  longPressTimer = setTimeout(() => {
    showMsgMenu(msgId, true, e);
  }, 500);
}

function cancelLongPress() {
  if (longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
}

function showMsgMenu(msgId, isMine, e) {
  if (!isMine || !currentUser) return;
  activeMsgId = msgId;
  // Remove existing menu
  const old = document.getElementById('msgActionMenu');
  if (old) old.remove();

  const menu = document.createElement('div');
  menu.id = 'msgActionMenu';
  menu.style.cssText = 'position:fixed;z-index:200;background:var(--card-bg);border:1px solid var(--border-color);border-radius:14px;padding:8px;box-shadow:0 8px 32px rgba(0,0,0,0.4);min-width:160px;';

  // Position near finger/click
  let x = (e.touches ? e.touches[0].clientX : e.clientX) || window.innerWidth / 2;
  let y = (e.touches ? e.touches[0].clientY : e.clientY) || window.innerHeight / 2;
  menu.style.left = Math.min(x, window.innerWidth - 180) + 'px';
  menu.style.top = Math.min(y - 20, window.innerHeight - 120) + 'px';

  menu.innerHTML = `
    <button onclick="editChatMessage()" style="display:flex;align-items:center;gap:10px;width:100%;padding:12px 14px;background:none;border:none;color:var(--text-main);font-size:14px;font-weight:600;cursor:pointer;border-radius:10px;text-align:left;">
      <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      Editar
    </button>
    <button onclick="deleteChatMessage()" style="display:flex;align-items:center;gap:10px;width:100%;padding:12px 14px;background:none;border:none;color:var(--danger);font-size:14px;font-weight:600;cursor:pointer;border-radius:10px;text-align:left;">
      <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
      Eliminar
    </button>
  `;
  document.body.appendChild(menu);

  // Close on outside click
  setTimeout(() => {
    const closer = (ev) => {
      if (!menu.contains(ev.target)) {
        menu.remove();
        document.removeEventListener('click', closer);
        document.removeEventListener('touchstart', closer);
      }
    };
    document.addEventListener('click', closer);
    document.addEventListener('touchstart', closer);
  }, 50);
}

async function editChatMessage() {
  const menu = document.getElementById('msgActionMenu');
  if (menu) menu.remove();
  if (!activeMsgId || !currentUser) return;

  const msgEl = document.querySelector(`.chat-msg[data-id="${activeMsgId}"]`);
  const oldText = msgEl ? msgEl.getAttribute('data-text') : '';
  const nuevo = prompt('Editar mensaje:', oldText);
  if (nuevo === null || nuevo.trim() === '') return;
  if (nuevo.trim() === oldText) return;

  try {
    await db.collection('chat').doc(activeMsgId).update({
      text: nuevo.trim(),
      edited: true,
      editedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    showToast('Mensaje editado');
  } catch (e) {
    showToast('No se pudo editar', true);
  }
  activeMsgId = null;
}

async function deleteChatMessage() {
  const menu = document.getElementById('msgActionMenu');
  if (menu) menu.remove();
  if (!activeMsgId || !currentUser) return;
  if (!confirm('¿Eliminar este mensaje?')) return;

  try {
    await db.collection('chat').doc(activeMsgId).delete();
    showToast('Mensaje eliminado');
  } catch (e) {
    showToast('No se pudo eliminar', true);
  }
  activeMsgId = null;
}

async function sendChatMessage() {
  if (!currentUser) return openAuthModal();
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  try {
    const userDoc = await db.collection('users').doc(currentUser.uid).get();
    const userData = userDoc.data() || {};
    await db.collection('chat').add({
      userId: currentUser.uid,
      userName: userData.displayName || currentUser.displayName || 'Usuario',
      userPhoto: userData.photoURL || currentUser.photoURL || null,
      text,
      edited: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (e) {
    showToast('Error al enviar', true);
  }
}

// ========== ADMIN PANEL ==========
function openAdmin() {
  if (!currentUser) {
    openAuthModal('login');
    return;
  }
  if (!isAdmin) {
    showToast('No tienes permisos de administrador', true);
    return;
  }
  // Force show page
  document.querySelectorAll('.page').forEach(el => {
    el.classList.remove('active');
    el.classList.add('hidden');
  });
  const target = document.getElementById('page-admin');
  if (target) {
    target.classList.remove('hidden');
    target.classList.add('active');
  }
  document.querySelectorAll('.bnav-item').forEach(el => el.classList.remove('active'));
  window.scrollTo(0, 0);
  loadAdminGames();
}

async function loadAdminGames() {
  try {
    const list = await sbGet('games?order=created_at.desc');
    const container = document.getElementById('adminGamesList');
    if (!container) return;
    container.innerHTML = (list || []).map(g => `
      <div style="background:var(--card-bg);border:1px solid var(--border-color);border-radius:12px;padding:12px;display:flex;gap:12px;align-items:center;">
        <img src="${g.image_url || ''}" style="width:48px;height:48px;border-radius:10px;object-fit:cover;background:var(--border-color);" onerror="this.src=''">
        <div style="flex:1;min-width:0;">
          <div style="font-weight:800;font-size:14px;">${escapeHTML(g.title || '')}</div>
          <div style="font-size:11px;color:var(--text-muted);">${g.is_active ? '✅ Activo' : '❌ Inactivo'} · ${escapeHTML(g.developer || '')}</div>
        </div>
      </div>
    `).join('') || '<p style="color:var(--text-muted);text-align:center;padding:20px;">No hay juegos aún</p>';
  } catch (e) {
    console.error(e);
    showToast('Error cargando juegos', true);
  }
}

function showAddGameForm() {
  const form = document.getElementById('adminAddForm');
  const list = document.getElementById('adminGamesList');
  if (form) form.style.display = 'block';
  if (list) list.style.display = 'none';
}

function hideAddGameForm() {
  const form = document.getElementById('adminAddForm');
  const list = document.getElementById('adminGamesList');
  if (form) form.style.display = 'none';
  if (list) list.style.display = 'block';
}

async function saveNewGame() {
  if (!isAdmin) return showToast('Sin permisos', true);
  const title = document.getElementById('agTitle').value.trim();
  const developer = document.getElementById('agDev').value.trim();
  const type = document.getElementById('agType').value.trim();
  const desc = document.getElementById('agDesc').value.trim();
  const download = document.getElementById('agDownload').value.trim();
  const image = document.getElementById('agImage').value.trim();
  const category = document.getElementById('agCategory').value.trim();

  if (!title || !download) return showToast('Título y link de descarga son obligatorios', true);

  try {
    const ok = await sbPost('games', {
      title,
      developer: developer || 'Veltrix',
      type: type || 'Mod',
      description: desc,
      download_url: download,
      image_url: image,
      category: category || 'Otros',
      is_active: true,
      created_at: new Date().toISOString()
    });
    if (ok) {
      showToast('¡Juego subido correctamente!');
      hideAddGameForm();
      ['agTitle', 'agDev', 'agType', 'agDesc', 'agDownload', 'agImage', 'agCategory'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      loadAdminGames();
      if (typeof initHome === 'function') initHome();
    } else {
      showToast('Error al subir. Revisa permisos de Supabase (INSERT en games).', true);
    }
  } catch (e) {
    showToast('Error: ' + e.message, true);
  }
}

// Make functions global
window.openAuthModal = openAuthModal;
window.closeAuthModal = closeAuthModal;
window.switchAuthTab = switchAuthTab;
window.loginEmail = loginEmail;
window.registerEmail = registerEmail;
window.loginGoogle = loginGoogle;
window.logout = logout;
window.openProfile = openProfile;
window.saveProfile = saveProfile;
window.openChat = openChat;
window.sendChatMessage = sendChatMessage;
window.openAdmin = openAdmin;
window.showAddGameForm = showAddGameForm;
window.hideAddGameForm = hideAddGameForm;
window.saveNewGame = saveNewGame;
window.submitReview = submitReview;
window.editChatMessage = editChatMessage;
window.deleteChatMessage = deleteChatMessage;
window.startLongPress = startLongPress;
window.cancelLongPress = cancelLongPress;
window.showMsgMenu = showMsgMenu;

// Override after DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.submitReview = submitReview;
  window.loadReviews = async function (id) {
    await loadReviewsFirebase(id);
  };
});
