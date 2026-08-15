/* ============ Connexion à Supabase ============ */
const SUPABASE_URL = "https://jzswpovhenarwogdxkgo.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_pECo8A3VPWAYauo0tGHqHA_NRhMSUqP";
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;

let catalogCategories = [];
let catalogSubcategories = [];
let catalogTasks = [];
let userTaskPreferences = [];
let taskHistory = [];

let current = null;
let timerInterval = null;

/* ============ Helpers ============ */
function now() { return new Date(); }

function normalizeId(v) {
  return v === null || v === undefined ? "" : String(v);
}

function toast(message, type = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return;
  const t = document.createElement("div");
  t.className = "toast" + (type === "success" ? " toast-success" : type === "error" ? " toast-error" : "");
  t.textContent = message;
  container.appendChild(t);
  setTimeout(() => t.remove(), 2500);
}

function setVisible(el, visible) {
  if (!el) return;
  el.classList.toggle("hidden", !visible);
}

function clearSelect(select, placeholder) {
  select.innerHTML = "";
  const opt = document.createElement("option");
  opt.value = "";
  opt.textContent = placeholder;
  select.appendChild(opt);
}

function formatDate(ts) {
  return new Date(ts).toLocaleString("fr-CA");
}

function formatMinutes(seconds) {
  return Math.max(1, Math.round((seconds || 0) / 60));
}

/* ============ UI refs ============ */
const els = {
  authLoggedOut: document.getElementById("auth-logged-out"),
  authLoggedIn: document.getElementById("auth-logged-in"),
  authEmailOtp: document.getElementById("auth-email-otp"),
  authSendBtn: document.getElementById("auth-send-btn"),
  authOtpStatus: document.getElementById("auth-otp-status"),
  authUserEmail: document.getElementById("auth-user-email"),
  authLogoutBtn: document.getElementById("auth-logout-btn"),

  appContent: document.getElementById("app-content"),
  tabFocusBtn: document.getElementById("tab-focus-btn"),
  tabHistoryBtn: document.getElementById("tab-history-btn"),

  focusView: document.getElementById("focus-view"),
  historyView: document.getElementById("history-view"),

  categorySelect: document.getElementById("category-select"),
  taskSelect: document.getElementById("task-select"),
  stepSelect: document.getElementById("step-select"), // = sous-catégorie
  timerMinutes: document.getElementById("timer-minutes"),
  startSessionBtn: document.getElementById("start-session-btn"),

  currentCard: document.getElementById("current-step"),
  currentText: document.getElementById("current-step-text"),
  timerDisplay: document.getElementById("timer"),
  pauseTimerBtn: document.getElementById("pause-timer-btn"),
  resumeTimerBtn: document.getElementById("resume-timer-btn"),
  markDoneBtn: document.getElementById("mark-done-btn"),

  historyList: document.getElementById("history-list"),
};

/* ============ Auth ============ */
async function sendMagicLink() {
  const email = els.authEmailOtp.value.trim();
  if (!email) {
    els.authOtpStatus.textContent = "Entre ton courriel d'abord.";
    els.authOtpStatus.classList.remove("hidden");
    return;
  }

  els.authSendBtn.disabled = true;
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: "https://faiskifo.avecjoie.ca/",
      redirectTo: "https://faiskifo.avecjoie.ca/"
    }
  });
  els.authSendBtn.disabled = false;

  if (error) {
    els.authOtpStatus.textContent = "Erreur : " + error.message;
    els.authOtpStatus.classList.remove("hidden");
    return;
  }

  els.authOtpStatus.textContent = "Lien magique envoyé. Vérifie ta boîte courriel.";
  els.authOtpStatus.classList.remove("hidden");
}

async function logout() {
  await sb.auth.signOut();
  currentUser = null;
  showLoggedOut();
}

function showLoggedOut() {
  setVisible(els.authLoggedOut, true);
  setVisible(els.authLoggedIn, false);
  setVisible(els.appContent, false);
}

async function showLoggedIn(user) {
  currentUser = user;
  els.authUserEmail.textContent = user.email || "";
  setVisible(els.authLoggedOut, false);
  setVisible(els.authLoggedIn, true);
  setVisible(els.appContent, true);
  await loadAllData();
  showTab("focus");
}

sb.auth.onAuthStateChange((_event, session) => {
  if (session?.user) showLoggedIn(session.user);
  else showLoggedOut();
});

sb.auth.getSession().then(({ data }) => {
  if (data?.session?.user) showLoggedIn(data.session.user);
  else showLoggedOut();
});

/* ============ Data loading ============ */
async function loadAllData() {
  const [catsRes, subcatsRes, tasksRes, prefsRes, histRes] = await Promise.all([
    sb.from("categories").select("id, name, icon, sort_order").order("sort_order").order("name"),
    sb.from("subcategories").select("id, category_id, name, sort_order").order("sort_order").order("name"),
    sb.from("tasks").select("id, category_id, subcategory_id, name, description, duration_minutes, sort_order").order("sort_order").order("name"),
    sb.from("user_task_preferences")
      .select("id, task_id, preferred_minutes, pinned, notes, updated_at")
      .eq("user_id", currentUser.id),
    sb.from("task_history")
      .select("id, task_id, subcategory_id, completed_at, duration_minutes, note")
      .eq("user_id", currentUser.id)
      .order("completed_at", { ascending: false })
  ]);

  if (catsRes.error || subcatsRes.error || tasksRes.error || prefsRes.error || histRes.error) {
    const err = catsRes.error || subcatsRes.error || tasksRes.error || prefsRes.error || histRes.error;
    toast("Impossible de charger les données : " + err.message, "error");
    return;
  }

  catalogCategories = catsRes.data || [];
  catalogSubcategories = subcatsRes.data || [];
  catalogTasks = tasksRes.data || [];
  userTaskPreferences = prefsRes.data || [];
  taskHistory = histRes.data || [];

  renderCategoryOptions();
  renderHistory();
  renderCurrent();
}

/* ============ Render ============ */
function renderCategoryOptions() {
  clearSelect(els.categorySelect, "Choisis une catégorie");
  catalogCategories.forEach(cat => {
    const opt = document.createElement("option");
    opt.value = normalizeId(cat.id);
    opt.textContent = (cat.icon ? cat.icon + " " : "") + cat.name;
    els.categorySelect.appendChild(opt);
  });

  clearSelect(els.stepSelect, "Choisis une sous-catégorie");
  els.stepSelect.disabled = true;

  clearSelect(els.taskSelect, "Choisis une tâche");
  els.taskSelect.disabled = true;
}

// Étape 1 : catégorie choisie -> peupler les sous-catégories
function renderStepOptions() {
  const catId = els.categorySelect.value;
  clearSelect(els.stepSelect, "Choisis une sous-catégorie");
  clearSelect(els.taskSelect, "Choisis une tâche");
  els.taskSelect.disabled = true;

  if (!catId) {
    els.stepSelect.disabled = true;
    return;
  }

  const subcats = catalogSubcategories.filter(s => normalizeId(s.category_id) === normalizeId(catId));
  subcats.forEach(subcat => {
    const opt = document.createElement("option");
    opt.value = normalizeId(subcat.id);
    opt.textContent = subcat.name;
    els.stepSelect.appendChild(opt);
  });

  els.stepSelect.disabled = subcats.length === 0;
}

// Étape 2 : sous-catégorie choisie -> peupler les tâches (filtrées par catégorie ET sous-catégorie)
function renderTaskOptions() {
  const catId = els.categorySelect.value;
  const subcatId = els.stepSelect.value;
  clearSelect(els.taskSelect, "Choisis une tâche");

  if (!catId || !subcatId) {
    els.taskSelect.disabled = true;
    return;
  }

  const tasks = catalogTasks.filter(t =>
    normalizeId(t.category_id) === normalizeId(catId) &&
    normalizeId(t.subcategory_id) === normalizeId(subcatId)
  );
  tasks.forEach(task => {
    const opt = document.createElement("option");
    opt.value = normalizeId(task.id);
    opt.textContent = task.name;
    els.taskSelect.appendChild(opt);
  });

  els.taskSelect.disabled = tasks.length === 0;
}

function renderHistory() {
  if (!els.historyList) return;
  els.historyList.innerHTML = "";

  if (!taskHistory.length) {
    els.historyList.innerHTML = "<p>Aucun historique pour l'instant.</p>";
    return;
  }

  taskHistory.forEach(item => {
    const task = catalogTasks.find(t => normalizeId(t.id) === normalizeId(item.task_id));
    const subcat = catalogSubcategories.find(s => normalizeId(s.id) === normalizeId(item.subcategory_id));
    const div = document.createElement("div");
    div.className = "history-item";
    div.innerHTML = `
      <div>
        <strong>${formatDate(item.completed_at)}</strong>
        <div>${task?.name || "Tâche"}${subcat ? " — " + subcat.name : ""}</div>
        ${item.note ? `<div>${item.note}</div>` : ""}
      </div>
      <div>${item.duration_minutes || 0} min</div>
    `;
    els.historyList.appendChild(div);
  });
}

function renderCurrent() {
  if (!current) {
    setVisible(els.currentCard, false);
    return;
  }

  setVisible(els.currentCard, true);

  const cat = catalogCategories.find(c => normalizeId(c.id) === normalizeId(current.categoryId));
  const task = catalogTasks.find(t => normalizeId(t.id) === normalizeId(current.taskId));
  const subcat = catalogSubcategories.find(s => normalizeId(s.id) === normalizeId(current.subcategoryId));

  els.currentText.textContent = `${cat?.name || ""} — ${subcat?.name || ""} — ${task?.name || ""}`.replace(/ — $/, "").replace(/^ — /, "");

  const mm = Math.floor(current.remainingSeconds / 60);
  const ss = current.remainingSeconds % 60;
  els.timerDisplay.textContent = `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;

  els.pauseTimerBtn.disabled = !current.running;
  els.resumeTimerBtn.disabled = current.running;
}

function showTab(tab) {
  const focus = tab === "focus";
  setVisible(els.focusView, focus);
  setVisible(els.historyView, !focus);
  els.tabFocusBtn.classList.toggle("tab-active", focus);
  els.tabHistoryBtn.classList.toggle("tab-active", !focus);
}

/* ============ Session ============ */
function startSession() {
  const categoryId = els.categorySelect.value;
  const subcategoryId = els.stepSelect.value;
  const taskId = els.taskSelect.value;
  const minutes = parseInt(els.timerMinutes.value, 10);

  if (!categoryId || !subcategoryId || !taskId) {
    toast("Choisis une catégorie, une sous-catégorie et une tâche.", "error");
    return;
  }
  if (!minutes || minutes <= 0) {
    toast("Indique un temps valide.", "error");
    return;
  }

  current = {
    categoryId,
    subcategoryId,
    taskId,
    plannedSeconds: minutes * 60,
    remainingSeconds: minutes * 60,
    running: false
  };

  renderCurrent();
  startTimer();
}

/* ============ Timer ============ */
function tick() {
  if (!current || !current.running) return;

  if (current.remainingSeconds > 0) {
    current.remainingSeconds--;
    renderCurrent();
  } else {
    stopTimer();
    toast("Temps écoulé !", "success");
    recordCompletion(current.plannedSeconds);
  }
}

function startTimer() {
  if (!current || current.running) return;
  current.running = true;
  timerInterval = setInterval(tick, 1000);
  renderCurrent();
}

function stopTimer() {
  if (!current) return;
  current.running = false;
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  renderCurrent();
}

async function recordCompletion(durationSeconds) {
  if (!current) return;

  const note = prompt("Ajouter une note à l'historique ?") || "";
  const durationMinutes = formatMinutes(durationSeconds);

  const { data, error } = await sb.from("task_history").insert({
    user_id: currentUser.id,
    task_id: current.taskId,
    subcategory_id: current.subcategoryId || null,
    duration_minutes: durationMinutes,
    note: note.trim() || null
  }).select().single();

  if (error) {
    toast("Erreur en sauvegardant : " + error.message, "error");
    return;
  }

  taskHistory.unshift(data || {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    task_id: current.taskId,
    subcategory_id: current.subcategoryId || null,
    completed_at: new Date().toISOString(),
    duration_minutes: durationMinutes,
    note: note.trim() || null
  });

  current = null;
  renderCurrent();
  renderHistory();

  // Réinitialise les sélecteurs pour une prochaine session
  els.categorySelect.value = "";
  renderStepOptions();
}

function markDone() {
  if (!current) return;
  const elapsed = current.plannedSeconds - current.remainingSeconds;
  stopTimer();
  recordCompletion(elapsed);
}

/* ============ Événements ============ */
els.authSendBtn?.addEventListener("click", sendMagicLink);
els.authLogoutBtn?.addEventListener("click", logout);

els.tabFocusBtn?.addEventListener("click", () => showTab("focus"));
els.tabHistoryBtn?.addEventListener("click", () => showTab("history"));

els.categorySelect?.addEventListener("change", renderStepOptions);
els.stepSelect?.addEventListener("change", renderTaskOptions);

els.startSessionBtn?.addEventListener("click", startSession);
els.pauseTimerBtn?.addEventListener("click", stopTimer);
els.resumeTimerBtn?.addEventListener("click", startTimer);
els.markDoneBtn?.addEventListener("click", markDone);
