/* ============ Connexion à Supabase ============ */
const SUPABASE_URL = "https://gnbjxvoxktxhxnkpfgtb.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_zwAIBLWPlRd4dMoCOY2UEw_d7dQfs5u";
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let catalogTasks = [];
let catalogSteps = [];
let catalogCategories = [];
let completedStepIds = [];
let historyItems = [];

let current = null;
let timerInterval = null;

/* ============ Helpers ============ */
function now() { return new Date(); }

function normalizeId(v) {
  return v === null || v === undefined ? "" : String(v);
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function toast(message, type = "info") {
  const container = document.getElementById("toast-container");
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
  stepSelect: document.getElementById("step-select"),
  timerMinutes: document.getElementById("timer-minutes"),
  startSessionBtn: document.getElementById("start-session-btn"),

  currentCard: document.getElementById("current-step"),
  currentText: document.getElementById("current-step-text"),
  timerDisplay: document.getElementById("timer"),
  pauseTimerBtn: document.getElementById("pause-timer-btn"),
  resumeTimerBtn: document.getElementById("resume-timer-btn"),
  markDoneBtn: document.getElementById("mark-done-btn"),

  historyList: document.getElementById("history-list"),

  confirmModal: document.getElementById("confirm-modal"),
  confirmModalTitle: document.getElementById("confirm-modal-title"),
  confirmModalOk: document.getElementById("confirm-modal-ok"),
  confirmModalCancel: document.getElementById("confirm-modal-cancel"),
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
    options: { emailRedirectTo: window.location.origin + window.location.pathname }
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
  const [catsRes, tasksRes, stepsRes, doneRes, histRes] = await Promise.all([
    sb.from("categories").select("id, name, icon").order("name"),
    sb.from("tasks").select("id, name, category_id, age_range").order("name"),
    sb.from("task_steps").select("id, task_id, step_order, description, duration_seconds").order("step_order"),
    sb.from("user_step_completions").select("step_id").eq("user_id", currentUser.id),
    sb.from("user_step_completions").select("completed_at, duration_seconds, step_id").eq("user_id", currentUser.id).order("completed_at", { ascending: false })
  ]);

  if (catsRes.error || tasksRes.error || stepsRes.error) {
    const err = catsRes.error || tasksRes.error || stepsRes.error;
    toast("Impossible de charger le catalogue : " + err.message, "error");
    return;
  }

  catalogCategories = catsRes.data || [];
  catalogTasks = tasksRes.data || [];
  catalogSteps = stepsRes.data || [];
  completedStepIds = (doneRes.data || []).map(d => normalizeId(d.step_id));
  historyItems = histRes.data || [];

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
  clearSelect(els.taskSelect, "Choisis une tâche");
  els.taskSelect.disabled = true;
  clearSelect(els.stepSelect, "Choisis une étape");
  els.stepSelect.disabled = true;
}

function renderTaskOptions() {
  const catId = els.categorySelect.value;
  clearSelect(els.taskSelect, "Choisis une tâche");
  clearSelect(els.stepSelect, "Choisis une étape");
  els.stepSelect.disabled = true;

  if (!catId) {
    els.taskSelect.disabled = true;
    return;
  }

  const tasks = catalogTasks.filter(t => normalizeId(t.category_id) === normalizeId(catId));
  tasks.forEach(task => {
    const opt = document.createElement("option");
    opt.value = normalizeId(task.id);
    opt.textContent = task.name;
    els.taskSelect.appendChild(opt);
  });

  els.taskSelect.disabled = tasks.length === 0;
}

function renderStepOptions() {
  const taskId = els.taskSelect.value;
  clearSelect(els.stepSelect, "Choisis une étape");

  if (!taskId) {
    els.stepSelect.disabled = true;
    return;
  }

  const steps = catalogSteps.filter(s => normalizeId(s.task_id) === normalizeId(taskId));
  steps.forEach(step => {
    const opt = document.createElement("option");
    opt.value = normalizeId(step.id);
    opt.textContent = `Étape ${step.step_order}: ${step.description}`;
    els.stepSelect.appendChild(opt);
  });

  els.stepSelect.disabled = steps.length === 0;
}

function renderHistory() {
  if (!els.historyList) return;
  els.historyList.innerHTML = "";

  if (!historyItems.length) {
    els.historyList.innerHTML = "<p>Aucun historique pour l’instant.</p>";
    return;
  }

  historyItems.forEach(item => {
    const div = document.createElement("div");
    div.className = "history-item";
    div.innerHTML = `
      <strong>${new Date(item.completed_at).toLocaleString("fr-CA")}</strong>
      <div>${formatMinutes(item.duration_seconds)} min</div>
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

  const step = catalogSteps.find(s => normalizeId(s.id) === normalizeId(current.stepId));
  const task = catalogTasks.find(t => normalizeId(t.id) === normalizeId(current.taskId));
  const cat = catalogCategories.find(c => normalizeId(c.id) === normalizeId(current.categoryId));

  els.currentText.textContent = `${cat?.name || ""} — ${task?.name || ""} — ${step?.description || ""}`;

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

function renderAll() {
  renderTaskOptions();
  renderStepOptions();
  renderHistory();
  renderCurrent();
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

  const { error } = await sb.from("user_step_completions").insert({
    user_id: currentUser.id,
    step_id: current.stepId,
    duration_seconds: durationSeconds
  });

  if (error) {
    toast("Erreur en sauvegardant : " + error.message, "error");
    return;
  }

  completedStepIds.push(normalizeId(current.stepId));
  historyItems.unshift({
    completed_at: new Date().toISOString(),
    duration_seconds: durationSeconds,
    step_id: current.stepId
  });

  current = null;
  renderHistory();
  renderCurrent();
  renderAll();
}

function startSession() {
  const categoryId = els.categorySelect.value;
  const taskId = els.taskSelect.value;
  const stepId = els.stepSelect.value;
  const minutes = parseInt(els.timerMinutes.value, 10) || 10;

  if (!categoryId || !taskId || !stepId) {
    toast("Choisis une catégorie, une tâche et une étape.", "error");
    return;
  }

  const step = catalogSteps.find(s => normalizeId(s.id) === normalizeId(stepId));
  if (!step) {
    toast("Étape introuvable.", "error");
    return;
  }

  current = {
    categoryId,
    taskId,
    stepId,
    remainingSeconds: minutes * 60,
    plannedSeconds: minutes * 60,
    running: false
  };

  renderCurrent();
  setVisible(els.selectorView, false);
  els.currentCard.scrollIntoView({ behavior: "smooth", block: "center" });
}

/* ============ Events ============ */
els.authSendBtn.onclick = sendMagicLink;
els.authLogoutBtn.onclick = logout;

els.tabFocusBtn.onclick = () => showTab("focus");
els.tabHistoryBtn.onclick = () => showTab("history");

els.categorySelect.addEventListener("change", renderTaskOptions);
els.taskSelect.addEventListener("change", renderStepOptions);
els.startSessionBtn.onclick = startSession;

els.pauseTimerBtn.onclick = stopTimer;
els.resumeTimerBtn.onclick = startTimer;

els.markDoneBtn.onclick = () => {
  if (!current) return;
  stopTimer();
  recordCompletion(current.plannedSeconds);
};

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && current) {
    stopTimer();
  }
});
