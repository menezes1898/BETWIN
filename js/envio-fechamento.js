// ==================== ENVIO DOS FECHAMENTOS PELO WHATSAPP (fila) ====================
// O sistema gera o PDF + a mensagem de cada cliente e deixa na fila (tabela bot_outbox);
// o robô pega a fila e manda no grupo do cliente (o mesmo grupo vinculado em Clientes).
// A tela de uso fica em "Fechamentos" (js/pages/fechamentos.js).
async function enfileirarFechamento(cl, week){
  if(!cl.waGroupId) throw new Error('sem grupo vinculado');
  const r = await gerarFechamentoPDF(cl.id, {week, returnOnly:true});
  const {error} = await supabaseClient.from('bot_outbox').insert({client_id: cl.id, group_id: cl.waGroupId, week_start: week, filename: r.file, caption: r.texto, pdf_b64: r.base64, status:'pendente', created_by: String(currentUserId()||'')});
  if(error) throw new Error(error.message);
}
