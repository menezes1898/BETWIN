window.addEventListener('hashchange', render);
supabaseClient.auth.onAuthStateChange((event, session)=>{ SESSION = session; });

// Atalhos de teclado
window.addEventListener('keydown', (e)=>{
  const typing = document.activeElement && ['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName);

  if(e.key==='Escape'){
    const overlays = ['week-comm-overlay','logo-preview-overlay','bg-preview-overlay'];
    for(const id of overlays){
      if(document.getElementById(id)){
        if(id==='week-comm-overlay') cancelWeekCommEdit();
        else if(id==='logo-preview-overlay') cancelLogoPreview();
        else if(id==='bg-preview-overlay') cancelBgPreview();
        return;
      }
    }
    if(SESSION && ADMIN_TAB==='apostas' && ADMIN_SUBVIEW==='wizard'){ cancelWizard(); return; }
    if(typing) document.activeElement.blur();
    return;
  }

  if(typing || !SESSION) return;
  if(e.metaKey || e.ctrlKey || e.altKey) return;

  if(e.key==='n' || e.key==='N'){
    if(ADMIN_TAB==='apostas' && ADMIN_SUBVIEW==='list'){ e.preventDefault(); startNewTicket(); }
  }
  if(e.key==='/'){
    const searchBox = document.getElementById('ticket-search-input') || document.getElementById('client-search-input') || document.getElementById('commissioner-search-input');
    if(searchBox){ e.preventDefault(); searchBox.focus(); }
  }
});

(async ()=>{
  const { data } = await supabaseClient.auth.getSession();
  SESSION = data.session;
  await loadState();
  render();
})();
