function uid(){ return Math.random().toString(36).slice(2,9); }
function todaySP(){
  return new Date().toLocaleDateString('en-CA', {timeZone:'America/Sao_Paulo'});
}
function nowTimeSP(){
  return new Date().toLocaleTimeString('en-GB', {timeZone:'America/Sao_Paulo', hour:'2-digit', minute:'2-digit'});
}
function handleAutocompleteKeydown(e, listId){
  const box = document.getElementById(listId);
  if(!box || box.style.display==='none' || !box.innerHTML.trim()) return;
  const items = Array.from(box.querySelectorAll('.autocomplete-item'));
  if(items.length===0) return;
  let idx = items.findIndex(it=>it.classList.contains('autocomplete-active'));
  if(e.key==='ArrowDown'){
    e.preventDefault();
    idx = (idx+1) % items.length;
    items.forEach(it=>it.classList.remove('autocomplete-active'));
    items[idx].classList.add('autocomplete-active');
    items[idx].scrollIntoView({block:'nearest'});
  } else if(e.key==='ArrowUp'){
    e.preventDefault();
    idx = idx<=0 ? items.length-1 : idx-1;
    items.forEach(it=>it.classList.remove('autocomplete-active'));
    items[idx].classList.add('autocomplete-active');
    items[idx].scrollIntoView({block:'nearest'});
  } else if(e.key==='Enter'){
    e.preventDefault();
    const active = items[idx>=0?idx:0];
    if(active) active.dispatchEvent(new MouseEvent('mousedown', {bubbles:true}));
  } else if(e.key==='Escape'){
    box.style.display='none';
  }
}
function fmtBRL(v){ return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v); }
function fmtDate(d){ if(!d) return ''; const [y,m,day]=d.split('-'); return `${day}/${m}`; }

function mondayOf(dateStr){
  const d = new Date(dateStr+'T00:00:00');
  const day = d.getDay();
  const diff = (day===0?-6:1-day);
  d.setDate(d.getDate()+diff);
  return d.toISOString().slice(0,10);
}
function weekLabel(mondayStr){
  const d = new Date(mondayStr+'T00:00:00');
  const sun = new Date(d); sun.setDate(d.getDate()+6);
  const f = x=>x.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'});
  return `${f(d)} – ${f(sun)}`;
}

// ---------- TICKET (bilhete) HELPERS ----------
function ticketDate(ticket){
  return ticket.date || todaySP();
}
function ticketResult(ticket){
  if(!ticket.matches.length) return 'pending';
  if(ticket.matches.some(m=>m.result==='red')) return 'red';
  if(ticket.matches.every(m=>m.result==='void')) return 'void';
  if(ticket.matches.some(m=>m.result==='pending')) return 'pending';
  return 'green';
}
function ticketOddTotal(ticket){
  return ticket.matches.filter(m=>m.result!=='void').reduce((p,m)=>p*m.odd,1);
}
function effectiveOdds(ticket){
  return (ticket.odds && ticket.odds>0) ? ticket.odds : ticketOddTotal(ticket);
}
function ticketProfit(ticket){
  const r = ticketResult(ticket);
  let profit;
  if(r==='red') profit = -ticket.stake;
  else if(r==='green'){ const odds = effectiveOdds(ticket); profit = odds ? (ticket.stake*odds) - ticket.stake : 0; }
  else profit = 0;
  const cl = STATE.clients.find(c=>c.id===ticket.clientId);
  if(cl && cl.isDescarga) profit = -profit;
  return profit;
}
function resultChip(r){
  const map = {green:['chip-green','GREEN'], red:['chip-red','RED'], void:['chip-void','ANULADA'], pending:['chip-pending','PENDENTE']};
  const [cls,label] = map[r]||map.pending;
  return `<span class="chip ${cls}">${label}</span>`;
}
function resultIconSmall(r){
  if(r==='green') return '<span style="color:var(--green);font-weight:700">✓</span>';
  if(r==='red') return '<span style="color:var(--red);font-weight:700">✗</span>';
  if(r==='void') return '<span style="color:var(--text-muted);font-weight:700">⊘</span>';
  return '<span style="color:var(--gold);font-weight:700">⏱</span>';
}
function allWeeksSorted(){
  const set = new Set();
  STATE.tickets.forEach(t=>set.add(mondayOf(ticketDate(t))));
  return Array.from(set).sort().reverse();
}

// ---------- NOTIFICAÇÕES (TOAST) ----------
// Substitui o alert() nativo do navegador por uma notificação discreta, que some sozinha.
function showToast(message, type){
  if(!type){
    type = /erro|inválid|falhou|obrigat[oó]ri/i.test(message) ? 'error' : 'success';
  }
  let container = document.getElementById('toast-container');
  if(!container){
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = 'toast toast-'+type;
  toast.textContent = message;
  container.appendChild(toast);
  requestAnimationFrame(()=> toast.classList.add('toast-show'));
  const remove = ()=>{
    toast.classList.remove('toast-show');
    setTimeout(()=>{ toast.remove(); }, 250);
  };
  const timer = setTimeout(remove, type==='error' ? 5500 : 3200);
  toast.onclick = ()=>{ clearTimeout(timer); remove(); };
}

// ---------- ROOT RENDER ----------
