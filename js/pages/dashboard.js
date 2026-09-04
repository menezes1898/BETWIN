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

// Visão executiva: números do NEGÓCIO como um todo (não presos à semana selecionada),
// reaproveitando os mesmos cálculos já usados no Financeiro — sem duplicar lógica.
function computeExecutiveStats(){
  const caixaAtual = caixaTotalCalc();
  let aReceber = 0, aPagar = 0, clientesDevedores = 0;
  STATE.clients.forEach(cl=>{
    const bal = computeContinuousBalance(cl.id); // positivo = cliente deve pra você
    if(bal > 0.01){ aReceber += bal; clientesDevedores++; }
    else if(bal < -0.01){ aPagar += Math.abs(bal); }
  });
  const clientesAtivos = new Set(STATE.tickets.map(t=>t.clientId)).size;
  const pendentes = STATE.tickets.filter(t=>ticketResult(t)==='pending');
  const pendenciasValor = pendentes.reduce((s,t)=>s+t.stake,0);
  return { caixaAtual, aReceber, aPagar, clientesAtivos, clientesDevedores, pendenciasCount: pendentes.length, pendenciasValor };
}

function execCard(label, value, colorClass){
  return `
    <div class="card" style="margin-bottom:0;padding:16px">
      <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.4px;font-weight:600">${label}</div>
      <div style="font-family:var(--font-mono);font-size:19px;font-weight:700;margin-top:7px" class="${colorClass||''}">${value}</div>
    </div>
  `;
}

function renderExecutiveCards(){
  const s = computeExecutiveStats();
  return `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:16px">
      ${execCard('Caixa Atual', fmtBRL(s.caixaAtual), s.caixaAtual>=0?'profit-pos':'profit-neg')}
      ${execCard('A Receber', fmtBRL(s.aReceber), 'profit-pos')}
      ${execCard('A Pagar', fmtBRL(s.aPagar), 'profit-neg')}
      ${execCard('Clientes Ativos', s.clientesAtivos)}
      ${execCard('Clientes Devedores', s.clientesDevedores, s.clientesDevedores>0?'profit-neg':'')}
      ${execCard('Pendências', s.pendenciasCount+' <span style="font-size:12px;color:var(--text-muted)">('+fmtBRL(s.pendenciasValor)+')</span>')}
    </div>
  `;
}

// Gráfico simples (barras em CSS, sem dependência externa) do resultado bruto por dia,
// dentro da semana selecionada na Dashboard — perspectiva admin (positivo = você lucrou no dia).
function renderDailyChart(weekMonday){
  const dayNames = ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'];
  const days = [];
  for(let i=0;i<7;i++){
    const d = shiftWeek(weekMonday, i);
    const tks = STATE.tickets.filter(t=>ticketDate(t)===d && ticketResult(t)!=='void');
    const resultadoDia = -tks.reduce((s,t)=>s+ticketProfit(t),0); // perspectiva admin
    days.push({label: dayNames[i], date: d, valor: resultadoDia});
  }
  const maxAbs = Math.max(1, ...days.map(d=>Math.abs(d.valor)));
  return `
    <div class="card">
      <h3>Resultado por dia (essa semana)</h3>
      <div style="display:flex;align-items:flex-end;gap:8px;height:130px;padding:0 4px">
        ${days.map(d=>{
          const heightPct = Math.max(3, (Math.abs(d.valor)/maxAbs)*100);
          const color = d.valor>=0 ? 'var(--green)' : 'var(--red)';
          return `
            <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%">
              <div style="font-family:var(--font-mono);font-size:9.5px;color:var(--text-muted);margin-bottom:4px;white-space:nowrap">${d.valor!==0?fmtBRL(d.valor).replace('R$','').trim():''}</div>
              <div style="width:100%;max-width:36px;height:${heightPct}%;background:${color};border-radius:4px 4px 0 0;opacity:0.85;min-height:3px"></div>
              <div style="font-size:10.5px;color:var(--text-muted);margin-top:6px;font-weight:600">${d.label}</div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

// Rankings do período selecionado na Dashboard + pendências (essas, contínuas, fora da semana).
function renderRankings(rows){
  const lucrativos = [...rows].sort((a,b)=>a.resultado-b.resultado).slice(0,5); // admin lucra mais = resultado do cliente mais negativo
  const negativos = [...rows].filter(r=>r.resultado>0).sort((a,b)=>b.resultado-a.resultado).slice(0,5);
  const volumes = [...rows].sort((a,b)=>b.volume-a.volume).slice(0,5);
  const pendencias = STATE.clients.map(cl=>({name:cl.name, saldo: computeContinuousBalance(cl.id)}))
    .filter(x=>x.saldo>0.01).sort((a,b)=>b.saldo-a.saldo).slice(0,5);

  function rankBlock(title, list, getLabel, getValue, colorClass){
    return `
      <div>
        <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.4px;font-weight:600;margin-bottom:8px">${title}</div>
        ${list.length===0 ? '<div class="empty" style="padding:8px 0">Nenhum</div>' : list.map(item=>`
          <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--line-soft);font-size:12.5px">
            <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding-right:8px">${getLabel(item)}</span>
            <span style="font-family:var(--font-mono);font-weight:700;white-space:nowrap" class="${colorClass}">${getValue(item)}</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  return `
    <div class="card">
      <h3>Rankings</h3>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:20px">
        ${rankBlock('Top clientes lucrativos (essa semana)', lucrativos, r=>r.name, r=>fmtBRL(-r.resultado), 'profit-pos')}
        ${rankBlock('Top clientes negativos (essa semana)', negativos, r=>r.name, r=>fmtBRL(-r.resultado), 'profit-neg')}
        ${rankBlock('Maiores volumes (essa semana)', volumes, r=>r.name, r=>fmtBRL(r.volume), '')}
        ${rankBlock('Maiores pendências (saldo total)', pendencias, p=>p.name, p=>fmtBRL(p.saldo), 'profit-neg')}
      </div>
    </div>
  `;
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
    ${renderExecutiveCards()}
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
    ${renderDailyChart(DASH_WEEK)}
    ${renderRankings(rows)}
    <div class="card">
      <h3>Por cliente</h3>
      ${rows.length===0 ? '<div class="empty">Nenhuma aposta nessa semana.</div>' : `
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
      `}
    </div>
  `;
}

// ---------- FINANCEIRO ----------
