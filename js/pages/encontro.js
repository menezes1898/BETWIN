// ==================== ENCONTRO DE CONTAS (aba do Financeiro) ====================
// Reúne alguns clientes num link só: quem deve, quem tem a receber e o saldo final do grupo.
// Positivo (perspectiva da consultoria) = cliente deve; negativo = cliente tem a receber.
let ENC_DRAFT = {editId:null, name:'', ids:[]};
function encEsc(s){ return String(s==null?'':s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function encLink(code){ return window.location.href.split('#')[0]+'#encontro='+code; }

function encSummary(ids){
  const rows = ids.map(id=>{
    const cl = STATE.clients.find(c=>c.id===id);
    if(!cl) return null;
    const saldo = computeContinuousBalance(id, null);
    const pend = STATE.tickets.filter(t=>t.clientId===id && ticketResult(t)==='pending');
    return {id, name:cl.name, saldo, pendCount:pend.length, pendValor:pend.reduce((s,t)=>s+t.stake,0)};
  }).filter(Boolean).sort((a,b)=>Math.abs(b.saldo)-Math.abs(a.saldo));
  const devem = rows.filter(r=>r.saldo>=0.005).reduce((s,r)=>s+r.saldo,0);
  const receber = rows.filter(r=>r.saldo<=-0.005).reduce((s,r)=>s-r.saldo,0);
  return {rows, devem, receber, liquido: devem-receber};
}

function renderEncontroTab(){
  const d = ENC_DRAFT;
  const sel = new Set(d.ids);
  const clientsSorted = STATE.clients.slice().sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
  const selSum = encSummary(d.ids);
  const list = (STATE.accountMeetings||[]);
  if(STATE.accountMeetingsOk===false){
    return `<div class="card"><h3>Encontro de contas</h3><div class="empty">A tabela de encontros ainda não existe no banco. Rode o SQL que enviei no chat (Supabase → SQL Editor) e recarregue.</div></div>`;
  }
  return `
    <div class="card">
      <h3>${d.editId?'Editar encontro de contas':'Novo encontro de contas'}</h3>
      <label>Nome do encontro</label>
      <input type="text" id="enc-name" value="${encEsc(d.name)}" placeholder="Ex: Grupo do João — semana 12/10" oninput="ENC_DRAFT.name=this.value">
      <label style="margin-top:12px">Clientes do encontro <span style="color:var(--text-muted);font-weight:400">(${d.ids.length} selecionado${d.ids.length===1?'':'s'})</span></label>
      <input type="text" id="enc-search" placeholder="Buscar cliente…" oninput="encFilterClients()" autocomplete="off">
      <div id="enc-clients" style="max-height:300px;overflow:auto;margin-top:8px;border:1px solid var(--line-soft);border-radius:10px">
        ${clientsSorted.map(c=>{
          const s = computeContinuousBalance(c.id,null);
          return `<label class="enc-row" data-name="${encEsc(evtNorm(c.name))}" style="display:flex;align-items:center;gap:10px;padding:9px 12px;border-bottom:1px solid var(--line-soft);cursor:pointer;margin:0;text-transform:none;font-size:14px">
            <input type="checkbox" style="width:auto;margin:0" ${sel.has(c.id)?'checked':''} onchange="encToggleClient('${c.id}')">
            <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${encEsc(c.name)}</span>
            <span style="font-family:var(--font-mono);font-size:12px" class="${Math.abs(s)<0.005?'':(s>0?'profit-pos':'profit-neg')}">${Math.abs(s)<0.005?'—':(s>0?'deve ':'receber ')+fmtBRL(Math.abs(s))}</span>
          </label>`;}).join('')}
      </div>
      ${d.ids.length ? `<div style="margin-top:12px;font-size:13px;color:var(--text-muted)">Prévia: devem <b class="profit-pos">${fmtBRL(selSum.devem)}</b> · a receber <b class="profit-neg">${fmtBRL(selSum.receber)}</b> · saldo <b>${selSum.liquido>=0?'a pagar ':'a receber '}${fmtBRL(Math.abs(selSum.liquido))}</b></div>` : ''}
      <div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap">
        <button class="btn-primary" onclick="saveEncontro()">${d.editId?'Salvar alterações':'Criar encontro e gerar link'}</button>
        ${d.editId?'<button class="btn-ghost" onclick="encCancelEdit()">Cancelar edição</button>':''}
      </div>
    </div>
    <div class="card">
      <h3>Encontros criados</h3>
      ${list.length===0 ? '<div class="empty">Nenhum encontro criado ainda.</div>' : list.slice().sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||'')).map(m=>{
        const s = encSummary(m.clientIds);
        return `
        <div class="match-row" style="flex-direction:column;align-items:stretch;gap:8px">
          <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center">
            <div><span class="teams">${encEsc(m.name)}</span><span class="meta" style="display:block">${s.rows.length} cliente${s.rows.length===1?'':'s'} · devem ${fmtBRL(s.devem)} · a receber ${fmtBRL(s.receber)}</span></div>
            <div style="font-family:var(--font-mono);font-size:15px;font-weight:700" class="${s.liquido>=0?'profit-pos':'profit-neg'}">${s.liquido>=0?'A pagar ':'A receber '}${fmtBRL(Math.abs(s.liquido))}</div>
          </div>
          <div class="meta" style="font-size:12px">${s.rows.map(r=>encEsc(r.name)+' ('+(r.saldo>=0?'deve ':'receber ')+fmtBRL(Math.abs(r.saldo))+')').join(' · ')}</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <code style="flex:1;min-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;padding:6px 8px">${encLink(m.code)}</code>
            <button class="btn-ghost btn-sm" onclick="encCopyLink('${m.id}')">Copiar link</button>
            <button class="btn-ghost btn-sm" onclick="encCopyText('${m.id}')">Copiar resumo</button>
            <button class="btn-ghost btn-sm" onclick="window.open(encLink('${m.code}'),'_blank')">Abrir</button>
            <button class="btn-ghost btn-sm" onclick="encEdit('${m.id}')">Editar</button>
            <button class="btn-ghost btn-sm" style="color:var(--red)" onclick="encDelete('${m.id}')">Excluir</button>
          </div>
        </div>`;}).join('')}
    </div>`;
}
function encFilterClients(){
  const q = evtNorm(document.getElementById('enc-search').value);
  document.querySelectorAll('#enc-clients .enc-row').forEach(r=>{ r.style.display = (!q || r.dataset.name.includes(q)) ? 'flex' : 'none'; });
}
function encToggleClient(id){
  const i = ENC_DRAFT.ids.indexOf(id);
  if(i>=0) ENC_DRAFT.ids.splice(i,1); else ENC_DRAFT.ids.push(id);
  const q = document.getElementById('enc-search')?.value||'', scroll = document.getElementById('enc-clients')?.scrollTop||0;
  render();
  const s = document.getElementById('enc-search'); if(s){ s.value = q; encFilterClients(); }
  const box = document.getElementById('enc-clients'); if(box) box.scrollTop = scroll;
}
function encCancelEdit(){ ENC_DRAFT = {editId:null, name:'', ids:[]}; render(); }
function encEdit(id){
  const m = STATE.accountMeetings.find(x=>x.id===id); if(!m) return;
  ENC_DRAFT = {editId:m.id, name:m.name, ids:m.clientIds.slice()};
  render(); window.scrollTo({top:0,behavior:'smooth'});
}
async function saveEncontro(){
  const name = (ENC_DRAFT.name||'').trim();
  if(!name){ showToast('Dê um nome ao encontro.'); return; }
  if(ENC_DRAFT.ids.length<2){ showToast('Escolha pelo menos 2 clientes.'); return; }
  if(ENC_DRAFT.editId){
    const {error} = await supabaseClient.from('account_meetings').update({name, client_ids: ENC_DRAFT.ids}).eq('id', ENC_DRAFT.editId);
    if(error){ showToast('Erro ao salvar: '+error.message); return; }
    const m = STATE.accountMeetings.find(x=>x.id===ENC_DRAFT.editId); if(m){ m.name = name; m.clientIds = ENC_DRAFT.ids.slice(); }
    showToast('Encontro atualizado.');
  } else {
    const code = uid()+uid()+uid();
    const {data, error} = await supabaseClient.from('account_meetings').insert({name, code, client_ids: ENC_DRAFT.ids, created_by: currentUserId()}).select().single();
    if(error){ showToast('Erro ao criar (rodou o SQL?): '+error.message); return; }
    STATE.accountMeetings.push({id:data.id, name:data.name, code:data.code, clientIds:data.client_ids||[], createdAt:data.created_at});
    navigator.clipboard?.writeText(encLink(code));
    showToast('Encontro criado! Link copiado.');
  }
  ENC_DRAFT = {editId:null, name:'', ids:[]};
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
  const s = encSummary(m.clientIds);
  const L = [`*Encontro de contas — ${m.name}*`, ''];
  s.rows.forEach(r=>L.push(`• ${r.name}: ${r.saldo>=0?'deve':'a receber'} ${fmtBRL(Math.abs(r.saldo))}`));
  L.push('', `Total que devem: ${fmtBRL(s.devem)}`, `Total a receber: ${fmtBRL(s.receber)}`, `*Saldo final: ${s.liquido>=0?'a pagar':'a receber'} ${fmtBRL(Math.abs(s.liquido))}*`, '', encLink(m.code));
  return L.join('\n');
}
function encCopyText(id){
  const m = STATE.accountMeetings.find(x=>x.id===id); if(!m) return;
  navigator.clipboard?.writeText(encText(m)); showToast('Resumo copiado!');
}
