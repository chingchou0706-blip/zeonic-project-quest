import { PublicClientApplication, InteractionRequiredAuthError } from '@azure/msal-browser';
const clientId = 'fb6d5dcd-c77d-42c2-8aa7-7438c5842801';
const redirectUri = 'https://chingchou0706-blip.github.io/zeonic-project-quest/';
const scopes = [`api://${clientId}/access_as_user`];
const msal = new PublicClientApplication({
  auth: { clientId, authority: 'https://login.microsoftonline.com/be9da38a-25fb-4cd8-97c2-c9ea8919a1a6', redirectUri, postLogoutRedirectUri: redirectUri, navigateToLoginRequestUrl: false },
  cache: { cacheLocation: 'sessionStorage' },
});
const message = document.querySelector('#auth-message');
const login = document.querySelector('#login');
const logout = document.querySelector('#logout');
const refresh = document.querySelector('#refresh');
const embedded = window.self !== window.top;
const cacheKey = 'quest-snapshot-v1';
const interval = 5 * 60 * 1000;
const countdown = document.querySelector('#refresh-countdown');
let busy = false, snapshot = null, nextRefresh = null, generation = 0;
function clear() {
  generation++; snapshot = null; nextRefresh = null;
  try { sessionStorage.removeItem(cacheKey); } catch {}
  window.updateQuestData(null); updateCountdown();
}
function saveSnapshot(account) {
  if (!embedded) return;
  try { sessionStorage.setItem(cacheKey, JSON.stringify({ account: account.homeAccountId, data: snapshot })); }
  catch { message.textContent += '（瀏覽器無法保留暫存，切換回來可能需要重新同步。）'; }
}
function showConnected(account) {
  login.hidden = true; logout.hidden = false; refresh.hidden = false;
  document.querySelector('.mode').textContent = account.name || '公司帳號已登入';
}
function updateCountdown() {
  if (embedded) { countdown.textContent = '手動更新 · 切換頁面保留上次資料'; return; }
  if (busy) { countdown.textContent = '正在更新…'; return; }
  if (!nextRefresh) { countdown.textContent = '自動更新：登入後每 5 分鐘'; return; }
  const seconds = Math.max(0, Math.ceil((nextRefresh - Date.now()) / 1000));
  countdown.textContent = `下次自動更新 ${String(Math.floor(seconds / 60)).padStart(2,'0')}:${String(seconds % 60).padStart(2,'0')}`;
}
updateCountdown();
if (!embedded) setInterval(() => {
  updateCountdown();
  if (nextRefresh && Date.now() >= nextRefresh && !busy) load();
}, 1000);
async function load() {
  if (busy) return;
  busy = true; refresh.disabled = true;
  const requestGeneration = generation; updateCountdown();
  message.textContent = '正在讀取 ClickUp 專案…';
  try {
    const account = msal.getActiveAccount();
    if (!account) { clear(); message.textContent = '請使用獲准的 Microsoft 公司帳號登入。'; return; }
    const result = await msal.acquireTokenSilent({ scopes, account });
    const response = await fetch('https://business-card-clickup-system.vercel.app/api/project-quest', {
      headers: { Authorization: `Bearer ${result.accessToken}` }, cache: 'no-store', signal: AbortSignal.timeout(55000),
    });
    const data = await response.json();
    if (!response.ok) {
      const error = new Error(data.error || `同步失敗（${response.status}）`);
      error.authFailure = [401,403].includes(response.status); throw error;
    }
    if (!Array.isArray(data.projects) || !Array.isArray(data.lists)) throw new Error('伺服器回傳格式錯誤。');
    if (requestGeneration !== generation) return;
    snapshot = data; window.updateQuestData(data);
    message.textContent = '已連接 ClickUp · 可完成關卡';
    showConnected(account); saveSnapshot(account);
  } catch (error) {
    if (requestGeneration !== generation) return;
    if (error instanceof InteractionRequiredAuthError || error.authFailure) {
      clear(); login.hidden = false;
      message.textContent = '登入或權限需要重新確認，請重新登入。';
    } else {
      message.textContent = `同步失敗：${error.message || '請稍後再試'}${snapshot ? '（保留上次成功資料）' : ''}`;
      login.hidden = !!snapshot;
    }
  } finally {
    busy = false; refresh.disabled = false;
    if (!embedded && requestGeneration === generation && msal.getActiveAccount()) nextRefresh = Date.now() + interval;
    updateCountdown();
  }
}
async function initialize() {
  try {
    await msal.initialize();
    const result = await msal.handleRedirectPromise();
    if (result?.account) msal.setActiveAccount(result.account);
    else if (msal.getAllAccounts().length === 1) msal.setActiveAccount(msal.getAllAccounts()[0]);
    login.disabled = false;
    if (msal.getActiveAccount()) {
      const account = msal.getActiveAccount();
      let cached;
      if (embedded) {
        try { cached = JSON.parse(sessionStorage.getItem(cacheKey)); } catch {}
      }
      if (cached?.account === account.homeAccountId && Array.isArray(cached?.data?.projects) && Array.isArray(cached?.data?.lists)) {
        snapshot = cached.data; window.updateQuestData(snapshot); showConnected(account);
        message.textContent = '已還原上次資料 · 按「重新同步」取得最新進度';
      } else { logout.hidden = false; refresh.hidden = false; await load(); }
    }
    else message.textContent = '請使用獲准的 Microsoft 公司帳號登入。';
  } catch (error) {
    clear(); message.textContent = `登入未完成：${error.errorCode || error.message}`;
    login.disabled = false;
  }
}
login.addEventListener('click', async () => {
  login.disabled = true;
  try {
    if (embedded) {
      const result = await msal.loginPopup({ scopes, prompt: 'select_account' });
      msal.setActiveAccount(result.account);
      await load();
      login.disabled = false;
    } else await msal.loginRedirect({ scopes, prompt: 'select_account' });
  }
  catch (error) { message.textContent = embedded ? '登入視窗未完成。請允許彈出視窗後重試，或使用「另開分頁」。' : `登入失敗：${error.errorCode || error.message}`; login.disabled = false; }
});
logout.addEventListener('click', async () => {
  clear();
  try {
    if (embedded) {
      await msal.logoutPopup({ account: msal.getActiveAccount() });
      login.hidden = false; login.disabled = false; logout.hidden = true; refresh.hidden = true;
      document.querySelector('.mode').textContent = '公司內部 · 請先登入';
      message.textContent = '已登出，請使用公司帳號登入。';
    } else await msal.logoutRedirect({ account: msal.getActiveAccount() });
  }
  catch { message.textContent = '頁面資料已清除，Microsoft 登出未完成，請重試。'; }
});
refresh.addEventListener('click', load);
initialize();

window.completeQuestTask = async function(taskId) {
  if (busy) throw new Error('正在同步資料，請稍後再操作。');
  const account = msal.getActiveAccount();
  if (!account) throw new Error('請先登入公司帳號。');
  const result = await msal.acquireTokenSilent({scopes, account});
  const response = await fetch('https://business-card-clickup-system.vercel.app/api/project-quest', {
    method:'POST', headers:{Authorization:`Bearer ${result.accessToken}`, 'Content-Type':'application/json'},
    body:JSON.stringify({action:'complete',taskId}), cache:'no-store', signal:AbortSignal.timeout(55000),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '更新失敗，請重新同步確認。');
  if (snapshot) {
    for (const project of snapshot.projects) for (const task of project.tasks) if (task.id === taskId) {
      task.status = '已完成'; task.rawStatus = data.rawStatus; task.terminal = true; task.due = data.due;
    }
    saveSnapshot(account);
  }
  return data;
};
