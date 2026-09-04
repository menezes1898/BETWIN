// ======= CONFIGURAÇÃO DO SUPABASE =======
// Pegue esses dois valores em: Supabase > seu projeto > Settings > API
const SUPABASE_URL = 'https://tymcwpyypvzjdzumlfkp.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Tf4F0bAvZsHyevsy0JUa0g_q8G4_-dW';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
// ==========================================

let STATE = { clients: [], tickets: [], settlements: [], withdrawals: [], transactions: [], commissioners: [], commissionerClients: [], clientWeekDiscounts: [], clientWeekCommissioners: [], clientDiscountHistory: [] };
let ADMIN_TAB = 'dashboard';
let ADMIN_SUBVIEW = 'list'; // 'list' | 'wizard'
let DASH_WEEK = null;
let FINANCE_WEEK = null;
let SHOW_LANCAMENTOS = false;
let SHOW_RETIRADAS = false;
let SHOW_COMISSOES = false;
let SHOW_BAIXAS_HISTORICO = false;
let DRAFT = null;
let EDITING_TICKET_ID = null;
let TEAM_RESULTS = {};
let SEARCH_TIMERS = {};
let SHOW_PENDENTES = false;
let CLIENT_WEEK = null;
let COMMISSIONER_WEEK = null;
let CLIENT_DETAIL_ID = null;
let CLIENT_DETAIL_SUBVIEW = 'info';
let CONFIRM_DELETE_CLIENT = false;
let COMMISSIONER_DETAIL_ID = null;
let CONFIRM_DELETE_COMMISSIONER = false;
let CLIENT_SHOW_PENDENTES = false;
let SESSION = null;

const MARKETS = [
  {v:'Resultado Final', l:'Resultado Final (1X2)'},
  {v:'Resultado Final HT', l:'Resultado Final HT (1º Tempo)'},
  {v:'Dupla Chance', l:'Dupla Chance'},
  {v:'Ambas Marcam', l:'Ambas Marcam'},
  {v:'Total de Gols', l:'Total de Gols (Over/Under)'},
  {v:'Handicap Asiatico', l:'Handicap Asiático'},
  {v:'Handicap Asiatico HT', l:'Handicap Asiático HT (1º Tempo)'},
  {v:'Total de Escanteios', l:'Total de Escanteios'},
  {v:'Total de Escanteios HT', l:'Total de Escanteios HT (1º Tempo)'},
  {v:'Total de Cartoes', l:'Total de Cartões'},
  {v:'Resultado Exato', l:'Resultado Exato'},
  {v:'Outro', l:'—'},
];

