function renderFinanceiroTab(){
  const weeks = allWeeksSorted();
  if(!FINANCE_WEEK) FINANCE_WEEK = weeks[0] || mondayOf(todaySP());
  return `
    <div class="tabs" style="margin-bottom:16px">
      <div class="tab ${FINANCE_TAB==='caixa'?'active':''}" onclick="FINANCE_TAB='caixa';render()">Caixa</div>
      <div class="tab ${FINANCE_TAB==='clientes'?'active':''}" onclick="FINANCE_TAB='clientes';render()">Clientes</div>
      <div class="tab ${FINANCE_TAB==='relatorios'?'active':''}" onclick="FINANCE_TAB='relatorios';render()">Relatórios</div>
    </div>
    ${FINANCE_TAB==='caixa' ? renderCaixaTab() : FINANCE_TAB==='clientes' ? renderClientesFinanceiroTab() : renderRelatoriosFinanceiroTab()}
  `;
}

// ==================== ABA CAIXA ====================
// Só a parte financeira real: o que já entrou ou saiu de verdade. Nada de projeção
// (a receber/a pagar não entram aqui — isso é da aba Clientes).
function renderCaixaTab(){
  const caixaTotal = caixaTotalCalc();
  const saldoAnterior = computeCaixaBeforeWeek(FINANCE_WEEK);
  const mov = computeCaixaMovementForWeek(FINANCE_WEEK);
  const saldoSemana = saldoAnterior + mov.liquido;

  return `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;flex-wrap:wrap;gap:8px">
        <div>
          <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.4px">Caixa Atual (acumulado)</div>
          <div style="font-family:var(--font-mono);font-size:26px;font-weight:700;margin-top:4px" class="${caixaTotal>=0?'profit-pos':'profit-neg'}">${fmtBRL(caixaTotal)}</div>
        </div>
        <div style="display:flex;align-items:center;gap:14px">
          <button class="btn-ghost btn-sm" onclick="changeFinanceWeek(-1)">‹</button>
          <span style="font-family:var(--font-mono);font-size:13px;font-weight:600">${weekLabel(FINANCE_WEEK)}</span>
          <button class="btn-ghost btn-sm" onclick="changeFinanceWeek(1)">›</button>
        </div>
      </div>
      <div class="row" style="gap:22px;margin-top:18px;padding-top:16px;border-top:1px solid var(--line-soft)">
        <div><div style="font-size:11px;color:var(--text-muted);text-transform:uppercase">Saldo Anterior</div><div style="font-family:var(--font-mono);font-size:16px;margin-top:4px" class="${saldoAnterior>=0?'profit-pos':'profit-neg'}">${fmtBRL(saldoAnterior)}</div></div>
        <div><div style="font-size:11px;color:var(--text-muted);text-transform:uppercase">Entradas da Semana</div><div style="font-family:var(--font-mono);font-size:16px;margin-top:4px" class="profit-pos">${fmtBRL(mov.entradas)}</div></div>
        <div><div style="font-size:11px;color:var(--text-muted);text-transform:uppercase">Saídas da Semana</div><div style="font-family:var(--font-mono);font-size:16px;margin-top:4px" class="profit-neg">${fmtBRL(mov.saidas)}</div></div>
        <div><div style="font-size:11px;color:var(--text-muted);text-transform:uppercase">Saldo da Semana</div><div style="font-family:var(--font-mono);font-size:16px;font-weight:700;margin-top:4px" class="${saldoSemana>=0?'profit-pos':'profit-neg'}">${fmtBRL(saldoSemana)}</div></div>
      </div>
    </div>
    ${renderMovimentacoesSection()}
    ${renderRetiradasSection()}
    ${renderLancamentosSection()}
  `;
}

// Histórico unificado de TUDO que é dinheiro de verdade (baixas de cliente, retiradas,
// receitas e despesas) — em ordem cronológica, com as excluídas visíveis (auditoria),
// marcadas e com opção de restaurar.
function renderMovimentacoesSection(){
  const all = getAllCaixaMovements();
  const visible = SHOW_EXCLUIDAS ? all : all.filter(m=>!m.excluded);
  const excludedCount = all.filter(m=>m.excluded).length;
  const kindLabel = {baixa:'Baixa de cliente', retirada:'Retirada', receita:'Receita', despesa:'Despesa'};
  return `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
        <h3 style="margin:0">Histórico de Movimentações</h3>
        ${excludedCount>0 ? `<label style="display:flex;align-items:center;gap:6px;cursor:pointer;margin:0;text-transform:none;font-size:12px;color:var(--text-muted)"><input type="checkbox" style="width:auto" ${SHOW_EXCLUIDAS?'checked':''} onchange="SHOW_EXCLUIDAS=this.checked;render()"> Mostrar excluídas (${excludedCount})</label>` : ''}
      </div>
      <div style="margin-top:12px">
        ${visible.length===0 ? '<div class="empty">Nenhuma movimentação registrada ainda.</div>' : visible.map(m=>{
          const cl = m.clientId ? STATE.clients.find(c=>c.id===m.clientId) : null;
          let desc = kindLabel[m.kind];
          if(m.kind==='baixa') desc += cl ? ' — '+cl.name : '';
          else if(m.description) desc += ' — '+m.description;
          if(m.category) desc += ' ('+m.category+')';
          return `
          <div class="match-row" style="${m.excluded?'opacity:0.5':''}">
            <div class="match-desc">
              <span class="teams">${desc}${m.excluded?' <span class="chip chip-void">EXCLUÍDA</span>':''}</span>
              <span class="meta">${fmtDate(m.date)}${m.kind==='baixa'&&m.weekStart?' · semana de '+weekLabel(m.weekStart):''}</span>
            </div>
            <div class="match-actions">
              <span style="font-family:var(--font-mono);font-size:13px" class="${m.amount>=0?'profit-pos':'profit-neg'}">${m.amount>=0?'+':'-'}${fmtBRL(Math.abs(m.amount))}</span>
              ${m.excluded
                ? `<button class="btn-ghost btn-sm" onclick="restaurarMovimentacao('${m.kind}','${m.id}')">Restaurar</button>`
                : `<button class="btn-danger-ghost btn-sm" onclick="excluirMovimentacao('${m.kind}','${m.id}')">Excluir</button>`}
            </div>
          </div>
        `;}).join('')}
      </div>
    </div>
  `;
}
async function excluirMovimentacao(kind, id){
  if(!confirm('Excluir essa movimentação? Ela sai do caixa, mas continua no histórico marcada como excluída (você pode restaurar depois).')) return;
  const table = kind==='baixa' ? 'settlements' : kind==='retirada' ? 'withdrawals' : 'transactions';
  const {error} = await supabaseClient.from(table).update({excluded:true}).eq('id', id);
  if(error){ showToast('Erro ao excluir: '+error.message); return; }
  const list = kind==='baixa' ? STATE.settlements : kind==='retirada' ? STATE.withdrawals : STATE.transactions;
  const item = list.find(x=>x.id===id);
  if(item) item.excluded = true;
  render();
}
async function restaurarMovimentacao(kind, id){
  const table = kind==='baixa' ? 'settlements' : kind==='retirada' ? 'withdrawals' : 'transactions';
  const {error} = await supabaseClient.from(table).update({excluded:false}).eq('id', id);
  if(error){ showToast('Erro ao restaurar: '+error.message); return; }
  const list = kind==='baixa' ? STATE.settlements : kind==='retirada' ? STATE.withdrawals : STATE.transactions;
  const item = list.find(x=>x.id===id);
  if(item) item.excluded = false;
  render();
}

// ==================== ABA CLIENTES ====================
// Só o que é dívida/crédito com cliente (projeção — ainda não é caixa até virar baixa).
function renderClientesFinanceiroTab(){
  const rows = STATE.clients.map(cl=>{
    const remaining = computeContinuousBalance(cl.id, null);
    if(Math.abs(remaining) < 0.01) return null;
    const totalPaid = getAllSettlementsForClient(cl.id);
    const status = totalPaid>0 ? 'parcial' : 'pendente';
    const openTransactions = STATE.transactions.filter(t=>t.type==='em_aberto' && t.clientId===cl.id && !t.excluded);
    const emAbertoAmount = openTransactions.reduce((s,x)=>s+x.amount,0);
    const remainingAnterior = computeContinuousBalance(cl.id, FINANCE_WEEK);
    const remainingSemanaAtual = remaining - remainingAnterior;
    const pendentesCliente = STATE.tickets.filter(t=>t.clientId===cl.id && ticketResult(t)==='pending');
    const pendentesValor = pendentesCliente.reduce((s,t)=>s+t.stake,0);
    return {id:cl.id, name:cl.name, remaining, totalPaid, status, emAbertoAmount, remainingAnterior, remainingSemanaAtual, pendentesCount:pendentesCliente.length, pendentesValor};
  }).filter(Boolean);

  const receberContinuo = rows.filter(r=>r.remaining>0).reduce((s,r)=>s+r.remaining,0);

  const weekTicketsByClient = {};
  STATE.tickets.filter(t=>mondayOf(ticketDate(t))===FINANCE_WEEK && ticketResult(t)!=='pending' && ticketResult(t)!=='void').forEach(t=>{
    (weekTicketsByClient[t.clientId] = weekTicketsByClient[t.clientId]||[]).push(t);
  });
  let pagarSemana = 0;
  Object.entries(weekTicketsByClient).forEach(([clientId, tks])=>{
    const cl = STATE.clients.find(c=>c.id===clientId);
    const resultadoW = tks.reduce((s,t)=>s+ticketProfit(t),0);
    const descontoW = cl ? computeDescontoAmount(cl, resultadoW, FINANCE_WEEK) : 0;
    const adminAmount = -(cl ? applyDescontoSign(cl, resultadoW, descontoW) : resultadoW);
    if(adminAmount<0) pagarSemana += Math.abs(adminAmount);
  });

  return `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
        <h3 style="margin:0">Clientes</h3>
        <div style="display:flex;align-items:center;gap:14px">
          <button class="btn-ghost btn-sm" onclick="changeFinanceWeek(-1)">‹</button>
          <span style="font-family:var(--font-mono);font-size:13px;font-weight:600">${weekLabel(FINANCE_WEEK)}</span>
          <button class="btn-ghost btn-sm" onclick="changeFinanceWeek(1)">›</button>
        </div>
      </div>
      <div class="row" style="gap:22px">
        <div><div style="font-size:11px;color:var(--text-muted);text-transform:uppercase">A receber (total pendente)</div><div style="font-family:var(--font-mono);font-size:18px;margin-top:4px" class="profit-pos">${fmtBRL(receberContinuo)}</div></div>
        <div><div style="font-size:11px;color:var(--text-muted);text-transform:uppercase">A pagar nessa semana</div><div style="font-family:var(--font-mono);font-size:18px;margin-top:4px" class="profit-neg">${fmtBRL(pagarSemana)}</div></div>
      </div>
    </div>
    <div class="card">
      <h3>Situação por cliente <span style="font-size:12px;color:var(--text-muted);font-weight:400">(saldo contínuo — some só quando quitado)</span></h3>
      <div style="margin-bottom:12px"><button class="btn-ghost btn-sm" onclick="exportSituacaoClientesCSV()">⬇ Exportar CSV</button></div>
      ${rows.length===0 ? '<div class="empty">Nenhum saldo pendente no momento.</div>' : rows.map(r=>`
        <div class="match-row" style="gap:10px">
          <div class="match-desc" style="flex:1;min-width:220px;overflow:hidden">
            <span class="teams" style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.name}</span>
            <span class="meta" style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
              ${r.remaining>=0?'A receber':'A pagar'}
              ${r.emAbertoAmount ? ` (inclui saldo em aberto de ${fmtBRL(Math.abs(r.emAbertoAmount))})` : ''}
              ${r.status==='parcial' ? ` — já ${r.totalPaid>=0?'recebido':'pago'} ${fmtBRL(Math.abs(r.totalPaid))} no total` : ''}
            </span>
            <span class="meta" style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:2px;opacity:0.85">
              Semanas anteriores: ${fmtBRL(r.remainingAnterior)} · Semana em curso: ${fmtBRL(r.remainingSemanaAtual)}
              ${r.pendentesCount>0 ? ` · <span style="color:var(--gold)">${r.pendentesCount} pendente(s) de ${fmtBRL(r.pendentesValor)} ainda não entram nessa conta</span>` : ''}
            </span>
          </div>
          <div class="match-actions" style="flex-wrap:wrap">
            <span title="Saldo pendente acumulado, considerando todas as semanas e pagamentos já feitos" style="font-family:var(--font-mono);font-size:15px;font-weight:700;cursor:help;border-bottom:1px dotted currentColor" class="${r.remaining>=0?'profit-pos':'profit-neg'}">${fmtBRL(Math.abs(r.remaining))}</span>
            ${r.status==='parcial' ? `<span class="chip chip-pending">PARCIAL</span>` : `<span class="chip chip-pending">PENDENTE</span>`}
            <button class="btn-ghost btn-sm" onclick="darBaixa('${r.id}','${FINANCE_WEEK}',${r.remaining})">Dar baixa</button>
            ${r.status==='parcial' ? `<button class="btn-ghost btn-sm" onclick="desfazerUltimaBaixa('${r.id}')">Desfazer última</button>` : ''}
          </div>
        </div>
      `).join('')}
    </div>
    ${renderComissoesSection()}
  `;
}

// ==================== ABA RELATÓRIOS ====================
function renderRelatoriosFinanceiroTab(){
  return renderRelatorioPeriodoSection();
}

// ---------- RELATÓRIO POR PERÍODO ----------
// Sempre soma semana a semana, usando exatamente as mesmas funções de desconto/comissão
// usadas no resto do sistema — evita relatório "diário" que corte o desconto/comissão de
// forma errada (esses dois conceitos são calculados em cima do resultado da SEMANA inteira).
function computeReportForWeekRange(startWeek, endWeek){
  const weeks = allWeeksSorted().filter(w => w>=startWeek && w<=endWeek);
  let volume=0, resultado=0, desconto=0, comissao=0;
  const porCliente = {};
  weeks.forEach(wk=>{
    STATE.clients.forEach(cl=>{
      const tickets = STATE.tickets.filter(t=>t.clientId===cl.id && mondayOf(ticketDate(t))===wk && ticketResult(t)!=='void');
      if(tickets.length===0) return;
      const volumeC = tickets.reduce((s,t)=>s+t.stake,0);
      const resultadoC = tickets.reduce((s,t)=>s+ticketProfit(t),0);
      const descontoC = computeDescontoAmount(cl, resultadoC, wk);
      const activeCommissioners = getActiveCommissionersForWeek(cl.id, wk);
      const comissaoC = activeCommissioners.reduce((s,a)=>s+computeCommissionAmount(cl.id, a.percent, wk),0);
      volume += volumeC; resultado += resultadoC; desconto += descontoC; comissao += comissaoC;
      if(!porCliente[cl.id]) porCliente[cl.id] = {name:cl.name, volume:0, resultado:0, desconto:0, comissao:0};
      porCliente[cl.id].volume += volumeC;
      porCliente[cl.id].resultado += resultadoC;
      porCliente[cl.id].desconto += descontoC;
      porCliente[cl.id].comissao += comissaoC;
    });
  });
  const liquido = -resultado - desconto - comissao; // perspectiva admin, igual ao resto do sistema
  return {weeks, volume, resultado, desconto, comissao, liquido, porCliente};
}
function setReportPreset(preset){
  const weeks = allWeeksSorted();
  if(weeks.length===0) return;
  const currentWeek = mondayOf(todaySP());
  if(preset==='essa_semana'){
    REPORT_WEEK_START = currentWeek; REPORT_WEEK_END = currentWeek;
  } else if(preset==='4_semanas'){
    REPORT_WEEK_END = weeks[0];
    REPORT_WEEK_START = weeks[Math.min(3, weeks.length-1)];
  } else if(preset==='esse_mes'){
    const mesAtual = currentWeek.slice(0,7); // YYYY-MM
    const doMes = weeks.filter(w=>w.slice(0,7)===mesAtual);
    REPORT_WEEK_START = doMes[doMes.length-1] || weeks[weeks.length-1];
    REPORT_WEEK_END = doMes[0] || weeks[0];
  }
  render();
}
function updateReportRange(){
  REPORT_WEEK_START = document.getElementById('report-week-start').value;
  REPORT_WEEK_END = document.getElementById('report-week-end').value;
  render();
}
function csvEscape(v){
  const s = String(v);
  return /[",;\n]/.test(s) ? '"'+s.replace(/"/g,'""')+'"' : s;
}
function downloadCSV(filename, rows){
  const content = rows.map(r=>r.map(csvEscape).join(';')).join('\n');
  const blob = new Blob(['\uFEFF'+content], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
function exportRelatorioCSV(){
  const report = computeReportForWeekRange(REPORT_WEEK_START, REPORT_WEEK_END);
  const rows = [['Cliente','Volume','Resultado','Desconto','Comissão']];
  Object.values(report.porCliente).forEach(c=>{
    rows.push([c.name, c.volume.toFixed(2), c.resultado.toFixed(2), c.desconto.toFixed(2), c.comissao.toFixed(2)]);
  });
  rows.push(['Total', report.volume.toFixed(2), report.resultado.toFixed(2), report.desconto.toFixed(2), report.comissao.toFixed(2)]);
  downloadCSV(`relatorio_${REPORT_WEEK_START}_a_${REPORT_WEEK_END}.csv`, rows);
}
function exportSituacaoClientesCSV(){
  const rows = [['Cliente','Saldo Total','Semanas Anteriores','Semana em Curso','Pendências (qtd)','Pendências (valor)']];
  STATE.clients.forEach(cl=>{
    const remaining = computeContinuousBalance(cl.id, null);
    if(Math.abs(remaining) < 0.01) return;
    const remainingAnterior = computeContinuousBalance(cl.id, FINANCE_WEEK);
    const remainingSemanaAtual = remaining - remainingAnterior;
    const pend = STATE.tickets.filter(t=>t.clientId===cl.id && ticketResult(t)==='pending');
    const pendValor = pend.reduce((s,t)=>s+t.stake,0);
    rows.push([cl.name, remaining.toFixed(2), remainingAnterior.toFixed(2), remainingSemanaAtual.toFixed(2), pend.length, pendValor.toFixed(2)]);
  });
  downloadCSV(`situacao_clientes_${todaySP()}.csv`, rows);
}
function renderRelatorioPeriodoSection(){
  const weeks = allWeeksSorted();
  if(weeks.length===0) return '<div class="card"><div class="empty">Cadastre apostas para ver relatórios.</div></div>';
  if(!REPORT_WEEK_START) REPORT_WEEK_START = weeks[weeks.length-1];
  if(!REPORT_WEEK_END) REPORT_WEEK_END = weeks[0];
  const report = computeReportForWeekRange(REPORT_WEEK_START, REPORT_WEEK_END);
  const clienteRows = Object.values(report.porCliente).sort((a,b)=>a.resultado-b.resultado);
  return `
    <div class="card">
      <h3>Relatório por período</h3>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px">
        <button class="btn-ghost btn-sm" onclick="setReportPreset('essa_semana')">Essa semana</button>
        <button class="btn-ghost btn-sm" onclick="setReportPreset('4_semanas')">Últimas 4 semanas</button>
        <button class="btn-ghost btn-sm" onclick="setReportPreset('esse_mes')">Esse mês</button>
      </div>
      <div class="row">
        <div>
          <label>De (semana)</label>
          <select id="report-week-start" onchange="updateReportRange()">
            ${[...weeks].reverse().map(w=>`<option value="${w}" ${w===REPORT_WEEK_START?'selected':''}>${weekLabel(w)}</option>`).join('')}
          </select>
        </div>
        <div>
          <label>Até (semana)</label>
          <select id="report-week-end" onchange="updateReportRange()">
            ${[...weeks].reverse().map(w=>`<option value="${w}" ${w===REPORT_WEEK_END?'selected':''}>${weekLabel(w)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="row" style="gap:22px;margin-top:16px">
        <div><div style="font-size:11px;color:var(--text-muted);text-transform:uppercase">Volume</div><div style="font-family:var(--font-mono);font-size:17px;margin-top:4px">${fmtBRL(report.volume)}</div></div>
        <div><div style="font-size:11px;color:var(--text-muted);text-transform:uppercase">Resultado</div><div style="font-family:var(--font-mono);font-size:17px;margin-top:4px" class="${-report.resultado>=0?'profit-pos':'profit-neg'}">${fmtBRL(-report.resultado)}</div></div>
        <div><div style="font-size:11px;color:var(--text-muted);text-transform:uppercase">Desconto</div><div style="font-family:var(--font-mono);font-size:17px;margin-top:4px">${fmtBRL(report.desconto)}</div></div>
        <div><div style="font-size:11px;color:var(--text-muted);text-transform:uppercase">Comissão</div><div style="font-family:var(--font-mono);font-size:17px;margin-top:4px;color:var(--gold)">${fmtBRL(report.comissao)}</div></div>
        <div><div style="font-size:11px;color:var(--text-muted);text-transform:uppercase">Líquido</div><div style="font-family:var(--font-mono);font-size:17px;margin-top:4px" class="${report.liquido>=0?'profit-pos':'profit-neg'}">${fmtBRL(report.liquido)}</div></div>
      </div>
      <div style="margin-top:16px"><button class="btn-ghost" onclick="exportRelatorioCSV()">⬇ Exportar CSV</button></div>
    </div>
    <div class="card">
      <h3>Por cliente, no período</h3>
      ${clienteRows.length===0 ? '<div class="empty">Nenhuma aposta nesse período.</div>' : `
      <div style="overflow-x:auto">
      <table>
        <tr><th>Cliente</th><th>Volume</th><th>Resultado</th><th>Desconto</th><th>Comissão</th></tr>
        ${clienteRows.map(c=>`
          <tr>
            <td class="left">${c.name}</td>
            <td class="num">${fmtBRL(c.volume)}</td>
            <td class="num ${c.resultado>=0?'profit-pos':'profit-neg'}">${fmtBRL(c.resultado)}</td>
            <td class="num">${c.desconto>0?fmtBRL(c.desconto):'—'}</td>
            <td class="num" style="${c.comissao>0?'color:var(--gold)':''}">${c.comissao>0?fmtBRL(c.comissao):'—'}</td>
          </tr>
        `).join('')}
      </table>
      </div>
      `}
    </div>
  `;
}

async function darBaixa(clientId, weekStart, remaining){
  const isReceber = remaining>=0;
  const label = isReceber ? 'Valor recebido agora' : 'Valor pago agora';
  const defaultVal = Math.abs(remaining).toFixed(2).replace('.',',');
  const input = prompt(`${label} (falta ${fmtBRL(Math.abs(remaining))}):`, defaultVal);
  if(input===null) return;
  const val = parseFloat(String(input).replace(',','.'));
  if(isNaN(val) || val<=0){ showToast('Valor inválido.'); return; }
  const amount = isReceber ? val : -val;
  const {data, error} = await supabaseClient.from('settlements').insert({client_id: clientId, week_start: weekStart, amount}).select().single();
  if(error){ showToast('Erro ao dar baixa: '+error.message); return; }
  STATE.settlements.push({id:data.id, clientId:data.client_id, weekStart:data.week_start, amount:parseFloat(data.amount), paidAt:data.paid_at, excluded:false});
  showToast('Baixa registrada com sucesso!');
  render();
}
async function desfazerUltimaBaixa(clientId){
  const list = STATE.settlements.filter(s=>s.clientId===clientId && !s.excluded).sort((a,b)=>a.paidAt.localeCompare(b.paidAt));
  const last = list[list.length-1];
  if(!last) return;
  if(!confirm('Desfazer a última baixa registrada para esse cliente? (fica marcada como excluída, dá pra restaurar depois)')) return;
  const {error} = await supabaseClient.from('settlements').update({excluded:true}).eq('id', last.id);
  if(error){ showToast('Erro ao desfazer baixa: '+error.message); return; }
  last.excluded = true;
  render();
}

// ---------- COMISSÕES ----------
function renderComissoesSection(){
  const weekMonday = FINANCE_WEEK || mondayOf(todaySP());
  const totals = {}; // commissionerId -> {amount, count}
  STATE.clients.forEach(cl=>{
    const active = getActiveCommissionersForWeek(cl.id, weekMonday);
    active.forEach(a=>{
      const amount = computeCommissionAmount(cl.id, a.percent, weekMonday);
      if(amount<=0) return;
      if(!totals[a.commissionerId]) totals[a.commissionerId] = {amount:0, count:0};
      totals[a.commissionerId].amount += amount;
      totals[a.commissionerId].count += 1;
    });
  });
  const rows = Object.entries(totals).map(([commissionerId, v])=>{
    const cm = STATE.commissioners.find(c=>c.id===commissionerId);
    return {id:commissionerId, name:cm?cm.name:'Comissionado removido', amount:v.amount, count:v.count};
  });
  const total = rows.reduce((s,r)=>s+r.amount,0);
  return `
    <div class="card" style="cursor:pointer" onclick="SHOW_COMISSOES=!SHOW_COMISSOES;render()">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span class="chip chip-pending">COMISSÕES DA SEMANA</span>
        <span style="font-family:var(--font-mono);font-size:14px;color:var(--gold)">${fmtBRL(total)}</span>
      </div>
    </div>
    ${SHOW_COMISSOES ? `
    <div class="card">
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:10px">Semana de ${weekLabel(weekMonday)} · calculada em cima da perda bruta dos clientes vinculados naquela semana (antes do desconto do cliente)</div>
      ${rows.length===0 ? '<div class="empty">Nenhuma comissão essa semana.</div>' : rows.map(r=>`
        <div class="match-row">
          <div class="match-desc">
            <span class="teams">${r.name}</span>
            <span class="meta">${r.count} cliente(s) com perda essa semana</span>
          </div>
          <div class="match-actions">
            <span style="font-family:var(--font-mono);font-size:13px;font-weight:700;color:var(--gold)">${fmtBRL(r.amount)}</span>
            <button class="btn-ghost btn-sm" onclick="registrarPagamentoComissao('${r.id}','${r.name.replace(/'/g,"\\'")}',${r.amount},'${weekMonday}')">Registrar pagamento</button>
          </div>
        </div>
      `).join('')}
    </div>
    ` : ''}
  `;
}
async function registrarPagamentoComissao(commissionerId, name, amount, weekMonday){
  if(amount<=0){ showToast('Não há comissão a pagar essa semana pra esse comissionado.'); return; }
  if(!confirm(`Registrar pagamento de ${fmtBRL(amount)} de comissão pra ${name}? Isso entra como uma despesa no seu caixa.`)) return;
  const description = `Comissão — ${name} (semana ${weekLabel(weekMonday)})`;
  const {data, error} = await supabaseClient.from('transactions').insert({
    type:'despesa', category:'Comissão', description, amount, date: todaySP()
  }).select().single();
  if(error){ showToast('Erro ao registrar pagamento: '+error.message); return; }
  STATE.transactions.push({id:data.id, type:data.type, category:data.category||'', description:data.description||'', amount:parseFloat(data.amount), date:data.date, createdAt:data.created_at, clientId:data.client_id||null, excluded:false});
  await pruneTransactions();
  render();
}

// ---------- RETIRADAS ----------
function renderRetiradasSection(){
  const list = [...STATE.withdrawals].filter(w=>!w.excluded).sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
  const totalRetiradas = list.reduce((s,x)=>s+x.amount,0);
  return `
    <div class="card" style="cursor:pointer" onclick="SHOW_RETIRADAS=!SHOW_RETIRADAS;render()">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span class="chip chip-pending">RETIRADAS</span>
        <span style="font-family:var(--font-mono);font-size:14px;color:var(--gold)">${fmtBRL(totalRetiradas)}</span>
      </div>
    </div>
    ${SHOW_RETIRADAS ? `
    <div class="card">
      <h3>Nova retirada</h3>
      <label>Valor</label>
      <input type="number" id="new-withdrawal-amount" step="0.01" placeholder="Valor (ex: 500,00)">
      <label>Descrição (opcional)</label>
      <input type="text" id="new-withdrawal-desc" placeholder="Ex: Retirada pessoal">
      <div style="margin-top:14px"><button class="btn-primary" onclick="addWithdrawal()">Registrar retirada</button></div>
    </div>
    ` : ''}
  `;
}
async function addWithdrawal(){
  const amount = parseFloat(document.getElementById('new-withdrawal-amount').value);
  const description = document.getElementById('new-withdrawal-desc').value.trim();
  if(!amount || amount<=0){ showToast('Informe o valor da retirada.'); return; }
  const {data, error} = await supabaseClient.from('withdrawals').insert({amount, description}).select().single();
  if(error){ showToast('Erro ao registrar retirada: '+error.message); return; }
  STATE.withdrawals.push({id:data.id, amount:parseFloat(data.amount), description:data.description||'', createdAt:data.created_at, excluded:false});
  showToast('Retirada registrada!');
  render();
}
async function deleteWithdrawal(id){
  if(!confirm('Excluir esse registro de retirada? (fica marcado como excluído, dá pra restaurar depois)')) return;
  const {error} = await supabaseClient.from('withdrawals').update({excluded:true}).eq('id', id);
  if(error){ showToast('Erro ao excluir retirada: '+error.message); return; }
  const w = STATE.withdrawals.find(x=>x.id===id);
  if(w) w.excluded = true;
  render();
}

// ---------- SALDO EM ABERTO (dívida antiga, não conta no caixa) ----------
function renderLancamentosSection(){
  const emAberto = STATE.transactions.filter(t=>t.type==='em_aberto' && !t.excluded);
  const totalEmAberto = emAberto.reduce((s,x)=>s+x.amount,0);

  return `
    <div class="card" style="cursor:pointer" onclick="SHOW_LANCAMENTOS=!SHOW_LANCAMENTOS;render()">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span class="chip chip-pending">SALDO EM ABERTO <span style="opacity:0.7">(não conta no caixa)</span></span>
        <span style="font-family:var(--font-mono);font-size:14px;color:var(--gold)">${fmtBRL(totalEmAberto)}</span>
      </div>
    </div>
    ${SHOW_LANCAMENTOS ? `
    <div class="card">
      <h3>Registrar saldo em aberto</h3>
      <p style="font-size:12px;color:var(--text-muted);margin-top:0">Pra corrigir uma dívida antiga de um cliente que não veio de apostas registradas aqui. Isso entra na conta do cliente, mas <strong>não</strong> é dinheiro de verdade no caixa até você dar baixa nele.</p>
      <label>Cliente</label>
      <div class="autocomplete-wrap">
        <input type="text" id="new-transaction-client-search" placeholder="Buscar cliente…" autocomplete="off"
          oninput="filterTransactionClientOptions()" onfocus="filterTransactionClientOptions()" onkeydown="handleAutocompleteKeydown(event,'transaction-client-options')"
          onblur="setTimeout(()=>{const b=document.getElementById('transaction-client-options'); if(b) b.style.display='none';},150)">
        <input type="hidden" id="new-transaction-client-id" value="">
        <div id="transaction-client-options" class="autocomplete-list"></div>
      </div>
      <label>Descrição</label>
      <input type="text" id="new-transaction-desc" placeholder="Ex: Saldo antigo de antes do sistema">
      <label>Valor</label>
      <input type="number" id="new-transaction-amount" step="0.01" placeholder="Valor (ex: 150,00)">
      <input type="hidden" id="new-transaction-type" value="em_aberto">
      <input type="hidden" id="new-transaction-category" value="">
      <input type="hidden" id="new-transaction-date" value="${todaySP()}">
      <div style="margin-top:14px"><button class="btn-primary" onclick="addTransaction()">Registrar</button></div>
    </div>
    <div class="card">
      <h3>Em aberto — histórico</h3>
      ${emAberto.length===0 ? '<div class="empty">Nenhum saldo em aberto registrado.</div>' : emAberto.map(t=>{
        const linkedClient = t.clientId ? STATE.clients.find(c=>c.id===t.clientId) : null;
        return `
        <div class="match-row">
          <div class="match-desc">
            <span class="teams">${t.description || 'Em Aberto'}${linkedClient?' — '+linkedClient.name:''}</span>
            <span class="meta">${fmtDate(t.date)}</span>
          </div>
          <div class="match-actions">
            <span style="font-family:var(--font-mono);font-size:13px;color:var(--gold)">${fmtBRL(t.amount)}</span>
            <button class="btn-ghost btn-sm" onclick="marcarComoRecebido('${t.id}')">Marcar recebido</button>
            <button class="btn-danger-ghost btn-sm" onclick="deleteTransaction('${t.id}')">Excluir</button>
          </div>
        </div>
      `;}).join('')}
    </div>
    ` : ''}
  `;
}
function filterTransactionClientOptions(){
  const input = document.getElementById('new-transaction-client-search');
  const box = document.getElementById('transaction-client-options');
  const val = input.value.trim().toLowerCase();
  document.getElementById('new-transaction-client-id').value = '';
  if(val.length < 2){ box.style.display='none'; box.innerHTML=''; return; }
  const matches = STATE.clients.filter(c=>c.name.toLowerCase().includes(val));
  if(matches.length===0){
    box.innerHTML = '<div class="autocomplete-item" style="cursor:default;color:var(--text-muted)">Nenhum cliente encontrado</div>';
  } else {
    box.innerHTML = matches.map(c=>`<div class="autocomplete-item" onmousedown="selectTransactionClientOption('${c.id}')">${c.name}</div>`).join('');
  }
  box.style.display='block';
}
function selectTransactionClientOption(id){
  const cl = STATE.clients.find(c=>c.id===id);
  if(!cl) return;
  document.getElementById('new-transaction-client-id').value = id;
  document.getElementById('new-transaction-client-search').value = cl.name;
  const box = document.getElementById('transaction-client-options');
  box.style.display='none'; box.innerHTML='';
}
async function marcarComoRecebido(id){
  const {error} = await supabaseClient.from('transactions').update({type:'receita'}).eq('id', id);
  if(error){ showToast('Erro ao atualizar: '+error.message); return; }
  const t = STATE.transactions.find(x=>x.id===id);
  if(t) t.type = 'receita';
  render();
}
async function addTransaction(){
  const type = document.getElementById('new-transaction-type').value;
  const category = document.getElementById('new-transaction-category').value.trim();
  const clientId = document.getElementById('new-transaction-client-id').value || null;
  const description = document.getElementById('new-transaction-desc').value.trim();
  const amount = parseFloat(document.getElementById('new-transaction-amount').value);
  const date = document.getElementById('new-transaction-date').value;
  if(!date){ showToast('Informe a data.'); return; }
  if(!amount || amount<=0){ showToast('Informe o valor.'); return; }
  const {data, error} = await supabaseClient.from('transactions').insert({type, category, description, amount, date, client_id: clientId}).select().single();
  if(error){ showToast('Erro ao registrar lançamento: '+error.message); return; }
  STATE.transactions.push({id:data.id, type:data.type, category:data.category||'', description:data.description||'', amount:parseFloat(data.amount), date:data.date, createdAt:data.created_at, clientId:data.client_id||null, excluded:false});
  await pruneTransactions();
  showToast('Lançamento registrado!');
  render();
}
async function pruneTransactions(){
  const LIMIT = 100;
  if(STATE.transactions.length <= LIMIT) return;
  const sorted = [...STATE.transactions].sort((a,b)=> (a.createdAt||'').localeCompare(b.createdAt||''));
  const toRemove = sorted.slice(0, STATE.transactions.length - LIMIT).filter(t=>t.excluded); // só remove de vez as que já estavam excluídas
  for(const t of toRemove){
    await supabaseClient.from('transactions').delete().eq('id', t.id);
  }
  const removeIds = new Set(toRemove.map(t=>t.id));
  STATE.transactions = STATE.transactions.filter(t=>!removeIds.has(t.id));
}
async function deleteTransaction(id){
  if(!confirm('Excluir esse lançamento? (fica marcado como excluído, dá pra restaurar depois)')) return;
  const {error} = await supabaseClient.from('transactions').update({excluded:true}).eq('id', id);
  if(error){ showToast('Erro ao excluir lançamento: '+error.message); return; }
  const t = STATE.transactions.find(x=>x.id===id);
  if(t) t.excluded = true;
  render();
}

// ---------- CLIENT VIEW ----------
