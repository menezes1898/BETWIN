// ==================== DESTAQUES DO DIA (envio de arte pro WhatsApp) ====================
// Fluxo: a arte em si é gerada fora do sistema (ChatGPT/Claude, a partir de um print do
// Flashscore, usando o prompt-modelo fornecido). Aqui o usuário só cola/seleciona a imagem
// pronta, escreve a legenda, e usa o botão de compartilhar pra mandar rapidinho pra cada
// grupo do WhatsApp — sem precisar salvar a imagem manualmente nem redigitar o texto.
// A lista de grupos fica salva (nomes), e um checklist ajuda a não esquecer nenhum grupo.

function dataURLtoFile(dataurl, filename){
  const arr = dataurl.split(',');
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/png';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while(n--){ u8arr[n] = bstr.charCodeAt(n); }
  return new File([u8arr], filename, {type: mime});
}

function defaultDestaqueCaption(){
  const hoje = new Date().toLocaleDateString('pt-BR', {timeZone:'America/Sao_Paulo', day:'2-digit', month:'2-digit'});
  return `🔥 DESTAQUES DE HOJE — ${hoje}\n\nFique de olho nas melhores odds do dia! ⚽📈\n\nBoa aposta! 🍀`;
}

function renderDestaquesTab(){
  if(!DESTAQUE_CAPTION) DESTAQUE_CAPTION = defaultDestaqueCaption();
  const groups = STATE.whatsappGroups;
  const sentCount = groups.filter(g=>DESTAQUE_SENT_IDS.has(g.id)).length;

  return `
    <div class="card">
      <h3 style="margin-top:0">1. Gerar a arte</h3>
      <p style="font-size:12.5px;color:var(--text-muted);margin:6px 0 12px">
        Tire um print dos jogos do Flashscore que você quer destacar (com as odds visíveis) e cole no ChatGPT ou no Claude
        junto com o prompt abaixo. Em poucos segundos ele te devolve a arte pronta — aí é só baixar e colar aqui embaixo.
      </p>
      <button class="btn-ghost btn-sm" onclick="toggleDestaquePrompt()">${SHOW_DESTAQUE_PROMPT?'Esconder':'Ver'} prompt pronto para copiar</button>
      ${SHOW_DESTAQUE_PROMPT ? `
        <div style="margin-top:10px;position:relative">
          <textarea id="destaque-prompt-text" readonly rows="9" style="font-family:var(--font-mono);font-size:11.5px;line-height:1.5">${DESTAQUE_PROMPT_TEMPLATE}</textarea>
          <div style="margin-top:8px"><button class="btn-ghost btn-sm" onclick="copyDestaquePrompt()">Copiar prompt</button></div>
        </div>
      ` : ''}
    </div>

    <div class="card">
      <h3 style="margin-top:0">2. Colar a imagem pronta</h3>
      <div id="destaque-drop-zone" tabindex="0" onpaste="handleDestaqueImagePaste(event)"
        style="border:1.5px dashed var(--line);border-radius:var(--radius);padding:${DESTAQUE_IMAGE_DATAURL?'10px':'28px'};text-align:center;cursor:text;outline:none;background:var(--surface-2)">
        ${DESTAQUE_IMAGE_DATAURL ? `
          <img src="${DESTAQUE_IMAGE_DATAURL}" style="max-width:100%;max-height:340px;border-radius:8px;display:block;margin:0 auto">
          <div style="margin-top:10px"><button class="btn-ghost btn-sm" onclick="clearDestaqueImage()">✕ Remover imagem</button></div>
        ` : `
          <div style="color:var(--text-muted);font-size:13px">Clique aqui e aperte <strong>Ctrl+V</strong> pra colar a imagem copiada, ou selecione um arquivo abaixo</div>
        `}
      </div>
      <div style="margin-top:10px">
        <input type="file" accept="image/*" id="destaque-file-input" style="display:none" onchange="handleDestaqueImageFile(this)">
        <button class="btn-ghost btn-sm" onclick="document.getElementById('destaque-file-input').click()">Selecionar arquivo de imagem</button>
      </div>
    </div>

    <div class="card">
      <h3 style="margin-top:0">3. Legenda</h3>
      <textarea id="destaque-caption" rows="5" oninput="DESTAQUE_CAPTION=this.value" style="font-size:13.5px;line-height:1.5">${DESTAQUE_CAPTION}</textarea>
    </div>

    <div class="card">
      <h3 style="margin-top:0">4. Enviar</h3>
      <p style="font-size:12.5px;color:var(--text-muted);margin:6px 0 12px">
        No celular, "Compartilhar" já abre o WhatsApp com a imagem e a legenda prontas — você só escolhe o grupo e manda.
        No computador, ele baixa a imagem e copia a legenda, pra você colar em cada grupo no WhatsApp Web.
      </p>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn-primary" onclick="compartilharDestaque()">📤 Compartilhar</button>
        <button class="btn-ghost btn-sm" onclick="downloadDestaqueImage()">Baixar imagem</button>
        <button class="btn-ghost btn-sm" onclick="copyDestaqueCaption()">Copiar legenda</button>
        <a class="btn-ghost btn-sm" href="https://web.whatsapp.com" target="_blank" rel="noopener" style="text-decoration:none;display:inline-flex;align-items:center">Abrir WhatsApp Web ↗</a>
      </div>
    </div>

    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
        <h3 style="margin:0">Grupos</h3>
        <span style="font-family:var(--font-mono);font-size:13px;color:var(--gold)">${sentCount}/${groups.length} enviados</span>
      </div>
      <p style="font-size:12px;color:var(--text-muted);margin:6px 0 14px">Marque cada grupo conforme for enviando, pra não perder o controle de quem já recebeu hoje.</p>

      ${groups.length===0 ? '<div class="empty">Nenhum grupo cadastrado ainda.</div>' : `
        <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:12px">
          ${groups.map(g=>`
            <label style="display:flex;align-items:center;gap:10px;cursor:pointer;margin:0;text-transform:none;font-size:14px;padding:8px 10px;border:1px solid var(--line-soft);border-radius:8px;${DESTAQUE_SENT_IDS.has(g.id)?'opacity:0.55':''}">
              <input type="checkbox" style="width:auto" ${DESTAQUE_SENT_IDS.has(g.id)?'checked':''} onchange="toggleGrupoEnviado('${g.id}')">
              <span style="flex:1;${DESTAQUE_SENT_IDS.has(g.id)?'text-decoration:line-through':''}">${g.name}</span>
              <button class="icon-btn icon-danger" title="Remover grupo" onclick="event.preventDefault();removeWhatsappGroup('${g.id}')">🗑</button>
            </label>
          `).join('')}
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">
          <button class="btn-ghost btn-sm" onclick="marcarTodosGruposEnviados()">✓ Marcar todos</button>
          <button class="btn-ghost btn-sm" onclick="resetarChecklistGrupos()">↺ Novo dia (limpar marcações)</button>
        </div>
      `}

      <div style="padding-top:12px;border-top:1px solid var(--line-soft)">
        <label>Adicionar grupo</label>
        <div class="row">
          <input type="text" id="new-grupo-name" placeholder="Ex: Clientes VIP" onkeydown="if(event.key==='Enter') addWhatsappGroup()">
          <button class="btn-primary" style="white-space:nowrap" onclick="addWhatsappGroup()">Adicionar</button>
        </div>
      </div>
    </div>
  `;
}

function toggleDestaquePrompt(){
  SHOW_DESTAQUE_PROMPT = !SHOW_DESTAQUE_PROMPT;
  render();
}
async function copyDestaquePrompt(){
  await copyTextToClipboard(DESTAQUE_PROMPT_TEMPLATE);
  showToast('Prompt copiado!');
}

// ---------- IMAGEM ----------
function handleDestaqueImagePaste(event){
  const items = (event.clipboardData || event.originalEvent && event.originalEvent.clipboardData || {items:[]}).items;
  if(!items) return;
  for(const item of items){
    if(item.type && item.type.startsWith('image/')){
      event.preventDefault();
      const file = item.getAsFile();
      readImageFileToState(file);
      return;
    }
  }
  showToast('Não encontrei nenhuma imagem colada — copie a imagem (não o arquivo) e tente de novo.');
}
function handleDestaqueImageFile(input){
  const file = input.files && input.files[0];
  if(!file) return;
  readImageFileToState(file);
}
function readImageFileToState(file){
  if(!file || !file.type || !file.type.startsWith('image/')){ showToast('Selecione um arquivo de imagem válido.'); return; }
  const reader = new FileReader();
  reader.onload = ()=>{
    DESTAQUE_IMAGE_DATAURL = reader.result;
    DESTAQUE_IMAGE_NAME = file.name || ('destaques-'+todaySP()+'.png');
    render();
  };
  reader.readAsDataURL(file);
}
function clearDestaqueImage(){
  DESTAQUE_IMAGE_DATAURL = null;
  DESTAQUE_IMAGE_NAME = '';
  render();
}
function downloadDestaqueImage(){
  if(!DESTAQUE_IMAGE_DATAURL){ showToast('Cole ou selecione a imagem primeiro.'); return; }
  const a = document.createElement('a');
  a.href = DESTAQUE_IMAGE_DATAURL;
  a.download = DESTAQUE_IMAGE_NAME || ('destaques-'+todaySP()+'.png');
  document.body.appendChild(a);
  a.click();
  a.remove();
}
async function copyTextToClipboard(text){
  try{
    if(navigator.clipboard && navigator.clipboard.writeText){ await navigator.clipboard.writeText(text); return true; }
  }catch(e){ /* cai no fallback abaixo */ }
  try{
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position='fixed'; ta.style.opacity='0';
    document.body.appendChild(ta); ta.focus(); ta.select();
    document.execCommand('copy');
    ta.remove();
    return true;
  }catch(e){ return false; }
}
async function copyDestaqueCaption(){
  const ok = await copyTextToClipboard(DESTAQUE_CAPTION||'');
  showToast(ok ? 'Legenda copiada!' : 'Não consegui copiar automaticamente — selecione o texto manualmente.');
}

// ---------- COMPARTILHAR ----------
async function compartilharDestaque(){
  if(!DESTAQUE_IMAGE_DATAURL){ showToast('Cole ou selecione a imagem primeiro.'); return; }
  const caption = DESTAQUE_CAPTION || '';
  const filename = DESTAQUE_IMAGE_NAME || ('destaques-'+todaySP()+'.png');
  const file = dataURLtoFile(DESTAQUE_IMAGE_DATAURL, filename);

  if(navigator.canShare && navigator.canShare({files:[file]})){
    try{
      await navigator.share({files:[file], text: caption, title:'Destaques do dia'});
      return;
    }catch(e){
      if(e && e.name==='AbortError') return; // usuário cancelou o compartilhamento, tudo bem
      showToast('Não consegui abrir o compartilhamento — baixando a imagem como alternativa.');
    }
  }
  // Fallback (ex: desktop, onde o WhatsApp Web não aceita imagem anexada por link):
  downloadDestaqueImage();
  await copyTextToClipboard(caption);
  showToast('Imagem baixada e legenda copiada — abra o WhatsApp Web e cole em cada grupo.');
}

// ---------- GRUPOS ----------
async function addWhatsappGroup(){
  const input = document.getElementById('new-grupo-name');
  const name = input.value.trim();
  if(!name){ showToast('Digite o nome do grupo.'); return; }
  const {data, error} = await supabaseClient.from('whatsapp_groups').insert({name}).select().single();
  if(error){ showToast('Erro ao adicionar grupo: '+error.message); return; }
  STATE.whatsappGroups.push({id:data.id, name:data.name});
  input.value = '';
  render();
}
async function removeWhatsappGroup(id){
  if(!confirm('Remover esse grupo da lista?')) return;
  const {error} = await supabaseClient.from('whatsapp_groups').delete().eq('id', id);
  if(error){ showToast('Erro ao remover grupo: '+error.message); return; }
  STATE.whatsappGroups = STATE.whatsappGroups.filter(g=>g.id!==id);
  DESTAQUE_SENT_IDS.delete(id);
  render();
}
function toggleGrupoEnviado(id){
  if(DESTAQUE_SENT_IDS.has(id)) DESTAQUE_SENT_IDS.delete(id); else DESTAQUE_SENT_IDS.add(id);
  render();
}
function marcarTodosGruposEnviados(){
  STATE.whatsappGroups.forEach(g=>DESTAQUE_SENT_IDS.add(g.id));
  render();
}
function resetarChecklistGrupos(){
  DESTAQUE_SENT_IDS = new Set();
  render();
}

// ---------- PROMPT MODELO (pra colar no ChatGPT/Claude junto com o print) ----------
const DESTAQUE_PROMPT_TEMPLATE = `Crie uma arte quadrada (estilo post de Instagram/WhatsApp) para divulgar os "Destaques do Dia" de apostas esportivas, usando como base os jogos, times e odds que aparecem no print que eu colei. Regras:
- Use só jogos de futebol.
- Traga só os jogos em destaque (os principais do dia), não a lista inteira.
- Para cada jogo, mostre: nome dos dois times, campeonato/liga, horário, e a odd do mercado em destaque (deixe a odd bem visível, em fonte grande).
- Título no topo: "DESTAQUES DE HOJE" com a data de hoje.
- Visual: fundo escuro (tons de azul-marinho/preto), detalhes em dourado/verde, tipografia esportiva, moderna, estilo casa de apostas premium.
- Não invente jogos, times ou odds que não estejam no print — use exatamente os dados da imagem.
- Não coloque marca, nome de empresa ou logotipo que não seja meu.
Gere a imagem final pronta para eu enviar no WhatsApp.`;
