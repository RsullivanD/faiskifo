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
  authLoggedOut: document.getElementById("auth-logged-out"),
  authEmailOtp: document.getElementById("auth-email-otp"),
  authSendBtn: document.getElementById("auth-send-btn"),
  authOtpStatus: document.getElementById("auth-otp-status"),
  authUserEmail: document.getElementById("auth-user-email"),
  authLogoutBtn: document.getElementById("auth-logout-btn"),

  auth: document.getElementById("auth"),
  appContent: document.getElementById("app-content"),
  tabFocusBtn: document.getElementById("tab-focus-btn"),
  tabHistoryBtn: document.getElementById("tab-history-btn"),

  focusView: document.getElementById("focus-view"),
  historyView: document.getElementById("history-view"),

  categorySelect: document.getElementById("category-select"),
  taskSelect: document.getElementById("task-select"),
  stepSelect: document.getElementById("step-select"), // = pièce
  timerMinutes: document.getElementById("timer-minutes"),
  startSessionBtn: document.getElementById("start-session-btn"),

  currentCard: document.getElementById("current-step"),
  currentText: document.getElementById("current-step-text"),
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

// Sous-catégories "actives" (pièces) pour une catégorie donnée : celles qui contiennent au moins une tâche épinglée.
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

/* ============ Render : sélecteurs de session ============ */
function renderCategoryOptions() {
  clearSelect(els.categorySelect, "Choisis un type de ménage");
  catalogCategories.forEach(cat => {
    const opt = document.createElement("option");
    opt.value = normalizeId(cat.id);
    opt.textContent = (cat.icon ? cat.icon + " " : "") + cat.name;
    els.categorySelect.appendChild(opt);
  });

  clearSelect(els.stepSelect, "Choisis une pièce");
  els.stepSelect.disabled = true;

  clearSelect(els.taskSelect, "Choisis une tâche");
  els.taskSelect.disabled = true;
}

// Étape 1 : type de ménage choisi -> peupler les pièces (priorité aux pièces personnalisées)
function renderStepOptions() {
  const catId = els.categorySelect.value;
  clearSelect(els.stepSelect, "Choisis une pièce");
  clearSelect(els.taskSelect, "Choisis une tâche");
  els.taskSelect.disabled = true;

  if (!catId) {
    els.stepSelect.disabled = true;
    return;
  }

  let subcats = catalogSubcategories.filter(s => normalizeId(s.category_id) === normalizeId(catId));

  const activeIds = getActiveSubcategoryIds(catId);
  if (activeIds.size > 0) {
    subcats = subcats.filter(s => activeIds.has(normalizeId(s.id)));
  }

  subcats.forEach(subcat => {
    const opt = document.createElement("option");
    opt.value = normalizeId(subcat.id);
    opt.textContent = subcat.name;
    els.stepSelect.appendChild(opt);
  });

  els.stepSelect.disabled = subcats.length === 0;
}

// Étape 2 : pièce choisie -> peupler les tâches (priorité aux tâches personnalisées)
function renderTaskOptions() {
  const catId = els.categorySelect.value;
  const subcatId = els.stepSelect.value;
  clearSelect(els.taskSelect, "Choisis une tâche");

  if (!catId || !subcatId) {
    els.taskSelect.disabled = true;
    return;
  }

  let tasks = catalogTasks.filter(t =>
    normalizeId(t.category_id) === normalizeId(catId) &&
    normalizeId(t.subcategory_id) === normalizeId(subcatId)
  );

  const pinned = getPinnedTaskIds();
  const pinnedInRoom = tasks.filter(t => pinned.has(normalizeId(t.id)));
  if (pinnedInRoom.length > 0) {
    tasks = pinnedInRoom;
  }

  tasks.forEach(task => {
    const opt = document.createElement("option");
    opt.value = normalizeId(task.id);
    opt.textContent = task.name;
    els.taskSelect.appendChild(opt);
  });

  els.taskSelect.disabled = tasks.length === 0;
}

function applyPrefillForSelectedTask() {
  const taskId = els.taskSelect.value;
  if (!taskId) return;
  const task = catalogTasks.find(t => normalizeId(t.id) === normalizeId(taskId));
  if (!task) return;
  els.timerMinutes.value = getPrefillMinutes(taskId, task.duration_minutes || 10);
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

/* ============ Render : session en cours ============ */
function renderCurrent() {
  if (!current) {
    setVisible(els.currentCard, false);
    setVisible(document.getElementById("selector-view"), true);
    return;
  }

  setVisible(els.currentCard, true);
  setVisible(document.getElementById("selector-view"), false);

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

/* ============ Session ============ */
function startSession() {
  const categoryId = els.categorySelect.value;
  const subcategoryId = els.stepSelect.value;
  const taskId = els.taskSelect.value;
  const minutes = parseInt(els.timerMinutes.value, 10);

  if (!categoryId || !subcategoryId || !taskId) {
    toast("Choisis un type de ménage, une pièce et une tâche.", "error");
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

// Passer cette tâche : reste dans la même pièce, en pige une autre au hasard, ne compte pas dans l'historique
function skipTask() {
  if (!current) return;

  let tasks = catalogTasks.filter(t =>
    normalizeId(t.category_id) === normalizeId(current.categoryId) &&
    normalizeId(t.subcategory_id) === normalizeId(current.subcategoryId)
  );

  const pinned = getPinnedTaskIds();
  const pinnedInRoom = tasks.filter(t => pinned.has(normalizeId(t.id)));
  if (pinnedInRoom.length > 0) {
    tasks = pinnedInRoom;
  }

  const otherTasks = tasks.filter(t => normalizeId(t.id) !== normalizeId(current.taskId));
  const nextTask = otherTasks.length > 0 ? pick(otherTasks) : tasks.find(t => normalizeId(t.id) === normalizeId(current.taskId));

  if (!nextTask) {
    toast("Aucune autre tâche disponible dans cette pièce.", "error");
    return;
  }

  stopTimer();

  const minutes = getPrefillMinutes(nextTask.id, nextTask.duration_minutes || 10);

  current = {
    categoryId: current.categoryId,
    subcategoryId: current.subcategoryId,
    taskId: normalizeId(nextTask.id),
    plannedSeconds: minutes * 60,
    remainingSeconds: minutes * 60,
    running: false
  };

  renderCurrent();
  startTimer();
  toast("Nouvelle tâche : " + nextTask.name, "info");
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

// Étape finale : retour à "Je me lance!" avec les listes rafraîchies
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

els.categorySelect?.addEventListener("change", renderStepOptions);
els.stepSelect?.addEventListener("change", renderTaskOptions);
els.taskSelect?.addEventListener("change", applyPrefillForSelectedTask);

els.startSessionBtn?.addEventListener("click", startSession);
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
