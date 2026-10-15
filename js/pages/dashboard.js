function countBadges(tickets){
  let green=0, red=0, pending=0, voidCount=0;
  tickets.forEach(t=>{
    const r = ticketResult(t);
    if(r==='green') green++;
    else if(r==='red') red++;
    else if(r==='pending') pending++;
    else if(r==='void') voidCount++;
  });
  let html='';
  if(green) html += `<span class="chip chip-green" style="margin-right:4px">✓ ${green}</span>`;
  if(red) html += `<span class="chip chip-red" style="margin-right:4px">✗ ${red}</span>`;
  if(pending) html += `<span class="chip chip-pending" style="margin-right:4px">⏱ ${pending}</span>`;
  if(voidCount) html += `<span class="chip chip-void" style="margin-right:4px">⊘ ${voidCount}</span>`;
  return html || '—';
}

function renderDashboardTab(){
  const weeks = allWeeksSorted();
  if(weeks.length===0) return '<div class="card"><div class="empty">Cadastre apostas para ver a dashboard.</div></div>';
  if(!DASH_WEEK) DASH_WEEK = weeks[0];

  const rows = STATE.clients.map(cl=>{
    const tickets = STATE.tickets.filter(t=>t.clientId===cl.id && mondayOf(ticketDate(t))===DASH_WEEK);
    if(tickets.length===0) return null;
    const volume = tickets.reduce((s,t)=>s+t.stake,0);
    const resultado = tickets.reduce((s,t)=>s+ticketProfit(t),0);
    const descontoPct = getWeekDiscount(cl, DASH_WEEK);
    const desconto = computeDescontoAmount(cl, resultado, DASH_WEEK);
    const activeCommissioners = getActiveCommissionersForWeek(cl.id, DASH_WEEK);
    const comissao = activeCommissioners.reduce((s,a)=>s+computeCommissionAmount(cl.id, a.percent, DASH_WEEK),0);
    // Parceria: positivo = você paga ao parceiro (cliente perdeu), negativo = parceiro paga a você (cliente ganhou).
    const parceria = getActivePartnersForWeek(cl.id, DASH_WEEK).reduce((s,a)=>s+computePartnerShare(cl.id, a.percent, DASH_WEEK),0);
    const liquido = applyDescontoSign(cl, resultado, desconto) - comissao + parceria;
    const perf = volume>0 ? (resultado/volume*100) : 0;
    return {id:cl.id, name:cl.name, code:cl.code, tickets, volume, resultado, desconto, descontoPct, comissao, parceria, liquido, perf};
  }).filter(Boolean).sort((a,b)=>a.resultado-b.resultado);

  const totalVolume = rows.reduce((s,r)=>s+r.volume,0);
  const totalResultado = rows.reduce((s,r)=>s+r.resultado,0);
  const totalDesconto = rows.reduce((s,r)=>s+r.desconto,0);
  const totalComissao = rows.reduce((s,r)=>s+r.comissao,0);
  const totalParceria = rows.reduce((s,r)=>s+r.parceria,0);
  const totalLiquido = rows.reduce((s,r)=>s+r.liquido,0);
  const allTickets = rows.flatMap(r=>r.tickets);

  const resumoResultado = -totalResultado;
  const resumoLiquido = -totalLiquido;
  const resumoParceria = -totalParceria; // perspectiva sua: negativo = você paga ao parceiro

  // ---- helpers só de apresentação ----
  const MESES = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];
  const fmtDM = ds => `${ds.slice(8,10)}/${ds.slice(5,7)}`;
  const fmtLong = ds => `${ds.slice(8,10)} ${MESES[parseInt(ds.slice(5,7),10)-1]} ${ds.slice(0,4)}`;
  const weekEnd = shiftWeek(DASH_WEEK, 6);
  const weekNum = isoWeekNum(DASH_WEEK);
  // zero fica discreto; negativo vermelho; positivo verde
  const cls = v => Math.abs(v)<0.005 ? 'v-zero' : (v>0 ? 'profit-pos' : 'profit-neg');
  const num = v => fmtNum(Math.abs(v)<0.005 ? 0 : v);
  const ICO_CHART = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>';
  const ICO_USERS = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.3c2 .8 3.5 2.6 3.5 5.7"/></svg>';
  const ICO_CAL = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>';
  const ICO_EXT = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>';
  const ICO_RECEIPT = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/></svg>';
  const ICO_PREV = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 6-6 6 6 6"/></svg>';
  const ICO_NEXT = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>';

  const baseUrl = window.location.href.split('#')[0];
  const resRow = (label, valueHtml, extra) => `<div class="rs-row ${extra||''}"><span class="rs-l">${label}</span><span class="rs-v">${valueHtml}</span></div>`;

  return `
    <div class="dash-top">
      <div class="card dash-week">
        <div class="dash-card-title">${ICO_CAL}<span>Semana</span></div>
        <div class="wk-nav">
          <button class="wk-btn" onclick="changeDashWeek(-1)" aria-label="Semana anterior">${ICO_PREV}</button>
          <div class="wk-mid">
            <span class="wk-kicker">SEMANA</span>
            <span class="wk-num"><small>#</small>${weekNum}</span>
            <span class="wk-range">${fmtLong(DASH_WEEK)} — ${fmtLong(weekEnd)}</span>
          </div>
          <button class="wk-btn" onclick="changeDashWeek(1)" aria-label="Próxima semana">${ICO_NEXT}</button>
        </div>
        <button class="btn-ghost btn-sm wk-today" onclick="DASH_WEEK=mondayOf(todaySP());render()">Ir para a semana atual</button>
      </div>

      <div class="card rs-card">
        <div class="rs-title">${ICO_CHART}<span>Resumo</span></div>
        ${resRow('Apostas', `<b>${allTickets.length}</b> ${countBadges(allTickets)}`)}
        ${resRow('Volume', `<b>${fmtNum(totalVolume)}</b>`)}
        ${resRow('Resultado', `<b class="${cls(resumoResultado)}">${num(resumoResultado)}</b>`)}
        ${resRow('Desconto', `<b class="${totalDesconto>0?'profit-neg':'v-zero'}">${num(-totalDesconto)}</b>`)}
        ${resRow('Comissão', `<b class="${totalComissao>0?'profit-neg':'v-zero'}">${num(-totalComissao)}</b>`)}
        ${Math.abs(totalParceria)>=0.005 ? resRow('Parceria', `<b class="${cls(resumoParceria)}">${num(resumoParceria)}</b>`) : ''}
        ${resRow('Líquido', `<b class="${cls(resumoLiquido)}">${num(resumoLiquido)}</b>`, 'rs-total')}
      </div>
    </div>

    <div class="card tbl-card">
      <div class="tbl-tabs"><div class="tbl-tab">${ICO_USERS}<span>Clientes (${rows.length})</span></div></div>
      ${rows.length===0 ? '<div class="empty">Nenhuma aposta nessa semana.</div>' : `
      <div class="tbl-scroll">
      <table class="dash-table">
        <thead><tr><th>Cliente</th><th>Apostas</th><th>Volume</th><th>Resultado</th><th>Desconto</th><th>Comissão</th><th>Parceria</th><th>Perf.</th><th>Líquido</th></tr></thead>
        <tbody>
        ${rows.map(r=>`
          <tr>
            <td class="left"><div class="cl-cell"><span class="cl-name">${r.name}</span><a class="ic-act" href="${baseUrl}#cliente=${r.code}" target="_blank" title="Abrir relatório do cliente">${ICO_EXT}</a><button class="ic-act" onclick="gerarFechamento('${r.id}')" title="Gerar imagem de fechamento">${ICO_RECEIPT}</button></div></td>
            <td>${countBadges(r.tickets)}</td>
            <td class="num strong">${fmtNum(r.volume)}</td>
            <td class="num ${cls(r.resultado)}">${num(r.resultado)}</td>
            <td class="num">${r.desconto>0 ? `<div class="dsc"><b>${fmtNum(r.desconto)}</b><small>${r.descontoPct||0}%</small></div>` : '<span class="v-zero">0,00</span>'}</td>
            <td class="num">${r.comissao>0 ? `<b class="cm">${fmtNum(r.comissao)}</b>` : '<span class="v-zero">0,00</span>'}</td>
            <td class="num ${Math.abs(r.parceria)>=0.005?(r.parceria>0?'profit-neg':'profit-pos'):'v-zero'}">${num(-r.parceria)}</td>
            <td class="num perf">${fmtNum(r.perf)}%</td>
            <td class="num ${cls(r.liquido)}">${num(r.liquido)}</td>
          </tr>
        `).join('')}
        <tr class="total">
          <td class="left">Total</td>
          <td>${countBadges(allTickets)}</td>
          <td class="num strong">${fmtNum(totalVolume)}</td>
          <td class="num ${cls(totalResultado)}">${num(totalResultado)}</td>
          <td class="num">${totalDesconto>0 ? fmtNum(totalDesconto) : '<span class="v-zero">0,00</span>'}</td>
          <td class="num">${totalComissao>0 ? `<b class="cm">${fmtNum(totalComissao)}</b>` : '<span class="v-zero">0,00</span>'}</td>
          <td class="num ${Math.abs(totalParceria)>=0.005?(totalParceria>0?'profit-neg':'profit-pos'):'v-zero'}">${num(-totalParceria)}</td>
          <td class="num perf">${fmtNum(totalVolume>0 ? (totalResultado/totalVolume)*100 : 0)}%</td>
          <td class="num ${cls(totalLiquido)}">${num(totalLiquido)}</td>
        </tr>
        </tbody>
      </table>
      </div>
      `}
    </div>
  `;
}

// Número da semana ISO (só para exibir "#42" no seletor de semana).
function isoWeekNum(ds){
  const d = new Date(ds+'T00:00:00Z');
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate()+4-day);
  const y0 = new Date(Date.UTC(d.getUTCFullYear(),0,1));
  return Math.ceil(((d-y0)/864e5+1)/7);
}

// ---------- FINANCEIRO ----------
