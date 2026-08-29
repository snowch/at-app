'use strict';

const PART_META = {
  teaching:    { label: 'Teaching',       hint: 'hear once' },
  orientation: { label: 'Orientation',    hint: 'what this exercise is · hear once' },
  guided:      { label: 'Guided session', hint: 'for the first several days' },
  timed:       { label: 'Timed cues',     hint: 'structure only — you supply the formulae' },
  silence:     { label: 'Silent practice',hint: 'chime · silence · chime · close' },
};
const PART_ORDER = ['teaching', 'orientation', 'guided', 'timed', 'silence'];
const SAFETY_ITEMS = [
  'Psychosis, schizophrenia, or a history of psychotic episodes',
  'Severe depression',
  'A dissociative condition',
  'Bipolar disorder in an active phase',
  'Active PTSD with intrusive symptoms',
];

const $ = (id) => document.getElementById(id);
const ladderEl = $('ladder'), player = $('player');
const progressEl = $('progress'), fillEl = $('progressFill'), labelEl = $('progressLabel');
const offlineBox = $('offlineBox'), offlineAll = $('offlineAll'), offlineSt = $('offlineStatus');
const modal = $('modal'), modalBody = $('modalBody');
const mini = { root:$('mini'), play:$('miniPlay'), restart:$('miniRestart'), title:$('miniTitle'), seek:$('miniSeek'), cur:$('miniCur'), dur:$('miniDur') };

const STORE = 'at-progress-v1';
const state = JSON.parse(localStorage.getItem(STORE) || '{}');
state.crit = state.crit || {};   // {exId: [bool,bool,bool,bool]}
state.ready = state.ready || {};  // {exId: true}
const save = () => localStorage.setItem(STORE, JSON.stringify(state));
const hasCaches = 'caches' in window;

let DATA = null, offlineUrls = [], activeBtn = null;
const fmt = (s) => (s && isFinite(s)) || s === 0 ? `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}` : '0:00';
const esc = (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

/* ---------- player ---------- */
function setBtn(b, on){ b.classList.toggle('playing', on); b.textContent = on ? '❚❚' : '▶'; }
function startTrack(btn){
  if (activeBtn === btn){ player.paused ? player.play() : player.pause(); return; }
  if (activeBtn) setBtn(activeBtn, false);
  activeBtn = btn; player.src = btn.dataset.src;
  player.play().catch(e=>console.warn(e));
  mini.title.textContent = btn.dataset.title; mini.root.hidden = false;
  mini.seek.value = 0; mini.cur.textContent='0:00'; mini.dur.textContent='0:00';
}
player.onplay  = ()=>{ if(activeBtn) setBtn(activeBtn,true);  mini.play.textContent='❚❚'; };
player.onpause = ()=>{ if(activeBtn) setBtn(activeBtn,false); mini.play.textContent='▶'; };
player.onended = ()=>{ if(activeBtn) setBtn(activeBtn,false); mini.play.textContent='▶'; };
player.onloadedmetadata = ()=>{ mini.dur.textContent = fmt(player.duration); };
player.ontimeupdate = ()=>{ if(!player.duration) return; mini.seek.value = Math.round(player.currentTime/player.duration*1000); mini.cur.textContent = fmt(player.currentTime); };
mini.play.onclick = ()=>{ if(player.src) player.paused?player.play():player.pause(); };
mini.restart.onclick = ()=>{ if(player.src){ player.currentTime=0; player.play(); } };
mini.seek.oninput = ()=>{ if(player.duration) player.currentTime = mini.seek.value/1000*player.duration; };

/* ---------- offline ---------- */
const isCached = async (u)=>{ try { return hasCaches && !!(await caches.match(u)); } catch { return false; } };
const ensureCached = async (u)=>{ try { await fetch(u); } catch(e){ console.warn(e); } };
async function saveForOffline(){
  offlineAll.disabled = true; let n=0;
  for (const u of offlineUrls){ await ensureCached(u); offlineSt.textContent = `saving ${++n} / ${offlineUrls.length}…`; }
  offlineAll.textContent = '✓ Available offline'; offlineSt.textContent = '';
}
async function refreshOffline(){
  if(!hasCaches || !offlineUrls.length){ offlineBox.hidden = true; return; }
  offlineBox.hidden = false; let c=0;
  for (const u of offlineUrls) if (await isCached(u)) c++;
  if (c===offlineUrls.length){ offlineAll.textContent='✓ Available offline'; offlineAll.disabled=true; }
  else offlineSt.textContent = `${offlineUrls.length} recordings`;
}

/* ---------- modals ---------- */
function openModal(html){ modalBody.innerHTML = html; modal.hidden = false; }
function closeModal(){ modal.hidden = true; }
$('modalClose').onclick = closeModal;
modal.onclick = (e)=>{ if(e.target===modal) closeModal(); };
document.addEventListener('keydown', e=>{ if(e.key==='Escape'){ closeModal(); } });

$('closeBtn').onclick = ()=> openModal(
  `<h3>The close</h3><p>Never skip this. The practice genuinely slows your body down; the close brings it back up before you stand, so you don't feel groggy or lightheaded.</p>` +
  `<ol>${DATA.close.map(s=>`<li>${esc(s)}</li>`).join('')}</ol>` +
  `<p class="muted">The one exception: practising in bed to fall asleep — then you omit the close and let yourself drift.</p>`);
$('principleBtn').onclick = ()=> openModal(
  `<h3>Passive concentration</h3><p>${esc(DATA.corePrinciple)}</p>` +
  `<p>You are not commanding the body or checking whether it worked. You hold the formula lightly and let whatever happens happen — including nothing. The sensations arrive only when you stop requiring them.</p>` +
  `<p class="muted">When you catch yourself trying, don't try harder in a more relaxed way — let go of the outcome entirely and return to the words.</p>`);

/* ---------- progression checklist ---------- */
function toggleCrit(exId, i, el){
  const arr = state.crit[exId] || [false,false,false,false];
  arr[i] = !arr[i]; state.crit[exId] = arr;
  el.classList.toggle('on', arr[i]); el.textContent = arr[i] ? '✓' : '';
  save(); refreshReady(exId);
}
function refreshReady(exId){
  const arr = state.crit[exId] || [];
  const all = arr.length===4 && arr.every(Boolean);
  const btn = document.querySelector(`.ready-btn[data-ex="${exId}"]`);
  if(!btn) return;
  if(state.ready[exId]){ btn.className='ready-btn done'; btn.textContent='✓ Marked ready — you may move on'; }
  else if(all){ btn.className='ready-btn armed'; btn.textContent='All four met — mark ready to move on'; }
  else { btn.className='ready-btn'; btn.textContent='Meet all four criteria (plus one week) to advance'; }
}
function markReady(exId){
  const arr = state.crit[exId] || [];
  if(!(arr.length===4 && arr.every(Boolean))) return;
  state.ready[exId] = !state.ready[exId]; save(); refreshReady(exId); updateProgress(); refreshCards();
}

function updateProgress(){
  const exs = DATA.items.filter(it=>it.type==='exercise');
  const done = exs.filter(it=>state.ready[it.id]).length;
  fillEl.style.width = (exs.length ? Math.round(done/exs.length*100) : 0)+'%';
  labelEl.textContent = done === 0
    ? `Your progress · start with Exercise 1, Heaviness`
    : `Your progress · ${done} of ${exs.length} exercises worked through`;
  progressEl.hidden = false;
}
function refreshCards(){
  ladderEl.querySelectorAll('.card.exercise').forEach(c=>{
    c.classList.toggle('done-all', state.ready[c.dataset.ex]);
  });
}

/* ---------- render ---------- */
const plannedRow = (m)=>`<li class="part planned"><span class="play">▶</span><div class="part-main"><div class="part-label">${m.label}</div><div class="part-meta">${m.hint}</div></div><span class="soon">coming soon</span></li>`;
function partRow(base, key, part, title){
  const m = PART_META[key] || {label:key, hint:''};
  if(part.status!=='built' || !part.audio) return plannedRow(m);
  offlineUrls.push(part.audio);
  const lbl = `${title} · ${m.label}`;
  return `<li class="part"><button class="play" data-src="${part.audio}" data-title="${esc(lbl)}" aria-label="Play ${m.label}">▶</button>`+
    `<div class="part-main"><div class="part-label">${m.label}</div><div class="part-meta">${m.hint}${part.durationSec?' · '+fmt(part.durationSec):''}</div></div></li>`;
}
function card(item){
  const isEx = item.type==='exercise';
  const badges = isEx
    ? `<span class="badge ex">Exercise ${item.exercise}</span><span class="badge week">Week ${item.week}</span>${item.skippable?'<span class="badge">skippable</span>':''}`
    : `<span class="badge">${item.safety?'Safety':'Orientation'}</span>`;
  const formula = item.formula ? `<div class="formula">${esc(item.formula)}</div>${item.expands?`<p class="expands">Expands: ${esc(item.expands)}</p>`:''}` : '';
  const caution = item.caution ? `<div class="caution"><b>Caution.</b> ${esc(item.caution)}</div>` : '';
  const note = item.note ? `<p class="expands">${esc(item.note)}</p>` : '';
  const prereq = (item.prerequisites&&item.prerequisites.length)
    ? `<div class="prereq"><span class="prereq-label">Before you begin</span><ul>${item.prerequisites.map(p=>`<li>${esc(p)}</li>`).join('')}</ul></div>` : '';
  const parts = PART_ORDER.filter(k=>item.parts[k]).map(k=>partRow(item.id,k,item.parts[k],item.title)).join('');
  // progression checklist for exercises
  let crit = '';
  if(isEx){
    const arr = state.crit[item.id] || [false,false,false,false];
    crit = `<div class="crit"><span class="crit-label">Ready to move on when all four are true</span><ul>`+
      DATA.progressionCriteria.map((c,i)=>`<li><button class="box ${arr[i]?'on':''}" data-ex="${item.id}" data-i="${i}">${arr[i]?'✓':''}</button><span>${esc(c)}</span></li>`).join('')+
      `</ul><button class="ready-btn" data-ex="${item.id}"></button></div>`;
  }
  return `<article class="card ${item.type}" ${isEx?`data-ex="${item.id}"`:''}>`+
    `<div class="card-head"><div class="seq">${item.seq}</div><div class="card-title"><div class="badges">${badges}</div><h2>${esc(item.title)}</h2></div></div>`+
    formula+note+caution+prereq+`<ul class="parts">${parts}</ul>`+crit+`</article>`;
}

function renderLadder(){
  offlineUrls = [];
  let prev = null, html = '';
  DATA.items.forEach((item,i)=>{
    if(i===0) html += `<div class="section">Begin here</div>`;
    else if(item.type==='exercise' && prev!=='exercise') html += `<div class="section">The six exercises</div>`;
    else if(item.type==='orientation' && prev==='exercise') html += `<div class="section">Beyond the six</div>`;
    prev = item.type; html += card(item);
  });
  ladderEl.innerHTML = html;
  ladderEl.querySelectorAll('.play[data-src]').forEach(b=> b.addEventListener('click',()=>startTrack(b)));
  ladderEl.querySelectorAll('.box[data-ex]').forEach(b=> b.addEventListener('click',()=>toggleCrit(b.dataset.ex, +b.dataset.i, b)));
  ladderEl.querySelectorAll('.ready-btn[data-ex]').forEach(b=> b.addEventListener('click',()=>markReady(b.dataset.ex)));
  DATA.items.filter(it=>it.type==='exercise').forEach(it=>refreshReady(it.id));
  updateProgress(); refreshCards(); refreshOffline();
}

/* ---------- safety gate ---------- */
function safetyGate(){
  $('safetyList').innerHTML = SAFETY_ITEMS.map(s=>`<li>${esc(s)}</li>`).join('');
  const gate = $('safetyGate'), chk = $('safetyCheck'), go = $('safetyProceed');
  chk.onchange = ()=>{ go.disabled = !chk.checked; };
  go.onclick = ()=>{ state.safetyAck = true; save(); gate.hidden = true; };
  gate.hidden = false;
}

async function init(){
  try {
    const res = await fetch('manifest.json', {cache:'no-cache'});
    if(!res.ok) throw new Error(res.status);
    DATA = await res.json();
    renderLadder();
    offlineAll.addEventListener('click', saveForOffline);
    if(!state.safetyAck) safetyGate();
  } catch(e){ ladderEl.innerHTML = `<p class="loading">Could not load (${e.message}).</p>`; }
}
if('serviceWorker' in navigator){ window.addEventListener('load', ()=> navigator.serviceWorker.register('sw.js').catch(e=>console.warn(e))); }
init();
