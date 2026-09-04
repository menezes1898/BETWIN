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
    const liquido = applyDescontoSign(cl, resultado, desconto) - comissao;
    const perf = volume>0 ? (resultado/volume*100) : 0;
    return {id:cl.id, name:cl.name, code:cl.code, tickets, volume, resultado, desconto, comissao, liquido, perf};
  }).filter(Boolean).sort((a,b)=>a.resultado-b.resultado);

  const totalVolume = rows.reduce((s,r)=>s+r.volume,0);
  const totalResultado = rows.reduce((s,r)=>s+r.resultado,0);
  const totalDesconto = rows.reduce((s,r)=>s+r.desconto,0);
  const totalComissao = rows.reduce((s,r)=>s+r.comissao,0);
  const totalLiquido = rows.reduce((s,r)=>s+r.liquido,0);
  const allTickets = rows.flatMap(r=>r.tickets);

  const resumoResultado = -totalResultado;
  const resumoLiquido = -totalLiquido;

  return `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
        <h3 style="margin:0">Resumo geral</h3>
        <div style="display:flex;align-items:center;gap:14px">
          <button class="btn-ghost btn-sm" onclick="changeDashWeek(-1)">‹</button>
          <span style="font-family:var(--font-mono);font-size:13px;font-weight:600">${weekLabel(DASH_WEEK)}</span>
          <button class="btn-ghost btn-sm" onclick="changeDashWeek(1)">›</button>
        </div>
      </div>
      <div class="row" style="gap:22px">
        <div><div style="font-size:11px;color:var(--text-muted);text-transform:uppercase">Apostas</div><div style="font-family:var(--font-mono);font-size:17px;margin-top:4px">${allTickets.length} ${countBadges(allTickets)}</div></div>
        <div><div style="font-size:11px;color:var(--text-muted);text-transform:uppercase">Volume</div><div style="font-family:var(--font-mono);font-size:17px;margin-top:4px">${fmtBRL(totalVolume)}</div></div>
        <div><div style="font-size:11px;color:var(--text-muted);text-transform:uppercase">Resultado</div><div style="font-family:var(--font-mono);font-size:17px;margin-top:4px" class="${resumoResultado>=0?'profit-pos':'profit-neg'}">${fmtBRL(resumoResultado)}</div></div>
        <div><div style="font-size:11px;color:var(--text-muted);text-transform:uppercase">Desconto</div><div style="font-family:var(--font-mono);font-size:17px;margin-top:4px">${fmtBRL(totalDesconto)}</div></div>
        <div><div style="font-size:11px;color:var(--text-muted);text-transform:uppercase">Comissão</div><div style="font-family:var(--font-mono);font-size:17px;margin-top:4px;color:var(--gold)">${fmtBRL(totalComissao)}</div></div>
        <div><div style="font-size:11px;color:var(--text-muted);text-transform:uppercase">Líquido</div><div style="font-family:var(--font-mono);font-size:17px;margin-top:4px" class="${resumoLiquido>=0?'profit-pos':'profit-neg'}">${fmtBRL(resumoLiquido)}</div></div>
      </div>
    </div>
    <div class="card">
      <h3>Por cliente</h3>
      ${rows.length===0 ? '<div class="empty">Nenhuma aposta nessa semana.</div>' : `
      <div style="overflow-x:auto">
      <table>
        <tr><th>Cliente</th><th>Apostas</th><th>Volume</th><th>Resultado</th><th>Desconto</th><th>Comissão</th><th>Perf.</th><th>Líquido</th></tr>
        ${rows.map(r=>`
          <tr>
            <td class="left">${r.name} <a href="${window.location.href.split('#')[0]}#cliente=${r.code}" target="_blank" title="Abrir relatório do cliente" style="text-decoration:none;color:var(--gold);font-size:12px">↗</a> <button class="btn-ghost btn-sm" style="padding:2px 6px;font-size:10px" onclick="gerarFechamento('${r.id}')" title="Gerar imagem de fechamento">🧾</button></td>
            <td>${countBadges(r.tickets)}</td>
            <td class="num">${fmtBRL(r.volume)}</td>
            <td class="num ${r.resultado>=0?'profit-pos':'profit-neg'}">${fmtBRL(r.resultado)}</td>
            <td class="num">${r.desconto>0 ? fmtBRL(r.desconto) : '—'}</td>
            <td class="num" style="${r.comissao>0?'color:var(--gold)':''}">${r.comissao>0 ? fmtBRL(r.comissao) : '—'}</td>
            <td class="num">${r.perf.toFixed(1)}%</td>
            <td class="num ${r.liquido>=0?'profit-pos':'profit-neg'}">${fmtBRL(r.liquido)}</td>
          </tr>
        `).join('')}
        <tr class="total">
          <td class="left">Total</td>
          <td>${countBadges(allTickets)}</td>
          <td class="num">${fmtBRL(totalVolume)}</td>
          <td class="num ${totalResultado>=0?'profit-pos':'profit-neg'}">${fmtBRL(totalResultado)}</td>
          <td class="num">${totalDesconto>0 ? fmtBRL(totalDesconto) : '—'}</td>
          <td class="num" style="${totalComissao>0?'color:var(--gold)':''}">${totalComissao>0 ? fmtBRL(totalComissao) : '—'}</td>
          <td class="num">${totalVolume>0 ? ((totalResultado/totalVolume)*100).toFixed(1) : '0.0'}%</td>
          <td class="num ${totalLiquido>=0?'profit-pos':'profit-neg'}">${fmtBRL(totalLiquido)}</td>
        </tr>
      </table>
      </div>
      `}
    </div>
  `;
}

// ---------- FINANCEIRO ----------
