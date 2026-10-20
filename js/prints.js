// ---------- PRINT DO BILHETE (guardado pelo robô por 30 dias) ----------
// O arquivo fica num espaço privado do Supabase; aqui geramos um link temporário (10 min).
// Usado no painel (admin) e no link do cliente: janela com o print, o valor validado e o retorno do bilhete.
const PRINT_BUCKET = 'slip-prints';
function fecharPrint(){ const o = document.getElementById('print-overlay'); if(o) o.remove(); }
function printEsc(s){ return String(s==null?'':s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
async function verPrint(ticketId){
  const t = STATE.tickets.find(x=>x.id===ticketId);
  if(!t || !t.printPath){ showToast('Esta aposta não tem print guardado.'); return; }
  fecharPrint();

  // números da aposta: valor validado, odd e retorno
  const stake = Number(t.stake)||0;
  const odd = (typeof effectiveOdds==='function') ? Number(effectiveOdds(t))||0 : 0;
  const retorno = stake*odd;
  const res = (typeof ticketResult==='function') ? ticketResult(t) : 'pending';
  const profit = (typeof ticketProfit==='function') ? ticketProfit(t) : 0;
  const nf = (v)=> (typeof fmtNum==='function') ? fmtNum(v) : Number(v).toFixed(2);
  const badge = {
    green:['Green','#34d399','rgba(52,211,153,.15)'], red:['Red','#ff5d62','rgba(255,93,98,.15)'],
    void:['Anulada','#cbd5e1','rgba(203,213,225,.14)'], pending:['Em andamento','#f5b53d','rgba(245,181,61,.15)']
  }[res] || ['Em andamento','#f5b53d','rgba(245,181,61,.15)'];
  const dataTxt = ((typeof fmtDate==='function' && t.date) ? fmtDate(t.date) : '') + (t.time ? ' às '+String(t.time).slice(0,5) : '');
  const stat = (rot, val, cor)=> `<div style="flex:1;min-width:0;padding:10px 8px;text-align:center"><div style="font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:#8b97b0">${rot}</div><div style="margin-top:3px;font-size:16px;font-weight:700;color:${cor||'#f5f7fa'};font-variant-numeric:tabular-nums">${val}</div></div>`;
  const divisor = '<div style="width:1px;background:#263049;margin:8px 0"></div>';

  const ov = document.createElement('div');
  ov.id = 'print-overlay';
  ov.setAttribute('role','dialog'); ov.setAttribute('aria-modal','true');
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(3,6,12,.84);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);z-index:300;display:flex;align-items:center;justify-content:center;padding:14px';
  ov.onclick = (e)=>{ if(e.target===ov) fecharPrint(); };
  ov.innerHTML = `
    <div style="width:min(94vw,430px);max-height:94vh;display:flex;flex-direction:column;background:#111827;border:1px solid #263049;border-radius:16px;overflow:hidden;box-shadow:0 24px 70px rgba(0,0,0,.6);color:#f5f7fa;font-family:inherit">
      <div style="display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid #263049">
        <div style="min-width:0;flex:1">
          <div style="font-size:14px;font-weight:700">Aposta #${printEsc(t.ticketNumber||'—')}</div>
          <div style="font-size:11px;color:#8b97b0;margin-top:1px">${printEsc(dataTxt)}</div>
        </div>
        <span style="font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px;color:${badge[1]};background:${badge[2]}">${badge[0]}</span>
        <button type="button" id="print-x" aria-label="Fechar" style="all:unset;box-sizing:border-box;width:30px;height:30px;flex:0 0 30px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:rgba(255,255,255,.1);color:#f5f7fa;font-size:14px;line-height:1;cursor:pointer;-webkit-tap-highlight-color:transparent">✕</button>
      </div>
      <div id="print-body" style="flex:1;min-height:120px;overflow:auto;background:#0b1019;display:flex;align-items:flex-start;justify-content:center;padding:12px"><div style="color:#8b97b0;font-size:13px;margin:40px 0">Carregando print…</div></div>
      <div style="display:flex;border-top:1px solid #263049;background:#141c2c">
        ${stat('Valor validado', nf(stake))}${divisor}${stat('Odd', odd>0 ? odd.toFixed(2) : '—')}${divisor}${res==='pending' || res==='void' ? stat('Retorno', nf(retorno), '#3ec1f3') : stat('Resultado', (profit>=0?'+':'')+nf(profit), profit>=0?'#34d399':'#ff5d62')}
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:9px 14px;border-top:1px solid #263049;font-size:11px;color:#8b97b0">
        <span>O print fica disponível por 30 dias.</span>
        <a id="print-dl" style="display:none;color:#3ec1f3;text-decoration:none;font-weight:600" target="_blank" rel="noopener" download>⬇ Baixar</a>
      </div>
    </div>`;
  document.body.appendChild(ov);
  const xb = document.getElementById('print-x'); if(xb) xb.onclick = fecharPrint;
  try{
    const {data, error} = await supabaseClient.storage.from(PRINT_BUCKET).createSignedUrl(t.printPath, 600);
    if(error || !data || !data.signedUrl) throw new Error(error ? error.message : 'sem link');
    const url = data.signedUrl;
    const body = document.getElementById('print-body');
    if(body) body.innerHTML = `<img src="${url}" alt="Print da aposta" style="max-width:100%;height:auto;border-radius:10px;display:block">`;
    const dl = document.getElementById('print-dl'); if(dl){ dl.href = url; dl.style.display = ''; }
  }catch(e){
    const b = document.getElementById('print-body');
    if(b) b.innerHTML = `<div style="color:#cbd5e1;text-align:center;font-size:13px;margin:36px 10px">Print indisponível<br><span style="color:#8b97b0;font-size:12px">(os prints são apagados depois de 30 dias)</span></div>`;
  }
}
