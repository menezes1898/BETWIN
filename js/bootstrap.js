window.addEventListener('hashchange', render);
supabaseClient.auth.onAuthStateChange((event, session)=>{ SESSION = session; });
(async ()=>{
  const { data } = await supabaseClient.auth.getSession();
  SESSION = data.session;
  await loadState();
  render();
})();
