function render(){
  document.body.classList.remove('is-admin');
  const hash = window.location.hash;
  const m = hash.match(/cliente=([a-zA-Z0-9]+)/);
  if(m){ renderClientView(m[1]); return; }
  const mc = hash.match(/comissionado=([a-zA-Z0-9]+)/);
  if(mc){ renderCommissionerView(mc[1]); return; }
  const mp = hash.match(/parceiro=([a-zA-Z0-9]+)/);
  if(mp){ renderPartnerView(mp[1]); return; }
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
// Ícones do menu (traço único, mesmo estilo em tudo).
const NAV_ICONS = {
  home:'<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  ticket:'<path d="M3 9V6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v3a3 3 0 0 0 0 6v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3a3 3 0 0 0 0-6z"/><path d="M13 5v2M13 11v2M13 17v2"/>',
  users:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.3c2 .8 3.5 2.6 3.5 5.7"/>',
  list:'<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  check:'<circle cx="12" cy="12" r="9"/><path d="m8.5 12.5 2.5 2.5 4.5-5"/>',
  star:'<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>',
  percent:'<path d="M19 5 5 19"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/>',
  link:'<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/>',
  wallet:'<path d="M3 7a2 2 0 0 1 2-2h13v4"/><path d="M3 7v11a2 2 0 0 0 2 2h15V9H5a2 2 0 0 1-2-2z"/><circle cx="16.5" cy="14.5" r="1"/>',
  settings:'<path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  chevron:'<path d="m6 9 6 6 6-6"/>',
  menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  logout:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  collapse:'<path d="m15 6-6 6 6 6"/>'
};
function navIcon(name, size){
  const s = size || 18;
  return `<svg class="ico" viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${NAV_ICONS[name]||''}</svg>`;
}
// Estado visual do menu (só aparência; nada a ver com dados).
let NAV_GROUPS = {};
function navCollapsed(){ try{ return localStorage.getItem('bw_nav_collapsed')==='1'; }catch(e){ return false; } }
function toggleNavCollapse(){
  const next = !navCollapsed();
  try{ localStorage.setItem('bw_nav_collapsed', next?'1':'0'); }catch(e){}
  const sh = document.querySelector('.shell');
  if(sh) sh.classList.toggle('collapsed', next);
}
function toggleNav(){
  const sh = document.querySelector('.shell');
  if(sh) sh.classList.toggle('nav-open');
}
function toggleNavGroup(key, el){
  const g = el.closest('.nav-group');
  if(!g) return;
  const closed = g.classList.toggle('closed');
  NAV_GROUPS[key] = !closed;
}
function adminNavModel(pendentesCount, conferenciaCount){
  return [
    {tab:'dashboard', label:'Dashboard', icon:'home'},
    {key:'apostas', label:'Apostas', icon:'ticket', items:[
      {tab:'apostas', label:'Apostas', icon:'list'},
      {tab:'pendentes', label:'Pendentes', icon:'clock', badge:pendentesCount},
      {tab:'conferencia', label:'Conferência', icon:'check', badge:conferenciaCount},
      {tab:'destaques', label:'Destaques do Dia', icon:'star'}
    ]},
    {key:'clientes', label:'Clientes', icon:'users', items:[
      {tab:'clientes', label:'Clientes', icon:'user'},
      {tab:'parceiros', label:'Comissionados', icon:'percent'},
      {tab:'parcerias', label:'Parcerias', icon:'link'}
    ]},
    {tab:'financeiro', label:'Financeiro', icon:'wallet'},
    {tab:'config', label:'Configurações', icon:'settings'}
  ];
}
function renderAdmin(){
  document.body.classList.add('is-admin');
  const app = document.getElementById('app');
  const pendentesCount = STATE.tickets.filter(t=>ticketResult(t)==='pending').length;
  const conferenciaCount = conferenciaPendingCount();
  const nav = adminNavModel(pendentesCount, conferenciaCount);

  let activeItem = null, activeGroup = null;
  nav.forEach(n=>{
    if(n.items){ n.items.forEach(i=>{ if(i.tab===ADMIN_TAB){ activeItem=i; activeGroup=n; } }); }
    else if(n.tab===ADMIN_TAB){ activeItem=n; }
  });

  const itemHtml = (i)=>`
    <div class="nav-item ${i.tab===ADMIN_TAB?'active':''}" role="button" tabindex="0" title="${i.label}" onclick="setTab('${i.tab}')" onkeydown="if(event.key==='Enter') setTab('${i.tab}')">
      ${navIcon(i.icon)}<span class="nav-label">${i.label}</span>${i.badge?`<span class="nav-badge">${i.badge}</span>`:''}
    </div>`;
  const navHtml = nav.map(n=>{
    if(!n.items) return itemHtml(n);
    const open = NAV_GROUPS[n.key]!==false;
    return `
      <div class="nav-group ${open?'':'closed'}">
        <div class="nav-item nav-group-head" role="button" tabindex="0" onclick="toggleNavGroup('${n.key}',this)">
          ${navIcon(n.icon)}<span class="nav-label">${n.label}</span><span class="nav-chev">${navIcon('chevron',14)}</span>
        </div>
        <div class="nav-sub">${n.items.map(itemHtml).join('')}</div>
      </div>`;
  }).join('');

  const email = (SESSION && SESSION.user && SESSION.user.email) ? SESSION.user.email : '';
  const crumbs = [navIcon('home',13)];
  if(activeGroup && activeGroup.label!==(activeItem&&activeItem.label)) crumbs.push(`<span>${activeGroup.label}</span>`);
  if(activeItem) crumbs.push(`<b>${activeItem.label}</b>`);

  app.innerHTML = `
    <div class="shell ${navCollapsed()?'collapsed':''}">
      <aside class="sidebar">
        <div class="sb-top">
          <div class="sb-brand">${renderBrandMark()}</div>
          <div class="sb-collapse" role="button" tabindex="0" onclick="toggleNavCollapse()" title="Recolher / expandir menu">${navIcon('collapse',16)}</div>
        </div>
        <nav class="sb-nav">${navHtml}</nav>
        <div class="sb-foot">
          <div class="sb-user" title="${email}"><span class="av">${(email||'?').charAt(0).toUpperCase()}</span><span class="nav-label">${email}</span></div>
        </div>
      </aside>
      <div class="sb-backdrop" onclick="toggleNav()"></div>
      <div class="main">
        <header class="topbar">
          <button class="tb-menu" onclick="toggleNav()" aria-label="Abrir menu">${navIcon('menu',20)}</button>
          <div class="tb-spacer"></div>
          ${ADMIN_SUBVIEW==='wizard' ? '' : `<button class="btn-primary tb-new" onclick="ADMIN_TAB='apostas';startNewTicket()">${navIcon('plus',15)}<span>Nova Aposta</span></button>`}
          <button class="tb-icon" onclick="doLogout()" title="Sair" aria-label="Sair">${navIcon('logout',17)}</button>
        </header>
        <main class="page">
          <div class="page-head">
            <h1>${activeItem?activeItem.label:''}</h1>
            <div class="crumbs">${crumbs.join('<i>›</i>')}</div>
          </div>
          <div id="tab-content"></div>
        </main>
      </div>
    </div>
  `;
  const c = document.getElementById('tab-content');
  if(ADMIN_TAB==='apostas') c.innerHTML = renderApostasTab();
  if(ADMIN_TAB==='pendentes') c.innerHTML = renderPendentesTab();
  if(ADMIN_TAB==='conferencia') c.innerHTML = renderConferenciaTab();
  if(ADMIN_TAB==='clientes') c.innerHTML = renderClientesTab();
  if(ADMIN_TAB==='dashboard') c.innerHTML = renderDashboardTab();
  if(ADMIN_TAB==='financeiro') c.innerHTML = renderFinanceiroTab();
  if(ADMIN_TAB==='parceiros') c.innerHTML = renderParceirosTab();
  if(ADMIN_TAB==='parcerias') c.innerHTML = renderParceriasTab();
  if(ADMIN_TAB==='destaques') c.innerHTML = renderDestaquesTab();
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
