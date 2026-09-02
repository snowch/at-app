'use strict';

const PART_META = {
  teaching:    { label: 'Teaching',        hint: 'hear once' },
  orientation: { label: 'Orientation',     hint: 'what this exercise is · hear once' },
  silence:     { label: 'Silent practice', hint: 'unaided · for the final days, once you know it · chime, silence, chime, close' },
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
state.log=Array.isArray(state.log)?state.log:[];   // practice log: {t, ex, s:'yes'|'partly'|'no', note}
const save=()=>localStorage.setItem(STORE, JSON.stringify(state));
const hasCaches='caches' in window;
let DATA=null, offlineUrls=[], activeBtn=null;

const fmt=(s)=>(s&&isFinite(s))||s===0?`${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`:'0:00';
const esc=(s)=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const itemById=(id)=>DATA.items.find(it=>it.id===id);
const learned=(id)=>!!state.ready[id];
const exTitle=(id)=> id==='full' ? 'Full session' : ((itemById(id)||{}).title || id);

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
const stepDur=(s)=> s.pause ? s.pause : ((DATA.clips[s.key]&&DATA.clips[s.key].durationSec)||2);
function sessionTick(){
  if(!session) return;
  if(!session.paused){ const now=performance.now(); session.elapsed=Math.min(session.total, session.elapsed+(now-session.lastTick)/1000); }
  session.lastTick=performance.now();
  const pct=session.total? Math.round(session.elapsed/session.total*1000):0;
  mini.seek.value=pct; mini.cur.textContent=fmt(session.elapsed); mini.dur.textContent=fmt(session.total);
}
function runSession(steps, title, exId, sleep){
  stopSession(); if(activeBtn){ setBtn(activeBtn,false); activeBtn=null; }
  const total=steps.reduce((a,s)=>a+stepDur(s),0);
  session={steps, i:0, timer:null, paused:false, title, exId, sleep:!!sleep, total, elapsed:0, lastTick:performance.now(), ticker:null};
  mini.root.hidden=false; mini.root.classList.add('session'); mini.play.textContent='❚❚';
  mini.title.textContent=title; mini.seek.value=0; mini.cur.textContent='0:00'; mini.dur.textContent=fmt(total);
  session.ticker=setInterval(sessionTick, 250);
  stepSession();
}
function stepSession(){
  if(!session) return;
  if(session.i>=session.steps.length){ endSession(); return; }
  const s=session.steps[session.i++];
  if(s.pause){ session.timer=setTimeout(()=>{ if(session&&!session.paused) stepSession(); }, s.pause*1000); }
  else { player.src=DATA.clips[s.key].audio; player.play().catch(()=>{}); }
}
function toggleSession(){
  if(!session) return;
  if(session.paused){ session.paused=false; session.lastTick=performance.now(); mini.play.textContent='❚❚';
    if(player.src && player.paused && player.currentTime>0 && !player.ended) player.play(); else stepSession();
  } else { session.paused=true; mini.play.textContent='▶'; clearTimeout(session.timer); if(!player.paused) player.pause(); }
}
function stopSession(){ if(session){ clearTimeout(session.timer); clearInterval(session.ticker); try{player.pause();}catch(e){} session=null; mini.root.classList.remove('session'); mini.root.hidden=true; } }
function endSession(){ let ex=null, sleep=false; if(session){ session.elapsed=session.total; sessionTick(); ex=session.exId; sleep=session.sleep; } stopSession(); if(ex && !sleep) setTimeout(()=>promptLog(ex,true), 500); }
mini.play.onclick=()=>{ if(session) toggleSession(); else if(player.src) player.paused?player.play():player.pause(); };
mini.restart.onclick=()=>{ if(session) stopSession(); else if(player.src){ player.currentTime=0; player.play(); } };
mini.seek.oninput=()=>{ if(!session && player.duration) player.currentTime=mini.seek.value/1000*player.duration; };

/* ================= build sessions ================= */
const clipText=(k)=>(DATA.clips[k]&&DATA.clips[k].text)||k;
const LEARN_ORDER=['heaviness','warmth','heartbeat','neck-shoulders','breathing','solar-plexus','forehead'];
const isOnboarding=(ex,stageIdx)=> ex.id==='heaviness' && (stageIdx||0)===0;
// Shared opening for every guided session: settle into position, a detailed
// body scan, then the calming formula. The clips now carry their own internal
// pacing, so the gaps between them are short.
function openingSteps(){ return [{key:'settle'},{pause:3},{key:'scan'},{pause:4},{key:'calm'},{pause:3}]; }
// Very first formula: the pure repetition drill — 3 cycles of [formula ×3 → cancel]
function buildOnboarding(){
  const c=DATA.shortExercise, steps=openingSteps();
  for(let cy=0;cy<c.cycles;cy++){
    for(let r=0;r<c.repsPerFormula;r++){ steps.push({key:'hv_rarm'},{pause:c.formulaPause}); }
    const lastCycle = cy===c.cycles-1;
    if(lastCycle) steps.push({key:'close'});                    // final cancel = full close (with the switch phrase)
    else steps.push({key:'qcancel'},{pause:c.cancelPause});     // between cycles = quick cancel
  }
  return steps;
}
// Cumulative: everything learned so far (collapsed), then the current exercise (expanded), one close
function buildCumulative(ex, stageIdx){
  const c=DATA.shortExercise;
  const upto=LEARN_ORDER.slice(0, LEARN_ORDER.indexOf(ex.id)+1);
  let seq=DATA.fullSession.order.filter(id=>upto.includes(id));
  if(upto.includes('neck-shoulders')) seq.push('neck-shoulders');   // suffix, always last
  const steps=openingSteps();
  for(const id of seq){
    const it=itemById(id); const cur=id===ex.id;
    const formulae=cur?((ex.stages[stageIdx]||ex.stages[0]).formulae):[it.collapsed];
    const reps=cur?c.repsPerFormula:3;
    for(const fk of formulae){ for(let r=0;r<reps;r++){ steps.push({key:fk},{pause:c.formulaPause}); } }
  }
  if(upto.includes('neck-shoulders')){ for(let r=0;r<3;r++) steps.push({key:'peace'},{pause:3}); }
  steps.push({key:'close'});
  return steps;
}
function buildShort(ex, stageIdx){ return isOnboarding(ex,stageIdx) ? buildOnboarding() : buildCumulative(ex, stageIdx||0); }
// For falling asleep: run the settled cumulative pass, but leave the close out and drift (never the beginner drill).
const stripClose=(steps)=>{ const s=steps.slice(); if(s.length && s[s.length-1].key==='close') s.pop(); return s; };
function buildSleep(ex, stageIdx){ return stripClose(buildCumulative(ex, stageIdx||0)); }
function buildFull(){
  const c=DATA.fullSession, steps=[];
  steps.push(...openingSteps());
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

/* ================= practice log ================= */
const DAY=86400000;
const S_LABEL={yes:'On its own', partly:'Partly', no:'Not yet'};
const logFor=(id)=> state.log.filter(e=>e.ex===id).sort((a,b)=>b.t-a.t);
function weekStat(id){ const now=Date.now(); const es=state.log.filter(e=>e.ex===id && now-e.t < 7*DAY); return { n:es.length, came:es.filter(e=>e.s==='yes').length }; }
function dayKey(t){ const d=new Date(t); return d.getFullYear()+'-'+d.getMonth()+'-'+d.getDate(); }
function todayCount(){ const k=dayKey(Date.now()); return state.log.filter(e=>dayKey(e.t)===k).length; }
function streak(){ const days=new Set(state.log.map(e=>dayKey(e.t))); if(!days.size) return 0;
  let s=0, c=new Date(); if(!days.has(dayKey(c.getTime()))) c.setDate(c.getDate()-1);
  while(days.has(dayKey(c.getTime()))){ s++; c.setDate(c.getDate()-1); } return s; }
function fmtWhen(t){ const d=new Date(t), now=new Date(), y=new Date(); y.setDate(now.getDate()-1);
  const hh=String(d.getHours()).padStart(2,'0'), mm=String(d.getMinutes()).padStart(2,'0');
  if(d.toDateString()===now.toDateString()) return `Today ${hh}:${mm}`;
  if(d.toDateString()===y.toDateString()) return `Yesterday ${hh}:${mm}`;
  return d.toLocaleDateString(undefined,{month:'short',day:'numeric'})+` ${hh}:${mm}`; }

/* the 30-second log sheet, shown after a session or from a card */
function promptLog(exId, postSession){
  const title=esc(exTitle(exId));
  const lead = postSession
    ? `That completes the session shape — <strong>position, settle, formula, close, log</strong>. Thirty seconds now makes your progress real.`
    : `Thirty seconds — the step that makes progress visible.`;
  openModal(`<h3>Log your practice</h3><p>${lead}</p>`+
    `<p class="log-for">${title}</p>`+
    `<div class="log-q">Did the sensation come?</div>`+
    `<div class="log-opts">`+
      Object.keys(S_LABEL).map(k=>`<button class="log-opt" data-s="${k}">${S_LABEL[k]}</button>`).join('')+
    `</div>`+
    `<textarea class="log-note" id="logNote" rows="2" placeholder="Anything you noticed — sensations, distractions, how you felt after (optional)"></textarea>`+
    `<div class="log-actions"><button class="log-skip" id="logSkip">Skip</button><button class="log-save" id="logSave" disabled>Save entry</button></div>`+
    `<p class="log-priv">Kept only on this device.</p>`);
  let sel=null; const saveBtn=$('logSave');
  modalBody.querySelectorAll('.log-opt').forEach(b=>b.onclick=()=>{ sel=b.dataset.s; modalBody.querySelectorAll('.log-opt').forEach(x=>x.classList.toggle('on',x===b)); saveBtn.disabled=false; });
  $('logSkip').onclick=closeModal;
  saveBtn.onclick=()=>{ if(!sel) return; state.log.push({t:Date.now(), ex:exId, s:sel, note:($('logNote').value||'').trim().slice(0,500)}); save(); closeModal(); if(itemById(exId)) refreshEvidence(exId); };
}

/* evidence line shown in the progression block */
function evidenceHtml(id){
  const total=logFor(id).length; if(!total) return `No practices logged yet — tap “Log a practice” after you sit.`;
  const w=weekStat(id);
  const s = w.n ? `came on its own in <strong>${w.came}</strong> of your last <strong>${w.n}</strong> this week` : `${total} logged`;
  return `Your log · ${s} · <button class="log-view" data-ex="${id}">view all</button>`;
}
function refreshEvidence(id){ const el=ladderEl.querySelector(`.log-ev[data-ex="${id}"]`); if(!el) return; el.innerHTML=evidenceHtml(id); const v=el.querySelector('.log-view'); if(v) v.onclick=()=>openLogModal(id); }

/* history modal — one exercise, or the whole log */
function logListHtml(exId){
  const es = exId ? logFor(exId) : [...state.log].sort((a,b)=>b.t-a.t);
  if(!es.length) return `<p class="muted">No entries yet. After a practice, tap “Log a practice”.</p>`;
  return `<ul class="log-list">`+es.map(e=>`<li class="log-item"><div class="log-item-h">`+
    `<span class="log-badge ${e.s}">${S_LABEL[e.s]||e.s}</span>`+
    (exId?'':`<span class="log-ex">${esc(exTitle(e.ex))}</span>`)+
    `<span class="log-when">${fmtWhen(e.t)}</span>`+
    `<button class="log-del" data-t="${e.t}" aria-label="Delete entry">✕</button></div>`+
    (e.note?`<div class="log-item-note">${esc(e.note)}</div>`:'')+`</li>`).join('')+`</ul>`;
}
function wireLogList(exId){
  modalBody.querySelectorAll('.log-del').forEach(b=>b.onclick=()=>{ const t=+b.dataset.t; state.log=state.log.filter(e=>e.t!==t); save();
    const wrap=$('logListWrap'); if(wrap){ wrap.innerHTML=logListHtml(exId); wireLogList(exId); } const h=$('logHead'); if(h) h.innerHTML=logHeadHtml();
    DATA.items.filter(it=>it.type==='exercise').forEach(it=>refreshEvidence(it.id)); });
}
function logHeadHtml(){ return `Aim for three short practices a day. <strong>${todayCount()}</strong> today${streak()>1?` · ${streak()}-day streak`:''}.`; }
function openLogModal(exId){
  const heading = exId ? `${esc(exTitle(exId))} — log` : 'Practice log';
  const head = exId ? `<p>Ticking your progression is honest when the log backs it up.</p>` : `<p id="logHead">${logHeadHtml()}</p>`;
  openModal(`<h3>${heading}</h3>${head}<div id="logListWrap">${logListHtml(exId)}</div>`+
    `<p class="log-priv">Your log is kept only on this device — nothing is uploaded. Clearing the app’s site data erases it.</p>`);
  wireLogList(exId);
}

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
  const hint = item.id==='heaviness'
    ? 'Days 1–3: three cycles of the formula, each ending in a cancel — the beginner drill. Later stages run as one settled pass.'
    : 'Runs the exercises you have already learned (in short form), then this one, and ends with the close — building each time.';
  return `<div class="practice"><span class="crit-label">Practise</span>`+
    (multi?`<div class="stages-row">${stageBtns}</div>`:'')+
    `<p class="practice-hint">${hint} ${multi?'Pick the stage you are on.':''}</p>`+
    `<button class="start-btn" data-ex="${item.id}">▶ Start practice</button>`+
    `<button class="sleep-btn" data-ex="${item.id}">☾ To fall asleep — no close</button>`+
    `<p class="sleep-note">Use this only lying in bed to fall asleep — it omits the close and lets you drift. Any other time, always finish with the close.</p>`+
    `<button class="card-btn" data-ex="${item.id}">▤ Practice card — run it from memory</button>`+
    `<button class="card-btn log-btn" data-ex="${item.id}">✎ Log a practice</button></div>`;
}
function practiceCardHtml(item){
  const formulae = item.stages.map(s=>s.formulae.map(clipText).join(', ')).join(' → ');
  const c=DATA.shortExercise;
  return `<h3>${esc(item.title)} — practice card</h3>`+
    `<p><strong>Position.</strong> Lie on your back or sit well supported — symmetrical, fully supported, nothing held. One slow breath, and let the eyes close.</p>`+
    `<p><strong>Body scan.</strong> A slow, passive sweep, changing nothing: forehead and face, jaw, neck and shoulders; each arm to the fingertips; chest and abdomen; the whole back; each leg to the toes; then the whole body, at rest.</p>`+
    `<p><strong>Formula.</strong> <em>“${esc(item.formula)}”</em>${item.expands?`<br><span class="muted">expands: ${esc(item.expands)}</span>`:''}</p>`+
    (item.id==='heaviness'
      ? `<p><strong>The short exercise (days 1–3).</strong> ${c.cycles} cycles, each: the formula ×${c.repsPerFormula}, then a quick cancel.</p>`
      : `<p><strong>The short exercise.</strong> First run the exercises you already know, each in its short form (e.g. “Arms and legs are heavy” ×3), then work this one — <em>“${esc(item.formula)}”</em> and its expansion — ${c.repsPerFormula}× each. One close at the end.</p>`)+
    (item.week>=5?`<p><strong>The tail.</strong> From here on, every session ends with <em>“My neck and shoulders are heavy”</em>, then <em>“I am at peace”</em>, then the close.</p>`:'')+
    (item.caution?`<div class="caution"><b>Caution.</b> ${esc(item.caution)}</div>`:'')+
    `<p><strong>The close.</strong> Say “Arms firm, breathe deeply, eyes open.” Make fists 3–4×, bend the arms, one deep breath, open the eyes.</p>`+
    `<p class="muted">Passive concentration: hold the formula lightly, want nothing, let it come — including nothing.</p>`;
}
function critBlock(item){
  const a=state.crit[item.id]||[false,false,false,false];
  return `<div class="crit"><span class="crit-label">Tick each as it becomes true — ready to move on when all four are</span><ul>`+
    DATA.progressionCriteria.map((c,i)=>`<li class="crit-item" data-ex="${item.id}" data-i="${i}"><button class="box ${a[i]?'on':''}">${a[i]?'✓':''}</button><span>${esc(c)}</span></li>`).join('')+
    `</ul><div class="log-ev" data-ex="${item.id}">${evidenceHtml(item.id)}</div>`+
    `<button class="ready-btn" data-ex="${item.id}"></button></div>`;
}
function card(item){
  const isEx=item.type==='exercise';
  const badges=isEx?`<span class="badge ex">Exercise ${item.exercise}</span><span class="badge week">Week ${item.week}</span>${item.skippable?'<span class="badge">skippable</span>':''}`:`<span class="badge">${item.safety?'Safety':'Orientation'}</span>`;
  const formula=item.formula?`<div class="formula">${esc(item.formula)}</div>`:'';
  const caution=item.caution?`<div class="caution"><b>Caution.</b> ${esc(item.caution)}</div>`:'';
  const note=item.note?`<p class="expands">${esc(item.note)}</p>`:'';
  const prereq=(item.prerequisites&&item.prerequisites.length)?`<div class="prereq"><span class="prereq-label">Before you begin</span><ul>${item.prerequisites.map(p=>`<li>${esc(p)}</li>`).join('')}</ul></div>`:'';
  const row=(k)=> (item.parts&&item.parts[k]) ? partRow(item.id,k,item.parts[k],item.title) : '';
  const wrap=(rows)=> rows ? `<ul class="parts">${rows}</ul>` : '';
  let body;
  if(isEx){
    // within-exercise flow: understand → practise (guided) → practise unaided → assess
    body = formula+note+caution+prereq + wrap(row('orientation')) + practiceBlock(item) + wrap(row('silence')) + critBlock(item);
  } else {
    body = formula+note+caution+prereq + wrap(['teaching','orientation','silence'].map(row).filter(Boolean).join(''));
  }
  const open = !!state.open[item.id];
  return `<article class="card ${item.type} ${open?'':'collapsed'}" data-id="${item.id}" ${isEx?`data-ex="${item.id}"`:''}>`+
    `<div class="card-head" data-toggle="${item.id}"><div class="seq">${item.seq}</div><div class="card-title"><div class="badges">${badges}</div><h2>${esc(item.title)}</h2></div><span class="chev">${open?'▾':'▸'}</span></div>`+
    `<div class="card-body">${body}</div></article>`;
}
function toggleCard(id){ state.open[id]=!state.open[id]; save(); const card=ladderEl.querySelector(`.card[data-id="${id}"]`); if(card){ card.classList.toggle('collapsed',!state.open[id]); const ch=card.querySelector('.chev'); if(ch) ch.textContent=state.open[id]?'▾':'▸'; } }
function teachingRow(it){
  const p=it.parts&&it.parts.teaching;
  const built=p&&p.status==='built'&&p.audio;
  const mark=it.safety?' <span class="row-tag">safety</span>':'';
  if(!built) return `<li class="part planned"><span class="play">▶</span><div class="part-main"><div class="part-label">${esc(it.title)}${mark}</div><div class="part-meta">hear once</div></div><span class="soon">coming soon</span></li>`;
  offlineUrls.push(p.audio.split('#')[0]);
  return `<li class="part"><button class="play" data-src="${p.audio}" data-title="${esc(it.title)}">▶</button><div class="part-main"><div class="part-label">${esc(it.title)}${mark}</div><div class="part-meta">hear once${p.durationSec?' · '+fmt(p.durationSec):''}</div></div></li>`;
}
function orientationGroupCard(items,key,title){
  const open=!!state.open['orient-'+key];
  const rows=items.map(teachingRow).join('');
  return `<article class="card orientation ${open?'':'collapsed'}" data-id="orient-${key}"><div class="card-head" data-toggle="orient-${key}"><div class="seq">✦</div><div class="card-title"><div class="badges"><span class="badge">Orientation · listen once</span></div><h2>${esc(title)}</h2></div><span class="chev">${open?'▾':'▸'}</span></div><div class="card-body"><ul class="parts">${rows}</ul></div></article>`;
}
function renderLadder(){
  offlineUrls=[]; Object.values(DATA.clips).forEach(c=>offlineUrls.push(c.audio.split('#')[0]));
  state.open=state.open||{};
  const cur=(DATA.items.find(it=>it.type==='exercise'&&!learned(it.id))||{}).id;
  if(cur) state.open[cur]=true;   // always keep the exercise you're on expanded
  if(!('orient-begin' in state.open)) state.open['orient-begin']=true;
  if(!('orient-beyond' in state.open)) state.open['orient-beyond']=false;
  // group consecutive same-type items; orientation runs collapse into one card
  const groups=[]; for(const it of DATA.items){ const l=groups[groups.length-1]; if(l&&l.type===it.type) l.items.push(it); else groups.push({type:it.type,items:[it]}); }
  let html='';
  groups.forEach((g,gi)=>{
    if(gi===0) html+=`<div class="section">Start here</div>`;
    else if(g.type==='exercise') html+=`<div class="section">The six exercises</div>`;
    else html+=`<div class="section">Beyond the six</div>`;
    if(g.type==='exercise') g.items.forEach(it=>html+=card(it));
    else html+=orientationGroupCard(g.items, gi===0?'begin':'beyond', gi===0?'The framework':'Beyond the six');
  });
  ladderEl.innerHTML=html;
  ladderEl.querySelectorAll('.card-head[data-toggle]').forEach(h=>h.addEventListener('click',()=>toggleCard(h.dataset.toggle)));
  ladderEl.querySelectorAll('.card-btn[data-ex]:not(.log-btn)').forEach(b=>b.addEventListener('click',()=>openModal(practiceCardHtml(itemById(b.dataset.ex)))));
  ladderEl.querySelectorAll('.log-btn[data-ex]').forEach(b=>b.addEventListener('click',()=>promptLog(b.dataset.ex,false)));
  ladderEl.querySelectorAll('.log-ev .log-view[data-ex]').forEach(b=>b.addEventListener('click',()=>openLogModal(b.dataset.ex)));
  ladderEl.querySelectorAll('.play[data-src]').forEach(b=>b.addEventListener('click',()=>startTrack(b)));
  ladderEl.querySelectorAll('.crit-item').forEach(li=>li.addEventListener('click',()=>toggleCrit(li.dataset.ex,+li.dataset.i,li.querySelector('.box'))));
  ladderEl.querySelectorAll('.ready-btn[data-ex]').forEach(b=>b.addEventListener('click',()=>markReady(b.dataset.ex)));
  ladderEl.querySelectorAll('.stage').forEach(b=>b.addEventListener('click',()=>{
    ladderEl.querySelectorAll(`.stage[data-ex="${b.dataset.ex}"]`).forEach(x=>x.classList.remove('on')); b.classList.add('on');
  }));
  ladderEl.querySelectorAll('.start-btn').forEach(b=>b.addEventListener('click',()=>{
    const ex=itemById(b.dataset.ex); const sel=ladderEl.querySelector(`.stage[data-ex="${b.dataset.ex}"].on`); const idx=sel?+sel.dataset.stage:0;
    runSession(buildShort(ex,idx), ex.title, ex.id);
  }));
  ladderEl.querySelectorAll('.sleep-btn').forEach(b=>b.addEventListener('click',()=>{
    const ex=itemById(b.dataset.ex); const sel=ladderEl.querySelector(`.stage[data-ex="${b.dataset.ex}"].on`); const idx=sel?+sel.dataset.stage:0;
    runSession(buildSleep(ex,idx), ex.title+' · to fall asleep', ex.id, true);
  }));
  DATA.items.filter(it=>it.type==='exercise').forEach(it=>refreshReady(it.id));
  updateProgress(); refreshCards(); refreshOffline();
}

/* practice log toolbar button */
$('logBtn') && ($('logBtn').onclick=()=>openLogModal());

/* full session toolbar button */
$('fullBtn') && ($('fullBtn').onclick=()=>{
  if(learnedCount()===0){ openModal(`<h3>Full session</h3><p>Once you've marked an exercise or two as ready, this builds a full session from everything you've learned — run in sequence, with a single close at the end.</p>`); return; }
  runSession(buildFull(), 'Full session', 'full');
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
