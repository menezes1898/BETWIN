// ==================== PÁGINA "FECHAMENTOS" ====================
// Aqui você vê, semana por semana, o fechamento de cada cliente e manda o PDF + mensagem no grupo dele (pelo robô).
// Nada é enviado sem uma janela de confirmação mostrando o PERÍODO, para não mandar a semana errada sem querer.
let FECH_WEEK = null;
let FECH_OUT = {};            // client_id -> {status, sent_at, error} do envio mais recente DA SEMANA mostrada
// Clientes DESMARCADOS (não entram no "Enviar selecionados"). Fica guardado no navegador: um grupo de descarga desmarcado
// continua desmarcado nas outras semanas. Cliente novo vem marcado.
let FECH_EXCL = new Set();
try{ FECH_EXCL = new Set(JSON.parse(localStorage.getItem('betwin_fech_excl')||'[]')); }catch(e){}
function fechSalvarExcl(){ try{ localStorage.setItem('betwin_fech_excl', JSON.stringify([...FECH_EXCL])); }catch(e){} }
function fechToggle(id){ if(FECH_EXCL.has(id)) FECH_EXCL.delete(id); else FECH_EXCL.add(id); fechSalvarExcl(); render(); }
function fechToggleTodos(marcar){
  fechRows().filter(r=>r.cl.waGroupId).forEach(r=>{ if(marcar) FECH_EXCL.delete(r.cl.id); else FECH_EXCL.add(r.cl.id); });
  fechSalvarExcl(); render();
}
function fechSelecionados(){ return fechRows().filter(r=>r.cl.waGroupId && !FECH_EXCL.has(r.cl.id)); }
let FECH_TABELA_OK = true, FECH_ERR = '', FECH_BUSY = false, FECH_POLL = null;

const FECH_MESES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
function fmtLong(ds){ return ds.slice(8,10)+' '+FECH_MESES[parseInt(ds.slice(5,7),10)-1]+' '+ds.slice(0,4); }
function fechEsc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'); }
function fechWeek(){ if(!FECH_WEEK) FECH_WEEK = shiftWeek(mondayOf(todaySP()), -7); return FECH_WEEK; }   // começa na semana passada (a que se fecha)
function changeFechWeek(dir){ FECH_WEEK = shiftWeek(fechWeek(), dir*7); FECH_OUT = {}; render(); }
function fechIrSemanaPassada(){ FECH_WEEK = shiftWeek(mondayOf(todaySP()), -7); FECH_OUT = {}; render(); }

function fechRows(){
  const week = fechWeek();
  return STATE.clients.map(cl=>{
    const tk = STATE.tickets.filter(t=>t.clientId===cl.id && mondayOf(ticketDate(t))===week && ticketResult(t)!=='void');
    if(!tk.length) return null;
    const f = fechamentoCampos(cl.id, week);
    const g = cl.waGroupId ? ((STATE.botGroups.find(x=>x.id===cl.waGroupId)||{}).name || 'grupo vinculado') : '';
    return {cl, n:tk.length, pend:tk.filter(t=>ticketResult(t)==='pending').length, g, saldo:f?f.saldoTotal:0};
  }).filter(Boolean).sort((a,b)=>a.cl.name.localeCompare(b.cl.name,'pt-BR'));
}
function fechStatusHtml(cl){
  const o = FECH_OUT[cl.id];
  if(!FECH_TABELA_OK) return '<span style="color:var(--text-muted)">—</span>';
  if(!o) return '<span style="color:var(--text-muted)">não enviado</span>';
  const q = o.sent_at ? new Date(o.sent_at) : new Date(o.created_at);
  const quando = q.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})+' '+q.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
  if(o.status==='enviado') return `<span style="color:var(--green);font-weight:600">✔ enviado</span> <span style="color:var(--text-muted);font-size:11.5px">${quando}</span>`;
  if(o.status==='erro') return `<span style="color:var(--red);font-weight:600" title="${fechEsc(o.error||'')}">✖ erro</span> <span style="color:var(--text-muted);font-size:11.5px" title="${fechEsc(o.error||'')}">${fechEsc((o.error||'').slice(0,40))}</span>`;
  return `<span style="color:var(--gold);font-weight:600">⏳ ${o.status==='enviando'?'enviando':'na fila'}</span>`;
}

function renderFechamentosTab(){
  const week = fechWeek();
  const hoje = mondayOf(todaySP());
  const rows = fechRows();
  const andamento = week >= hoje;
  const semPend = rows.filter(r=>r.pend>0).length;
  setTimeout(fechCarregarStatus, 0);
  const linhas = rows.map(r=>{
    const pode = !!r.cl.waGroupId;
    const cor = r.saldo>0.004 ? 'profit-pos' : (r.saldo<-0.004 ? 'profit-neg' : '');
    return `<tr>
      <td style="width:34px;text-align:center"><input type="checkbox" ${pode?'':'disabled'} ${pode && !FECH_EXCL.has(r.cl.id)?'checked':''} onchange="fechToggle('${r.cl.id}')" title="${pode?'Marcado = entra no &quot;Enviar selecionados&quot;':'Sem grupo vinculado'}" style="width:16px;height:16px;cursor:pointer"></td>
      <td class="left"><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><b>${fechEsc(r.cl.name)}</b>
        <button class="btn-primary btn-sm" ${pode?'':'disabled'} onclick="fechEnviarUm('${r.cl.id}')" title="${pode?'Enviar o fechamento só deste cliente (serve também para reenviar)':'Vincule o grupo do cliente em Clientes'}">📤 Enviar</button>
        <button class="btn-ghost btn-sm" onclick="gerarFechamentoPDFSemana('${r.cl.id}')" title="Baixar o PDF deste cliente (não envia nada)">PDF</button></div></td>
      <td class="left" style="font-size:12px;color:var(--text-muted)">${pode ? '🔗 '+fechEsc(r.g) : '<span style="color:var(--red)">sem grupo vinculado</span>'}</td>
      <td>${r.n}${r.pend?` <span style="color:var(--gold);font-size:11.5px">(${r.pend} pend.)</span>`:''}</td>
      <td class="${cor}" style="font-weight:700">${fmtBRL(r.saldo)}</td>
      <td class="left" id="fech-st-${r.cl.id}">${fechStatusHtml(r.cl)}</td>
    </tr>`;
  }).join('');
  const enviaveis = rows.filter(r=>r.cl.waGroupId);
  const marcados = enviaveis.filter(r=>!FECH_EXCL.has(r.cl.id));
  return `
    <div class="card" style="margin-bottom:14px">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
        <div class="wk-nav" style="margin:0">
          <button class="wk-btn" onclick="changeFechWeek(-1)" aria-label="Semana anterior">${typeof ICO_PREV!=='undefined'?ICO_PREV:'‹'}</button>
          <div class="wk-mid"><span class="wk-kicker">SEMANA</span><span class="wk-num"><small>#</small>${isoWeekNum(week)}</span><span class="wk-range">${fmtLong(week)} — ${fmtLong(shiftWeek(week,6))}</span></div>
          <button class="wk-btn" onclick="changeFechWeek(1)" aria-label="Próxima semana">${typeof ICO_NEXT!=='undefined'?ICO_NEXT:'›'}</button>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn-ghost btn-sm" onclick="fechIrSemanaPassada()">Semana passada</button>
          <button class="btn-primary" ${marcados.length&&!FECH_BUSY?'':'disabled'} onclick="fechEnviarTodos()">📤 Enviar selecionados (${marcados.length} de ${enviaveis.length})</button>
        </div>
      </div>
      ${andamento ? `<div style="margin-top:10px;padding:9px 12px;border:1px solid var(--gold);border-radius:10px;font-size:12.5px;color:var(--gold)">⚠️ Esta semana ainda está em andamento. Confirme que é mesmo ela que você quer enviar.</div>` : ''}
      ${semPend ? `<div style="margin-top:8px;font-size:12.5px;color:var(--text-muted)">${semPend} cliente${semPend>1?'s':''} com apostas pendentes nesta semana (elas não entram no fechamento).</div>` : ''}
      ${FECH_TABELA_OK ? '' : `<div style="margin-top:10px;padding:10px 12px;border:1px solid var(--red);border-radius:10px;font-size:12.5px">A fila de envio ainda não foi criada no banco (rode o SQL do envio de fechamentos). <span style="color:var(--text-muted)">${fechEsc(FECH_ERR)}</span></div>`}
    </div>
    <div class="card" style="padding:0;overflow:auto">
      <table class="tbl"><thead><tr><th style="width:34px;text-align:center"><input type="checkbox" ${enviaveis.length && marcados.length===enviaveis.length?'checked':''} onchange="fechToggleTodos(this.checked)" title="Marcar / desmarcar todos" style="width:16px;height:16px;cursor:pointer"></th><th class="left">Cliente</th><th class="left">Grupo do WhatsApp</th><th>Apostas</th><th>Saldo final</th><th class="left">Envio</th></tr></thead>
      <tbody>${linhas || '<tr><td colspan="6" class="empty">Nenhum cliente com apostas nesta semana.</td></tr>'}</tbody></table>
    </div>
    <p class="muted" style="font-size:12px;margin:10px 4px">O robô precisa estar ligado para entregar. A mensagem enviada com o PDF é editada em Configurações › Mensagem do fechamento.</p>`;
}
function gerarFechamentoPDFSemana(id){ gerarFechamentoPDF(id, {week: fechWeek()}); }

// ---- situação dos envios (lê a fila; atualiza sozinho enquanto algo está pendente) ----
async function fechCarregarStatus(){
  const week = fechWeek();
  try{
    const {data, error} = await supabaseClient.from('bot_outbox').select('id,client_id,status,error,created_at,sent_at').eq('week_start', week).order('created_at',{ascending:true}).limit(500);
    if(error){ FECH_TABELA_OK = false; FECH_ERR = error.message; }
    else { FECH_TABELA_OK = true; FECH_OUT = {}; (data||[]).forEach(r=>{ FECH_OUT[r.client_id] = r; }); }
  }catch(e){ FECH_TABELA_OK = false; FECH_ERR = e.message; }
  if(ADMIN_TAB!=='fechamentos') return;
  STATE.clients.forEach(cl=>{ const el = document.getElementById('fech-st-'+cl.id); if(el) el.innerHTML = fechStatusHtml(cl); });
  const alguem = Object.values(FECH_OUT).some(o=>o.status==='pendente'||o.status==='enviando');
  clearTimeout(FECH_POLL);
  if(alguem) FECH_POLL = setTimeout(()=>{ if(ADMIN_TAB==='fechamentos') fechCarregarStatus(); }, 8000);
}

// ---- janela de confirmação (mostra o PERÍODO em destaque) ----
function fechConfirmar({titulo, aviso, mensagem, rotuloOk}){
  return new Promise(resolve=>{
    const o = document.createElement('div');
    o.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9999;display:flex;align-items:flex-start;justify-content:center;padding:28px 14px;overflow:auto;';
    const fim = (v)=>{ o.remove(); document.body.style.overflow=''; resolve(v); };
    const week = fechWeek();
    o.innerHTML = `<div class="card" style="max-width:520px;width:100%;margin:0">
      <h3 style="margin:0 0 8px">${fechEsc(titulo)}</h3>
      <div style="text-align:center;padding:12px;border:1px solid var(--gold);border-radius:12px;margin-bottom:10px">
        <div style="font-size:11px;letter-spacing:.5px;color:var(--text-muted)">PERÍODO DO FECHAMENTO</div>
        <div style="font-size:20px;font-weight:800;color:var(--gold)">${fmtLong(week)} — ${fmtLong(shiftWeek(week,6))}</div>
      </div>
      ${aviso ? `<div style="font-size:12.5px;margin-bottom:10px;line-height:1.5">${aviso}</div>` : ''}
      ${mensagem ? `<div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">Mensagem que vai na legenda do PDF (exemplo):</div><pre style="white-space:pre-wrap;font-family:inherit;font-size:12.5px;background:var(--surface-2,#111);border:1px solid var(--line);border-radius:10px;padding:10px;margin:0 0 12px;max-height:30vh;overflow:auto">${fechEsc(mensagem)}</pre>` : ''}
      <div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn-ghost" id="fech-no">Cancelar</button><button class="btn-primary" id="fech-ok">${fechEsc(rotuloOk||'Confirmar e enviar')}</button></div></div>`;
    document.body.appendChild(o); document.body.style.overflow = 'hidden';
    o.querySelector('#fech-no').onclick = ()=>fim(false);
    o.querySelector('#fech-ok').onclick = ()=>fim(true);
    o.addEventListener('click', e=>{ if(e.target===o) fim(false); });
  });
}

async function fechEnviarUm(id){
  if(FECH_BUSY) return;
  const cl = STATE.clients.find(c=>c.id===id); if(!cl) return;
  const week = fechWeek(), ja = FECH_OUT[id];
  const msg = await montarMensagemFechamento(id, week);
  const aviso = `Cliente: <b>${fechEsc(cl.name)}</b><br>Grupo: ${fechEsc((STATE.botGroups.find(x=>x.id===cl.waGroupId)||{}).name||'grupo vinculado')}`
    + (ja && (ja.status==='enviado'||ja.status==='pendente'||ja.status==='enviando') ? `<br><span style="color:var(--gold)">⚠️ Este fechamento já foi ${ja.status==='enviado'?'enviado':'colocado na fila'} antes. Vai ser enviado de novo.</span>` : '');
  if(!(await fechConfirmar({titulo:'Enviar fechamento de '+cl.name+'?', aviso, mensagem: msg}))) return;
  FECH_BUSY = true;
  try{ showToast('Gerando o PDF de '+cl.name+'...'); await enfileirarFechamento(cl, week); showToast('Na fila: o robô envia em instantes.', 'success'); }
  catch(e){ showToast('Não entrou na fila: '+(e.message||e), 'error'); }
  FECH_BUSY = false; render();
}

async function fechEnviarTodos(){
  if(FECH_BUSY) return;
  const week = fechWeek();
  const todos = fechSelecionados();
  if(!todos.length){ showToast('Nenhum cliente marcado. Marque os grupos que vão receber o fechamento.', 'error'); return; }
  const novos = todos.filter(r=>{ const o = FECH_OUT[r.cl.id]; return !(o && ['enviado','pendente','enviando'].includes(o.status)); });
  if(!novos.length){ showToast('Os clientes marcados já foram enviados nesta semana. Use o botão "Enviar" de cada cliente para reenviar.', 'error'); return; }
  const puladas = todos.length - novos.length;
  const naoMarcados = fechRows().filter(r=>r.cl.waGroupId && FECH_EXCL.has(r.cl.id)).length;
  const aviso = `Vão ser enviados <b>${novos.length} fechamento${novos.length>1?'s':''}</b> (cada um no grupo do cliente):<br><span style="color:var(--text-muted)">${novos.map(r=>fechEsc(r.cl.name)).join(', ')}</span>`
    + (naoMarcados ? `<br>${naoMarcados} desmarcado${naoMarcados>1?'s':''} ficam de fora.` : '')
    + (puladas ? `<br>${puladas} já enviado${puladas>1?'s':''} nesta semana ${puladas>1?'ficam':'fica'} de fora.` : '')
    + (week>=mondayOf(todaySP()) ? '<br><span style="color:var(--gold)">⚠️ Esta semana ainda está em andamento.</span>' : '');
  const exemplo = await montarMensagemFechamento(novos[0].cl.id, week);
  if(!(await fechConfirmar({titulo:'Enviar os fechamentos selecionados?', aviso, mensagem: exemplo, rotuloOk:'Confirmar e enviar'}))) return;
  FECH_BUSY = true; render();
  let ok = 0; const falhas = [];
  for(let i=0;i<novos.length;i++){
    const cl = novos[i].cl;
    showToast('Gerando '+(i+1)+' de '+novos.length+': '+cl.name+'...');
    try{ await enfileirarFechamento(cl, week); ok++; }catch(e){ falhas.push(cl.name+': '+(e.message||e)); }
  }
  FECH_BUSY = false;
  showToast(ok+' na fila para o robô enviar.'+(falhas.length?' Falhou: '+falhas.length:''), falhas.length?'error':'success');
  if(falhas.length) alert('Não entraram na fila:\n\n'+falhas.join('\n'));
  render();
}
