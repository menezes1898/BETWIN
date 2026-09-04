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
        <div style="display:flex;align-items:baseline;gap:5px">
          <span style="flex-shrink:0;font-size:9.5px;line-height:1.5">${resultIconSmall(m.result)}</span>
          <span style="min-width:0;overflow-wrap:break-word;font-size:12.5px;line-height:1.4">
            <strong style="font-weight:600">${teamsLabel}</strong>
            <span style="color:var(--text-muted)"> — ${marketLabel}: ${m.selection}</span>
          </span>
        </div>
      `;
    }).join('');
  }
  // Sombreado discreto por resultado — pendente não recebe nenhuma cor, fica neutro.
  function ticketRowStyle(r){
    if(r==='green') return {bg:'rgba(63,182,139,0.06)', border:'var(--green)'};
    if(r==='red') return {bg:'rgba(224,87,90,0.05)', border:'var(--red)'};
    if(r==='void') return {bg:'rgba(255,255,255,0.02)', border:'var(--line)'};
    return {bg:'var(--surface-2)', border:'var(--line)'};
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
      const style = ticketRowStyle(r);
      return `
        <div style="background:${style.bg};border-left:3px solid ${style.border};border-radius:6px;padding:8px 10px;margin-bottom:6px">
          <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin-bottom:4px">
            <span style="font-family:var(--font-mono);font-size:10.5px;color:var(--text-muted);white-space:nowrap">${t.time||'—'} <span style="opacity:0.65">#${t.ticketNumber||'—'}</span></span>
            <span style="font-family:var(--font-mono);font-size:13.5px;font-weight:700;white-space:nowrap" class="${r==='pending'?'':(profit>=0?'profit-pos':'profit-neg')}">${r==='pending'?'—':fmtBRL(profit)}</span>
          </div>
          <div>${ticketMatchesBlock(t)}</div>
          <div style="font-size:10.5px;color:var(--text-muted);margin-top:4px;font-family:var(--font-mono)">Valor ${fmtBRL(t.stake)}${ticketOddTotal(t)>0?' · Odds @'+effectiveOdds(t).toFixed(2):''}</div>
        </div>
      `;
    }).join('');
    return `<div style="margin-bottom:14px"><p style="margin:0 0 6px;font-size:13px;font-weight:500;color:var(--text-muted)">${fmtDate(day)}</p>${rows}</div>`;
  }).join('');

  document.title = 'Relatório';
  app.innerHTML = `
    <div class="client-theme client-page-wrap" style="--gold:#3EC1F3; --gold-dim:#1B5E86; --bg:#070B14; --surface:#10141F; --surface-2:#151B29; --line:#222B3E; --text:#F5F7FA; --text-muted:#B8BEC7; background:var(--bg);">
    <div class="client-header"><div class="name" style="color:var(--text)">${client.name}</div></div>

    <div class="card">
      <div style="display:flex;justify-content:center;align-items:center;gap:16px">
        <button class="btn-ghost" style="padding:8px 14px;font-size:14px" onclick="changeClientWeek(-1)">‹</button>
        <span style="font-family:'Montserrat',sans-serif;font-size:14px;font-weight:600;letter-spacing:0.2px">${weekLabel(CLIENT_WEEK)}</span>
        <button class="btn-ghost" style="padding:8px 14px;font-size:14px" onclick="changeClientWeek(1)">›</button>
      </div>
    </div>

    <div class="card" style="display:flex;padding:0">
      <div style="flex:1;text-align:center;padding:0.9rem 0.5rem">
        <div style="font-family:'Montserrat',sans-serif;font-size:10.5px;color:var(--text-muted);text-transform:uppercase;font-weight:600;letter-spacing:0.4px">Resultado</div>
        <div style="font-family:var(--font-mono);font-size:18px;font-weight:700;margin-top:5px" class="${resultado>=0?'profit-pos':'profit-neg'}">${fmtBRL(resultado)}</div>
      </div>
      ${resultado<0 ? `
      <div style="width:1px;background:var(--line)"></div>
      <div style="flex:1;text-align:center;padding:0.9rem 0.5rem">
        <div style="font-family:'Montserrat',sans-serif;font-size:10.5px;color:var(--text-muted);text-transform:uppercase;font-weight:600;letter-spacing:0.4px">Desconto</div>
        <div style="font-family:var(--font-mono);font-size:18px;font-weight:700;margin-top:5px">${fmtBRL(desconto)}</div>
      </div>
      <div style="width:1px;background:var(--line)"></div>
      <div style="flex:1;text-align:center;padding:0.9rem 0.5rem">
        <div style="font-family:'Montserrat',sans-serif;font-size:10.5px;color:var(--text-muted);text-transform:uppercase;font-weight:600;letter-spacing:0.4px">Resultado Final</div>
        <div style="font-family:var(--font-mono);font-size:18px;font-weight:700;margin-top:5px" class="${liquido>=0?'profit-pos':'profit-neg'}">${fmtBRL(liquido)}</div>
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
                <span class="meta">${fmtDate(t.date)}${t.time?' '+t.time:''} · ${ticketDetailsShort(t)}</span>
              </div>
              <span style="font-family:var(--font-mono);font-size:12.5px">${fmtBRL(t.stake)}</span>
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>
    ` : ''}

    <div class="card">
      <h3 style="text-align:center;font-size:16px">Apostas da semana</h3>
      ${ticketRows || '<div class="empty">Nenhuma aposta nessa semana.</div>'}
    </div>
    </div>
  `;
}

// ---------- COMMISSIONER VIEW ----------
