// ================================================
// ANIME VERSE — Main App
// ================================================

let currentUser     = null;
let allAnimeData    = [];
let currentCategory = 'all';
let currentPage     = 1;
const PAGE_SIZE     = 10;
const SECTION_SIZE  = 10;

// ===== THEME =====
function toggleTheme() {
  const html = document.documentElement;
  const btn  = document.getElementById('themeBtn');
  const dark = html.getAttribute('data-theme') === 'dark';
  html.setAttribute('data-theme', dark ? 'light' : 'dark');
  if (btn) btn.innerHTML = dark
    ? '<i class="fas fa-sun"></i>'
    : '<i class="fas fa-moon"></i>';
  localStorage.setItem('av_theme', dark ? 'light' : 'dark');
}
function loadTheme() {
  const saved = localStorage.getItem('av_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  const btn = document.getElementById('themeBtn');
  if (btn) btn.innerHTML = saved === 'dark'
    ? '<i class="fas fa-moon"></i>'
    : '<i class="fas fa-sun"></i>';
}
loadTheme();

// ===== FETCH ANIME =====
// Defined early so instant loader below can call it immediately
async function fetchAllAnime() {
  const parse = snap => {
    const data = [];
    snap.forEach(doc => {
      const d = { ...doc.data(), firestoreId: doc.id };
      if (d.published !== false) data.push(d);
    });
    return data;
  };

  // Try cache first for instant display, then update from server
  try {
    const cacheSnap = await db.collection('anime').get({ source: 'cache' });
    const cacheData = parse(cacheSnap);
    if (cacheData.length > 0) {
      allAnimeData = cacheData;
      // Silently refresh from server in background
      db.collection('anime').get({ source: 'server' }).then(serverSnap => {
        const fresh = parse(serverSnap);
        if (fresh.length > 0) {
          allAnimeData = fresh;
          renderHome(fresh);
          checkCategoryNotifications(fresh);
        }
      }).catch(() => {});
      return cacheData;
    }
  } catch(cacheErr) {
    // Cache empty or failed, fall through to server
  }

  // No cache — fetch from server directly
  try {
    const snap = await db.collection('anime').get({ source: 'server' });
    const data = parse(snap);
    allAnimeData = data;
    return data;
  } catch(serverErr) {
    console.error('Fetch error:', serverErr);
    return [];
  }
}

// ===== INSTANT CONTENT LOAD =====
// Runs immediately on page load — does NOT wait for auth state.
// This ensures ALL users (guest, logged-in, Telegram Mini App) see
// content right away without any blank screen wait.
let _contentLoaded = false;
(async () => {
  const loadingState = document.getElementById('loadingState');
  const emptyState   = document.getElementById('emptyState');
  const homeSecs     = document.getElementById('homeSections');
  if (loadingState) loadingState.style.display = 'flex';
  if (emptyState)   emptyState && emptyState.classList.add('hidden');
  if (homeSecs)     homeSecs.style.display = 'block';

  let data = await fetchAllAnime();
  if (loadingState) loadingState.style.display = 'none';

  if (data.length > 0) {
    _contentLoaded = true;
    renderHome(data);
    checkCategoryNotifications(data);
  } else {
    // Retry after 3s for very slow connections or cold starts
    setTimeout(async () => {
      if (_contentLoaded) return;
      data = await fetchAllAnime();
      if (data.length > 0) {
        _contentLoaded = true;
        renderHome(data);
        checkCategoryNotifications(data);
      }
    }, 3000);
  }
})();

// ===== AUTH STATE =====
// Auth resolves AFTER content is already shown.
// We only update profile UI and watchlist buttons here — no re-fetch.
auth.onAuthStateChanged(async user => {
  currentUser = user;
  if (user) {
    // Close auth modal if open
    const modal = document.getElementById('avAuthModal');
    if (modal) modal.style.display = 'none';
    document.body.style.overflow = '';

    // Update profile/sidebar UI
    await updateAuthUI(user);

    // Mark saved watchlist buttons on already-rendered cards
    try {
      const doc  = await db.collection('users').doc(user.uid).get();
      const list = doc.exists ? (doc.data().watchlist||[]).map(String) : [];
      list.forEach(id => {
        const btn = document.getElementById(`wl-${id}`);
        if (btn) btn.classList.add('saved');
      });
    } catch(e) {}

    // Safety net: if content somehow didn't load, load it now
    if (!_contentLoaded || allAnimeData.length === 0) {
      const data = await fetchAllAnime();
      if (data.length > 0) {
        _contentLoaded = true;
        renderHome(data);
        checkCategoryNotifications(data);
      }
    }
  } else {
    // Guest user
    setProfileBtnAnon();
    updateSidebarProfile(null);

    // Safety net: if content somehow didn't load, load it now
    if (!_contentLoaded || allAnimeData.length === 0) {
      const data = await fetchAllAnime();
      if (data.length > 0) {
        _contentLoaded = true;
        renderHome(data);
        checkCategoryNotifications(data);
      }
    }
  }
  // Always init sidebar (needed for toggle/close handlers)
  initSidebar();
});

// ===== AUTH MODAL =====
function openAuthModal() {
  let modal = document.getElementById('avAuthModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'avAuthModal';
    modal.style.cssText =
      'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9999;' +
      'display:flex;align-items:center;justify-content:center;' +
      'padding:20px;backdrop-filter:blur(6px)';
    modal.innerHTML = `
      <div style="background:var(--card-bg);border:1px solid var(--border);
        border-radius:20px;padding:24px;width:100%;max-width:380px;
        position:relative">

        <button onclick="closeAuthModal()"
          style="position:absolute;top:14px;right:14px;background:none;
            border:none;color:var(--text2);cursor:pointer;font-size:18px">
          <i class="fas fa-times"></i>
        </button>

        <div style="text-align:center;margin-bottom:20px">
          <div style="font-family:'Bebas Neue',sans-serif;font-size:28px;
            letter-spacing:2px;color:var(--text)">
            ANIME <span style="color:var(--accent)">VERSE</span>
          </div>
          <p style="font-size:13px;color:var(--text2);margin-top:4px">
            Login to unlock all features
          </p>
        </div>

        <!-- TABS -->
        <div style="display:flex;background:var(--bg3);
          border-radius:10px;padding:4px;margin-bottom:20px">
          <button id="av_tabLogin" onclick="avSwitchTab('login')"
            style="flex:1;padding:9px;border-radius:8px;border:none;
              background:var(--accent);color:#fff;
              font-family:'Poppins',sans-serif;font-size:13px;
              font-weight:700;cursor:pointer;transition:all 0.2s">
            Login
          </button>
          <button id="av_tabSignup" onclick="avSwitchTab('signup')"
            style="flex:1;padding:9px;border-radius:8px;border:none;
              background:transparent;color:var(--text2);
              font-family:'Poppins',sans-serif;font-size:13px;
              font-weight:600;cursor:pointer;transition:all 0.2s">
            Sign Up
          </button>
        </div>

        <div id="av_authErr"
          style="display:none;background:rgba(229,9,20,0.1);
            border:1px solid #e50914;color:#e50914;
            padding:10px 12px;border-radius:8px;
            font-size:12px;margin-bottom:14px;line-height:1.6">
        </div>
        <div id="av_authOk"
          style="display:none;background:rgba(39,174,96,0.1);
            border:1px solid #27ae60;color:#27ae60;
            padding:10px 12px;border-radius:8px;
            font-size:12px;margin-bottom:14px;line-height:1.6;
            white-space:pre-line">
        </div>

        <!-- LOGIN FORM -->
        <div id="av_loginForm">
          <div style="margin-bottom:14px">
            <label style="font-size:11px;font-weight:700;
              color:var(--text2);letter-spacing:0.5px;
              display:block;margin-bottom:6px">EMAIL</label>
            <input id="av_email" type="email" placeholder="your@email.com"
              style="width:100%;padding:11px 14px;border-radius:10px;
                border:1px solid var(--border);background:var(--bg3);
                color:var(--text);font-family:'Poppins',sans-serif;
                font-size:13px;box-sizing:border-box;outline:none"/>
          </div>
          <div style="margin-bottom:8px">
            <label style="font-size:11px;font-weight:700;
              color:var(--text2);letter-spacing:0.5px;
              display:block;margin-bottom:6px">PASSWORD</label>
            <div style="position:relative">
              <input id="av_pw" type="password" placeholder="Enter password"
                style="width:100%;padding:11px 44px 11px 14px;border-radius:10px;
                  border:1px solid var(--border);background:var(--bg3);
                  color:var(--text);font-family:'Poppins',sans-serif;
                  font-size:13px;box-sizing:border-box;outline:none"
                onkeydown="if(event.key==='Enter')avDoLogin()"/>
              <button onclick="avTogglePw('av_pw','av_eyeL')"
                style="position:absolute;right:12px;top:50%;
                  transform:translateY(-50%);background:none;
                  border:none;color:var(--text2);cursor:pointer;font-size:15px">
                <i class="fas fa-eye" id="av_eyeL"></i>
              </button>
            </div>
          </div>
          <div style="text-align:right;margin-bottom:16px">
            <a href="#" onclick="avForgotPw()"
              style="font-size:12px;color:var(--accent);
                text-decoration:none;font-weight:600">
              <i class="fas fa-key" style="font-size:11px"></i>
              Forgot Password?
            </a>
          </div>
          <button onclick="avDoLogin()"
            style="width:100%;padding:13px;border-radius:12px;
              border:none;background:var(--accent);color:#fff;
              font-family:'Poppins',sans-serif;font-size:14px;
              font-weight:700;cursor:pointer">
            <i class="fas fa-sign-in-alt"></i> Login
          </button>
          <p style="text-align:center;margin-top:14px;
            font-size:12px;color:var(--text2)">
            Don't have an account?
            <a href="#" onclick="avSwitchTab('signup')"
              style="color:var(--accent);font-weight:600;text-decoration:none">
              Sign Up
            </a>
          </p>
        </div>

        <!-- SIGNUP FORM -->
        <div id="av_signupForm" style="display:none">
          <div style="margin-bottom:14px">
            <label style="font-size:11px;font-weight:700;
              color:var(--text2);letter-spacing:0.5px;
              display:block;margin-bottom:6px">DISPLAY NAME</label>
            <input id="av_name" type="text" placeholder="Your name"
              style="width:100%;padding:11px 14px;border-radius:10px;
                border:1px solid var(--border);background:var(--bg3);
                color:var(--text);font-family:'Poppins',sans-serif;
                font-size:13px;box-sizing:border-box;outline:none"/>
          </div>
          <div style="margin-bottom:14px">
            <label style="font-size:11px;font-weight:700;
              color:var(--text2);letter-spacing:0.5px;
              display:block;margin-bottom:6px">EMAIL</label>
            <input id="av_semail" type="email" placeholder="your@email.com"
              style="width:100%;padding:11px 14px;border-radius:10px;
                border:1px solid var(--border);background:var(--bg3);
                color:var(--text);font-family:'Poppins',sans-serif;
                font-size:13px;box-sizing:border-box;outline:none"/>
          </div>
          <div style="margin-bottom:14px">
            <label style="font-size:11px;font-weight:700;
              color:var(--text2);letter-spacing:0.5px;
              display:block;margin-bottom:6px">PASSWORD</label>
            <div style="position:relative">
              <input id="av_spw" type="password"
                placeholder="Minimum 6 characters"
                style="width:100%;padding:11px 44px 11px 14px;border-radius:10px;
                  border:1px solid var(--border);background:var(--bg3);
                  color:var(--text);font-family:'Poppins',sans-serif;
                  font-size:13px;box-sizing:border-box;outline:none"/>
              <button onclick="avTogglePw('av_spw','av_eyeS')"
                style="position:absolute;right:12px;top:50%;
                  transform:translateY(-50%);background:none;
                  border:none;color:var(--text2);cursor:pointer;font-size:15px">
                <i class="fas fa-eye" id="av_eyeS"></i>
              </button>
            </div>
          </div>
          <div style="margin-bottom:16px">
            <label style="font-size:11px;font-weight:700;
              color:var(--text2);letter-spacing:0.5px;
              display:block;margin-bottom:6px">CONFIRM PASSWORD</label>
            <input id="av_spw2" type="password"
              placeholder="Re-enter password"
              style="width:100%;padding:11px 14px;border-radius:10px;
                border:1px solid var(--border);background:var(--bg3);
                color:var(--text);font-family:'Poppins',sans-serif;
                font-size:13px;box-sizing:border-box;outline:none"
              onkeydown="if(event.key==='Enter')avDoSignup()"/>
          </div>
          <div style="background:rgba(200,119,64,0.08);
            border:1px solid var(--accent);border-radius:8px;
            padding:10px 12px;margin-bottom:16px;font-size:12px;
            color:var(--text2);line-height:1.6;
            display:flex;gap:10px;align-items:flex-start">
            <i class="fas fa-shield-halved"
              style="color:var(--accent);margin-top:2px;
                font-size:14px;flex-shrink:0"></i>
            <span>Verification email will be sent. Verify before logging in.</span>
          </div>
          <button onclick="avDoSignup()"
            style="width:100%;padding:13px;border-radius:12px;
              border:none;background:var(--accent);color:#fff;
              font-family:'Poppins',sans-serif;font-size:14px;
              font-weight:700;cursor:pointer">
            <i class="fas fa-user-plus"></i> Create Account
          </button>
          <p style="text-align:center;margin-top:14px;
            font-size:12px;color:var(--text2)">
            Already have an account?
            <a href="#" onclick="avSwitchTab('login')"
              style="color:var(--accent);font-weight:600;text-decoration:none">
              Login
            </a>
          </p>
        </div>
      </div>`;
    document.body.appendChild(modal);
  }
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeAuthModal() {
  const modal = document.getElementById('avAuthModal');
  if (modal) modal.style.display = 'none';
  document.body.style.overflow = '';
}

function avSwitchTab(tab) {
  const lTab = document.getElementById('av_tabLogin');
  const sTab = document.getElementById('av_tabSignup');
  const lForm = document.getElementById('av_loginForm');
  const sForm = document.getElementById('av_signupForm');
  const err = document.getElementById('av_authErr');
  const ok = document.getElementById('av_authOk');

  if (err) err.style.display = 'none';
  if (ok) ok.style.display = 'none';

  if (tab === 'login') {
    lTab.style.background = 'var(--accent)';
    lTab.style.color = '#fff';
    sTab.style.background = 'transparent';
    sTab.style.color = 'var(--text2)';
    lForm.style.display = 'block';
    sForm.style.display = 'none';
  } else {
    sTab.style.background = 'var(--accent)';
    sTab.style.color = '#fff';
    lTab.style.background = 'transparent';
    lTab.style.color = 'var(--text2)';
    sForm.style.display = 'block';
    lForm.style.display = 'none';
  }
}

function avTogglePw(id, eyeId) {
  const inp = document.getElementById(id);
  const eye = document.getElementById(eyeId);
  if (!inp || !eye) return;
  const isPw = inp.type === 'password';
  inp.type = isPw ? 'text' : 'password';
  eye.className = isPw ? 'fas fa-eye-slash' : 'fas fa-eye';
}

async function avDoLogin() {
  const email = document.getElementById('av_email').value.trim();
  const pw = document.getElementById('av_pw').value;
  const err = document.getElementById('av_authErr');
  const ok = document.getElementById('av_authOk');

  if (!email || !pw) {
    if (err) { err.textContent = 'Please fill all fields.'; err.style.display = 'block'; }
    return;
  }

  try {
    const res = await auth.signInWithEmailAndPassword(email, pw);
    if (!res.user.emailVerified) {
      await auth.signOut();
      if (err) {
        err.innerHTML = `Please verify your email first.<br><a href="#" onclick="avResend('${email}')" style="color:#fff;font-weight:700">Resend Link</a>`;
        err.style.display = 'block';
      }
      return;
    }
    closeAuthModal();
  } catch(e) {
    if (err) { err.textContent = e.message; err.style.display = 'block'; }
  }
}

async function avDoSignup() {
  const name = document.getElementById('av_name').value.trim();
  const email = document.getElementById('av_semail').value.trim();
  const pw = document.getElementById('av_spw').value;
  const pw2 = document.getElementById('av_spw2').value;
  const err = document.getElementById('av_authErr');
  const ok = document.getElementById('av_authOk');

  if (!name || !email || !pw || !pw2) {
    if (err) { err.textContent = 'Please fill all fields.'; err.style.display = 'block'; }
    return;
  }
  if (pw !== pw2) {
    if (err) { err.textContent = 'Passwords do not match.'; err.style.display = 'block'; }
    return;
  }

  try {
    const res = await auth.createUserWithEmailAndPassword(email, pw);
    await res.user.updateProfile({ displayName: name });
    await res.user.sendEmailVerification();
    await auth.signOut();
    if (ok) {
      ok.textContent = 'Verification email sent! Please check your inbox.';
      ok.style.display = 'block';
    }
    if (err) err.style.display = 'none';
  } catch(e) {
    if (err) { err.textContent = e.message; err.style.display = 'block'; }
  }
}

async function avForgotPw() {
  const email = document.getElementById('av_email').value.trim();
  const err = document.getElementById('av_authErr');
  const ok = document.getElementById('av_authOk');
  if (!email) {
    if (err) { err.textContent = 'Enter your email in the login box first.'; err.style.display = 'block'; }
    return;
  }
  try {
    await auth.sendPasswordResetEmail(email);
    if (ok) { ok.textContent = 'Reset link sent to your email!'; ok.style.display = 'block'; }
    if (err) err.style.display = 'none';
  } catch(e) {
    if (err) { err.textContent = e.message; err.style.display = 'block'; }
  }
}

async function avResend(email) {
  const err = document.getElementById('av_authErr');
  const ok = document.getElementById('av_authOk');
  try {
    if (err) { err.textContent = 'Redirecting to verification...'; }
  } catch(e) {}
}

async function updateAuthUI(user) {
  const profileBtn = document.getElementById('profileBtn');
  let name = user.displayName || 'User';
  let email = user.email;
  let avatar = user.photoURL;

  try {
    const doc = await db.collection('users').doc(user.uid).get();
    const data = doc.data() || {};
    if (data.name)     name   = data.name;
    if (data.photoURL) avatar = data.photoURL;
  } catch(e) {}
  const initial = name.charAt(0).toUpperCase();
  if (profileBtn) {
    profileBtn.innerHTML = '';
    profileBtn.style.cssText = `
      width:36px;height:36px;border-radius:50%;
      overflow:hidden;padding:0;border:2px solid var(--accent);
      cursor:pointer;display:flex;align-items:center;
      justify-content:center;background:var(--accent);flex-shrink:0;`;
    if (avatar) {
      const img = document.createElement('img');
      img.src = avatar;
      img.style.cssText = 'width:100%;height:100%;object-fit:cover';
      img.onerror = () => {
        profileBtn.innerHTML = `<span style="font-size:15px;font-weight:700;color:#fff">${initial}</span>`;
      };
      profileBtn.appendChild(img);
    } else {
      profileBtn.innerHTML = `<span style="font-size:15px;font-weight:700;color:#fff">${initial}</span>`;
    }
    profileBtn.onclick = () => { window.location.href = 'profile.html'; };
  }
  updateSidebarProfile({ name, avatar, initial, email });
  const loginBtn  = document.getElementById('sidebarLoginBtn');
  const logoutBtn = document.getElementById('sidebarLogoutBtn');
  if (loginBtn)  loginBtn.style.display  = 'none';
  if (logoutBtn) logoutBtn.style.display = 'flex';
  const adminSec    = document.getElementById('adminSidebarSection');
  const ADMIN_EMAIL = 'rejaakif202@gmail.com';
  if (adminSec) adminSec.style.display = (email === ADMIN_EMAIL) ? 'block' : 'none';
}

function setProfileBtnAnon() {
  const profileBtn = document.getElementById('profileBtn');
  if (!profileBtn) return;
  profileBtn.innerHTML = '';
  profileBtn.style.cssText = `
    width:36px;height:36px;border-radius:50%;
    overflow:hidden;padding:0;border:none;
    cursor:pointer;display:flex;align-items:center;
    justify-content:center;background:var(--bg3);flex-shrink:0;`;
  profileBtn.innerHTML = '<i class="fas fa-user" style="color:var(--text2);font-size:15px"></i>';
  profileBtn.onclick = () => openAuthModal();
}

function updateSidebarProfile(userData) {
  const nameEl   = document.getElementById('sidebarUserName');
  const emailEl  = document.getElementById('sidebarUserEmail');
  const avatarEl = document.getElementById('sidebarAvatar');
  if (!userData) {
    if (nameEl)   nameEl.textContent  = 'Guest';
    if (emailEl)  emailEl.textContent = 'Login to save progress';
    if (avatarEl) avatarEl.innerHTML  =
      '<i class="fas fa-user" style="font-size:20px;color:#fff"></i>';
    return;
  }
  const { name, avatar, initial, email } = userData;
  if (nameEl)  nameEl.textContent  = name;
  if (emailEl) emailEl.textContent = email || '';
  if (avatarEl) {
    avatarEl.innerHTML = avatar
      ? `<img src="${avatar}"
           style="width:100%;height:100%;border-radius:50%;object-fit:cover"
           onerror="this.parentElement.innerHTML='<span style=\\'font-size:22px;font-weight:700;color:#fff\\'>${initial}</span>'"/>`
      : `<span style="font-size:22px;font-weight:700;color:#fff">${initial}</span>`;
  }
}

// ===== LOGOUT =====
async function logoutUser() {
  await auth.signOut();
  currentUser = null;
  window.location.reload();
}

// ===== MY LIST =====
async function toggleMyList(id, btnEl) {
  id = String(id);
  if (!currentUser) { openAuthModal(); return; }
  try {
    const ref = db.collection('users').doc(currentUser.uid);
    const doc = await ref.get();
    let list  = doc.exists ? (doc.data().watchlist||[]).map(String) : [];
    if (list.includes(id)) {
      list = list.filter(x => x !== id);
      if (btnEl) btnEl.classList.remove('saved');
    } else {
      list.push(id);
      if (btnEl) btnEl.classList.add('saved');
    }
    await ref.set({ watchlist: list }, { merge: true });
  } catch(e) { console.error('Watchlist error:', e); }
}

async function handleWishlistToggle(id, btnEl) {
  if (!currentUser) { openAuthModal(); return; }
  await toggleMyList(id, btnEl);
}

// ===== RENDER CARD =====
function renderCard(anime, isScroll = false) {
  const div = document.createElement('div');
  div.className    = 'card';
  div.style.cursor = 'pointer';
  const genres = (anime.genre||[]).slice(0,2).map(g =>
    `<span class="genre-tag" style="font-size:10px;padding:3px 8px">${g}</span>`
  ).join('');

  const imgSrc = anime.banner || anime.thumbnail || '';
  div.innerHTML = `
    <div style="position:relative">
      <img class="card-thumb"
        src="${imgSrc}" alt="${anime.title}"
        onerror="this.src='https://via.placeholder.com/400x250?text=No+Image'"/>
      <button class="wishlist-btn" id="wl-${anime.firestoreId}"
        onclick="event.stopPropagation();handleWishlistToggle('${anime.firestoreId}',this)">
        <i class="fas fa-heart"></i>
      </button>
    </div>
    <div class="card-info">
      <span class="card-badge">${(anime.type||'ANIME').toUpperCase()}</span>
      <div class="card-title">${anime.title}</div>
      <div class="card-meta">
        <span class="card-rating">
          <i class="fas fa-star"></i> ${anime.rating||'N/A'}
        </span>
        <span class="card-year">${anime.year||''}</span>
      </div>
      <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:4px">
        ${genres}
      </div>
    </div>`;
  div.addEventListener('click', () => {
    window.location.href = `anime.html?id=${anime.firestoreId}`;
  });
  return div;
}

// ===== RENDER NEWS CARD =====
function renderNewsCard(anime) {
  const div = document.createElement('div');
  div.className    = 'news-card';
  div.style.cursor = 'pointer';
  const desc = anime.description || anime.desc || '';
  div.innerHTML = `
    <img class="news-thumb"
      src="${anime.thumbnail||''}" alt="${anime.title}"
      onerror="this.style.background='var(--bg3)'"/>
    <div class="news-info">
      <div class="news-title">${anime.title}</div>
      ${desc ? `<div class="news-desc">${desc.slice(0,150)}${desc.length>150?'…':''}</div>` : ''}
    </div>`;
  div.addEventListener('click', () => {
    window.location.href = `anime.html?id=${anime.firestoreId}`;
  });
  return div;
}

// ===== initApp — kept for compatibility but no longer the main loader =====
async function initApp() {
  // Content is already loaded by the instant loader above.
  // This function is kept so nothing breaks if called elsewhere.
  if (_contentLoaded && allAnimeData.length > 0) {
    renderHome(allAnimeData);
    checkCategoryNotifications(allAnimeData);
  }
  initSidebar();
}

// ===================================================================
// ===== PAGINATION ENGINE ===========================================
// ===================================================================

function renderPaginatedView(items, page, gridId, label) {
  const total      = items.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safeP      = Math.min(Math.max(1, page), totalPages);
  const start      = (safeP - 1) * PAGE_SIZE;
  const end        = Math.min(start + PAGE_SIZE, total);
  const slice      = items.slice(start, end);

  const grid = document.getElementById(gridId);
  if (!grid) return;
  grid.innerHTML = '';
  if (!slice.length) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;
      padding:40px;color:var(--text2);font-size:13px">No content here yet.</div>`;
  } else {
    slice.forEach(a => grid.appendChild(renderCard(a, false)));
  }

  const titleEl = document.getElementById('pageSectionTitle');
  if (titleEl && label) titleEl.textContent = label;
  renderPageButtons(safeP, totalPages);
}

function renderPageButtons(current, total) {
  const wrap = document.getElementById('paginationWrap');
  if (!wrap) return;
  wrap.innerHTML = '';
  if (total <= 1) return;

  const container = document.createElement('div');
  container.style.cssText = `
    display:flex; align-items:center; justify-content:center;
    gap:7px; flex-wrap:wrap; padding:16px 0 8px;`;

  const pages = buildPageList(current, total);

  pages.forEach(p => {
    if (p === '...') {
      const dot = document.createElement('span');
      dot.textContent = '···';
      dot.style.cssText = `
        font-size:14px; color:var(--text2); font-weight:700;
        padding:0 4px; font-family:'Poppins',sans-serif;`;
      container.appendChild(dot);
    } else {
      const btn = document.createElement('button');
      const isActive = p === current;
      btn.textContent = String(p);
      btn.style.cssText = `
        min-width:40px; height:40px; padding:0 8px;
        border-radius:8px;
        background:${isActive ? 'var(--accent)' : 'var(--card-bg)'};
        color:${isActive ? '#fff' : 'var(--text2)'};
        border:1.5px solid ${isActive ? 'var(--accent)' : 'var(--border)'};
        font-family:'Poppins',sans-serif; font-size:13px; font-weight:800;
        cursor:${isActive ? 'default' : 'pointer'};
        transition:all 0.15s;
        box-shadow:${isActive
          ? '0 4px 0 rgba(100,80,200,0.4),0 6px 14px rgba(0,0,0,0.2)'
          : '0 3px 0 var(--btn-3d),0 4px 10px rgba(0,0,0,0.12)'};
        outline:none;`;
      if (!isActive) {
        btn.onmouseover = () => {
          btn.style.borderColor = 'var(--accent)';
          btn.style.color       = 'var(--accent)';
          btn.style.transform   = 'translateY(-1px)';
        };
        btn.onmouseout = () => {
          btn.style.borderColor = 'var(--border)';
          btn.style.color       = 'var(--text2)';
          btn.style.transform   = '';
        };
        btn.onmousedown = () => { btn.style.transform = 'translateY(2px)'; };
        btn.onmouseup   = () => { btn.style.transform = ''; };
        btn.onclick     = () => goToPage(p);
      }
      container.appendChild(btn);
    }
  });

  wrap.appendChild(container);
}

function buildPageList(current, total) {
  if (total <= 7) return Array.from({length: total}, (_,i) => i+1);
  if (current <= 6) {
    return [1,2,3,4,5,6,7,'...',total];
  }
  if (current >= total - 4) {
    return [1,'...',total-6,total-5,total-4,total-3,total-2,total-1,total];
  }
  return [1,'...',current-1,current,current+1,'...',total];
}

function goToPage(page) {
  currentPage = page;
  const homeSecs    = document.getElementById('homeSections');
  const catSec      = document.getElementById('pageCategorySection');
  const myListSec   = document.getElementById('myListSection');
  if (myListSec)  myListSec.classList.add('hidden');
  if (homeSecs)   homeSecs.style.display    = 'none';
  if (catSec)     catSec.style.display      = 'block';

  const cat   = currentCategory;
  const label = getCategoryLabel(cat);
  const items = getFilteredItems(cat);
  renderPaginatedView(items, currentPage, 'pageCategoryGrid', label);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function getCategoryLabel(cat) {
  const map = { all:'All Anime', anime:'Anime', movie:'Movies',
                series:'Series', news:'News' };
  return map[cat] || cat.charAt(0).toUpperCase() + cat.slice(1);
}

function getFilteredItems(cat) {
  if (cat === 'all') return allAnimeData;
  return allAnimeData.filter(a => a.type === cat);
}

// ===== RENDER HOME =====
const sectionPages = { top10: 1, latest: 1, trending: 1 };
const SECTION_LIMITS = { top10: 10, latest: 10, trending: 10 };

function renderSectionPage(section, allItems) {
  const limit    = SECTION_LIMITS[section];
  const gridId   = section + 'Grid';
  const page     = sectionPages[section];
  const total    = allItems.length;
  const totalPgs = Math.ceil(total / limit);
  const start    = (page - 1) * limit;
  const slice    = allItems.slice(start, start + limit);

  const grid = document.getElementById(gridId);
  if (!grid) return;
  grid.innerHTML = '';
  slice.forEach(a => grid.appendChild(renderCard(a, false)));

  const inlineWrap = document.getElementById(section + 'Pagination');
  if (inlineWrap) inlineWrap.innerHTML = '';

  const wrap = document.getElementById('paginationWrap');
  if (!wrap) return;
  wrap.innerHTML = '';
  if (totalPgs <= 1) return;

  const container = document.createElement('div');
  container.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:6px;flex-wrap:wrap;padding:12px 0 4px';

  for (let p = 1; p <= totalPgs; p++) {
    const btn = document.createElement('button');
    const isActive = p === page;
    btn.textContent = String(p);
    btn.style.cssText = `
      min-width:36px;height:36px;padding:0 6px;border-radius:8px;
      background:${isActive ? 'var(--accent)' : 'var(--card-bg)'};
      color:${isActive ? '#fff' : 'var(--text2)'};
      border:1.5px solid ${isActive ? 'var(--accent)' : 'var(--border)'};
      font-family:'Poppins',sans-serif;font-size:12px;font-weight:800;
      cursor:${isActive ? 'default' : 'pointer'};transition:all 0.15s;outline:none;
      box-shadow:${isActive ? '0 3px 0 rgba(100,80,200,0.4)' : '0 2px 0 var(--btn-3d)'};`;
    if (!isActive) {
      btn.onclick = () => {
        sectionPages[section] = p;
        renderSectionPage(section, allItems);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      };
    }
    container.appendChild(btn);
  }
  wrap.appendChild(container);
}

function renderHome(data) {
  currentPage = 1;
  sectionPages.top10    = 1;
  sectionPages.latest   = 1;
  sectionPages.trending = 1;

  const pw = document.getElementById('paginationWrap');
  if (pw) pw.innerHTML = '';

  const usedIds = new Set();

  const top10All = data.filter(a => a.top10 && a.type !== 'news')
    .sort((a,b) => (b.top10AddedAt||0) - (a.top10AddedAt||0));
  top10All.forEach(a => usedIds.add(a.firestoreId));

  const latestAll = data.filter(a => a.latest && a.type !== 'news' && !usedIds.has(a.firestoreId))
    .sort((a,b) => {
      const ta = a.createdAt?.toDate?.()?.getTime() || 0;
      const tb = b.createdAt?.toDate?.()?.getTime() || 0;
      return tb - ta;
    });
  latestAll.forEach(a => usedIds.add(a.firestoreId));

  const trendingAll = data.filter(a => a.trending && a.type !== 'news' && !usedIds.has(a.firestoreId));
  const news = data.filter(a => a.type === 'news');

  const latestSec   = document.getElementById('latestSection');
  const trendingSec = document.getElementById('trendingSection');
  const top10Sec    = document.getElementById('top10Section');
  const emptyState  = document.getElementById('emptyState');
  const homeSecs    = document.getElementById('homeSections');
  const myListSec   = document.getElementById('myListSection');
  const catSec      = document.getElementById('pageCategorySection');
  const searchSec   = document.getElementById('searchSection');

  if (myListSec) myListSec.classList.add('hidden');
  if (catSec)    catSec.style.display    = 'none';
  if (homeSecs)  homeSecs.style.display  = 'block';
  if (searchSec) searchSec.classList.add('hidden');

  if (data.length === 0) {
    if (emptyState)   emptyState.classList.remove('hidden');
    if (latestSec)    latestSec.classList.add('hidden');
    if (trendingSec)  trendingSec.classList.add('hidden');
    if (top10Sec)     top10Sec.classList.add('hidden');
    return;
  }
  if (emptyState) emptyState.classList.add('hidden');

  if (top10Sec)    top10Sec.classList.toggle('hidden',    !top10All.length);
  if (latestSec)   latestSec.classList.toggle('hidden',   !latestAll.length);
  if (trendingSec) trendingSec.classList.toggle('hidden', !trendingAll.length);

  renderGrid('top10Grid',    top10All.slice(0, 10), 'No top 10 yet.');
  renderSectionPage('latest', latestAll);
  renderGrid('trendingGrid', trendingAll.slice(0, 10), 'No trending anime yet.');
  renderNewsSection(news);
}

function renderGrid(gridId, items, emptyMsg) {
  const grid = document.getElementById(gridId);
  if (!grid) return;
  grid.innerHTML = '';
  if (!items.length) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;
      padding:30px;color:var(--text2);font-size:13px">${emptyMsg}</div>`;
    return;
  }
  const isScroll = grid.classList.contains('scroll-row');
  items.forEach(a => grid.appendChild(renderCard(a, isScroll)));
}

function renderNewsSection(items) {
  const sec  = document.getElementById('newsSection');
  const grid = document.getElementById('newsGrid');
  if (!sec || !grid) return;
  if (!items.length) { sec.classList.add('hidden'); return; }
  sec.classList.remove('hidden');
  grid.innerHTML = '';
  items.slice(0, SECTION_SIZE).forEach(a => grid.appendChild(renderNewsCard(a)));
}

// ===== FILTER CATEGORY =====
function goHome(btnEl) {
  currentCategory = 'home';
  currentPage     = 1;
  document.querySelectorAll('.cat-pill,.pill').forEach(b => b.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');
  const pw = document.getElementById('paginationWrap');
  if (pw) pw.innerHTML = '';
  const homeSecs  = document.getElementById('homeSections');
  const catSec    = document.getElementById('pageCategorySection');
  const searchSec = document.getElementById('searchSection');
  const myListSec = document.getElementById('myListSection');
  if (homeSecs)   homeSecs.style.display = 'block';
  if (catSec)     catSec.style.display   = 'none';
  if (searchSec)  searchSec.classList.add('hidden');
  if (myListSec)  myListSec.classList.add('hidden');
  renderHome(allAnimeData);
}

// ===== CATEGORY NOTIFICATION DOTS =====
const NOTIF_CATS = ['anime', 'movie', 'news', 'series'];

function checkCategoryNotifications(data) {
  NOTIF_CATS.forEach(cat => {
    const storageKey = `av_seen_${cat}`;
    const lastSeen   = parseInt(localStorage.getItem(storageKey) || '0');
    const items = data.filter(a => (a.type || '').toLowerCase() === cat);
    const newestTs = items.reduce((max, a) => {
      const t = a.createdAt?.toDate?.()?.getTime?.() || a.top10AddedAt || 0;
      return t > max ? t : max;
    }, 0);
    const dot = document.getElementById('dot-' + cat);
    if (dot) {
      if (newestTs > lastSeen) {
        dot.classList.add('show');
      } else {
        dot.classList.remove('show');
      }
    }
  });
}

function clearCategoryDot(cat) {
  const dot = document.getElementById('dot-' + cat);
  if (dot) dot.classList.remove('show');
  const items = allAnimeData.filter(a => (a.type || '').toLowerCase() === cat);
  const newestTs = items.reduce((max, a) => {
    const t = a.createdAt?.toDate?.()?.getTime?.() || a.top10AddedAt || 0;
    return t > max ? t : max;
  }, Date.now());
  localStorage.setItem('av_seen_' + cat, String(newestTs));
}

function filterCategory(cat, btnEl) {
  currentCategory = cat;
  currentPage     = 1;
  document.querySelectorAll('.cat-pill,.pill').forEach(b => b.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');
  if (NOTIF_CATS.includes(cat)) clearCategoryDot(cat);

  const myListSec = document.getElementById('myListSection');
  if (myListSec) myListSec.classList.add('hidden');

  if (cat === 'all') {
    const homeSecs = document.getElementById('homeSections');
    const catSec   = document.getElementById('pageCategorySection');
    const searchSec = document.getElementById('searchSection');
    if (homeSecs)  homeSecs.style.display = 'block';
    if (catSec)    catSec.style.display   = 'none';
    if (searchSec) searchSec.classList.add('hidden');
    renderHome(allAnimeData);
  } else {
    const homeSecs = document.getElementById('homeSections');
    const catSec   = document.getElementById('pageCategorySection');
    if (homeSecs) homeSecs.style.display = 'none';
    if (catSec)   catSec.style.display   = 'block';
    const items = getFilteredItems(cat);
    renderPaginatedView(items, 1, 'pageCategoryGrid', getCategoryLabel(cat));
  }
}

// ===== SEARCH =====
let searchActive = false;

function toggleSearch() {
  const bar = document.getElementById('searchBar');
  const inp = document.getElementById('searchInput');
  if (!bar) return;
  searchActive = !searchActive;
  bar.classList.toggle('open', searchActive);
  if (searchActive && inp) inp.focus();
  else if (inp) { inp.value = ''; renderHome(allAnimeData); }
}

function closeSearch() {
  searchActive = false;
  const bar = document.getElementById('searchBar');
  const inp = document.getElementById('searchInput');
  if (bar) bar.classList.remove('open');
  if (inp) inp.value = '';
  renderHome(allAnimeData);
}

function searchAnime(q) {
  const pw = document.getElementById('paginationWrap');
  if (pw) pw.innerHTML = '';

  if (!q.trim()) { renderHome(allAnimeData); return; }
  const r = allAnimeData.filter(a =>
    a.title.toLowerCase().includes(q.toLowerCase()) ||
    (a.genre||[]).some(g => g.toLowerCase().includes(q.toLowerCase()))
  );

  const sec1 = document.getElementById('trendingSection');
  const sec2 = document.getElementById('top10Section');
  const sec3 = document.getElementById('latestSection');
  const searchSec = document.getElementById('searchSection');
  const catSec = document.getElementById('pageCategorySection');
  const homeSecs = document.getElementById('homeSections');
  if (catSec)   catSec.style.display = 'none';
  if (homeSecs) homeSecs.style.display = 'block';
  if (sec1) sec1.classList.add('hidden');
  if (sec2) sec2.classList.add('hidden');
  if (sec3) sec3.classList.add('hidden');
  if (searchSec) searchSec.classList.remove('hidden');
  renderGrid('searchGrid', r, 'No results found.');
}

// ===== SIDEBAR =====
function initSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('overlay');

  window.toggleSidebar = () => {
    if (!sidebar) return;
    sidebar.classList.toggle('open');
    if (overlay) overlay.classList.toggle('active');
  };
  window.closeSidebar = () => {
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('active');
  };

  if (overlay) overlay.addEventListener('click', window.closeSidebar);

  const pfSec = document.getElementById('sidebarProfileSection');
  if (pfSec) {
    pfSec.onclick = () => {
      window.closeSidebar();
      if (currentUser) window.location.href = 'profile.html';
      else openAuthModal();
    };
  }
}

// ===== MY LIST =====
function showMyList() {
  if (!currentUser) { openAuthModal(); return; }
  const myListSec  = document.getElementById('myListSection');
  const homeSecs   = document.getElementById('homeSections');
  const catSec     = document.getElementById('pageCategorySection');
  if (myListSec) myListSec.classList.remove('hidden');
  if (homeSecs)  homeSecs.style.display = 'none';
  if (catSec)    catSec.style.display   = 'none';
  const pw = document.getElementById('paginationWrap');
  if (pw) pw.innerHTML = '';

  const grid  = document.getElementById('myListGrid');
  const empty = document.getElementById('myListEmpty');
  db.collection('users').doc(currentUser.uid).get().then(doc => {
    const ids   = doc.exists ? (doc.data().watchlist||[]) : [];
    const items = allAnimeData.filter(a =>
      ids.map(String).includes(String(a.firestoreId))
    );
    if (!items.length) {
      if (grid)  grid.innerHTML = '';
      if (empty) empty.style.display = 'flex';
      return;
    }
    if (empty) empty.style.display = 'none';
    if (grid) {
      grid.innerHTML = '';
      items.forEach(a => grid.appendChild(renderCard(a)));
    }
  }).catch(e => console.error(e));
}

function scrollTrending() {
  const sec = document.getElementById('trendingSection') ||
              document.getElementById('trendingAnchor');
  if (sec) sec.scrollIntoView({ behavior: 'smooth' });
}

// ===== GLOBAL EXPORTS =====
window.toggleTheme                = toggleTheme;
window.filterCategory             = filterCategory;
window.checkCategoryNotifications = checkCategoryNotifications;
window.clearCategoryDot           = clearCategoryDot;
window.goHome                     = goHome;
window.scrollTrending             = scrollTrending;
window.showMyList                 = showMyList;
window.logoutUser                 = logoutUser;
window.openAuthModal              = openAuthModal;
window.closeAuthModal             = closeAuthModal;
window.handleWishlistToggle       = handleWishlistToggle;
window.toggleSearch               = toggleSearch;
window.closeSearch                = closeSearch;
window.searchAnime                = searchAnime;
window.goToPage                   = goToPage;
window.avSwitchTab                = avSwitchTab;
window.avDoLogin                  = avDoLogin;
window.avDoSignup                 = avDoSignup;
window.avForgotPw                 = avForgotPw;
window.avTogglePw                 = avTogglePw;
window.avResend                   = avResend;
