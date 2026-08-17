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

let current = null; // { taskId, categoryId, subcategoryId, scopeCategoryId, scopeSubcategoryId, plannedSeconds, remainingSeconds, running, started }
let timerInterval = null;

/* ============ Helpers ============ */
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

function formatDateShort(ts) {
  return new Date(ts).toLocaleDateString("fr-CA", { day: "numeric", month: "long" });
}

function formatMinutes(seconds) {
  return Math.max(1, Math.round((seconds || 0) / 60));
}

function lowerFirst(s) {
  if (!s) return s;
  return s.charAt(0).toLowerCase() + s.slice(1);
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/* ============ UI refs ============ */
const els = {
  auth: document.getElementById("auth"),
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
  motivationalPersonalizeLink: document.getElementById("motivational-personalize-link"),

  selectorView: document.getElementById("selector-view"),
  categorySelect: document.getElementById("category-select"),
  stepSelect: document.getElementById("step-select"), // = pièce
  startSessionBtn: document.getElementById("start-session-btn"),

  currentCard: document.getElementById("current-step"),
  currentText: document.getElementById("current-step-text"),

  pickTimeView: document.getElementById("pick-time-view"),
  pickTimerMinutes: document.getElementById("pick-timer-minutes"),
  confirmStartTimerBtn: document.getElementById("confirm-start-timer-btn"),
  skipTaskBeforeBtn: document.getElementById("skip-task-before-btn"),
  cancelPickBtn: document.getElementById("cancel-pick-btn"),

  timerRunningView: document.getElementById("timer-running-view"),
  timerDisplay: document.getElementById("timer"),
  pauseTimerBtn: document.getElementById("pause-timer-btn"),
  resumeTimerBtn: document.getElementById("resume-timer-btn"),
  skipTaskBtn: document.getElementById("skip-task-btn"),
  markDoneBtn: document.getElementById("mark-done-btn"),

  showHistoryBtn: document.getElementById("show-history-btn"),
  showPersonalizeBtn: document.getElementById("show-personalize-btn"),
  historyPanel: document.getElementById("history-panel"),
  personalizePanel: document.getElementById("personalize-panel"),
  historyList: document.getElementById("history-list"),

  // Wizard "Personnalise ton expérience"
  pzStepCategory: document.getElementById("pz-step-category"),
  pzCategorySelect: document.getElementById("pz-category-select"),
  pzStartBtn: document.getElementById("pz-start-btn"),

  pzStepRooms: document.getElementById("pz-step-rooms"),
  pzRoomsList: document.getElementById("pz-rooms-list"),
  pzRoomsBackBtn: document.getElementById("pz-rooms-back-btn"),
  pzRoomsNextBtn: document.getElementById("pz-rooms-next-btn"),

  pzStepTasks: document.getElementById("pz-step-tasks"),
  pzCurrentRoomTitle: document.getElementById("pz-current-room-title"),
  pzTasksList: document.getElementById("pz-tasks-list"),
  pzTasksBackBtn: document.getElementById("pz-tasks-back-btn"),
  pzTasksNextBtn: document.getElementById("pz-tasks-next-btn"),

  pzStepTiming: document.getElementById("pz-step-timing"),
  pzTimingBackBtn: document.getElementById("pz-timing-back-btn"),
  pzTimingNextBtn: document.getElementById("pz-timing-next-btn"),

  pzStepTimes: document.getElementById("pz-step-times"),
  pzTimesList: document.getElementById("pz-times-list"),
  pzTimesBackBtn: document.getElementById("pz-times-back-btn"),
  pzTimesSaveBtn: document.getElementById("pz-times-save-btn"),

  pzStepDone: document.getElementById("pz-step-done"),
  pzLaunchBtn: document.getElementById("pz-launch-btn"),
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

  els.authOtpStatus.textContent = "Lien magique envoyé! Vérifie ta boîte courriel.";
  els.authOtpStatus.classList.remove("hidden");
}

async function logout() {
  await sb.auth.signOut();
  currentUser = null;
  showLoggedOut();
}

function showLoggedOut() {
  setVisible(els.auth, true);
  setVisible(els.appContent, false);
}

async function showLoggedIn(user) {
  currentUser = user;
  els.authUserEmail.textContent = user.email || "";
  setVisible(els.auth, false);
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
  renderStepOptions();
  renderHistory();
  renderCurrent();
  populatePersonalizeCategorySelect();
}

async function reloadPreferences() {
  const { data, error } = await sb.from("user_task_preferences")
    .select("id, task_id, preferred_minutes, pinned, notes, updated_at")
    .eq("user_id", currentUser.id);
  if (error) {
    toast("Erreur : " + error.message, "error");
    return;
  }
  userTaskPreferences = data || [];
}

/* ============ Personnalisation : helpers de filtrage ============ */
function getPinnedTaskIds() {
  return new Set(
    userTaskPreferences.filter(p => p.pinned).map(p => normalizeId(p.task_id))
  );
}

// Pièces "actives" pour une catégorie donnée : celles qui contiennent au moins une tâche épinglée.
function getActiveSubcategoryIds(categoryId) {
  const pinned = getPinnedTaskIds();
  const ids = new Set();
  catalogTasks.forEach(t => {
    if (normalizeId(t.category_id) === normalizeId(categoryId) && pinned.has(normalizeId(t.id))) {
      ids.add(normalizeId(t.subcategory_id));
    }
  });
  return ids;
}

// Noms de pièces "actives" toutes catégories confondues (utilisé quand aucun type de ménage n'est choisi).
function getActivePieceNamesGlobal() {
  const pinned = getPinnedTaskIds();
  const names = new Set();
  catalogTasks.forEach(t => {
    if (pinned.has(normalizeId(t.id))) {
      const subcat = catalogSubcategories.find(s => normalizeId(s.id) === normalizeId(t.subcategory_id));
      if (subcat) names.add(subcat.name);
    }
  });
  return names;
}

function getPrefillMinutes(taskId, fallbackMinutes) {
  const pref = userTaskPreferences.find(p => normalizeId(p.task_id) === normalizeId(taskId));
  if (pref && pref.preferred_minutes) return pref.preferred_minutes;

  const hist = taskHistory.filter(h => normalizeId(h.task_id) === normalizeId(taskId));
  if (hist.length) {
    const avg = hist.reduce((a, b) => a + (b.duration_minutes || 0), 0) / hist.length;
    return Math.max(1, Math.round(avg));
  }
  return fallbackMinutes;
}

// Construit le bassin de tâches possibles selon les filtres optionnels (catégorie / pièce),
// puis restreint aux tâches personnalisées (pinned) si l'utilisateur en a défini pour ce bassin.
function buildTaskPool(categoryId, subcategoryId) {
  let tasks = catalogTasks.slice();

  if (categoryId) {
    tasks = tasks.filter(t => normalizeId(t.category_id) === normalizeId(categoryId));
  }

  if (subcategoryId) {
    if (categoryId) {
      tasks = tasks.filter(t => normalizeId(t.subcategory_id) === normalizeId(subcategoryId));
    } else {
      // Aucune catégorie choisie : la pièce est identifiée par son nom (les ids diffèrent par catégorie)
      const subcat = catalogSubcategories.find(s => normalizeId(s.id) === normalizeId(subcategoryId));
      if (subcat) {
        const matchingIds = new Set(
          catalogSubcategories.filter(s => s.name === subcat.name).map(s => normalizeId(s.id))
        );
        tasks = tasks.filter(t => matchingIds.has(normalizeId(t.subcategory_id)));
      }
    }
  }

  const pinned = getPinnedTaskIds();
  const pinnedSubset = tasks.filter(t => pinned.has(normalizeId(t.id)));
  if (pinnedSubset.length > 0) {
    tasks = pinnedSubset;
  }

  return tasks;
}

/* ============ Render : sélecteurs (facultatifs) ============ */
function renderCategoryOptions() {
  clearSelect(els.categorySelect, "Peu importe");
  catalogCategories.forEach(cat => {
    const opt = document.createElement("option");
    opt.value = normalizeId(cat.id);
    opt.textContent = (cat.icon ? cat.icon + " " : "") + cat.name;
    els.categorySelect.appendChild(opt);
  });
}

// Peuple la liste des pièces, avec ou sans catégorie choisie (tout est facultatif et indépendant)
function renderStepOptions() {
  const catId = els.categorySelect.value;
  const previousValue = els.stepSelect.value;
  clearSelect(els.stepSelect, "Peu importe");

  let subcats;
  if (catId) {
    subcats = catalogSubcategories.filter(s => normalizeId(s.category_id) === normalizeId(catId));
    const activeIds = getActiveSubcategoryIds(catId);
    if (activeIds.size > 0) {
      subcats = subcats.filter(s => activeIds.has(normalizeId(s.id)));
    }
  } else {
    // Dédoublonne par nom de pièce à travers toutes les catégories
    const seen = new Set();
    subcats = [];
    catalogSubcategories.forEach(s => {
      if (!seen.has(s.name)) {
        seen.add(s.name);
        subcats.push(s);
      }
    });
    const activeNames = getActivePieceNamesGlobal();
    if (activeNames.size > 0) {
      subcats = subcats.filter(s => activeNames.has(s.name));
    }
  }

  subcats.forEach(subcat => {
    const opt = document.createElement("option");
    opt.value = normalizeId(subcat.id);
    opt.textContent = subcat.name;
    els.stepSelect.appendChild(opt);
  });

  // Conserve la sélection précédente si elle existe encore dans la nouvelle liste
  const stillValid = Array.from(els.stepSelect.options).some(o => o.value === previousValue);
  els.stepSelect.value = stillValid ? previousValue : "";
}

/* ============ Render : historique ============ */
function renderHistory() {
  if (!els.historyList) return;
  els.historyList.innerHTML = "";

  if (!taskHistory.length) {
    els.historyList.innerHTML = "<p>Aucun historique pour l'instant.</p>";
    return;
  }

  taskHistory.forEach(item => {
    const task = catalogTasks.find(t => normalizeId(t.id) === normalizeId(item.task_id));
    const div = document.createElement("div");
    div.className = "history-item";

    let line = `Le ${formatDateShort(item.completed_at)} tu as ${lowerFirst(task?.name || "fait une tâche")} en ${item.duration_minutes || 0} minutes`;
    if (item.note) {
      line += ` et tu as noté : ${item.note}`;
    }
    line += ".";

    div.textContent = line;
    els.historyList.appendChild(div);
  });
}

/* ============ Render : tâche piochée / session ============ */
function renderCurrent() {
  if (!current) {
    setVisible(els.currentCard, false);
    setVisible(els.selectorView, true);
    return;
  }

  setVisible(els.selectorView, false);
  setVisible(els.currentCard, true);

  const cat = catalogCategories.find(c => normalizeId(c.id) === normalizeId(current.categoryId));
  const task = catalogTasks.find(t => normalizeId(t.id) === normalizeId(current.taskId));
  const subcat = catalogSubcategories.find(s => normalizeId(s.id) === normalizeId(current.subcategoryId));

  els.currentText.textContent = `${cat?.name || ""} — ${subcat?.name || ""} — ${task?.name || ""}`.replace(/ — $/, "").replace(/^ — /, "");

  if (!current.started) {
    setVisible(els.pickTimeView, true);
    setVisible(els.timerRunningView, false);
    return;
  }

  setVisible(els.pickTimeView, false);
  setVisible(els.timerRunningView, true);

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

/* ============ Onglet Mon faiskifo : sous-panneaux ============ */
function showHistoryPanel() {
  setVisible(els.historyPanel, true);
  setVisible(els.personalizePanel, false);
}

function showPersonalizePanel() {
  setVisible(els.historyPanel, false);
  setVisible(els.personalizePanel, true);
  resetPersonalizeWizard();
}

/* ============ Faiskifo pige une tâche ============ */
function drawTask(excludeTaskId) {
  const categoryId = els.categorySelect.value || "";
  const subcategoryId = els.stepSelect.value || "";

  let pool = buildTaskPool(categoryId, subcategoryId);
  if (excludeTaskId) {
    const withoutCurrent = pool.filter(t => normalizeId(t.id) !== normalizeId(excludeTaskId));
    if (withoutCurrent.length > 0) pool = withoutCurrent;
  }

  if (pool.length === 0) {
    toast("Aucune tâche disponible avec ces critères. Essaie d'élargir tes choix.", "error");
    return null;
  }

  const task = pick(pool);

  return {
    taskId: normalizeId(task.id),
    categoryId: normalizeId(task.category_id),
    subcategoryId: normalizeId(task.subcategory_id),
    scopeCategoryId: categoryId,
    scopeSubcategoryId: subcategoryId,
    plannedSeconds: 0,
    remainingSeconds: 0,
    running: false,
    started: false
  };
}

function pickTask() {
  const drawn = drawTask(null);
  if (!drawn) return;

  current = drawn;
  const task = catalogTasks.find(t => normalizeId(t.id) === current.taskId);
  els.pickTimerMinutes.value = "";
  els.pickTimerMinutes.placeholder = "Laisse vide (≈ " + getPrefillMinutes(current.taskId, task?.duration_minutes || 10) + " min)";

  renderCurrent();
}

function cancelPick() {
  current = null;
  renderCurrent();
}

function confirmStartTimer() {
  if (!current) return;

  const task = catalogTasks.find(t => normalizeId(t.id) === current.taskId);
  const raw = els.pickTimerMinutes.value.trim();
  const parsed = raw ? parseInt(raw, 10) : NaN;
  const minutes = (parsed && parsed > 0) ? parsed : getPrefillMinutes(current.taskId, task?.duration_minutes || 10);

  current.plannedSeconds = minutes * 60;
  current.remainingSeconds = minutes * 60;
  current.started = true;

  renderCurrent();
  startTimer();
}

// Passer cette tâche (avant ou pendant le minuteur) : en pige une autre selon les mêmes filtres, sans compter dans l'historique
function skipTask() {
  if (!current) return;

  const wasStarted = current.started;
  const excludeId = current.taskId;

  // Restaure temporairement les sélecteurs sur le scope d'origine pour repiger dans le même bassin
  const savedCat = els.categorySelect.value;
  const savedStep = els.stepSelect.value;
  els.categorySelect.value = current.scopeCategoryId || "";
  els.stepSelect.value = current.scopeSubcategoryId || "";

  const drawn = drawTask(excludeId);

  els.categorySelect.value = savedCat;
  els.stepSelect.value = savedStep;

  if (!drawn) return;

  stopTimer();
  current = drawn;

  if (wasStarted) {
    // Redémarre directement le minuteur avec le temps recalculé pour la nouvelle tâche
    const task = catalogTasks.find(t => normalizeId(t.id) === current.taskId);
    const minutes = getPrefillMinutes(current.taskId, task?.duration_minutes || 10);
    current.plannedSeconds = minutes * 60;
    current.remainingSeconds = minutes * 60;
    current.started = true;
    renderCurrent();
    startTimer();
  } else {
    const task = catalogTasks.find(t => normalizeId(t.id) === current.taskId);
    els.pickTimerMinutes.value = "";
    els.pickTimerMinutes.placeholder = "Laisse vide (≈ " + getPrefillMinutes(current.taskId, task?.duration_minutes || 10) + " min)";
    renderCurrent();
  }

  toast("Nouvelle tâche piochée!", "info");
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
}

function markDone() {
  if (!current) return;
  const elapsed = current.plannedSeconds - current.remainingSeconds;
  stopTimer();
  recordCompletion(elapsed);
}

/* =========================================================
   Wizard "Personnalise ton expérience"
   ========================================================= */
let pz = {
  categoryId: null,
  roomIds: [],
  roomIndex: 0,
  taskSelections: {}, // subcategoryId -> Set(taskId)
  timingMode: null
};

function populatePersonalizeCategorySelect() {
  clearSelect(els.pzCategorySelect, "Choisis un type de ménage");
  catalogCategories.forEach(cat => {
    const opt = document.createElement("option");
    opt.value = normalizeId(cat.id);
    opt.textContent = (cat.icon ? cat.icon + " " : "") + cat.name;
    els.pzCategorySelect.appendChild(opt);
  });
}

function resetPersonalizeWizard() {
  pz = { categoryId: null, roomIds: [], roomIndex: 0, taskSelections: {}, timingMode: null };
  els.pzCategorySelect.value = "";
  showPzStep("category");
}

function showPzStep(step) {
  const steps = ["category", "rooms", "tasks", "timing", "times", "done"];
  steps.forEach(s => {
    const el = document.getElementById("pz-step-" + s);
    setVisible(el, s === step);
  });
}

// Étape 1 -> 2 : choisir le type de ménage, afficher les pièces
function pzGoToRooms() {
  const catId = els.pzCategorySelect.value;
  if (!catId) {
    toast("Choisis un type de ménage.", "error");
    return;
  }
  pz.categoryId = catId;

  const subcats = catalogSubcategories.filter(s => normalizeId(s.category_id) === normalizeId(catId));
  const pinned = getPinnedTaskIds();

  els.pzRoomsList.innerHTML = "";
  subcats.forEach(subcat => {
    const hasPinnedTask = catalogTasks.some(t =>
      normalizeId(t.subcategory_id) === normalizeId(subcat.id) &&
      normalizeId(t.category_id) === normalizeId(catId) &&
      pinned.has(normalizeId(t.id))
    );

    const label = document.createElement("label");
    label.className = "checkbox-option";
    label.innerHTML = `<input type="checkbox" value="${normalizeId(subcat.id)}" ${hasPinnedTask ? "checked" : ""} /> ${subcat.name}`;
    els.pzRoomsList.appendChild(label);
  });

  showPzStep("rooms");
}

// Étape 2 -> 3 : pièces cochées, commencer la boucle des tâches
function pzGoToTasks() {
  const checked = Array.from(els.pzRoomsList.querySelectorAll("input[type=checkbox]:checked")).map(i => i.value);
  if (checked.length === 0) {
    toast("Coche au moins une pièce.", "error");
    return;
  }
  pz.roomIds = checked;
  pz.roomIndex = 0;
  pzRenderTasksStepForCurrentRoom();
  showPzStep("tasks");
}

function pzRenderTasksStepForCurrentRoom() {
  const subcatId = pz.roomIds[pz.roomIndex];
  const subcat = catalogSubcategories.find(s => normalizeId(s.id) === normalizeId(subcatId));
  els.pzCurrentRoomTitle.textContent = subcat ? subcat.name : "Tâches";

  const tasks = catalogTasks.filter(t =>
    normalizeId(t.category_id) === normalizeId(pz.categoryId) &&
    normalizeId(t.subcategory_id) === normalizeId(subcatId)
  );

  const alreadySelected = pz.taskSelections[subcatId] || getPreselectedTasksForRoom(subcatId);

  els.pzTasksList.innerHTML = "";
  tasks.forEach(task => {
    const checked = alreadySelected.has(normalizeId(task.id));
    const label = document.createElement("label");
    label.className = "checkbox-option";
    label.innerHTML = `<input type="checkbox" value="${normalizeId(task.id)}" ${checked ? "checked" : ""} /> ${task.name}`;
    els.pzTasksList.appendChild(label);
  });

  els.pzTasksBackBtn.textContent = pz.roomIndex === 0 ? "Retour" : "Pièce précédente";
}

function getPreselectedTasksForRoom(subcatId) {
  const pinned = getPinnedTaskIds();
  const ids = catalogTasks
    .filter(t => normalizeId(t.subcategory_id) === normalizeId(subcatId) && pinned.has(normalizeId(t.id)))
    .map(t => normalizeId(t.id));
  return new Set(ids);
}

function pzSaveCurrentRoomSelections() {
  const subcatId = pz.roomIds[pz.roomIndex];
  const checked = Array.from(els.pzTasksList.querySelectorAll("input[type=checkbox]:checked")).map(i => normalizeId(i.value));
  pz.taskSelections[subcatId] = new Set(checked);
}

// Étape 3 -> suivant : soit la pièce suivante, soit l'étape "temps"
function pzGoNextFromTasks() {
  pzSaveCurrentRoomSelections();

  if (pz.roomIndex < pz.roomIds.length - 1) {
    pz.roomIndex++;
    pzRenderTasksStepForCurrentRoom();
    return;
  }

  showPzStep("timing");
  const radios = document.querySelectorAll('input[name="pz-timing"]');
  radios.forEach(r => { r.checked = false; });
}

function pzBackFromTasks() {
  pzSaveCurrentRoomSelections();
  if (pz.roomIndex > 0) {
    pz.roomIndex--;
    pzRenderTasksStepForCurrentRoom();
  } else {
    showPzStep("rooms");
  }
}

// Étape 4 : mode de gestion du temps
function pzGoNextFromTiming() {
  const selected = document.querySelector('input[name="pz-timing"]:checked');
  if (!selected) {
    toast("Choisis une option.", "error");
    return;
  }
  pz.timingMode = selected.value;

  if (pz.timingMode === "now") {
    pzRenderTimesStep();
    showPzStep("times");
  } else {
    savePersonalization(null).then(ok => {
      if (ok) showPzStep("done");
    });
  }
}

function pzRenderTimesStep() {
  els.pzTimesList.innerHTML = "";
  pz.roomIds.forEach(subcatId => {
    const subcat = catalogSubcategories.find(s => normalizeId(s.id) === normalizeId(subcatId));
    const selectedTaskIds = pz.taskSelections[subcatId] || new Set();

    selectedTaskIds.forEach(taskId => {
      const task = catalogTasks.find(t => normalizeId(t.id) === normalizeId(taskId));
      if (!task) return;

      const row = document.createElement("div");
      row.className = "time-row";
      const defaultMinutes = getPrefillMinutes(taskId, task.duration_minutes || 10);
      row.innerHTML = `
        <label>${subcat ? subcat.name + " — " : ""}${task.name}</label>
        <input type="number" min="1" value="${defaultMinutes}" data-task-id="${normalizeId(taskId)}" />
      `;
      els.pzTimesList.appendChild(row);
    });
  });

  if (!els.pzTimesList.children.length) {
    els.pzTimesList.innerHTML = "<p class='field-hint'>Aucune tâche sélectionnée.</p>";
  }
}

async function pzSaveTimes() {
  const inputs = Array.from(els.pzTimesList.querySelectorAll("input[data-task-id]"));
  const timesMap = {};
  inputs.forEach(input => {
    const minutes = parseInt(input.value, 10);
    if (minutes && minutes > 0) {
      timesMap[input.dataset.taskId] = minutes;
    }
  });

  const ok = await savePersonalization(timesMap);
  if (ok) showPzStep("done");
}

// Enregistre les choix de la personnalisation dans user_task_preferences
async function savePersonalization(timesMap) {
  const allReviewedTaskIds = [];
  const selectedTaskIds = new Set();

  pz.roomIds.forEach(subcatId => {
    const tasksInRoom = catalogTasks.filter(t =>
      normalizeId(t.category_id) === normalizeId(pz.categoryId) &&
      normalizeId(t.subcategory_id) === normalizeId(subcatId)
    );
    const selectedForRoom = pz.taskSelections[subcatId] || new Set();

    tasksInRoom.forEach(t => {
      const id = normalizeId(t.id);
      allReviewedTaskIds.push(id);
      if (selectedForRoom.has(id)) selectedTaskIds.add(id);
    });
  });

  const upserts = Array.from(selectedTaskIds).map(taskId => {
    const existingPref = userTaskPreferences.find(p => normalizeId(p.task_id) === taskId);
    return {
      user_id: currentUser.id,
      task_id: taskId,
      pinned: true,
      preferred_minutes: (timesMap && timesMap[taskId]) ? timesMap[taskId] : (existingPref?.preferred_minutes ?? null),
      updated_at: new Date().toISOString()
    };
  });

  if (upserts.length) {
    const { error } = await sb.from("user_task_preferences").upsert(upserts, { onConflict: "user_id,task_id" });
    if (error) {
      toast("Erreur en enregistrant : " + error.message, "error");
      return false;
    }
  }

  const toUnpin = allReviewedTaskIds.filter(id => !selectedTaskIds.has(id));
  if (toUnpin.length) {
    await sb.from("user_task_preferences")
      .update({ pinned: false })
      .eq("user_id", currentUser.id)
      .in("task_id", toUnpin);
  }

  await reloadPreferences();
  toast("Tes préférences sont enregistrées!", "success");
  return true;
}

// Étape finale : retour à "Je me lance!" avec les filtres rafraîchis
function pzLaunch() {
  showTab("focus");
  els.categorySelect.value = pz.categoryId || "";
  renderStepOptions();
}

/* ============ Événements ============ */
els.authSendBtn?.addEventListener("click", sendMagicLink);
els.authLogoutBtn?.addEventListener("click", logout);

els.tabFocusBtn?.addEventListener("click", () => showTab("focus"));
els.tabHistoryBtn?.addEventListener("click", () => showTab("history"));

els.motivationalPersonalizeLink?.addEventListener("click", () => {
  showTab("history");
  showPersonalizePanel();
});

els.categorySelect?.addEventListener("change", renderStepOptions);

els.startSessionBtn?.addEventListener("click", pickTask);
els.confirmStartTimerBtn?.addEventListener("click", confirmStartTimer);
els.skipTaskBeforeBtn?.addEventListener("click", skipTask);
els.cancelPickBtn?.addEventListener("click", cancelPick);

els.pauseTimerBtn?.addEventListener("click", stopTimer);
els.resumeTimerBtn?.addEventListener("click", startTimer);
els.skipTaskBtn?.addEventListener("click", skipTask);
els.markDoneBtn?.addEventListener("click", markDone);

els.showHistoryBtn?.addEventListener("click", showHistoryPanel);
els.showPersonalizeBtn?.addEventListener("click", showPersonalizePanel);

els.pzStartBtn?.addEventListener("click", pzGoToRooms);
els.pzRoomsBackBtn?.addEventListener("click", () => showPzStep("category"));
els.pzRoomsNextBtn?.addEventListener("click", pzGoToTasks);

els.pzTasksBackBtn?.addEventListener("click", pzBackFromTasks);
els.pzTasksNextBtn?.addEventListener("click", pzGoNextFromTasks);

els.pzTimingBackBtn?.addEventListener("click", () => {
  pz.roomIndex = pz.roomIds.length - 1;
  pzRenderTasksStepForCurrentRoom();
  showPzStep("tasks");
});
els.pzTimingNextBtn?.addEventListener("click", pzGoNextFromTiming);

els.pzTimesBackBtn?.addEventListener("click", () => showPzStep("timing"));
els.pzTimesSaveBtn?.addEventListener("click", pzSaveTimes);

els.pzLaunchBtn?.addEventListener("click", pzLaunch);
