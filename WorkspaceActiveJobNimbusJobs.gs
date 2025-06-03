/**
 * Fetches jobs from JobNimbus API using PAGINATION,
 * TRIES TO FILTER SERVER-SIDE for record_type_name "ACTIVE JOBS",
 * extracts fields (incl. MAPPED 'Assigned To', Job ID in Col H),
 * calculates 'Days In Status', converts timestamps, ADDS 'Date Status Changed' (Col I)
 * and 'Date Updated' (Col J), and writes ALL fetched active jobs to "Active Jobs API".
 * Assumes constants JOB_API_ENDPOINT_BASE, API_PAGE_SIZE_JOBS, OWNER_ID_TO_NAME_MAP
 * are available globally from Constantes.gs.
 * DELETED_USER_IDS_SET from Constantes.gs is available but not used for filtering here.
 */

// --- Configuração ---
// REMOVIDO: const JOB_API_ENDPOINT_BASE = ...; (Agora em Constantes.gs)
// REMOVIDO: const API_PAGE_SIZE_JOBS = ...;    (Agora em Constantes.gs)
// MOVIDO PARA DENTRO DA FUNÇÃO: JOB_SHEET_NAME
// MOVIDO PARA DENTRO DA FUNÇÃO: TARGET_RECORD_TYPE_NAME

// --- ID to Name Mapping & Deleted Users ---
// *** OWNER_ID_TO_NAME_MAP e DELETED_USER_IDS_SET vêm de Constantes.gs ***
// ---------------------------------------


/**
 * Main function to fetch and process JobNimbus "ACTIVE JOBS" using server-side filter attempt.
 * Writes ALL fetched active jobs to the sheet. Includes Date Status Changed (I) and Date Updated (J).
 * Aligned with Constantes.gs usage.
 */
function fetchActiveJobNimbusJobs() {
  // *** CONSTANTES ESPECÍFICAS DESTA FUNÇÃO ***
  const JOB_SHEET_NAME = 'Active Jobs API';
  const TARGET_RECORD_TYPE_NAME = 'ACTIVE JOBS';
  // ------------------------------------------

  // Constantes globais como JOB_API_ENDPOINT_BASE, API_PAGE_SIZE_JOBS,
  // OWNER_ID_TO_NAME_MAP são usadas diretamente pois vêm de Constantes.gs

  const timezone = Session.getScriptTimeZone() || 'America/Sao_Paulo'; // Ou use DEFAULT_TIMEZONE de Constantes.gs se definir lá
  Logger.log(`Active Job Script (Server Filter for Type="${TARGET_RECORD_TYPE_NAME}") running on ${new Date().toLocaleString('pt-BR', { timeZone: timezone })}`);
  const API_KEY = PropertiesService.getScriptProperties().getProperty('JOBNIMBUS_API_KEY');

  if (!API_KEY) {
    const errorMessage = 'ERROR: JobNimbus API Key not found in Script Properties.';
    Logger.log(errorMessage); try { SpreadsheetApp.getUi().alert(errorMessage); } catch (e) {} return;
   }

  // Safety check para OWNER_ID_TO_NAME_MAP (que deve vir de Constantes.gs)
  if (typeof OWNER_ID_TO_NAME_MAP === 'undefined') {
      Logger.log(`ERROR: Global constant OWNER_ID_TO_NAME_MAP is not defined in Constantes.gs.`);
      // eslint-disable-next-line no-global-assign
      OWNER_ID_TO_NAME_MAP = {}; // Evita erros posteriores, mas indica problema
   }
   // DELETED_USER_IDS_SET check not needed as it's not used for filtering here

  const headers = { 'Authorization': 'Bearer ' + API_KEY, 'Accept': 'application/json' };
  const options = { 'method': 'GET', 'headers': headers, 'muteHttpExceptions': true };

  let allFetchedJobs = [];
  let currentOffset = 0;
  let hasMore = true;
  let pageCount = 0;
  const maxPages = 50; // Pode vir de Constantes.gs (MAX_API_PAGES) se definido lá

  // Usa a constante LOCAL TARGET_RECORD_TYPE_NAME
  Logger.log(`Workspaceing jobs via pagination using SERVER-SIDE filter for Type="${TARGET_RECORD_TYPE_NAME}".`);

  // --- Pagination Loop ---
  while (hasMore && pageCount < maxPages) {
    pageCount++;
    // Usa as constantes GLOBAIS JOB_API_ENDPOINT_BASE e API_PAGE_SIZE_JOBS de Constantes.gs
    let apiEndpoint = `${JOB_API_ENDPOINT_BASE}?size=${API_PAGE_SIZE_JOBS}&from=${currentOffset}`;

    // --- Adicionar filtro server-side para record_type_name ---
    try {
      // Usa a constante LOCAL TARGET_RECORD_TYPE_NAME
      const filterJson = {"must":[{"term":{"record_type_name": TARGET_RECORD_TYPE_NAME}}]};
      const encodedFilter = encodeURIComponent(JSON.stringify(filterJson));
      apiEndpoint += "&filter=" + encodedFilter;
      // Logger.log(`Using filter: ${JSON.stringify(filterJson)}`); // Descomente para debug do filtro
    } catch (filterError) {
        Logger.log(`Erro ao construir o filtro JSON para Jobs: ${filterError}`);
        throw new Error("Falha ao construir filtro JSON para API de Jobs.");
    }
    // --- Fim Adição Filtro ---

    Logger.log(`Workspaceing job page ${pageCount} from: ${apiEndpoint.substring(0, 150)}...`);
    let response, responseCode, responseBody;

    try {
      response = UrlFetchApp.fetch(apiEndpoint, options);
      responseCode = response.getResponseCode();
      responseBody = response.getContentText();

      if (responseCode === 200) {
        let pageResult = JSON.parse(responseBody);
        let jobsOnPage = pageResult?.results || (Array.isArray(pageResult) ? pageResult : []);

        if (jobsOnPage.length > 0) {
          // *** Adicionado: Verificar se o filtro server-side funcionou ***
          const filteredJobsOnPage = jobsOnPage.filter(job => job.record_type_name === TARGET_RECORD_TYPE_NAME);

          if (filteredJobsOnPage.length !== jobsOnPage.length) {
             Logger.log(`WARN: Server-side filter might not be fully effective for "ACTIVE JOBS". Received ${jobsOnPage.length}, kept ${filteredJobsOnPage.length} matching.`);
          }

          if(filteredJobsOnPage.length > 0){
             allFetchedJobs = allFetchedJobs.concat(filteredJobsOnPage);
             Logger.log(`Workspaceed and filtered ${filteredJobsOnPage.length} jobs on page ${pageCount}. Total fetched so far: ${allFetchedJobs.length}.`);
          } else {
             Logger.log(`No jobs matching "${TARGET_RECORD_TYPE_NAME}" found on page ${pageCount} after client-side check.`);
          }

          // A lógica de paginação continua baseada no *total* recebido
          currentOffset += jobsOnPage.length;

        } else {
          hasMore = false;
          Logger.log(`Stopping pagination: received 0 jobs on page ${pageCount}.`);
        }

        // Parar se a página veio vazia OU se veio menos que o solicitado
        // Usa a constante GLOBAL API_PAGE_SIZE_JOBS de Constantes.gs
        if (jobsOnPage.length < API_PAGE_SIZE_JOBS) {
          hasMore = false;
           if (jobsOnPage.length > 0) {
             Logger.log(`Stopping pagination: received ${jobsOnPage.length} jobs (less than size ${API_PAGE_SIZE_JOBS}). Final page.`);
          }
        }

      } else {
          Logger.log(`Job API Error on page ${pageCount}: ${responseCode}. Body: ${responseBody.substring(0, 1000)}`);
          try { SpreadsheetApp.getUi().alert(`JobNimbus Job API Error: ${responseCode} on page ${pageCount}. Check logs.`); } catch(e) {}
          hasMore = false; // Parar em caso de erro
      }
    } catch (error) {
        Logger.log(`JOB SCRIPT ERROR during fetch/parse page ${pageCount}: ${error}\nStack: ${error.stack}`);
        try { SpreadsheetApp.getUi().alert(`Job Script Error: ${error.message}. Check logs.`); } catch(e) {}
        hasMore = false; // Parar em caso de erro
    }

    if (hasMore) Utilities.sleep(500); // Pausa entre chamadas
  } // End While Loop

  if (pageCount >= maxPages && hasMore) {
       // Usa a constante LOCAL TARGET_RECORD_TYPE_NAME e GLOBAL API_PAGE_SIZE_JOBS
       Logger.log(`WARNING: Job pagination stopped after reaching max page limit (${maxPages}). Data might be incomplete IF total "${TARGET_RECORD_TYPE_NAME}" > ${maxPages * API_PAGE_SIZE_JOBS}.`);
       try { SpreadsheetApp.getUi().alert(`Job fetch stopped at max pages (${maxPages}). Data may be incomplete.`); } catch(e) {}
   }

  // Usa a constante LOCAL TARGET_RECORD_TYPE_NAME
  Logger.log(`Total "${TARGET_RECORD_TYPE_NAME}" jobs fetched after pagination and filtering: ${allFetchedJobs.length}. Now processing ALL of them for the sheet...`);

  // --- Process Fetched Jobs ---
  const headersRow = ['Date Created', 'Days In Status', 'Name', 'Type', 'Status', 'Sales Rep', 'Assigned To', 'Job ID', 'Date Status Changed', 'Date Updated'];
  const outputData = [headersRow];
  const nowMillis = new Date().getTime();

  if (allFetchedJobs.length > 0) {
    allFetchedJobs.forEach((job) => {
      // A verificação de tipo já foi feita no loop de fetch/filter
      if (typeof job === 'object' && job !== null) {
        try {
            // Extract existing data
            const recordTypeName = job.record_type_name || ''; // Deve ser "ACTIVE JOBS"
            let assignedToId = (job.owners && Array.isArray(job.owners) && job.owners.length > 0 && job.owners[0]?.id) ? job.owners[0].id : null;
            const createdTimestamp = job.date_created;
            const createdDate = (createdTimestamp && createdTimestamp > 0) ? new Date(createdTimestamp * 1000) : '';
            let daysInStatus = 'N/A';
            const statusChangeTimestamp = job.date_status_change;
            if (statusChangeTimestamp && statusChangeTimestamp > 0) {
               const statusChangeMillis = new Date(statusChangeTimestamp * 1000).getTime();
               if (!isNaN(statusChangeMillis) && nowMillis >= statusChangeMillis) {
                  const diffMillis = nowMillis - statusChangeMillis;
                  daysInStatus = Math.floor(diffMillis / (1000 * 60 * 60 * 24));
               }
            }
            const jobName = job.name || '';
            const jobType = recordTypeName;
            const status = job.status_name || '';
            const salesRep = job.sales_rep_name || '';
            // Usa a constante GLOBAL OWNER_ID_TO_NAME_MAP de Constantes.gs
            const assignedToName = (assignedToId && typeof OWNER_ID_TO_NAME_MAP !== 'undefined' && OWNER_ID_TO_NAME_MAP[assignedToId]) ? OWNER_ID_TO_NAME_MAP[assignedToId] : (assignedToId || '');
            const jobId = job.jnid || job.id || '';
            const updatedTimestamp = job.date_updated;
            const statusChangeDate = (statusChangeTimestamp && statusChangeTimestamp > 0) ? new Date(statusChangeTimestamp * 1000) : '';
            const updatedDate = (updatedTimestamp && updatedTimestamp > 0) ? new Date(updatedTimestamp * 1000) : '';

            outputData.push([
              createdDate,        // A
              daysInStatus,       // B
              jobName,            // C
              jobType,            // D
              status,             // E
              salesRep,           // F
              assignedToName,     // G
              jobId,              // H
              statusChangeDate,   // I
              updatedDate         // J
            ]);

          } catch (extractError) {
            Logger.log(`Error extracting data for job (JNID: ${job.jnid || job.id || 'N/A'}): ${extractError}`);
             outputData.push(Array(headersRow.length).fill(`EXTRACTION ERROR for Job ${job.jnid || job.id || 'N/A'}`));
          }
      } else {
          Logger.log(`WARNING: Skipping invalid job item during processing: ${JSON.stringify(job)}`);
       }
    });
  }

  // Usa as constantes LOCAIS TARGET_RECORD_TYPE_NAME e JOB_SHEET_NAME
  Logger.log(`Processing complete. ${outputData.length - 1} "${TARGET_RECORD_TYPE_NAME}" jobs prepared for the sheet "${JOB_SHEET_NAME}".`);
  // Chama a função para escrever na planilha (usando a constante LOCAL JOB_SHEET_NAME)
  writeDataToJobSheet(JOB_SHEET_NAME, outputData);
}


/**
 * Writes data to the "Active Jobs API" sheet, calling the generic function.
 * @param {string} sheetName The name of the target sheet (passed from the main function).
 * @param {Array<Array>} data The 2D array of data to write (including headers).
 */
function writeDataToJobSheet(sheetName, data) {
  // Define os cabeçalhos esperados para esta planilha específica.
  const headersRowForJob = ['Date Created', 'Days In Status', 'Name', 'Type', 'Status', 'Sales Rep', 'Assigned To', 'Job ID', 'Date Status Changed', 'Date Updated'];
  // Chama a função genérica, passando o nome da planilha recebido e os cabeçalhos específicos.
  writeDataToSheetGeneric(sheetName, data, headersRowForJob);
}

/**
 * Writes data to the specified Google Sheet, clearing previous content and applying formatting.
 * (Função Genérica)
 * @param {string} sheetName The name of the target sheet.
 * @param {Array<Array>} data The 2D array of data to write (including headers).
 * @param {Array} headersRowArray The array representing the header row, used for validation and column count.
 */
function writeDataToSheetGeneric(sheetName, data, headersRowArray) {
   // Esta função permanece igual à versão anterior.
   // Ela usa o 'sheetName' que foi passado como argumento
   // (que veio da constante local JOB_SHEET_NAME da função principal).

   if (!data || !Array.isArray(data)) { Logger.log(`ERROR: Invalid data provided for sheet "${sheetName}".`); return; }
   if (!headersRowArray || !Array.isArray(headersRowArray) || headersRowArray.length === 0) { Logger.log(`ERROR: Invalid headersRowArray provided for sheet "${sheetName}".`); return;}

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) { sheet = ss.insertSheet(sheetName); Logger.log(`Sheet "${sheetName}" created.`); }

    sheet.clearContents(); sheet.clearFormats(); Logger.log(`Sheet "${sheetName}" cleared.`);

    const hasHeaders = data.length >= 1 && data[0].length > 0;
    const hasDataRows = data.length > 1;

    if (data.length > 0) {
       const numColsToWrite = headersRowArray.length;
       const colsInData = data[0].length;

       if (colsInData !== numColsToWrite) {
          Logger.log(`ERROR: Data columns (${colsInData}) do not match header columns (${numColsToWrite}) for sheet "${sheetName}". Aborting write.`);
          try { SpreadsheetApp.getUi().alert(`Erro de Script: Número de colunas (${colsInData}) nos dados não corresponde aos cabeçalhos (${numColsToWrite}) para ${sheetName}. Verifique os logs e a função de extração.`); } catch(e) {}
          return;
       }

       sheet.getRange(1, 1, data.length, numColsToWrite).setValues(data);

      const dataRowsCount = data.length - 1;
      Logger.log(`${dataRowsCount >= 0 ? dataRowsCount : 0} data rows written to sheet: "${sheetName}"`);

      const toastMessage = hasDataRows ? `${dataRowsCount} items written.` : 'Headers written, no matching data found.';
      const toastTitle = hasDataRows ? 'Data Write Success!' : 'Data Write Info';
       try{ SpreadsheetApp.getActiveSpreadsheet().toast(toastMessage, toastTitle, 7); } catch(e){}

      sheet.autoResizeColumns(1, numColsToWrite);
      sheet.setFrozenRows(1);

      if (hasDataRows) {
         try {
            // A formatação ainda usa a constante JOB_SHEET_NAME definida localmente na função principal,
            // o que está correto para este caso.
            if (sheetName === 'Active Jobs API') { // Compara com o nome esperado para esta função
               sheet.getRange(2, 1, dataRowsCount, 1).setNumberFormat("dd/mm/yyyy hh:mm:ss"); // Col A
               sheet.getRange(2, 2, dataRowsCount, 1).setNumberFormat("0");                 // Col B
               sheet.getRange(2, 9, dataRowsCount, 1).setNumberFormat("dd/mm/yyyy hh:mm:ss"); // Col I
               sheet.getRange(2, 10, dataRowsCount, 1).setNumberFormat("dd/mm/yyyy hh:mm:ss");// Col J
            }
            // Você pode adicionar 'else if (sheetName === 'Membership Program API') { ... }' aqui
            // se quiser formatação diferente para a outra planilha, ou manter um fallback genérico.
             else {
               // Fallback genérico ou formatação para outras planilhas se necessário
               sheet.getRange(2, 1, dataRowsCount, 1).setNumberFormat("dd/mm/yyyy hh:mm:ss");
             }
          } catch (formatError) { Logger.log(`Could not apply column formatting to sheet "${sheetName}": ${formatError}`); }
       }
    } else {
      Logger.log(`No data (not even headers) provided to write to sheet "${sheetName}".`);
      try{ SpreadsheetApp.getActiveSpreadsheet().toast(`No data to write. Sheet "${sheetName}" is empty.`, 'Data Fetch', 5); } catch(e){}
    }
  } catch (e) {
    Logger.log(`ERROR writing to sheet "${sheetName}": ${e}\nStack: ${e.stack}`);
    try { SpreadsheetApp.getUi().alert(`Error writing data to sheet "${sheetName}": ${e.message}`); } catch (uiError) {}
  }
} // Fim da função writeDataToSheetGeneric
