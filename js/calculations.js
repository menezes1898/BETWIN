function getWeekDiscount(client, weekStart){
  // 1) Sobrescrita manual daquela semana específica (feita na aba Semanas) sempre vence.
  const ov = STATE.clientWeekDiscounts.find(o=>o.clientId===client.id && o.weekStart===weekStart);
  if(ov) return ov.discountPercent;
  // 2) Senão, usa a linha do tempo do desconto padrão: pega o valor que estava em vigor
  // naquela semana (não o valor atual), pra mudanças não afetarem semanas passadas.
  const history = STATE.clientDiscountHistory.filter(h=>h.clientId===client.id && (!h.effectiveFromWeek || h.effectiveFromWeek<=weekStart));
  if(history.length===0) return client.discount||0;
  history.sort((a,b)=>(a.effectiveFromWeek||'0000-00-00').localeCompare(b.effectiveFromWeek||'0000-00-00'));
  return history[history.length-1].discountPercent;
}
// Calcula o valor do desconto em cima de um resultado. Pra cliente normal, o desconto
// incide quando ele PERDE (resultado negativo). Pra conta de Descarga é o contrário:
// como você é o "cliente" dentro do sistema do parceiro, o desconto incide quando o
// saldo da descarga fica POSITIVO (que é quando você deve pra ele).
function computeDescontoAmount(client, resultado, weekStart){
  const pct = getWeekDiscount(client, weekStart);
  if(pct<=0) return 0;
  if(client.isDescarga){
    return resultado>0 ? resultado*pct/100 : 0;
  }
  return resultado<0 ? Math.abs(resultado)*pct/100 : 0;
}
// Junta resultado + desconto no sentido certo. Cliente normal: o desconto é um benefício
// PARA ELE, então soma (amortece a perda dele). Conta de Descarga: o desconto é um
// benefício PRA VOCÊ (não pro parceiro), então subtrai do saldo dele.
function applyDescontoSign(client, resultado, desconto){
  return client.isDescarga ? (resultado - desconto) : (resultado + desconto);
}

// Comissionados ativos de um cliente numa semana: se existir QUALQUER sobrescrita
// manual pra essa semana, ela substitui por completo a lista (uma linha com
// commissionerId nulo representa "sem comissionado nessa semana"). Sem sobrescrita,
// usa a linha do tempo dos vínculos (só entram os que já estavam em vigor naquela semana).
function getActiveCommissionersForWeek(clientId, weekStart){
  const overrides = STATE.clientWeekCommissioners.filter(o=>o.clientId===clientId && o.weekStart===weekStart);
  if(overrides.length>0){
    return overrides.filter(o=>o.commissionerId).map(o=>({commissionerId:o.commissionerId, percent:o.percent||0}));
  }
  const applicable = STATE.commissionerClients.filter(l=>l.clientId===clientId && (!l.effectiveFromWeek || l.effectiveFromWeek<=weekStart));
  const byCommissioner = {};
  applicable.forEach(l=>{
    const existing = byCommissioner[l.commissionerId];
    if(!existing || (l.effectiveFromWeek||'0000-00-00') > (existing.effectiveFromWeek||'0000-00-00')){
      byCommissioner[l.commissionerId] = l;
    }
  });
  return Object.values(byCommissioner).map(l=>({commissionerId:l.commissionerId, percent:l.percent}));
}
function grossLossForWeek(clientId, weekStart){
  const tickets = STATE.tickets.filter(t=>t.clientId===clientId && mondayOf(ticketDate(t))===weekStart && ticketResult(t)!=='pending' && ticketResult(t)!=='void');
  const resultado = tickets.reduce((s,t)=>s+ticketProfit(t),0);
  return resultado<0 ? Math.abs(resultado) : 0;
}
function computeCommissionAmount(clientId, percent, weekStart){
  return grossLossForWeek(clientId, weekStart) * (percent/100);
}

// ---------- PARCERIAS (sócio do resultado do cliente) ----------
// Parceiros ativos de um cliente numa semana, pela linha do tempo dos vínculos (cada mudança de %
// vale só a partir da semana em que foi feita; semanas passadas mantêm a % antiga).
function getActivePartnersForWeek(clientId, weekStart){
  const applicable = STATE.partnerClients.filter(l=>l.clientId===clientId && (!l.effectiveFromWeek || l.effectiveFromWeek<=weekStart));
  const byPartner = {};
  applicable.forEach(l=>{
    const existing = byPartner[l.partnerId];
    if(!existing || (l.effectiveFromWeek||'0000-00-00') > (existing.effectiveFromWeek||'0000-00-00')){
      byPartner[l.partnerId] = l;
    }
  });
  return Object.values(byPartner).map(l=>({partnerId:l.partnerId, percent:l.percent}));
}
// Parte do parceiro no resultado da semana, já com o desconto do cliente.
// Positivo = você paga pro parceiro (o cliente perdeu: ele leva a % do que sobrou pra você).
// Negativo = o parceiro paga pra você (o cliente ganhou: ele banca a mesma % do ganho).
function computePartnerShare(clientId, percent, weekStart){
  return computeWeekOwedAmount(clientId, weekStart) * (percent/100);
}
// Detalhe da parte do parceiro numa semana, no ponto de vista DELE (positivo = ele recebe):
//  - resultadoCliente: resultado do cliente na semana (negativo = cliente perdeu)
//  - bruto: a % dele em cima do resultado bruto (cliente perdeu 1.000 a 30% => +300; ganhou 1.000 => -300)
//  - desconto: a parte dele no desconto dado ao cliente (só existe quando o cliente perde)
//  - liquido: bruto - desconto (é o mesmo valor de computePartnerShare)
function computePartnerBreakdown(clientId, percent, weekStart){
  const tickets = STATE.tickets.filter(t=>t.clientId===clientId && mondayOf(ticketDate(t))===weekStart && ticketResult(t)!=='pending' && ticketResult(t)!=='void');
  const resultadoCliente = tickets.reduce((s,t)=>s+ticketProfit(t),0);
  const bruto = -resultadoCliente * (percent/100);
  const liquido = computePartnerShare(clientId, percent, weekStart);
  const desconto = bruto - liquido;
  return {resultadoCliente, bruto, desconto, liquido, volume: tickets.reduce((s,t)=>s+t.stake,0)};
}
