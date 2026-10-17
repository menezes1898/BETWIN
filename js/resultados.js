// Busca automática de resultados (API-Sports) para as partidas pendentes.
// Só resolve sozinho o que tem certeza: o que não der fica pendente e aparece no relatório com o motivo.

// ---------- utilidades de texto ----------
function resSide(text, home, away){          // 'H' | 'A' | 'D' | null
  const t = evtNorm(text);
  if(!t) return null;
  if(t===evtNorm(home)) return 'H';
  if(t===evtNorm(away)) return 'A';
  if(t==='empate' || t==='draw' || t==='x') return 'D';
  return null;
}
// retira do início do texto o time/empate: devolve {side, rest}
function resTakeSide(text, home, away){
  const t = evtNorm(text);
  const cands = [['H',evtNorm(home)],['A',evtNorm(away)],['D','empate']].filter(c=>c[1]).sort((x,y)=>y[1].length-x[1].length);
  for(const [side,name] of cands){
    if(t===name) return {side, rest:''};
    if(t.startsWith(name+' ')) return {side, rest:t.slice(name.length+1).trim()};
  }
  return null;
}
function resLine(text){                       // primeiro número (aceita vírgula)
  const m = String(text).match(/[+-]?\d+(?:[.,]\d+)?/);
  return m ? parseFloat(m[0].replace(',','.')) : null;
}
function resPeriodOf(name){
  if(/Ao Vivo/i.test(name)) return 'live';
  if(/Final do Jogo/i.test(name)) return 'ft';
  if(/2[ºo°] ?Tempo/i.test(name)) return '2h';
  if(/\bHT\b|1[ºo°] ?Tempo|Intervalo/i.test(name)) return '1h';
  return 'ft';
}
function resDomainOf(name){
  if(/^(Cards|Corners|Goals) \d/.test(name)) return 'range';
  if(/Cart|Cards/i.test(name)) return 'cards';
  if(/Escanteio|Corner/i.test(name)) return 'corners';
  if(/Finaliza/i.test(name)) return 'shots';
  if(/Pontos/i.test(name)) return 'points';
  return 'goals';
}

// ---------- avaliação de linhas (inclui linhas asiáticas .25/.75) ----------
function resCmp(diff){ return diff>1e-9 ? 'green' : (diff<-1e-9 ? 'red' : 'void'); }
// diff = valor que a seleção tem que superar (ex.: total - linha  |  (meu+linha) - adversário)
function resMergeHalf(a, b){
  if(a===b) return a;
  return null;      // meia vitória / meia derrota -> não existe no sistema
}
function resEvalWithLine(fn, line){
  // fn(L) -> diff
  const q = Math.abs(line*4 - Math.round(line*4)) < 1e-9 && Math.abs(line*2 - Math.round(line*2)) > 1e-9;
  if(!q) return {r:resCmp(fn(line))};
  const r1 = resCmp(fn(line-0.25)), r2 = resCmp(fn(line+0.25));
  const m = resMergeHalf(r1, r2);
  return m ? {r:m} : {r:'manual', note:'linha asiática com meia vitória/derrota — resolva manualmente'};
}

// ---------- avaliador de uma seleção ----------
// S = placar normalizado do jogo; ctx.events()/ctx.stats() carregam dados extras sob demanda
async function resEvalLeg(leg, S, ctx){
  const mk = MARKETS.find(m=>m.v===leg.market) || {k:_mkKind(String(leg.market||'')), v:leg.market};
  const kind = mk.k || '';
  const name = String(leg.market||'');
  const home = leg.home, away = leg.away;
  const sel = String(leg.selection||'').trim();
  const isMMA = S.winner!==undefined && !S.ft;
  const period = resPeriodOf(name);
  const domain = resDomainOf(name);

  if(S.void) return {r:'void', note:'jogo cancelado/abandonado'};
  if(!S.finished) return {r:'pending', note: S.postponed ? 'jogo adiado/suspenso' : 'jogo ainda não terminou'};
  if(period==='live') return {r:'manual', note:'mercado ao vivo — precisa do placar na hora da aposta'};

  // MMA: só vencedor
  if(isMMA){
    if(kind!=='ml' && kind!=='1x2' && kind!=='team') return {r:'manual', note:'mercado de MMA não suportado'};
    const side = resSide(sel, home, away);
    if(!side) return {r:'manual', note:'não consegui identificar o lutador na seleção'};
    if(S.draw || S.winner===null) return {r:'void', note:'sem vencedor (empate/sem resultado)'};
    return {r: side===S.winner ? 'green' : 'red', note:'vencedor: '+(S.winner==='H'?home:away)};
  }

  // placar por período (gols/pontos)
  const pair = (p)=>{
    if(!S.ft) return null;
    if(p==='ft') return S.ft;
    if(!S.ht) return null;
    if(p==='1h') return S.ht;
    if(p==='2h') return {h:S.ft.h-S.ht.h, a:S.ft.a-S.ht.a};
    return null;
  };
  const scoreTxt = S.ft ? (S.ft.h+'-'+S.ft.a+(S.ht?' (HT '+S.ht.h+'-'+S.ht.a+')':'')) : '';
  const out = (r, note)=>({r, note: note || scoreTxt});
  const outcome = (p)=>{ const x = pair(p); if(!x) return null; return x.h>x.a?'H':(x.h<x.a?'A':'D'); };
  const needPair = (p)=>{ const x = pair(p); return x; };

  // faixas de minuto (Cards/Goals/Corners 00:00 - 09:59)
  if(domain==='range'){
    const m = name.match(/^(Cards|Corners|Goals) (\d\d):(\d\d) - (\d\d):(\d\d)$/);
    if(!m) return {r:'manual', note:'faixa de minutos não reconhecida'};
    if(m[1]==='Corners') return {r:'manual', note:'a API não informa escanteios por minuto'};
    const lo = parseInt(m[2],10)+1, hi = parseInt(m[4],10)+1;
    const evs = await ctx.events();
    if(!evs) return {r:'manual', note:'não consegui os lances do jogo'};
    let total = 0;
    evs.forEach(e=>{
      const el = e.time && e.time.elapsed; if(el==null) return;
      if(el<lo || el>hi) return;
      if(m[1]==='Goals' && e.type==='Goal' && !/Missed/i.test(e.detail||'')) total++;
      if(m[1]==='Cards' && e.type==='Card') total++;
    });
    const ov = sel.match(/^(over|under)\s*(.*)$/i); const line = ov ? resLine(ov[2]) : null;
    if(!ov || line===null) return {r:'manual', note:'seleção sem linha'};
    const isOver = /^over/i.test(ov[1]);
    const res = resEvalWithLine(L=> isOver ? total-L : L-total, line);
    return {r:res.r, note: res.note || ('total na faixa: '+total)};
  }

  // pares (casa,fora) para a estatística do mercado
  const statPair = async (dom, p)=>{
    if(dom==='goals' || dom==='points') return needPair(p);
    if(dom==='cards'){
      const evs = await ctx.events(); if(!evs || !S.teamIds) return null;
      let h=0, a=0;
      evs.forEach(e=>{
        if(e.type!=='Card') return;
        const el = e.time && e.time.elapsed; if(el==null) return;
        const first = el<=45;
        if(p==='1h' && !first) return;
        if(p==='2h' && first) return;
        if(e.team && e.team.id===S.teamIds.h) h++; else if(e.team && e.team.id===S.teamIds.a) a++;
      });
      return {h,a};
    }
    if(dom==='corners' || dom==='shots'){
      if(p!=='ft') return null;
      const st = await ctx.stats(); if(!st || !S.teamIds) return null;
      const val = (teamId, types)=>{
        const t = st.find(x=>x.team && x.team.id===teamId); if(!t) return null;
        let sum = 0, found = false;
        types.forEach(ty=>{ const s = (t.statistics||[]).find(z=>z.type===ty); if(s){ found = true; sum += Number(s.value)||0; } });
        return found ? sum : null;
      };
      const types = dom==='corners' ? ['Corner Kicks'] : (/\+ Fora/.test(name) ? ['Shots on Goal','Shots off Goal'] : ['Shots on Goal']);
      const h = val(S.teamIds.h, types), a = val(S.teamIds.a, types);
      return (h===null||a===null) ? null : {h,a};
    }
    return null;
  };
  const noData = ()=>({r:'manual', note:'a API não tem esse dado ('+(period==='1h'?'1º tempo':(period==='2h'?'2º tempo':'partida'))+')'});

  switch(kind){
    case '1x2': {
      const o = outcome(period); if(!o) return noData();
      const side = resSide(sel, home, away) || ({'1':'H','x':'D','2':'A'})[evtNorm(sel)];
      if(!side) return {r:'manual', note:'não identifiquei o time na seleção'};
      return out(side===o ? 'green' : 'red');
    }
    case 'dc': {
      const o = outcome(period); if(!o) return noData();
      const parts = sel.split(/\s+ou\s+/i).map(p=>resSide(p,home,away));
      if(parts.length!==2 || parts.some(p=>!p)) return {r:'manual', note:'não identifiquei os times na seleção'};
      return out(parts.includes(o) ? 'green' : 'red');
    }
    case 'ml': {
      const o = outcome(period); if(!o) return noData();
      const side = resSide(sel, home, away);
      if(!side || side==='D') return {r:'manual', note:'não identifiquei o time na seleção'};
      if(o==='D') return out('void', 'empate — aposta anulada');
      return out(side===o ? 'green' : 'red');
    }
    case 'yn': {
      const x = needPair(period); if(!x) return noData();
      const both = x.h>0 && x.a>0;
      const yes = /^(sim|s|yes)$/i.test(sel), no = /^(n[aã]o|n|no)$/i.test(sel);
      if(!yes && !no) return {r:'manual', note:'seleção deve ser Sim ou Não'};
      return out((yes===both) ? 'green' : 'red');
    }
    case 'ou': {
      const m = sel.match(/^(over|under)\s*(.*)$/i);
      if(!m) return {r:'manual', note:'seleção sem Over/Under'};
      const line = resLine(m[2]); if(line===null) return {r:'manual', note:'seleção sem linha'};
      const x = await statPair(domain, period); if(!x) return noData();
      const total = x.h + x.a, isOver = /^over/i.test(m[1]);
      const res = resEvalWithLine(L=> isOver ? total-L : L-total, line);
      return {r:res.r, note: res.note || ('total: '+total+(domain==='goals'||domain==='points'?'':'')+(scoreTxt?' · '+scoreTxt:''))};
    }
    case 'hcp': case 'hcp3': {
      const x = await statPair(domain, period); if(!x) return noData();
      let t = resTakeSide(sel, home, away);
      if(!t) return {r:'manual', note:'não identifiquei o time na seleção'};
      const line = resLine(t.rest); if(line===null) return {r:'manual', note:'seleção sem linha do handicap'};
      if(t.side==='D'){                         // handicap 3 vias: empate com a linha no time da casa
        const d = (x.h+line) - x.a;
        return out(Math.abs(d)<1e-9 ? 'green' : 'red');
      }
      const mine = t.side==='H' ? x.h : x.a, opp = t.side==='H' ? x.a : x.h;
      if(kind==='hcp3'){
        const d = (mine+line) - opp;
        return out(d>1e-9 ? 'green' : 'red');
      }
      const res = resEvalWithLine(L=> (mine+L)-opp, line);
      return {r:res.r, note: res.note || ('placar '+x.h+'-'+x.a)};
    }
    case 'htft': {
      const a = outcome('1h'), b = outcome('ft'); if(!a || !b) return noData();
      const parts = sel.split(/\s*\/\s*/).map(p=>resSide(p,home,away));
      if(parts.length!==2 || parts.some(p=>!p)) return {r:'manual', note:'não identifiquei os times na seleção'};
      return out(parts[0]===a && parts[1]===b ? 'green' : 'red');
    }
    case 'team': {
      const side = resSide(sel, home, away);
      if(!side || side==='D') return {r:'manual', note:'não identifiquei o time na seleção'};
      const ft = S.ft, ht = S.ht;
      if(/Sem Sofrer Gol/i.test(name)){ if(!ft) return noData(); return out((side==='H'?ft.a:ft.h)===0 ? 'green' : 'red'); }
      if(!ft || !ht) return noData();
      const h1 = {h:ht.h, a:ht.a}, h2 = {h:ft.h-ht.h, a:ft.a-ht.a};
      const me = (p)=> side==='H' ? p.h : p.a, op = (p)=> side==='H' ? p.a : p.h;
      if(/Ganhar Ambas/i.test(name)) return out(me(h1)>op(h1) && me(h2)>op(h2) ? 'green' : 'red');
      if(/Ganhar Uma/i.test(name)) return out(me(h1)>op(h1) || me(h2)>op(h2) ? 'green' : 'red');
      if(/Marcar em Ambas/i.test(name)) return out(me(h1)>0 && me(h2)>0 ? 'green' : 'red');
      return {r:'manual', note:'mercado não reconhecido'};
    }
    case 'score': {
      const x = needPair(period==='2h'?'2h':(period==='1h'?'1h':'ft')); if(!x) return noData();
      const m = sel.match(/(\d+)\s*[-x:]\s*(\d+)/i); if(!m) return {r:'manual', note:'placar inválido na seleção'};
      return out(parseInt(m[1],10)===x.h && parseInt(m[2],10)===x.a ? 'green' : 'red');
    }
    case 'rbtts': case 'rbttsg': case 'rou': {
      const x = needPair('ft'); if(!x) return noData();
      const t = resTakeSide(sel, home, away); if(!t) return {r:'manual', note:'não identifiquei o time na seleção'};
      const o = x.h>x.a?'H':(x.h<x.a?'A':'D');
      let ok = (t.side===o);
      let rest = t.rest.replace(/^e\s+/,'');
      if(kind==='rbtts' || kind==='rbttsg'){
        const m = rest.match(/^(sim|n[aã]o)\b\s*(?:e\s+)?(.*)$/i); if(!m) return {r:'manual', note:'seleção sem Sim/Não'};
        const both = x.h>0 && x.a>0; ok = ok && (/^sim/i.test(m[1])===both); rest = m[2];
      }
      if(kind==='rbttsg' || kind==='rou'){
        const m = rest.match(/^(over|under)\s*(.*)$/i); if(!m) return {r:'manual', note:'seleção sem Over/Under'};
        const line = resLine(m[2]); if(line===null) return {r:'manual', note:'seleção sem linha'};
        const tot = x.h+x.a, d = /^over/i.test(m[1]) ? tot-line : line-tot;
        if(Math.abs(d)<1e-9 && ok) return out('void', 'linha exata — aposta anulada');
        ok = ok && d>0;
      }
      return out(ok ? 'green' : 'red');
    }
    case 'oubtts': {
      const x = needPair('ft'); if(!x) return noData();
      const m = sel.match(/^(over|under)\s*e\s*(sim|n[aã]o)\s*(.*)$/i); if(!m) return {r:'manual', note:'seleção não reconhecida'};
      const line = resLine(m[3]); if(line===null) return {r:'manual', note:'seleção sem linha'};
      const tot = x.h+x.a, d = /^over/i.test(m[1]) ? tot-line : line-tot, both = x.h>0 && x.a>0;
      const bttsOk = (/^sim/i.test(m[2])===both);
      if(Math.abs(d)<1e-9 && bttsOk) return out('void', 'linha exata — aposta anulada');
      return out(d>0 && bttsOk ? 'green' : 'red');
    }
  }
  return {r:'manual', note:'mercado sem regra automática'};
}

// ---------- chamadas à API ----------
async function resApi(sport, path, params){
  const key = evtGetKey();
  const resp = await fetch('https://'+sport.host+'/'+path+'?'+params, {headers:{'x-apisports-key':key}});
  const json = await resp.json();
  const errs = json && json.errors;
  const errTxt = Array.isArray(errs) ? errs.join(' ') : (errs ? Object.values(errs).join(' ') : '');
  if(errTxt) throw new Error(errTxt);
  return json.response || [];
}
async function resLoadDay(sport, qd){
  return resApi(sport, sport.path, 'date='+qd+(sport.tz?'&timezone=America/Sao_Paulo':''));
}

// ---------- processamento ----------
let RES_RUNNING = false;
async function buscarResultados(){
  if(RES_RUNNING) return;
  if(!evtGetKey()){ showToast('Cadastre a chave da API em Configurações para buscar resultados.'); return; }
  RES_RUNNING = true;
  const btns = Array.from(document.querySelectorAll('.btn-buscar-res')); btns.forEach(b=>{ b.disabled = true; b.textContent = 'Buscando…'; });
  const applied = [], skipped = [];
  try{
    // 1) partidas pendentes
    const legs = [];
    STATE.tickets.forEach(t=>(t.matches||[]).forEach(m=>{ if(m.result==='pending') legs.push({t, m}); }));
    if(!legs.length){ showToast('Nenhuma partida pendente para buscar.'); return; }
    const sports = EVT_SPORTS;
    // 2) partidas sem referência: tenta achar pelo nome (data da aposta)
    const dayCache = {};                         // sport|qd -> lista crua
    const getDay = async (sp, qd)=>{
      const k = sp.id+'|'+qd;
      if(!dayCache[k]) dayCache[k] = resLoadDay(sp, qd).catch(e=>({__err:e.message}));
      return dayCache[k];
    };
    for(const L of legs){
      if(L.m.ref || !L.m.away) continue;
      const dates = [L.t.date]; const d2 = new Date(L.t.date+'T12:00:00'); d2.setDate(d2.getDate()+1); dates.push(d2.toISOString().slice(0,10));
      const sel = evtSelectedSports();
      outer: for(const sp of sel){
        for(const qd of dates){
          const list = await getDay(sp, qd);
          if(!Array.isArray(list)) continue;
          for(const it of list){
            let g; try{ g = sp.parse(it); }catch(e){ continue; }
            if(g && evtNorm(g.home)===evtNorm(L.m.home) && evtNorm(g.away)===evtNorm(L.m.away)){ L.m.ref = {sport:sp.id, id: sp.itemId(it), qd}; L.refTemp = true; break outer; }
          }
        }
      }
    }
    // 3) busca os placares (1 consulta por esporte/data)
    const ctxCache = {};
    for(const L of legs){
      const lab = L.m.home+(L.m.away?' x '+L.m.away:'');
      const base = {t:L.t, m:L, label:lab};
      if(!L.m.ref){ skipped.push({...base, why: L.m.away ? 'jogo não encontrado na API (escolha o jogo na lista ao cadastrar para ficar automático)' : 'aposta de longo prazo'}); continue; }
      const sp = sports.find(s=>s.id===L.m.ref.sport);
      if(!sp){ skipped.push({...base, why:'esporte não suportado'}); continue; }
      const list = await getDay(sp, L.m.ref.qd);
      if(!Array.isArray(list)){ skipped.push({...base, why:'API: '+(list&&list.__err||'erro')}); continue; }
      const it = list.find(x=>String(sp.itemId(x))===String(L.m.ref.id));
      if(!it){ skipped.push({...base, why:'jogo não veio na consulta da API'}); continue; }
      let S; try{ S = sp.score(it); }catch(e){ S = null; }
      if(!S){ skipped.push({...base, why:'formato do placar inesperado'}); continue; }
      const fid = sp.id+'|'+L.m.ref.id;
      const ctx = {
        events: ()=> (ctxCache[fid+'e'] = ctxCache[fid+'e'] || (sp.id==='football' ? resApi(sp,'fixtures/events','fixture='+L.m.ref.id).catch(()=>null) : Promise.resolve(null))),
        stats:  ()=> (ctxCache[fid+'s'] = ctxCache[fid+'s'] || (sp.id==='football' ? resApi(sp,'fixtures/statistics','fixture='+L.m.ref.id).catch(()=>null) : Promise.resolve(null)))
      };
      let ev;
      try{ ev = await resEvalLeg(L.m, S, ctx); }catch(e){ ev = {r:'manual', note:'erro ao avaliar: '+e.message}; }
      if(ev.r==='green' || ev.r==='red' || ev.r==='void'){
        L.m.result = ev.r; L.m.autoNote = ev.note || ''; L.m.autoAt = new Date().toISOString();
        applied.push({...base, r:ev.r, note:ev.note});
      } else {
        skipped.push({...base, why: ev.note || 'não resolvido'});
      }
    }
    // 4) grava no banco (um update por aposta alterada) — desfaz se der erro
    const touched = new Map();
    applied.forEach(a=>touched.set(a.t.id, a.t));
    for(const [id, t] of touched){
      const {error} = await supabaseClient.from('tickets').update({matches: t.matches}).eq('id', id);
      if(error){
        showToast('Erro ao salvar resultados de uma aposta: '+error.message);
        applied.filter(a=>a.t.id===id).forEach(a=>{ a.m.m.result='pending'; a.failed=true; });
      }
    }
    // referências achadas pelo nome ficam guardadas mesmo sem resultado
    const refOnly = new Map();
    legs.forEach(L=>{ if(L.refTemp && !touched.has(L.t.id)) refOnly.set(L.t.id, L.t); });
    for(const [id,t] of refOnly){ await supabaseClient.from('tickets').update({matches: t.matches}).eq('id', id); }
  } catch(e){
    showToast('Erro ao buscar resultados: '+e.message);
  } finally {
    RES_RUNNING = false;
    btns.forEach(b=>{ b.disabled = false; b.textContent = '🔄 Buscar resultados'; });
  }
  render();
  resShowReport(applied.filter(a=>!a.failed), skipped);
}

function resShowReport(applied, skipped){
  document.getElementById('res-overlay')?.remove();
  const nm = (t)=>{ const c = STATE.clients.find(x=>x.id===t.clientId); return c ? c.name : 'Cliente removido'; };
  const chip = (r)=> r==='green' ? '<span style="color:var(--green);font-weight:700">GREEN</span>' : (r==='red' ? '<span style="color:var(--red);font-weight:700">RED</span>' : '<span style="color:var(--text-muted);font-weight:700">ANULADA</span>');
  const rowA = a=>`<div class="match-row" style="gap:10px"><div class="match-desc" style="flex:1;min-width:0"><span class="teams">${evtEsc(a.label)}</span><span class="meta">${evtEsc(nm(a.t))} · #${a.t.ticketNumber||'-'} · ${evtEsc(marketLabelOf(a.m.m.market))}: ${evtEsc(a.m.m.selection)}${a.note?' · '+evtEsc(a.note):''}</span></div>${chip(a.r)}</div>`;
  const rowS = s=>`<div class="match-row" style="gap:10px"><div class="match-desc" style="flex:1;min-width:0"><span class="teams">${evtEsc(s.label)}</span><span class="meta">${evtEsc(nm(s.t))} · #${s.t.ticketNumber||'-'} · ${evtEsc(marketLabelOf(s.m.m.market))}: ${evtEsc(s.m.m.selection)}</span><span class="meta" style="color:var(--gold)">${evtEsc(s.why)}</span></div></div>`;
  const ov = document.createElement('div');
  ov.id = 'res-overlay';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:200;display:flex;align-items:flex-start;justify-content:center;padding:40px 16px;overflow:auto';
  ov.onclick = (e)=>{ if(e.target===ov) ov.remove(); };
  ov.innerHTML = `<div class="card" style="max-width:720px;width:100%;margin:0">
    <div style="display:flex;justify-content:space-between;align-items:center"><h3 style="margin:0">Resultados encontrados</h3><button class="btn-ghost btn-sm" onclick="document.getElementById('res-overlay').remove()">Fechar</button></div>
    <p style="font-size:13px;color:var(--text-muted)">${applied.length} partida${applied.length===1?'':'s'} atualizada${applied.length===1?'':'s'} · ${skipped.length} sem resultado automático.</p>
    ${applied.length ? '<label>Atualizadas</label>'+applied.map(rowA).join('') : ''}
    ${skipped.length ? '<label>Continuam pendentes</label>'+skipped.map(rowS).join('') : ''}
  </div>`;
  document.body.appendChild(ov);
}
