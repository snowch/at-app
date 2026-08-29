'use strict';

const PART_META = {
  teaching:    { label: 'Teaching',        hint: 'hear once' },
  orientation: { label: 'Orientation',     hint: 'what this exercise is · hear once' },
  silence:     { label: 'Silent practice', hint: 'chime · silence · chime · close' },
};
const SAFETY_ITEMS = [
  'Psychosis, schizophrenia, or a history of psychotic episodes',
  'Severe depression', 'A dissociative condition',
  'Bipolar disorder in an active phase', 'Active PTSD with intrusive symptoms',
];
const $ = (id) => document.getElementById(id);
const ladderEl=$('ladder'), player=$('player');
const progressEl=$('progress'), fillEl=$('progressFill'), labelEl=$('progressLabel');
const offlineBox=$('offlineBox'), offlineAll=$('offlineAll'), offlineSt=$('offlineStatus');
const modal=$('modal'), modalBody=$('modalBody');
const mini={ root:$('mini'), play:$('miniPlay'), restart:$('miniRestart'), title:$('miniTitle'), seek:$('miniSeek'), cur:$('miniCur'), dur:$('miniDur') };

const STORE='at-progress-v1';
const state=JSON.parse(localStorage.getItem(STORE)||'{}');
state.crit=state.crit||{}; state.ready=state.ready||{};
const save=()=>localStorage.setItem(STORE, JSON.stringify(state));
const hasCaches='caches' in window;
let DATA=null, offlineUrls=[], activeBtn=null;

const fmt=(s)=>(s&&isFinite(s))||s===0?`${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`:'0:00';
const esc=(s)=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const itemById=(id)=>DATA.items.find(it=>it.id===id);
const learned=(id)=>!!state.ready[id];

/* ================= playback ================= */
let session=null;   // {steps,i,timer,paused}
function isSession(){ return !!session; }

/* single-track (orientation / silent practice) */
function setBtn(b,on){ b.classList.toggle('playing',on); b.textContent=on?'❚❚':'▶'; }
function startTrack(btn){
  stopSession();
  if(activeBtn===btn){ player.paused?player.play():player.pause(); return; }
  if(activeBtn) setBtn(activeBtn,false);
  activeBtn=btn; player.src=btn.dataset.src; player.play().catch(e=>console.warn(e));
  mini.title.textContent=btn.dataset.title; mini.root.hidden=false; mini.root.classList.remove('session');
  mini.seek.value=0; mini.cur.textContent='0:00'; mini.dur.textContent='0:00';
}
player.onplay =()=>{ if(!session&&activeBtn) setBtn(activeBtn,true); mini.play.textContent='❚❚'; };
player.onpause=()=>{ if(!session&&activeBtn) setBtn(activeBtn,false); if(!session) mini.play.textContent='▶'; };
player.onloadedmetadata=()=>{ if(!session) mini.dur.textContent=fmt(player.duration); };
player.ontimeupdate=()=>{ if(session||!player.duration) return; mini.seek.value=Math.round(player.currentTime/player.duration*1000); mini.cur.textContent=fmt(player.currentTime); };
player.onended=()=>{ if(session){ if(!session.paused) stepSession(); } else { if(activeBtn) setBtn(activeBtn,false); mini.play.textContent='▶'; } };

/* session runner */
function runSession(steps, title){
  stopSession(); if(activeBtn){ setBtn(activeBtn,false); activeBtn=null; }
  session={steps, i:0, timer:null, paused:false, title};
  mini.root.hidden=false; mini.root.classList.add('session'); mini.play.textContent='❚❚';
  stepSession();
}
function stepSession(){
  if(!session) return;
  if(session.i>=session.steps.length){ endSession(); return; }
  const s=session.steps[session.i++];
  const n=session.steps.length;
  mini.cur.textContent=`${session.title}`; mini.dur.textContent=`${Math.min(session.i,n)}/${n}`;
  if(s.pause){ mini.title.textContent = s.label || '·'; session.timer=setTimeout(()=>{ if(session&&!session.paused) stepSession(); }, s.pause*1000); }
  else { mini.title.textContent = s.label || ''; player.src=DATA.clips[s.key].audio; player.play().catch(()=>{}); }
}
function toggleSession(){
  if(!session) return;
  if(session.paused){ session.paused=false; mini.play.textContent='❚❚';
    if(player.src && player.paused && player.currentTime>0 && !player.ended) player.play(); else stepSession();
  } else { session.paused=true; mini.play.textContent='▶'; clearTimeout(session.timer); if(!player.paused) player.pause(); }
}
function stopSession(){ if(session){ clearTimeout(session.timer); try{player.pause();}catch(e){} session=null; mini.root.classList.remove('session'); mini.root.hidden=true; } }
function endSession(){ stopSession(); }
mini.play.onclick=()=>{ if(session) toggleSession(); else if(player.src) player.paused?player.play():player.pause(); };
mini.restart.onclick=()=>{ if(session) stopSession(); else if(player.src){ player.currentTime=0; player.play(); } };
mini.seek.oninput=()=>{ if(!session && player.duration) player.currentTime=mini.seek.value/1000*player.duration; };

/* ================= build sessions ================= */
const clipText=(k)=>(DATA.clips[k]&&DATA.clips[k].text)||k;
function buildShort(ex, stageIdx){
  const c=DATA.shortExercise, st=ex.stages[stageIdx]||ex.stages[0], steps=[];
  steps.push({key:'settle'},{pause:c.settlePause,label:'·'});
  steps.push({key:'calm',label:clipText('calm')},{pause:3,label:'·'});
  for(let cy=0; cy<c.cycles; cy++){
    for(const fk of st.formulae){
      for(let r=0;r<c.repsPerFormula;r++){ steps.push({key:fk,label:clipText(fk)},{pause:c.formulaPause,label:'·'}); }
    }
    steps.push({key:'qcancel',label:'Cancel — then begin again'},{pause:c.cancelPause,label:'·'});
  }
  return steps;
}
function buildFull(){
  const c=DATA.fullSession, steps=[];
  steps.push({key:'settle'},{pause:6,label:'·'},{key:'calm',label:clipText('calm')},{pause:4,label:'·'});
  const run=[];
  for(const id of c.order){ if(learned(id)){ const ex=itemById(id); if(ex&&ex.collapsed) run.push(ex.collapsed); } }
  if(learned('neck-shoulders')) run.push(c.suffix);
  for(const fk of run){ for(let r=0;r<c.reps;r++){ steps.push({key:fk,label:clipText(fk)},{pause:c.formulaPause,label:'·'}); } }
  steps.push({key:'peace',label:clipText('peace')},{pause:4,label:'·'},{key:'close',label:clipText('close')});
  return steps;
}
function learnedCount(){ return DATA.fullSession.order.filter(learned).length + (learned('neck-shoulders')?1:0); }

/* ================= offline ================= */
const isCached=async(u)=>{ try{ return hasCaches&&!!(await caches.match(u)); }catch{ return false; } };
const ensureCached=async(u)=>{ try{ await fetch(u); }catch(e){ console.warn(e); } };
async function saveForOffline(){ offlineAll.disabled=true; let n=0; for(const u of offlineUrls){ await ensureCached(u); offlineSt.textContent=`saving ${++n} / ${offlineUrls.length}…`; } offlineAll.textContent='✓ Available offline'; offlineSt.textContent=''; }
async function refreshOffline(){ if(!hasCaches||!offlineUrls.length){ offlineBox.hidden=true; return; } offlineBox.hidden=false; let c=0; for(const u of offlineUrls) if(await isCached(u)) c++; if(c===offlineUrls.length){ offlineAll.textContent='✓ Available offline'; offlineAll.disabled=true; } else offlineSt.textContent=`${offlineUrls.length} recordings`; }

/* ================= modals ================= */
function openModal(html){ modalBody.innerHTML=html; modal.hidden=false; }
function closeModal(){ modal.hidden=true; }
$('modalClose').onclick=closeModal; modal.onclick=(e)=>{ if(e.target===modal) closeModal(); };
document.addEventListener('keydown',e=>{ if(e.key==='Escape') closeModal(); });
$('closeBtn').onclick=()=>openModal(`<h3>The close</h3><p>Never skip this. The practice genuinely slows your body down; the close brings it back up before you stand, so you don't feel groggy or lightheaded.</p><ol>${DATA.close.map(s=>`<li>${esc(s)}</li>`).join('')}</ol><p class="muted">The one exception: in bed to fall asleep — then omit the close and let yourself drift.</p>`);
$('principleBtn').onclick=()=>openModal(`<h3>Passive concentration</h3><p>${esc(DATA.corePrinciple)}</p><p>You are not commanding the body or checking whether it worked. Hold the formula lightly and let whatever happens happen — including nothing. The sensations arrive only when you stop requiring them.</p>`);

/* ================= progression ================= */
function toggleCrit(exId,i,box){ const a=state.crit[exId]||[false,false,false,false]; a[i]=!a[i]; state.crit[exId]=a; box.classList.toggle('on',a[i]); box.textContent=a[i]?'✓':''; save(); refreshReady(exId); }
function refreshReady(exId){ const a=state.crit[exId]||[]; const all=a.length===4&&a.every(Boolean); const btn=document.querySelector(`.ready-btn[data-ex="${exId}"]`); if(!btn) return;
  if(state.ready[exId]){ btn.className='ready-btn done'; btn.textContent='✓ Marked ready — you may move on'; }
  else if(all){ btn.className='ready-btn armed'; btn.textContent='All four met — mark ready to move on'; }
  else { btn.className='ready-btn'; btn.textContent='Meet all four criteria (plus one week) to advance'; } }
function markReady(exId){ const a=state.crit[exId]||[]; if(!(a.length===4&&a.every(Boolean))) return; state.ready[exId]=!state.ready[exId]; save(); refreshReady(exId); updateProgress(); refreshCards(); }
function updateProgress(){ const exs=DATA.items.filter(it=>it.type==='exercise'); const done=exs.filter(it=>state.ready[it.id]).length;
  fillEl.style.width=(exs.length?Math.round(done/exs.length*100):0)+'%';
  labelEl.textContent=done===0?`Your progress · start with Exercise 1, Heaviness`:`Your progress · ${done} of ${exs.length} exercises worked through`;
  progressEl.hidden=false; }
function refreshCards(){ ladderEl.querySelectorAll('.card.exercise').forEach(c=>c.classList.toggle('done-all', state.ready[c.dataset.ex])); }

/* ================= render ================= */
function partRow(base,key,part,title){
  const m=PART_META[key]||{label:key,hint:''};
  if(part.status!=='built'||!part.audio) return `<li class="part planned"><span class="play">▶</span><div class="part-main"><div class="part-label">${m.label}</div><div class="part-meta">${m.hint}</div></div><span class="soon">coming soon</span></li>`;
  offlineUrls.push(part.audio.split('#')[0]);
  return `<li class="part"><button class="play" data-src="${part.audio}" data-title="${esc(title+' · '+m.label)}">▶</button><div class="part-main"><div class="part-label">${m.label}</div><div class="part-meta">${m.hint}${part.durationSec?' · '+fmt(part.durationSec):''}</div></div></li>`;
}
function practiceBlock(item){
  if(!item.stages) return '';
  const multi=item.stages.length>1;
  const stageBtns=item.stages.map((s,i)=>`<button class="stage ${i===0?'on':''}" data-ex="${item.id}" data-stage="${i}">${esc(s.label)}</button>`).join('');
  return `<div class="practice"><span class="crit-label">Practise — the short exercise</span>`+
    (multi?`<div class="stages-row">${stageBtns}</div>`:'')+
    `<p class="practice-hint">Three cycles of the formula, each ending in a cancel — the beginner drill. ${multi?'Pick the stage you are on.':''}</p>`+
    `<button class="start-btn" data-ex="${item.id}">▶ Start short exercise</button></div>`;
}
function critBlock(item){
  const a=state.crit[item.id]||[false,false,false,false];
  return `<div class="crit"><span class="crit-label">Tick each as it becomes true — ready to move on when all four are</span><ul>`+
    DATA.progressionCriteria.map((c,i)=>`<li class="crit-item" data-ex="${item.id}" data-i="${i}"><button class="box ${a[i]?'on':''}">${a[i]?'✓':''}</button><span>${esc(c)}</span></li>`).join('')+
    `</ul><button class="ready-btn" data-ex="${item.id}"></button></div>`;
}
function card(item){
  const isEx=item.type==='exercise';
  const badges=isEx?`<span class="badge ex">Exercise ${item.exercise}</span><span class="badge week">Week ${item.week}</span>${item.skippable?'<span class="badge">skippable</span>':''}`:`<span class="badge">${item.safety?'Safety':'Orientation'}</span>`;
  const formula=item.formula?`<div class="formula">${esc(item.formula)}</div>`:'';
  const caution=item.caution?`<div class="caution"><b>Caution.</b> ${esc(item.caution)}</div>`:'';
  const note=item.note?`<p class="expands">${esc(item.note)}</p>`:'';
  const prereq=(item.prerequisites&&item.prerequisites.length)?`<div class="prereq"><span class="prereq-label">Before you begin</span><ul>${item.prerequisites.map(p=>`<li>${esc(p)}</li>`).join('')}</ul></div>`:'';
  const parts=['teaching','orientation','silence'].filter(k=>item.parts&&item.parts[k]).map(k=>partRow(item.id,k,item.parts[k],item.title)).join('');
  return `<article class="card ${item.type}" ${isEx?`data-ex="${item.id}"`:''}><div class="card-head"><div class="seq">${item.seq}</div><div class="card-title"><div class="badges">${badges}</div><h2>${esc(item.title)}</h2></div></div>`+
    formula+note+caution+prereq+(parts?`<ul class="parts">${parts}</ul>`:'')+(isEx?practiceBlock(item)+critBlock(item):'')+`</article>`;
}
function renderLadder(){
  offlineUrls=[]; Object.values(DATA.clips).forEach(c=>offlineUrls.push(c.audio.split('#')[0]));
  let prev=null, html='';
  DATA.items.forEach((item,i)=>{
    if(i===0) html+=`<div class="section">Begin here</div>`;
    else if(item.type==='exercise'&&prev!=='exercise') html+=`<div class="section">The six exercises</div>`;
    else if(item.type==='orientation'&&prev==='exercise') html+=`<div class="section">Beyond the six</div>`;
    prev=item.type; html+=card(item);
  });
  ladderEl.innerHTML=html;
  ladderEl.querySelectorAll('.play[data-src]').forEach(b=>b.addEventListener('click',()=>startTrack(b)));
  ladderEl.querySelectorAll('.crit-item').forEach(li=>li.addEventListener('click',()=>toggleCrit(li.dataset.ex,+li.dataset.i,li.querySelector('.box'))));
  ladderEl.querySelectorAll('.ready-btn[data-ex]').forEach(b=>b.addEventListener('click',()=>markReady(b.dataset.ex)));
  ladderEl.querySelectorAll('.stage').forEach(b=>b.addEventListener('click',()=>{
    ladderEl.querySelectorAll(`.stage[data-ex="${b.dataset.ex}"]`).forEach(x=>x.classList.remove('on')); b.classList.add('on');
  }));
  ladderEl.querySelectorAll('.start-btn').forEach(b=>b.addEventListener('click',()=>{
    const ex=itemById(b.dataset.ex); const sel=ladderEl.querySelector(`.stage[data-ex="${b.dataset.ex}"].on`); const idx=sel?+sel.dataset.stage:0;
    runSession(buildShort(ex,idx), ex.title);
  }));
  DATA.items.filter(it=>it.type==='exercise').forEach(it=>refreshReady(it.id));
  updateProgress(); refreshCards(); refreshOffline();
}

/* full session toolbar button */
$('fullBtn') && ($('fullBtn').onclick=()=>{
  if(learnedCount()===0){ openModal(`<h3>Full session</h3><p>Once you've marked an exercise or two as ready, this builds a full session from everything you've learned — run in sequence, with a single close at the end.</p>`); return; }
  runSession(buildFull(), 'Full session');
});

/* safety gate */
function safetyGate(){ $('safetyList').innerHTML=SAFETY_ITEMS.map(s=>`<li>${esc(s)}</li>`).join(''); const g=$('safetyGate'),chk=$('safetyCheck'),go=$('safetyProceed'); chk.onchange=()=>{ go.disabled=!chk.checked; }; go.onclick=()=>{ state.safetyAck=true; save(); g.hidden=true; }; g.hidden=false; }

async function init(){
  try{
    const res=await fetch('manifest.json',{cache:'no-cache'}); if(!res.ok) throw new Error(res.status);
    DATA=await res.json(); renderLadder(); offlineAll.addEventListener('click',saveForOffline);
    if(!state.safetyAck) safetyGate();
  }catch(e){ ladderEl.innerHTML=`<p class="loading">Could not load (${e.message}).</p>`; }
}
if('serviceWorker' in navigator){ window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(e=>console.warn(e))); }
init();
