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
  return `
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

