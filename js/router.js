function render(){
  const hash = window.location.hash;
  const m = hash.match(/cliente=([a-zA-Z0-9]+)/);
  if(m){ renderClientView(m[1]); return; }
  const mc = hash.match(/comissionado=([a-zA-Z0-9]+)/);
  if(mc){ renderCommissionerView(mc[1]); return; }
  document.title = 'Boletim — Consultoria';
  if(!SESSION){ renderLogin(); return; }
  renderAdmin();
}

// ---------- LOGIN ----------
function renderLogin(){
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="brand">${renderBrandMark()}<span class="sub">Painel da Consultoria</span></div>
    <div class="card" style="max-width:340px;margin:60px auto 0">
      <h3>Entrar</h3>
      <label>E-mail</label>
      <input type="email" id="login-email" placeholder="seu@email.com" onkeydown="if(event.key==='Enter') document.getElementById('login-password').focus()">
      <label>Senha</label>
      <input type="password" id="login-password" placeholder="Sua senha" onkeydown="if(event.key==='Enter') doLogin()">
      <div id="login-error" style="color:var(--red);font-size:12px;margin-top:8px;display:none"></div>
      <div style="margin-top:14px"><button class="btn-primary btn-full" onclick="doLogin()">Entrar</button></div>
    </div>
  `;
  document.getElementById('login-email').focus();
}
async function doLogin(){
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  errEl.style.display='none';
  if(!email || !password){ errEl.textContent='Preencha e-mail e senha.'; errEl.style.display='block'; return; }
  const {data, error} = await supabaseClient.auth.signInWithPassword({email, password});
  if(error){ errEl.textContent='E-mail ou senha incorretos.'; errEl.style.display='block'; return; }
  SESSION = data.session;
  render();
}
async function doLogout(){
  await supabaseClient.auth.signOut();
  SESSION = null;
  render();
}

// ---------- ADMIN ----------
function renderAdmin(){
  const app = document.getElementById('app');
  const pendentesCount = STATE.tickets.filter(t=>ticketResult(t)==='pending').length;
  app.innerHTML = `
    <div class="brand">
      <div>${renderBrandMark()}</div>
      <button class="btn-ghost btn-sm" onclick="doLogout()">Sair</button>
    </div>
    <div class="tabs">
      <div class="tab ${ADMIN_TAB==='dashboard'?'active':''}" onclick="setTab('dashboard')">Dashboard</div>
      <div class="tab ${ADMIN_TAB==='apostas'?'active':''}" onclick="setTab('apostas')">Apostas</div>
      <div class="tab ${ADMIN_TAB==='pendentes'?'active':''}" onclick="setTab('pendentes')">Pendentes${pendentesCount?' ('+pendentesCount+')':''}</div>
      <div class="tab ${ADMIN_TAB==='clientes'?'active':''}" onclick="setTab('clientes')">Clientes</div>
      <div class="tab ${ADMIN_TAB==='financeiro'?'active':''}" onclick="setTab('financeiro')">Financeiro</div>
      <div class="tab ${ADMIN_TAB==='parceiros'?'active':''}" onclick="setTab('parceiros')">Parceiros</div>
      <div class="tab ${ADMIN_TAB==='config'?'active':''}" onclick="setTab('config')">Configurações</div>
    </div>
    <div id="tab-content"></div>
  `;
  const c = document.getElementById('tab-content');
  if(ADMIN_TAB==='apostas') c.innerHTML = renderApostasTab();
  if(ADMIN_TAB==='pendentes') c.innerHTML = renderPendentesTab();
  if(ADMIN_TAB==='clientes') c.innerHTML = renderClientesTab();
  if(ADMIN_TAB==='dashboard') c.innerHTML = renderDashboardTab();
  if(ADMIN_TAB==='financeiro') c.innerHTML = renderFinanceiroTab();
  if(ADMIN_TAB==='parceiros') c.innerHTML = renderParceirosTab();
  if(ADMIN_TAB==='config') c.innerHTML = renderConfigTab();
}
function setTab(t){ ADMIN_TAB=t; ADMIN_SUBVIEW='list'; render(); }
function changeDashWeek(dir){
  if(!DASH_WEEK) DASH_WEEK = mondayOf(todaySP());
  DASH_WEEK = shiftWeek(DASH_WEEK, dir*7);
  render();
}
function changeFinanceWeek(dir){
  if(!FINANCE_WEEK) FINANCE_WEEK = mondayOf(todaySP());
  FINANCE_WEEK = shiftWeek(FINANCE_WEEK, dir*7);
  render();
}
