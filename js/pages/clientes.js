function renderClientesTab(){
  if(CLIENT_DETAIL_ID) return renderClientDetail(CLIENT_DETAIL_ID);
  return `
    <div class="card">
      <h3>Novo cliente</h3>
      <label>Nome do cliente</label>
      <input type="text" id="new-client-name" placeholder="Ex: João Silva">
      <label>Telefone (opcional)</label>
      <input type="text" id="new-client-phone" placeholder="Ex: (11) 91234-5678">
      <label>Desconto em caso de perda (%)</label>
      <input type="number" id="new-client-discount" min="0" max="100" step="1" value="0" placeholder="Ex: 15">
      <label style="display:flex;align-items:center;gap:8px;margin-top:12px;cursor:pointer">
        <input type="checkbox" id="new-client-descarga" style="width:auto">
        <span>Conta de Descarga — resultado invertido</span>
      </label>
      <div style="margin-top:14px"><button class="btn-primary" onclick="addClient()">Cadastrar</button></div>
    </div>
    <div class="card">
      <label>Buscar cliente</label>
      <input type="text" id="client-search-input" placeholder="Digite o nome do cliente…" oninput="updateClientSearch()">
    </div>
    <div id="client-list-container">${renderClientListItems(STATE.clients)}</div>
  `;
}
function renderClientListItems(list){
  if(list.length===0) return '<div class="card"><div class="empty">Nenhum cliente encontrado.</div></div>';
  return list.map(cl=>`
    <div class="card" style="cursor:pointer" onclick="openClientDetail('${cl.id}')">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-weight:600;font-size:15px">${cl.name} ${cl.isDescarga?'<span class="chip" style="background:var(--gold-dim);color:var(--gold);font-size:10px">DESCARGA</span>':''}</div>
          ${cl.phone ? `<div style="font-size:12px;color:var(--text-muted);margin-top:2px">${cl.phone}</div>` : ''}
          ${cl.waGroupId ? `<div style="font-size:11px;color:var(--green);margin-top:2px">🔗 ${(STATE.botGroups.find(g=>g.id===cl.waGroupId)||{}).name||'grupo vinculado'}</div>` : ''}
        </div>
        <span style="color:var(--text-muted);font-size:18px">›</span>
      </div>
    </div>
  `).join('');
}
function updateClientSearch(){
  const val = document.getElementById('client-search-input').value.trim().toLowerCase();
  const filtered = val ? STATE.clients.filter(c=>c.name.toLowerCase().includes(val)) : STATE.clients;
  document.getElementById('client-list-container').innerHTML = renderClientListItems(filtered);
}
function openClientDetail(id){
  CLIENT_DETAIL_ID = id;
  CLIENT_RETURN_TAB = 'clientes';
  CONFIRM_DELETE_CLIENT = false;
  CLIENT_DETAIL_SUBVIEW = 'semanas';
  cdResetFilters();
  render();
}
// Da Dashboard: clicar no nome do cliente abre direto a página dele (e o "Voltar" volta para a Dashboard).
function openClientFromDashboard(id){
  ADMIN_TAB = 'clientes';
  CLIENT_RETURN_TAB = 'dashboard';
  CLIENT_DETAIL_ID = id;
  CONFIRM_DELETE_CLIENT = false;
  CLIENT_DETAIL_SUBVIEW = 'semanas';
  cdResetFilters();
  render();
  try{ window.scrollTo(0,0); }catch(e){}
}
function closeClientDetail(){
  CLIENT_DETAIL_ID = null;
  if(CLIENT_RETURN_TAB && CLIENT_RETURN_TAB!=='clientes') ADMIN_TAB = CLIENT_RETURN_TAB;
  CLIENT_RETURN_TAB = 'clientes';
  render();
}
function openClientDetailAt(id, subview){
  ADMIN_TAB = 'clientes';
  CLIENT_DETAIL_ID = id;
  CLIENT_RETURN_TAB = 'clientes';
  CONFIRM_DELETE_CLIENT = false;
  CLIENT_DETAIL_SUBVIEW = subview;
  cdResetFilters();
  render();
}
let CLIENT_RETURN_TAB = 'clientes';
let CLIENT_WK_PAGE = 1, CLIENT_WK_SIZE = 20, CLIENT_WK_OPEN = {};
let CLIENT_BETS_Q = '', CLIENT_BETS_STATUS = 'todas', CLIENT_BETS_PAGE = 1;
function cdResetFilters(){ CLIENT_WK_PAGE = 1; CLIENT_WK_OPEN = {}; CLIENT_BETS_Q = ''; CLIENT_BETS_STATUS = 'todas'; CLIENT_BETS_PAGE = 1; }
function cdEsc(v){ return String(v==null?'':v).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function cdCls(v){ return Math.abs(v)<0.005 ? 'v-zero' : (v>0 ? 'profit-pos' : 'profit-neg'); }
function cdNum(v){ return fmtNum(Math.abs(v)<0.005 ? 0 : v); }
function cdWeekNum(wk){ return typeof isoWeekNum==='function' ? isoWeekNum(wk) : ''; }
function cdDM(ds){ return ds.slice(8,10)+'/'+ds.slice(5,7); }

// Uma linha por semana em que o cliente teve aposta — mesmas contas da Dashboard.
function clientWeekRows(cl){
  const weeks = Array.from(new Set(STATE.tickets.filter(t=>t.clientId===cl.id).map(t=>mondayOf(ticketDate(t))))).sort().reverse();
  return weeks.map(wk=>{
    const tickets = STATE.tickets.filter(t=>t.clientId===cl.id && mondayOf(ticketDate(t))===wk);
    const volume = tickets.reduce((s,t)=>s+t.stake,0);
    const resultado = tickets.reduce((s,t)=>s+ticketProfit(t),0);
    const descontoPct = getWeekDiscount(cl, wk);
    const desconto = computeDescontoAmount(cl, resultado, wk);
    const comms = getActiveCommissionersForWeek(cl.id, wk);
    const comissao = comms.reduce((s,a)=>s+computeCommissionAmount(cl.id, a.percent, wk),0);
    const parts = getActivePartnersForWeek(cl.id, wk);
    const parceria = parts.reduce((s,a)=>s+computePartnerShare(cl.id, a.percent, wk),0);
    const liquido = applyDescontoSign(cl, resultado, desconto) - comissao + parceria;
    const owed = computeWeekOwedAmount(cl.id, wk);                         // perspectiva sua: positivo = cliente deve a você
    const pago = getSettlementsFor(cl.id, wk).reduce((s,x)=>s+x.amount,0);
    return {wk, tickets, volume, resultado, descontoPct, desconto, comms, comissao, parts, parceria, liquido, owed, pago, restante: owed - pago,
      g: tickets.filter(t=>ticketResult(t)==='green').length, r: tickets.filter(t=>ticketResult(t)==='red').length, p: tickets.filter(t=>ticketResult(t)==='pending').length};
  });
}
function cdBadges(g, r, p){
  return (g?`<span class="chip chip-green" style="margin-right:4px">✓ ${g}</span>`:'')+(r?`<span class="chip chip-red" style="margin-right:4px">✗ ${r}</span>`:'')+(p?`<span class="chip chip-pending" style="margin-right:4px">⏱ ${p}</span>`:'') || '—';
}
function cdInitials(name){ const p = String(name||'?').trim().split(/\s+/); return ((p[0]||'?')[0]+(p[1]?p[1][0]:'')).toUpperCase(); }
function setClientSub(v){ CLIENT_DETAIL_SUBVIEW = v; render(); }

function renderClientDetail(id){
  const cl = STATE.clients.find(c=>c.id===id);
  if(!cl){ CLIENT_DETAIL_ID=null; return renderClientesTab(); }
  if(CLIENT_DETAIL_SUBVIEW==='painel') CLIENT_DETAIL_SUBVIEW = 'semanas';
  const baseUrl = window.location.href.split('#')[0];
  const rows = clientWeekRows(cl);
  const all = STATE.tickets.filter(t=>t.clientId===cl.id);
  const tot = rows.reduce((a,r)=>({volume:a.volume+r.volume, resultado:a.resultado+r.resultado, desconto:a.desconto+r.desconto, comissao:a.comissao+r.comissao, parceria:a.parceria+r.parceria, liquido:a.liquido+r.liquido}), {volume:0,resultado:0,desconto:0,comissao:0,parceria:0,liquido:0});
  const g = all.filter(t=>ticketResult(t)==='green').length, r = all.filter(t=>ticketResult(t)==='red').length;
  const pend = all.filter(t=>ticketResult(t)==='pending');
  const saldoDev = computeContinuousBalance(cl.id);                  // positivo = cliente deve a você
  const curWk = mondayOf(todaySP());
  const comNow = getActiveCommissionersForWeek(cl.id, curWk).map(c=>{ const cm = STATE.commissioners.find(x=>x.id===c.commissionerId); return (cm?cm.name:'?')+' '+c.percent+'%'; });
  const parNow = getActivePartnersForWeek(cl.id, curWk).map(c=>{ const pr = STATE.partners.find(x=>x.id===c.partnerId); return (pr?pr.name:'?')+' '+c.percent+'%'; });
  const grp = cl.waGroupId ? ((STATE.botGroups.find(x=>x.id===cl.waGroupId)||{}).name || 'grupo vinculado') : '';
  const sub = CLIENT_DETAIL_SUBVIEW;
  const tab = (k, label)=>`<button type="button" class="cd-tab ${sub===k?'on':''}" onclick="setClientSub('${k}')">${label}</button>`;
  const attr = (l, v)=>`<div class="cd-attr"><span>${l}</span><b>${v}</b></div>`;
  const kpi = (l, v, cls, small, hl)=>`<div class="cd-kpi ${hl?'hl':''}"><span class="cd-kl">${l}</span><b class="cd-kv ${cls||''}">${v}</b>${small?`<span class="cd-ks">${small}</span>`:''}</div>`;
  return `
    <div class="cd-crumb"><button type="button" class="cd-back" onclick="closeClientDetail()">‹ ${CLIENT_RETURN_TAB==='dashboard'?'Dashboard':'Clientes'}</button><span>›</span><b>${cdEsc(cl.name)}</b></div>
    <div class="card cd-head">
      <div class="cd-top">
        <div class="cd-avatar">${cdEsc(cdInitials(cl.name))}</div>
        <div class="cd-id">
          <div class="cd-name">${cdEsc(cl.name)} ${cl.isDescarga?'<span class="chip" style="background:var(--gold-dim);color:var(--gold)">DESCARGA</span>':''}</div>
          <div class="cd-sub">#${cdEsc(cl.code||'—')} · <a href="${baseUrl}#cliente=${cl.code}" target="_blank">Link</a> · <a href="javascript:void(0)" onclick="copyLink('${cl.id}')">Copiar</a></div>
        </div>
        <div class="cd-actions">
          <button class="btn-ghost btn-sm" onclick="setClientSub('info')">✎ Editar</button>
          <button class="btn-ghost btn-sm" onclick="setClientSub('pagamentos')" title="Pagamentos e baixas">$ Pagamentos</button>
          <button class="btn-ghost btn-sm" onclick="gerarFechamento('${cl.id}')" title="Gerar imagem de fechamento">🧾 Fechamento</button>
          <button class="btn-ghost btn-sm" onclick="gerarFechamentoPDF('${cl.id}')" title="Fechamento em PDF">PDF</button>
        </div>
      </div>
      <div class="cd-attrs">
        ${attr('Desconto padrão', (cl.discount||0)+'%')}
        ${attr('Comissionado', comNow.length?cdEsc(comNow.join(', ')):'—')}
        ${attr('Parceiros', parNow.length?cdEsc(parNow.join(', ')):'—')}
        ${attr('Descarga', cl.isDescarga?'Ativo':'Inativo')}
        ${attr('WhatsApp', cl.phone?cdEsc(cl.phone):'—')}
        ${attr('Grupo (robô)', grp?cdEsc(grp):'Não vinculado')}
        ${attr('Saldo a '+(saldoDev>=0?'receber':'pagar'), `<span class="${saldoDev>0.01?'profit-pos':(saldoDev<-0.01?'profit-neg':'v-zero')}">${cdNum(Math.abs(saldoDev))}</span>`)}
      </div>
      <div class="cd-kpis">
        ${kpi('Apostas', all.length, '', `<span class="profit-pos">${g}</span> / <span class="profit-neg">${r}</span>${pend.length?` · ${pend.length} pend.`:''}`)}
        ${kpi('Volume', cdNum(tot.volume))}
        ${kpi('Saldo apostas', cdNum(tot.resultado), cdCls(tot.resultado))}
        ${kpi('Desconto', cdNum(tot.desconto), tot.desconto>0?'profit-pos':'v-zero')}
        ${kpi('Comissão', cdNum(tot.comissao), tot.comissao>0?'cd-gold':'v-zero')}
        ${Math.abs(tot.parceria)>=0.005 ? kpi('Parceria', cdNum(-tot.parceria), tot.parceria>0?'profit-neg':'profit-pos') : ''}
        ${kpi('Líquido', cdNum(tot.liquido), cdCls(tot.liquido), '', true)}
      </div>
    </div>
    <div class="cd-tabs">
      ${tab('semanas','Semanas')}${tab('apostas','Apostas')}${tab('esporte','Por esporte')}${tab('pagamentos','Pagamentos')}${tab('diagnostico','Diagnóstico')}${tab('info','Editar')}
    </div>
    ${sub==='semanas' ? renderClientWeeksTable(cl, rows) : sub==='apostas' ? renderClientBetsTab(cl) : sub==='esporte' ? renderClientSportTab(cl) : sub==='pagamentos' ? renderClientPaymentsTab(cl, saldoDev) : sub==='diagnostico' ? renderClientDiagnostico(cl) : renderClientEditTab(cl, tot, baseUrl)}
  `;
}

// ---- Semanas (tabela no formato da referência) ----
function renderClientWeeksTable(cl, rows){
  if(rows.length===0) return '<div class="card"><div class="empty">Esse cliente ainda não tem apostas registradas.</div></div>';
  const size = CLIENT_WK_SIZE, pages = Math.max(1, Math.ceil(rows.length/size));
  if(CLIENT_WK_PAGE>pages) CLIENT_WK_PAGE = pages; if(CLIENT_WK_PAGE<1) CLIENT_WK_PAGE = 1;
  const from = (CLIENT_WK_PAGE-1)*size, slice = rows.slice(from, from+size);
  const line = r=>{
    const open = !!CLIENT_WK_OPEN[r.wk];
    const comLabel = r.comms.length ? r.comms.map(c=>{ const cm = STATE.commissioners.find(x=>x.id===c.commissionerId); return cdEsc((cm?cm.name:'?')+' '+c.percent+'%'); }).join('<br>') : '<span class="v-zero">—</span>';
    const parLabel = r.parts.length ? r.parts.map(c=>{ const pr = STATE.partners.find(x=>x.id===c.partnerId); return cdEsc((pr?pr.name:'?')+' '+c.percent+'%'); }).join('<br>') : '<span class="v-zero">—</span>';
    let pay;
    if(Math.abs(r.owed)<0.005 && Math.abs(r.pago)<0.005) pay = '<span class="v-zero">—</span>';
    else if(Math.abs(r.restante)<0.5) pay = '<span class="chip chip-green">Quitado</span>';
    else pay = `${Math.abs(r.pago)>0.005?'<span class="chip chip-pending" style="margin-right:6px">Parcial</span>':''}<button class="btn-ghost btn-sm" onclick="event.stopPropagation();markWeekAsPaid('${cl.id}','${r.wk}',${r.restante.toFixed(2)})" title="Registrar o valor ${r.restante>=0?'recebido':'pago'} dessa semana">${r.restante>=0?'Receber':'Pagar'} ${cdNum(Math.abs(r.restante))}</button>`;
    return `
      <tr class="cd-row ${open?'open':''}" onclick="toggleClientWeek('${r.wk}')">
        <td class="left"><b>#${cdWeekNum(r.wk)}</b> · ${cdDM(r.wk)} a ${cdDM(shiftWeek(r.wk,6))}</td>
        <td>${r.tickets.length}<div class="cd-mini">${cdBadges(r.g, r.r, r.p)}</div></td>
        <td class="num strong">${cdNum(r.volume)}</td>
        <td class="num ${cdCls(r.resultado)}">${cdNum(r.resultado)}</td>
        <td class="num">${r.desconto>0?`<b>${cdNum(r.desconto)}</b>`:'<span class="v-zero">0,00</span>'} <button class="cd-pen" onclick="event.stopPropagation();editWeekDiscount('${cl.id}','${r.wk}',${r.descontoPct})" title="Editar o desconto só dessa semana">✎</button><div class="cd-mini">${r.descontoPct}%</div></td>
        <td class="num">${r.comissao>0?`<b class="cd-gold">${cdNum(r.comissao)}</b>`:'<span class="v-zero">0,00</span>'}</td>
        <td>${comLabel} <button class="cd-pen" onclick="event.stopPropagation();editWeekCommissioners('${cl.id}','${r.wk}')" title="Editar comissionados só dessa semana">✎</button></td>
        <td>${parLabel}${Math.abs(r.parceria)>=0.005?`<div class="cd-mini ${r.parceria>0?'profit-neg':'profit-pos'}">${cdNum(-r.parceria)}</div>`:''}</td>
        <td class="num ${cdCls(r.liquido)}"><b>${cdNum(r.liquido)}</b></td>
        <td onclick="event.stopPropagation()">${pay}</td>
      </tr>
      ${open ? `<tr class="cd-sub"><td colspan="10">${renderClientWeekBets(r)}</td></tr>` : ''}`;
  };
  return `
    <div class="card tbl-card">
      <div class="tbl-scroll"><table class="dash-table cd-table">
        <thead><tr><th>Período</th><th>Apostas</th><th>Volume</th><th>Saldo</th><th>Desconto</th><th>Comissão</th><th>Comissionado</th><th>Parceiros</th><th>Líquido</th><th>Pagamento</th></tr></thead>
        <tbody>${slice.map(line).join('')}</tbody>
      </table></div>
      <div class="cd-foot">
        <span>Mostrando ${from+1} a ${Math.min(from+size, rows.length)} de ${rows.length} semanas · clique numa semana para ver as apostas</span>
        <span class="cd-pager">
          <button class="btn-ghost btn-sm" ${CLIENT_WK_PAGE<=1?'disabled':''} onclick="CLIENT_WK_PAGE--;render()">‹</button>
          <b>${CLIENT_WK_PAGE}/${pages}</b>
          <button class="btn-ghost btn-sm" ${CLIENT_WK_PAGE>=pages?'disabled':''} onclick="CLIENT_WK_PAGE++;render()">›</button>
          <select onchange="CLIENT_WK_SIZE=+this.value;CLIENT_WK_PAGE=1;render()">${[10,20,50].map(n=>`<option value="${n}" ${n===size?'selected':''}>${n}</option>`).join('')}</select>
        </span>
      </div>
    </div>`;
}
function toggleClientWeek(wk){ CLIENT_WK_OPEN[wk] = !CLIENT_WK_OPEN[wk]; render(); }
function renderClientWeekBets(r){
  const list = [...r.tickets].sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
  return `<div class="cd-wkbets">${list.map(t=>cdBetRow(t)).join('')}</div>`;
}
function cdLegsHtml(t){
  return t.matches.map(m=>{
    const mk = (MARKETS.find(x=>x.v===m.market)||{}).l || m.market;
    const teams = m.away ? m.home+' x '+m.away : m.home;
    return `<div class="cd-leg">${resultIconSmall(m.result)} <span>${cdEsc(teams)} · ${cdEsc(mk)} · <b>${cdEsc(m.selection)}</b>${m.odd>0?` <i>@${Number(m.odd).toFixed(2)}</i>`:''}</span></div>`;
  }).join('');
}
function cdBetRow(t){
  const r = ticketResultDetail(t), p = ticketProfit(t), rr = ticketResult(t);
  return `<div class="cd-bet" onclick="abrirDetalheAposta('${t.id}')" title="Abrir detalhe da aposta">
    <div class="cd-bd"><b>${fmtDate(t.date)}${t.time?' '+t.time:''}</b><span>#${t.ticketNumber||'—'}</span></div>
    <div class="cd-bv"><b>${fmtNum(t.stake)}</b><span>@ ${ticketOddTotal(t)>0?effectiveOdds(t).toFixed(2):'—'}</span></div>
    <div class="cd-bl">${cdLegsHtml(t)}</div>
    <div class="cd-br">${resultChip(r)}<b class="${rr==='pending'||rr==='void'?'v-zero':(p>=0?'profit-pos':'profit-neg')}">${rr==='pending'?'—':cdNum(p)}</b></div>
  </div>`;
}

// ---- Apostas do cliente ----
function clientBetsFiltered(cl){
  let list = STATE.tickets.filter(t=>t.clientId===cl.id);
  if(CLIENT_BETS_STATUS!=='todas') list = list.filter(t=>ticketResult(t)===CLIENT_BETS_STATUS);
  const q = CLIENT_BETS_Q.trim().toLowerCase();
  if(q) list = list.filter(t=>String(t.ticketNumber||'').includes(q) || t.matches.some(m=>(String(m.home)+' '+String(m.away)+' '+String(m.selection)+' '+String(m.market)).toLowerCase().includes(q)));
  return list.sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
}
function renderClientBetsTab(cl){
  const list = clientBetsFiltered(cl), size = 25, pages = Math.max(1, Math.ceil(list.length/size));
  if(CLIENT_BETS_PAGE>pages) CLIENT_BETS_PAGE = pages;
  const from = (CLIENT_BETS_PAGE-1)*size;
  const cnt = k=>STATE.tickets.filter(t=>t.clientId===cl.id && (k==='todas'||ticketResult(t)===k)).length;
  const seg = [['todas','Todas'],['pending','Pendente'],['green','Green'],['red','Red'],['void','Anulada']];
  return `
    <div class="card">
      <div class="cd-bar">
        <input type="text" id="cd-bets-q" placeholder="Buscar por nº, time ou mercado" value="${cdEsc(CLIENT_BETS_Q)}" oninput="CLIENT_BETS_Q=this.value;CLIENT_BETS_PAGE=1;clientBetsRefresh()">
        <div class="ap-seg">${seg.map(([k,l])=>`<button type="button" class="${CLIENT_BETS_STATUS===k?'on':''}" onclick="CLIENT_BETS_STATUS='${k}';CLIENT_BETS_PAGE=1;render()">${l} <i>${cnt(k)}</i></button>`).join('')}</div>
      </div>
      <div id="cd-bets-list">${renderClientBetsList(list, from, size, pages)}</div>
    </div>`;
}
function renderClientBetsList(list, from, size, pages){
  if(!list.length) return '<div class="empty">Nenhuma aposta nesse filtro.</div>';
  return `<div class="cd-wkbets">${list.slice(from, from+size).map(cdBetRow).join('')}</div>
    <div class="cd-foot"><span>${from+1} a ${Math.min(from+size, list.length)} de ${list.length} apostas</span>
    <span class="cd-pager"><button class="btn-ghost btn-sm" ${CLIENT_BETS_PAGE<=1?'disabled':''} onclick="CLIENT_BETS_PAGE--;render()">‹</button><b>${CLIENT_BETS_PAGE}/${pages}</b><button class="btn-ghost btn-sm" ${CLIENT_BETS_PAGE>=pages?'disabled':''} onclick="CLIENT_BETS_PAGE++;render()">›</button></span></div>`;
}
function clientBetsRefresh(){
  const cl = STATE.clients.find(c=>c.id===CLIENT_DETAIL_ID); if(!cl) return;
  const list = clientBetsFiltered(cl), size = 25, pages = Math.max(1, Math.ceil(list.length/size));
  const el = document.getElementById('cd-bets-list'); if(el) el.innerHTML = renderClientBetsList(list, 0, size, pages);
}

// ---- Por esporte / por mercado ----
const CD_SPORT_NAMES = {football:'Futebol', soccer:'Futebol', basketball:'Basquete', nba:'Basquete (NBA)', nfl:'Futebol americano', mma:'MMA', tennis:'Tênis', baseball:'Beisebol', hockey:'Hóquei', other:'Outros'};
function renderClientSportTab(cl){
  const tickets = STATE.tickets.filter(t=>t.clientId===cl.id && ticketResult(t)!=='pending' && ticketResult(t)!=='void');
  if(!tickets.length) return '<div class="card"><div class="empty">Sem apostas resolvidas ainda.</div></div>';
  // aposta de 1 seleção entra inteira no esporte/mercado dela; múltipla entra no esporte da 1ª seleção (ou "Múltiplas")
  const sportOf = t=>{
    if(t.matches.length>1) return 'Múltiplas';
    const m = t.matches[0]; const sp = String((m.ref&&m.ref.sport)||m.sport||'').toLowerCase();
    return CD_SPORT_NAMES[sp] || (sp ? sp : 'Não informado');
  };
  const marketOf = t=>{
    if(t.matches.length>1) return 'Múltiplas';
    const m = t.matches[0]; return (MARKETS.find(x=>x.v===m.market)||{}).l || m.market || 'Outro';
  };
  const group = fn=>{
    const o = {};
    tickets.forEach(t=>{ const k = fn(t); const a = o[k] = o[k] || {k, n:0, g:0, r:0, vol:0, res:0}; a.n++; a.vol += t.stake; a.res += ticketProfit(t); const rr = ticketResult(t); if(rr==='green') a.g++; else if(rr==='red') a.r++; });
    return Object.values(o).sort((a,b)=>a.res-b.res);
  };
  const table = (title, rows)=>`
    <div class="card tbl-card"><div class="tbl-tabs"><div class="tbl-tab"><span>${title}</span></div></div>
      <div class="tbl-scroll"><table class="dash-table"><thead><tr><th>${title.replace('Por ','')}</th><th>Apostas</th><th>Volume</th><th>Resultado</th><th>Perf.</th></tr></thead><tbody>
      ${rows.map(a=>`<tr><td class="left"><b>${cdEsc(a.k)}</b></td><td>${a.n} <span class="cd-mini">${cdBadges(a.g,a.r,0)}</span></td><td class="num strong">${cdNum(a.vol)}</td><td class="num ${cdCls(a.res)}">${cdNum(a.res)}</td><td class="num perf">${a.vol>0?fmtNum(a.res/a.vol*100)+'%':'—'}</td></tr>`).join('')}
      </tbody></table></div></div>`;
  return table('Por esporte', group(sportOf)) + table('Por mercado', group(marketOf));
}

// ---- Pagamentos ----
function renderClientPaymentsTab(cl, saldoDev){
  const sts = STATE.settlements.filter(s=>s.clientId===cl.id).sort((a,b)=>(b.paidAt||'').localeCompare(a.paidAt||''));
  const aberto = STATE.transactions.filter(t=>t.type==='em_aberto' && t.clientId===cl.id && !t.excluded);
  const totalPago = getAllSettlementsForClient(cl.id);
  return `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
        <div><div class="cd-kl">Saldo atual</div><div style="font-family:var(--font-mono);font-size:22px;font-weight:700" class="${saldoDev>0.01?'profit-pos':(saldoDev<-0.01?'profit-neg':'v-zero')}">${fmtBRL(Math.abs(saldoDev))}</div><div class="cd-mini">${saldoDev>0.01?'o cliente deve a você':(saldoDev<-0.01?'você deve ao cliente':'sem saldo pendente')} · já registrado em baixas: ${fmtBRL(totalPago)}</div></div>
        <button class="btn-primary" onclick="darBaixa('${cl.id}', ${saldoDev.toFixed(2)})">+ Registrar pagamento</button>
      </div>
      <p class="cd-mini" style="margin:10px 0 0">O pagamento de uma semana específica é feito na aba <b>Semanas</b> (botão Receber/Pagar). Aqui você registra um acerto geral. Tudo entra no Caixa do Financeiro.</p>
    </div>
    <div class="card"><h3>Pagamentos registrados</h3>
      ${sts.length===0 ? '<div class="empty">Nenhum pagamento registrado.</div>' : sts.map(s=>`
        <div class="match-row" style="${s.excluded?'opacity:.5':''}">
          <div class="match-desc"><span class="teams">${s.paidAt?new Date(s.paidAt).toLocaleDateString('pt-BR'):'—'} · ${s.weekStart?'semana de '+weekLabel(s.weekStart):'baixa geral'}${s.excluded?' <span class="chip chip-void">EXCLUÍDO</span>':''}</span><span class="meta">${s.createdBy&&authorName(s.createdBy)?'por '+authorName(s.createdBy):''}</span></div>
          <div class="match-actions"><span style="font-family:var(--font-mono)" class="${s.amount>=0?'profit-pos':'profit-neg'}">${s.amount>=0?'recebido ':'pago '}${fmtBRL(Math.abs(s.amount))}</span>
            ${s.excluded ? `<button class="btn-ghost btn-sm" onclick="restaurarMovimentacao('baixa','${s.id}')">Restaurar</button>` : `<button class="btn-danger-ghost btn-sm" onclick="excluirMovimentacao('baixa','${s.id}')">Excluir</button>`}</div>
        </div>`).join('')}
    </div>
    ${aberto.length ? `<div class="card"><h3>Saldo em aberto (dívida antiga)</h3>${aberto.map(t=>`<div class="match-row"><div class="match-desc"><span class="teams">${cdEsc(t.description||'Em aberto')}</span><span class="meta">${fmtDate(t.date)}</span></div><div class="match-actions"><span style="font-family:var(--font-mono);color:var(--gold)">${fmtBRL(t.amount)}</span><button class="btn-ghost btn-sm" onclick="marcarComoRecebido('${t.id}')">Marcar recebido</button></div></div>`).join('')}</div>` : ''}`;
}

// ---- Editar ----
function renderClientEditTab(cl, tot, baseUrl){
  return `
    <div class="card">
      <h3>Editar cliente</h3>
      <label>Nome do cliente</label>
      <input type="text" id="detail-client-name" value="${cl.name}">
      <label>Telefone (opcional)</label>
      <input type="text" id="detail-client-phone" value="${cl.phone||''}" placeholder="Ex: (11) 91234-5678">
      <label>Grupo do WhatsApp (robô)</label>
      ${renderClientGroupSelect(cl)}
      <label>Desconto padrão em caso de perda (%)</label>
      <input type="number" id="detail-client-discount" min="0" max="100" step="1" value="${cl.discount||0}">
      <p style="font-size:12px;color:var(--text-muted);margin:6px 0 0">Mudar esse valor passa a valer <strong>a partir de agora</strong>, sem afetar semanas passadas. Pra mudar o desconto de uma semana específica no passado, usa a aba <strong>Semanas</strong>.</p>
      <label style="display:flex;align-items:center;gap:8px;margin-top:14px;cursor:pointer">
        <input type="checkbox" id="detail-client-descarga" style="width:auto" ${cl.isDescarga?'checked':''}>
        <span>Conta de Descarga — resultado invertido</span>
      </label>
      <label>Link de acesso do cliente</label>
      <div class="link-box">
        <code id="link-${cl.id}">${baseUrl}#cliente=${cl.code}</code>
        <button class="btn-ghost btn-sm" onclick="copyLink('${cl.id}')">Copiar link</button>
      </div>
      <div style="margin-top:14px"><button class="btn-primary btn-full" onclick="saveClientDetail('${cl.id}')">Salvar alterações</button></div>
    </div>
    ${CONFIRM_DELETE_CLIENT ? `
      <div class="card" style="border-color:var(--red)">
        <p style="margin:0 0 12px;font-size:14px">Tem certeza que quer excluir <strong>${cl.name}</strong>? Essa ação não pode ser desfeita.</p>
        <div class="row">
          <div><button class="btn-ghost btn-full" onclick="CONFIRM_DELETE_CLIENT=false;render()">Cancelar</button></div>
          <div><button class="btn-danger-ghost btn-full" onclick="deleteClient('${cl.id}')">Sim, excluir definitivamente</button></div>
        </div>
      </div>
    ` : `
      <div class="card">
        <button class="btn-danger-ghost btn-full" onclick="CONFIRM_DELETE_CLIENT=true;render()">Excluir cliente</button>
      </div>
    `}
  `;
}
function renderClientPanel(cl){
  const clientTickets = STATE.tickets.filter(t=>t.clientId===cl.id);
  const volumeGeral = clientTickets.reduce((s,t)=>s+t.stake,0);
  const resultadoGeral = clientTickets.reduce((s,t)=>s+ticketProfit(t),0);
  const pendentes = clientTickets.filter(t=>ticketResult(t)==='pending');
  const pendentesValor = pendentes.reduce((s,t)=>s+t.stake,0);
  const resolvidas = clientTickets.filter(t=>{const r=ticketResult(t); return r==='green'||r==='red';});
  const greens = resolvidas.filter(t=>ticketResult(t)==='green').length;
  const percAcerto = resolvidas.length>0 ? (greens/resolvidas.length*100) : 0;
  const saldoDevedor = computeContinuousBalance(cl.id); // positivo = cliente deve pra você
  const ordenadas = [...clientTickets].sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
  const ultimaAtividade = ordenadas[0] || null;
  const recentes = ordenadas.slice(0,6);

  function statCard(label, value, colorClass){
    return `
      <div class="card" style="margin-bottom:0;padding:16px">
        <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.4px;font-weight:600">${label}</div>
        <div style="font-family:var(--font-mono);font-size:19px;font-weight:700;margin-top:7px" class="${colorClass||''}">${value}</div>
      </div>
    `;
  }

  return `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:16px">
      ${statCard('Lucro/Prejuízo', fmtBRL(resultadoGeral), resultadoGeral>=0?'profit-pos':'profit-neg')}
      ${statCard('Volume Apostado', fmtBRL(volumeGeral))}
      ${statCard('Qtd. de Apostas', clientTickets.length)}
      ${statCard('% de Acerto', percAcerto.toFixed(1)+'%')}
      ${statCard('Pendências', pendentes.length+' <span style="font-size:12px;color:var(--text-muted)">('+fmtBRL(pendentesValor)+')</span>')}
      ${statCard('Saldo Devedor Atual', fmtBRL(saldoDevedor), saldoDevedor>0.01?'profit-neg':(saldoDevedor<-0.01?'profit-pos':''))}
    </div>
    <div class="card">
      <h3>Última atividade</h3>
      ${ultimaAtividade ? `<div style="font-size:13px">${fmtDate(ultimaAtividade.date)}${ultimaAtividade.time?' às '+ultimaAtividade.time:''} · #${ultimaAtividade.ticketNumber||'—'} · ${fmtBRL(ultimaAtividade.stake)}</div>` : '<div class="empty">Nenhuma aposta registrada ainda.</div>'}
    </div>
    <div class="card">
      <h3>Histórico recente</h3>
      ${recentes.length===0 ? '<div class="empty">Nenhuma aposta ainda.</div>' : recentes.map(t=>{
        const r = ticketResult(t);
        const profit = ticketProfit(t);
        return `
          <div class="match-row">
            <div class="match-desc">
              <span class="teams">#${t.ticketNumber||'—'} · ${fmtDate(t.date)}${t.time?' '+t.time:''}</span>
              <span class="meta">${fmtBRL(t.stake)}</span>
            </div>
            <div style="display:flex;align-items:center;gap:8px">
              ${resultChip(r)}
              <span style="font-family:var(--font-mono);font-size:12.5px;font-weight:700" class="${r==='pending'?'':(profit>=0?'profit-pos':'profit-neg')}">${r==='pending'?'—':fmtBRL(profit)}</span>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}
// Marca uma semana específica como paga — usa exatamente o mesmo mecanismo de "settlements"
// que o "Dar baixa" do Financeiro já usa. Por isso fica automaticamente interligado: entra
// no caixa (aba Caixa) e reduz o saldo devedor contínuo do cliente (aba Clientes), sem
// precisar de nenhuma lógica nova ou separada.
async function markWeekAsPaid(clientId, weekStart, weekOwedAmount){
  const isReceber = weekOwedAmount>=0;
  const label = isReceber ? 'Valor recebido dessa semana' : 'Valor pago dessa semana';
  const defaultVal = Math.abs(weekOwedAmount).toFixed(2).replace('.',',');
  const input = prompt(`${label} (a semana ${isReceber?'gerou':'ficou devendo'} ${fmtBRL(Math.abs(weekOwedAmount))}):`, defaultVal);
  if(input===null) return;
  const val = parseFloat(String(input).replace(',','.'));
  if(isNaN(val) || val<=0){ showToast('Valor inválido.'); return; }
  const amount = isReceber ? val : -val;
  const {data, error} = await supabaseClient.from('settlements').insert({client_id: clientId, week_start: weekStart, amount, created_by: currentUserId()}).select().single();
  if(error){ showToast('Erro ao marcar como pago: '+error.message); return; }
  STATE.settlements.push({id:data.id, clientId:data.client_id, weekStart:data.week_start, amount:parseFloat(data.amount), paidAt:data.paid_at, excluded:false, createdBy:data.created_by||null});
  showToast('Semana marcada como paga!');
  render();
}
// Mostra o passo a passo de CADA número que compõe o saldo do cliente, semana por semana —
// desconto (e desde quando aquele % vale), comissão (e de onde vem), cada pagamento já
// registrado, e reconcilia tudo no final contra o saldo real do sistema. Serve tanto pra
// você entender de onde vem um valor quanto pra eu (ou você) achar rápido qualquer
// inconsistência real, se ela existir.
function renderClientDiagnostico(cl){
  const r = computeClientReconciliation(cl);
  const {weekBlocks, emAberto, emAbertoTotal, settlements, totalPago, totalBetAdmin, totalDevidoBruto, saldoFinalManual, saldoFinalReal, bateuOk} = r;

  return `
    <div class="card">
      <h3>Diagnóstico — passo a passo do saldo</h3>
      <p style="font-size:12px;color:var(--text-muted);margin-top:0">De onde vem cada número, semana por semana — pra achar rápido qualquer valor que esteja diferente do esperado.</p>
    </div>
    ${weekBlocks.length===0 ? '<div class="card"><div class="empty">Sem apostas ainda.</div></div>' : weekBlocks.map(w=>`
      <div class="card">
        <div style="font-weight:600;font-size:14px;margin-bottom:10px">Semana de ${weekLabel(w.wk)}</div>
        ${w.resolvedTickets.map(t=>{
          const profit = ticketProfit(t);
          return `<div style="display:flex;justify-content:space-between;font-size:12.5px;padding:4px 0;border-bottom:1px solid var(--line-soft)">
            <span>#${t.ticketNumber||'—'} · ${ticketResult(t)} · ${fmtBRL(t.stake)}${t.odds?' @'+t.odds:''}</span>
            <span class="${profit>=0?'profit-pos':'profit-neg'}" style="font-family:var(--font-mono)">${fmtBRL(profit)}</span>
          </div>`;
        }).join('')}
        ${w.pendingTickets.length>0 ? `<div style="font-size:11px;color:var(--gold);margin-top:6px">${w.pendingTickets.length} aposta(s) pendente(s) nessa semana — não entram na conta ainda</div>` : ''}
        ${w.voidTickets.length>0 ? `<div style="font-size:11px;color:var(--text-muted);margin-top:2px">${w.voidTickets.length} aposta(s) anulada(s) — não contam</div>` : ''}
        <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--line);font-size:12.5px;line-height:1.9">
          <div>Resultado da semana (soma das apostas resolvidas): <strong class="${w.resultado>=0?'profit-pos':'profit-neg'}">${fmtBRL(w.resultado)}</strong></div>
          <div>Desconto: <strong>${fmtBRL(w.desconto)}</strong> <span style="color:var(--text-muted)">(${w.descontoPct}% — ${w.descontoOrigem})</span></div>
          <div>Líquido do cliente (resultado ${cl.isDescarga?'− desconto, por ser conta de Descarga':'+ desconto'}): <strong class="${w.liquido>=0?'profit-pos':'profit-neg'}">${fmtBRL(w.liquido)}</strong></div>
          ${w.comissaoDetalhe.length>0 ? `<div>Comissão (${w.comissaoOrigem}): ${w.comissaoDetalhe.map(c=>`${c.name} ${c.percent}% = ${fmtBRL(c.amount)}`).join(', ')}</div>` : ''}
        </div>
      </div>
    `).join('')}
    <div class="card">
      <h3>Saldo em aberto <span style="font-size:12px;color:var(--text-muted);font-weight:400">(dívida antiga cadastrada manualmente)</span></h3>
      ${emAberto.length===0 ? '<div class="empty">Nenhum.</div>' : emAberto.map(t=>`
        <div style="display:flex;justify-content:space-between;font-size:12.5px;padding:4px 0;border-bottom:1px solid var(--line-soft);${t.excluded?'opacity:0.5':''}">
          <span>${t.description||'—'} · ${fmtDate(t.date)}${t.excluded?' <span class="chip chip-void">EXCLUÍDA</span>':''}${t.type==='receita'?' <span style="color:var(--text-muted)">(já marcado como recebido)</span>':''}</span>
          <span style="font-family:var(--font-mono);color:var(--gold)">${fmtBRL(t.amount)}</span>
        </div>
      `).join('')}
    </div>
    <div class="card">
      <h3>Pagamentos já registrados (baixas)</h3>
      ${settlements.length===0 ? '<div class="empty">Nenhum ainda.</div>' : settlements.map(s=>`
        <div style="display:flex;justify-content:space-between;font-size:12.5px;padding:4px 0;border-bottom:1px solid var(--line-soft);${s.excluded?'opacity:0.5':''}">
          <span>${s.paidAt?new Date(s.paidAt).toLocaleDateString('pt-BR'):'—'} · ${s.weekStart?'semana de '+weekLabel(s.weekStart):'baixa geral (não presa a uma semana)'}${s.excluded?' <span class="chip chip-void">EXCLUÍDA</span>':''}</span>
          <span style="font-family:var(--font-mono)" class="${s.amount>=0?'profit-pos':'profit-neg'}">${fmtBRL(s.amount)}</span>
        </div>
      `).join('')}
    </div>
    <div class="card" style="border-color:${bateuOk?'var(--line)':'var(--red)'}">
      <h3>Reconciliação final</h3>
      <div style="font-size:13px;line-height:2">
        <div>Total gerado pelas apostas (soma dos líquidos de todas as semanas, invertido pra sua perspectiva): <strong>${fmtBRL(totalBetAdmin)}</strong></div>
        <div>+ Saldo em aberto ativo: <strong>${fmtBRL(emAbertoTotal)}</strong></div>
        <div style="border-top:1px solid var(--line);padding-top:6px;margin-top:6px">= Total devido bruto: <strong>${fmtBRL(totalDevidoBruto)}</strong></div>
        <div>− Total já pago (baixas ativas): <strong>${fmtBRL(totalPago)}</strong></div>
        <div style="border-top:1px solid var(--line);padding-top:6px;margin-top:6px">= Saldo devedor final (recalculado aqui, manualmente): <strong class="${saldoFinalManual>=0?'profit-pos':'profit-neg'}">${fmtBRL(saldoFinalManual)}</strong></div>
        <div>Saldo devedor mostrado no sistema (Painel/Financeiro): <strong class="${saldoFinalReal>=0?'profit-pos':'profit-neg'}">${fmtBRL(saldoFinalReal)}</strong></div>
      </div>
      ${bateuOk
        ? `<div style="margin-top:12px;padding:10px 12px;background:var(--green-dim);border-radius:var(--radius-sm);color:var(--green);font-size:12.5px">✓ Os dois valores batem — a conta está consistente.</div>`
        : `<div style="margin-top:12px;padding:10px 12px;background:var(--red-dim);border-radius:var(--radius-sm);color:var(--red);font-size:12.5px">⚠ Os valores NÃO batem — isso indica um problema real nos dados desse cliente. Me manda um print dessa tela.</div>`}
    </div>
  `;
}
function renderClientWeeksList(cl){
  const weeksSet = new Set(STATE.tickets.filter(t=>t.clientId===cl.id).map(t=>mondayOf(ticketDate(t))));
  const weeks = Array.from(weeksSet).sort().reverse();
  if(weeks.length===0) return '<div class="card"><div class="empty">Esse cliente ainda não tem apostas registradas.</div></div>';

  return weeks.map(wk=>{
    const tickets = STATE.tickets.filter(t=>t.clientId===cl.id && mondayOf(ticketDate(t))===wk);
    const greenCount = tickets.filter(t=>ticketResult(t)==='green').length;
    const redCount = tickets.filter(t=>ticketResult(t)==='red').length;
    const pendingCount = tickets.filter(t=>ticketResult(t)==='pending').length;
    const volume = tickets.reduce((s,t)=>s+t.stake,0);
    const resultado = tickets.reduce((s,t)=>s+ticketProfit(t),0);
    const descontoPct = getWeekDiscount(cl, wk);
    const desconto = computeDescontoAmount(cl, resultado, wk);
    const liquido = applyDescontoSign(cl, resultado, desconto);
    const activeCommissioners = getActiveCommissionersForWeek(cl.id, wk);
    const comissaoTotal = activeCommissioners.reduce((s,c)=>s+computeCommissionAmount(cl.id, c.percent, wk),0);
    const badges = activeCommissioners.map(c=>{
      const cm = STATE.commissioners.find(x=>x.id===c.commissionerId);
      return `<span class="chip" style="background:var(--gold-dim);color:var(--gold)">${cm?cm.name:'?'} ${c.percent}%</span>`;
    }).join(' ') || '<span style="color:var(--text-muted);font-size:12px">Nenhum</span>';
    // Quanto já foi registrado como pago/recebido especificamente marcado nessa semana
    // (informativo — o saldo devedor real do cliente é sempre o contínuo, na aba Financeiro).
    const pagoNaSemana = STATE.settlements.filter(s=>s.clientId===cl.id && s.weekStart===wk && !s.excluded).reduce((s,x)=>s+x.amount,0);
    const weekOwed = -liquido; // perspectiva admin: positivo = você deve receber dessa semana

    return `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
          <div style="font-weight:600;font-size:14px">Semana de ${weekLabel(wk)}</div>
          <div style="font-size:12px;color:var(--text-muted)">
            ${tickets.length} aposta(s)
            ${greenCount?` · <span class="profit-pos">✓ ${greenCount}</span>`:''}
            ${redCount?` · <span class="profit-neg">✗ ${redCount}</span>`:''}
            ${pendingCount?` · <span class="chip chip-pending" style="padding:1px 7px">${pendingCount} pend.</span>`:''}
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(115px,1fr));gap:12px 16px">
          <div>
            <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.3px">Volume</div>
            <div style="font-family:var(--font-mono);font-size:14px;margin-top:3px">${fmtBRL(volume)}</div>
          </div>
          <div>
            <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.3px">Saldo Apostas</div>
            <div style="font-family:var(--font-mono);font-size:14px;margin-top:3px" class="${resultado>=0?'profit-pos':'profit-neg'}">${fmtBRL(resultado)}</div>
          </div>
          <div>
            <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.3px">Desconto (${descontoPct}%)</div>
            <div style="display:flex;align-items:center;gap:5px;margin-top:3px">
              <span style="font-family:var(--font-mono);font-size:14px" class="${desconto>0?'profit-pos':''}">${fmtBRL(desconto)}</span>
              <button class="btn-ghost btn-sm" style="padding:1px 6px;font-size:10px" onclick="editWeekDiscount('${cl.id}','${wk}',${descontoPct})" title="Editar desconto só dessa semana">✎</button>
            </div>
          </div>
          <div>
            <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.3px">Comissão</div>
            <div style="font-family:var(--font-mono);font-size:14px;margin-top:3px;color:var(--gold)">${fmtBRL(comissaoTotal)}</div>
          </div>
          <div style="grid-column:1 / -1">
            <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.3px">Comissionados dessa semana</div>
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:5px">
              ${badges}
              <button class="btn-ghost btn-sm" style="padding:1px 6px;font-size:10px" onclick="editWeekCommissioners('${cl.id}','${wk}')" title="Editar comissionados só dessa semana">✎</button>
            </div>
          </div>
          <div style="grid-column:1 / -1;border-top:1px solid var(--line);padding-top:10px;margin-top:2px">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
              <div>
                <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.3px">Líquido do cliente</div>
                <div style="font-family:var(--font-mono);font-size:17px;font-weight:700;margin-top:3px" class="${liquido>=0?'profit-pos':'profit-neg'}">${fmtBRL(liquido)}</div>
                ${pagoNaSemana!==0 ? `<div style="font-size:11px;color:var(--text-muted);margin-top:3px">Já registrado nessa semana: ${fmtBRL(pagoNaSemana)}</div>` : ''}
              </div>
              <button class="btn-ghost btn-sm" onclick="markWeekAsPaid('${cl.id}','${wk}',${weekOwed})">Marcar como pago</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}
async function editWeekDiscount(clientId, weekStart, currentPct){
  const input = prompt('Desconto (%) só pra essa semana — não muda o padrão nem outras semanas:', currentPct);
  if(input===null) return;
  const pct = parseFloat(String(input).replace(',','.'));
  if(isNaN(pct) || pct<0){ showToast('Valor inválido.'); return; }
  const existing = STATE.clientWeekDiscounts.find(o=>o.clientId===clientId && o.weekStart===weekStart);
  if(existing){
    const {error} = await supabaseClient.from('client_week_discount').update({discount_percent: pct}).eq('id', existing.id);
    if(error){ showToast('Erro ao salvar: '+error.message); return; }
    existing.discountPercent = pct;
  } else {
    const {data, error} = await supabaseClient.from('client_week_discount').insert({client_id: clientId, week_start: weekStart, discount_percent: pct}).select().single();
    if(error){ showToast('Erro ao salvar: '+error.message); return; }
    STATE.clientWeekDiscounts.push({id:data.id, clientId:data.client_id, weekStart:data.week_start, discountPercent:parseFloat(data.discount_percent)||0});
  }
  render();
}
let WEEK_COMM_EDIT = null;
function editWeekCommissioners(clientId, weekStart){
  const current = getActiveCommissionersForWeek(clientId, weekStart);
  WEEK_COMM_EDIT = {clientId, weekStart, list: current.map(c=>({commissionerId:c.commissionerId, percent:c.percent}))};
  renderWeekCommEditOverlay();
}
function renderWeekCommEditOverlay(){
  let overlay = document.getElementById('week-comm-overlay');
  if(!overlay){
    overlay = document.createElement('div');
    overlay.id = 'week-comm-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
    document.body.appendChild(overlay);
  }
  const {weekStart, list} = WEEK_COMM_EDIT;
  const availableToAdd = STATE.commissioners.filter(cm=>!list.some(l=>l.commissionerId===cm.id));
  overlay.innerHTML = `
    <div class="card" style="max-width:380px;width:100%;margin:0;max-height:85vh;overflow-y:auto">
      <h3>Comissionados — semana de ${weekLabel(weekStart)}</h3>
      <p style="font-size:12px;color:var(--text-muted);margin-top:0">Editar aqui afeta só essa semana. Outras semanas não mudam.</p>
      ${list.length===0 ? '<div class="empty">Nenhum comissionado nessa semana.</div>' : list.map((c,idx)=>{
        const cm = STATE.commissioners.find(x=>x.id===c.commissionerId);
        return `
        <div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--line)">
          <span style="flex:1;font-size:13px">${cm?cm.name:'?'}</span>
          <input type="number" value="${c.percent}" min="0" max="100" step="0.1" style="width:70px" onchange="WEEK_COMM_EDIT.list[${idx}].percent=parseFloat(this.value)||0">
          <span style="font-size:12px;color:var(--text-muted)">%</span>
          <button class="btn-danger-ghost btn-sm" onclick="WEEK_COMM_EDIT.list.splice(${idx},1);renderWeekCommEditOverlay()">×</button>
        </div>`;
      }).join('')}
      ${availableToAdd.length>0 ? `
      <label>Adicionar comissionado</label>
      <select id="week-comm-add-select">
        <option value="">Selecione…</option>
        ${availableToAdd.map(cm=>`<option value="${cm.id}">${cm.name}</option>`).join('')}
      </select>
      <div style="margin-top:10px"><button class="btn-ghost btn-full" onclick="addToWeekCommEdit()">+ Adicionar</button></div>
      ` : ''}
      <div class="row" style="margin-top:14px">
        <div><button class="btn-ghost btn-full" onclick="cancelWeekCommEdit()">Cancelar</button></div>
        <div><button class="btn-primary btn-full" onclick="saveWeekCommEdit()">Salvar</button></div>
      </div>
    </div>
  `;
}
function addToWeekCommEdit(){
  const sel = document.getElementById('week-comm-add-select');
  const id = sel.value;
  if(!id) return;
  WEEK_COMM_EDIT.list.push({commissionerId:id, percent:0});
  renderWeekCommEditOverlay();
}
function cancelWeekCommEdit(){
  WEEK_COMM_EDIT = null;
  const overlay = document.getElementById('week-comm-overlay');
  if(overlay) document.body.removeChild(overlay);
}
async function saveWeekCommEdit(){
  const {clientId, weekStart, list} = WEEK_COMM_EDIT;
  const {error: delError} = await supabaseClient.from('client_week_commissioners').delete().eq('client_id', clientId).eq('week_start', weekStart);
  if(delError){ showToast('Erro ao salvar: '+delError.message); return; }
  STATE.clientWeekCommissioners = STATE.clientWeekCommissioners.filter(o=>!(o.clientId===clientId && o.weekStart===weekStart));
  if(list.length===0){
    const {data, error} = await supabaseClient.from('client_week_commissioners').insert({client_id: clientId, week_start: weekStart, commissioner_id: null, percent: null}).select().single();
    if(error){ showToast('Erro ao salvar: '+error.message); return; }
    STATE.clientWeekCommissioners.push({id:data.id, clientId:data.client_id, weekStart:data.week_start, commissionerId:null, percent:null});
  } else {
    for(const item of list){
      const {data, error} = await supabaseClient.from('client_week_commissioners').insert({client_id: clientId, week_start: weekStart, commissioner_id: item.commissionerId, percent: item.percent}).select().single();
      if(error){ showToast('Erro ao salvar: '+error.message); return; }
      STATE.clientWeekCommissioners.push({id:data.id, clientId:data.client_id, weekStart:data.week_start, commissionerId:data.commissioner_id, percent:data.percent!=null?parseFloat(data.percent):null});
    }
  }
  cancelWeekCommEdit();
  render();
}
async function saveClientDetail(id){
  const name = document.getElementById('detail-client-name').value.trim();
  const phone = document.getElementById('detail-client-phone').value.trim();
  const discount = Math.max(0, Math.min(100, parseFloat(document.getElementById('detail-client-discount').value)||0));
  const isDescarga = document.getElementById('detail-client-descarga').checked;
  if(!name){ showToast('Informe o nome do cliente.'); return; }
  const cl0 = STATE.clients.find(c=>c.id===id);
  const upd = {name, phone, discount, is_descarga: isDescarga};
  const gSel = document.getElementById('detail-client-group');
  const newGroup = gSel ? (gSel.value || null) : undefined;
  const groupChanged = gSel && (newGroup||null) !== ((cl0 && cl0.waGroupId)||null);
  if(groupChanged) upd.wa_group_id = newGroup;       // só mexe nessa coluna quando você troca o grupo
  const {error} = await supabaseClient.from('clients').update(upd).eq('id', id);
  if(error){ showToast('Erro ao salvar cliente: '+error.message+(groupChanged?' (rodou o SQL do vínculo de grupo?)':'')); return; }
  const cl = STATE.clients.find(c=>c.id===id);
  if(cl && groupChanged) cl.waGroupId = newGroup;
  const discountChanged = cl && cl.discount !== discount;
  if(cl){ cl.name=name; cl.phone=phone; cl.discount=discount; cl.isDescarga=isDescarga; }
  if(discountChanged){
    const effectiveFromWeek = mondayOf(todaySP());
    const {data, error: histError} = await supabaseClient.from('client_discount_history').insert({client_id: id, discount_percent: discount, effective_from_week: effectiveFromWeek}).select().single();
    if(histError){ showToast('Cliente salvo, mas houve erro ao registrar a mudança de desconto na linha do tempo: '+histError.message); }
    else{
      STATE.clientDiscountHistory.push({id:data.id, clientId:data.client_id, discountPercent:parseFloat(data.discount_percent)||0, effectiveFromWeek:data.effective_from_week||null});
    }
  }
  CLIENT_DETAIL_ID = null;
  render();
}
async function addClient(){
  const name = document.getElementById('new-client-name').value.trim();
  const phone = document.getElementById('new-client-phone').value.trim();
  const discount = parseFloat(document.getElementById('new-client-discount').value) || 0;
  const isDescarga = document.getElementById('new-client-descarga').checked;
  if(!name) return;
  const code = uid()+uid();
  const {data, error} = await supabaseClient.from('clients').insert({name, code, discount, phone, is_descarga: isDescarga}).select().single();
  if(error){ showToast('Erro ao salvar cliente: '+error.message); return; }
  STATE.clients.push({id:data.id, name:data.name, code:data.code, discount:data.discount||0, phone:data.phone||'', isDescarga:data.is_descarga||false});
  const {data: histData, error: histError} = await supabaseClient.from('client_discount_history').insert({client_id: data.id, discount_percent: discount, effective_from_week: null}).select().single();
  if(!histError && histData){
    STATE.clientDiscountHistory.push({id:histData.id, clientId:histData.client_id, discountPercent:parseFloat(histData.discount_percent)||0, effectiveFromWeek:histData.effective_from_week||null});
  }
  render();
}
async function setClientDiscount(id, value){
  const discount = Math.max(0, Math.min(100, parseFloat(value)||0));
  const {error} = await supabaseClient.from('clients').update({discount}).eq('id', id);
  if(error){ showToast('Erro ao salvar desconto: '+error.message); return; }
  const cl = STATE.clients.find(c=>c.id===id);
  if(cl) cl.discount = discount;
}
async function deleteClient(id){
  const {error} = await supabaseClient.from('clients').delete().eq('id', id);
  if(error){ showToast('Erro ao remover cliente: '+error.message); return; }
  STATE.clients = STATE.clients.filter(c=>c.id!==id);
  CLIENT_DETAIL_ID = null;
  CONFIRM_DELETE_CLIENT = false;
  render();
}
function copyLink(id){
  const text = document.getElementById(`link-${id}`).textContent;
  navigator.clipboard?.writeText(text);
}
function copyCommissionerLink(id){
  const text = document.getElementById(`commissioner-link-${id}`).textContent;
  navigator.clipboard?.writeText(text);
}
function filterClientOptions(){
  const input = document.getElementById('new-client-search');
  const box = document.getElementById('client-options');
  const val = input.value.trim().toLowerCase();
  document.getElementById('new-client-id').value = '';
  if(DRAFT) DRAFT.clientId='';
  if(val.length < 2){ box.style.display='none'; box.innerHTML=''; return; }
  const matches = STATE.clients.filter(c=>c.name.toLowerCase().includes(val));
  if(matches.length===0){
    box.innerHTML = '<div class="autocomplete-item" style="cursor:default;color:var(--text-muted)">Nenhum cliente encontrado</div>';
  } else {
    box.innerHTML = matches.map(c=>`<div class="autocomplete-item" onmousedown="selectClientOption('${c.id}')">${c.name}</div>`).join('');
  }
  box.style.display='block';
}
function selectClientOption(id){
  const cl = STATE.clients.find(c=>c.id===id);
  if(!cl) return;
  if(DRAFT){ DRAFT.clientId = id; DRAFT.clientName = cl.name; }
  document.getElementById('new-client-id').value = id;
  document.getElementById('new-client-search').value = cl.name;
  const box = document.getElementById('client-options');
  box.style.display='none'; box.innerHTML='';
}

// ---------- PARCEIROS (COMISSIONADOS) ----------

// Desconto efetivo de um cliente numa semana: sobrescrita manual daquela semana,
// senão o desconto padrão atual do cliente.


// Lista de grupos do WhatsApp que o robô enxerga; cada grupo só pode ficar em UM cliente.
function renderClientGroupSelect(cl){
  if(!STATE.botGroupsOk){
    return '<div style="font-size:12px;color:var(--text-muted);margin-bottom:8px">Ainda não disponível: rode o SQL do vínculo de grupos (te enviei no chat) e deixe o robô ligado.</div>';
  }
  const takenBy = {};
  STATE.clients.forEach(c=>{ if(c.waGroupId && c.id!==cl.id) takenBy[c.waGroupId] = c.name; });
  const known = STATE.botGroups.some(g=>g.id===cl.waGroupId);
  return `<select id="detail-client-group">
      <option value="">— sem grupo vinculado —</option>
      ${cl.waGroupId && !known ? `<option value="${cl.waGroupId}" selected>(grupo atual — não está na lista do robô)</option>` : ''}
      ${STATE.botGroups.map(g=>`<option value="${g.id}" ${g.id===cl.waGroupId?'selected':''} ${takenBy[g.id]?'disabled':''}>${String(g.name||'(sem nome)').replace(/</g,'&lt;')}${takenBy[g.id]?' — já é de '+String(takenBy[g.id]).replace(/</g,'&lt;'):''}</option>`).join('')}
    </select>
    <div style="font-size:12px;color:var(--text-muted);margin:4px 0 0">O robô só lança neste cliente as validações feitas nesse grupo (${STATE.botGroups.length} grupo${STATE.botGroups.length===1?'':'s'} na lista). Não achou o grupo? Deixe o robô ligado e recarregue.</div>`;
}
