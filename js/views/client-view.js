function shiftWeek(dateStr, days){
  const d = new Date(dateStr+'T00:00:00');
  d.setDate(d.getDate()+days);
  return d.toISOString().slice(0,10);
}
function changeClientWeek(dir){
  CLIENT_WEEK = shiftWeek(CLIENT_WEEK, dir*7);
  render();
}

function renderClientView(code){
  const app = document.getElementById('app');
  const client = STATE.clients.find(c=>c.code===code);
  if(!client){
    app.innerHTML = `<div class="client-theme client-page-wrap" style="--gold:#3EC1F3; background:#070B14;"><div class="empty">Link inválido ou cliente não encontrado.</div></div>`;
    return;
  }
  const myTickets = STATE.tickets.filter(t=>t.clientId===client.id);

  if(CLIENT_WEEK===null){
    const todaySPStr = todaySP();
    const currentWeekMonday = mondayOf(todaySPStr);
    const hasPendingThisWeek = myTickets.some(t=>mondayOf(ticketDate(t))===currentWeekMonday && ticketResult(t)==='pending');
    if(hasPendingThisWeek){
      CLIENT_WEEK = currentWeekMonday;
    } else {
      const weeksWithData = Array.from(new Set(myTickets.map(t=>mondayOf(ticketDate(t))))).sort();
      CLIENT_WEEK = weeksWithData.length ? weeksWithData[weeksWithData.length-1] : currentWeekMonday;
    }
  }

  const weekTickets = myTickets.filter(t=>mondayOf(ticketDate(t))===CLIENT_WEEK).sort((a,b)=>ticketDate(b).localeCompare(ticketDate(a)));
  const resultado = weekTickets.reduce((s,t)=>s+ticketProfit(t),0);
  const descontoPct = getWeekDiscount(client, CLIENT_WEEK);
  const desconto = computeDescontoAmount(client, resultado, CLIENT_WEEK);
  const liquido = applyDescontoSign(client, resultado, desconto);
  const pendentes = weekTickets.filter(t=>ticketResult(t)==='pending');
  const pendentesValor = pendentes.reduce((s,t)=>s+t.stake,0);

  function ticketMatchesBlock(t){
    return t.matches.map(m=>{
      const marketLabel = MARKETS.find(x=>x.v===m.market)?.l || m.market;
      const teamsLabel = m.away ? `${m.home} x ${m.away}` : m.home;
      return `
        <div class="bet-detail-line">
          <span class="dl-ic">${resultIconSmall(m.result)}</span>
          <span class="dl-txt"><b>${teamsLabel}</b> — ${marketLabel}: ${m.selection}</span>
        </div>
      `;
    }).join('');
  }
  const dayGroups = {};
  weekTickets.forEach(t=>{
    if(!dayGroups[t.date]) dayGroups[t.date] = [];
    dayGroups[t.date].push(t);
  });
  const dayKeys = Object.keys(dayGroups).sort((a,b)=>b.localeCompare(a));
  dayKeys.forEach(k=> dayGroups[k].sort((a,b)=>(b.time||'').localeCompare(a.time||'')));

  const ticketRows = dayKeys.map(day=>{
    const rows = dayGroups[day].map(t=>{
      const r = ticketResult(t);
      const profit = ticketProfit(t);
      return `
        <div class="bet-row">
          <div class="col-date">${t.time||'—'}<span class="ticket-num">#${t.ticketNumber||'—'}</span></div>
          <div class="col-value">${fmtBRL(t.stake)}</div>
          <div class="col-odds">${ticketOddTotal(t)>0?effectiveOdds(t).toFixed(2):'—'}</div>
          <div class="col-details">${ticketMatchesBlock(t)}</div>
          <div class="col-result ${r==='pending'?'':(profit>=0?'profit-pos':'profit-neg')}">${r==='pending'?'—':fmtBRL(profit)}</div>
        </div>
      `;
    }).join('');
    return `<div class="bet-day-label">${fmtDate(day)}</div>${rows}`;
  }).join('');

  const totalResultadoSemana = weekTickets.reduce((s,t)=>s+ticketProfit(t),0);

  document.title = 'Relatório';
  app.innerHTML = `
    <div class="client-theme client-page-wrap" style="--gold:#3EC1F3; --gold-dim:#1B5E86; --bg:#070B14; --surface:#10141F; --surface-2:#151B29; --line:#222B3E; --text:#F5F7FA; --text-muted:#B8BEC7; background:var(--bg);">
    <div class="client-header"><div class="name">${client.name}</div></div>

    <div class="card client-week-card">
      <div class="client-week-nav">
        <button class="client-week-btn" onclick="changeClientWeek(-1)">‹</button>
        <span class="client-week-label">${weekLabel(CLIENT_WEEK)}</span>
        <button class="client-week-btn" onclick="changeClientWeek(1)">›</button>
      </div>
    </div>

    <div class="card client-result-card">
      <div class="client-result-hero">
        <div class="r-label">Resultado Final</div>
        <div class="r-value ${liquido>=0?'profit-pos':'profit-neg'}">${fmtBRL(liquido)}</div>
      </div>
      ${resultado<0 ? `
      <div class="client-result-sub">
        <div class="stat">
          <div class="s-label">Resultado</div>
          <div class="s-value ${resultado>=0?'profit-pos':'profit-neg'}">${fmtBRL(resultado)}</div>
        </div>
        <div class="s-divider"></div>
        <div class="stat">
          <div class="s-label">Desconto</div>
          <div class="s-value">${fmtBRL(desconto)}</div>
        </div>
      </div>
      ` : ''}
    </div>

    ${pendentes.length>0 ? `
    <div class="card" style="cursor:pointer" onclick="CLIENT_SHOW_PENDENTES=!CLIENT_SHOW_PENDENTES;render()">
      <div style="display:flex;justify-content:center;align-items:center;gap:10px;position:relative">
        <span class="chip chip-pending">PENDENTES (${pendentes.length})</span>
        <span style="font-family:var(--font-mono);font-size:13px;color:var(--gold);font-weight:600">${fmtBRL(pendentesValor)}</span>
        <span style="color:var(--text-muted);font-size:13px;transition:transform 0.15s;display:inline-block;transform:rotate(${CLIENT_SHOW_PENDENTES?90:0}deg)">›</span>
      </div>
      ${CLIENT_SHOW_PENDENTES ? `
        <div style="margin-top:12px;border-top:1px solid var(--line)">
          ${pendentes.map(t=>`
            <div class="match-row">
              <div class="match-desc">
                <span class="meta">${fmtDate(t.date)}${t.time?' '+t.time:''} · <span style="text-transform:uppercase">${ticketDetailsShort(t)}</span></span>
              </div>
              <span style="font-family:var(--font-mono);font-size:12.5px">${fmtBRL(t.stake)}</span>
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>
    ` : ''}

    <div class="card">
      <div class="client-list-summary">
        <span class="count-badge">Apostas (${weekTickets.length})</span>
        <span class="amount-badge ${totalResultadoSemana>=0?'profit-pos':'profit-neg'}">${fmtBRL(totalResultadoSemana)}</span>
      </div>
      ${weekTickets.length ? `
        <div class="bet-table-head">
          <span class="col-date">Data</span>
          <span class="col-value">Valor</span>
          <span class="col-odds">Odds</span>
          <span class="col-details">Detalhes</span>
          <span class="col-result">Resultado</span>
        </div>
      ` : ''}
      ${ticketRows || '<div class="empty">Nenhuma aposta nessa semana.</div>'}
    </div>
    </div>
  `;
}

// ---------- COMMISSIONER VIEW ----------
