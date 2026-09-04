function renderParceirosTab(){
  if(COMMISSIONER_DETAIL_ID) return renderCommissionerDetail(COMMISSIONER_DETAIL_ID);
  return `
    <div class="card">
      <h3>Novo comissionado</h3>
      <label>Nome</label>
      <input type="text" id="new-commissioner-name" placeholder="Ex: João Parceiro">
      <label>Telefone (opcional)</label>
      <input type="text" id="new-commissioner-phone" placeholder="Ex: (11) 91234-5678">
      <div style="margin-top:14px"><button class="btn-primary" onclick="addCommissioner()">Cadastrar</button></div>
    </div>
    <div class="card">
      <label>Buscar comissionado</label>
      <input type="text" id="commissioner-search-input" placeholder="Digite o nome…" oninput="updateCommissionerSearch()">
    </div>
    <div id="commissioner-list-container">${renderCommissionerListItems(STATE.commissioners)}</div>
  `;
}
function renderCommissionerListItems(list){
  if(list.length===0) return '<div class="card"><div class="empty">Nenhum comissionado cadastrado ainda.</div></div>';
  return list.map(cm=>{
    const linkedCount = new Set(STATE.commissionerClients.filter(cc=>cc.commissionerId===cm.id).map(cc=>cc.clientId)).size;
    return `
    <div class="card" style="cursor:pointer" onclick="openCommissionerDetail('${cm.id}')">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-weight:600;font-size:15px">${cm.name}</div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:2px">${linkedCount} cliente(s) vinculado(s)${cm.phone?' · '+cm.phone:''}</div>
        </div>
        <span style="color:var(--text-muted);font-size:18px">›</span>
      </div>
    </div>
  `;}).join('');
}
function updateCommissionerSearch(){
  const val = document.getElementById('commissioner-search-input').value.trim().toLowerCase();
  const filtered = val ? STATE.commissioners.filter(c=>c.name.toLowerCase().includes(val)) : STATE.commissioners;
  document.getElementById('commissioner-list-container').innerHTML = renderCommissionerListItems(filtered);
}
function openCommissionerDetail(id){
  COMMISSIONER_DETAIL_ID = id;
  CONFIRM_DELETE_COMMISSIONER = false;
  render();
}
function renderCommissionerDetail(id){
  const cm = STATE.commissioners.find(c=>c.id===id);
  if(!cm){ COMMISSIONER_DETAIL_ID=null; return renderParceirosTab(); }
  const links = STATE.commissionerClients.filter(cc=>cc.commissionerId===id);
  const weekMonday = FINANCE_WEEK || mondayOf(todaySP());
  // Pra cada cliente vinculado, descobre qual link está REALMENTE em vigor nessa semana
  // (respeitando linha do tempo e sobrescritas manuais), evitando somar % antigas já substituídas.
  const activeLinkIdByClient = {};
  const uniqueClientIds = new Set(links.map(l=>l.clientId));
  uniqueClientIds.forEach(clientId=>{
    const active = getActiveCommissionersForWeek(clientId, weekMonday).find(a=>a.commissionerId===id);
    if(active){
      const match = links.find(l=>l.clientId===clientId && l.percent===active.percent && (!l.effectiveFromWeek || l.effectiveFromWeek<=weekMonday));
      if(match) activeLinkIdByClient[clientId] = match.id;
    }
  });
  const totalWeek = Array.from(uniqueClientIds).reduce((s,clientId)=>{
    const active = getActiveCommissionersForWeek(clientId, weekMonday).find(a=>a.commissionerId===id);
    return active ? s + computeCommissionAmount(clientId, active.percent, weekMonday) : s;
  }, 0);
  return `
    <button class="btn-ghost btn-sm" onclick="COMMISSIONER_DETAIL_ID=null;render()">‹ Voltar</button>
    <div style="height:12px"></div>
    <div class="card">
      <h3>Editar comissionado</h3>
      <label>Nome</label>
      <input type="text" id="detail-commissioner-name" value="${cm.name}">
      <label>Telefone (opcional)</label>
      <input type="text" id="detail-commissioner-phone" value="${cm.phone||''}">
      <label>Link de acompanhamento do comissionado</label>
      <div class="link-box">
        <code id="commissioner-link-${cm.id}">${window.location.href.split('#')[0]}#comissionado=${cm.code}</code>
        <button class="btn-ghost btn-sm" onclick="copyCommissionerLink('${cm.id}')">Copiar link</button>
      </div>
      <div style="margin-top:14px"><button class="btn-primary btn-full" onclick="saveCommissionerDetail('${cm.id}')">Salvar alterações</button></div>
    </div>
    <div class="card">
      <h3>Clientes vinculados</h3>
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:10px">Comissão calculada em cima da semana de ${weekLabel(weekMonday)} · total dessa semana: <strong style="color:var(--gold)">${fmtBRL(totalWeek)}</strong></div>
      ${links.length===0 ? '<div class="empty">Nenhum cliente vinculado ainda.</div>' : links.map(l=>{
        const cl = STATE.clients.find(c=>c.id===l.clientId);
        const isActive = activeLinkIdByClient[l.clientId] === l.id;
        const amount = isActive ? computeCommissionAmount(l.clientId, l.percent, weekMonday) : 0;
        return `
        <div class="match-row" style="${isActive?'':'opacity:0.55'}">
          <div class="match-desc">
            <span class="teams">${cl?cl.name:'Cliente removido'}${isActive?'':' <span style="font-size:10px;color:var(--text-muted)">(histórico)</span>'}</span>
            <span class="meta">${l.percent}% sobre a perda bruta${l.effectiveFromWeek?' · a partir de '+weekLabel(l.effectiveFromWeek):''}${isActive?' · essa semana: '+fmtBRL(amount):' · substituído por um % mais novo'}</span>
          </div>
          <div class="match-actions">
            <button class="btn-ghost btn-sm" onclick="editCommissionLinkPercent('${l.id}')">Editar %</button>
            <button class="btn-danger-ghost btn-sm" onclick="removeCommissionLink('${l.id}')">Remover</button>
          </div>
        </div>
        `;
      }).join('')}
    </div>
    <div class="card">
      <h3>Vincular novo cliente</h3>
      <label>Cliente</label>
      <div class="autocomplete-wrap">
        <input type="text" id="new-link-client-search" placeholder="Buscar cliente…" autocomplete="off"
          oninput="filterLinkClientOptions()" onfocus="filterLinkClientOptions()" onkeydown="handleAutocompleteKeydown(event,'link-client-options')"
          onblur="setTimeout(()=>{const b=document.getElementById('link-client-options'); if(b) b.style.display='none';},150)">
        <input type="hidden" id="new-link-client-id" value="">
        <div id="link-client-options" class="autocomplete-list"></div>
      </div>
      <label>Porcentagem sobre a perda bruta do cliente (%)</label>
      <input type="number" id="new-link-percent" min="0" max="100" step="0.1" placeholder="Ex: 5">
      <div style="margin-top:14px"><button class="btn-primary" onclick="addCommissionLink('${cm.id}')">Vincular cliente</button></div>
    </div>
    ${CONFIRM_DELETE_COMMISSIONER ? `
      <div class="card" style="border-color:var(--red)">
        <p style="margin:0 0 12px;font-size:14px">Tem certeza que quer excluir <strong>${cm.name}</strong>? Isso remove todos os vínculos com clientes também.</p>
        <div class="row">
          <div><button class="btn-ghost btn-full" onclick="CONFIRM_DELETE_COMMISSIONER=false;render()">Cancelar</button></div>
          <div><button class="btn-danger-ghost btn-full" onclick="deleteCommissioner('${cm.id}')">Sim, excluir definitivamente</button></div>
        </div>
      </div>
    ` : `
      <div class="card">
        <button class="btn-danger-ghost btn-full" onclick="CONFIRM_DELETE_COMMISSIONER=true;render()">Excluir comissionado</button>
      </div>
    `}
  `;
}
async function addCommissioner(){
  const name = document.getElementById('new-commissioner-name').value.trim();
  const phone = document.getElementById('new-commissioner-phone').value.trim();
  if(!name) return;
  const code = uid()+uid();
  const {data, error} = await supabaseClient.from('commissioners').insert({name, phone, code}).select().single();
  if(error){ showToast('Erro ao salvar comissionado: '+error.message); return; }
  STATE.commissioners.push({id:data.id, name:data.name, phone:data.phone||'', code:data.code||''});
  render();
}
async function saveCommissionerDetail(id){
  const name = document.getElementById('detail-commissioner-name').value.trim();
  const phone = document.getElementById('detail-commissioner-phone').value.trim();
  if(!name){ showToast('Informe o nome.'); return; }
  const {error} = await supabaseClient.from('commissioners').update({name, phone}).eq('id', id);
  if(error){ showToast('Erro ao salvar: '+error.message); return; }
  const cm = STATE.commissioners.find(c=>c.id===id);
  if(cm){ cm.name=name; cm.phone=phone; }
  render();
}
async function deleteCommissioner(id){
  const {error} = await supabaseClient.from('commissioners').delete().eq('id', id);
  if(error){ showToast('Erro ao excluir: '+error.message); return; }
  STATE.commissioners = STATE.commissioners.filter(c=>c.id!==id);
  STATE.commissionerClients = STATE.commissionerClients.filter(cc=>cc.commissionerId!==id);
  COMMISSIONER_DETAIL_ID = null;
  CONFIRM_DELETE_COMMISSIONER = false;
  render();
}
function filterLinkClientOptions(){
  const input = document.getElementById('new-link-client-search');
  const box = document.getElementById('link-client-options');
  const val = input.value.trim().toLowerCase();
  document.getElementById('new-link-client-id').value = '';
  if(val.length < 2){ box.style.display='none'; box.innerHTML=''; return; }
  const matches = STATE.clients.filter(c=>c.name.toLowerCase().includes(val));
  if(matches.length===0){
    box.innerHTML = '<div class="autocomplete-item" style="cursor:default;color:var(--text-muted)">Nenhum cliente encontrado</div>';
  } else {
    box.innerHTML = matches.map(c=>`<div class="autocomplete-item" onmousedown="selectLinkClientOption('${c.id}')">${c.name}</div>`).join('');
  }
  box.style.display='block';
}
function selectLinkClientOption(id){
  const cl = STATE.clients.find(c=>c.id===id);
  if(!cl) return;
  document.getElementById('new-link-client-id').value = id;
  document.getElementById('new-link-client-search').value = cl.name;
  const box = document.getElementById('link-client-options');
  box.style.display='none'; box.innerHTML='';
}
async function addCommissionLink(commissionerId){
  const clientId = document.getElementById('new-link-client-id').value;
  const percent = parseFloat(document.getElementById('new-link-percent').value);
  if(!clientId){ showToast('Busque e selecione um cliente na lista.'); return; }
  if(isNaN(percent) || percent<0){ showToast('Informe a porcentagem.'); return; }
  const effectiveFromWeek = mondayOf(todaySP());
  const {data, error} = await supabaseClient.from('commissioner_clients').insert({commissioner_id: commissionerId, client_id: clientId, percent, effective_from_week: effectiveFromWeek}).select().single();
  if(error){ showToast('Erro ao vincular cliente: '+error.message); return; }
  STATE.commissionerClients.push({id:data.id, commissionerId:data.commissioner_id, clientId:data.client_id, percent:parseFloat(data.percent)||0, effectiveFromWeek:data.effective_from_week||null});
  render();
}
async function editCommissionLinkPercent(linkId){
  const link = STATE.commissionerClients.find(l=>l.id===linkId);
  if(!link) return;
  const input = prompt('Nova porcentagem (%) a partir de agora (semanas passadas mantêm a % antiga):', link.percent);
  if(input===null) return;
  const percent = parseFloat(String(input).replace(',','.'));
  if(isNaN(percent) || percent<0){ showToast('Valor inválido.'); return; }
  const effectiveFromWeek = mondayOf(todaySP());
  const {data, error} = await supabaseClient.from('commissioner_clients').insert({commissioner_id: link.commissionerId, client_id: link.clientId, percent, effective_from_week: effectiveFromWeek}).select().single();
  if(error){ showToast('Erro ao atualizar: '+error.message); return; }
  STATE.commissionerClients.push({id:data.id, commissionerId:data.commissioner_id, clientId:data.client_id, percent:parseFloat(data.percent)||0, effectiveFromWeek:data.effective_from_week||null});
  render();
}
async function removeCommissionLink(linkId){
  if(!confirm('Remover esse vínculo?')) return;
  const {error} = await supabaseClient.from('commissioner_clients').delete().eq('id', linkId);
  if(error){ showToast('Erro ao remover: '+error.message); return; }
  STATE.commissionerClients = STATE.commissionerClients.filter(l=>l.id!==linkId);
  render();
}

// ---------- DASHBOARD TAB ----------
