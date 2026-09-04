function changeCommissionerWeek(dir){
  COMMISSIONER_WEEK = shiftWeek(COMMISSIONER_WEEK, dir*7);
  render();
}
function renderCommissionerView(code){
  const app = document.getElementById('app');
  const cm = STATE.commissioners.find(c=>c.code===code);
  if(!cm){
    app.innerHTML = `<div class="client-theme client-page-wrap" style="--gold:#3EC1F3; background:#070B14;"><div class="empty">Link inválido ou comissionado não encontrado.</div></div>`;
    return;
  }
  if(COMMISSIONER_WEEK===null){
    COMMISSIONER_WEEK = mondayOf(todaySP());
  }

  const rows = STATE.clients.map(cl=>{
    const active = getActiveCommissionersForWeek(cl.id, COMMISSIONER_WEEK).find(a=>a.commissionerId===cm.id);
    if(!active) return null;
    const tickets = STATE.tickets.filter(t=>t.clientId===cl.id && mondayOf(ticketDate(t))===COMMISSIONER_WEEK && ticketResult(t)!=='pending' && ticketResult(t)!=='void');
    if(tickets.length===0) return null;
    const volume = tickets.reduce((s,t)=>s+t.stake,0);
    const resultado = tickets.reduce((s,t)=>s+ticketProfit(t),0);
    const comissao = computeCommissionAmount(cl.id, active.percent, COMMISSIONER_WEEK);
    return {name: cl.name, volume, resultado, percent: active.percent, comissao};
  }).filter(Boolean);

  const totalComissao = rows.reduce((s,r)=>s+r.comissao,0);

  document.title = 'Relatório';
  app.innerHTML = `
    <div class="client-theme client-page-wrap" style="--gold:#3EC1F3; --gold-dim:#1B5E86; --bg:#070B14; --surface:#10141F; --surface-2:#151B29; --line:#222B3E; --text:#F5F7FA; --text-muted:#B8BEC7; background:var(--bg);">
    <div class="client-header"><div class="name" style="color:var(--text)">${cm.name}</div></div>

    <div class="card">
      <div style="display:flex;justify-content:center;align-items:center;gap:16px">
        <button class="btn-ghost" style="padding:10px 16px;font-size:16px" onclick="changeCommissionerWeek(-1)">‹</button>
        <span style="font-family:'Montserrat',sans-serif;font-size:clamp(15px,4.5vw,17px);font-weight:700">${weekLabel(COMMISSIONER_WEEK)}</span>
        <button class="btn-ghost" style="padding:10px 16px;font-size:16px" onclick="changeCommissionerWeek(1)">›</button>
      </div>
    </div>

    <div class="card" style="text-align:center;padding:1.1rem 0.5rem">
      <div style="font-family:'Montserrat',sans-serif;font-size:12px;color:var(--text-muted);text-transform:uppercase;font-weight:600">Sua comissão da semana</div>
      <div style="font-family:'Montserrat',sans-serif;font-size:clamp(22px,7vw,28px);font-weight:700;margin-top:3px" class="${totalComissao>=0?'profit-pos':'profit-neg'}">${fmtBRL(totalComissao)}</div>
    </div>

    <div class="card">
      <h3>Seus indicados</h3>
      ${rows.length===0 ? '<div class="empty">Nenhum indicado com apostas nessa semana.</div>' : rows.map(r=>`
        <div class="match-row" style="flex-wrap:nowrap;gap:10px">
          <div class="match-desc" style="flex:1;min-width:0;overflow:hidden">
            <span class="teams" style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.name}</span>
            <span class="meta" style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">Volume ${fmtBRL(r.volume)} · resultado <span class="${r.resultado>=0?'profit-pos':'profit-neg'}">${fmtBRL(r.resultado)}</span> · ${r.percent}% de comissão</span>
          </div>
          <span style="font-family:var(--font-mono);font-size:15px;font-weight:700;flex-shrink:0;color:var(--gold)">${fmtBRL(r.comissao)}</span>
        </div>
      `).join('')}
    </div>
    </div>
  `;
}

