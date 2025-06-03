// Arquivo: Constantes.gs
// Contém constantes e mapeamentos compartilhados entre os scripts do projeto.

// ========================================================================
// --- Endpoints de API e Configurações Comuns ---
// ========================================================================

// Endpoint base para a API de Jobs do JobNimbus
const JOB_API_ENDPOINT_BASE = 'https://app.jobnimbus.com/api1/jobs';

// Tamanho da página padrão para buscar Jobs (usado em paginação)
const API_PAGE_SIZE_JOBS = 1000;

// (Opcional) Limite máximo de páginas para evitar loops infinitos em buscas paginadas
// const MAX_API_PAGES = 50;


// ========================================================================
// --- Mapeamentos Específicos (Ex: JobNimbus) ---
// ========================================================================

// --- Mapeamento de ID de Proprietário (Owner ID) para Nome ---
// Usado para exibir nomes legíveis em vez de IDs alfanuméricos.
const OWNER_ID_TO_NAME_MAP = {
  // Mapeados Originalmente (e ainda válidos)
  "lm0oe5bffni4ed3iwa1eyj7": "Vanessa Alvarez",
  "m0gzijaeocmwd4gj3q2xgax": "Airah Salvador", // Presumindo que ainda é necessário para Tasks
  "ll6wguzzralhqyym3eoh46a": "Kim Maranan",
  "lcz5i49ik8yxm6eyr9rhtif": "Cathy Parada",    // Presumindo que ainda é necessário para Tasks
  "lyhsrz64yv13wn6jsne124i": "Cherilyn Brister",// Presumindo que ainda é necessário para Tasks
  "m0wnhctahjv88322d88nvzb": "Christine Cantu", // Presumindo que ainda é necessário para Tasks
  // "m7l1lzjal2151gt7u6pj4tr": "Stetson Clark", // ID antigo - REMOVIDO (ou comente se ainda aparecer em Tasks)
  "lb43e3gbt04d7xruuduvg0a": "Angie Baker",

  // --- Novos Mapeamentos Adicionados ---
  "lxtfkz2e27btl4fepp409m6": "Stetson Clark",     // Novo ID para Stetson
  "ld0in92vokafqsjnaqzrvo8": "Mike Burch",
  "ld0irj8tkyjjm6kt3ea4qrt": "Jose Santos",
  "ld0icq16ojklthhl5y1ywe9": "Tex Farrar",
  "lxag8av35opr88f8d8s77z4": "John Merrifield",
  "ld0isek959emmbrupe6vqno": "Zane McKell",
  "ld0igts3cwy0s5n6fl49q3j": "Dagan Bell",
  "ld0jb6jnu0cedxw8ntv8np": "Will Merrifield",
  "ld0io4iz73tac21f33q7n8c": "Bob Austin",
  "ld0imasoq3hnsbksr6kx08g": "Tim Flood",
  "ld0ibhl0kj3cchwl1axf2lo": "Darlene Roth",
  "ld0ip5gpecov25il4bzzlmv": "Robert Melton",
  "l9er2ee54n9rskerce0brvt": "Adam Ullrich",
  "ld0ig0zolw0a8lcntgrke83": "Guy Nickels" ,
  "lr6qt5unjomiw5x7g9d0xsf": "Adam Sadler" ,
  "m930qycy2paky93qrtgdg4": "Alvaro Lanuza",
  "m2kw9ftjeblvkmbepd7g3a4": "Michel Browder",
  "m88u9exc94gpd569kmt88fv": "Julio Orellana",
  "m88u81krph8ks412hm59c0e": "Mario Sagastume",
  "lr6qt5unjomiw5x7g9d0xsf": "Adam Sadler", // Duplicado? Verificar se necessário
  "ld0ig0zolw0a8lcntgrke83": "Guy Nickels", // Duplicado? Verificar se necessário
  "m8iubxj8aar6qb968y2b11": "David Davis",
  "m8iuh8nmw86eo6kwxy1bdo0": "David Taylor",

    // --- INÍCIO: Mapeamentos para Usuários Inativos ---
    // (Incluídos para referência, mesmo que filtrados depois)
  "lfcopx899im6rigzx1fq8tz": "Tyler Thomson (inactive)",
  "lfcor4zu7p35yz2saz4lbl8": "Mitch Deskis (inactive)",
  "lfcory72q36xfr5nk8ssf25": "Jesse Romero (inactive)", // ID lfcoszmtogl1zllpjf9bxh também é Jesse Romero, mapeado aqui.
  "lfcotvn7t8ecpjac6vad96": "Dallas Fisher (inactive)",
  "lfcouummy9jrw82tpmmo5ar": "Aide Corral (inactive)",
  "lplkhhhdrpxp8meeo5lna3r": "Garett Larson (inactive)",
  "lh9ot5c03gsf1f0d31mkdoz": "Tech Suli (inactive)",
  "lcz5gjx76im1iefij5g3woq": "Brittany Brown (inactive)",
  "ld2akhvugp6ecup7wz6znf2": "Devin Sierra (inactive)",
  // --- FIM: Mapeamentos para Usuários Inativos ---

  // Os IDs marcados como "Deleted user" não são incluídos aqui, pois temos DELETED_USER_IDS_SET
};

// --- IDs de Usuários Deletados/Ignorados ---
// Usado para filtrar resultados ou para referência.
// O script fetchActiveJobNimbusJobs original não usava isso para filtrar,
// mas pode ser útil para outros scripts ou futuras modificações.
const DELETED_USER_IDS_SET = new Set([
  // IDs de usuários inativos/deletados que devem ser completamente ignorados
  // (Se um ID estiver aqui E no MAP acima, este SET tem prioridade se usado para filtrar)
  "lplkhhhdrpxp8meeo5lna3r", // Garett Larson (inactive)
  "lh9ot5c03gsf1f0d31mkdoz", // Tech Suli (inactive)
  "lcz5gjx76im1iefij5g3woq", // Brittany Brown (inactive)
  "ld2akhvugp6ecup7wz6znf2", // Devin Sierra (inactive)
  "lfcopx899im6rigzx1fq8tz", // Tyler Thomson (inactive)
  "lfcoszmtogl1zllpjf9bxhl", // Jesse Romero (ID alternativo, se aplicável)
  "lfcor4zu7p35yz2saz4lbl8", // Mitch Deskis (inactive)
  "lfcory72q36xfr5nk8ssf25", // Jesse Romero (inactive)
  "lfcotvn7t8ecpjac6vad96", // Dallas Fisher (inactive)
  "lfcouummy9jrw82tpmmo5ar"  // Aide Corral (inactive)
]);


// ========================================================================
// --- Outras Constantes Globais ---
// ========================================================================

// (Mantenha ou adicione outras constantes globais aqui, se necessário)
// Exemplo: const COMPANY_CAM_API_TOKEN = PropertiesService.getScriptProperties().getProperty('COMPANY_CAM_API_TOKEN');
// Exemplo: const DEFAULT_TIMEZONE = 'America/Sao_Paulo';

// Fim do arquivo Constantes.gs
