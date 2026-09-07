function getSettlementsFor(clientId, weekStart){
  return STATE.settlements.filter(s=>s.clientId===clientId && s.weekStart===weekStart && !s.excluded);
}
function getAllSettlementsForClient(clientId){
  return STATE.settlements.filter(s=>s.clientId===clientId && !s.excluded).reduce((s,x)=>s+x.amount,0);
}
// Saldo contínuo (perspectiva admin, positivo = cliente deve) de todas as apostas já
// resolvidas + saldo em aberto, descontando tudo que já foi pago em qualquer semana.
// excludeWeek (opcional) tira uma semana específica do cálculo das apostas — usado no
// fechamento pra separar "saldo da semana" do "saldo anterior".
function computeContinuousBalance(clientId, excludeWeek){
  const cl = STATE.clients.find(c=>c.id===clientId);
  const resolvedTickets = STATE.tickets.filter(t=>t.clientId===clientId && ticketResult(t)!=='pending' && ticketResult(t)!=='void' && (!excludeWeek || mondayOf(ticketDate(t))!==excludeWeek));
  const weekGroups = {};
  resolvedTickets.forEach(t=>{
    const wk = mondayOf(ticketDate(t));
    (weekGroups[wk] = weekGroups[wk]||[]).push(t);
  });
  let totalBetAdmin = 0;
  Object.entries(weekGroups).forEach(([wk, list])=>{
    const descontoPct = cl ? getWeekDiscount(cl, wk) : 0;
    const resultadoW = list.reduce((s,t)=>s+ticketProfit(t),0);
    const descontoW = cl ? computeDescontoAmount(cl, resultadoW, wk) : 0;
    totalBetAdmin += -(cl ? applyDescontoSign(cl, resultadoW, descontoW) : resultadoW);
  });
  const emAbertoAmount = STATE.transactions.filter(t=>t.type==='em_aberto' && t.clientId===clientId && !t.excluded).reduce((s,x)=>s+x.amount,0);
  const totalOwed = totalBetAdmin + emAbertoAmount;
  const totalPaid = getAllSettlementsForClient(clientId);
  return totalOwed - totalPaid;
}
// Devolve o valor (perspectiva admin: positivo = você deve receber) que UMA semana
// específica de UM cliente gerou sozinha, sem misturar com o saldo de outras semanas.
function computeWeekOwedAmount(clientId, weekStart){
  const cl = STATE.clients.find(c=>c.id===clientId);
  if(!cl) return 0;
  const tickets = STATE.tickets.filter(t=>t.clientId===clientId && mondayOf(ticketDate(t))===weekStart && ticketResult(t)!=='pending' && ticketResult(t)!=='void');
  const resultadoW = tickets.reduce((s,t)=>s+ticketProfit(t),0);
  const descontoW = computeDescontoAmount(cl, resultadoW, weekStart);
  return -applyDescontoSign(cl, resultadoW, descontoW);
}

// ---------- CAIXA: só a parte financeira real (o que de fato entrou/saiu) ----------
// As quatro fontes de dinheiro de verdade no sistema. "em_aberto" NUNCA entra aqui —
// é só um marcador de dívida antiga do cliente, não é caixa.
function caixaTotalCalc(){
  const entradasClientes = STATE.settlements.filter(x=>!x.excluded).reduce((s,x)=>s+x.amount,0);
  const retiradas = STATE.withdrawals.filter(x=>!x.excluded).reduce((s,x)=>s+x.amount,0);
  const receitas = STATE.transactions.filter(t=>t.type==='receita' && !t.excluded).reduce((s,x)=>s+x.amount,0);
  const despesas = STATE.transactions.filter(t=>t.type==='despesa' && !t.excluded).reduce((s,x)=>s+x.amount,0);
  return entradasClientes - retiradas + receitas - despesas;
}
// Todas as movimentações reais de caixa, unificadas numa lista só, ordenável por data.
// Inclui as excluídas (marcadas, não removidas de verdade) pra manter auditoria completa.
function getAllCaixaMovements(){
  const list = [];
  STATE.settlements.forEach(s=>{
    list.push({kind:'baixa', id:s.id, date:(s.paidAt||'').slice(0,10), amount:s.amount, excluded:s.excluded, clientId:s.clientId, weekStart:s.weekStart, paidAt:s.paidAt});
  });
  STATE.withdrawals.forEach(w=>{
    list.push({kind:'retirada', id:w.id, date:(w.createdAt||'').slice(0,10), amount:-w.amount, excluded:w.excluded, description:w.description, createdAt:w.createdAt});
  });
  STATE.transactions.filter(t=>t.type==='receita'||t.type==='despesa').forEach(t=>{
    list.push({kind:t.type, id:t.id, date:t.date, amount: t.type==='despesa' ? -t.amount : t.amount, excluded:t.excluded, description:t.description, category:t.category, clientId:t.clientId, createdAt:t.createdAt});
  });
  return list.sort((a,b)=> (b.date||'').localeCompare(a.date||'') || (b.createdAt||b.paidAt||'').localeCompare(a.createdAt||a.paidAt||''));
}
// Caixa acumulado até ANTES da semana informada (não inclui movimentações dela).
function computeCaixaBeforeWeek(weekStart){
  const before = (d)=> d && d < weekStart;
  const entradasClientes = STATE.settlements.filter(x=>!x.excluded && before((x.paidAt||'').slice(0,10))).reduce((s,x)=>s+x.amount,0);
  const retiradas = STATE.withdrawals.filter(x=>!x.excluded && before((x.createdAt||'').slice(0,10))).reduce((s,x)=>s+x.amount,0);
  const receitas = STATE.transactions.filter(t=>t.type==='receita' && !t.excluded && before(t.date)).reduce((s,x)=>s+x.amount,0);
  const despesas = STATE.transactions.filter(t=>t.type==='despesa' && !t.excluded && before(t.date)).reduce((s,x)=>s+x.amount,0);
  return entradasClientes - retiradas + receitas - despesas;
}
// Só o que se moveu DURANTE a semana informada (entradas/saídas reais, nada de projeção).
function computeCaixaMovementForWeek(weekStart){
  const weekEnd = shiftWeek(weekStart, 6);
  const inWeek = (d)=> d && d>=weekStart && d<=weekEnd;
  const settlementsW = STATE.settlements.filter(s=>!s.excluded && inWeek((s.paidAt||'').slice(0,10)));
  const withdrawalsW = STATE.withdrawals.filter(w=>!w.excluded && inWeek((w.createdAt||'').slice(0,10)));
  const receitasW = STATE.transactions.filter(t=>t.type==='receita' && !t.excluded && inWeek(t.date));
  const despesasW = STATE.transactions.filter(t=>t.type==='despesa' && !t.excluded && inWeek(t.date));
  const entradas = settlementsW.reduce((s,x)=>s+x.amount,0) + receitasW.reduce((s,x)=>s+x.amount,0);
  const saidas = withdrawalsW.reduce((s,x)=>s+x.amount,0) + despesasW.reduce((s,x)=>s+x.amount,0);
  return {entradas, saidas, liquido: entradas-saidas, settlementsW, withdrawalsW, receitasW, despesasW};
}

// ---------- IMAGEM DE FECHAMENTO ----------
function roundRect(ctx,x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);
  ctx.arcTo(x,y,x+w,y,r);
  ctx.closePath();
}
