function shiftWeek(dateStr, days){
  const d = new Date(dateStr+'T00:00:00');
  d.setDate(d.getDate()+days);
  return d.toISOString().slice(0,10);
}
function changeClientWeek(dir){
  CLIENT_WEEK = shiftWeek(CLIENT_WEEK, dir*7);
  render();
}
// Botão de atualizar (canto superior direito): só recarrega os mesmos dados e redesenha.
async function refreshClientData(){
  try{ await loadState(); }catch(e){}
  render();
}
// Número no padrão da referência: 1.500,00 / -15.610,76 (sem o "R$").
function fmtNum(v){
  return new Intl.NumberFormat('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}).format(v);
}
function cvIcon(r){
  if(r==='green') return '<span class="cv-ic cv-ic-green">✓</span>';
  if(r==='red') return '<span class="cv-ic cv-ic-red">✕</span>';
  if(r==='void') return '<span class="cv-ic cv-ic-void">–</span>';
  return '<span class="cv-ic cv-ic-pending"><svg viewBox="0 0 12 12" width="8" height="8" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round"><path d="M6 3v3.2l2 1.2"/></svg></span>';
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

  const weekTickets = myTickets.filter(t=>mondayOf(ticketDate(t))===CLIENT_WEEK).sort((a,b)=>{
    const byDate = ticketDate(b).localeCompare(ticketDate(a));
    return byDate!==0 ? byDate : (b.time||'').localeCompare(a.time||'');
  });
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
      const odd = m.odd>0 ? ` <b>@ ${Number(m.odd).toFixed(2)}</b>` : '';
      return `
        <div class="cv-line">
          ${cvIcon(m.result)}
          <span class="cv-line-txt">${teamsLabel} - ${marketLabel} - ${m.selection}${odd}</span>
        </div>
      `;
    }).join('');
  }

  function buildRow(t, pendingAsZero){
    const r = ticketResult(t);
    const profit = ticketProfit(t);
    const rowCls = r==='red' ? 'is-red' : (r==='green' ? 'is-green' : '');
    const resTxt = r==='pending' ? (pendingAsZero ? fmtNum(0) : '—') : fmtNum(profit);
    const resCls = r==='pending' ? (pendingAsZero ? '' : 'is-pending') : (profit>=0?'profit-pos':'profit-neg');
    return `
      <div class="cv-row ${rowCls}">
        <div class="cv-date">
          <div class="d1">${fmtDate(t.date)} ${t.time?String(t.time).slice(0,5):''}</div>
          <div class="d2">#${t.ticketNumber||'—'} <span class="cv-tag"><svg viewBox="0 0 16 16" width="9" height="9" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="3" width="12" height="11" rx="2"/><path d="M2 7h12M5 1.5v3M11 1.5v3"/></svg></span></div>
        </div>
        <div class="cv-meta">
          <div class="cv-val" data-l="Valor">${fmtNum(t.stake)}</div>
          <div class="cv-odds" data-l="Odds">${ticketOddTotal(t)>0?effectiveOdds(t).toFixed(2):'—'}</div>
        </div>
        <div class="cv-details">${ticketMatchesBlock(t)}</div>
        <div class="cv-result ${resCls}">${resTxt}</div>
      </div>
    `;
  }
  const ticketRows = weekTickets.map(t=>buildRow(t,false)).join('');
  const pendentesRows = pendentes.map(t=>buildRow(t,true)).join('');

  const totalResultadoSemana = weekTickets.reduce((s,t)=>s+ticketProfit(t),0);
  // Com perda E desconto: 3 cartões (Resultado / Desconto / Líquido). Senão: só o resultado, centralizado.
  const hasDesc = resultado<0 && desconto>0;
  const heroValue = hasDesc ? liquido : resultado;

  document.title = 'Relatório';
  app.innerHTML = `
    <div class="client-theme client-page-wrap" style="--gold:#3EC1F3; --gold-dim:#1B5E86; --bg:#0d1420; --surface:#18212f; --surface-2:#202b3d; --surface-3:#2b3850; --line:#2a3550; --line-soft:#232d42; --text:#F5F7FA; --text-muted:#93a0ba; --red:#ff5d62; --red-dim:rgba(255,93,98,0.14); --green:#34d399; --green-dim:rgba(52,211,153,0.14); background:var(--bg);">
    <button class="cv-refresh" onclick="refreshClientData()" title="Atualizar" aria-label="Atualizar"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v6h-6"/></svg></button>

    <div class="client-header"><div class="name">${client.name}</div></div>

    <div class="cv-week">
      <button class="cv-week-btn" onclick="changeClientWeek(-1)" aria-label="Semana anterior">‹</button>
      <span class="cv-week-label">${weekLabel(CLIENT_WEEK)}</span>
      <button class="cv-week-btn" onclick="changeClientWeek(1)" aria-label="Próxima semana">›</button>
    </div>

    ${hasDesc ? `
    <div class="cv-stats">
      <div class="cv-stat">
        <div class="lbl">Resultado</div>
        <div class="val ${resultado>=0?'profit-pos':'profit-neg'}">${fmtNum(resultado)}</div>
      </div>
      <div class="cv-stat">
        <div class="lbl">Desconto</div>
        <div class="val profit-pos">${fmtNum(desconto)}</div>
      </div>
      <div class="cv-stat">
        <div class="lbl">Líquido</div>
        <div class="val ${liquido>=0?'profit-pos':'profit-neg'}">${fmtNum(liquido)}</div>
      </div>
    </div>
    ` : `
    <div class="cv-card cv-result-card">
      <div class="lbl">Resultado</div>
      <div class="val ${heroValue>=0?'profit-pos':'profit-neg'}">${fmtNum(heroValue)}</div>
    </div>
    `}

    ${pendentes.length>0 ? `
    <div class="cv-card cv-pend">
      <div class="cv-pend-top" onclick="CLIENT_SHOW_PENDENTES=!CLIENT_SHOW_PENDENTES;render()">
        <span class="cv-pend-title">Pendentes</span>
        <span class="cv-pend-count">(${pendentes.length})</span>
        <span class="cv-pend-val">${fmtNum(pendentesValor)}</span>
        <span class="cv-pend-arrow" style="transform:rotate(${CLIENT_SHOW_PENDENTES?0:-90}deg)"><svg viewBox="0 0 10 6" width="11" height="7" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 1l4 4 4-4"/></svg></span>
      </div>
      ${CLIENT_SHOW_PENDENTES ? `
        <div class="cv-head cv-head-up">
          <span class="h-date">Data</span>
          <span class="h-meta"><span class="h-val">Valor</span><span class="h-odds">Odds</span></span>
          <span class="h-details">Descrição</span>
          <span class="h-result">Resultado</span>
        </div>
        ${pendentesRows}
      ` : ''}
    </div>
    ` : ''}

    <div class="cv-card cv-list-card">
      <div class="cv-tabs">
        <div class="cv-tab">
          <span class="t1">Apostas (${weekTickets.length})</span>
          <span class="t2 ${totalResultadoSemana>=0?'profit-pos':'profit-neg'}">${fmtNum(totalResultadoSemana)}</span>
        </div>
      </div>
      ${weekTickets.length ? `
        <div class="cv-head">
          <span class="h-date">Data <svg viewBox="0 0 10 6" width="8" height="5" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M1 1l4 4 4-4"/></svg></span>
          <span class="h-meta"><span class="h-val">Valor</span><span class="h-odds">Odds</span></span>
          <span class="h-details">Detalhes</span>
          <span class="h-result">Resultado</span>
        </div>
        ${ticketRows}
      ` : '<div class="empty" style="padding:28px 0">Nenhuma aposta nessa semana.</div>'}
    </div>
    </div>
  `;
}

// ---------- COMMISSIONER VIEW ----------
