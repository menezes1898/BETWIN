// ==================== FECHAMENTO EM PDF ====================
// Mesmos números da imagem de fechamento (canvas-fechamento.js) + a lista de todos os jogos da semana.
// Usa jsPDF + jsPDF-AutoTable, carregados só quando o botão é clicado (não pesam nas outras telas).
const PDF_LIBS = {
  jspdf: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  autotable: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js'
};
const _pdfScriptPromises = {};
function loadScriptOnce(src){
  if(!_pdfScriptPromises[src]){
    _pdfScriptPromises[src] = new Promise((resolve, reject)=>{
      const s = document.createElement('script');
      s.src = src; s.onload = resolve;
      s.onerror = ()=>{ delete _pdfScriptPromises[src]; reject(new Error('Não consegui carregar '+src)); };
      document.head.appendChild(s);
    });
  }
  return _pdfScriptPromises[src];
}
async function ensurePdfLibs(){
  if(!(window.jspdf && window.jspdf.jsPDF)) await loadScriptOnce(PDF_LIBS.jspdf);
  if(!(window.jspdf.jsPDF.API && window.jspdf.jsPDF.API.autoTable)) await loadScriptOnce(PDF_LIBS.autotable);
}

// A fonte padrão do PDF só entende caracteres latinos básicos: troca o que ela não conhece.
function pdfSafe(s){
  return String(s==null?'':s)
    .replace(/[–—]/g,'-').replace(/[‘’]/g,"'").replace(/[“”]/g,'"').replace(/…/g,'...')
    .split('').map(ch=>{
      if(ch.charCodeAt(0)<=255) return ch;
      const base = ch.normalize('NFD').replace(/[̀-ͯ]/g,'');
      return (base.length===1 && base.charCodeAt(0)<=255) ? base : '?';
    }).join('');
}
function pdfMoney(v){ return fmtBRL(Math.abs(v)).replace(/ /g,' '); }
function pdfSigned(v){ return (v>=0?'+ ':'- ')+pdfMoney(v); }

async function gerarFechamentoPDF(clientId){
  try{
    const cl = STATE.clients.find(c=>c.id===clientId);
    if(!cl){ showToast('Cliente não encontrado.'); return; }
    showToast('Gerando PDF...');
    await ensurePdfLibs();

    const weekMonday = DASH_WEEK || mondayOf(todaySP());
    const allWeek = STATE.tickets.filter(t=>t.clientId===clientId && mondayOf(ticketDate(t))===weekMonday)
      .sort((a,b)=>ticketDate(a).localeCompare(ticketDate(b)) || (a.time||'').localeCompare(b.time||''));
    const tickets = allWeek.filter(t=>ticketResult(t)!=='void');

    // ---- mesmos cálculos da imagem de fechamento ----
    const valorJogado = tickets.reduce((s,t)=>s+t.stake,0);
    const acertos = tickets.filter(t=>ticketResult(t)==='green').reduce((s,t)=>s+t.stake*effectiveOdds(t),0);
    const subtotal = tickets.reduce((s,t)=>s+ticketProfit(t),0);
    const descontoPct = getWeekDiscount(cl, weekMonday);
    const desconto = computeDescontoAmount(cl, subtotal, weekMonday);
    const temDesconto = desconto>0;
    const temSaldoAnterior = Math.abs(computeContinuousBalance(clientId, weekMonday)) >= 0.01;
    const saldoAnterior = -computeContinuousBalance(clientId, weekMonday);
    const saldoSemana = applyDescontoSign(cl, subtotal, desconto);
    const saldoTotal = saldoSemana + saldoAnterior;

    // ===================== VISUAL (só apresentação; os números acima não mudam) =====================
    const C = {
      navy:[9,14,25], ink:[238,242,248], gray:[135,148,172], line:[40,53,76], soft:[19,28,44], card2:[26,38,62], gold:[226,178,70],
      blue:[96,190,240], cyan:[62,193,243],
      green:[52,211,153], greenBg:[22,52,50], red:[255,100,106], redBg:[58,34,46],
      amber:[226,178,70], amberBg:[56,48,30], voidc:[150,162,184], voidBg:[34,44,62]
    };
    const colorOf = v => v>=0 ? C.green : C.red;
    const statusInfo = (r)=>({
      green:{label:'GREEN', fg:C.green, bg:C.greenBg},
      red:{label:'RED', fg:C.red, bg:C.redBg},
      pending:{label:'PENDENTE', fg:C.amber, bg:C.amberBg},
      void:{label:'ANULADA', fg:C.voidc, bg:C.voidBg}
    }[r] || {label:'PENDENTE', fg:C.amber, bg:C.amberBg});

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({unit:'mm', format:'a4'});
    const PW = 210, PH = 297, M = 14, CW = PW-2*M;
    const BOTTOM = 280;           // limite de conteúdo (rodapé fica abaixo)
    const TOP_NEXT = 24;          // início do conteúdo nas páginas seguintes

    const monday = new Date(weekMonday+'T00:00:00'); const sunday = new Date(monday); sunday.setDate(monday.getDate()+6);
    const periodo = monday.toLocaleDateString('pt-BR')+' a '+sunday.toLocaleDateString('pt-BR');
    const nome = pdfSafe(cl.name.toUpperCase());
    const logoHidden = localStorage.getItem(LOGO_HIDDEN_KEY)==='true';
    let logoData = null, logoFmt = null;
    try{
      const saved = localStorage.getItem(LOGO_STORAGE_KEY);
      const f = saved && /^data:image\/(png|jpe?g|webp)/i.exec(saved);
      if(f){ logoData = saved; logoFmt = f[1].toUpperCase().replace('JPG','JPEG'); }
    }catch(e){}

    const pageBg = ()=>{ doc.setFillColor(...C.navy); doc.rect(0, 0, PW, 297, 'F'); };
    pageBg();
    const label = (txt, x, y, opts={})=>{
      doc.setFont('helvetica','bold'); doc.setFontSize(opts.size||7); doc.setTextColor(...(opts.color||C.gray));
      doc.text(String(txt).toUpperCase(), x, y, {align:opts.align||'left', charSpace:opts.cs==null?0.35:opts.cs});
    };
    const trophy = (x, y, h, col)=>{   // x,y = canto superior esquerdo; troféu vetorial
      const k = h/10;
      doc.setFillColor(...col); doc.setDrawColor(...col);
      doc.roundedRect(x+2.2*k, y, 5.6*k, 4.6*k, 0.8*k, 0.8*k, 'F');
      doc.triangle(x+2.2*k, y+3.2*k, x+7.8*k, y+3.2*k, x+5*k, y+6.6*k, 'F');
      doc.setLineWidth(0.55*k);
      doc.ellipse(x+1.7*k, y+1.9*k, 1.5*k, 1.4*k, 'S'); doc.ellipse(x+8.3*k, y+1.9*k, 1.5*k, 1.4*k, 'S');
      doc.rect(x+4.4*k, y+6*k, 1.2*k, 1.9*k, 'F');
      doc.roundedRect(x+2.8*k, y+7.8*k, 4.4*k, 1.6*k, 0.5*k, 0.5*k, 'F');
    };
    const wordmark = (x, y, size, onDark)=>{
      doc.setFont('helvetica','bold'); doc.setFontSize(size);
      doc.setTextColor(...(onDark?[255,255,255]:C.navy)); doc.text('BET', x, y);
      const w = doc.getTextWidth('BET');
      doc.setTextColor(...(onDark?C.cyan:C.blue)); doc.text('WIN', x+w, y);
    };
    const badge = (xRight, yMid, st, size=6.8)=>{
      doc.setFont('helvetica','bold'); doc.setFontSize(size);
      const tw = doc.getTextWidth(st.label)+ st.label.length*0.25;
      const w = tw+8.4, h=5.2, x = xRight-w;
      doc.setFillColor(...st.bg); doc.roundedRect(x, yMid-h/2, w, h, 2.6, 2.6, 'F');
      doc.setFillColor(...st.fg); doc.circle(x+3.6, yMid, 0.95, 'F');
      doc.setTextColor(...st.fg); doc.text(st.label, x+5.7, yMid+0.9, {charSpace:0.25});
    };

    // ---- cabeçalho da 1ª página (compacto) ----
    doc.setFillColor(15,23,40); doc.rect(0, 0, PW, 41, 'F');
    doc.setFillColor(...C.gold); doc.rect(0, 41, PW, 0.8, 'F');
    let logoDrawn = false;
    if(!logoHidden && logoData){
      try{
        const ip = doc.getImageProperties(logoData); const ar = ip.width/ip.height;
        let lh = 20, lw = lh*ar; if(lw>46){ lw = 46; lh = lw/ar; }
        doc.addImage(logoData, logoFmt, M, 7+(20-lh)/2, lw, lh); logoDrawn = true;
      }catch(e){ logoDrawn = false; }
    }
    if(!logoHidden && !logoDrawn){ trophy(M, 6, 13.5, [226,178,70]); wordmark(M+13, 16.5, 20, true); }
    label('Fechamento semanal', PW-M, 14, {align:'right', color:[143,179,220], size:8, cs:0.3});
    label('Período', PW-M, 26, {align:'right', color:[143,179,220], size:6.8});
    doc.setFont('helvetica','bold'); doc.setFontSize(11.5); doc.setTextColor(255,255,255);
    doc.text(periodo, PW-M, 32.5, {align:'right'});
    label('Cliente', M, 27, {color:[143,179,220], size:6.8});
    let tSize = 20; doc.setFont('helvetica','bold');
    do{ doc.setFontSize(tSize); if(doc.getTextWidth(nome) <= CW-60 || tSize<=12) break; tSize -= 1; } while(true);
    doc.setTextColor(255,255,255); doc.text(nome, M, 36.5);

    // ---- RESUMO FINANCEIRO ----
    let y = 49;
    label('Resumo financeiro', M, y); y += 3.5;
    const cards = [
      {l:'Valor jogado', v:'- '+pdfMoney(valorJogado), c:C.red},
      {l:'Acertos', v:'+ '+pdfMoney(acertos), c:C.green},
      {l:'Subtotal', v:pdfSigned(subtotal), c:colorOf(subtotal)}
    ];
    if(temDesconto) cards.push({l:'Desconto'+(descontoPct?' ('+descontoPct+'%)':''), v:'+ '+pdfMoney(desconto), c:C.blue});
    const gap = 4, cw = (CW-gap*(cards.length-1))/cards.length, ch = 18;
    cards.forEach((cd,i)=>{
      const x = M+i*(cw+gap);
      doc.setFillColor(...C.soft); doc.setDrawColor(...C.line); doc.setLineWidth(0.3);
      doc.roundedRect(x, y, cw, ch, 2.5, 2.5, 'FD');
      label(cd.l, x+4.5, y+6);
      let fs = 12; doc.setFont('helvetica','bold');
      do{ doc.setFontSize(fs); if(doc.getTextWidth(cd.v) <= cw-9 || fs<=8) break; fs -= 0.5; } while(true);
      doc.setTextColor(...cd.c); doc.text(cd.v, x+4.5, y+13.5);
    });
    y += ch + 4;

    // saldo final (card grande)
    const bigH = 22;
    doc.setFillColor(...C.card2); doc.setDrawColor(...C.gold); doc.setLineWidth(0.4); doc.roundedRect(M, y, CW, bigH, 3.5, 3.5, 'FD');
    doc.setFillColor(...C.gold); doc.roundedRect(M, y+4.5, 1.6, bigH-9, 0.8, 0.8, 'F');
    label('Saldo final', M+8, y+8, {color:[143,179,220], size:7.5, cs:0.8});
    const saldoTxt = pdfSigned(saldoTotal);
    let sfs = 24; doc.setFont('helvetica','bold');
    do{ doc.setFontSize(sfs); if(doc.getTextWidth(saldoTxt) <= (temSaldoAnterior?92:CW-20) || sfs<=14) break; sfs -= 1; } while(true);
    doc.setTextColor(...(saldoTotal>=0 ? [74,222,128] : [255,123,130])); doc.text(saldoTxt, M+8, y+17.5);
    if(temSaldoAnterior){
      const rx = PW-M-8;
      [['Saldo da semana', saldoSemana, y+9.5], ['Saldo anterior', saldoAnterior, y+18.5]].forEach(([l,v,yy])=>{
        label(l, rx, yy-3.6, {align:'right', color:[143,179,220], size:6.3});
        doc.setFont('helvetica','bold'); doc.setFontSize(10.5); doc.setTextColor(255,255,255);
        doc.text(pdfSigned(v), rx, yy+0.8, {align:'right'});
      });
    }
    y += bigH + 7;

    // ---- RESUMO DAS APOSTAS ----
    const nG = tickets.filter(t=>ticketResult(t)==='green').length;
    const nR = tickets.filter(t=>ticketResult(t)==='red').length;
    const nP = tickets.filter(t=>ticketResult(t)==='pending').length;
    const nV = allWeek.length - tickets.length;
    label('Resumo das apostas', M, y); y += 3.5;
    const stats = [
      {n:tickets.length, l:'Apostas', c:[200,210,228]},
      {n:nG, l:'Green', c:C.green},
      {n:nR, l:'Red', c:C.red},
      {n:nP, l:'Pendentes', c:C.amber}
    ];
    if(nV>0) stats.push({n:nV, l:'Anuladas', c:C.voidc});
    const sw = (CW-gap*(stats.length-1))/stats.length, sh = 15;
    stats.forEach((st,i)=>{
      const x = M+i*(sw+gap);
      doc.setFillColor(...C.soft); doc.setDrawColor(...C.line); doc.setLineWidth(0.3);
      doc.roundedRect(x, y, sw, sh, 2.5, 2.5, 'FD');
      doc.setFont('helvetica','bold'); doc.setFontSize(14); doc.setTextColor(...C.ink);
      doc.text(String(st.n), x+5, y+7.6);
      doc.setFillColor(...st.c); doc.circle(x+5.8, y+11.6, 0.9, 'F');
      label(st.l, x+8.2, y+12.4, {size:6.6});
    });
    y += sh + 5;

    // ---- performance (barra proporcional) ----
    const totalBar = nG+nR+nP+nV;
    const resolved = nG+nR;
    label('Performance', M, y);
    const taxa = resolved>0 ? (nG/resolved*100) : null;
    doc.setFont('helvetica','bold'); doc.setFontSize(8.5); doc.setTextColor(...C.ink);
    doc.text(taxa==null ? 'Sem apostas resolvidas' : 'Taxa de acerto  '+taxa.toFixed(1).replace('.',',')+'%', PW-M, y, {align:'right'});
    y += 3;
    const BH = 3.8;
    doc.setFillColor(...C.line); doc.roundedRect(M, y, CW, BH, 1.9, 1.9, 'F');
    if(totalBar>0){
      const segs = [[nG,C.green],[nR,C.red],[nP,[226,178,70]],[nV,[170,179,192]]].filter(sg=>sg[0]>0);
      let x = M;
      segs.forEach(([n,col],i)=>{
        const w = CW*n/totalBar;
        doc.setFillColor(...col);
        if(segs.length===1) doc.roundedRect(x, y, w, BH, 1.9, 1.9, 'F');
        else if(i===0){ doc.roundedRect(x, y, w, BH, 1.9, 1.9, 'F'); doc.rect(x+w-3, y, 3, BH, 'F'); }
        else if(i===segs.length-1){ doc.roundedRect(x, y, w, BH, 1.9, 1.9, 'F'); doc.rect(x, y, 3, BH, 'F'); }
        else doc.rect(x, y, w, BH, 'F');
        x += w;
      });
    }
    y += BH + 4.6;
    let lx = M;
    [['Green',nG,C.green],['Red',nR,C.red],['Pendentes',nP,[226,178,70]],['Anuladas',nV,[170,179,192]]].forEach(([l,n,col])=>{
      if(l==='Anuladas' && n===0) return;
      doc.setFillColor(...col); doc.circle(lx+1, y-1, 1, 'F');
      doc.setFont('helvetica','normal'); doc.setFontSize(7.8); doc.setTextColor(...C.gray);
      const txt = totalBar>0 ? `${l}: ${n} (${(n/totalBar*100).toFixed(1).replace('.',',')}%)` : `${l}: 0`;
      doc.text(txt, lx+3.4, y);
      lx += doc.getTextWidth(txt)+10;
    });
    y += 7;

    // ---- páginas seguintes: cabeçalho pequeno ----
    const runningHeader = ()=>{
      wordmark(M, 13, 11, true);
      doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(...C.gray);
      doc.text(pdfSafe(`Fechamento ${cl.name}  |  ${periodo}`), PW-M, 13, {align:'right'});
      doc.setDrawColor(...C.line); doc.setLineWidth(0.3); doc.line(M, 17, PW-M, 17);
    };
    const newPage = ()=>{ doc.addPage(); pageBg(); runningHeader(); return TOP_NEXT; };

    // ---- LISTA DE APOSTAS (mesmo desenho da página do cliente: fundo escuro, linhas tingidas) ----
    const D = {
      bg:[24,33,47], head:[32,43,61], tab:[43,56,80], sep:[34,45,62], muted:[147,160,186], text:[245,247,250], detail:[174,186,208],
      red:[255,93,98], green:[52,211,153], pend:[226,178,70], voidc:[160,170,190],
      rowRed:[53,40,55], rowGreen:[25,56,62]
    };
    const COL = {dateX:M+6, valR:M+43, oddC:M+52, detX:M+61, resR:PW-M-5};
    const DET_W = (PW-M-5-26) - (M+61);
    const HEAD_H = 7, TAB_H = 12, ROW_MIN = 10.6, LH = 3.2;

    const measure = (t)=>{
      doc.setFont('helvetica','normal'); doc.setFontSize(6.9);
      const lines = [];
      t.matches.forEach((m, mi)=>{
        const teams = m.away ? `${m.home} x ${m.away}` : m.home;
        const odd = m.odd>0 ? ' @ '+Number(m.odd).toFixed(2) : '';
        const txt = pdfSafe(`${teams} - ${m.market} - ${m.selection}${odd}`).toUpperCase();
        const parts = doc.splitTextToSize(txt, DET_W-3.2);
        parts.forEach((ln, i)=>lines.push({ln, first:i===0, gapBefore: (i===0 && mi>0) ? 0.9 : 0}));
      });
      const textH = lines.reduce((s,l)=>s+LH+l.gapBefore, 0);
      return {lines, h: Math.max(ROW_MIN, textH + 5.4)};
    };
    const drawRow = (t, y0, m)=>{
      const r = ticketResult(t), profit = ticketProfit(t);
      doc.setFillColor(...(r==='red' ? D.rowRed : (r==='green' ? D.rowGreen : D.bg)));
      doc.rect(M, y0, CW, m.h, 'F');
      const acc = r==='green' ? D.green : (r==='red' ? D.red : (r==='pending' ? D.pend : D.voidc));
      doc.setFillColor(...acc); doc.rect(M, y0, 1.1, m.h, 'F');
      doc.setDrawColor(...D.sep); doc.setLineWidth(0.2); doc.line(M, y0+m.h, PW-M, y0+m.h);
      // data / número
      doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(...D.text);
      doc.text(pdfSafe(fmtDate(t.date)+(t.time?' '+String(t.time).slice(0,5):'')), COL.dateX, y0+5.4);
      doc.setFontSize(6.8); doc.setTextColor(...D.muted);
      doc.text('#'+(t.ticketNumber||'-'), COL.dateX, y0+9.4);
      // valor / odds
      doc.setFont('helvetica','bold'); doc.setFontSize(8.5); doc.setTextColor(...D.text);
      doc.text(fmtNum(t.stake), COL.valR, y0+5.6, {align:'right'});
      doc.text(ticketOddTotal(t)>0 ? effectiveOdds(t).toFixed(2) : '-', COL.oddC, y0+5.6, {align:'center'});
      // detalhes
      doc.setFont('helvetica','normal'); doc.setFontSize(6.9); doc.setTextColor(...D.detail);
      let ty = y0+5.3;
      m.lines.forEach(l=>{
        ty += l.gapBefore;
        if(l.first){ doc.setFillColor(...acc); doc.circle(COL.detX+0.9, ty-0.9, 0.85, 'F'); }
        const ai = l.ln.lastIndexOf('@ ');
        doc.setFont('helvetica','normal'); doc.setTextColor(...D.detail);
        if(ai>0 && /^@ [0-9.]+$/.test(l.ln.slice(ai).trim())){
          const pre = l.ln.slice(0, ai);
          doc.text(pre, COL.detX+3.2, ty);
          doc.setFont('helvetica','bold'); doc.setTextColor(...D.text);
          doc.text(l.ln.slice(ai), COL.detX+3.2+doc.getTextWidth(pre), ty);
        } else doc.text(l.ln, COL.detX+3.2, ty);
        ty += LH;
      });
      // resultado + status da aposta completa
      doc.setFont('helvetica','bold'); doc.setFontSize(9.5);
      if(r==='green' || r==='red'){ doc.setTextColor(...(profit>=0?D.green:D.red)); doc.text(fmtNum(profit), COL.resR, y0+5.6, {align:'right'}); }
      else { doc.setTextColor(...D.muted); doc.text(r==='pending' ? '-' : '-', COL.resR, y0+5.6, {align:'right'}); }
      const stCol = r==='green' ? D.green : (r==='red' ? D.red : (r==='pending' ? D.pend : D.voidc));
      doc.setFont('helvetica','bold'); doc.setFontSize(6.2); doc.setTextColor(...stCol);
      doc.text(statusInfo(r).label, COL.resR, y0+9.6, {align:'right', charSpace:0.3});
    };
    const drawHead = (y0, hasTab)=>{
      doc.setFillColor(...D.head); if(hasTab) doc.rect(M, y0, CW, HEAD_H, 'F');
      if(!hasTab){ doc.roundedRect(M, y0, CW, HEAD_H, 3, 3, 'F'); doc.rect(M, y0+3, CW, HEAD_H-3, 'F'); }
      const hl = (txt, x, al)=>{ doc.setFont('helvetica','bold'); doc.setFontSize(6.3); doc.setTextColor(...D.muted); doc.text(txt, x, y0+4.6, {align:al||'left', charSpace:0.35}); };
      hl('DATA', COL.dateX); hl('VALOR', COL.valR, 'right'); hl('ODDS', COL.oddC, 'center'); hl('DETALHES', COL.detX); hl('RESULTADO', COL.resR, 'right');
    };

    // pass 1: simula a paginação (cada aposta fica inteira numa página)
    const items = allWeek.map(t=>({t, m:measure(t)}));
    const segs = [];            // {first, y0, rows:[{t,m,y}], y1}
    let seg = null, cy = 0, pageOffset = 0;
    const startSeg = (isFirst, yStart)=>{
      seg = {isFirst, y0:yStart, rows:[], pageOffset};
      segs.push(seg);
      cy = yStart + (isFirst ? TAB_H : 0) + HEAD_H;
    };
    // cabeçalho da seção
    const SEC_H = 9;
    const firstH = items.length ? items[0].m.h : 12;
    let secY = y;
    if(secY + SEC_H + TAB_H + HEAD_H + firstH > BOTTOM){ pageOffset = 1; secY = TOP_NEXT; }
    startSeg(true, secY + SEC_H);
    items.forEach(it=>{
      if(cy + it.m.h > BOTTOM){ seg.y1 = cy; pageOffset += 1; startSeg(false, TOP_NEXT); }
      seg.rows.push({t:it.t, m:it.m, y:cy});
      cy += it.m.h;
    });
    seg.y1 = cy;

    // pass 2: desenha
    let curOffset = 0;
    segs.forEach((sg, si)=>{
      while(curOffset < sg.pageOffset){ newPage(); curOffset += 1; }
      if(sg.isFirst){
        doc.setFont('helvetica','bold'); doc.setFontSize(13); doc.setTextColor(...C.ink);
        doc.text('Jogos da semana', M, sg.y0-3);
        doc.setFont('helvetica','normal'); doc.setFontSize(8.5); doc.setTextColor(...C.gray);
        doc.text(`${allWeek.length} aposta${allWeek.length===1?'':'s'} no periodo`, PW-M, sg.y0-3, {align:'right'});
      }
      doc.setFillColor(...D.bg); doc.roundedRect(M, sg.y0, CW, Math.max(sg.y1-sg.y0, HEAD_H+4)+3, 3, 3, 'F');
      let hy = sg.y0;
      if(sg.isFirst){
        doc.setFillColor(...D.tab); doc.roundedRect(M+4, sg.y0+2.4, 38, 7.8, 2, 2, 'F');
        doc.setFont('helvetica','bold'); doc.setFontSize(7.6); doc.setTextColor(...D.text);
        doc.text(`Apostas (${allWeek.length})`, M+7.5, sg.y0+6.2);
        doc.setFontSize(6.6); doc.setTextColor(...(subtotal>=0?D.green:D.red));
        doc.text(fmtNum(subtotal), M+7.5, sg.y0+9.2);
        hy = sg.y0 + TAB_H;
      }
      drawHead(hy, sg.isFirst);
      sg.rows.forEach(rw=>drawRow(rw.t, rw.y, rw.m));
      // acabamento arredondado do cartão (cobre as pontas das linhas tingidas)
      doc.setFillColor(...D.head); doc.roundedRect(M, sg.y1-0.2, CW, 3.2, 1.6, 1.6, 'F'); doc.rect(M, sg.y1-0.2, CW, 1.6, 'F');
      sg.y1 += 3;
    });
    // total da semana
    {
      const last = segs[segs.length-1];
      let ty = last.y1 + 5;
      const totH = 15;
      if(ty + totH > BOTTOM){ newPage(); ty = TOP_NEXT; }
      doc.setFillColor(...C.soft); doc.setDrawColor(...C.line); doc.setLineWidth(0.3);
      doc.roundedRect(M, ty, CW, totH, 3, 3, 'FD');
      label(`Total da semana (${tickets.length} apostas, sem anuladas)`, M+6, ty+6, {size:6.6});
      label('Valor jogado', M+6, ty+10.8, {size:6.2, cs:0.2});
      doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(...C.ink);
      doc.text(pdfMoney(valorJogado), M+6+23, ty+11);
      label('Resultado', PW-M-6-38, ty+10.8, {size:6.2, cs:0.2, align:'right'});
      doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor(...colorOf(subtotal));
      doc.text(pdfSigned(subtotal), PW-M-6, ty+11, {align:'right'});
    }

    // ---- rodapé com numeração ----
    const total = doc.getNumberOfPages();
    for(let i=1;i<=total;i++){
      doc.setPage(i);
      doc.setDrawColor(...C.line); doc.setLineWidth(0.3); doc.line(M, 286, PW-M, 286);
      doc.setFont('helvetica','bold'); doc.setFontSize(7.5); doc.setTextColor(...C.gold);
      doc.text('BETWIN', M, 291);
      const bw = doc.getTextWidth('BETWIN');
      doc.setFont('helvetica','normal'); doc.setTextColor(...C.gray);
      doc.text(pdfSafe(`  |  Fechamento de ${cl.name}  |  ${periodo}`), M+bw, 291);
      doc.text(`Pagina ${i} de ${total}`, PW-M, 291, {align:'right'});
    }

    const safeName = cl.name.normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^\w\- ]+/g,'').trim().replace(/\s+/g,'-') || 'cliente';
    const file = `fechamento-${safeName}-${weekMonday}.pdf`;
    doc.save(file);
    showToast('PDF gerado: '+file);
  }catch(err){
    showToast('Erro ao gerar o PDF: '+err.message);
  }
}
