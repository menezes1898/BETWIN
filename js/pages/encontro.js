// ==================== ENCONTRO DE CONTAS (aba do Financeiro) ====================
// Escolha os clientes do grupo, veja o saldo de cada um e o total do grupo, dê baixa e,
// se precisar, lance um valor "por fora". Dá para salvar o grupo e gerar um link.
// Convenção (igual ao resto do sistema): saldo positivo = cliente deve (você recebe);
// negativo = você deve ao cliente (você paga).
let ENC_DRAFT = {editId:null, name:'', ids:[], extras:[], q:'', side:'all', min:'', max:'', onlySel:false, showZero:false};
function encReset(){ ENC_DRAFT = {editId:null, name:'', ids:[], extras:[], q:'', side:'all', min:'', max:'', onlySel:false, showZero:false}; }
function encEsc(s){ return String(s==null?'':s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function encLink(code){ return window.location.href.split('#')[0]+'#encontro='+code; }
function encParse(v){
  let s = String(v==null?'':v).trim().replace(/[^\d,.\-]/g,'');
  if(!s) return NaN;
  if(s.includes(',')) s = s.replace(/\./g,'').replace(',','.');
  else if((s.match(/\./g)||[]).length>1) s = s.replace(/\./g,'');
  return parseFloat(s);
}

// ids = clientes, extras = [{id, label, amount}] (amount com o mesmo sinal do saldo)
function encSummary(ids, extras){
  const rows = (ids||[]).map(id=>{
    const cl = STATE.clients.find(c=>c.id===id);
    if(!cl) return null;
    const saldo = computeContinuousBalance(id, null);
    const pend = STATE.tickets.filter(t=>t.clientId===id && ticketResult(t)==='pending');
    return {id, name:cl.name, saldo, pendCount:pend.length, pendValor:pend.reduce((s,t)=>s+t.stake,0)};
  }).filter(Boolean).sort((a,b)=>Math.abs(b.saldo)-Math.abs(a.saldo));
  const ex = (extras||[]).map(e=>({id:e.id, label:e.label, saldo:e.amount, extra:true}));
  const all = rows.concat(ex);
  const devem = all.filter(r=>r.saldo>=0.005).reduce((s,r)=>s+r.saldo,0);
  const receber = all.filter(r=>r.saldo<=-0.005).reduce((s,r)=>s-r.saldo,0);
  return {rows, extras:ex, devem, receber, liquido: devem-receber};
}
function encAllBalances(){
  return STATE.clients.map(c=>{
    const saldo = computeContinuousBalance(c.id, null);
    return {id:c.id, name:c.name, saldo, phone:c.phone||''};
  });
}
function encFiltered(){
  const d = ENC_DRAFT, q = evtNorm(d.q||'');
  const min = encParse(d.min), max = encParse(d.max);
  const sel = new Set(d.ids);
  return encAllBalances().filter(r=>{
    if(!d.showZero && Math.abs(r.saldo)<0.005 && !sel.has(r.id)) return false;
    if(d.onlySel && !sel.has(r.id)) return false;
    if(d.side==='rec' && !(r.saldo>0.005)) return false;
    if(d.side==='pag' && !(r.saldo<-0.005)) return false;
    if(q && !evtNorm(r.name).includes(q)) return false;
    if(!isNaN(min) && Math.abs(r.saldo)<min) return false;
    if(!isNaN(max) && Math.abs(r.saldo)>max) return false;
    return true;
  }).sort((a,b)=>Math.abs(b.saldo)-Math.abs(a.saldo));
}
const encTone = s => Math.abs(s)<0.005 ? '' : (s>0 ? 'profit-pos' : 'profit-neg');
const encWord = s => Math.abs(s)<0.005 ? 'quitado' : (s>0 ? 'a receber' : 'a pagar');

function renderEncontroTab(){
  if(STATE.accountMeetingsOk===false){
    return `<div class="card"><h3>Encontro de contas</h3><div class="empty">A tabela de encontros ainda não existe no banco. Rode o SQL que enviei no chat (Supabase → SQL Editor) e recarregue.</div></div>`;
  }
  const d = ENC_DRAFT;
  const list = (STATE.accountMeetings||[]);
  setTimeout(encRefresh, 0);   // preenche o painel e a lista logo após a tela ser montada
  return `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
        <h3 style="margin:0">${d.editId?'Editando encontro salvo':'Encontro de contas'}</h3>
        ${d.editId?'<button class="btn-ghost btn-sm" onclick="encCancelEdit()">Cancelar edição</button>':''}
      </div>
      <p style="font-size:13px;color:var(--text-muted);margin:6px 0 12px">Marque os clientes do grupo para somar os saldos. Dá baixa direto aqui e lance valores por fora quando precisar.</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">
        <div style="flex:2;min-width:200px"><label>Buscar cliente</label><input type="text" id="enc-q" value="${encEsc(d.q)}" placeholder="Nome…" autocomplete="off" oninput="ENC_DRAFT.q=this.value;encRefresh()"></div>
        <div style="flex:1;min-width:150px"><label>Lado</label>
          <select id="enc-side" onchange="ENC_DRAFT.side=this.value;encRefresh()">
            <option value="all" ${d.side==='all'?'selected':''}>Todos</option>
            <option value="rec" ${d.side==='rec'?'selected':''}>Só a receber</option>
            <option value="pag" ${d.side==='pag'?'selected':''}>Só a pagar</option>
          </select></div>
        <div style="flex:1;min-width:110px"><label>Valor de</label><input type="text" inputmode="decimal" id="enc-min" value="${encEsc(d.min)}" placeholder="0,00" oninput="ENC_DRAFT.min=this.value;encRefresh()"></div>
        <div style="flex:1;min-width:110px"><label>até</label><input type="text" inputmode="decimal" id="enc-max" value="${encEsc(d.max)}" placeholder="sem limite" oninput="ENC_DRAFT.max=this.value;encRefresh()"></div>
      </div>
      <label style="display:flex;align-items:center;gap:8px;margin:10px 0 0;text-transform:none;font-size:13px;cursor:pointer"><input type="checkbox" style="width:auto;margin:0" ${d.showZero?'checked':''} onchange="ENC_DRAFT.showZero=this.checked;encRefresh()"> mostrar também clientes quitados</label>
      <div id="enc-panel" style="margin-top:14px"></div>
      <div id="enc-list" style="margin-top:14px"></div>
    </div>
    <div class="card">
      <h3>Encontros salvos <span style="font-size:12px;color:var(--text-muted);font-weight:400">(cada um tem um link para enviar)</span></h3>
      ${list.length===0 ? '<div class="empty">Nenhum encontro salvo ainda. Monte o grupo acima e clique em "Salvar e gerar link".</div>' : list.slice().sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||'')).map(m=>{
        const s = encSummary(m.clientIds, m.extras);
        return `
        <div class="match-row" style="flex-direction:column;align-items:stretch;gap:8px">
          <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center">
            <div><span class="teams">${encEsc(m.name)}</span><span class="meta" style="display:block">${s.rows.length} cliente${s.rows.length===1?'':'s'}${s.extras.length?` + ${s.extras.length} por fora`:''} · a receber ${fmtBRL(s.devem)} · a pagar ${fmtBRL(s.receber)}</span></div>
            <div style="font-family:var(--font-mono);font-size:15px;font-weight:700" class="${s.liquido>=0?'profit-pos':'profit-neg'}">${s.liquido>=0?'Você recebe ':'Você paga '}${fmtBRL(Math.abs(s.liquido))}</div>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <code style="flex:1;min-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;padding:6px 8px">${encLink(m.code)}</code>
            <button class="btn-ghost btn-sm" onclick="encCopyLink('${m.id}')">Copiar link</button>
            <button class="btn-ghost btn-sm" onclick="encCopyText('${m.id}')">Copiar resumo</button>
            <button class="btn-ghost btn-sm" onclick="window.open(encLink('${m.code}'),'_blank')">Abrir</button>
            <button class="btn-ghost btn-sm" onclick="encEdit('${m.id}')">Editar</button>
            <button class="btn-ghost btn-sm" style="color:var(--red)" onclick="encDelete('${m.id}')">Excluir</button>
          </div>
        </div>`;}).join('')}
    </div>
  `;
}

// atualiza só o painel e a lista (não mexe nos campos de filtro, então o cursor não se perde)
function encRefresh(){
  const panel = document.getElementById('enc-panel'), box = document.getElementById('enc-list');
  if(!panel || !box) return;
  const d = ENC_DRAFT, sel = new Set(d.ids);
  const S = encSummary(d.ids, d.extras);
  const rowSel = r=>`
    <div class="match-row" style="gap:10px;background:var(--surface)">
      <input type="checkbox" style="width:auto;margin:0" checked onchange="encToggle('${r.id}')">
      <div class="match-desc" style="flex:1;min-width:0"><span class="teams" style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${encEsc(r.name)}</span>${r.pendCount?`<span class="meta">${r.pendCount} aposta(s) em aberto fora da conta</span>`:''}</div>
      <div style="text-align:right"><div style="font-family:var(--font-mono);font-weight:700" class="${encTone(r.saldo)}">${fmtBRL(Math.abs(r.saldo))}</div><div class="meta" style="font-size:11px">${encWord(r.saldo)}</div></div>
      ${Math.abs(r.saldo)>=0.005?`<button class="btn-primary btn-sm" onclick="darBaixa('${r.id}',${r.saldo})">dar baixa</button>`:''}
    </div>`;
  const rowEx = e=>`
    <div class="match-row" style="gap:10px;background:var(--surface)">
      <span class="chip chip-pending" style="font-size:10px">POR FORA</span>
      <div class="match-desc" style="flex:1;min-width:0"><span class="teams" style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${encEsc(e.label)}</span></div>
      <div style="text-align:right"><div style="font-family:var(--font-mono);font-weight:700" class="${encTone(e.saldo)}">${fmtBRL(Math.abs(e.saldo))}</div><div class="meta" style="font-size:11px">${encWord(e.saldo)}</div></div>
      <button class="btn-ghost btn-sm" style="color:var(--red)" title="Remover" onclick="encRemoveExtra('${e.id}')">✕</button>
    </div>`;
  panel.innerHTML = `
    <div style="border:1px solid var(--line);border-radius:12px;padding:14px;background:var(--surface-2,transparent)">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px">
        <b>Selecionados (${S.rows.length})</b>
        <span style="display:flex;gap:14px;align-items:center;font-size:13px">
          <label style="display:flex;align-items:center;gap:6px;margin:0;text-transform:none;cursor:pointer"><input type="checkbox" style="width:auto;margin:0" ${d.onlySel?'checked':''} onchange="ENC_DRAFT.onlySel=this.checked;encRefresh()"> ver só estes</label>
          <a href="#" style="color:var(--text-muted)" onclick="event.preventDefault();encClear()">limpar</a>
        </span>
      </div>
      ${S.rows.length||S.extras.length ? S.rows.map(rowSel).join('')+S.extras.map(rowEx).join('') : '<div class="empty" style="padding:14px 0">Nenhum cliente selecionado. Marque na lista abaixo.</div>'}
      <div style="margin-top:12px;padding:12px;border:1px dashed var(--line);border-radius:10px">
        <div style="font-size:12px;color:var(--text-muted);text-transform:uppercase;margin-bottom:8px">Adicionar valor por fora</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <input type="text" id="enc-ex-label" placeholder="Descrição (ex: acerto em dinheiro com o João)" style="flex:2;min-width:180px" onkeydown="if(event.key==='Enter'){event.preventDefault();document.getElementById('enc-ex-val').focus();}">
          <input type="text" inputmode="decimal" id="enc-ex-val" placeholder="Valor" style="flex:1;min-width:100px" onkeydown="if(event.key==='Enter'){event.preventDefault();encAddExtra();}">
          <select id="enc-ex-dir" style="flex:1;min-width:140px"><option value="rec">Eu recebo</option><option value="pag">Eu pago</option></select>
          <button class="btn-ghost" onclick="encAddExtra()">+ Adicionar</button>
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:14px;flex-wrap:wrap;margin-top:14px;padding-top:12px;border-top:1px solid var(--line-soft)">
        <div style="display:flex;gap:22px">
          <div><div class="meta">A receber</div><div style="font-family:var(--font-mono);font-weight:700" class="profit-pos">${fmtBRL(S.devem)}</div></div>
          <div><div class="meta">A pagar</div><div style="font-family:var(--font-mono);font-weight:700" class="profit-neg">${fmtBRL(S.receber)}</div></div>
        </div>
        <div style="text-align:right"><div class="meta">Total do grupo · ${Math.abs(S.liquido)<0.005?'contas zeradas':(S.liquido>0?'você recebe':'você paga')}</div><div style="font-family:var(--font-mono);font-size:22px;font-weight:700" class="${encTone(S.liquido)}">${fmtBRL(Math.abs(S.liquido))}</div></div>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px;align-items:center">
        <input type="text" id="enc-name" value="${encEsc(d.name)}" placeholder="Nome do encontro (para salvar e gerar link)" style="flex:1;min-width:220px" oninput="ENC_DRAFT.name=this.value">
        <button class="btn-primary" onclick="saveEncontro()">${d.editId?'Salvar alterações':'Salvar e gerar link'}</button>
      </div>
    </div>`;
  // lista de clientes
  const F = encFiltered();
  const outside = encAllBalances().filter(r=>!sel.has(r.id) && (d.showZero || Math.abs(r.saldo)>=0.005));
  const outSum = outside.reduce((s,r)=>s+r.saldo,0);
  box.innerHTML = `
    <div style="border:1px solid var(--line-soft);border-radius:12px;max-height:420px;overflow:auto">
      ${F.length===0 ? '<div class="empty" style="padding:18px">Nenhum cliente com esses filtros.</div>' : F.map(r=>`
        <label style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-bottom:1px solid var(--line-soft);cursor:pointer;margin:0;text-transform:none;font-size:14px">
          <input type="checkbox" style="width:auto;margin:0" ${sel.has(r.id)?'checked':''} onchange="encToggle('${r.id}')">
          <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${encEsc(r.name)}</span>
          <span style="font-family:var(--font-mono);font-size:13px;font-weight:600" class="${encTone(r.saldo)}">${fmtBRL(Math.abs(r.saldo))}</span>
          <span class="meta" style="font-size:11px;width:62px;text-align:right">${encWord(r.saldo)}</span>
        </label>`).join('')}
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-top:10px">
      <button class="btn-ghost btn-sm" onclick="encSelectList()">Selecionar os ${F.length} da lista</button>
      <span class="meta">${outside.length} cliente(s) fora do grupo · soma <b class="${encTone(outSum)}">${fmtBRL(outSum)}</b></span>
    </div>`;
}
function encToggle(id){
  const i = ENC_DRAFT.ids.indexOf(id);
  if(i>=0) ENC_DRAFT.ids.splice(i,1); else ENC_DRAFT.ids.push(id);
  const sc = document.getElementById('enc-list')?.firstElementChild?.scrollTop||0;
  encRefresh();
  const el = document.getElementById('enc-list')?.firstElementChild; if(el) el.scrollTop = sc;
}
function encSelectList(){
  encFiltered().forEach(r=>{ if(!ENC_DRAFT.ids.includes(r.id)) ENC_DRAFT.ids.push(r.id); });
  encRefresh();
}
function encClear(){ ENC_DRAFT.ids = []; ENC_DRAFT.extras = []; ENC_DRAFT.onlySel = false; encRefresh(); }
function encAddExtra(){
  const label = (document.getElementById('enc-ex-label').value||'').trim();
  const v = encParse(document.getElementById('enc-ex-val').value);
  const dir = document.getElementById('enc-ex-dir').value;
  if(!label){ showToast('Escreva uma descrição para o valor por fora.'); document.getElementById('enc-ex-label').focus(); return; }
  if(isNaN(v) || v<=0){ showToast('Valor inválido.'); document.getElementById('enc-ex-val').focus(); return; }
  ENC_DRAFT.extras.push({id:uid(), label, amount: dir==='rec' ? v : -v});
  encRefresh();
  const f = document.getElementById('enc-ex-label'); if(f) f.focus();
}
function encRemoveExtra(id){ ENC_DRAFT.extras = ENC_DRAFT.extras.filter(e=>e.id!==id); encRefresh(); }
function encCancelEdit(){ encReset(); render(); }
function encEdit(id){
  const m = STATE.accountMeetings.find(x=>x.id===id); if(!m) return;
  encReset();
  ENC_DRAFT.editId = m.id; ENC_DRAFT.name = m.name; ENC_DRAFT.ids = m.clientIds.slice(); ENC_DRAFT.extras = (m.extras||[]).map(e=>({...e}));
  render(); window.scrollTo({top:0,behavior:'smooth'});
}
async function saveEncontro(){
  const name = (ENC_DRAFT.name||'').trim();
  if(!name){ showToast('Dê um nome ao encontro (campo ao lado do botão).'); document.getElementById('enc-name')?.focus(); return; }
  if(ENC_DRAFT.ids.length+ENC_DRAFT.extras.length<2){ showToast('Escolha pelo menos 2 itens (clientes ou valores por fora).'); return; }
  const payload = {name, client_ids: ENC_DRAFT.ids, extras: ENC_DRAFT.extras};
  if(ENC_DRAFT.editId){
    const {error} = await supabaseClient.from('account_meetings').update(payload).eq('id', ENC_DRAFT.editId);
    if(error){ showToast('Erro ao salvar (rodou o SQL novo?): '+error.message); return; }
    const m = STATE.accountMeetings.find(x=>x.id===ENC_DRAFT.editId); if(m){ m.name = name; m.clientIds = ENC_DRAFT.ids.slice(); m.extras = ENC_DRAFT.extras.map(e=>({...e})); }
    showToast('Encontro atualizado.');
  } else {
    const code = uid()+uid()+uid();
    const {data, error} = await supabaseClient.from('account_meetings').insert({...payload, code, created_by: currentUserId()}).select().single();
    if(error){ showToast('Erro ao salvar (rodou o SQL novo?): '+error.message); return; }
    STATE.accountMeetings.push({id:data.id, name:data.name, code:data.code, clientIds:data.client_ids||[], extras:Array.isArray(data.extras)?data.extras:payload.extras, createdAt:data.created_at});
    navigator.clipboard?.writeText(encLink(code));
    showToast('Encontro salvo! Link copiado.');
  }
  encReset();
  render();
}
async function encDelete(id){
  const m = STATE.accountMeetings.find(x=>x.id===id); if(!m) return;
  if(!confirm('Excluir o encontro "'+m.name+'"? O link deixa de funcionar. (Os clientes e saldos não são afetados.)')) return;
  const {error} = await supabaseClient.from('account_meetings').delete().eq('id', id);
  if(error){ showToast('Erro ao excluir: '+error.message); return; }
  STATE.accountMeetings = STATE.accountMeetings.filter(x=>x.id!==id);
  render();
}
function encCopyLink(id){
  const m = STATE.accountMeetings.find(x=>x.id===id); if(!m) return;
  navigator.clipboard?.writeText(encLink(m.code)); showToast('Link copiado!');
}
function encText(m){
  const s = encSummary(m.clientIds, m.extras);
  const L = [`*Encontro de contas — ${m.name}*`, ''];
  s.rows.forEach(r=>L.push(`• ${r.name}: ${r.saldo>=0?'deve':'a receber'} ${fmtBRL(Math.abs(r.saldo))}`));
  s.extras.forEach(r=>L.push(`• ${r.label} (por fora): ${r.saldo>=0?'deve':'a receber'} ${fmtBRL(Math.abs(r.saldo))}`));
  L.push('', `Total que devem: ${fmtBRL(s.devem)}`, `Total a receber: ${fmtBRL(s.receber)}`, `*Saldo final: ${s.liquido>=0?'a pagar':'a receber'} ${fmtBRL(Math.abs(s.liquido))}*`, '', encLink(m.code));
  return L.join('\n');
}
function encCopyText(id){
  const m = STATE.accountMeetings.find(x=>x.id===id); if(!m) return;
  navigator.clipboard?.writeText(encText(m)); showToast('Resumo copiado!');
}
