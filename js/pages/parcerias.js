// ---------- PARCERIAS ----------
// Parceiro que divide o resultado de um cliente com você: quando o cliente PERDE, ele recebe uma %
// do que sobrou pra você (já com o desconto do cliente); quando o cliente GANHA, ele paga a mesma %
// do ganho. (Comissionado, na aba Comissionados, só recebe % da perda e nunca participa do ganho.)

function renderParceriasTab(){
  if(PARTNER_DETAIL_ID) return renderPartnerDetail(PARTNER_DETAIL_ID);
  return `
    <div class="card">
      <h3>Nova parceria</h3>
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px">O parceiro divide o resultado do cliente com você: leva uma % quando o cliente perde (já com o desconto) e paga a mesma % quando o cliente ganha.</div>
      <label>Nome do parceiro</label>
      <input type="text" id="new-partner-name" placeholder="Ex: João Silva">
      <label>Telefone (opcional)</label>
      <input type="text" id="new-partner-phone" placeholder="Ex: (11) 91234-5678">
      <div style="margin-top:14px"><button class="btn-primary" onclick="addPartner()">Cadastrar</button></div>
    </div>
    <div class="card">
      <label>Buscar parceiro</label>
      <input type="text" id="partner-search-input" placeholder="Digite o nome…" oninput="updatePartnerSearch()">
    </div>
    <div id="partner-list-container">${renderPartnerListItems(STATE.partners)}</div>
  `;
}
function renderPartnerListItems(list){
  if(list.length===0) return '<div class="card"><div class="empty">Nenhuma parceria cadastrada ainda.</div></div>';
  return list.map(p=>{
    const linkedCount = new Set(STATE.partnerClients.filter(pc=>pc.partnerId===p.id).map(pc=>pc.clientId)).size;
    return `
    <div class="card" style="cursor:pointer" onclick="openPartnerDetail('${p.id}')">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-weight:600;font-size:15px">${p.name}</div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:2px">${linkedCount} cliente(s) vinculado(s)${p.phone?' · '+p.phone:''}</div>
        </div>
        <span style="color:var(--text-muted);font-size:18px">›</span>
      </div>
    </div>
  `;}).join('');
}
function updatePartnerSearch(){
  const val = document.getElementById('partner-search-input').value.trim().toLowerCase();
  const filtered = val ? STATE.partners.filter(p=>p.name.toLowerCase().includes(val)) : STATE.partners;
  document.getElementById('partner-list-container').innerHTML = renderPartnerListItems(filtered);
}
function copyPartnerLink(id){
  const text = document.getElementById(`partner-link-${id}`).textContent;
  navigator.clipboard?.writeText(text);
  showToast('Link copiado!');
}
async function generatePartnerCode(id){
  const code = uid()+uid();
  const {error} = await supabaseClient.from('partners').update({code}).eq('id', id);
  if(error){ showToast('Erro ao gerar link (rodou o SQL da coluna code?): '+error.message); return; }
  const p = STATE.partners.find(x=>x.id===id);
  if(p) p.code = code;
  render();
}
function openPartnerDetail(id){
  PARTNER_DETAIL_ID = id;
  CONFIRM_DELETE_PARTNER = false;
  render();
}
// Texto + cor pro valor da parte do parceiro numa semana.
function partnerShareLabel(share){
  if(Math.abs(share)<0.005) return '<span style="color:var(--text-muted)">—</span>';
  return share>0
    ? `<span class="profit-neg">você paga ${fmtBRL(share)}</span>`
    : `<span class="profit-pos">ele paga ${fmtBRL(Math.abs(share))}</span>`;
}
function renderPartnerDetail(id){
  const p = STATE.partners.find(x=>x.id===id);
  if(!p){ PARTNER_DETAIL_ID=null; return renderParceriasTab(); }
  const links = STATE.partnerClients.filter(pc=>pc.partnerId===id);
  const weekMonday = FINANCE_WEEK || mondayOf(todaySP());
  const activeLinkIdByClient = {};
  const uniqueClientIds = new Set(links.map(l=>l.clientId));
  uniqueClientIds.forEach(clientId=>{
    const active = getActivePartnersForWeek(clientId, weekMonday).find(a=>a.partnerId===id);
    if(active){
      const match = links.find(l=>l.clientId===clientId && l.percent===active.percent && (!l.effectiveFromWeek || l.effectiveFromWeek<=weekMonday));
      if(match) activeLinkIdByClient[clientId] = match.id;
    }
  });
  const totalWeek = Array.from(uniqueClientIds).reduce((s,clientId)=>{
    const active = getActivePartnersForWeek(clientId, weekMonday).find(a=>a.partnerId===id);
    return active ? s + computePartnerShare(clientId, active.percent, weekMonday) : s;
  }, 0);
  const acertada = getParceriaAcertadaSemana(id, weekMonday);
  const jaAcertado = Math.abs(totalWeek)>=0.01 && Math.abs(acertada - totalWeek) < 0.01;
  const safeName = p.name.replace(/'/g,"\\'");
  return `
    <button class="btn-ghost btn-sm" onclick="PARTNER_DETAIL_ID=null;render()">‹ Voltar</button>
    <div style="height:12px"></div>
    <div class="card">
      <h3>Editar parceiro</h3>
      <label>Nome</label>
      <input type="text" id="detail-partner-name" value="${p.name}">
      <label>Telefone (opcional)</label>
      <input type="text" id="detail-partner-phone" value="${p.phone||''}">
      <label>Link de acompanhamento do parceiro</label>
      ${p.code ? `
      <div class="link-box">
        <code id="partner-link-${p.id}">${window.location.href.split('#')[0]}#parceiro=${p.code}</code>
        <button class="btn-ghost btn-sm" onclick="copyPartnerLink('${p.id}')">Copiar link</button>
      </div>` : `
      <div><button class="btn-ghost btn-sm" onclick="generatePartnerCode('${p.id}')">Gerar link do parceiro</button></div>`}
      <div style="margin-top:14px"><button class="btn-primary btn-full" onclick="savePartnerDetail('${p.id}')">Salvar alterações</button></div>
    </div>
    <div class="card">
      <h3>Clientes em parceria</h3>
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:6px">
        <div style="display:flex;align-items:center;gap:12px">
          <button class="btn-ghost btn-sm" onclick="changeFinanceWeek(-1)">‹</button>
          <span style="font-family:var(--font-mono);font-size:13px;font-weight:600">${weekLabel(weekMonday)}</span>
          <button class="btn-ghost btn-sm" onclick="changeFinanceWeek(1)">›</button>
        </div>
        <div style="font-size:13px">Total da semana: <strong>${partnerShareLabel(totalWeek)}</strong></div>
      </div>
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:12px">Só entram apostas já resolvidas. A % é aplicada sobre o resultado do cliente depois do desconto.</div>
      ${Math.abs(totalWeek)>=0.01 ? `
        <div style="margin-bottom:12px">
          ${jaAcertado
            ? '<span class="chip chip-green">ACERTO JÁ REGISTRADO ESSA SEMANA</span>'
            : (totalWeek>0
                ? `<button class="btn-primary btn-sm" onclick="registrarAcertoParceria('${p.id}','${safeName}',${totalWeek},'${weekMonday}')">Registrar pagamento ao parceiro</button>`
                : `<button class="btn-primary btn-sm" onclick="registrarAcertoParceria('${p.id}','${safeName}',${totalWeek},'${weekMonday}')">Registrar recebimento do parceiro</button>`)}
        </div>
      ` : ''}
      ${links.length===0 ? '<div class="empty">Nenhum cliente vinculado ainda.</div>' : links.map(l=>{
        const cl = STATE.clients.find(c=>c.id===l.clientId);
        const isActive = activeLinkIdByClient[l.clientId] === l.id;
        const bd = isActive ? computePartnerBreakdown(l.clientId, l.percent, weekMonday) : null;
        const share = bd ? bd.liquido : 0;
        return `
        <div class="match-row" style="${isActive?'':'opacity:0.55'}">
          <div class="match-desc">
            <span class="teams">${cl?cl.name:'Cliente removido'}${isActive?'':' <span style="font-size:10px;color:var(--text-muted)">(histórico)</span>'}</span>
            <span class="meta">${l.percent}% do resultado${l.effectiveFromWeek?' · a partir de '+weekLabel(l.effectiveFromWeek):''}${isActive?(Math.abs(bd.bruto)>=0.005?' · bruto '+fmtBRL(bd.bruto)+(bd.desconto>=0.005?' − desconto '+fmtBRL(bd.desconto):''):''):' · substituído por um % mais novo'}</span>
          </div>
          <div class="match-actions">
            ${isActive ? `<span style="font-size:12px">${partnerShareLabel(share)}</span>` : ''}
            <button class="btn-ghost btn-sm" onclick="editPartnerLinkPercent('${l.id}')">Editar %</button>
            <button class="btn-danger-ghost btn-sm" onclick="removePartnerLink('${l.id}')">Remover</button>
          </div>
        </div>
        `;
      }).join('')}
    </div>
    <div class="card">
      <h3>Vincular novo cliente</h3>
      <label>Cliente</label>
      <div class="autocomplete-wrap">
        <input type="text" id="new-partner-client-search" placeholder="Buscar cliente…" autocomplete="off"
          oninput="filterPartnerClientOptions()" onfocus="filterPartnerClientOptions()" onkeydown="handleAutocompleteKeydown(event,'partner-client-options')"
          onblur="setTimeout(()=>{const b=document.getElementById('partner-client-options'); if(b) b.style.display='none';},150)">
        <input type="hidden" id="new-partner-client-id" value="">
        <div id="partner-client-options" class="autocomplete-list"></div>
      </div>
      <label>Porcentagem do parceiro no resultado do cliente (%)</label>
      <input type="number" id="new-partner-percent" min="0" max="100" step="0.1" placeholder="Ex: 30">
      <div style="margin-top:14px"><button class="btn-primary" onclick="addPartnerLink('${p.id}')">Vincular cliente</button></div>
    </div>
    ${CONFIRM_DELETE_PARTNER ? `
      <div class="card" style="border-color:var(--red)">
        <p style="margin:0 0 12px;font-size:14px">Tem certeza que quer excluir <strong>${p.name}</strong>? Isso remove todos os vínculos com clientes também.</p>
        <div class="row">
          <div><button class="btn-ghost btn-full" onclick="CONFIRM_DELETE_PARTNER=false;render()">Cancelar</button></div>
          <div><button class="btn-danger-ghost btn-full" onclick="deletePartner('${p.id}')">Sim, excluir definitivamente</button></div>
        </div>
      </div>
    ` : `
      <div class="card">
        <button class="btn-danger-ghost btn-full" onclick="CONFIRM_DELETE_PARTNER=true;render()">Excluir parceiro</button>
      </div>
    `}
  `;
}
async function addPartner(){
  const name = document.getElementById('new-partner-name').value.trim();
  const phone = document.getElementById('new-partner-phone').value.trim();
  if(!name) return;
  const code = uid()+uid();
  const {data, error} = await supabaseClient.from('partners').insert({name, phone, code}).select().single();
  if(error){ showToast('Erro ao salvar parceiro: '+error.message); return; }
  STATE.partners.push({id:data.id, name:data.name, phone:data.phone||'', code:data.code||''});
  render();
}
async function savePartnerDetail(id){
  const name = document.getElementById('detail-partner-name').value.trim();
  const phone = document.getElementById('detail-partner-phone').value.trim();
  if(!name){ showToast('Informe o nome.'); return; }
  const {error} = await supabaseClient.from('partners').update({name, phone}).eq('id', id);
  if(error){ showToast('Erro ao salvar: '+error.message); return; }
  const p = STATE.partners.find(x=>x.id===id);
  if(p){ p.name=name; p.phone=phone; }
  render();
}
async function deletePartner(id){
  const {error} = await supabaseClient.from('partners').delete().eq('id', id);
  if(error){ showToast('Erro ao excluir: '+error.message); return; }
  STATE.partners = STATE.partners.filter(x=>x.id!==id);
  STATE.partnerClients = STATE.partnerClients.filter(pc=>pc.partnerId!==id);
  PARTNER_DETAIL_ID = null;
  CONFIRM_DELETE_PARTNER = false;
  render();
}
function filterPartnerClientOptions(){
  const input = document.getElementById('new-partner-client-search');
  const box = document.getElementById('partner-client-options');
  const val = input.value.trim().toLowerCase();
  document.getElementById('new-partner-client-id').value = '';
  if(val.length < 2){ box.style.display='none'; box.innerHTML=''; return; }
  const matches = STATE.clients.filter(c=>c.name.toLowerCase().includes(val));
  if(matches.length===0){
    box.innerHTML = '<div class="autocomplete-item" style="cursor:default;color:var(--text-muted)">Nenhum cliente encontrado</div>';
  } else {
    box.innerHTML = matches.map(c=>`<div class="autocomplete-item" onmousedown="selectPartnerClientOption('${c.id}')">${c.name}</div>`).join('');
  }
  box.style.display='block';
}
function selectPartnerClientOption(id){
  const cl = STATE.clients.find(c=>c.id===id);
  if(!cl) return;
  document.getElementById('new-partner-client-id').value = id;
  document.getElementById('new-partner-client-search').value = cl.name;
  const box = document.getElementById('partner-client-options');
  box.style.display='none'; box.innerHTML='';
}
function pushPartnerLinkToState(data){
  STATE.partnerClients.push({id:data.id, partnerId:data.partner_id, clientId:data.client_id, percent:parseFloat(data.percent)||0, effectiveFromWeek:data.effective_from_week||null});
}
async function addPartnerLink(partnerId){
  const clientId = document.getElementById('new-partner-client-id').value;
  const percent = parseFloat(document.getElementById('new-partner-percent').value);
  if(!clientId){ showToast('Busque e selecione um cliente na lista.'); return; }
  if(isNaN(percent) || percent<0 || percent>100){ showToast('Informe a porcentagem (0 a 100).'); return; }
  const effectiveFromWeek = mondayOf(todaySP());
  const {data, error} = await supabaseClient.from('partner_clients').insert({partner_id: partnerId, client_id: clientId, percent, effective_from_week: effectiveFromWeek}).select().single();
  if(error){ showToast('Erro ao vincular cliente: '+error.message); return; }
  pushPartnerLinkToState(data);
  render();
}
async function editPartnerLinkPercent(linkId){
  const link = STATE.partnerClients.find(l=>l.id===linkId);
  if(!link) return;
  const input = prompt('Nova porcentagem (%) a partir de agora (semanas passadas mantêm a % antiga):', link.percent);
  if(input===null) return;
  const percent = parseFloat(String(input).replace(',','.'));
  if(isNaN(percent) || percent<0 || percent>100){ showToast('Valor inválido.'); return; }
  const effectiveFromWeek = mondayOf(todaySP());
  const {data, error} = await supabaseClient.from('partner_clients').insert({partner_id: link.partnerId, client_id: link.clientId, percent, effective_from_week: effectiveFromWeek}).select().single();
  if(error){ showToast('Erro ao atualizar: '+error.message); return; }
  pushPartnerLinkToState(data);
  render();
}
async function removePartnerLink(linkId){
  if(!confirm('Remover esse vínculo?')) return;
  const {error} = await supabaseClient.from('partner_clients').delete().eq('id', linkId);
  if(error){ showToast('Erro ao remover: '+error.message); return; }
  STATE.partnerClients = STATE.partnerClients.filter(l=>l.id!==linkId);
  render();
}
// Acerto da semana com o parceiro: se o total for positivo você paga (entra como despesa no caixa);
// se for negativo ele paga pra você (entra como receita). Mesmo mecanismo das comissões.
async function registrarAcertoParceria(partnerId, name, total, weekMonday){
  if(Math.abs(total)<0.01){ showToast('Não há nada a acertar essa semana com esse parceiro.'); return; }
  const voceDevePagar = total>0;
  const amount = Math.abs(total);
  const msg = voceDevePagar
    ? `Registrar pagamento de ${fmtBRL(amount)} pra ${name}? Isso entra como uma despesa no seu caixa.`
    : `Registrar recebimento de ${fmtBRL(amount)} de ${name}? Isso entra como uma receita no seu caixa.`;
  if(!confirm(msg)) return;
  const description = `Parceria — ${name} (semana ${weekLabel(weekMonday)})`;
  const {data, error} = await supabaseClient.from('transactions').insert({
    type: voceDevePagar ? 'despesa' : 'receita', category:'Parceria', description, amount, date: todaySP(), partner_id: partnerId, week_start: weekMonday, created_by: currentUserId()
  }).select().single();
  if(error){ showToast('Erro ao registrar: '+error.message); return; }
  STATE.transactions.push({id:data.id, type:data.type, category:data.category||'', description:data.description||'', amount:parseFloat(data.amount), date:data.date, createdAt:data.created_at, clientId:data.client_id||null, excluded:false, createdBy:data.created_by||null, commissionerId:data.commissioner_id||null, partnerId:data.partner_id||null, weekStart:data.week_start||null});
  await pruneTransactions();
  showToast('Acerto registrado!');
  render();
}
