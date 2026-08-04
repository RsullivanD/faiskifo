// Simple state stored in localStorage under key 'faiskifo_data'
const STORAGE_KEY = "faiskifo_data";

function now() { return new Date(); }
function startOfDay(d){ const x=new Date(d); x.setHours(0,0,0,0); return x; }
function startOfWeek(d){ const x=new Date(d); const day=x.getDay(); const diff = x.getDate() - day + (day===0? -6:1); x.setDate(diff); x.setHours(0,0,0,0); return x; }

let state = {
  tasks: [], // {id,title,steps:[{id,text,done}]}
  history: [] // {ts:timestamp, minutes, taskId, stepId}
};

function loadState(){
  const raw = localStorage.getItem(STORAGE_KEY);
  if(raw){
    try{ state = JSON.parse(raw); }catch(e){ console.warn("parse err",e) }
  }
}
function saveState(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

function id() { return Math.random().toString(36).slice(2,9); }

/* UI helpers */
const els = {
  addTitle: document.getElementById("task-title"),
  addSteps: document.getElementById("task-steps"),
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
};

let current = null; // {taskId, stepId, remainingSeconds, running, startedAt}

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
      markBtn.className = "secondary";
      markBtn.onclick = ()=> {
        step.done = !step.done;
        if(step.done){
          state.history.push({ts: now().toISOString(), minutes: 0, taskId: task.id, stepId: step.id});
        }
        saveState();
        renderAll();
      };
      const delBtn = document.createElement("button");
      delBtn.textContent = "Suppr";
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
    // delete task
    const delTaskBtn = document.createElement("button");
    delTaskBtn.textContent = "Supprimer tâche";
    delTaskBtn.onclick = ()=> {
      if(confirm("Supprimer la tâche entière ?")) {
        state.tasks = state.tasks.filter(t=>t.id!==task.id);
        saveState(); renderAll();
      }
    };
    div.appendChild(delTaskBtn);
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

let timerInterval = null;
function tick(){
  if(!current || !current.running) return;
  if(current.remainingSeconds>0){
    current.remainingSeconds--;
    renderCurrent();
  } else {
    // stop and mark finished prompt
    stopTimer();
    alert("Temps écoulé !");
    recordCompletion( Math.max(1, Math.round((current.origSeconds - current.remainingSeconds)/60)) );
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
  // mark step done
  const task = state.tasks.find(t=>t.id===current.taskId);
  const step = task?.steps.find(s=>s.id===current.stepId);
  if(step) step.done = true;
  state.history.push({ts: now().toISOString(), minutes: minutes, taskId: current.taskId, stepId: current.stepId});
  saveState();
  current = null;
  renderAll();
}

function drawStep(minutes){
  // find all undone steps
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
  current = {taskId: pick.taskId, stepId: pick.stepId, remainingSeconds: minutes*60, running:false, origSeconds:minutes*60};
  renderCurrent();
}

function addTaskFromUI(){
  const title = els.addTitle.value.trim();
  const raw = els.addSteps.value.trim();
  if(!title || !raw){ alert("Titre et au moins une étape sont requis."); return; }
  const steps = raw.split("\n").map(line=>line.trim()).filter(Boolean).map(s=>({id:id(), text:s, done:false}));
  const t = {id:id(), title, steps};
  state.tasks.push(t);
  saveState();
  els.addTitle.value = ""; els.addSteps.value = "";
  renderAll();
}

/* Events */
els.addBtn.onclick = addTaskFromUI;
els.drawBtn.onclick = ()=> drawStep(parseInt(els.timerMinutes.value||10,10));
els.drawShortBtn.onclick = ()=> { els.timerMinutes.value = 5; drawStep(5); };
els.startBtn.onclick = startTimer;
els.stopBtn.onclick = ()=> { stopTimer(); };
els.doneBtn.onclick = ()=> {
  const mins = Math.max(1, Math.round((current?.origSeconds - current?.remainingSeconds)/60) || Math.round((parseInt(els.timerMinutes.value,10)) ));
  recordCompletion(mins);
};

/* Init */
function renderAll(){
  saveState();
  renderTasks();
  renderDashboard();
  renderCurrent();
}

loadState();
renderAll();

// For first-time demo, add a sample if empty
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
