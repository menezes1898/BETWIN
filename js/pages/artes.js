// ==================== PÁGINA "ARTES DO DIA" ====================
// Você sobe as imagens (artes dos jogos), escolhe os grupos e o robô manda em todos eles, um por vez, com pausa entre os envios.
// Usa a mesma fila dos fechamentos (tabela bot_outbox). Nada é enviado sem a janela de confirmação.
let ARTES = [];                 // [{name, dataUrl, b64, kb}]
let ARTES_CAPTION = '';
let ARTES_SEL = null;           // Set de ids de grupos marcados (null = ainda não escolheu: começa com os grupos de clientes)
let ARTES_BUSCA = '';
let ARTES_BUSY = false, ARTES_HIST = [], ARTES_TABELA_OK = true, ARTES_ERR = '', ARTES_POLL = null;

function arEsc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'); }

// lista de grupos: os dos clientes (marcados por padrão) + os outros que o robô enxerga (desmarcados)
function artesGrupos(){
  const donos = {}; STATE.clients.forEach(c=>{ if(c.waGroupId) donos[c.waGroupId] = c.name; });
  const lista = STATE.botGroups.map(g=>({id:g.id, name:g.name||'(sem nome)', cliente: donos[g.id]||null}));
  Object.keys(donos).forEach(id=>{ if(!lista.some(g=>g.id===id)) lista.push({id, name:'(grupo de '+donos[id]+')', cliente:donos[id]}); });
  return lista.sort((a,b)=>(b.cliente?1:0)-(a.cliente?1:0) || a.name.localeCompare(b.name,'pt-BR'));
}
function artesSel(){ if(!ARTES_SEL){ ARTES_SEL = new Set(artesGrupos().filter(g=>g.cliente).map(g=>g.id)); } return ARTES_SEL; }

function renderArtesTab(){
  const grupos = artesGrupos(), sel = artesSel();
  const busca = ARTES_BUSCA.trim().toLowerCase();
  const vis = grupos.filter(g=>!busca || g.name.toLowerCase().includes(busca) || (g.cliente||'').toLowerCase().includes(busca));
  const nSel = grupos.filter(g=>sel.has(g.id)).length;
  setTimeout(artesCarregarHist, 0);
  const prev = ARTES.map((a,i)=>`<div style="position:relative;width:120px"><img src="${a.dataUrl}" style="width:120px;height:120px;object-fit:cover;border-radius:10px;border:1px solid var(--line);display:block"><button type="button" class="btn-ghost btn-sm" style="position:absolute;top:4px;right:4px;padding:1px 7px" onclick="artesRemover(${i})" title="Tirar esta arte">✕</button><div style="font-size:10.5px;color:var(--text-muted);margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${arEsc(a.name)} · ${a.kb} KB</div></div>`).join('');
  const linhas = vis.map(g=>`<label style="display:flex;align-items:center;gap:10px;padding:7px 4px;border-bottom:1px solid var(--line-soft);cursor:pointer">
      <input type="checkbox" ${sel.has(g.id)?'checked':''} onchange="artesToggle('${g.id}',this.checked)" style="width:auto">
      <span style="flex:1;min-width:0">${arEsc(g.name)}${g.cliente?` <span style="font-size:11px;color:var(--text-muted)">· cliente ${arEsc(g.cliente)}</span>`:''}</span></label>`).join('');
  return `
    <div class="card" style="margin-bottom:14px">
      <h3 style="margin:0 0 6px">1. Suba as artes</h3>
      <div id="artes-drop" ondragover="event.preventDefault()" ondrop="artesDrop(event)" onclick="document.getElementById('artes-file').click()" style="border:2px dashed var(--line);border-radius:12px;padding:18px;text-align:center;cursor:pointer;color:var(--text-muted);font-size:13px">📷 Clique aqui ou arraste as imagens (JPG, PNG). Elas são reduzidas automaticamente.</div>
      <input type="file" id="artes-file" accept="image/*" multiple style="display:none" onchange="artesAdicionar(this.files); this.value=''">
      ${ARTES.length ? `<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px">${prev}</div>` : ''}
      <label style="margin-top:12px;display:block">Legenda (opcional, vai só na primeira imagem)</label>
      <textarea id="artes-cap" rows="3" placeholder="Ex.: Jogos do dia 🔥" oninput="ARTES_CAPTION=this.value" style="width:100%">${arEsc(ARTES_CAPTION)}</textarea>
    </div>
    <div class="card" style="margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:6px">
        <h3 style="margin:0">2. Escolha os grupos <span style="font-size:12px;color:var(--text-muted);font-weight:400">(<span id="artes-nsel">${nSel}</span> de ${grupos.length} marcados)</span></h3>
        <span style="font-size:12px"><a href="javascript:void(0)" onclick="artesMarcar('clientes')">só clientes</a> · <a href="javascript:void(0)" onclick="artesMarcar('todos')">todos</a> · <a href="javascript:void(0)" onclick="artesMarcar('nenhum')">nenhum</a></span>
      </div>
      <input type="text" placeholder="Buscar grupo ou cliente" value="${arEsc(ARTES_BUSCA)}" oninput="ARTES_BUSCA=this.value; artesRepaint()" id="artes-busca" style="width:100%;margin-bottom:6px">
      <div id="artes-grupos" style="max-height:340px;overflow:auto;border-top:1px solid var(--line-soft)">${linhas || '<div class="empty">Nenhum grupo encontrado. O robô precisa estar ligado para listar os grupos.</div>'}</div>
    </div>
    ${ARTES_TABELA_OK ? '' : `<div style="margin-bottom:12px;padding:10px 12px;border:1px solid var(--red);border-radius:10px;font-size:12.5px">A fila de envio não está pronta no banco (rode os SQLs do envio de fechamentos e das artes). <span style="color:var(--text-muted)">${arEsc(ARTES_ERR)}</span></div>`}
    <div class="card" style="margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
      <span id="artes-resumo" style="font-size:13px;color:var(--text-muted)">${artesResumoTxt(nSel)}</span>
      <button class="btn-primary" id="artes-send" ${ARTES.length&&nSel&&!ARTES_BUSY&&ARTES_TABELA_OK?'':'disabled'} onclick="artesEnviar()">📤 Enviar artes</button>
    </div>
    <div class="card"><h3 style="margin:0 0 6px">Últimos envios de artes</h3><div id="artes-hist">${artesHistHtml()}</div></div>`;
}
function artesResumoTxt(nSel){ return ARTES.length+' arte'+(ARTES.length===1?'':'s')+' · '+nSel+' grupo'+(nSel===1?'':'s')+' · '+(ARTES.length*nSel)+' envio'+(ARTES.length*nSel===1?'':'s')+' (o robô faz um por vez, com pausa entre eles)'; }
function artesAtualizarResumo(){
  const sel = artesSel(), n = artesGrupos().filter(g=>sel.has(g.id)).length;
  const a = document.getElementById('artes-nsel'); if(a) a.textContent = n;
  const r = document.getElementById('artes-resumo'); if(r) r.textContent = artesResumoTxt(n);
  const b = document.getElementById('artes-send'); if(b) b.disabled = !(ARTES.length && n && !ARTES_BUSY && ARTES_TABELA_OK);
}
function artesRepaint(){
  // repinta só a lista de grupos (mantém o foco na busca)
  const grupos = artesGrupos(), sel = artesSel(), busca = ARTES_BUSCA.trim().toLowerCase();
  const vis = grupos.filter(g=>!busca || g.name.toLowerCase().includes(busca) || (g.cliente||'').toLowerCase().includes(busca));
  const el = document.getElementById('artes-grupos'); if(!el) return;
  el.innerHTML = vis.map(g=>`<label style="display:flex;align-items:center;gap:10px;padding:7px 4px;border-bottom:1px solid var(--line-soft);cursor:pointer"><input type="checkbox" ${sel.has(g.id)?'checked':''} onchange="artesToggle('${g.id}',this.checked)" style="width:auto"><span style="flex:1;min-width:0">${arEsc(g.name)}${g.cliente?` <span style="font-size:11px;color:var(--text-muted)">· cliente ${arEsc(g.cliente)}</span>`:''}</span></label>`).join('') || '<div class="empty">Nenhum grupo encontrado.</div>';
}
function artesToggle(id, on){ const s = artesSel(); if(on) s.add(id); else s.delete(id); artesAtualizarResumo(); }
function artesMarcar(modo){
  const g = artesGrupos();
  ARTES_SEL = new Set(modo==='todos' ? g.map(x=>x.id) : modo==='clientes' ? g.filter(x=>x.cliente).map(x=>x.id) : []);
  artesRepaint(); artesAtualizarResumo();
}
function artesRemover(i){ ARTES.splice(i,1); render(); }
function artesDrop(e){ e.preventDefault(); artesAdicionar(e.dataTransfer && e.dataTransfer.files); }

// reduz a imagem (lado maior 1280px, JPEG) para não pesar na fila
function artesComprimir(file){
  return new Promise((resolve, reject)=>{
    const r = new FileReader();
    r.onerror = ()=>reject(new Error('não consegui ler '+file.name));
    r.onload = ()=>{
      const img = new Image();
      img.onerror = ()=>reject(new Error(file.name+' não é uma imagem válida'));
      img.onload = ()=>{
        const max = 1280, k = Math.min(1, max/Math.max(img.width, img.height));
        const c = document.createElement('canvas'); c.width = Math.round(img.width*k); c.height = Math.round(img.height*k);
        const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0,0,c.width,c.height); ctx.drawImage(img,0,0,c.width,c.height);
        const url = c.toDataURL('image/jpeg', 0.85);
        resolve({name:file.name.replace(/\.[^.]+$/,'')+'.jpg', dataUrl:url, b64:url.split(',')[1], kb:Math.round(url.length*0.75/1024)});
      };
      img.src = r.result;
    };
    r.readAsDataURL(file);
  });
}
async function artesAdicionar(files){
  const arr = Array.from(files||[]).filter(f=>/^image\//.test(f.type));
  if(!arr.length){ showToast('Escolha arquivos de imagem.', 'error'); return; }
  for(const f of arr){
    try{ ARTES.push(await artesComprimir(f)); }catch(e){ showToast(e.message, 'error'); }
  }
  render();
}

async function artesEnviar(){
  if(ARTES_BUSY) return;
  const grupos = artesGrupos().filter(g=>artesSel().has(g.id));
  if(!ARTES.length || !grupos.length) return;
  const ok = await artesConfirmar(grupos);
  if(!ok) return;
  ARTES_BUSY = true; render();
  const batch = 'arte-'+Date.now();
  const hoje = todaySP();
  let n = 0; const falhas = [];
  // uma linha por grupo e por arte, na ordem (as artes de um grupo saem juntas, uma atrás da outra)
  for(const g of grupos){
    for(let i=0;i<ARTES.length;i++){
      const a = ARTES[i];
      try{
        const {error} = await supabaseClient.from('bot_outbox').insert({client_id:null, group_id:g.id, week_start:hoje, filename:a.name, caption: i===0 ? (ARTES_CAPTION||'') : '', pdf_b64:a.b64, mime:'image/jpeg', kind:'arte', batch_id:batch, status:'pendente', created_by:String(currentUserId()||'')});
        if(error) throw new Error(error.message);
        n++;
      }catch(e){ falhas.push(g.name+': '+(e.message||e)); break; }
    }
  }
  ARTES_BUSY = false;
  showToast(n+' envio'+(n===1?'':'s')+' na fila para o robô.'+(falhas.length?' Falhou em '+falhas.length+' grupo(s).':''), falhas.length?'error':'success');
  if(falhas.length) alert('Não entraram na fila:\n\n'+falhas.slice(0,10).join('\n'));
  else { ARTES = []; ARTES_CAPTION = ''; }
  render();
}
function artesConfirmar(grupos){
  return new Promise(resolve=>{
    const o = document.createElement('div');
    o.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9999;display:flex;align-items:flex-start;justify-content:center;padding:28px 14px;overflow:auto;';
    const fim = v=>{ o.remove(); document.body.style.overflow=''; resolve(v); };
    const mostra = grupos.slice(0,6).map(g=>arEsc(g.name)).join(', ') + (grupos.length>6 ? ' e mais '+(grupos.length-6) : '');
    o.innerHTML = `<div class="card" style="max-width:540px;width:100%;margin:0">
      <h3 style="margin:0 0 8px">Enviar as artes agora?</h3>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">${ARTES.map(a=>`<img src="${a.dataUrl}" style="height:70px;border-radius:8px;border:1px solid var(--line)">`).join('')}</div>
      <div style="text-align:center;padding:12px;border:1px solid var(--gold);border-radius:12px;margin-bottom:10px">
        <div style="font-size:11px;letter-spacing:.5px;color:var(--text-muted)">VAI PARA</div>
        <div style="font-size:20px;font-weight:800;color:var(--gold)">${grupos.length} grupo${grupos.length>1?'s':''}</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:2px">${mostra}</div>
      </div>
      ${ARTES_CAPTION ? `<div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">Legenda:</div><pre style="white-space:pre-wrap;font-family:inherit;font-size:12.5px;background:var(--surface-2,#111);border:1px solid var(--line);border-radius:10px;padding:10px;margin:0 0 10px">${arEsc(ARTES_CAPTION)}</pre>` : '<div style="font-size:12px;color:var(--text-muted);margin-bottom:10px">Sem legenda.</div>'}
      <div style="font-size:12.5px;margin-bottom:12px;line-height:1.5">${ARTES.length} arte${ARTES.length>1?'s':''} × ${grupos.length} grupo${grupos.length>1?'s':''} = <b>${ARTES.length*grupos.length} envio${ARTES.length*grupos.length>1?'s':''}</b>. O robô manda um por vez, com pausa entre eles; pode levar alguns minutos.</div>
      <div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn-ghost" id="ar-no">Cancelar</button><button class="btn-primary" id="ar-ok">Confirmar e enviar</button></div></div>`;
    document.body.appendChild(o); document.body.style.overflow = 'hidden';
    o.querySelector('#ar-no').onclick = ()=>fim(false); o.querySelector('#ar-ok').onclick = ()=>fim(true);
    o.addEventListener('click', e=>{ if(e.target===o) fim(false); });
  });
}

// ---- histórico: agrupa por envio (batch) e mostra quantos já foram ----
async function artesCarregarHist(){
  try{
    const {data, error} = await supabaseClient.from('bot_outbox').select('id,batch_id,group_id,status,error,created_at').eq('kind','arte').order('created_at',{ascending:false}).limit(600);
    if(error){ ARTES_TABELA_OK = false; ARTES_ERR = error.message; }
    else { ARTES_TABELA_OK = true; ARTES_HIST = data||[]; }
  }catch(e){ ARTES_TABELA_OK = false; ARTES_ERR = e.message; }
  if(ADMIN_TAB!=='artes') return;
  const el = document.getElementById('artes-hist'); if(el) el.innerHTML = artesHistHtml();
  clearTimeout(ARTES_POLL);
  if(ARTES_HIST.some(r=>r.status==='pendente'||r.status==='enviando')) ARTES_POLL = setTimeout(()=>{ if(ADMIN_TAB==='artes') artesCarregarHist(); }, 8000);
}
function artesHistHtml(){
  if(!ARTES_HIST.length) return '<div class="empty" style="font-size:12.5px">Nenhum envio de arte ainda.</div>';
  const lotes = {}; ARTES_HIST.forEach(r=>{ const k = r.batch_id||'?'; (lotes[k] = lotes[k]||[]).push(r); });
  return Object.entries(lotes).slice(0,8).map(([k,rs])=>{
    const c = s=>rs.filter(r=>r.status===s).length;
    const fila = c('pendente')+c('enviando'), ok = c('enviado'), er = c('erro');
    const t = new Date(rs[rs.length-1].created_at);
    const quando = t.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})+' '+t.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
    const erros = rs.filter(r=>r.status==='erro').slice(0,3).map(r=>{ const g = STATE.botGroups.find(x=>x.id===r.group_id); return arEsc((g?g.name:r.group_id)+': '+(r.error||'')); }).join('<br>');
    return `<div style="padding:7px 0;border-bottom:1px solid var(--line-soft);font-size:12.5px"><b>${quando}</b> · ${rs.length} envio${rs.length>1?'s':''}: <span style="color:var(--green)">${ok} enviado${ok===1?'':'s'}</span>${fila?` · <span style="color:var(--gold)">${fila} na fila</span>`:''}${er?` · <span style="color:var(--red)">${er} com erro</span>`:''}${erros?`<div style="color:var(--red);font-size:11.5px;margin-top:2px">${erros}</div>`:''}</div>`;
  }).join('');
}
