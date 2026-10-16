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
      navy:[13,20,32], ink:[24,32,46], gray:[107,118,134], line:[227,232,239], soft:[247,249,252],
      blue:[27,143,192], cyan:[62,193,243],
      green:[31,157,107], greenBg:[230,246,239], red:[209,74,85], redBg:[252,235,236],
      amber:[183,121,31], amberBg:[251,243,220], voidc:[107,118,134], voidBg:[238,241,245]
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

    const label = (txt, x, y, opts={})=>{
      doc.setFont('helvetica','bold'); doc.setFontSize(opts.size||7); doc.setTextColor(...(opts.color||C.gray));
      doc.text(String(txt).toUpperCase(), x, y, {align:opts.align||'left', charSpace:opts.cs==null?0.35:opts.cs});
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

    // ---- cabeçalho da 1ª página ----
    doc.setFillColor(...C.navy); doc.rect(0, 0, PW, 50, 'F');
    doc.setFillColor(...C.cyan); doc.rect(0, 50, PW, 0.9, 'F');
    let logoDrawn = false;
    if(!logoHidden && logoData){
      try{ doc.addImage(logoData, logoFmt, M, 9, 17, 17); logoDrawn = true; }catch(e){ logoDrawn = false; }
    }
    if(!logoHidden && !logoDrawn) wordmark(M, 21, 23, true);
    label('Fechamento semanal', PW-M, 15, {align:'right', color:[143,179,220], size:8, cs:0.8});
    label('Período', PW-M, 29, {align:'right', color:[143,179,220], size:7});
    doc.setFont('helvetica','bold'); doc.setFontSize(12); doc.setTextColor(255,255,255);
    doc.text(periodo, PW-M, 35.5, {align:'right'});
    label('Cliente', M, 34, {color:[143,179,220], size:7});
    let tSize = 22; doc.setFont('helvetica','bold');
    do{ doc.setFontSize(tSize); if(doc.getTextWidth(nome) <= CW-62 || tSize<=12) break; tSize -= 1; } while(true);
    doc.setTextColor(255,255,255); doc.text(nome, M, 43.5);

    // ---- RESUMO FINANCEIRO ----
    let y = 60;
    label('Resumo financeiro', M, y); y += 4;
    const cards = [
      {l:'Valor jogado', v:'- '+pdfMoney(valorJogado), c:C.red},
      {l:'Acertos', v:'+ '+pdfMoney(acertos), c:C.green},
      {l:'Subtotal', v:pdfSigned(subtotal), c:colorOf(subtotal)}
    ];
    if(temDesconto) cards.push({l:'Desconto'+(descontoPct?' ('+descontoPct+'%)':''), v:'+ '+pdfMoney(desconto), c:C.blue});
    const gap = 4, cw = (CW-gap*(cards.length-1))/cards.length, ch = 22;
    cards.forEach((cd,i)=>{
      const x = M+i*(cw+gap);
      doc.setFillColor(255,255,255); doc.setDrawColor(...C.line); doc.setLineWidth(0.3);
      doc.roundedRect(x, y, cw, ch, 2.5, 2.5, 'FD');
      label(cd.l, x+4.5, y+7);
      let fs = 13; doc.setFont('helvetica','bold');
      do{ doc.setFontSize(fs); if(doc.getTextWidth(cd.v) <= cw-9 || fs<=8) break; fs -= 0.5; } while(true);
      doc.setTextColor(...cd.c); doc.text(cd.v, x+4.5, y+16);
    });
    y += ch + 4;

    // saldo final (card grande)
    const bigH = 32;
    doc.setFillColor(...C.navy); doc.roundedRect(M, y, CW, bigH, 3.5, 3.5, 'F');
    doc.setFillColor(...C.cyan); doc.roundedRect(M, y+5, 1.6, bigH-10, 0.8, 0.8, 'F');
    label('Saldo final', M+8, y+10, {color:[143,179,220], size:8, cs:0.8});
    const saldoTxt = pdfSigned(saldoTotal);
    let sfs = 27; doc.setFont('helvetica','bold');
    do{ doc.setFontSize(sfs); if(doc.getTextWidth(saldoTxt) <= (temSaldoAnterior?92:CW-20) || sfs<=14) break; sfs -= 1; } while(true);
    doc.setTextColor(...(saldoTotal>=0 ? [74,222,128] : [255,123,130])); doc.text(saldoTxt, M+8, y+24.5);
    if(temSaldoAnterior){
      const rx = PW-M-8;
      [['Saldo da semana', saldoSemana, y+13], ['Saldo anterior', saldoAnterior, y+24]].forEach(([l,v,yy])=>{
        label(l, rx, yy-4.2, {align:'right', color:[143,179,220], size:6.5});
        doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor(255,255,255);
        doc.text(pdfSigned(v), rx, yy+1, {align:'right'});
      });
    }
    y += bigH + 11;

    // ---- RESUMO DAS APOSTAS ----
    const nG = tickets.filter(t=>ticketResult(t)==='green').length;
    const nR = tickets.filter(t=>ticketResult(t)==='red').length;
    const nP = tickets.filter(t=>ticketResult(t)==='pending').length;
    const nV = allWeek.length - tickets.length;
    label('Resumo das apostas', M, y); y += 4;
    const stats = [
      {n:tickets.length, l:'Apostas', c:C.navy},
      {n:nG, l:'Green', c:C.green},
      {n:nR, l:'Red', c:C.red},
      {n:nP, l:'Pendentes', c:C.amber}
    ];
    if(nV>0) stats.push({n:nV, l:'Anuladas', c:C.voidc});
    const sw = (CW-gap*(stats.length-1))/stats.length, sh = 20;
    stats.forEach((st,i)=>{
      const x = M+i*(sw+gap);
      doc.setFillColor(...C.soft); doc.setDrawColor(...C.line); doc.setLineWidth(0.3);
      doc.roundedRect(x, y, sw, sh, 2.5, 2.5, 'FD');
      doc.setFont('helvetica','bold'); doc.setFontSize(19); doc.setTextColor(...C.ink);
      doc.text(String(st.n), x+5, y+11.5);
      doc.setFillColor(...st.c); doc.circle(x+5.6, y+15.6, 0.9, 'F');
      label(st.l, x+8, y+16.3, {size:6.8});
    });
    y += sh + 8;

    // ---- performance (barra proporcional) ----
    const totalBar = nG+nR+nP+nV;
    const resolved = nG+nR;
    label('Performance', M, y);
    const taxa = resolved>0 ? (nG/resolved*100) : null;
    doc.setFont('helvetica','bold'); doc.setFontSize(8.5); doc.setTextColor(...C.ink);
    doc.text(taxa==null ? 'Sem apostas resolvidas' : 'Taxa de acerto  '+taxa.toFixed(1).replace('.',',')+'%', PW-M, y, {align:'right'});
    y += 3.5;
    doc.setFillColor(...C.line); doc.roundedRect(M, y, CW, 4.6, 2.3, 2.3, 'F');
    if(totalBar>0){
      const segs = [[nG,C.green],[nR,C.red],[nP,[226,178,70]],[nV,[170,179,192]]].filter(sg=>sg[0]>0);
      // desenha as fatias; as pontas ficam arredondadas porque a base já é arredondada
      let x = M;
      segs.forEach(([n,col],i)=>{
        const w = CW*n/totalBar;
        doc.setFillColor(...col);
        if(segs.length===1) doc.roundedRect(x, y, w, 4.6, 2.3, 2.3, 'F');
        else if(i===0){ doc.roundedRect(x, y, w, 4.6, 2.3, 2.3, 'F'); doc.rect(x+w-3, y, 3, 4.6, 'F'); }
        else if(i===segs.length-1){ doc.roundedRect(x, y, w, 4.6, 2.3, 2.3, 'F'); doc.rect(x, y, 3, 4.6, 'F'); }
        else doc.rect(x, y, w, 4.6, 'F');
        x += w;
      });
    }
    y += 4.6 + 5;
    let lx = M;
    [['Green',nG,C.green],['Red',nR,C.red],['Pendentes',nP,[226,178,70]],['Anuladas',nV,[170,179,192]]].forEach(([l,n,col])=>{
      if(l==='Anuladas' && n===0) return;
      doc.setFillColor(...col); doc.circle(lx+1, y-1, 1, 'F');
      doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(...C.gray);
      const txt = totalBar>0 ? `${l}: ${n} (${(n/totalBar*100).toFixed(1).replace('.',',')}%)` : `${l}: 0`;
      doc.text(txt, lx+3.4, y);
      lx += doc.getTextWidth(txt)+10;
    });
    y += 11;

    // ---- páginas seguintes: cabeçalho pequeno ----
    const runningHeader = ()=>{
      wordmark(M, 13, 11, false);
      doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(...C.gray);
      doc.text(pdfSafe(`Fechamento ${cl.name}  |  ${periodo}`), PW-M, 13, {align:'right'});
      doc.setDrawColor(...C.line); doc.setLineWidth(0.3); doc.line(M, 17, PW-M, 17);
    };
    const newPage = ()=>{ doc.addPage(); runningHeader(); return TOP_NEXT; };

    // ---- card de uma aposta (altura calculada antes de desenhar, nunca é cortado) ----
    const PADX = 6;
    const measureBet = (t)=>{
      const legsInfo = t.matches.map(m=>{
        const teams = pdfSafe((m.away ? `${m.home} x ${m.away}` : m.home).toUpperCase());
        const odd = m.odd>0 ? '  @ '+Number(m.odd).toFixed(2) : '';
        const detail = pdfSafe(`${m.market}: ${m.selection}${odd}`);
        doc.setFont('helvetica','bold'); doc.setFontSize(9);
        const tl = doc.splitTextToSize(teams, CW-PADX*2-30);
        doc.setFont('helvetica','normal'); doc.setFontSize(8.5);
        const dl = doc.splitTextToSize(detail, CW-PADX*2-30);
        return {tl, dl, st:statusInfo(m.result==='green'||m.result==='red'||m.result==='void' ? m.result : 'pending'), h: tl.length*4.1 + dl.length*3.8 + 3.4};
      });
      const legsH = legsInfo.reduce((s,l)=>s+l.h,0);
      return {legsInfo, h: 10 + 15 + 2.5 + legsH + 0.8};
    };
    const drawBet = (t, y0, info)=>{
      const r = ticketResult(t), st = statusInfo(r), profit = ticketProfit(t);
      const h = info.h;
      doc.setFillColor(255,255,255); doc.setDrawColor(...C.line); doc.setLineWidth(0.3);
      doc.roundedRect(M, y0, CW, h, 3, 3, 'FD');
      doc.setFillColor(...st.fg); doc.roundedRect(M, y0+3, 1.3, h-6, 0.65, 0.65, 'F');
      // linha 1: número, data/hora, status
      doc.setFont('helvetica','bold'); doc.setFontSize(10.5); doc.setTextColor(...C.ink);
      doc.text('#'+(t.ticketNumber||'-'), M+PADX, y0+7);
      const nw = doc.getTextWidth('#'+(t.ticketNumber||'-'));
      doc.setFont('helvetica','normal'); doc.setFontSize(8.5); doc.setTextColor(...C.gray);
      doc.text(pdfSafe(fmtDate(t.date)+(t.time?'  |  '+String(t.time).slice(0,5):'')), M+PADX+nw+4, y0+7);
      badge(PW-M-PADX, y0+6.1, st);
      // linha 2: valor, odd, resultado
      const ry = y0+12.5;
      label('Valor', M+PADX, ry+2.2, {size:6.3});
      doc.setFont('helvetica','bold'); doc.setFontSize(13); doc.setTextColor(...C.ink);
      doc.text(pdfMoney(t.stake), M+PADX, ry+8.6);
      label('Odd', M+78, ry+2.2, {size:6.3});
      doc.setFont('helvetica','bold'); doc.setFontSize(11.5); doc.setTextColor(...C.ink);
      doc.text(ticketOddTotal(t)>0 ? effectiveOdds(t).toFixed(2) : '-', M+78, ry+8.4);
      label('Resultado', PW-M-PADX, ry+2.2, {size:6.3, align:'right'});
      doc.setFont('helvetica','bold'); doc.setFontSize(13);
      if(r==='green' || r==='red'){ doc.setTextColor(...(profit>=0?C.green:C.red)); doc.text(pdfSigned(profit), PW-M-PADX, ry+8.6, {align:'right'}); }
      else { doc.setTextColor(...C.gray); doc.text('-', PW-M-PADX, ry+8.6, {align:'right'}); }
      // jogos
      let ly = y0+10+15+1;
      doc.setDrawColor(...C.line); doc.setLineWidth(0.25);
      doc.line(M+PADX, ly-1.2, PW-M-PADX, ly-1.2);
      info.legsInfo.forEach((lg, i)=>{
        if(i>0){ doc.setDrawColor(238,241,245); doc.line(M+PADX, ly-1.6, PW-M-PADX, ly-1.6); }
        let ty = ly+3.2;
        doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(...C.ink);
        lg.tl.forEach(line=>{ doc.text(line, M+PADX, ty); ty += 4.1; });
        doc.setFont('helvetica','normal'); doc.setFontSize(8.5); doc.setTextColor(...C.gray);
        lg.dl.forEach(line=>{ doc.text(line, M+PADX, ty); ty += 3.8; });
        badge(PW-M-PADX, ly+2.6, lg.st, 6.2);
        ly += lg.h;
      });
      return y0 + h;
    };

    // ---- JOGOS DA SEMANA ----
    const bets = allWeek.map(t=>({t, info:measureBet(t)}));
    const needFirst = 12 + (bets.length ? bets[0].info.h : 14);
    if(y + needFirst > BOTTOM){ y = newPage(); }
    doc.setFont('helvetica','bold'); doc.setFontSize(13); doc.setTextColor(...C.ink);
    doc.text('Jogos da semana', M, y+4);
    doc.setFont('helvetica','normal'); doc.setFontSize(8.5); doc.setTextColor(...C.gray);
    doc.text(`${allWeek.length} aposta${allWeek.length===1?'':'s'} no periodo`, PW-M, y+4, {align:'right'});
    y += 10;
    if(!bets.length){
      doc.setFontSize(10); doc.text('Nenhuma aposta nessa semana.', M, y+4); y += 10;
    }
    bets.forEach(({t, info})=>{
      if(y + info.h > BOTTOM) y = newPage();
      y = drawBet(t, y, info) + 4;
    });

    // ---- total da semana ----
    const totH = 17;
    if(y + totH > BOTTOM) y = newPage();
    doc.setFillColor(...C.soft); doc.setDrawColor(...C.line); doc.setLineWidth(0.3);
    doc.roundedRect(M, y, CW, totH, 3, 3, 'FD');
    label(`Total da semana (${tickets.length} apostas, sem anuladas)`, M+PADX, y+6.5, {size:6.8});
    label('Valor jogado', M+PADX, y+11.2, {size:6.3, cs:0.2});
    doc.setFont('helvetica','bold'); doc.setFontSize(10.5); doc.setTextColor(...C.ink);
    doc.text(pdfMoney(valorJogado), M+PADX+24, y+11.4);
    label('Resultado', PW-M-PADX-40, y+11.2, {size:6.3, cs:0.2, align:'right'});
    doc.setFont('helvetica','bold'); doc.setFontSize(11.5); doc.setTextColor(...colorOf(subtotal));
    doc.text(pdfSigned(subtotal), PW-M-PADX, y+11.4, {align:'right'});

    // ---- rodapé com numeração ----
    const total = doc.getNumberOfPages();
    for(let i=1;i<=total;i++){
      doc.setPage(i);
      doc.setDrawColor(...C.line); doc.setLineWidth(0.3); doc.line(M, 286, PW-M, 286);
      doc.setFont('helvetica','bold'); doc.setFontSize(7.5); doc.setTextColor(...C.navy);
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
