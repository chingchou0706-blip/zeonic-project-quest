'use strict';
const Q = window.Quest, E = Q.escape;
let projects = [], lists = [];
let filter = 'all';
let questBusy = false;
const expandedProjects = new Set();
const completing = new Set();
const completionMessages = new Map();
const allowedStatuses = new Set(['訂單GET', '導入執行', '報價中', '素材準備中', '審查會議', '簽約', '期中', '期末', '待複查', '驗收']);
const includedProject = p => allowedStatuses.has(String(p.rawStatus || '').trim().toUpperCase());
const stageOrder = ['啟案會議', '需求訪談', '建置導入', '教育訓練與測試'];
function stageRank(task) {
  const rank = stageOrder.indexOf(String(task.name || '').trim());
  return rank < 0 ? stageOrder.length : rank;
}
function compareStages(a, b) {
  const left = Q.due(a).date, right = Q.due(b).date;
  if (left || right) {
    if (!left) return 1;
    if (!right) return -1;
    const byDate = left.localeCompare(right);
    if (byDate) return byDate;
  }
  return stageRank(a) - stageRank(b);
}
const normalizeStatus = s => String(s || '').trim().toUpperCase();
const statusOrders = {
  '901800293057': ['報價中','素材準備中','尚未執行科專','審查會議','簽約','期中','期末','待複查','PENDING','結案','PASS 夥伴','FAIL'].reverse(),
  '901800297105': ['訂單GET','訂金收款','導入執行','驗收','應收尾款','PENDING','結案','PASS 夥伴','FAIL'].reverse(),
};
function statusRank(p) {
  const rank = (statusOrders[p.listId] || []).findIndex(s => normalizeStatus(s) === normalizeStatus(p.rawStatus));
  return rank < 0 ? 999 : rank;
}
function projectBadge(p) {
  const color = /^#[0-9a-f]{6}$/i.test(p.statusColor || '') ? p.statusColor : '#777777';
  return `<span class="pill project-status" style="--status-color:${color}"><i></i>${E(p.rawStatus || p.status)}</span>`;
}
const dateText = value => Q.validDate(value) ? value : '未設定';
function timing(date, status) {
  const n = Q.remaining(date);
  if (n === null) return '未排程';
  if (status === '已完成' || status === '已結束') return status;
  return n < 0 ? `逾期 ${-n} 天` : n === 0 ? '今天截止' : `剩餘 ${n} 天`;
}
const blocked = p => Q.isBlocked(p);
const state = (t, p) => t.status === '已完成' ? 'done' : Q.blockers(t, p.tasks).length ? 'blocked' : t.status === '進行中' ? 'active' : 'pending';
function badge(label, type = '') { return `<span class="pill ${type}">${E(label)}</span>`; }
function completeButton(t) {
  const ended = t.status === '已完成' || t.terminal;
  return `<button class="complete-task" data-complete="${E(t.id)}" ${ended || questBusy || completing.has(t.id) ? 'disabled' : ''}>${completing.has(t.id) ? '儲存中…' : ended ? E(t.status) : '完成'}</button>`;
}
function completionText(t) {
  if (t.status !== '已完成') return '';
  if (!Q.validDate(t.actualEnd)) return '實際結束未記錄';
  const late = Q.validDate(t.due) ? -Q.remaining(t.due,t.actualEnd) : 0;
  return `實際結束：${t.actualEnd}${late > 0 ? ` · 晚完成 ${late} 天` : ''}`;
}
function stage(t, p) {
  const s = state(t, p);
  return `<div class="stage-wrap"><button class="stage ${s}" data-project="${E(p.id)}" data-task="${E(t.id)}" aria-label="查看${E(t.name)}關卡，${E(t.status)}"><span class="orb">${{done:'✓',blocked:'!',active:'●',pending:'○'}[s]}</span><strong>${E(t.name)}</strong><small>預計開始：${E(dateText(t.start))}</small><small>預計結束：${E(dateText(t.due))}</small></button>${completeButton(t)}<small class="completion-feedback" role="status">${E(completionMessages.get(t.id)||completionText(t))}</small></div>`;
}
function commentSummary(p) {
  if (p.commentState === 'unavailable') return '<p class="empty-stage">最新人工留言暫時無法載入，請按「重新同步」再試。</p>';
  const c = p.latestComment;
  if (!c) return '<p class="empty-stage">尚無人工留言</p>';
  const when = c.createdAt ? new Date(c.createdAt).toLocaleString('zh-TW', {timeZone:'Asia/Taipei',hour12:false}) : '時間未提供';
  return `<div class="latest-comment"><div class="comment-meta"><strong>最新人工留言</strong><span>${E(c.author)} · ${E(when)}</span></div><p>${E(c.text)}</p></div>`;
}
function card(p) {
  const n = Q.progress(p), next = Q.next(p);
  const reasons = p.tasks.flatMap(t => Q.blockers(t,p.tasks).map(r => `${t.name}：${r}`));
  return `<article class="project"><div class="project-top"><div><h2><a class="project-link" href="https://app.clickup.com/t/${encodeURIComponent(p.id)}" target="_blank" rel="noopener noreferrer" title="在 ClickUp 開啟專案（另開分頁）">${E(p.name)}</a>${projectBadge(p)}</h2><div class="project-meta">負責人 ${E(p.owner)}</div><div class="date-range">${dateText(p.start)} → ${dateText(p.due)} ${badge(blocked(p)?'有卡關':Q.isLate(p)?'有逾期':timing(p.due,p.status),blocked(p)?'blocked':Q.isLate(p)?'late':'')}</div></div><div class="completion"><small>最後更新</small><strong class="updated-date">${Q.validDate(p.updatedDate)?E(p.updatedDate):'未提供'}</strong><div class="progress"><i style="width:${n.percent||0}%"></i></div><small>${n.done} / ${n.total} 關完成</small></div></div>${p.tasks.length?`<div class="route">${p.tasks.map(t=>stage(t,p)).join('')}</div>`:''}${commentSummary(p)}${reasons.length?`<p class="block-note">! ${E(reasons[0])}${reasons.length>1?`（另 ${reasons.length-1} 項，展開查看）`:''}</p>`:''}<div class="project-bottom"><div class="next"><b>下一步：</b>${next?E(next.taskName)+'（'+E(next.stepName||'')+dateText(next.due)+')':n.total&&n.done===n.total?'所有關卡已完成':p.tasks.length?'先排除卡關或完成前置條件':'建立第一個子任務'}</div><button class="open-project" data-expand="${E(p.id)}" aria-expanded="${expandedProjects.has(p.id)}" aria-controls="expand-${E(p.id)}">${expandedProjects.has(p.id)?'收合專案':'展開專案'}</button></div><div class="project-details" id="expand-${E(p.id)}" ${expandedProjects.has(p.id)?'':'hidden'}><p><strong>進行中關卡：</strong>${E(p.tasks.filter(t=>t.status==='進行中').map(t=>t.name).join('、')||'目前沒有')}</p>${reasons.map(r=>`<p class="red">${E(r)}</p>`).join('')}<p>點選上方圓形關卡，查看工作步驟、日期與完整說明。</p><p>* 日期來自說明內最晚步驟截止日；未標 * 的日期來自 ClickUp 欄位。</p></div></article>`;
}
function render() {
  const query = document.querySelector('#search').value.trim().toLowerCase();
  const visibleProjects = projects.filter(p => filter === 'done' ? p.status === '已完成' : includedProject(p));
  const selectedStatuses = [...document.querySelectorAll('#status-filter input:checked')].map(x => x.value);
  const result = visibleProjects.filter(p => !selectedStatuses.length || selectedStatuses.includes(normalizeStatus(p.rawStatus))).filter(p => `${p.name} ${p.client} ${p.owner}`.toLowerCase().includes(query)).filter(p=>filter==='all'||filter==='active'&&p.status==='進行中'||filter==='done'||filter==='blocked'&&blocked(p)||filter==='late'&&Q.isLate(p));
  const openProjects = projects.filter(includedProject);
  document.querySelector('#stats').innerHTML = [[openProjects.length,'全部專案','指定狀態的主任務'],[openProjects.filter(p=>p.status==='進行中').length,'進行中','關卡允許同時推進'],[openProjects.filter(blocked).length,'有卡關','含等待前置關卡'],[openProjects.filter(p=>Q.isLate(p)).length,'有逾期','依預計結束日，卡關優先'],[projects.filter(p=>p.status==='已完成').length,'已完成','所有清單已完成的專案']].map(([n,label,note],i)=>`<div class="stat"><strong class="${i===2||i===3?'red':''}">${n}</strong><span>${label}</span><small>${note}</small></div>`).join('');
  document.querySelector('#projects').innerHTML = lists.map(list => {
    const group = result.filter(p => p.listId === list.id).sort((a,b) => statusRank(a) - statusRank(b));
    return `<section class="list-group" aria-label="${E(list.name)}"><div class="group-heading"><h2>${E(list.name)}</h2><span>${group.length} 個專案</span></div>${group.length ? group.map(card).join('') : '<div class="empty">此清單沒有符合條件的專案。</div>'}</section>`;
  }).join('');
  document.querySelector('#count').textContent = `${result.length} 個符合條件的專案`;
}
let openTask = null;
function showTask(p,t) {
  openTask = {p, t};
  const parsed = Q.parse(t.description), d = Q.due(t), reasons=Q.blockers(t,p.tasks);
  document.querySelector('#detail-body').innerHTML = `<p class="eyebrow">${E(p.name)}</p><h2 id="detail-title">${E(t.name)} ${badge(t.rawStatus || t.status,state(t,p))}</h2><div class="detail-grid"><div><small>負責人</small>${E(t.owner||'待指派')}</div><div><small>開始日期</small>${dateText(t.start)}</div><div><small>截止日期 · ${E(d.source)}</small>${dateText(d.date)}</div><div><small>日期狀態</small>${timing(d.date,t.status)}</div></div>${reasons.map(r=>`<p class="block-note">! ${E(r)}</p>`).join('')}<div class="complete-action">${completeButton(t)}<small>完成後填入實際結束日期並更新狀態；已填日期會保留，預計結束不變。</small><p role="status">${E(completionMessages.get(t.id)||completionText(t))}</p></div><div class="steps-title"><h3>工作步驟</h3><span>${parsed.steps.filter(s=>s.status==='已完成').length} / ${parsed.steps.length} 項完成</span></div>${parsed.steps.length?parsed.steps.map((s,i)=>`<div class="step"><span class="step-index">${String(i+1).padStart(2,'0')}</span><div><strong>${E(s.name)}</strong><small class="${Q.overdue(s.due,s.status)?'late-text':''}">截止 ${s.due} · ${timing(s.due,s.status)}</small></div>${badge(s.status,s.status==='卡關'?'blocked':s.status==='進行中'?'active':'')}</div>`).join(''):'<p class="empty-stage">尚無可辨識的工作步驟，請查看下方完整說明。</p>'}${parsed.notes.length?`<h3>備註與其他內容</h3><pre>${E(parsed.notes.join('\n'))}</pre>`:''}${parsed.warnings.map(w=>`<p class="warning">${E(w)}</p>`).join('')}<details><summary>查看完整 ClickUp 說明原文</summary><pre>${E(t.description||'尚無說明')}</pre></details>`;
  if (!document.querySelector('#detail').open) document.querySelector('#detail').showModal();
}
document.querySelector('#today').textContent = Q.today();
document.querySelector('#updated').textContent = '尚未同步';
document.querySelector('#search').addEventListener('input',render);
document.querySelector('#status-filter').addEventListener('change',render);
document.querySelector('.filters').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;filter=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));render();});
document.querySelector('#projects').addEventListener('click',e=>{
  const stageButton=e.target.closest('[data-task]');
  if(stageButton){const p=projects.find(p=>p.id===stageButton.dataset.project);showTask(p,p.tasks.find(t=>t.id===stageButton.dataset.task));return;}
  const expand=e.target.closest('[data-expand]');
  if(expand){const region=document.getElementById('expand-'+expand.dataset.expand);region.hidden=!region.hidden;if(region.hidden)expandedProjects.delete(expand.dataset.expand);else expandedProjects.add(expand.dataset.expand);expand.setAttribute('aria-expanded',String(!region.hidden));expand.textContent=region.hidden?'展開專案':'收合專案';}
});
document.querySelector('#close').addEventListener('click',()=>document.querySelector('#detail').close());
render();

window.updateQuestData = function(data) {
  projects = (data?.projects || []).map(p => ({ ...p, tasks: [...p.tasks].sort(compareStages) })); lists = data?.lists || [];
  const previous = [...document.querySelectorAll('#status-filter input:checked')].map(x => x.value);
  const names = [...new Set([...Object.values(statusOrders).flat().filter(s => allowedStatuses.has(normalizeStatus(s))), '結案'])];
  document.querySelector('#status-filter').innerHTML = '<small>未勾選時顯示全部狀態</small>' + names.map(s => `<label><input type="checkbox" value="${E(normalizeStatus(s))}" ${previous.includes(normalizeStatus(s)) ? 'checked' : ''}>${E(s)}</label>`).join('');
  document.querySelector('#stats').hidden = !data;
  document.querySelector('.workspace').hidden = !data;
  document.querySelector('#updated').textContent = data ? '最後成功更新：' + new Date(data.updated).toLocaleString('zh-TW', {timeZone:'Asia/Taipei',hour12:false}) : '尚未同步';
  if (!data) { expandedProjects.clear(); openTask = null; document.querySelector('#detail').close(); document.querySelector('#detail-body').textContent = ''; }
  render();
};
window.updateQuestData(null);

async function handleComplete(event) {
  const button = event.target.closest('[data-complete]');
  if (!button || button.disabled) return;
  const id = button.dataset.complete;
  if (completing.has(id)) return;
  completing.add(id); completionMessages.delete(id);
  const repaint = () => { render(); if (document.querySelector('#detail').open && openTask) showTask(openTask.p, openTask.t); };
  repaint();
  try {
    const saved = await window.completeQuestTask(id);
    for (const project of projects) for (const task of project.tasks) if (task.id === id) {
      task.status = '已完成'; task.rawStatus = saved.rawStatus; task.terminal = true; task.actualEnd = saved.actualEnd;
    }
    completionMessages.delete(id);
  } catch (error) { completionMessages.set(id, error.message || '未能確認更新，請重新同步。'); }
  finally { completing.delete(id); repaint(); }
}
document.querySelector('#projects').addEventListener('click', handleComplete);
document.querySelector('#detail-body').addEventListener('click', handleComplete);

function repaintQuest() {
  const dialog = document.querySelector('#detail');
  const scroll = dialog.scrollTop;
  const fullDescriptionOpen = document.querySelector('#detail-body details')?.open;
  render();
  if (dialog.open && openTask) {
    const p = projects.find(p => p.id === openTask.p.id);
    const t = p?.tasks.find(t => t.id === openTask.t.id);
    if (t) {
      showTask(p,t);
      const full = document.querySelector('#detail-body details');
      if (full) full.open = fullDescriptionOpen;
      dialog.scrollTop = scroll;
    }
  }
}
window.setQuestBusy = function(value) { questBusy = value; repaintQuest(); };
let displayedDay = Q.today();
function checkDay() {
  const day = Q.today();
  if (day === displayedDay) return;
  displayedDay = day; document.querySelector('#today').textContent = day;
  repaintQuest();
}
setInterval(checkDay, 1000);
document.addEventListener('visibilitychange', checkDay);
window.addEventListener('focus', checkDay);
window.addEventListener('pageshow', checkDay);
