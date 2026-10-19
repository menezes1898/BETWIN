// ======= CONFIGURAÇÃO DO SUPABASE =======
// Pegue esses dois valores em: Supabase > seu projeto > Settings > API
const SUPABASE_URL = 'https://tymcwpyypvzjdzumlfkp.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Tf4F0bAvZsHyevsy0JUa0g_q8G4_-dW';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
// ==========================================

let STATE = { clients: [], tickets: [], settlements: [], withdrawals: [], transactions: [], commissioners: [], commissionerClients: [], partners: [], partnerClients: [], accountMeetings: [], accountMeetingsOk: true, clientWeekDiscounts: [], clientWeekCommissioners: [], clientDiscountHistory: [], profiles: [], whatsappGroups: [], botValidators: [], botValidatorsOk: false };
let ADMIN_TAB = 'dashboard';
let ADMIN_SUBVIEW = 'list'; // 'list' | 'wizard'
let DASH_WEEK = null;
let FINANCE_WEEK = null;
let SHOW_LANCAMENTOS = false;
let SHOW_RELATORIO_PERIODO = false;
let FINANCE_TAB = 'caixa';
let SHOW_EXCLUIDAS = false;
let SHOW_DIAGNOSTICO_GERAL = false;
let REPORT_WEEK_START = null;
let REPORT_WEEK_END = null;
let SHOW_RETIRADAS = false;
let SHOW_COMISSOES = false;
let SHOW_BAIXAS_HISTORICO = false;
let DRAFT = null;
let EDITING_TICKET_ID = null;
let TEAM_RESULTS = {};
let SEARCH_TIMERS = {};
let SHOW_PENDENTES = false;
let TICKET_FILTER = 'todas';
let TICKET_SORT = 'recentes';
let TICKET_PAGE = 1;
let CLIENT_WEEK = null;
let COMMISSIONER_WEEK = null;
let CLIENT_DETAIL_ID = null;
let CLIENT_DETAIL_SUBVIEW = 'painel';
let CONFIRM_DELETE_CLIENT = false;
let COMMISSIONER_DETAIL_ID = null;
let CONFIRM_DELETE_COMMISSIONER = false;
let PARTNER_DETAIL_ID = null;
let PARTNER_WEEK = null;
let CONFIRM_DELETE_PARTNER = false;
let CLIENT_SHOW_PENDENTES = false;
let SESSION = null;
let CONFERENCIA_FILTER_USER = 'todos';
let CONFERENCIA_SHOW_ALL = false;
let CONFERENCIA_INCLUIR_ANTIGAS = false;
let CONFERENCIA_FILTER_CLIENT_ID = '';
let CONFERENCIA_FILTER_CLIENT_NAME = '';
let CONFERENCIA_DATE_FROM = '';
let CONFERENCIA_DATE_TO = '';
let COLLAPSED_TICKETS = new Set(); // bilhetes que o usuário fechou manualmente (por padrão, todos ficam abertos)

// ---- Destaques do Dia (envio de arte pro WhatsApp) ----
let DESTAQUE_IMAGE_DATAURL = null;
let DESTAQUE_IMAGE_NAME = '';
let DESTAQUE_CAPTION = '';
let DESTAQUE_SENT_IDS = new Set(); // grupos já marcados como "enviado" nessa sessão (checklist, não persistido)
let SHOW_DESTAQUE_PROMPT = false;

// Tipo de seleção de cada mercado (define as opções mostradas no cadastro):
// 1x2 (casa/empate/fora) · dc (dupla) · ml (2 times, empate anula) · yn (sim/não) · ou (over/under + linha)
// hcp (time + linha) · hcp3 (casa/empate/fora + linha) · htft (intervalo/final) · team (time) · score (placar)
// rbtts / rbttsg / rou / oubtts (combinados)
function _mkKind(n){
  if(/^(Cards|Corners|Goals) \d/.test(n)) return 'ou';
  if(/Resultado Final e Ambos Marcam X Gols/.test(n)) return 'rbttsg';
  if(/Resultado Final e Ambos Marcam/.test(n)) return 'rbtts';
  if(/Resultado Final e Total de Gols/.test(n)) return 'rou';
  if(/Total de Gols\/Para Ambos/.test(n)) return 'oubtts';
  if(/^(Ambos|Ambas) Marcam/.test(n)) return 'yn';
  if(/^Dupla/.test(n)) return 'dc';
  if(/^(Empate sem Aposta|Moneyline)/.test(n)) return 'ml';
  if(/^Intervalo \/ Final/.test(n)) return 'htft';
  if(/^(Para |Time Sem)/.test(n)) return 'team';
  if(/^(Placar Exato|Resultado Exato)/.test(n)) return 'score';
  if(/^Handicap/.test(n)) return /Cart|Escanteios|Asi[aá]tico|Pontos/.test(n) ? 'hcp' : 'hcp3';
  if(/^(Total de|Cart|Escanteios|Finaliza)/.test(n)) return 'ou';
  if(/^Resultado/.test(n)) return '1x2';
  return '';
}
const _MK_VISIBLE = [
  'Ambos Marcam','Ambos Marcam - 2o Tempo','Ambos Marcam - HT',
  'Cards 00:00 - 09:59','Cards 10:00 - 19:59','Cards 20:00 - 29:59','Cards 30:00 - 39:59','Cards 40:00 - 49:59','Cards 50:00 - 59:59','Cards 60:00 - 69:59','Cards 70:00 - 79:59',
  'Cartões - 1º Tempo','Cartões - 1º Tempo - Asiático','Cartões - 2º Tempo','Cartões - 2º Tempo - Asiático','Cartões - Partida','Cartões - Partida - Asiático',
  'Corners 00:00 - 09:59','Corners 10:00 - 19:59','Corners 20:00 - 29:59','Corners 30:00 - 39:59','Corners 40:00 - 49:59','Corners 50:00 - 59:59','Corners 60:00 - 69:59','Corners 70:00 - 79:59',
  'Dupla Possibilidade','Dupla Possibilidade - HT','Empate sem Aposta','Empate sem Aposta - HT',
  'Escanteios - 1º Tempo','Escanteios - 1º Tempo - Asiático','Escanteios - 2º Tempo','Escanteios - 2º Tempo - Asiático','Escanteios - Asiático - 2º Tempo','Escanteios - Partida','Escanteios - Partida - Asiático',
  'Finalizações - 1º Tempo - No Alvo','Finalizações - 1º Tempo - No Alvo + Fora','Finalizações - 2º Tempo - No Alvo','Finalizações - 2º Tempo - No Alvo + Fora','Finalizações - Partida - No Alvo','Finalizações - Partida - No Alvo + Fora',
  'Goals 00:00 - 09:59','Goals 10:00 - 19:59','Goals 20:00 - 29:59','Goals 30:00 - 39:59','Goals 40:00 - 49:59','Goals 50:00 - 59:59','Goals 60:00 - 69:59','Goals 70:00 - 79:59',
  'Handicap','Handicap - 2o Tempo','Handicap - Asiático','Handicap - Asiático - 2o Tempo','Handicap - Asiático - Ao Vivo','Handicap - Asiático - Ao Vivo - HT','Handicap - Asiático - HT',
  'Handicap - Cartões','Handicap - Cartões - Asiático','Handicap - Escanteios','Handicap - Escanteios - Asiático','Handicap - Escanteios - Asiático - HT','Handicap - Escanteios - HT','Handicap - HT','Handicap - Pontos',
  'Intervalo / Final do Jogo','Para Ganhar Ambas as Partes','Para Ganhar Uma das Partes','Para Marcar em Ambas as Partes','Placar Exato','Placar Exato - HT',
  'Resultado - 2o Tempo','Resultado Final','Resultado Final e Ambos Marcam','Resultado Final e Ambos Marcam X Gols','Resultado Final e Total de Gols','Resultado - HT','Resultado Intervalo',
  'Time Sem Sofrer Gol','Total de Gols','Total de Gols - 2o Tempo','Total de Gols - Asiático','Total de Gols - Asiático - HT','Total de Gols - HT','Total de Gols - HT - Asiático','Total de Gols/Para Ambos os Times Marcarem',
  'Moneyline','Total de Pontos'
];
// nomes antigos continuam válidos (apostas já lançadas e o robô de WhatsApp), mas não aparecem na lista de escolha
const _MK_LEGACY = [
  {v:'Resultado Final HT', l:'Resultado Final HT (1º Tempo)'},
  {v:'Dupla Chance', l:'Dupla Chance'},
  {v:'Handicap Asiatico', l:'Handicap Asiático'},
  {v:'Handicap Asiatico HT', l:'Handicap Asiático HT (1º Tempo)'},
  {v:'Total de Escanteios', l:'Total de Escanteios'},
  {v:'Total de Escanteios HT', l:'Total de Escanteios HT (1º Tempo)'},
  {v:'Total de Cartoes', l:'Total de Cartões'},
  {v:'Resultado Exato', l:'Resultado Exato'},
  {v:'Handicap de Pontos', l:'Handicap de Pontos'}
];
const MARKETS = [
  ..._MK_VISIBLE.map(n=>({v: n==='Ambos Marcam' ? 'Ambas Marcam' : n, l:n, k:_mkKind(n)})),
  ..._MK_LEGACY.map(m=>({...m, k:_mkKind(m.v), hidden:true})),
  {v:'Outro', l:'—', k:''},
];

