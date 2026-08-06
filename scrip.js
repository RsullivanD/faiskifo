// Simple state stored in localStorage under key 'faiskifo_data'
const STORAGE_KEY = "faiskifo_data";

function now() { return new Date(); }
function startOfDay(d){ const x=new Date(d); x.setHours(0,0,0,0); return x; }
function startOfWeek(d){ const x=new Date(d); const day=x.getDay(); const diff = x.getDate() - day + (day===0? -6:1); x.setDate(diff); x.setHours(0,0,0,0); return x; }

let state = { tasks: [], history: [] };

function loadState(){
  const raw = localStorage.getItem(STORAGE_KEY);
  if(raw){
    try{ state = JSON.parse(raw); }catch(e){ console.warn("parse err",e) }
  }
}
function saveState(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function id() { return Math.random().toString(36).slice(2,9); }

/* UI refs */
const els = {
  addTitle: document.getElementById("task-title"),
  stepInput: document.getElementById("step-input"),
  addStepBtn: document.getElementById("add-step-btn"),
  stepsPreview: document.getElementById("steps-preview"),
  stepsEmptyHint: document.getElementById("steps-empty-hint"),
  addBtn: document.getElementById("add-task-btn"),
  tasksList: document.getElementById("tasks-list"),
  drawBtn: document.getElementById("draw-step-btn"),
  drawShortBtn: document.getElementById("random-short-btn"),
  timerMinutes: document.getElementById("timer-minutes"),
  currentCard: document.getElementById("current-step"),
  currentText: document.getElementById("current-step-text"),
  timerDisplay: document.getElementById("timer"),
  startBtn: document.getElementById("start-timer-btn"),
  stopBtn: document.getElementById("stop-timer-btn"),
  doneBtn: document.getElementById("mark-done-btn"),
  todayCount: document.getElementById("today-count"),
  todayMins: document.getElementById("today-mins"),
  weekCount: document.getElementById("week-count"),
  weekMins: document.getElementById("week-mins"),
  exportBtn: document.getElementById("export-btn"),
  importBtn: document.getElementById("import-btn"),
  importFile: document.getElementById("import-file"),
  resetDemoBtn: document.getElementById("reset-demo-btn")
};

let current = null; // {taskId, stepId, remainingSeconds, running, origSeconds}
let timerInterval = null;

/* Étapes en attente pour la tâche en cours de création */
let pendingSteps = [];

function renderStepsPreview(){
  els.stepsPreview.innerHTML = "";
  if(pendingSteps.length === 0){
    els.stepsEmptyHint.classList.remove("hidden");
    return;
  }
  els.stepsEmptyHint.classList.add("hidden");
  pendingSteps.forEach((text, idx) => {
    const li = document.createElement("li");

    const label = document.createElement("span");
    label.innerHTML = `<span class="step-number">${idx + 1}.</span>${text}`;

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "btn-icon-ghost";
    removeBtn.textContent = "✕";
    removeBtn.addEventListener("click", () => {
      pendingSteps.splice(idx, 1);
      renderStepsPreview();
    });

    li.appendChild(label);
    li.appendChild(removeBtn);
    els.stepsPreview.appendChild(li);
  });
}

function addStepFromUI(){
  const text = els.stepInput.value.trim();
  if(!text) return;
  pendingSteps.push(text);
  els.stepInput.value = "";
  els.stepInput.focus();
  renderStepsPreview();
}

/* Renderers */
function renderTasks(){
  els.tasksList.innerHTML = "";
  if(state.tasks.length===0){
    els.tasksList.innerHTML = "<p>Aucune tâche pour l'instant. Ajoute une tâche au-dessus.</p>";
    return;
  }
  state.tasks.forEach(task=>{
    const div = document.createElement("div");
    div.className="task card";
    const title = document.createElement("h3");
    title.textContent = task.title;
    div.appendChild(title);
    task.steps.forEach(step=>{
      const s = document.createElement("div");
      s.className = "step" + (step.done ? " done": "");
      const left = document.createElement("div");
      left.textContent = step.text;
      const right = document.createElement("div");
      const markBtn = document.createElement("button");
      markBtn.textContent = step.done ? "À refaire" : "Marquer terminé";
      markBtn.className = "btn-secondary";
      markBtn.onclick = ()=> {
        step.done = !step.done;
        if(step.done){
          state.history.push({ts: now().toISOString(), minutes: 0, taskId: task.id, stepId: step.id});
        }
        saveState(); renderAll();
      };
      const delBtn = document.createElement("button");
      delBtn.textContent = "Suppr";
      delBtn.className = "btn-icon-ghost";
      delBtn.onclick = ()=> {
        if(confirm("Supprimer cette étape ?")) {
          task.steps = task.steps.filter(x=>x.id!==step.id);
          saveState(); renderAll();
        }
      };
      right.appendChild(markBtn);
      right.appendChild(delBtn);
      s.appendChild(left);
      s.appendChild(right);
      div.appendChild(s);
    });
    const footer = document.createElement("div");
    footer.className = "task-footer";
    const delTaskBtn = document.createElement("button");
    delTaskBtn.textContent = "Supprimer tâche";
    delTaskBtn.className = "btn-danger-ghost";
    delTaskBtn.onclick = ()=> {
      if(confirm("Supprimer la tâche entière ?")) {
        state.tasks = state.tasks.filter(t=>t.id!==task.id);
        saveState(); renderAll();
      }
    };
    footer.appendChild(delTaskBtn);
    div.appendChild(footer);
    els.tasksList.appendChild(div);
  });
}

function renderDashboard(){
  const h = state.history.map(it => ({...it, date:new Date(it.ts)}));
  const today = startOfDay(now()), week = startOfWeek(now());
  const todayItems = h.filter(i => new Date(i.ts) >= today);
  const weekItems = h.filter(i => new Date(i.ts) >= week);
  const todayCount = todayItems.filter(i=>i.minutes>0).length;
  const todayMins = todayItems.reduce((s,i)=>s+i.minutes,0);
  const weekCount = weekItems.filter(i=>i.minutes>0).length;
  const weekMins = weekItems.reduce((s,i)=>s+i.minutes,0);
  els.todayCount.textContent = todayCount;
  els.todayMins.textContent = todayMins;
  els.weekCount.textContent = weekCount;
  els.weekMins.textContent = weekMins;
}

function renderCurrent(){
  if(!current){
    els.currentCard.classList.add("hidden");
    return;
  }
  els.currentCard.classList.remove("hidden");
  const task = state.tasks.find(t=>t.id===current.taskId);
  const step = task?.steps.find(s=>s.id===current.stepId);
  els.currentText.textContent = (task?.title||"") + " — " + (step?.text||"");
  const mm = Math.floor(current.remainingSeconds/60);
  const ss = current.remainingSeconds%60;
  els.timerDisplay.textContent = `${String(mm).padStart(2,"0")}:${String(ss).padStart(2,"0")}`;
  els.startBtn.disabled = current.running;
  els.stopBtn.disabled = !current.running;
}

/* Timer */
function tick(){
  if(!current || !current.running) return;
  if(current.remainingSeconds>0){
    current.remainingSeconds--;
    renderCurrent();
  } else {
    stopTimer();
    alert("Temps écoulé !");
    const mins = Math.max(1, Math.round((current.origSeconds || 0) / 60));
    recordCompletion(mins);
  }
}

function startTimer(){
  if(!current) return;
  if(current.running) return;
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

function recordCompletion(minutes){
  if(!current) return;
  const task = state.tasks.find(t=>t.id===current.taskId);
  const step = task?.steps.find(s=>s.id===current.stepId);
  if(step) step.done = true;
  state.history.push({ts: now().toISOString(), minutes: minutes, taskId: current.taskId, stepId: current.stepId});
  saveState();
  current = null;
  renderAll();
}

/* Draw / add */
function drawStep(minutes){
  const undone = [];
  state.tasks.forEach(task=>{
    task.steps.forEach(step=>{
      if(!step.done) undone.push({taskId:task.id, stepId:step.id, text:step.text});
    });
  });
  if(undone.length===0){
    alert("Aucune étape non terminée. Ajoute des étapes !");
    return;
  }
  const pick = undone[Math.floor(Math.random()*undone.length)];
  current = {taskId: pick.taskId, stepId: pick.stepId, remainingSeconds: minutes*60, running:false, origSeconds: minutes*60};
  renderCurrent();
}

function addTaskFromUI(){
  const title = els.addTitle.value.trim();
  if(!title || pendingSteps.length === 0){
    alert("Titre et au moins une étape sont requis.");
    return;
  }
  const steps = pendingSteps.map(s=>({id:id(), text:s, done:false}));
  const t = {id:id(), title, steps};
  state.tasks.push(t);
  saveState();
  els.addTitle.value = "";
  pendingSteps = [];
  renderStepsPreview();
  renderAll();
}

/* Export / Import functions */
function exportData(){
  const json = JSON.stringify(state, null, 2);
  const blob = new Blob([json], {type: "application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `faiskifo-backup-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function handleImportFile(file){
  const reader = new FileReader();
  reader.onload = () => {
    try{
      const imported = JSON.parse(reader.result);
      if(!imported || typeof imported !== "object" || !Array.isArray(imported.tasks)) {
        alert("Fichier JSON invalide.");
        return;
      }
      if(confirm("Importer ce fichier remplacera les données actuelles. Continuer ?")) {
        state = imported;
        saveState();
        renderAll();
        alert("Importation terminée.");
      }
    } catch(e){
      alert("Erreur en lisant le fichier : " + e.message);
    }
  };
  reader.readAsText(file);
}

/* Event bindings */
els.addStepBtn.onclick = addStepFromUI;
els.stepInput.addEventListener("keydown", (e) => {
  if(e.key === "Enter"){
    e.preventDefault();
    addStepFromUI();
  }
});

els.addBtn.onclick = addTaskFromUI;
els.drawBtn.onclick = ()=> drawStep(parseInt(els.timerMinutes.value||10,10));
els.drawShortBtn.onclick = ()=> { els.timerMinutes.value = 5; drawStep(5); };
els.startBtn.onclick = startTimer;
els.stopBtn.onclick = ()=> { stopTimer(); };
els.doneBtn.onclick = ()=> {
  if(!current){
    alert("Aucune étape en cours — enregistrement impossible.");
    return;
  }
  const auto = Math.max(1, Math.round(((current.origSeconds || 0) - (current.remainingSeconds || 0)) / 60));
  const input = prompt("Minutes passées pour cette étape :", String(auto));
  if(input === null) return;
  const mins = Math.max(1, parseInt(input, 10) || auto);
  recordCompletion(mins);
};

/* Export / Import bindings */
els.exportBtn.onclick = exportData;
els.importBtn.onclick = ()=> els.importFile.click();
els.importFile.onchange = (e) => {
  const f = e.target.files && e.target.files[0];
  if(f) handleImportFile(f);
};

/* Reset demo */
function resetDemo(){
  if(!confirm("Réinitialiser les données de démonstration ? Cela supprimera vos tâches actuelles.")) return;
  state = { tasks: [], history: [] };
  state.tasks.push({
    id:id(),
    title:"Exemple : Nettoyer la cuisine",
    steps:[
      {id:id(), text:"Ranger les ustensiles", done:false},
      {id:id(), text:"Laver la vaisselle (5 min)", done:false},
      {id:id(), text:"Essuyer les comptoirs", done:false}
    ]
  });
  saveState();
  renderAll();
}
els.resetDemoBtn.onclick = resetDemo;

/* Init & demo */
function renderAll(){ saveState(); renderTasks(); renderDashboard(); renderCurrent(); }
loadState();
renderStepsPreview();
renderAll();

if(state.tasks.length===0){
  state.tasks.push({
    id:id(),
    title:"Exemple : Nettoyer la cuisine",
    steps:[
      {id:id(), text:"Ranger les ustensiles", done:false},
      {id:id(), text:"Laver la vaisselle (5 min)", done:false},
      {id:id(), text:"Essuyer les comptoirs", done:false}
    ]
  });
  saveState();
  renderAll();
}