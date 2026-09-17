'use strict';
const Q = window.Quest, E = Q.escape;
let projects = [], lists = [];
let filter = 'all';
const allowedStatuses = new Set(['訂單GET', '導入執行', '報價中', '素材準備中', '審查會議', '簽約', '期中', '期末', '待複查', '驗收']);
const includedProject = p => allowedStatuses.has(String(p.rawStatus || '').trim().toUpperCase());
const dateText = value => Q.validDate(value) ? value : '未設定';
function timing(date, status) {
  const n = Q.remaining(date);
  if (n === null) return '未排程';
  if (status === '已完成' || status === '已結束') return status;
  return n < 0 ? `逾期 ${-n} 天` : n === 0 ? '今天截止' : `剩餘 ${n} 天`;
}
const blocked = p => p.tasks.some(t => Q.blockers(t, p.tasks).length);
const state = (t, p) => t.status === '已完成' ? 'done' : Q.blockers(t, p.tasks).length ? 'blocked' : t.status === '進行中' ? 'active' : 'pending';
function badge(label, type = '') { return `<span class="pill ${type}">${E(label)}</span>`; }
function stage(t, p) {
  const s = state(t, p), d = Q.due(t), late = Q.overdue(d.date, t.status);
  return `<button class="stage ${s}" data-project="${E(p.id)}" data-task="${E(t.id)}" aria-label="查看${E(t.name)}關卡，${E(t.status)}"><span class="orb">${{done:'✓',blocked:'!',active:'●',pending:'○'}[s]}</span><strong>${E(t.name)}</strong><small>${E(s === 'blocked' ? '卡關／等待前置' : (t.rawStatus || t.status))}</small><small>${E(dateText(d.date))}${d.source.startsWith('說明') ? ' *' : ''}</small><small class="${late ? 'late-text' : ''}">${timing(d.date,t.status)}</small></button>`;
}
function commentSummary(p) {
  if (p.commentState === 'unavailable') return '<p class="empty-stage">最新留言暫時無法載入，請按「重新同步」再試。</p>';
  const c = p.latestComment;
  if (!c) return '<p class="empty-stage">尚無留言</p>';
  const when = c.createdAt ? new Date(c.createdAt).toLocaleString('zh-TW', {timeZone:'Asia/Taipei',hour12:false}) : '時間未提供';
  return `<div class="latest-comment"><div class="comment-meta"><strong>最新留言</strong><span>${E(c.author)} · ${E(when)}</span></div><p>${E(c.text)}</p></div>`;
}
function card(p) {
  const n = Q.progress(p), next = Q.next(p);
  const reasons = p.tasks.flatMap(t => Q.blockers(t,p.tasks).map(r => `${t.name}：${r}`));
  return `<article class="project"><div class="project-top"><div><h2>${E(p.name)}${badge(p.rawStatus || p.status,p.status==='進行中'?'active':'')}</h2><div class="project-meta">負責人 ${E(p.owner)}</div><div class="date-range">${dateText(p.start)} → ${dateText(p.due)} ${badge(timing(p.due,p.status),Q.overdue(p.due,p.status)?'late':'')}</div></div><div class="completion"><strong>${n.percent===null?'—':n.percent+'%'}</strong><div class="progress"><i style="width:${n.percent||0}%"></i></div><small>${n.done} / ${n.total} 關完成</small></div></div>${p.tasks.length?`<div class="route">${p.tasks.map(t=>stage(t,p)).join('')}</div>`:commentSummary(p)}${reasons.length?`<p class="block-note">! ${E(reasons[0])}${reasons.length>1?`（另 ${reasons.length-1} 項，展開查看）`:''}</p>`:''}<div class="project-bottom"><div class="next"><b>下一步：</b>${next?E(next.taskName)+'（'+E(next.stepName||'')+dateText(next.due)+')':n.total&&n.done===n.total?'所有關卡已完成':p.tasks.length?'先排除卡關或完成前置條件':'建立第一個子任務'}</div><button class="open-project" data-expand="${E(p.id)}" aria-expanded="false" aria-controls="expand-${E(p.id)}">展開專案</button></div><div class="project-details" id="expand-${E(p.id)}" hidden><p><strong>進行中關卡：</strong>${E(p.tasks.filter(t=>t.status==='進行中').map(t=>t.name).join('、')||'目前沒有')}</p>${reasons.map(r=>`<p class="red">${E(r)}</p>`).join('')}<p>點選上方圓形關卡，查看工作步驟、日期與完整說明。</p><p>* 日期來自說明內最晚步驟截止日；未標 * 的日期來自 ClickUp 欄位。</p></div></article>`;
}
function render() {
  const query = document.querySelector('#search').value.trim().toLowerCase();
  const visibleProjects = projects.filter(p => filter === 'done' ? p.status === '已完成' : includedProject(p));
  const result = visibleProjects.filter(p => `${p.name} ${p.client} ${p.owner}`.toLowerCase().includes(query)).filter(p=>filter==='all'||filter==='active'&&p.status==='進行中'||filter==='done'||filter==='blocked'&&blocked(p)||filter==='late'&&Q.isLate(p));
  const openProjects = projects.filter(includedProject);
  document.querySelector('#stats').innerHTML = [[openProjects.length,'全部專案','指定狀態的主任務'],[openProjects.filter(p=>p.status==='進行中').length,'進行中','關卡允許同時推進'],[openProjects.filter(blocked).length,'有卡關','含等待前置關卡'],[openProjects.filter(p=>Q.isLate(p)).length,'有逾期','含專案、關卡與工作步驟'],[projects.filter(p=>p.status==='已完成').length,'已完成','所有清單已完成的專案']].map(([n,label,note],i)=>`<div class="stat"><strong class="${i===2||i===3?'red':''}">${n}</strong><span>${label}</span><small>${note}</small></div>`).join('');
  document.querySelector('#projects').innerHTML = lists.map(list => {
    const group = result.filter(p => p.listId === list.id);
    return `<section class="list-group" aria-label="${E(list.name)}"><div class="group-heading"><h2>${E(list.name)}</h2><span>${group.length} 個專案</span></div>${group.length ? group.map(card).join('') : '<div class="empty">此清單沒有符合條件的專案。</div>'}</section>`;
  }).join('');
  document.querySelector('#count').textContent = `${result.length} 個符合條件的專案`;
}
function showTask(p,t) {
  const parsed = Q.parse(t.description), d = Q.due(t), reasons=Q.blockers(t,p.tasks);
  document.querySelector('#detail-body').innerHTML = `<p class="eyebrow">${E(p.name)}</p><h2 id="detail-title">${E(t.name)} ${badge(t.rawStatus || t.status,state(t,p))}</h2><div class="detail-grid"><div><small>負責人</small>${E(t.owner||'待指派')}</div><div><small>開始日期</small>${dateText(t.start)}</div><div><small>截止日期 · ${E(d.source)}</small>${dateText(d.date)}</div><div><small>日期狀態</small>${timing(d.date,t.status)}</div></div>${reasons.map(r=>`<p class="block-note">! ${E(r)}</p>`).join('')}<div class="steps-title"><h3>工作步驟</h3><span>${parsed.steps.filter(s=>s.status==='已完成').length} / ${parsed.steps.length} 項完成</span></div>${parsed.steps.length?parsed.steps.map((s,i)=>`<div class="step"><span class="step-index">${String(i+1).padStart(2,'0')}</span><div><strong>${E(s.name)}</strong><small class="${Q.overdue(s.due,s.status)?'late-text':''}">截止 ${s.due} · ${timing(s.due,s.status)}</small></div>${badge(s.status,s.status==='卡關'?'blocked':s.status==='進行中'?'active':'')}</div>`).join(''):'<p class="empty-stage">尚無可辨識的工作步驟，請查看下方完整說明。</p>'}${parsed.notes.length?`<h3>備註與其他內容</h3><pre>${E(parsed.notes.join('\n'))}</pre>`:''}${parsed.warnings.map(w=>`<p class="warning">${E(w)}</p>`).join('')}<details><summary>查看完整 ClickUp 說明原文</summary><pre>${E(t.description||'尚無說明')}</pre></details>`;
  document.querySelector('#detail').showModal();
}
document.querySelector('#today').textContent = Q.today();
document.querySelector('#updated').textContent = '尚未同步';
document.querySelector('#search').addEventListener('input',render);
document.querySelector('.filters').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;filter=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));render();});
document.querySelector('#projects').addEventListener('click',e=>{
  const stageButton=e.target.closest('[data-task]');
  if(stageButton){const p=projects.find(p=>p.id===stageButton.dataset.project);showTask(p,p.tasks.find(t=>t.id===stageButton.dataset.task));return;}
  const expand=e.target.closest('[data-expand]');
  if(expand){const region=document.getElementById('expand-'+expand.dataset.expand);region.hidden=!region.hidden;expand.setAttribute('aria-expanded',String(!region.hidden));expand.textContent=region.hidden?'展開專案':'收合專案';}
});
document.querySelector('#close').addEventListener('click',()=>document.querySelector('#detail').close());
render();

window.updateQuestData = function(data) {
  projects = data?.projects || []; lists = data?.lists || [];
  document.querySelector('#stats').hidden = !data;
  document.querySelector('.workspace').hidden = !data;
  document.querySelector('#updated').textContent = data ? '資料更新：' + new Date(data.updated).toLocaleString('zh-TW', {timeZone:'Asia/Taipei',hour12:false}) : '尚未同步';
  if (!data) { document.querySelector('#detail').close(); document.querySelector('#detail-body').textContent = ''; }
  render();
};
window.updateQuestData(null);
