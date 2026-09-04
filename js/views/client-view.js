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
  const temAuxiliares = desconto>0; // só mostra Resultado/Desconto quando existe desconto de fato (funciona certo pra cliente normal E pra conta de Descarga, cuja lógica de desconto é invertida)

  // ---- linha de cada partida dentro de um bilhete (preserva ícone + mercado + seleção de cada perna) ----
  function matchLine(m){
    const marketLabel = MARKETS.find(x=>x.v===m.market)?.l || m.market;
    const teamsLabel = m.away ? `${m.home} x ${m.away}` : m.home;
    return `
      <div style="display:flex;gap:6px;align-items:baseline;line-height:1.45">
        <span style="font-size:9px;flex-shrink:0;position:relative;top:-1px">${resultIconSmall(m.result)}</span>
        <span style="font-size:13px;min-width:0"><span style="font-weight:600;color:var(--text)">${teamsLabel}</span><span style="color:var(--text-muted)"> — ${marketLabel}: ${m.selection}</span></span>
      </div>
    `;
  }
  // ---- uma linha do extrato = um bilhete inteiro (pode ter várias partidas dentro) ----
  function ledgerRow(t){
    const r = ticketResult(t);
    const profit = ticketProfit(t);
    const dotColor = r==='green' ? 'var(--green)' : r==='red' ? 'var(--red)' : r==='void' ? 'var(--text-muted)' : 'var(--gold)';
    return `
      <div class="ledger-row">
        <div style="display:flex;align-items:flex-start;gap:10px;padding:12px 6px">
          <span style="width:7px;height:7px;border-radius:50%;background:${dotColor};margin-top:7px;flex-shrink:0"></span>
          <div style="flex:1;min-width:0">
            ${t.matches.map(matchLine).join('')}
            <div style="font-family:var(--font-mono);font-size:10.5px;color:var(--text-muted);margin-top:5px">${t.time||'—'} · #${t.ticketNumber||'—'} · ${fmtBRL(t.stake)}${ticketOddTotal(t)>0?' · @'+effectiveOdds(t).toFixed(2):''}</div>
          </div>
          <div style="text-align:right;flex-shrink:0;padding-left:4px">
            <div style="font-family:var(--font-mono);font-size:14.5px;font-weight:700;white-space:nowrap" class="${r==='pending'?'':(profit>=0?'profit-pos':'profit-neg')}">${r==='pending'?'—':fmtBRL(profit)}</div>
          </div>
        </div>
      </div>
    `;
  }
  // ---- agrupamento por dia: rótulo discreto + linha fina, sem virar uma nova "caixa" ----
  const dayGroups = {};
  weekTickets.forEach(t=>{
    if(!dayGroups[t.date]) dayGroups[t.date] = [];
    dayGroups[t.date].push(t);
  });
  const dayKeys = Object.keys(dayGroups).sort((a,b)=>b.localeCompare(a));
  dayKeys.forEach(k=> dayGroups[k].sort((a,b)=>(b.time||'').localeCompare(a.time||'')));

  const ledgerContent = dayKeys.map(day=>`
    <div style="display:flex;align-items:center;gap:10px;margin:24px 0 4px">
      <span style="font-family:var(--font-mono);font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.6px;white-space:nowrap">${fmtDate(day)}</span>
      <div style="flex:1;height:1px;background:var(--line-soft)"></div>
    </div>
    ${dayGroups[day].map(ledgerRow).join('')}
  `).join('');

  document.title = 'Relatório';
  app.innerHTML = `
    <div class="client-theme client-page-wrap" style="--gold:#3EC1F3; --gold-dim:#1B5E86; --bg:#070B14; --surface:#10141F; --surface-2:#151B29; --surface-3:#1E2433; --line:#222B3E; --line-soft:#1B2130; --text:#F5F7FA; --text-muted:#8D97AC; --green:#34D399; --red:#F26D6D; background:var(--bg); max-width:640px; margin-left:auto; margin-right:auto;">

    <div style="text-align:center;margin-bottom:4px">
      <div style="font-family:var(--font-mono);font-size:10px;letter-spacing:1.6px;color:var(--text-muted);text-transform:uppercase;margin-bottom:8px">Relatório</div>
      <div style="font-family:'Montserrat',sans-serif;font-size:clamp(23px,6vw,28px);font-weight:600;color:var(--text);letter-spacing:0.1px">${client.name}</div>
    </div>

    <div style="display:flex;justify-content:center;margin:20px 0 32px">
      <div style="display:inline-flex;align-items:center;gap:2px;background:var(--surface);border:1px solid var(--line);border-radius:999px;padding:4px 6px">
        <button class="ledger-nav-btn" onclick="changeClientWeek(-1)">‹</button>
        <span style="font-family:var(--font-mono);font-size:12.5px;font-weight:600;color:var(--text);padding:0 10px;white-space:nowrap">${weekLabel(CLIENT_WEEK)}</span>
        <button class="ledger-nav-btn" onclick="changeClientWeek(1)">›</button>
      </div>
    </div>

    <div style="text-align:center;padding:4px 0 8px">
      <div style="font-family:var(--font-mono);font-size:10.5px;letter-spacing:1.2px;color:var(--text-muted);text-transform:uppercase;margin-bottom:12px">Resultado Final</div>
      <div style="font-family:var(--font-mono);font-weight:700;font-size:clamp(34px,10vw,50px);line-height:1;letter-spacing:-0.5px" class="${liquido>=0?'profit-pos':'profit-neg'}">${fmtBRL(liquido)}</div>
      ${temAuxiliares ? `
      <div style="display:inline-flex;align-items:center;gap:24px;margin-top:20px;padding-top:16px;border-top:1px solid var(--line-soft)">
        <div style="text-align:center">
          <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Resultado</div>
          <div style="font-family:var(--font-mono);font-size:14px;font-weight:600" class="${resultado>=0?'profit-pos':'profit-neg'}">${fmtBRL(resultado)}</div>
        </div>
        <div style="width:1px;height:22px;background:var(--line)"></div>
        <div style="text-align:center">
          <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Desconto</div>
          <div style="font-family:var(--font-mono);font-size:14px;font-weight:600;color:var(--gold)">${fmtBRL(desconto)}</div>
        </div>
      </div>
      ` : ''}
    </div>

    ${pendentes.length>0 ? `
    <div class="ledger-disclosure" style="padding:14px 16px;margin-top:28px" onclick="CLIENT_SHOW_PENDENTES=!CLIENT_SHOW_PENDENTES;render()">
      <div style="display:flex;justify-content:center;align-items:center;gap:10px">
        <span class="chip chip-pending">PENDENTES (${pendentes.length})</span>
        <span style="font-family:var(--font-mono);font-size:13px;color:var(--gold);font-weight:600">${fmtBRL(pendentesValor)}</span>
        <span style="color:var(--text-muted);font-size:12px;transition:transform .15s;display:inline-block;transform:rotate(${CLIENT_SHOW_PENDENTES?90:0}deg)">›</span>
      </div>
      ${CLIENT_SHOW_PENDENTES ? `
        <div style="margin-top:10px">
          ${pendentes.map(t=>`
            <div style="display:flex;justify-content:space-between;gap:10px;padding:8px 0;border-top:1px solid var(--line-soft);font-size:12.5px">
              <span style="color:var(--text-muted)">${fmtDate(t.date)}${t.time?' '+t.time:''} · ${ticketDetailsShort(t)}</span>
              <span style="font-family:var(--font-mono);flex-shrink:0">${fmtBRL(t.stake)}</span>
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>
    ` : ''}

    <div style="margin-top:32px">
      <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.6px;font-weight:600;text-align:center;margin-bottom:4px">Apostas da semana</div>
      ${ledgerContent || '<div class="empty">Nenhuma aposta nessa semana.</div>'}
    </div>
    </div>
  `;
}

// ---------- COMMISSIONER VIEW ----------
