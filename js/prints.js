// ---------- PRINT DO BILHETE (guardado pelo robô por 30 dias) ----------
// O arquivo fica num espaço privado do Supabase; aqui geramos um link temporário (10 min) para quem está logado.
const PRINT_BUCKET = 'slip-prints';
function fecharPrint(){ const o = document.getElementById('print-overlay'); if(o) o.remove(); }
async function verPrint(ticketId){
  const t = STATE.tickets.find(x=>x.id===ticketId);
  if(!t || !t.printPath){ showToast('Esta aposta não tem print guardado.'); return; }
  fecharPrint();
  const ov = document.createElement('div');
  ov.id = 'print-overlay';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.82);z-index:300;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px;gap:12px';
  ov.onclick = (e)=>{ if(e.target===ov) fecharPrint(); };
  ov.innerHTML = '<div id="print-body" style="color:#fff;font-size:14px">Carregando print…</div>';
  document.body.appendChild(ov);
  try{
    const {data, error} = await supabaseClient.storage.from(PRINT_BUCKET).createSignedUrl(t.printPath, 600);
    if(error || !data || !data.signedUrl) throw new Error(error ? error.message : 'sem link');
    const url = data.signedUrl;
    document.getElementById('print-body').outerHTML = `
      <img src="${url}" alt="Print do bilhete" style="max-width:min(92vw,520px);max-height:78vh;border-radius:12px;background:#111;object-fit:contain">
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;justify-content:center">
        <span style="color:#cbd5e1;font-size:12px">Print do bilhete #${t.ticketNumber||'—'} · fica disponível por 30 dias</span>
        <a href="${url}" target="_blank" rel="noopener" download class="btn-ghost btn-sm" style="text-decoration:none">⬇ Baixar</a>
        <button class="btn-ghost btn-sm" onclick="fecharPrint()">✕ Fechar</button>
      </div>`;
  }catch(e){
    const b = document.getElementById('print-body');
    if(b) b.outerHTML = `<div style="color:#fff;text-align:center;max-width:320px">Print indisponível (os prints são apagados depois de 30 dias).<br><button class="btn-ghost btn-sm" style="margin-top:12px" onclick="fecharPrint()">Fechar</button></div>`;
  }
}
