/* ============ Connexion à Supabase ============ */
const SUPABASE_URL = "https://gnbjxvoxktxhxnkpfgtb.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_zwAIBLWPlRd4dMoCOY2UEw_d7dQfs5u";
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function now() { return new Date(); }
function startOfDay(d){ const x=new Date(d); x.setHours(0,0,0,0); return x; }
function startOfWeek(d){ const x=new Date(d); const day=x.getDay(); const diff = x.getDate() - day + (day===0? -6:1); x.setDate(diff); x.setHours(0,0,0,0); return x; }

let currentUser = null;      // objet utilisateur Supabase, ou null si pas connecté
let catalogTasks = [];       // tâches du catalogue (table "tasks")
let catalogSteps = [];       // étapes du catalogue (table "task_steps")
let catalogCategories = [];  // catégories (table "categories")
let completedStepIds = [];   // ids des étapes déjà faites par cet utilisateur

let current = null; // {stepId, taskId, remainingSeconds, running, origSeconds}
let timerInterval = null;

/* ============ UI refs ============ */
const els = {
  authLoggedOut: document.getElementById("auth-logged-out"),
  authLoggedIn: document.getElementById("auth-logged-in"),
  // password form
  authFormPassword: document.getElementById("auth-form-password"),
  authEmail: document.getElementById("auth-email"),
  authPassword: document.getElementById("auth-password"),
  authLoginBtn: document.getElementById("auth-login-btn"),
  authPasswordStatus: document.getElementById("auth-password-status"),
  // otp form
  authFormOtp: document.getElementById("auth-form-otp"),
  authEmailOtp: document.getElementById("auth-email-otp"),
  authSendBtn: document.getElementById("auth-send-btn"),
  authOtpStatus: document.getElementById("auth-otp-status"),
  // method toggle
  methodPasswordBtn: document.getElementById("method-password-btn"),
  methodOtpBtn: document.getElementById("method-otp-btn"),
  // logged-in
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

/* ============ Toasts ============ */
function toast(message, type = "info"){
  const t = document.createElement("div");
  t.className = "toast" + (type === "success" ? " toast-success" : type === "error" ? " toast-error" : "");
  t.textContent = message;
  els.toastContainer.appendChild(t);
  setTimeout(() => t.remove(), 2900);
}

/* ============ Confirmation intégrée ============ */
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

/* ============ Authentification ============ */
let otpResendCooldown = null;

function setAuthStatus(el, message, type) {
  el.textContent = message;
  el.className = "auth-status" + (type === "error" ? " auth-status-error" : type === "success" ? " auth-status-success" : "");
  el.classList.remove("hidden");
}

function clearAuthStatus(el) {
  el.classList.add("hidden");
  el.textContent = "";
}

async function loginWithPassword() {
  const email = els.authEmail.value.trim();
  const password = els.authPassword.value;
  if (!email || !password) {
    setAuthStatus(els.authPasswordStatus, "Entre ton courriel et ton mot de passe.", "error");
    return;
  }
  els.authLoginBtn.disabled = true;
  els.authLoginBtn.textContent = "Connexion…";
  clearAuthStatus(els.authPasswordStatus);
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
  if (otpResendCooldown) {
    setAuthStatus(els.authOtpStatus, "Patiente quelques secondes avant de renvoyer.", "error");
    return;
  }
  els.authSendBtn.disabled = true;
  clearAuthStatus(els.authOtpStatus);
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.href }
  });
  if (error) {
    setAuthStatus(els.authOtpStatus, "Erreur : " + error.message, "error");
    els.authSendBtn.disabled = false;
    return;
  }
  setAuthStatus(els.authOtpStatus, "Code envoyé ! Vérifie ta boîte courriel 📬", "success");
  // cooldown 60 s to avoid rate-limit hammering
  let remaining = 60;
  otpResendCooldown = setInterval(() => {
    remaining--;
    els.authSendBtn.textContent = `Renvoyer (${remaining}s)`;
    if (remaining <= 0) {
      clearInterval(otpResendCooldown);
      otpResendCooldown = null;
      els.authSendBtn.disabled = false;
      els.authSendBtn.textContent = "Envoyer le code";
    }
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
  els.authUserEmail.textContent = user.email;
  els.appContent.classList.remove("hidden");
  await loadCatalogAndProgress();
}

/* ============ Charger le catalogue + la progression ============ */
async function loadCatalogAndProgress(){
  const [{ data: cats, error: catsErr }, { data: tasks, error: tasksErr }, { data: steps, error: stepsErr }, { data: done, error: doneErr }] = await Promise.all([
    sb.from("categories").select("id, name, icon"),
    sb.from("tasks").select("id, name, category_id, age_range"),
    sb.from("task_steps").select("id, task_id, step_order, description, duration_seconds").order("step_order"),
    sb.from("user_step_completions").select("step_id").eq("user_id", currentUser.id)
  ]);

  if(catsErr || tasksErr || stepsErr || doneErr){
    toast("Impossible de charger le catalogue. Réessaie plus tard.", "error");
    console.error(catsErr || tasksErr || stepsErr || doneErr);
    return;
  }

  catalogCategories = cats || [];
  catalogTasks = tasks || [];
  catalogSteps = steps || [];
  completedStepIds = (done || []).map(d => d.step_id);

  renderCategoryOptions();
  renderAll();
}

function renderCategoryOptions(){
  const current = els.categorySelect.value;
  els.categorySelect.innerHTML = '<option value="">Toutes les catégories</option>';
  catalogCategories.forEach(cat => {
    const opt = document.createElement("option");
    opt.value = cat.id;
    opt.textContent = (cat.icon ? cat.icon + " " : "") + cat.name;
    els.categorySelect.appendChild(opt);
  });
  els.categorySelect.value = current;
  renderTaskOptions();
}

function renderTaskOptions(){
  const categoryId = els.categorySelect.value;
  const current = els.taskSelect.value;
  const filtered = categoryId
    ? catalogTasks.filter(t => t.category_id === categoryId)
    : catalogTasks;

  els.taskSelect.innerHTML = '<option value="">Choisis une tâche</option>';
  filtered.forEach(task => {
    const steps = catalogSteps.filter(s => s.task_id === task.id);
    const remaining = steps.filter(s => !completedStepIds.includes(s.id)).length;
    const opt = document.createElement("option");
    opt.value = task.id;
    opt.textContent = task.name + (steps.length ? ` (${remaining}/${steps.length} restantes)` : "");
    els.taskSelect.appendChild(opt);
  });
  // garde la tâche sélectionnée si elle existe encore dans la liste filtrée
  els.taskSelect.value = filtered.some(t => t.id === current) ? current : "";
}

/* ============ Renderers ============ */
function renderTasks(){
  els.tasksList.innerHTML = "";
  if(catalogTasks.length === 0){
    els.tasksList.innerHTML = "<p>Aucune tâche disponible pour l'instant.</p>";
    return;
  }
  catalogTasks.forEach(task=>{
    const steps = catalogSteps.filter(s => s.task_id === task.id);
    const total = steps.length;
    const doneCount = steps.filter(s => completedStepIds.includes(s.id)).length;
    const pct = total > 0 ? Math.round((doneCount/total)*100) : 0;

    const div = document.createElement("div");
    div.className = "task card";
    div.innerHTML = `
      <h3>${task.name}</h3>
      <div class="task-progress-wrap">
        <div class="task-progress-track"><div class="task-progress-fill" style="width:${pct}%"></div></div>
        <span class="task-progress-label">${doneCount} / ${total} étapes${pct===100 && total>0 ? " · terminée 🎉" : ""}</span>
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

  if(error){ console.error(error); return; }

  const today = startOfDay(now()), week = startOfWeek(now());
  const todayItems = (history||[]).filter(i => new Date(i.completed_at) >= today);
  const weekItems = (history||[]).filter(i => new Date(i.completed_at) >= week);

  els.todayCount.textContent = todayItems.length;
  els.todayMins.textContent = Math.round(todayItems.reduce((s,i)=>s+(i.duration_seconds||0),0)/60);
  els.weekCount.textContent = weekItems.length;
  els.weekMins.textContent = Math.round(weekItems.reduce((s,i)=>s+(i.duration_seconds||0),0)/60);
}

function renderCurrent(){
  if(!current){
    els.currentCard.classList.add("hidden");
    return;
  }
  els.currentCard.classList.remove("hidden");
  const step = catalogSteps.find(s => s.id === current.stepId);
  const task = catalogTasks.find(t => t.id === current.taskId);
  els.currentText.textContent = (task?.name || "") + " — " + (step?.description || "");
  const mm = Math.floor(current.remainingSeconds/60);
  const ss = current.remainingSeconds%60;
  els.timerDisplay.textContent = `${String(mm).padStart(2,"0")}:${String(ss).padStart(2,"0")}`;
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
  if(current.remainingSeconds>0){
    current.remainingSeconds--;
    renderCurrent();
  } else {
    stopTimer();
    toast("Temps écoulé ! ⏰", "success");
    const mins = Math.max(1, Math.round((current.origSeconds || 0) / 60));
    recordCompletion(mins*60);
  }
}

function startTimer(){
  if(!current || current.running) return;
  current.running = true;
  if(!current.origSeconds) current.origSeconds = current.remainingSeconds;
  timerInterval = setInterval(tick,1000);
  renderCurrent();
}

function stopTimer(){
  if(!current) return;
  current.running = false;
  if(timerInterval) { clearInterval(timerInterval); timerInterval = null; }
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
  completedStepIds.push(current.stepId);
  current = null;
  renderAll();
}

/* ============ Piger une étape ============ */
function drawStep(availableMinutes){
  const taskId = els.taskSelect.value;
  if(!taskId){
    toast("Choisis d'abord une tâche.", "error");
    return;
  }

  const eligible = catalogSteps.filter(s =>
    s.task_id === taskId &&
    !completedStepIds.includes(s.id) &&
    (s.duration_seconds || 300) <= availableMinutes*60
  );
  if(eligible.length===0){
    toast("Aucune étape restante de cette tâche ne rentre dans ce temps.", "error");
    return;
  }
  const pick = eligible[Math.floor(Math.random()*eligible.length)];
  current = {
    taskId: pick.task_id,
    stepId: pick.id,
    remainingSeconds: pick.duration_seconds || availableMinutes*60,
    running:false,
    origSeconds: pick.duration_seconds || availableMinutes*60
  };
  renderCurrent();
  els.currentCard.scrollIntoView({behavior:"smooth", block:"center"});
}

/* ============ Auth method toggle ============ */
function switchAuthMethod(method) {
  if (method === "password") {
    els.authFormPassword.classList.remove("hidden");
    els.authFormOtp.classList.add("hidden");
    els.methodPasswordBtn.classList.add("auth-method-active");
    els.methodPasswordBtn.setAttribute("aria-pressed", "true");
    els.methodOtpBtn.classList.remove("auth-method-active");
    els.methodOtpBtn.setAttribute("aria-pressed", "false");
  } else {
    els.authFormOtp.classList.remove("hidden");
    els.authFormPassword.classList.add("hidden");
    els.methodOtpBtn.classList.add("auth-method-active");
    els.methodOtpBtn.setAttribute("aria-pressed", "true");
    els.methodPasswordBtn.classList.remove("auth-method-active");
    els.methodPasswordBtn.setAttribute("aria-pressed", "false");
  }
}

/* ============ Event bindings ============ */
els.methodPasswordBtn.onclick = () => switchAuthMethod("password");
els.methodOtpBtn.onclick = () => switchAuthMethod("otp");
els.authLoginBtn.onclick = loginWithPassword;
els.authEmail.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); loginWithPassword(); } });
els.authPassword.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); loginWithPassword(); } });
els.authSendBtn.onclick = sendMagicLink;
els.authEmailOtp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); sendMagicLink(); } });
els.authLogoutBtn.onclick = logout;
els.categorySelect.addEventListener("change", renderTaskOptions);

els.drawBtn.onclick = ()=> drawStep(parseInt(els.timerMinutes.value,10) || 10);
els.drawShortBtn.onclick = ()=> { els.timerMinutes.value = 5; drawStep(5); };
els.timerMinutes.addEventListener("keydown", (e) => {
  if(e.key === "Enter"){ e.preventDefault(); drawStep(parseInt(els.timerMinutes.value,10) || 10); }
});

els.minusTimeBtn.onclick = ()=> adjustTime(-5*60);
els.plusTimeBtn.onclick = ()=> adjustTime(5*60);
els.startBtn.onclick = startTimer;
els.stopBtn.onclick = ()=> stopTimer();
els.doneBtn.onclick = ()=> {
  if(!current){ toast("Aucune étape en cours.", "error"); return; }
  const secs = Math.max(60, (current.origSeconds || 0) - (current.remainingSeconds || 0)) || current.origSeconds;
  toast(`Étape terminée · ${Math.round(secs/60)} min 🎉`, "success");
  recordCompletion(secs);
};

/* ============ Démarrage : vérifie s'il y a déjà une session ============ */
sb.auth.onAuthStateChange((_event, session) => {
  if(session?.user){ showLoggedIn(session.user); }
  else { showLoggedOut(); }
});

sb.auth.getSession().then(({ data }) => {
  if(data?.session?.user){ showLoggedIn(data.session.user); }
  else { showLoggedOut(); }
});
