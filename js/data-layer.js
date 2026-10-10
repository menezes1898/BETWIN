// O Supabase/PostgREST limita cada requisição a um número máximo de linhas (por padrão, 1000 —
// configurável em Project Settings > API > Max Rows, mas o código não deve depender disso).
// Sem paginação, uma tabela que passa desse teto simplesmente perde as linhas mais novas (as que
// ficam depois do corte, numa consulta ordenada crescente) — foi exatamente isso que fez apostas
// novas "sumirem" ao atualizar a página depois que a tabela 'tickets' passou de 1000 linhas.
// Esta função busca TODAS as linhas, avançando em blocos, não importa quantas existam.
async function fetchAllRows(table, orderColumn){
  const PAGE_SIZE = 1000;
  let allRows = [];
  let from = 0;
  while(true){
    let q = supabaseClient.from(table).select('*');
    if(orderColumn) q = q.order(orderColumn);
    const {data, error} = await q.range(from, from + PAGE_SIZE - 1);
    if(error) return {data: null, error};
    allRows = allRows.concat(data || []);
    if(!data || data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return {data: allRows, error: null};
}

async function loadState(){
  try{
    const [{data: clients, error: err1}, {data: tickets, error: err2}, {data: settlements, error: err3}, {data: withdrawals, error: err4}, {data: transactions, error: err5}, {data: commissioners, error: err6}, {data: commissionerClients, error: err7}, {data: weekDiscounts, error: err8}, {data: weekCommissioners, error: err9}, {data: discountHistory, error: err10}, {data: profiles, error: err11}, {data: whatsappGroups, error: err12}, {data: partners, error: err13}, {data: partnerClients, error: err14}] = await Promise.all([
      fetchAllRows('clients', 'created_at'),
      fetchAllRows('tickets', 'created_at'),
      fetchAllRows('settlements', 'paid_at'),
      fetchAllRows('withdrawals', 'created_at'),
      fetchAllRows('transactions', 'date'),
      fetchAllRows('commissioners', 'created_at'),
      fetchAllRows('commissioner_clients', 'created_at'),
      fetchAllRows('client_week_discount'),
      fetchAllRows('client_week_commissioners'),
      fetchAllRows('client_discount_history'),
      fetchAllRows('profiles'),
      fetchAllRows('whatsapp_groups', 'created_at'),
      fetchAllRows('partners', 'created_at'),
      fetchAllRows('partner_clients', 'created_at')
    ]);
    if(err1 || err2 || err3 || err4 || err5 || err6 || err7 || err8 || err9 || err10){
      showToast('Erro ao conectar no Supabase: '+((err1||err2||err3||err4||err5||err6||err7||err8||err9||err10).message)+'\nVerifique a URL e a ANON KEY no início do arquivo.');
      return;
    }
    // profiles e whatsapp_groups são opcionais (só existem depois de rodar a migração correspondente)
    // — não travam o sistema se ainda não existirem.
    STATE.profiles = (!err11 && profiles) ? profiles.map(p=>({id:p.id, name:p.name})) : [];
    STATE.whatsappGroups = (!err12 && whatsappGroups) ? whatsappGroups.map(g=>({id:g.id, name:g.name})) : [];
    // partners / partner_clients (Parcerias) também são opcionais até rodar a migração.
    STATE.partners = (!err13 && partners) ? partners.map(p=>({id:p.id, name:p.name, phone:p.phone||'', code:p.code||''})) : [];
    STATE.partnerClients = (!err14 && partnerClients) ? partnerClients.map(pc=>({id:pc.id, partnerId:pc.partner_id, clientId:pc.client_id, percent:parseFloat(pc.percent)||0, effectiveFromWeek:pc.effective_from_week||null})) : [];
    STATE.clients = (clients||[]).map(c=>({id:c.id, name:c.name, code:c.code, discount:parseFloat(c.discount)||0, phone:c.phone||'', isDescarga:c.is_descarga||false}));
    STATE.tickets = (tickets||[]).map(t=>({
      id:t.id, clientId:t.client_id, date:t.date, time: t.time ? t.time.slice(0,5) : null,
      stake: parseFloat(t.stake), odds: t.odds!=null ? parseFloat(t.odds) : null, matches: t.matches||[],
      createdAt: t.created_at, ticketNumber: t.ticket_number,
      createdBy: t.created_by||null, conferido: t.conferido||false, conferidoAt: t.conferido_at||null, conferidoBy: t.conferido_by||null
    }));
    STATE.settlements = (settlements||[]).map(s=>({
      id:s.id, clientId:s.client_id, weekStart:s.week_start, amount:parseFloat(s.amount), paidAt:s.paid_at, excluded:s.excluded||false, createdBy:s.created_by||null
    }));
    STATE.withdrawals = (withdrawals||[]).map(w=>({
      id:w.id, amount:parseFloat(w.amount), description:w.description||'', createdAt:w.created_at, excluded:w.excluded||false, createdBy:w.created_by||null
    }));
    STATE.transactions = (transactions||[]).map(t=>({
      id:t.id, type:t.type, category:t.category||'', description:t.description||'', amount:parseFloat(t.amount), date:t.date, createdAt:t.created_at, clientId:t.client_id||null, excluded:t.excluded||false, createdBy:t.created_by||null, commissionerId:t.commissioner_id||null, partnerId:t.partner_id||null, weekStart:t.week_start||null
    }));
    STATE.commissioners = (commissioners||[]).map(c=>({id:c.id, name:c.name, phone:c.phone||'', code:c.code||''}));
    STATE.commissionerClients = (commissionerClients||[]).map(cc=>({
      id:cc.id, commissionerId:cc.commissioner_id, clientId:cc.client_id, percent:parseFloat(cc.percent)||0, effectiveFromWeek:cc.effective_from_week||null
    }));
    STATE.clientWeekDiscounts = (weekDiscounts||[]).map(d=>({
      id:d.id, clientId:d.client_id, weekStart:d.week_start, discountPercent:parseFloat(d.discount_percent)||0
    }));
    STATE.clientWeekCommissioners = (weekCommissioners||[]).map(w=>({
      id:w.id, clientId:w.client_id, weekStart:w.week_start, commissionerId:w.commissioner_id||null, percent:w.percent!=null?parseFloat(w.percent):null
    }));
    STATE.clientDiscountHistory = (discountHistory||[]).map(h=>({
      id:h.id, clientId:h.client_id, discountPercent:parseFloat(h.discount_percent)||0, effectiveFromWeek:h.effective_from_week||null
    }));
  }catch(e){
    showToast('Erro ao conectar no Supabase: '+e.message);
  }
}

