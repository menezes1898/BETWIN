function getSettlementsFor(clientId, weekStart){
  return STATE.settlements.filter(s=>s.clientId===clientId && s.weekStart===weekStart);
}
function getAllSettlementsForClient(clientId){
  return STATE.settlements.filter(s=>s.clientId===clientId).reduce((s,x)=>s+x.amount,0);
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
  const emAbertoAmount = STATE.transactions.filter(t=>t.type==='em_aberto' && t.clientId===clientId).reduce((s,x)=>s+x.amount,0);
  const totalOwed = totalBetAdmin + emAbertoAmount;
  const totalPaid = getAllSettlementsForClient(clientId);
  return totalOwed - totalPaid;
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
