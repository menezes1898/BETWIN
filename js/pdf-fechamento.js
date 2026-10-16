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

    const GREEN=[34,150,110], RED=[205,70,75], BLUE=[27,143,192], DARK=[13,20,32], GRAY=[110,120,136];
    const colorOf = v => v>=0 ? GREEN : RED;
    const linhas = [];
    linhas.push(['VALOR JOGADO', '- '+pdfMoney(valorJogado), RED]);
    linhas.push(['ACERTOS', '+ '+pdfMoney(acertos), GREEN]);
    linhas.push(['SUBTOTAL', pdfSigned(subtotal), colorOf(subtotal)]);
    if(temDesconto) linhas.push(['DESCONTO'+(descontoPct?' ('+descontoPct+'%)':''), '+ '+pdfMoney(desconto), BLUE]);
    if(temSaldoAnterior){
      linhas.push(['SALDO DA SEMANA', pdfSigned(saldoSemana), colorOf(saldoSemana)]);
      linhas.push(['SALDO ANTERIOR', pdfSigned(saldoAnterior), colorOf(saldoAnterior)]);
    }
    linhas.push(['SALDO TOTAL', pdfSigned(saldoTotal), colorOf(saldoTotal), true]);

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({unit:'mm', format:'a4'});
    const PW = 210, M = 14;

    // ---- cabeçalho ----
    doc.setFillColor(...DARK); doc.rect(0, 0, PW, 34, 'F');
    let logoDrawn = false;
    try{
      if(localStorage.getItem(LOGO_HIDDEN_KEY)!=='true'){
        const saved = localStorage.getItem(LOGO_STORAGE_KEY);
        if(saved){
          const fmt = /^data:image\/(png|jpe?g|webp)/i.exec(saved);
          if(fmt){ doc.addImage(saved, fmt[1].toUpperCase().replace('JPG','JPEG'), M, 7, 20, 20); logoDrawn = true; }
        }
      }
    }catch(e){ logoDrawn = false; }
    if(!logoDrawn && localStorage.getItem(LOGO_HIDDEN_KEY)!=='true'){
      doc.setFont('helvetica','bold'); doc.setFontSize(22);
      doc.setTextColor(255,255,255); doc.text('BET', M, 22);
      const wBet = doc.getTextWidth('BET');
      doc.setTextColor(62,193,243); doc.text('WIN', M+wBet, 22);
    }
    const monday = new Date(weekMonday+'T00:00:00'); const sunday = new Date(monday); sunday.setDate(monday.getDate()+6);
    const periodo = monday.toLocaleDateString('pt-BR')+' a '+sunday.toLocaleDateString('pt-BR');
    doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(143,179,220);
    doc.text('PERIODO', PW-M, 15, {align:'right'});
    doc.setFontSize(12); doc.setTextColor(255,255,255);
    doc.text(periodo, PW-M, 22, {align:'right'});

    // ---- título ----
    let tSize = 19; const nome = pdfSafe(cl.name.toUpperCase());
    doc.setFont('helvetica','bold');
    do{ doc.setFontSize(tSize); if(doc.getTextWidth('FECHAMENTO: '+nome) <= PW-2*M || tSize<=11) break; tSize -= 1; } while(true);
    doc.setTextColor(...DARK); doc.text('FECHAMENTO: ', M, 47);
    const wT = doc.getTextWidth('FECHAMENTO: ');
    doc.setTextColor(...BLUE); doc.text(nome, M+wT, 47);

    // ---- resumo financeiro ----
    const body = linhas.map(([label, value, color, big])=>[
      {content:label, styles:{fontStyle:'bold', fontSize: big?12:10.5, textColor: DARK}},
      {content:value, styles:{fontStyle:'bold', fontSize: big?13:11, textColor: color, halign:'right'}}
    ]);
    doc.autoTable({
      startY: 53, margin:{left:M,right:M}, body, theme:'plain',
      styles:{font:'helvetica', cellPadding:{top:3.2,bottom:3.2,left:5,right:5}, lineColor:[220,226,234], lineWidth:0.2},
      columnStyles:{0:{cellWidth:100}, 1:{cellWidth:82}},
      didParseCell: (d)=>{
        if(d.section==='body'){
          d.cell.styles.fillColor = d.row.index===body.length-1 ? [236,243,250] : [248,250,252];
        }
      }
    });
    let y = doc.lastAutoTable.finalY + 6;

    // ---- contagem ----
    const nG = tickets.filter(t=>ticketResult(t)==='green').length;
    const nR = tickets.filter(t=>ticketResult(t)==='red').length;
    const nP = tickets.filter(t=>ticketResult(t)==='pending').length;
    doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(...GRAY);
    doc.text(`Apostas: ${tickets.length}   |   Green: ${nG}   |   Red: ${nR}   |   Pendentes: ${nP}`, M, y);
    y += 9;

    // ---- jogos da semana ----
    doc.setFont('helvetica','bold'); doc.setFontSize(13); doc.setTextColor(...DARK);
    doc.text('Jogos da semana', M, y);
    y += 3;

    const resLabel = {green:'Green', red:'Red', void:'Anulada', pending:'Pendente'};
    const rows = allWeek.map(t=>{
      const r = ticketResult(t);
      const profit = ticketProfit(t);
      const legs = t.matches.map(m=>{
        const teams = m.away ? `${m.home} x ${m.away}` : m.home;
        const odd = m.odd>0 ? ' @ '+Number(m.odd).toFixed(2) : '';
        return pdfSafe(`${teams}\n   ${m.market}: ${m.selection}${odd}  (${resLabel[m.result]||'Pendente'})`);
      }).join('\n');
      const resTxt = r==='pending' ? 'Pendente' : (r==='void' ? 'Anulada' : pdfSigned(profit));
      const resColor = r==='green' ? GREEN : (r==='red' ? RED : GRAY);
      return {
        r,
        cells:[
          pdfSafe(fmtDate(t.date)+(t.time?'\n'+String(t.time).slice(0,5):'')),
          '#'+(t.ticketNumber||'-'),
          legs,
          pdfMoney(t.stake),
          ticketOddTotal(t)>0 ? effectiveOdds(t).toFixed(2) : '-',
          {content:resTxt, styles:{textColor:resColor, fontStyle:'bold', halign:'right'}}
        ]
      };
    });

    if(!rows.length){
      doc.setFont('helvetica','normal'); doc.setFontSize(10); doc.setTextColor(...GRAY);
      doc.text('Nenhuma aposta nessa semana.', M, y+8);
    } else {
      doc.autoTable({
        startY: y, margin:{left:M,right:M,bottom:16},
        head:[['Data','Nº','Jogos','Valor','Odd','Resultado']],
        body: rows.map(x=>x.cells),
        foot:[[{content:`Total (${tickets.length} apostas, sem anuladas)`, colSpan:3, styles:{halign:'left'}}, pdfMoney(valorJogado), '', {content:pdfSigned(subtotal), styles:{halign:'right', textColor: colorOf(subtotal)}}]],
        showFoot:'lastPage', rowPageBreak:'avoid',
        theme:'grid',
        styles:{font:'helvetica', fontSize:8.5, cellPadding:2.2, lineColor:[222,228,236], lineWidth:0.2, textColor:DARK, valign:'middle'},
        headStyles:{fillColor:DARK, textColor:[255,255,255], fontStyle:'bold', fontSize:8.5},
        footStyles:{fillColor:[236,243,250], textColor:DARK, fontStyle:'bold'},
        columnStyles:{0:{cellWidth:16}, 1:{cellWidth:16}, 2:{cellWidth:'auto'}, 3:{cellWidth:25, halign:'right'}, 4:{cellWidth:14, halign:'center'}, 5:{cellWidth:25}},
        didParseCell:(d)=>{
          if(d.section==='body'){
            const r = rows[d.row.index].r;
            if(r==='red') d.cell.styles.fillColor = [253,236,236];
            else if(r==='green') d.cell.styles.fillColor = [231,247,240];
            else if(r==='void') d.cell.styles.textColor = GRAY;
          }
        }
      });
    }

    // ---- rodapé com numeração ----
    const total = doc.getNumberOfPages();
    for(let i=1;i<=total;i++){
      doc.setPage(i);
      doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(...GRAY);
      doc.text(pdfSafe(`BET WIN - Fechamento ${cl.name} - ${periodo}`), M, 290);
      doc.text(`Pagina ${i} de ${total}`, PW-M, 290, {align:'right'});
    }

    const safeName = cl.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\w\- ]+/g,'').trim().replace(/\s+/g,'-') || 'cliente';
    const file = `fechamento-${safeName}-${weekMonday}.pdf`;
    doc.save(file);
    showToast('PDF gerado: '+file);
  }catch(err){
    showToast('Erro ao gerar o PDF: '+err.message);
  }
}
