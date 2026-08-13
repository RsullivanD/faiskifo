/* ============ Connexion à Supabase ============ */
const SUPABASE_URL = "https://gnbjxvoxktxhxnkpfgtb.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_zwAIBLWPlRd4dMoCOY2UEw_d7dQfs5u";
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function now() { return new Date(); }
function startOfDay(d){ const x=new Date(d); x.setHours(0,0,0,0); return x; }
function startOfWeek(d){ const x=new Date(d); const day=x.getDay(); const diff = x.getDate() - day + (day===0? -6:1); x.setDate(diff); x.setHours(0,0,0,0); return x; }

let currentUser = null;
let catalogTasks = [];
let catalogSteps = [];
let catalogCategories = [];
let completedStepIds = [];

let current = null;
let timerInterval = null;

/* ============ UI refs ============ */
const els = {
  authLoggedOut: document.getElementById("auth-logged-out"),
  authLoggedIn: document.getElementById("auth-logged-in"),

  methodPasswordBtn: document.getElementById("method-password-btn"),
  methodOtpBtn: document.getElementById("method-otp-btn"),

  authFormPassword: document.getElementById("auth-form-password"),
  authFormOtp: document.getElementById("auth-form-otp"),

  authEmail: document.getElementById("auth-email"),
  authPassword: document.getElementById("auth-password"),
  authPasswordConfirm: document.getElementById("auth-password-confirm"),

  authSignupBtn: document.getElementById("auth-signup-btn"),
  authLoginBtn: document.getElementById("auth-login-btn"),

  authEmailOtp: document.getElementById("auth-email-otp"),
  authSendBtn: document.getElementById("auth-send-btn"),

  authPasswordStatus: document.getElementById("auth-password-status"),
  authOtpStatus: document.getElementById("auth-otp-status"),

  authUserEmail: document.getElementById("auth-user-email"),
  authLogoutBtn: document.getElementById("auth-logout-btn"),
  appContent: document.getElementById("app-content"),

  tasksList: document.getElementById("tasks-list"),
  categorySelect: document.getElementById("category-select"),
  taskSelect: document.getElementById("task-select"),
  drawBtn: document.getElementById("draw-step-btn"),
  drawShortBtn: document.getElementById("random-short-btn"),
  timerMinutes: document.getElementById("timer-minutes"),
  currentCard: document.getElementById("current-step"),
  currentText: document.getElementById("current-step-text"),
  timerDisplay: document.getElementById("timer"),
  minusTimeBtn: document.getElementById("minus-time-btn"),
  plusTimeBtn: document.getElementById("plus-time-btn"),
  startBtn: document.getElementById("start-timer-btn"),
  stopBtn: document.getElementById("stop-timer-btn"),
  doneBtn: document.getElementById("mark-done-btn"),
  todayCount: document.getElementById("today-count"),
  todayMins: document.getElementById("today-mins"),
  weekCount: document.getElementById("week-count"),
  weekMins: document.getElementById("week-mins"),

  toastContainer: document.getElementById("toast-container"),
  confirmModal: document.getElementById("confirm-modal"),
  confirmModalTitle: document.getElementById("confirm-modal-title"),
  confirmModalOk: document.getElementById("confirm-modal-ok"),
  confirmModalCancel: document.getElementById("confirm-modal-cancel"),
};

function normalizeId(v) {
  return v === null || v === undefined ? "" : String(v);
}

function setAuthStatus(el, message, type = "info") {
  if (!el) return;
  el.textContent = message;
  el.className = "auth-status" + (type === "error" ? " auth-status-error" : type === "success" ? " auth-status-success" : "");
  el.classList.remove("hidden");
}

function clearAuthStatus(el) {
  if (!el) return;
  el.classList.add("hidden");
  el.textContent = "";
}

/* ============ Toasts ============ */
function toast(message, type = "info"){
  const t = document.createElement("div");
  t.className = "toast" + (type === "success" ? " toast-success" : type === "error" ? " toast-error" : "");
  t.textContent = message;
  els.toastContainer.appendChild(t);
  setTimeout(() => t.remove(), 2900);
}

/* ============ Confirmation ============ */
function askConfirm(message){
  return new Promise((resolve) => {
    els.confirmModalTitle.textContent = message;
    els.confirmModal.classList.remove("hidden");

    function cleanup(result){
      els.confirmModal.classList.add("hidden");
      els.confirmModalOk.removeEventListener("click", onOk);
      els.confirmModalCancel.removeEventListener("click", onCancel);
      resolve(result);
    }
    function onOk(){ cleanup(true); }
    function onCancel(){ cleanup(false); }

    els.confirmModalOk.addEventListener("click", onOk);
    els.confirmModalCancel.addEventListener("click", onCancel);
  });
}

/* ============ Auth ============ */
let otpCooldownTimer = null;
let otpCooldownRemaining = 0;

function switchAuthMethod(method) {
  const passwordMode = method === "password";
  els.authFormPassword.classList.toggle("hidden", !passwordMode);
  els.authFormOtp.classList.toggle("hidden", passwordMode);
  els.methodPasswordBtn.classList.toggle("auth-method-active", passwordMode);
  els.methodOtpBtn.classList.toggle("auth-method-active", !passwordMode);
  clearAuthStatus(els.authPasswordStatus);
  clearAuthStatus(els.authOtpStatus);
}

async function signupWithPassword() {
  const email = els.authEmail.value.trim();
  const password = els.authPassword.value;
  const confirm = els.authPasswordConfirm.value;

  if (!email || !password || !confirm) {
    setAuthStatus(els.authPasswordStatus, "Entre ton courriel, ton mot de passe et la confirmation.", "error");
    return;
  }
  if (password !== confirm) {
    setAuthStatus(els.authPasswordStatus, "Les deux mots de passe ne sont pas identiques.", "error");
    return;
  }

  clearAuthStatus(els.authPasswordStatus);
  els.authSignupBtn.disabled = true;
  els.authSignupBtn.textContent = "Création…";

  const { error } = await sb.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: window.location.href }
  });

  els.authSignupBtn.disabled = false;
  els.authSignupBtn.textContent = "Créer un compte";

  if (error) {
    setAuthStatus(els.authPasswordStatus, "Erreur : " + error.message, "error");
    return;
  }

  setAuthStatus(els.authPasswordStatus, "Compte créé. Vérifie ta boîte courriel si la confirmation email est activée.", "success");
}

async function loginWithPassword() {
  const email = els.authEmail.value.trim();
  const password = els.authPassword.value;

  if (!email || !password) {
    setAuthStatus(els.authPasswordStatus, "Entre ton courriel et ton mot de passe.", "error");
    return;
  }

  clearAuthStatus(els.authPasswordStatus);
  els.authLoginBtn.disabled = true;
  els.authLoginBtn.textContent = "Connexion…";

  const { error } = await sb.auth.signInWithPassword({ email, password });

  els.authLoginBtn.disabled = false;
  els.authLoginBtn.textContent = "Se connecter";

  if (error) {
    setAuthStatus(els.authPasswordStatus, "Erreur : " + error.message, "error");
    return;
  }

  clearAuthStatus(els.authPasswordStatus);
}

async function sendMagicLink() {
  const email = els.authEmailOtp.value.trim();

  if (!email) {
    setAuthStatus(els.authOtpStatus, "Entre ton courriel d'abord.", "error");
    return;
  }

  if (otpCooldownRemaining > 0) {
    setAuthStatus(els.authOtpStatus, `Patiente ${otpCooldownRemaining}s avant de renvoyer un code.`, "error");
    return;
  }

  els.authSendBtn.disabled = true;
  clearAuthStatus(els.authOtpStatus);

  const { error } = await sb.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.href }
  });

  els.authSendBtn.disabled = false;

  if (error) {
    setAuthStatus(els.authOtpStatus, "Erreur : " + error.message, "error");
    return;
  }

  setAuthStatus(els.authOtpStatus, "Code envoyé ! Vérifie ta boîte courriel 📬", "success");

  otpCooldownRemaining = 60;
  els.authSendBtn.textContent = "Renvoyer (60s)";
  otpCooldownTimer = setInterval(() => {
    otpCooldownRemaining--;
    if (otpCooldownRemaining <= 0) {
      clearInterval(otpCooldownTimer);
      otpCooldownTimer = null;
      els.authSendBtn.disabled = false;
      els.authSendBtn.textContent = "Envoyer le code";
      return;
    }
    els.authSendBtn.textContent = `Renvoyer (${otpCooldownRemaining}s)`;
  }, 1000);
}

async function logout(){
  await sb.auth.signOut();
  currentUser = null;
  showLoggedOut();
}

function showLoggedOut(){
  els.authLoggedOut.classList.remove("hidden");
  els.authLoggedIn.classList.add("hidden");
  els.appContent.classList.add("hidden");
}

async function showLoggedIn(user){
  currentUser = user;
  els.authLoggedOut.classList.add("hidden");
  els.authLoggedIn.classList.remove("hidden");
  els.authUserEmail.textContent = user.email || "";
  els.appContent.classList.remove("hidden");
  await loadCatalogAndProgress();
}

/* ============ Data loading ============ */
async function loadCatalogAndProgress(){
  const [catsRes, tasksRes, stepsRes, doneRes] = await Promise.all([
    sb.from("categories").select("id, name, icon").order("name"),
    sb.from("tasks").select("id, name, category_id, age_range").order("name"),
    sb.from("task_steps").select("id, task_id, step_order, description, duration_seconds").order("step_order"),
    sb.from("user_step_completions").select("step_id, completed_at, duration_seconds").eq("user_id", currentUser.id)
  ]);

  const catError = catsRes.error;
  const tasksError = tasksRes.error;
  const stepsError = stepsRes.error;
  const doneError = doneRes.error;

  if (catError || tasksError || stepsError) {
    const err = catError || tasksError || stepsError;
    console.error("Catalog load error:", { catError, tasksError, stepsError });
    toast("Impossible de charger le catalogue : " + err.message, "error");
    return;
  }

  if (doneError) {
    console.warn("Completion load warning:", doneError);
    completedStepIds = [];
  } else {
    completedStepIds = (doneRes.data || []).map(d => normalizeId(d.step_id));
  }

  catalogCategories = catsRes.data || [];
  catalogTasks = tasksRes.data || [];
  catalogSteps = stepsRes.data || [];

  renderCategoryOptions();
  renderAll();
}

function renderCategoryOptions(){
  const previous = els.categorySelect.value;
  els.categorySelect.innerHTML = '<option value="">Toutes les catégories</option>';

  catalogCategories.forEach(cat => {
    const opt = document.createElement("option");
    opt.value = normalizeId(cat.id);
    opt.textContent = (cat.icon ? cat.icon + " " : "") + cat.name;
    els.categorySelect.appendChild(opt);
  });

  els.categorySelect.value = previous;
  renderTaskOptions();
}

function renderTaskOptions(){
  const categoryId = normalizeId(els.categorySelect.value);
  const previous = els.taskSelect.value;

  const filtered = categoryId
    ? catalogTasks.filter(t => normalizeId(t.category_id) === categoryId)
    : catalogTasks;

  els.taskSelect.innerHTML = '<option value="">Choisis une tâche</option>';

  filtered.forEach(task => {
    const steps = catalogSteps.filter(s => normalizeId(s.task_id) === normalizeId(task.id));
    const remaining = steps.filter(s => !completedStepIds.includes(normalizeId(s.id))).length;

    const opt = document.createElement("option");
    opt.value = normalizeId(task.id);
    opt.textContent = task.name + (steps.length ? ` (${remaining}/${steps.length} restantes)` : "");
    els.taskSelect.appendChild(opt);
  });

  els.taskSelect.value = filtered.some(t => normalizeId(t.id) === previous) ? previous : "";
}

/* ============ Renderers ============ */
function renderTasks(){
  els.tasksList.innerHTML = "";

  if(catalogTasks.length === 0){
    els.tasksList.innerHTML = "<p>Aucune tâche disponible pour l'instant.</p>";
    return;
  }

  catalogTasks.forEach(task => {
    const steps = catalogSteps.filter(s => normalizeId(s.task_id) === normalizeId(task.id));
    const total = steps.length;
    const doneCount = steps.filter(s => completedStepIds.includes(normalizeId(s.id))).length;
    const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

    const div = document.createElement("div");
    div.className = "task card";
    div.innerHTML = `
      <h3>${task.name}</h3>
      <div class="task-progress-wrap">
        <div class="task-progress-track"><div class="task-progress-fill" style="width:${pct}%"></div></div>
        <span class="task-progress-label">${doneCount} / ${total} étapes${pct === 100 && total > 0 ? " · terminée 🎉" : ""}</span>
      </div>
    `;
    els.tasksList.appendChild(div);
  });
}

async function renderDashboard(){
  const { data: history, error } = await sb
    .from("user_step_completions")
    .select("completed_at, duration_seconds")
    .eq("user_id", currentUser.id);

  if(error){
    console.error(error);
    return;
  }

  const today = startOfDay(now());
  const week = startOfWeek(now());
  const items = history || [];
  const todayItems = items.filter(i => new Date(i.completed_at) >= today);
  const weekItems = items.filter(i => new Date(i.completed_at) >= week);

  els.todayCount.textContent = todayItems.length;
  els.todayMins.textContent = Math.round(todayItems.reduce((s, i) => s + (i.duration_seconds || 0), 0) / 60);
  els.weekCount.textContent = weekItems.length;
  els.weekMins.textContent = Math.round(weekItems.reduce((s, i) => s + (i.duration_seconds || 0), 0) / 60);
}

function renderCurrent(){
  if(!current){
    els.currentCard.classList.add("hidden");
    return;
  }

  els.currentCard.classList.remove("hidden");
  const step = catalogSteps.find(s => normalizeId(s.id) === normalizeId(current.stepId));
  const task = catalogTasks.find(t => normalizeId(t.id) === normalizeId(current.taskId));
  els.currentText.textContent = (task?.name || "") + " — " + (step?.description || "");

  const mm = Math.floor(current.remainingSeconds / 60);
  const ss = current.remainingSeconds % 60;
  els.timerDisplay.textContent = `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;

  els.startBtn.disabled = current.running;
  els.stopBtn.disabled = !current.running;
  els.minusTimeBtn.disabled = current.remainingSeconds <= 60;
}

function renderAll(){
  renderTaskOptions();
  renderTasks();
  renderDashboard();
  renderCurrent();
}

/* ============ Timer ============ */
function tick(){
  if(!current || !current.running) return;

  if(current.remainingSeconds > 0){
    current.remainingSeconds--;
    renderCurrent();
  } else {
    stopTimer();
    toast("Temps écoulé ! ⏰", "success");
    const mins = Math.max(1, Math.round((current.origSeconds || 0) / 60));
    recordCompletion(mins * 60);
  }
}

function startTimer(){
  if(!current || current.running) return;
  current.running = true;
  if(!current.origSeconds) current.origSeconds = current.remainingSeconds;
  timerInterval = setInterval(tick, 1000);
  renderCurrent();
}

function stopTimer(){
  if(!current) return;
  current.running = false;
  if(timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  renderCurrent();
}

function adjustTime(deltaSeconds){
  if(!current) return;
  current.remainingSeconds = Math.max(0, current.remainingSeconds + deltaSeconds);
  current.origSeconds = Math.max(current.origSeconds || 0, current.remainingSeconds);
  renderCurrent();
  toast(deltaSeconds > 0 ? "+5 minutes ajoutées" : "5 minutes retirées");
}

async function recordCompletion(durationSeconds){
  if(!current) return;

  const { error } = await sb.from("user_step_completions").insert({
    user_id: currentUser.id,
    step_id: current.stepId,
    duration_seconds: durationSeconds
  });

  if(error){
    toast("Erreur en sauvegardant : " + error.message, "error");
    console.error(error);
    return;
  }

  completedStepIds.push(normalizeId(current.stepId));
  current = null;
  renderAll();
}

/* ============ Piger une étape ============ */
function drawStep(availableMinutes){
  const taskId = normalizeId(els.taskSelect.value);

  if(!taskId){
    toast("Choisis d'abord une tâche.", "error");
    return;
  }

  const eligible = catalogSteps.filter(s =>
    normalize*

