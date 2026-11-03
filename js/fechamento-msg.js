// ==================== MENSAGEM DO FECHAMENTO (legenda do PDF no WhatsApp) ====================
// O texto é um MODELO editável (Configurações > Mensagem do fechamento). Dentro dele, {campos} são trocados pelos números
// de cada cliente. Linha que usa um campo sem valor (ex.: {desconto} quando o cliente não tem desconto) some sozinha.
const FMSG_KEY = 'fechamento_msg';
const FMSG_DEFAULT = [
  '{saudacao}, {cliente}',
  '',
  'Segue fechamento atualizado.',
  'Período: {periodo}',
  '',
  'Qualquer dúvida, estamos à disposição.'
].join('\n');
const FMSG_CAMPOS = [
  ['saudacao','Bom dia / Boa tarde / Boa noite (pela hora do envio)'], ['cliente','Nome do cliente'], ['periodo','26/10/2026 a 01/11/2026'], ['apostas','Quantidade de apostas'], ['green','Qtd. de green'], ['red','Qtd. de red'],
  ['pendentes','Qtd. de pendentes'], ['valor_jogado','Valor jogado'], ['resultado','Resultado (subtotal)'], ['desconto','Valor do desconto'], ['desconto_pct','% do desconto'],
  ['pagamento_semana','Pagamento ligado à semana'], ['saldo_semana','Saldo da semana'], ['saldo_anterior','Saldo anterior'], ['saldo_final','Saldo final'],
  ['acao','"Valor a pagar/receber"'], ['aviso_pendentes','Aviso de apostas pendentes']
];
let FMSG_CACHE = null;

async function getFechamentoTemplate(force){
  if(FMSG_CACHE!==null && !force) return FMSG_CACHE;
  let t = null;
  try{
    const {data, error} = await supabaseClient.from('app_settings').select('value').eq('key', FMSG_KEY).maybeSingle();
    if(!error && data && typeof data.value==='string' && data.value.trim()) t = data.value;
  }catch(e){}
  if(t===null){ try{ const l = localStorage.getItem('betwin_'+FMSG_KEY); if(l && l.trim()) t = l; }catch(e){} }
  FMSG_CACHE = t || FMSG_DEFAULT;
  return FMSG_CACHE;
}
async function salvarFechamentoTemplate(texto){
  const val = String(texto||'').trim() ? String(texto) : FMSG_DEFAULT;
  let remoto = true;
  try{
    const {error} = await supabaseClient.from('app_settings').upsert({key:FMSG_KEY, value:val, updated_at:new Date().toISOString()}, {onConflict:'key'});
    if(error) remoto = false;
  }catch(e){ remoto = false; }
  try{ localStorage.setItem('betwin_'+FMSG_KEY, val); }catch(e){}
  FMSG_CACHE = val;
  return remoto;
}

// números do fechamento de UM cliente numa semana (os mesmos do PDF e da imagem)
function fechamentoCampos(clientId, weekMonday){
  const cl = STATE.clients.find(c=>c.id===clientId); if(!cl) return null;
  const tickets = STATE.tickets.filter(t=>t.clientId===clientId && mondayOf(ticketDate(t))===weekMonday && ticketResult(t)!=='void');
  const valorJogado = tickets.reduce((s,t)=>s+t.stake,0);
  const subtotal = tickets.reduce((s,t)=>s+ticketProfit(t),0);
  const descontoPct = getWeekDiscount(cl, weekMonday);
  const desconto = computeDescontoAmount(cl, subtotal, weekMonday);
  const pagoSemana = getWeekSettlementsSum(clientId, weekMonday);
  const temPago = Math.abs(pagoSemana) >= 0.01;
  const temAnt = Math.abs(computeContinuousBalance(clientId, weekMonday)) >= 0.01 || temPago;
  const saldoAnterior = -computeContinuousBalance(clientId, weekMonday);
  const saldoSemana = applyDescontoSign(cl, subtotal, desconto) + pagoSemana;
  const saldoTotal = saldoSemana + saldoAnterior;
  const nG = tickets.filter(t=>ticketResult(t)==='green').length, nR = tickets.filter(t=>ticketResult(t)==='red').length, nP = tickets.filter(t=>ticketResult(t)==='pending').length;
  const seg = new Date(weekMonday+'T12:00:00'), dom = new Date(seg); dom.setDate(seg.getDate()+6);
  const rs = v=>(v>=0?'+ ':'- ')+fmtBRL(Math.abs(v));
  let acao;
  if(Math.abs(saldoTotal)<0.01) acao = '✅ Sem saldo pendente.';
  else if(saldoTotal<0) acao = '➡️ Valor a pagar: '+fmtBRL(Math.abs(saldoTotal));
  else acao = '➡️ Valor a receber: '+fmtBRL(Math.abs(saldoTotal));
  return {
    saldoTotal,
    campos: {
      saudacao: (()=>{ const h = parseInt(new Intl.DateTimeFormat('pt-BR',{hour:'numeric',hour12:false,timeZone:'America/Sao_Paulo'}).format(new Date()),10); return h<12 ? 'Bom dia' : (h<18 ? 'Boa tarde' : 'Boa noite'); })(),
      cliente: cl.name,
      periodo: seg.toLocaleDateString('pt-BR')+' a '+dom.toLocaleDateString('pt-BR'),
      apostas: String(tickets.length), green: String(nG), red: String(nR), pendentes: String(nP),
      valor_jogado: fmtBRL(valorJogado), resultado: rs(subtotal),
      desconto: desconto>0 ? '+ '+fmtBRL(desconto) : null,
      desconto_pct: desconto>0 && descontoPct>0 ? descontoPct+'%' : null,
      pagamento_semana: temPago ? rs(pagoSemana) : null,
      saldo_semana: temAnt ? rs(saldoSemana) : null,
      saldo_anterior: temAnt ? rs(saldoAnterior) : null,
      saldo_final: rs(saldoTotal), acao,
      aviso_pendentes: nP ? '_Há '+nP+' aposta'+(nP>1?'s':'')+' pendente'+(nP>1?'s':'')+', que entra'+(nP>1?'m':'')+' no próximo fechamento._' : null
    }
  };
}
// troca os {campos}; linha com campo sem valor é removida; sobra no máximo 1 linha em branco seguida
function aplicarModeloFechamento(modelo, campos){
  const out = [];
  String(modelo||'').split('\n').forEach(linha=>{
    let some = false;
    const t = linha.replace(/\{([a-z_]+)\}/g, (m,k)=>{
      if(!(k in campos)) return m;                 // {campo} desconhecido: deixa como está (assim você vê o erro de digitação)
      if(campos[k]===null || campos[k]===undefined){ some = true; return ''; }
      return campos[k];
    });
    if(!some) out.push(t);
  });
  return out.join('\n').replace(/\n{3,}/g,'\n\n').trim();
}
async function montarMensagemFechamento(clientId, weekMonday){
  const f = fechamentoCampos(clientId, weekMonday); if(!f) return '';
  return aplicarModeloFechamento(await getFechamentoTemplate(), f.campos);
}

// ---------- tela em Configurações ----------
function renderFechamentoMsgCard(){
  return `
    <h3>Mensagem do fechamento (WhatsApp)</h3>
    <p class="muted" style="margin:0 0 10px;font-size:13px;line-height:1.5">Texto que vai na legenda do PDF quando o robô envia o fechamento. Escreva do seu jeito e use os campos abaixo, que são trocados pelos números de cada cliente. Linha com campo vazio (ex.: desconto, quando não há) some sozinha. No WhatsApp, <b>*negrito*</b> e <i>_itálico_</i>.</p>
    <textarea id="fmsg-text" rows="14" style="width:100%;font-family:var(--font-mono,monospace);font-size:12.5px;line-height:1.45" oninput="fmsgPreview()">${String(FMSG_CACHE||FMSG_DEFAULT).replace(/&/g,'&amp;').replace(/</g,'&lt;')}</textarea>
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin:8px 0">${FMSG_CAMPOS.map(([k,d])=>`<button type="button" class="btn-ghost btn-sm" style="font-size:11px" title="${d.replace(/"/g,'&quot;')}" onclick="fmsgInserir('{${k}}')">{${k}}</button>`).join('')}</div>
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px">
      <label style="font-size:12px;color:var(--text-muted);margin:0">Prévia com o cliente:</label>
      <select id="fmsg-cli" onchange="fmsgPreview()" style="max-width:240px">${STATE.clients.slice().sort((a,b)=>a.name.localeCompare(b.name,'pt-BR')).map(c=>`<option value="${c.id}">${String(c.name).replace(/</g,'&lt;')}</option>`).join('')}</select>
      <span style="font-size:12px;color:var(--text-muted)">(semana ${typeof DASH_WEEK!=='undefined'&&DASH_WEEK?weekLabel(DASH_WEEK):'atual'})</span>
    </div>
    <pre id="fmsg-prev" style="white-space:pre-wrap;background:var(--surface-2,#111);border:1px solid var(--line);border-radius:10px;padding:12px;font-size:12.5px;line-height:1.5;margin:0 0 10px;font-family:inherit"></pre>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn-primary" onclick="fmsgSalvar()">Salvar mensagem</button>
      <button class="btn-ghost" onclick="fmsgRestaurar()">Voltar ao texto padrão</button>
      <span id="fmsg-st" style="font-size:12.5px;color:var(--text-muted);align-self:center"></span>
    </div>`;
}
function fmsgInserir(tag){
  const ta = document.getElementById('fmsg-text'); if(!ta) return;
  const a = ta.selectionStart, b = ta.selectionEnd;
  ta.value = ta.value.slice(0,a)+tag+ta.value.slice(b);
  ta.focus(); ta.selectionStart = ta.selectionEnd = a+tag.length; fmsgPreview();
}
function fmsgPreview(){
  const ta = document.getElementById('fmsg-text'), sel = document.getElementById('fmsg-cli'), pv = document.getElementById('fmsg-prev');
  if(!ta || !pv) return;
  const week = (typeof DASH_WEEK!=='undefined' && DASH_WEEK) || mondayOf(todaySP());
  const f = sel && sel.value ? fechamentoCampos(sel.value, week) : null;
  pv.textContent = f ? aplicarModeloFechamento(ta.value, f.campos) : '(cadastre um cliente para ver a prévia)';
}
async function fmsgSalvar(){
  const ta = document.getElementById('fmsg-text'); if(!ta) return;
  const st = document.getElementById('fmsg-st');
  const remoto = await salvarFechamentoTemplate(ta.value);
  if(st) st.textContent = remoto ? 'Salvo.' : 'Salvo só neste navegador (rode o SQL das configurações para guardar no banco).';
  showToast(remoto ? 'Mensagem salva.' : 'Mensagem salva neste navegador.', 'success');
}
function fmsgRestaurar(){
  if(!confirm('Voltar ao texto padrão da mensagem?')) return;
  const ta = document.getElementById('fmsg-text'); if(ta){ ta.value = FMSG_DEFAULT; fmsgPreview(); }
}
// carrega o texto salvo e mostra a prévia quando a tela de Configurações aparece
function fmsgInit(){
  getFechamentoTemplate(true).then(t=>{ const ta = document.getElementById('fmsg-text'); if(ta && document.activeElement!==ta){ ta.value = t; } fmsgPreview(); });
}
