const LOGO_STORAGE_KEY = 'boletim_logo_dataurl';
const LOGO_HIDDEN_KEY = 'boletim_logo_hidden';
const LOGO_SHAPE_KEY = 'boletim_logo_shape';
const BG_STORAGE_KEY = 'boletim_bg_dataurl';
const DASHBOARD_LOGO_KEY = 'boletim_dashboard_logo_dataurl';
let PENDING_LOGO_DATAURL = null;
let PENDING_LOGO_SHAPE = 'round';
let PENDING_BG_DATAURL = null;

function renderBrandMark(){
  const saved = localStorage.getItem(DASHBOARD_LOGO_KEY);
  if(saved) return `<img src="${saved}" style="height:32px;max-width:200px;object-fit:contain;display:block;">`;
  return `<span class="mark">BET WIN</span>`;
}
function handleDashboardLogoUpload(e){
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = function(ev){
    localStorage.setItem(DASHBOARD_LOGO_KEY, ev.target.result);
    render();
  };
  reader.readAsDataURL(file);
}
function removeDashboardLogo(){
  if(!confirm('Remover a logo da dashboard e voltar a usar o texto "BET WIN"?')) return;
  localStorage.removeItem(DASHBOARD_LOGO_KEY);
  render();
}

function handleLogoUpload(e){
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = function(ev){
    PENDING_LOGO_DATAURL = ev.target.result;
    PENDING_LOGO_SHAPE = localStorage.getItem(LOGO_SHAPE_KEY) || 'round';
    renderLogoPreviewOverlay();
  };
  reader.readAsDataURL(file);
}
function renderLogoPreviewOverlay(){
  let overlay = document.getElementById('logo-preview-overlay');
  if(!overlay){
    overlay = document.createElement('div');
    overlay.id = 'logo-preview-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
    document.body.appendChild(overlay);
  }
  const shapeStyle = PENDING_LOGO_SHAPE==='round' ? 'border-radius:50%' : 'border-radius:10px';
  overlay.innerHTML = `
    <div class="card" style="max-width:340px;width:100%;text-align:center;margin:0">
      <h3>Prévia da logo</h3>
      <div style="width:150px;height:150px;margin:0 auto 16px;overflow:hidden;${shapeStyle};background:#0B2049;border:2px solid var(--line)">
        <img src="${PENDING_LOGO_DATAURL}" style="width:100%;height:100%;object-fit:cover;display:block;">
      </div>
      <label>Como a logo deve ser recortada</label>
      <div class="row" style="gap:8px">
        <button class="btn-ghost btn-full" style="${PENDING_LOGO_SHAPE==='square'?'border-color:var(--gold);color:var(--gold)':''}" onclick="setLogoPreviewShape('square')">◻ Quadrado</button>
        <button class="btn-ghost btn-full" style="${PENDING_LOGO_SHAPE==='round'?'border-color:var(--gold);color:var(--gold)':''}" onclick="setLogoPreviewShape('round')">◯ Redondo</button>
      </div>
      <div class="row" style="margin-top:14px">
        <button class="btn-ghost btn-full" onclick="cancelLogoPreview()">Cancelar</button>
        <button class="btn-primary btn-full" onclick="confirmLogoPreview()">Usar essa logo</button>
      </div>
    </div>
  `;
}
function setLogoPreviewShape(shape){ PENDING_LOGO_SHAPE = shape; renderLogoPreviewOverlay(); }
function cancelLogoPreview(){
  PENDING_LOGO_DATAURL = null;
  const overlay = document.getElementById('logo-preview-overlay');
  if(overlay) document.body.removeChild(overlay);
}
function confirmLogoPreview(){
  localStorage.setItem(LOGO_STORAGE_KEY, PENDING_LOGO_DATAURL);
  localStorage.setItem(LOGO_SHAPE_KEY, PENDING_LOGO_SHAPE);
  cancelLogoPreview();
  render();
}

function handleBgUpload(e){
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = function(ev){
    PENDING_BG_DATAURL = ev.target.result;
    renderBgPreviewOverlay();
  };
  reader.readAsDataURL(file);
}
function renderBgPreviewOverlay(){
  let overlay = document.getElementById('bg-preview-overlay');
  if(!overlay){
    overlay = document.createElement('div');
    overlay.id = 'bg-preview-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
    document.body.appendChild(overlay);
  }
  overlay.innerHTML = `
    <div class="card" style="max-width:420px;width:100%;text-align:center;margin:0">
      <h3>Prévia do fundo</h3>
      <div style="width:100%;aspect-ratio:720/700;border-radius:8px;overflow:hidden;border:2px solid var(--line);margin-bottom:14px">
        <img src="${PENDING_BG_DATAURL}" style="width:100%;height:100%;object-fit:cover;display:block;">
      </div>
      <p style="font-size:12px;color:var(--text-muted);margin:0 0 16px">A imagem preenche todo o retângulo do fechamento (formato acima), cortando as bordas se precisar.</p>
      <div class="row">
        <button class="btn-ghost btn-full" onclick="cancelBgPreview()">Cancelar</button>
        <button class="btn-primary btn-full" onclick="confirmBgPreview()">Usar esse fundo</button>
      </div>
    </div>
  `;
}
function cancelBgPreview(){
  PENDING_BG_DATAURL = null;
  const overlay = document.getElementById('bg-preview-overlay');
  if(overlay) document.body.removeChild(overlay);
}
function confirmBgPreview(){
  localStorage.setItem(BG_STORAGE_KEY, PENDING_BG_DATAURL);
  cancelBgPreview();
  render();
}
function removeLogo(){
  if(!confirm('Remover a logo atual e voltar a usar o texto "BET WIN" padrão?')) return;
  localStorage.removeItem(LOGO_STORAGE_KEY);
  localStorage.removeItem(LOGO_SHAPE_KEY);
  render();
}
function toggleLogoHidden(checked){
  if(checked){
    localStorage.setItem(LOGO_HIDDEN_KEY, 'true');
  } else {
    localStorage.removeItem(LOGO_HIDDEN_KEY);
  }
  render();
}
function removeBg(){
  if(!confirm('Remover o fundo atual e voltar a usar o fundo estilizado padrão?')) return;
  localStorage.removeItem(BG_STORAGE_KEY);
  render();
}

function renderConfigTab(){
  const savedLogo = localStorage.getItem(LOGO_STORAGE_KEY);
  const savedLogoShape = localStorage.getItem(LOGO_SHAPE_KEY) || 'round';
  const savedBg = localStorage.getItem(BG_STORAGE_KEY);
  const savedDashboardLogo = localStorage.getItem(DASHBOARD_LOGO_KEY);
  const logoHidden = localStorage.getItem(LOGO_HIDDEN_KEY)==='true';
  setTimeout(startBotStatusPoll, 0);
  return `
    <div class="card" id="bot-status-card">${renderBotStatusCard()}</div>
    <div class="card" id="users-card">${renderUsuariosCard()}</div>
    <div class="card">
      <h3>Busca automática de jogos (API-Sports)</h3>
      <p style="font-size:13px;color:var(--text-muted);margin-top:0">No cadastro de apostas, ao digitar o evento o sistema sugere jogos reais do dia e do dia seguinte (ex: “Bayern x Arsenal”, “Chiefs x Bills”). Sem chave, ele já sugere times e jogos que você lançou antes. Para ativar os jogos online, cole abaixo a sua chave (API-KEY) da conta gratuita em <b>dashboard.api-football.com</b> → Profile → My Access. A mesma chave vale para todos os esportes. A chave fica salva só neste navegador.</p>
      <div class="row" style="margin-top:0;align-items:flex-end">
        <div><label style="margin-top:0">Chave da API-Sports</label><input type="text" id="apifootball-key" value="${(typeof evtGetKey==='function' ? evtGetKey() : '').replace(/"/g,'')}" placeholder="Cole aqui a sua chave" autocomplete="off"></div>
        <div style="flex:0 0 auto;min-width:0;display:flex;gap:8px"><button class="btn-primary" onclick="saveApiFootballKey()">Salvar e testar</button><button class="btn-ghost" onclick="removeApiFootballKey()">Remover</button></div>
      </div>
      <label>Esportes na busca <span style="font-weight:400;color:var(--text-muted)">(cada esporte tem o seu limite grátis de 100 consultas por dia)</span></label>
      <div style="display:flex;flex-wrap:wrap;gap:8px 18px;margin-top:6px">
        ${typeof EVT_SPORTS!=='undefined' ? EVT_SPORTS.map(sp=>`<label style="display:flex;align-items:center;gap:6px;margin:0;font-size:13px;font-weight:500"><input type="checkbox" style="width:auto" class="evt-sport-cb" value="${sp.id}" ${evtSelectedSports().some(x=>x.id===sp.id)?'checked':''} onchange="saveEvtSports()">${sp.label}</label>`).join('') : ''}
      </div>
    </div>
    <div class="card">
      <h3>Validadores do robô (WhatsApp)</h3>
      <p style="font-size:13px;color:var(--text-muted);margin-top:0">Só os números cadastrados aqui conseguem validar um print no grupo (respondendo ao print com o valor). Qualquer outro número é ignorado pelo robô.</p>
      ${!STATE.botValidatorsOk ? '<div class="empty" style="text-align:left;padding:0 0 4px">Ainda não existe a tabela de validadores no Supabase — rode o SQL do robô (tabela bot_validators) e atualize a página.</div>' : `
      ${STATE.botValidators.length===0 ? '<div class="empty" style="text-align:left;padding:0 0 14px">Nenhum validador cadastrado ainda.</div>' : `
      <div style="margin-bottom:14px">
        ${STATE.botValidators.map(v=>`
          <div class="match-row" style="gap:10px">
            <div class="match-desc" style="flex:1;min-width:0"><span class="teams">${v.name||'Sem nome'}</span><span class="meta">${formatBotPhone(v.phone)}</span></div>
            <button class="icon-btn icon-danger" title="Remover validador" onclick="removeBotValidator('${v.id}')">🗑</button>
          </div>`).join('')}
      </div>`}
      <div class="row" style="margin-top:0;align-items:flex-end">
        <div><label style="margin-top:0">Nome</label><input type="text" id="new-validator-name" placeholder="Ex: Rafita" onkeydown="if(event.key==='Enter') document.getElementById('new-validator-phone').focus()"></div>
        <div><label style="margin-top:0">WhatsApp (com DDD; de outro país, comece com +)</label><input type="text" id="new-validator-phone" placeholder="Ex: 11 99999-9999 ou +44 7521 139416" onkeydown="if(event.key==='Enter') addBotValidator()"></div>
        <div style="flex:0 0 auto;min-width:0"><button class="btn-primary" onclick="addBotValidator()">Adicionar</button></div>
      </div>`}
    </div>
    <div class="card">
      <h3>Logo da Dashboard</h3>
      <p style="font-size:13px;color:var(--text-muted);margin-top:0">Aparece no topo do seu painel administrativo e na tela de login, no lugar do texto "BET WIN".</p>
      ${savedDashboardLogo ? `<div style="height:48px;margin-bottom:14px;display:flex;align-items:center"><img src="${savedDashboardLogo}" style="max-height:100%;max-width:220px;object-fit:contain;display:block;"></div>` : '<div class="empty" style="text-align:left;padding:0 0 14px">Nenhuma logo configurada ainda — será usado o texto "BET WIN".</div>'}
      <input type="file" id="dashboard-logo-file-input" accept="image/*" style="display:none" onchange="handleDashboardLogoUpload(event)">
      <div class="row" style="margin-top:0">
        <div><button class="btn-ghost btn-full" onclick="document.getElementById('dashboard-logo-file-input').click()">🖼️ ${savedDashboardLogo?'Trocar logo':'Enviar logo'}</button></div>
        ${savedDashboardLogo ? `<div><button class="btn-danger-ghost btn-full" onclick="removeDashboardLogo()">Remover e usar padrão</button></div>` : ''}
      </div>
    </div>
    <div class="card">
      <h3>Logo do fechamento</h3>
      <p style="font-size:13px;color:var(--text-muted);margin-top:0">Aparece no canto superior da imagem de fechamento gerada na Dashboard.</p>
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin-bottom:${logoHidden?'0':'14px'}">
        <input type="checkbox" style="width:auto" ${logoHidden?'checked':''} onchange="toggleLogoHidden(this.checked)">
        <span>Não mostrar nenhuma logo no fechamento</span>
      </label>
      ${logoHidden ? '' : (savedLogo ? `<div style="width:100px;height:100px;margin-bottom:14px;overflow:hidden;${savedLogoShape==='round'?'border-radius:50%':'border-radius:10px'};border:2px solid var(--line)"><img src="${savedLogo}" style="width:100%;height:100%;object-fit:cover;display:block;"></div>` : '<div class="empty" style="text-align:left;padding:0 0 14px">Nenhuma logo configurada ainda — será usado o texto "BET WIN".</div>')}
      ${logoHidden ? '' : `
      <input type="file" id="logo-file-input" accept="image/*" style="display:none" onchange="handleLogoUpload(event)">
      <div class="row" style="margin-top:0">
        <div><button class="btn-ghost btn-full" onclick="document.getElementById('logo-file-input').click()">🖼️ ${savedLogo?'Trocar logo':'Enviar logo'}</button></div>
        ${savedLogo ? `<div><button class="btn-danger-ghost btn-full" onclick="removeLogo()">Remover e usar padrão</button></div>` : ''}
      </div>
      `}
    </div>
    <div class="card">
      <h3>Fundo do fechamento</h3>
      <p style="font-size:13px;color:var(--text-muted);margin-top:0">Foto usada como fundo da imagem de fechamento (ex: um estádio, torcida, ou a arte da sua marca). A imagem final sempre tem <strong>720 x 700px</strong> — prepare sua foto nesse formato (ou próximo) pra ficar sem cortes estranhos.</p>
      ${savedBg ? `<div style="width:100%;max-width:320px;aspect-ratio:720/700;margin-bottom:14px;overflow:hidden;border-radius:8px;border:2px solid var(--line)"><img src="${savedBg}" style="width:100%;height:100%;object-fit:cover;display:block;"></div>` : '<div class="empty" style="text-align:left;padding:0 0 14px">Nenhum fundo configurado ainda — será usado um fundo estilizado padrão.</div>'}
      <input type="file" id="bg-file-input" accept="image/*" style="display:none" onchange="handleBgUpload(event)">
      <div class="row" style="margin-top:0">
        <div><button class="btn-ghost btn-full" onclick="document.getElementById('bg-file-input').click()">🏟️ ${savedBg?'Trocar fundo':'Enviar fundo'}</button></div>
        ${savedBg ? `<div><button class="btn-danger-ghost btn-full" onclick="removeBg()">Remover e usar padrão</button></div>` : ''}
      </div>
    </div>
  `;
}



// ---------- Validadores do robô de WhatsApp ----------
function normalizeBotPhone(raw){
  const txt = String(raw||'').trim();
  let d = txt.replace(/\D/g,'');
  if(/^(\+|00)/.test(txt)) return d.replace(/^00/,'');   // começa com + (ou 00): já tem o código do país (ex.: +44 7521 139416)
  if(d.length===10 || d.length===11) d = '55'+d; // sem código do país: assume Brasil
  return d;
}
function formatBotPhone(p){
  const d = String(p||'').replace(/\D/g,'');
  if(d.length===13 && d.startsWith('55')) return `+55 (${d.slice(2,4)}) ${d.slice(4,9)}-${d.slice(9)}`;
  if(d.length===12 && d.startsWith('55')) return `+55 (${d.slice(2,4)}) ${d.slice(4,8)}-${d.slice(8)}`;
  return d ? '+'+d : '';
}
async function addBotValidator(){
  const name = document.getElementById('new-validator-name').value.trim();
  const phone = normalizeBotPhone(document.getElementById('new-validator-phone').value);
  if(phone.length<11 || phone.length>15){ showToast('Informe o WhatsApp com DDD (ex: 11 99999-9999) ou, de outro país, com + (ex: +44 7521 139416).'); return; }
  const dupe = STATE.botValidators.find(v=>String(v.phone).replace(/\D/g,'').slice(-8)===phone.slice(-8));
  if(dupe){ showToast('Esse número já está cadastrado.'); return; }
  const {data, error} = await supabaseClient.from('bot_validators').insert({name, phone}).select().single();
  if(error){ showToast('Erro ao cadastrar: '+error.message); return; }
  STATE.botValidators.push({id:data.id, name:data.name||'', phone:data.phone||''});
  showToast('Validador cadastrado.');
  render();
}
async function removeBotValidator(id){
  if(!confirm('Remover este validador? Ele não poderá mais validar prints.')) return;
  const {error} = await supabaseClient.from('bot_validators').delete().eq('id', id);
  if(error){ showToast('Erro ao remover: '+error.message); return; }
  STATE.botValidators = STATE.botValidators.filter(v=>v.id!==id);
  render();
}

// ---------- Busca automática de jogos ----------
function saveEvtSports(){
  const ids = Array.from(document.querySelectorAll('.evt-sport-cb')).filter(c=>c.checked).map(c=>c.value);
  evtSetSelectedSports(ids);
}
async function saveApiFootballKey(){
  const v = document.getElementById('apifootball-key').value.trim();
  if(!v){ showToast('Cole a chave da API.'); return; }
  localStorage.setItem(EVT_KEY_STORAGE, v);
  EVT_FIX = {};
  try{
    Object.keys(localStorage).filter(k=>k.startsWith('bw_fix')).forEach(k=>localStorage.removeItem(k));
    const list = await evtLoadSportDate(EVT_SPORTS[0], todaySP());
    showToast('Chave funcionando: '+list.length+' jogos de futebol encontrados hoje.');
  }catch(e){
    showToast('A chave foi salva, mas a API respondeu: '+e.message);
  }
}
function removeApiFootballKey(){
  localStorage.removeItem(EVT_KEY_STORAGE);
  EVT_FIX = {};
  showToast('Busca online desligada. O histórico continua funcionando.');
  render();
}


// ---------- STATUS DO ROBÔ DO WHATSAPP ----------
// O robô envia um sinal a cada minuto. Mais de 3 minutos sem sinal = desligado (PC desligado, janela fechada, sem internet).
function botStatusInfo(){
  const s = STATE.botStatus;
  if(!STATE.botStatusOk) return {tone:'warn', title:'Status indisponível', text:'Rode o SQL do status do robô no Supabase (te enviei no chat) e atualize a página.'};
  if(!s) return {tone:'off', title:'Robô nunca ligou', text:'Ainda não recebi nenhum sinal. Abra o iniciar.bat no computador do robô.'};
  const ageSec = Math.max(0, (Date.now() - Date.parse(s.last_seen||s.updated_at||0))/1000);
  const ago = ageSec<90 ? 'agora há pouco' : (ageSec<3600 ? 'há '+Math.round(ageSec/60)+' min' : (ageSec<86400 ? 'há '+Math.round(ageSec/3600)+' h' : 'há '+Math.round(ageSec/86400)+' dia(s)'));
  if(ageSec>180) return {tone:'off', title:'Robô desligado', text:'Sem sinal '+ago+' (computador desligado, janela fechada ou sem internet). Abra o iniciar.bat.', ago, num:s.wa_number};
  switch(s.state){
    case 'conectado': return {tone:'ok', title:'Conectado', text:'O robô está ligado e ouvindo os grupos.', ago, num:s.wa_number};
    case 'aguardando_codigo': return {tone:'warn', title:'Aguardando conexão', text:'No celular do robô: WhatsApp → Aparelhos conectados → Conectar aparelho → "Conectar com número de telefone" e digite o código abaixo.', code:s.pair_code, ago};
    case 'aguardando_qr': return {tone:'warn', title:'Aguardando conexão', text:'Escaneie o QR Code que aparece na janela do robô no computador.', ago};
    case 'autenticado': return {tone:'warn', title:'Conectando…', text:'Autenticado, finalizando a conexão.', ago};
    case 'desconectado': return {tone:'off', title:'Desconectado', text:(s.detail||'O WhatsApp desconectou o robô.')+' Abra o iniciar.bat para conectar de novo.', ago};
    case 'parado': return {tone:'off', title:'Robô desligado', text:'O robô foi desligado '+ago+'. Abra o iniciar.bat para ligar.', ago};
    default: return {tone:'warn', title:'Iniciando…', text:'O robô está ligando.', ago};
  }
}
function renderBotStatusCard(){
  const i = botStatusInfo();
  const color = i.tone==='ok' ? 'var(--green)' : (i.tone==='warn' ? 'var(--gold)' : 'var(--red)');
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
      <h3 style="margin:0">Robô do WhatsApp</h3>
      <button class="btn-ghost btn-sm" onclick="refreshBotStatus(true)">Atualizar</button>
    </div>
    <div style="display:flex;align-items:center;gap:10px;margin:12px 0 4px">
      <span style="width:12px;height:12px;border-radius:50%;background:${color};box-shadow:0 0 0 4px color-mix(in srgb, ${color} 25%, transparent);flex-shrink:0"></span>
      <span style="font-size:18px;font-weight:700;color:${color}">${i.title}</span>
      ${i.num ? `<span style="font-size:12px;color:var(--text-muted)">· número ${String(i.num).replace(/</g,'&lt;')}</span>` : ''}
    </div>
    <div style="font-size:13px;color:var(--text-muted)">${i.text}</div>
    ${i.code ? `<div style="margin-top:12px;font-family:var(--font-mono);font-size:28px;font-weight:700;letter-spacing:4px;color:var(--gold)">${String(i.code).replace(/</g,'&lt;')}</div>` : ''}
    ${i.ago && i.tone!=='off' ? `<div style="font-size:11px;color:var(--text-muted);margin-top:8px">Último sinal: ${i.ago}</div>` : ''}`;
}
let BOT_POLL = null;
async function refreshBotStatus(manual){
  try{
    const {data, error} = await supabaseClient.from('bot_status').select('*').eq('id','main').maybeSingle();
    STATE.botStatusOk = !error; STATE.botStatus = (!error && data) ? data : null;
  }catch(e){ STATE.botStatusOk = false; }
  const el = document.getElementById('bot-status-card');
  if(el) el.innerHTML = renderBotStatusCard();
  if(manual) showToast('Status atualizado.');
}
function startBotStatusPoll(){
  if(BOT_POLL) clearInterval(BOT_POLL);
  refreshBotStatus(false);
  BOT_POLL = setInterval(()=>{
    if(!document.getElementById('bot-status-card')){ clearInterval(BOT_POLL); BOT_POLL = null; return; }   // saiu da tela: para
    refreshBotStatus(false);
  }, 15000);
}


// ---------- Usuários do sistema (cadastro, senha, bloqueio) ----------
// Trocar a PRÓPRIA senha funciona direto. Criar usuário, redefinir senha de outro, bloquear e excluir
// passam pela função "admin-users" do Supabase (precisa ser publicada uma vez — veja o passo a passo).
// Nome da função no Supabase (Edge Functions). Se um dia criar outra com nome diferente, troque aqui.
const USERS_FN = 'hyper-service';
let USERS_LIST = null, USERS_ERR = '', USERS_LOADING = false;
function usrEsc(v){ return String(v==null?'':v).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
async function usrCall(body){
  try{
    const {data, error} = await supabaseClient.functions.invoke(USERS_FN, {body});
    if(error){
      let msg = error.message || 'erro';
      try{ if(error.context && error.context.json){ const j = await error.context.json(); if(j && j.error) msg = j.error; } }catch(e){}
      const st = error.context && error.context.status ? ' [HTTP '+error.context.status+']' : '';
      if(/not found|404|Failed to send|fetch/i.test(msg)) msg = 'Não consegui falar com a função "'+USERS_FN+'" no Supabase (confira se ela está publicada e ativa).';
      return {error: msg + st + ' — detalhe: ' + (error.message||'')};
    }
    if(data && data.error) return {error: data.error};
    return {data};
  }catch(e){ return {error: e.message||String(e)}; }
}
function renderUsuariosCard(){
  const me = currentUserEmail();
  const rows = USERS_LIST ? USERS_LIST.map(u=>`
    <div class="match-row" style="gap:10px;${u.banned?'opacity:.6':''}">
      <div class="match-desc" style="flex:1;min-width:0"><span class="teams">${usrEsc(u.name||u.email.split('@')[0])}${u.id===currentUserId()?' <span class="chip chip-pending">VOCÊ</span>':''}${u.banned?' <span class="chip chip-void">BLOQUEADO</span>':''}</span><span class="meta">${usrEsc(u.email)}${u.last_sign_in_at?' · último acesso '+new Date(u.last_sign_in_at).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):' · nunca acessou'}</span></div>
      <div class="match-actions">
        <button class="btn-ghost btn-sm" onclick="usrResetSenha('${u.id}')">Nova senha</button>
        ${u.id===currentUserId() ? '' : `<button class="btn-ghost btn-sm" onclick="usrBloquear('${u.id}',${u.banned?'false':'true'})">${u.banned?'Desbloquear':'Bloquear'}</button><button class="btn-danger-ghost btn-sm" onclick="usrExcluir('${u.id}')">Excluir</button>`}
      </div>
    </div>`).join('') : '';
  return `
    <h3>Usuários do sistema</h3>
    <p style="font-size:13px;color:var(--text-muted);margin-top:0">Quem pode entrar no painel. Aqui você cadastra pessoas (ex.: digitação), redefine senha, bloqueia e exclui.</p>
    <div style="padding:12px 0;border-top:1px solid var(--line-soft);border-bottom:1px solid var(--line-soft);margin-bottom:14px">
      <div style="font-weight:600;margin-bottom:8px">Minha conta ${me?`<span style="font-weight:400;color:var(--text-muted)">· ${usrEsc(me)}</span>`:''}</div>
      <div class="row" style="margin-top:0;align-items:flex-end">
        <div><label style="margin-top:0">Nova senha</label><input type="password" id="my-pass-1" autocomplete="new-password" placeholder="Mínimo 6 caracteres"></div>
        <div><label style="margin-top:0">Repita a nova senha</label><input type="password" id="my-pass-2" autocomplete="new-password" onkeydown="if(event.key==='Enter')trocarMinhaSenha()"></div>
        <div style="flex:0 0 auto;min-width:0"><button class="btn-primary" onclick="trocarMinhaSenha()">Trocar minha senha</button></div>
      </div>
    </div>
    ${USERS_ERR ? `<div style="font-size:12.5px;color:var(--red);margin-bottom:10px">${usrEsc(USERS_ERR)}</div>` : ''}
    ${USERS_LIST===null ? `<div style="margin-bottom:14px"><button class="btn-ghost" onclick="carregarUsuarios()">${USERS_LOADING?'Carregando…':'Carregar usuários'}</button></div>` : (USERS_LIST.length===0 ? '<div class="empty" style="text-align:left;padding:0 0 14px">Nenhum usuário.</div>' : `<div style="margin-bottom:14px">${rows}</div>`)}
    <div style="font-weight:600;margin-bottom:8px">Cadastrar novo usuário</div>
    <div class="row" style="margin-top:0;align-items:flex-end">
      <div><label style="margin-top:0">Nome</label><input type="text" id="new-user-name" placeholder="Ex: Maria (digitação)"></div>
      <div><label style="margin-top:0">E-mail (login)</label><input type="email" id="new-user-email" placeholder="maria@email.com" autocomplete="off"></div>
      <div><label style="margin-top:0">Senha inicial</label><input type="text" id="new-user-pass" placeholder="Mínimo 6 caracteres" autocomplete="off" onkeydown="if(event.key==='Enter')criarUsuario()"></div>
      <div style="flex:0 0 auto;min-width:0"><button class="btn-primary" onclick="criarUsuario()">Cadastrar</button></div>
    </div>`;
}
function usrRefresh(){ const c = document.getElementById('users-card'); if(c) c.innerHTML = renderUsuariosCard(); }
async function carregarUsuarios(){
  USERS_LOADING = true; USERS_ERR = ''; usrRefresh();
  const r = await usrCall({action:'list'});
  USERS_LOADING = false;
  if(r.error){ USERS_ERR = r.error; USERS_LIST = null; } else { USERS_LIST = r.data.users || []; }
  usrRefresh();
}
async function trocarMinhaSenha(){
  const a = document.getElementById('my-pass-1').value, b = document.getElementById('my-pass-2').value;
  if(a.length<6){ showToast('A senha precisa ter pelo menos 6 caracteres.'); return; }
  if(a!==b){ showToast('As duas senhas não são iguais.'); return; }
  const {error} = await supabaseClient.auth.updateUser({password:a});
  if(error){ showToast('Erro ao trocar a senha: '+error.message); return; }
  document.getElementById('my-pass-1').value=''; document.getElementById('my-pass-2').value='';
  showToast('Senha alterada!');
}
async function criarUsuario(){
  const name = document.getElementById('new-user-name').value.trim();
  const email = document.getElementById('new-user-email').value.trim();
  const password = document.getElementById('new-user-pass').value;
  if(!name){ showToast('Informe o nome.'); return; }
  if(!/^\S+@\S+\.\S+$/.test(email)){ showToast('E-mail inválido.'); return; }
  if(password.length<6){ showToast('A senha precisa ter pelo menos 6 caracteres.'); return; }
  const r = await usrCall({action:'create', name, email, password});
  if(r.error){ USERS_ERR = r.error; usrRefresh(); showToast('Erro ao cadastrar: '+r.error); return; }
  USERS_ERR = '';
  const u = r.data.user;
  if(u && !STATE.profiles.find(p=>p.id===u.id)) STATE.profiles.push({id:u.id, name});
  showToast('Usuário cadastrado! Passe o e-mail e a senha para a pessoa.');
  await carregarUsuarios();
  ['new-user-name','new-user-email','new-user-pass'].forEach(i=>{ const e=document.getElementById(i); if(e) e.value=''; });
}
async function usrResetSenha(id){
  const p = prompt('Digite a NOVA senha para esse usuário (mínimo 6 caracteres):');
  if(p===null) return;
  if(p.length<6){ showToast('A senha precisa ter pelo menos 6 caracteres.'); return; }
  const r = await usrCall({action:'set_password', user_id:id, password:p});
  if(r.error){ showToast('Erro: '+r.error); return; }
  showToast('Senha redefinida! Avise a pessoa.');
}
async function usrBloquear(id, bloquear){
  if(!confirm(bloquear ? 'Bloquear esse usuário? Ele não consegue mais entrar (você pode desbloquear depois).' : 'Desbloquear esse usuário?')) return;
  const r = await usrCall({action:'set_banned', user_id:id, banned:bloquear});
  if(r.error){ showToast('Erro: '+r.error); return; }
  await carregarUsuarios();
}
async function usrExcluir(id){
  if(!confirm('Excluir esse usuário de vez? As apostas que ele lançou continuam, mas ele nunca mais entra. Se só quer impedir o acesso, use Bloquear.')) return;
  const r = await usrCall({action:'delete', user_id:id});
  if(r.error){ showToast('Erro: '+r.error); return; }
  STATE.profiles = STATE.profiles.filter(p=>p.id!==id);
  await carregarUsuarios();
}
