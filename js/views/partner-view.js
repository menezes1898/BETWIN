// ---------- LINK DO PARCEIRO (Parceria) ----------
// Mostra, pro parceiro, a parte dele em cada cliente: a % em cima do resultado bruto, o desconto que
// foi dado ao cliente (na parte dele) e o líquido. Positivo = ele recebe; negativo = ele paga.
function changePartnerWeek(dir){
  PARTNER_WEEK = shiftWeek(PARTNER_WEEK, dir*7);
  render();
}
async function refreshPartnerData(){
  try{ await loadState(); }catch(e){}
  render();
}
function renderPartnerView(code){
  const app = document.getElementById('app');
  const pt = STATE.partners.find(p=>p.code && p.code===code);
  if(!pt){
    app.innerHTML = `<div class="client-theme client-page-wrap" style="--gold:#3EC1F3; background:#070B14;"><div class="empty">Link inválido ou parceiro não encontrado.</div></div>`;
    return;
  }
  if(PARTNER_WEEK===null) PARTNER_WEEK = mondayOf(todaySP());

  const rows = STATE.clients.map(cl=>{
    const active = getActivePartnersForWeek(cl.id, PARTNER_WEEK).find(a=>a.partnerId===pt.id);
    if(!active) return null;
    const bd = computePartnerBreakdown(cl.id, active.percent, PARTNER_WEEK);
    if(bd.volume===0) return null;
    return {name: cl.name, percent: active.percent, ...bd};
  }).filter(Boolean);

  const totalBruto = rows.reduce((s,r)=>s+r.bruto,0);
  const totalDesconto = rows.reduce((s,r)=>s+r.desconto,0);
  const totalLiquido = rows.reduce((s,r)=>s+r.liquido,0);
  const hasDesc = totalDesconto>=0.005;
  const heroLabel = Math.abs(totalLiquido)<0.005 ? 'Sua parte da semana' : (totalLiquido>0 ? 'A receber' : 'A pagar');

  document.title = 'Relatório';
  app.innerHTML = `
    <div class="client-theme client-page-wrap" style="--gold:#3EC1F3; --gold-dim:#1B5E86; --bg:#0d1420; --surface:#18212f; --surface-2:#202b3d; --surface-3:#2b3850; --line:#2a3550; --line-soft:#232d42; --text:#F5F7FA; --text-muted:#93a0ba; --red:#ff5d62; --red-dim:rgba(255,93,98,0.14); --green:#34d399; --green-dim:rgba(52,211,153,0.14); background:var(--bg);">
    <button class="cv-refresh" onclick="refreshPartnerData()" title="Atualizar" aria-label="Atualizar"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v6h-6"/></svg></button>

    <div class="client-header"><div class="name">${pt.name}</div></div>

    <div class="cv-week">
      <button class="cv-week-btn" onclick="changePartnerWeek(-1)" aria-label="Semana anterior">‹</button>
      <span class="cv-week-label">${weekLabel(PARTNER_WEEK)}</span>
      <button class="cv-week-btn" onclick="changePartnerWeek(1)" aria-label="Próxima semana">›</button>
    </div>

    ${hasDesc ? `
    <div class="cv-stats">
      <div class="cv-stat">
        <div class="lbl">Sua parte bruta</div>
        <div class="val ${totalBruto>=0?'profit-pos':'profit-neg'}">${fmtNum(totalBruto)}</div>
      </div>
      <div class="cv-stat">
        <div class="lbl">Desconto</div>
        <div class="val profit-neg">-${fmtNum(totalDesconto)}</div>
      </div>
      <div class="cv-stat">
        <div class="lbl">${heroLabel}</div>
        <div class="val ${totalLiquido>=0?'profit-pos':'profit-neg'}">${fmtNum(totalLiquido)}</div>
      </div>
    </div>
    ` : `
    <div class="cv-card cv-result-card">
      <div class="lbl">${heroLabel}</div>
      <div class="val ${totalLiquido>=0?'profit-pos':'profit-neg'}">${fmtNum(totalLiquido)}</div>
    </div>
    `}

    <div class="cv-card cv-list-card">
      <div class="cv-tabs">
        <div class="cv-tab">
          <span class="t1">Clientes (${rows.length})</span>
          <span class="t2 ${totalLiquido>=0?'profit-pos':'profit-neg'}">${fmtNum(totalLiquido)}</span>
        </div>
      </div>
      ${rows.length===0 ? '<div class="empty" style="padding:28px 0">Nenhum cliente com apostas resolvidas nessa semana.</div>' : rows.map(r=>`
        <div class="pv-row">
          <div class="pv-top">
            <span class="pv-name">${r.name}</span>
            <span class="pv-net ${r.liquido>=0?'profit-pos':'profit-neg'}">${fmtNum(r.liquido)}</span>
          </div>
          <div class="pv-meta">
            <span>Resultado do cliente <b class="${r.resultadoCliente>=0?'profit-pos':'profit-neg'}">${fmtNum(r.resultadoCliente)}</b></span>
            <span>${r.percent}% = <b class="${r.bruto>=0?'profit-pos':'profit-neg'}">${fmtNum(r.bruto)}</b></span>
            ${r.desconto>=0.005 ? `<span>Desconto dado <b class="profit-neg">-${fmtNum(r.desconto)}</b></span>` : ''}
          </div>
        </div>
      `).join('')}
    </div>
    </div>
  `;
}
