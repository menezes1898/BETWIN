function drawStadiumFallback(ctx, w, h){
  const grad = ctx.createLinearGradient(0,0,0,h);
  grad.addColorStop(0,'#0B2049'); grad.addColorStop(0.55,'#071633'); grad.addColorStop(1,'#040A1C');
  ctx.fillStyle = grad; ctx.fillRect(0,0,w,h);
  [[50,30],[w-50,30]].forEach(([cx,cy])=>{
    const g = ctx.createRadialGradient(cx,cy,0,cx,cy,260);
    g.addColorStop(0,'rgba(62,193,243,0.22)');
    g.addColorStop(1,'rgba(62,193,243,0)');
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(cx,cy,260,0,Math.PI*2); ctx.fill();
  });
  ctx.save();
  ctx.globalAlpha = 0.09;
  ctx.strokeStyle = '#9FC3E8';
  for(let i=0;i<6;i++){
    ctx.beginPath();
    ctx.ellipse(w/2, -220-i*12, w*0.72+i*26, 150+i*16, 0, 0, Math.PI);
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 2;
  const pitchY = h-60;
  ctx.beginPath(); ctx.moveTo(0,pitchY); ctx.lineTo(w,pitchY); ctx.stroke();
  ctx.beginPath(); ctx.arc(w/2,pitchY,44,Math.PI,Math.PI*2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(w/2,pitchY-44); ctx.lineTo(w/2,h); ctx.stroke();
  ctx.restore();
}
function drawBackground(ctx, w, h){
  return new Promise((resolve)=>{
    const saved = localStorage.getItem(BG_STORAGE_KEY);
    if(!saved){ drawStadiumFallback(ctx,w,h); resolve(); return; }
    const img = new Image();
    img.onload = ()=>{
      const scale = Math.max(w/img.width, h/img.height);
      const dw = img.width*scale, dh = img.height*scale;
      ctx.drawImage(img, (w-dw)/2, (h-dh)/2, dw, dh);
      resolve();
    };
    img.onerror = ()=>{ drawStadiumFallback(ctx,w,h); resolve(); };
    img.src = saved;
  });
}
function drawTextLogo(ctx){
  ctx.textAlign='left'; ctx.textBaseline='alphabetic';
  ctx.font = '700 40px Montserrat, Arial, sans-serif';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText('BET', 40, 66);
  const w = ctx.measureText('BET').width;
  ctx.fillStyle = '#3EC1F3';
  ctx.fillText('WIN', 40+w, 66);
}
function drawLogo(ctx){
  return new Promise((resolve)=>{
    if(localStorage.getItem(LOGO_HIDDEN_KEY)==='true'){ resolve(); return; }
    const saved = localStorage.getItem(LOGO_STORAGE_KEY);
    if(!saved){ drawTextLogo(ctx); resolve(); return; }
    const shape = localStorage.getItem(LOGO_SHAPE_KEY) || 'round';
    const img = new Image();
    img.onload = ()=>{
      const size = 100, x = 40, y = 18;
      const srcSize = Math.min(img.width, img.height);
      const sx = (img.width-srcSize)/2, sy = (img.height-srcSize)/2;
      if(shape==='round'){
        ctx.save();
        ctx.beginPath();
        ctx.arc(x+size/2, y+size/2, size/2, 0, Math.PI*2);
        ctx.clip();
        ctx.drawImage(img, sx, sy, srcSize, srcSize, x, y, size, size);
        ctx.restore();
      } else {
        roundRect(ctx, x, y, size, size, 10);
        ctx.save(); ctx.clip();
        ctx.drawImage(img, sx, sy, srcSize, srcSize, x, y, size, size);
        ctx.restore();
      }
      resolve();
    };
    img.onerror = ()=>{ drawTextLogo(ctx); resolve(); };
    img.src = saved;
  });
}
async function gerarFechamento(clientId){
  try{
  const cl = STATE.clients.find(c=>c.id===clientId);
  if(!cl){ alert('Cliente não encontrado.'); return; }
  const todaySPStr = todaySP();
  const weekMonday = DASH_WEEK || mondayOf(todaySPStr);
  const tickets = STATE.tickets.filter(t=>t.clientId===clientId && mondayOf(ticketDate(t))===weekMonday && ticketResult(t)!=='void');

  // Valor Jogado: total de todas as apostas da semana (informativo, inclui pendentes — bate com "Volume" do Dashboard)
  const valorJogado = tickets.reduce((s,t)=>s+t.stake,0);
  // Acertos: valor apostado + lucro das apostas Green (retorno total)
  const acertos = tickets.filter(t=>ticketResult(t)==='green').reduce((s,t)=>s+t.stake*effectiveOdds(t),0);
  // Subtotal: usa o resultado real (ticketProfit) de cada aposta, que já conta ZERO pra apostas
  // ainda pendentes — assim uma aposta não resolvida nunca é cobrada na semana fechada, fica de
  // fora do saldo até ser decidida (mesma lógica usada no Dashboard e no Financeiro).
  const subtotal = tickets.reduce((s,t)=>s+ticketProfit(t),0);
  // Desconto: só existe se o cliente tem desconto cadastrado, e incide só sobre o saldo da semana
  const descontoPct = getWeekDiscount(cl, weekMonday);
  const desconto = computeDescontoAmount(cl, subtotal, weekMonday);
  const temDesconto = desconto>0;

  // Saldo anterior: saldo contínuo (todas as semanas anteriores + saldo em aberto,
  // já líquido de tudo que foi pago) — exatamente o mesmo cálculo usado no Financeiro.
  const openTransactions = STATE.transactions.filter(t=>t.type==='em_aberto' && t.clientId===clientId);
  const temSaldoAnterior = Math.abs(computeContinuousBalance(clientId, weekMonday)) >= 0.01;
  const saldoAnterior = -computeContinuousBalance(clientId, weekMonday);
  const saldoSemana = applyDescontoSign(cl, subtotal, desconto);
  const saldoTotal = saldoSemana + saldoAnterior;

  // Monta a lista de linhas a desenhar
  const linhas = [];
  linhas.push(['VALOR JOGADO:', 'R$ - '+fmtBRL(valorJogado).replace('R$','').trim(), '#E0575A', false]);
  linhas.push(['ACERTOS:', 'R$ + '+fmtBRL(acertos).replace('R$','').trim(), '#3FB68B', false]);
  linhas.push(['SUBTOTAL:', (subtotal>=0?'R$ + ':'R$ - ')+fmtBRL(Math.abs(subtotal)).replace('R$','').trim(), subtotal>=0?'#3FB68B':'#E0575A', false]);
  if(temDesconto){
    linhas.push(['DESCONTO:', 'R$ + '+fmtBRL(desconto).replace('R$','').trim(), '#3EC1F3', false]);
  }
  if(temSaldoAnterior){
    linhas.push(['SALDO DA SEMANA:', (saldoSemana>=0?'R$ + ':'R$ - ')+fmtBRL(Math.abs(saldoSemana)).replace('R$','').trim(), saldoSemana>=0?'#3FB68B':'#E0575A', false]);
    linhas.push(['SALDO ANTERIOR:', (saldoAnterior>=0?'R$ + ':'R$ - ')+fmtBRL(Math.abs(saldoAnterior)).replace('R$','').trim(), saldoAnterior>=0?'#3FB68B':'#E0575A', false]);
  }
  linhas.push(['SALDO TOTAL:', (saldoTotal>=0?'R$ + ':'R$ - ')+fmtBRL(Math.abs(saldoTotal)).replace('R$','').trim(), saldoTotal>=0?'#3FB68B':'#E0575A', true]);

  const marginX = 55;
  const headerH = 205;
  const FIXED_W = 720, FIXED_H = 700;
  let rowH = 44, rowGap = 9;
  const availableForRows = FIXED_H - headerH - 30;
  const naturalRowsHeight = linhas.length*(rowH+rowGap) + 20;
  if(naturalRowsHeight > availableForRows){
    const scale = availableForRows / naturalRowsHeight;
    rowH *= scale; rowGap *= scale;
  }
  const canvas = document.createElement('canvas');
  canvas.width = FIXED_W; canvas.height = FIXED_H;
  const ctx = canvas.getContext('2d');

  await drawBackground(ctx, canvas.width, canvas.height);
  await drawLogo(ctx);

  // ---- bloco "PERÍODO" (ícone ao lado do rótulo, data embaixo) ----
  ctx.textBaseline = 'alphabetic';
  const rightEdge = canvas.width-40;
  ctx.font = '600 10.5px Montserrat, Arial, sans-serif';
  const labelW = ctx.measureText('PERÍODO').width;
  const monday = new Date(weekMonday+'T00:00:00');
  const sunday = new Date(monday); sunday.setDate(monday.getDate()+6);
  const fmtLong = d => d.toLocaleDateString('pt-BR');
  const periodoStr = fmtLong(monday)+' a '+fmtLong(sunday);

  const iconSize = 13, iconGap = 6;
  const iconX = rightEdge - labelW - iconGap - iconSize;
  const iconY = 12;

  ctx.save();
  ctx.strokeStyle = '#8FB3DC'; ctx.fillStyle = '#8FB3DC'; ctx.lineWidth = 1.3;
  roundRect(ctx, iconX, iconY, iconSize, iconSize, 2.5); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(iconX,iconY+5); ctx.lineTo(iconX+iconSize,iconY+5); ctx.stroke();
  ctx.fillRect(iconX+2.5,iconY-2,1.6,5); ctx.fillRect(iconX+iconSize-4.1,iconY-2,1.6,5);
  ctx.restore();

  ctx.textAlign='right';
  ctx.font = '600 10.5px Montserrat, Arial, sans-serif';
  ctx.fillStyle = '#8FB3DC';
  ctx.fillText('PERÍODO', rightEdge, 25);
  ctx.font = '700 13px Inter, Arial, sans-serif';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(periodoStr, rightEdge, 42);

  // ---- título (desce mais, e encolhe sozinho se o nome for grande, pra nunca esbarrar na logo) ----
  let titleSize = 24;
  const maxTitleWidth = canvas.width - 90;
  let wA, wB;
  do{
    ctx.font = `700 ${titleSize}px Montserrat, Arial, sans-serif`;
    const titleA = 'FECHAMENTO: '; const titleB = cl.name.toUpperCase();
    wA = ctx.measureText(titleA).width; wB = ctx.measureText(titleB).width;
    if(wA+wB <= maxTitleWidth || titleSize<=15) break;
    titleSize -= 1;
  } while(true);
  const titleA = 'FECHAMENTO: '; const titleB = cl.name.toUpperCase();
  const startX = canvas.width/2 - (wA+wB)/2;
  ctx.textAlign='left';
  ctx.fillStyle = '#FFFFFF'; ctx.fillText(titleA, startX, 170);
  ctx.fillStyle = '#3EC1F3'; ctx.fillText(titleB, startX+wA, 170);

  let rowY = headerH;
  const rowW = canvas.width - marginX*2;

  linhas.forEach(([label, value, color, big], idx)=>{
    if(big) rowY += 10;
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    roundRect(ctx, marginX, rowY, rowW, rowH, 9); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1.5;
    roundRect(ctx, marginX, rowY, rowW, rowH, 9); ctx.stroke();
    ctx.textAlign='left';
    ctx.font = `italic 700 ${big?17:14.5}px Montserrat, Arial, sans-serif`;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(label, marginX+20, rowY+rowH/2+5);
    ctx.textAlign='right';
    ctx.font = (big?'700 19px ':'700 16px ')+"'JetBrains Mono', monospace";
    ctx.fillStyle = color;
    ctx.fillText(value, marginX+rowW-20, rowY+rowH/2+5);
    rowY += rowH+rowGap;
  });

  const dataUrl = canvas.toDataURL('image/png');
  showFechamentoPreview(dataUrl, cl.name, weekMonday);
  }catch(err){
    alert('Erro ao gerar a imagem de fechamento: '+err.message);
  }
}
function showFechamentoPreview(dataUrl, clientName, weekMonday){
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;gap:14px;';
  const img = document.createElement('img');
  img.src = dataUrl;
  img.style.cssText = 'max-width:100%;max-height:75vh;border-radius:10px;box-shadow:0 10px 40px rgba(0,0,0,0.5);';
  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:10px;';
  const downloadBtn = document.createElement('a');
  downloadBtn.href = dataUrl;
  downloadBtn.download = `fechamento-${clientName.replace(/\s+/g,'-').toLowerCase()}-${weekMonday}.png`;
  downloadBtn.textContent = 'Baixar imagem';
  downloadBtn.className = 'btn-primary';
  downloadBtn.style.cssText = 'padding:10px 18px;border-radius:4px;text-decoration:none;font-weight:600;';
  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Fechar';
  closeBtn.className = 'btn-ghost';
  closeBtn.style.cssText = 'padding:10px 18px;border-radius:4px;';
  closeBtn.onclick = ()=>document.body.removeChild(overlay);
  btnRow.appendChild(downloadBtn); btnRow.appendChild(closeBtn);
  overlay.appendChild(img); overlay.appendChild(btnRow);
  overlay.onclick = (e)=>{ if(e.target===overlay) document.body.removeChild(overlay); };
  document.body.appendChild(overlay);
}

