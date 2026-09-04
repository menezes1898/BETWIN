async function loadState(){
  try{
    const [{data: clients, error: err1}, {data: tickets, error: err2}, {data: settlements, error: err3}, {data: withdrawals, error: err4}, {data: transactions, error: err5}, {data: commissioners, error: err6}, {data: commissionerClients, error: err7}, {data: weekDiscounts, error: err8}, {data: weekCommissioners, error: err9}, {data: discountHistory, error: err10}] = await Promise.all([
      supabaseClient.from('clients').select('*').order('created_at'),
      supabaseClient.from('tickets').select('*').order('created_at'),
      supabaseClient.from('settlements').select('*').order('paid_at'),
      supabaseClient.from('withdrawals').select('*').order('created_at'),
      supabaseClient.from('transactions').select('*').order('date'),
      supabaseClient.from('commissioners').select('*').order('created_at'),
      supabaseClient.from('commissioner_clients').select('*').order('created_at'),
      supabaseClient.from('client_week_discount').select('*'),
      supabaseClient.from('client_week_commissioners').select('*'),
      supabaseClient.from('client_discount_history').select('*')
    ]);
    if(err1 || err2 || err3 || err4 || err5 || err6 || err7 || err8 || err9 || err10){
      showToast('Erro ao conectar no Supabase: '+((err1||err2||err3||err4||err5||err6||err7||err8||err9||err10).message)+'\nVerifique a URL e a ANON KEY no início do arquivo.');
      return;
    }
    STATE.clients = (clients||[]).map(c=>({id:c.id, name:c.name, code:c.code, discount:parseFloat(c.discount)||0, phone:c.phone||'', isDescarga:c.is_descarga||false}));
    STATE.tickets = (tickets||[]).map(t=>({
      id:t.id, clientId:t.client_id, date:t.date, time: t.time ? t.time.slice(0,5) : null,
      stake: parseFloat(t.stake), odds: t.odds!=null ? parseFloat(t.odds) : null, matches: t.matches||[],
      createdAt: t.created_at, ticketNumber: t.ticket_number
    }));
    STATE.settlements = (settlements||[]).map(s=>({
      id:s.id, clientId:s.client_id, weekStart:s.week_start, amount:parseFloat(s.amount), paidAt:s.paid_at
    }));
    STATE.withdrawals = (withdrawals||[]).map(w=>({
      id:w.id, amount:parseFloat(w.amount), description:w.description||'', createdAt:w.created_at
    }));
    STATE.transactions = (transactions||[]).map(t=>({
      id:t.id, type:t.type, category:t.category||'', description:t.description||'', amount:parseFloat(t.amount), date:t.date, createdAt:t.created_at, clientId:t.client_id||null
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

