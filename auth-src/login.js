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
let busy = false;
function clear() { window.updateQuestData(null); }
async function load() {
  if (busy) return;
  busy = true; refresh.disabled = true;
  message.textContent = '正在讀取 ClickUp 專案…';
  try {
    const account = msal.getActiveAccount();
    if (!account) { clear(); message.textContent = '請使用獲准的 Microsoft 公司帳號登入。'; return; }
    const result = await msal.acquireTokenSilent({ scopes, account });
    const response = await fetch('https://business-card-clickup-system.vercel.app/api/project-quest', {
      headers: { Authorization: `Bearer ${result.accessToken}` }, cache: 'no-store', signal: AbortSignal.timeout(55000),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `同步失敗（${response.status}）`);
    if (!Array.isArray(data.projects) || !Array.isArray(data.lists)) throw new Error('伺服器回傳格式錯誤。');
    window.updateQuestData(data);
    message.textContent = '已連接 ClickUp · 唯讀模式';
    login.hidden = true; logout.hidden = false; refresh.hidden = false;
    document.querySelector('.mode').textContent = account.name || '公司帳號已登入';
  } catch (error) {
    clear();
    message.textContent = error instanceof InteractionRequiredAuthError ? '登入已到期，請重新登入。' : `無法讀取專案：${error.message || '請稍後再試'}`;
    login.hidden = false;
  } finally { busy = false; refresh.disabled = false; }
}
async function initialize() {
  try {
    await msal.initialize();
    const result = await msal.handleRedirectPromise();
    if (result?.account) msal.setActiveAccount(result.account);
    else if (msal.getAllAccounts().length === 1) msal.setActiveAccount(msal.getAllAccounts()[0]);
    login.disabled = false;
    if (msal.getActiveAccount()) { logout.hidden = false; refresh.hidden = false; await load(); }
    else message.textContent = '請使用獲准的 Microsoft 公司帳號登入。';
  } catch (error) {
    clear(); message.textContent = `登入未完成：${error.errorCode || error.message}`;
    login.disabled = false;
  }
}
login.addEventListener('click', async () => {
  login.disabled = true;
  try { await msal.loginRedirect({ scopes, prompt: 'select_account' }); }
  catch (error) { message.textContent = `登入失敗：${error.errorCode || error.message}`; login.disabled = false; }
});
logout.addEventListener('click', async () => {
  clear();
  try { await msal.logoutRedirect({ account: msal.getActiveAccount() }); }
  catch { message.textContent = '頁面資料已清除，Microsoft 登出未完成，請重試。'; }
});
refresh.addEventListener('click', load);
initialize();
