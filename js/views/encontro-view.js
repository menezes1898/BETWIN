// ---------- LINK DO ENCONTRO DE CONTAS ----------
// Página pública (só leitura) com o saldo de cada cliente do grupo e o saldo final do encontro.
async function refreshEncontroData(){
  try{ await loadState(); }catch(e){}
  render();
}
function renderEncontroView(code){
  const app = document.getElementById('app');
  const m = (STATE.accountMeetings||[]).find(x=>x.code===code);
  if(!m){
    app.innerHTML = `<div class="client-theme client-page-wrap" style="background:#0d1420"><div class="empty">Link inválido ou encontro não encontrado.</div></div>`;
    return;
  }
  const s = encSummary(m.clientIds, m.extras);
  const pendTotal = s.rows.reduce((a,r)=>a+r.pendCount,0);
  const net = s.liquido, netLabel = Math.abs(net)<0.005 ? 'Contas zeradas' : (net>0 ? 'Saldo final a pagar' : 'Saldo final a receber');
  const netCls = Math.abs(net)<0.005 ? '' : (net>0 ? 'profit-neg' : 'profit-pos');
  document.title = 'Encontro de contas';
  app.innerHTML = `
    <div class="client-theme client-page-wrap" style="--gold:#3EC1F3; --gold-dim:#1B5E86; --bg:#0d1420; --surface:#18212f; --surface-2:#202b3d; --surface-3:#2b3850; --line:#2a3550; --line-soft:#232d42; --text:#F5F7FA; --text-muted:#93a0ba; --red:#ff5d62; --red-dim:rgba(255,93,98,0.14); --green:#34d399; --green-dim:rgba(52,211,153,0.14); background:var(--bg);">
    <button class="cv-refresh" onclick="refreshEncontroData()" title="Atualizar" aria-label="Atualizar"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v6h-6"/></svg></button>
    <div class="client-header"><div class="name">${encEsc(m.name)}</div><div style="font-size:12px;color:var(--text-muted);margin-top:4px">Encontro de contas</div></div>
    <div class="cv-card cv-result-card">
      <div class="lbl">${netLabel}</div>
      <div class="val ${netCls}">${fmtBRL(Math.abs(net))}</div>
    </div>
    <div class="cv-stats" style="grid-template-columns:repeat(2,minmax(0,1fr))">
      <div class="cv-stat"><div class="lbl">Devem</div><div class="val profit-neg">${fmtBRL(s.devem)}</div></div>
      <div class="cv-stat"><div class="lbl">A receber</div><div class="val profit-pos">${fmtBRL(s.receber)}</div></div>
    </div>
    <div class="cv-card cv-list-card">
      <div class="cv-tabs"><div class="cv-tab"><span class="t1">Clientes (${s.rows.length})</span><span class="t2 ${netCls}">${fmtBRL(Math.abs(net))}</span></div></div>
      ${s.rows.map(r=>`
        <div class="pv-row">
          <div class="pv-top">
            <span class="pv-name">${encEsc(r.name)}</span>
            <span class="pv-net ${Math.abs(r.saldo)<0.005?'':(r.saldo>0?'profit-neg':'profit-pos')}">${Math.abs(r.saldo)<0.005?'Quitado':(r.saldo>0?'Deve ':'A receber ')+fmtBRL(Math.abs(r.saldo))}</span>
          </div>
          ${r.pendCount>0?`<div class="pv-meta"><span>${r.pendCount} aposta${r.pendCount===1?'':'s'} em aberto (${fmtBRL(r.pendValor)}) ainda fora da conta</span></div>`:''}
        </div>`).join('')}
    ${s.extras.map(r=>`<div class="pv-row"><div class="pv-top"><span class="pv-name">${encEsc(r.label)} <span style="font-size:11px;color:var(--text-muted)">(por fora)</span></span><span class="pv-net ${r.saldo>0?'profit-neg':'profit-pos'}">${r.saldo>0?'Deve ':'A receber '}${fmtBRL(Math.abs(r.saldo))}</span></div></div>`).join('')}
    </div>
    <div style="max-width:1010px;margin:10px auto 24px;font-size:12px;color:var(--text-muted);text-align:center;padding:0 14px">
      Saldo acumulado de cada cliente, já descontados os pagamentos registrados.${pendTotal?' Apostas em aberto só entram depois de resolvidas.':''}
    </div>
    </div>`;
}
