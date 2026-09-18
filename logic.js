(function (root) {
  'use strict';
  const statuses = ['已完成', '進行中', '未開始', '卡關'];
  function validDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
    const d = new Date(value + 'T00:00:00Z');
    return !isNaN(d) && d.toISOString().slice(0, 10) === value;
  }
  function today() {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    const p = Object.fromEntries(parts.map(x => [x.type, x.value]));
    return `${p.year}-${p.month}-${p.day}`;
  }
  function parse(description) {
    const steps = [], notes = [], warnings = [];
    String(description || '').split(/\r?\n/).forEach((line, i) => {
      const fields = line.split(/[|｜]/).map(x => x.trim());
      const match = fields[1]?.match(/^截止[：:]\s*(\d{4}-\d{2}-\d{2})$/);
      if (fields.length === 3 && fields[0] && match && validDate(match[1]) && statuses.includes(fields[2])) {
        steps.push({ name: fields[0], due: match[1], status: fields[2] });
      } else if (line.trim()) {
        notes.push(line);
        if (/[|｜]/.test(line)) warnings.push(`第 ${i + 1} 行未辨識為步驟，已保留原文。`);
      }
    });
    return { steps, notes, warnings };
  }
  function due(task) {
    if (validDate(task.due)) return { date: task.due, source: 'ClickUp 日期欄位' };
    const dates = parse(task.description).steps.map(s => s.due).sort();
    return { date: dates.at(-1) || null, source: dates.length ? '說明內最晚步驟日期' : '未設定' };
  }
  function remaining(date, reference = today()) {
    return validDate(date) ? Math.round((Date.parse(date + 'T00:00:00Z') - Date.parse(reference + 'T00:00:00Z')) / 86400000) : null;
  }
  function overdue(date, status, reference = today()) { return status !== '已完成' && status !== '已結束' && remaining(date, reference) !== null && remaining(date, reference) < 0; }
  function blockers(task, tasks, ref = today()) {
    if (!overdue(task.due, task.status, ref)) return [];
    const index = tasks.findIndex(t => t.id === task.id);
    return tasks.slice(0, Math.max(0,index)).filter(t => t.status !== '已完成').map(t => `等待左側「${t.name}」完成`);
  }
  function isBlocked(project, ref = today()) {
    return !['已完成','已結束'].includes(project.status) && project.tasks.some(t => blockers(t,project.tasks,ref).length);
  }
  function progress(project) {
    const total = project.tasks.length, done = project.tasks.filter(t => t.status === '已完成').length;
    return { total, done, percent: total ? Math.round(done / total * 100) : null };
  }
  function isLate(project, ref = today()) {
    if (['已完成','已結束'].includes(project.status) || isBlocked(project,ref)) return false;
    return overdue(project.due, project.status, ref) || project.tasks.some(t => overdue(t.due,t.status,ref));
  }
  function next(project) {
    const candidates = project.tasks.filter(t => t.status !== '已完成' && t.status !== '已結束' && !blockers(t, project.tasks).length).flatMap(t => {
      const pending = parse(t.description).steps.filter(s => s.status !== '已完成');
      return pending.length ? pending.map(s => ({ name: `${t.name} → ${s.name}`, taskName: t.name, stepName: s.name, due: s.due })) : [{ name: t.name, taskName: t.name, stepName: null, due: due(t).date }];
    });
    return candidates.sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'))[0] || null;
  }
  function escape(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  const api = { validDate, today, parse, due, remaining, overdue, blockers, progress, isBlocked, isLate, next, escape };
  if (typeof module !== 'undefined') module.exports = api;
  else root.Quest = api;
})(typeof window !== 'undefined' ? window : globalThis);
