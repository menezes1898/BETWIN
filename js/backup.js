// ---------- BACKUP ----------
// Baixa uma cópia de TODAS as tabelas do sistema em um único arquivo (.json).
// Os prints (imagens) ficam guardados à parte no Supabase e não entram neste arquivo.
const BACKUP_TABLES = [
  'clients','tickets','settlements','withdrawals','transactions',
  'commissioners','commissioner_clients','client_week_discount','client_week_commissioners','client_discount_history',
  'profiles','whatsapp_groups','partners','partner_clients',
  'bot_validators','bot_status','bot_groups','bot_launches','account_meetings','app_settings'
];
const BACKUP_LAST_KEY = 'betwin_last_backup';
let BACKUP_RUNNING = false;

function backupLastInfo(){
  let iso = null; try{ iso = localStorage.getItem(BACKUP_LAST_KEY); }catch(e){}
  if(!iso) return {txt:'Nenhum backup baixado neste navegador ainda.', old:true};
  const d = new Date(iso); if(isNaN(d)) return {txt:'Nenhum backup baixado neste navegador ainda.', old:true};
  const dias = Math.floor((Date.now()-d.getTime())/86400000);
  const quando = d.toLocaleDateString('pt-BR')+' às '+d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
  return {txt:'Último backup: '+quando+(dias>0?' (há '+dias+' dia'+(dias===1?'':'s')+')':' (hoje)'), old: dias>=7};
}

async function baixarBackup(){
  if(BACKUP_RUNNING) return;
  BACKUP_RUNNING = true;
  const btn = document.getElementById('backup-btn'); const st = document.getElementById('backup-status');
  if(btn){ btn.disabled = true; btn.textContent = 'Gerando backup...'; }
  try{
    const tables = {}, avisos = [];
    for(const name of BACKUP_TABLES){
      if(st) st.textContent = 'Copiando: '+name+'...';
      let r; try{ r = await fetchAllRows(name); }catch(e){ r = {data:null, error:e}; }
      if(r.error){
        // tabelas opcionais (que talvez ainda não existam) não impedem o backup; as principais, sim
        if(['clients','tickets','settlements','withdrawals','transactions'].includes(name)) throw new Error('não consegui ler "'+name+'": '+(r.error.message||r.error));
        avisos.push(name);
      } else tables[name] = r.data || [];
    }
    const total = Object.values(tables).reduce((s,a)=>s+a.length,0);
    const payload = {app:'BetWin', versao:1, criado_em:new Date().toISOString(), tabelas:tables};
    const blob = new Blob([JSON.stringify(payload)], {type:'application/json'});
    const a = document.createElement('a');
    const d = new Date(); const pad = n=>String(n).padStart(2,'0');
    a.href = URL.createObjectURL(blob);
    a.download = 'betwin-backup-'+d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())+'_'+pad(d.getHours())+'h'+pad(d.getMinutes())+'.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href), 10000);
    try{ localStorage.setItem(BACKUP_LAST_KEY, new Date().toISOString()); }catch(e){}
    showToast('Backup baixado: '+total+' registros em '+Object.keys(tables).length+' tabelas.'+(avisos.length?' (sem acesso a: '+avisos.join(', ')+')':''), 'success');
  }catch(e){
    showToast('Erro ao gerar o backup: '+(e && e.message || e), 'error');
  }finally{
    BACKUP_RUNNING = false;
    render();
  }
}

function renderBackupCard(){
  const info = backupLastInfo();
  return `
    <h3>Backup dos dados</h3>
    <p class="muted" style="margin:0 0 12px;font-size:13px;line-height:1.5">Baixa uma cópia de segurança de tudo (clientes, apostas, acertos, financeiro, comissionados, parcerias e configurações do robô) em um arquivo no seu computador. Guarde o arquivo em um lugar seguro (por exemplo, Google Drive). Os prints das apostas não entram neste arquivo.</p>
    <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
      <button class="btn-primary" id="backup-btn" onclick="baixarBackup()">⬇ Baixar backup agora</button>
      <span id="backup-status" style="font-size:12.5px;${info.old?'color:var(--red)':'color:var(--text-muted)'}">${info.txt}${info.old?' — faça um backup toda semana.':''}</span>
    </div>`;
}
