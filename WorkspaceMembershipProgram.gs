// Arquivo: WorkspaceMembershipProgram.gs
// Busca dados específicos do "MEMBERSHIP PROGRAM" do JobNimbus, incluindo Description, Roof Install Date e detalhes de endereço/contato.
// Constantes comuns e mapeamentos são acessados de Constantes.gs.

/**
 * Função principal para buscar e processar jobs do tipo "MEMBERSHIP PROGRAM" do JobNimbus.
 * Tenta filtrar no servidor e verifica no cliente.
 * Inclui os campos 'Description', 'Roof Install Date:' e os novos campos de endereço/contato.
 * Escreve os resultados na planilha definida pela constante local JOB_SHEET_NAME.
 * Utiliza constantes globais (JOB_API_ENDPOINT_BASE, API_PAGE_SIZE_JOBS, OWNER_ID_TO_NAME_MAP) de Constantes.gs.
 */
function fetchMembershipProgramJobs() {
  // *** CONSTANTES ESPECÍFICAS DESTA FUNÇÃO ***
  const JOB_SHEET_NAME = 'Membership Program API';
  const TARGET_RECORD_TYPE_NAME = 'MEMBERSHIP PROGRAM';
  // *** MODIFICADO v1.2: Adicionados novos campos de endereço e contato ***
  const HEADERS_ROW_OUTPUT = [
      'Date Created',         // A
      'Days In Status',       // B
      'Name',                 // C
      'Type',                 // D
      'Status',               // E
      'Sales Rep',            // F
      'Assigned To',          // G
      'Job ID',               // H
      'Date Status Changed',  // I
      'Date Updated',         // J
      'Description',          // K
      'Roof Install Date',    // L
      'Address Line 1',     // M (NOVO)
      'Address Line 2',     // N (NOVO)
      'City',                 // O (NOVO)
      'Homeowner Email',      // P (NOVO)
      'Homeowner #',          // Q (NOVO)
      'Zip Code'              // R (NOVO)
  ];
  // ------------------------------------------

  // --- Setup Inicial e Verificações ---
  const timezone = Session.getScriptTimeZone() || 'America/Sao_Paulo';
  Logger.log(`Membership Program Script v1.2 (Filter: "${TARGET_RECORD_TYPE_NAME}", Incl Addr/Contact) running on ${new Date().toLocaleString('pt-BR', { timeZone: timezone })}`);
  const API_KEY = PropertiesService.getScriptProperties().getProperty('JOBNIMBUS_API_KEY');

  if (!API_KEY) {
    const errorMessage = 'ERROR: JobNimbus API Key not found in Script Properties.';
    Logger.log(errorMessage); try { SpreadsheetApp.getUi().alert(errorMessage); } catch (e) {} return;
   }

  // Verifica se as constantes globais essenciais estão definidas
  if (typeof JOB_API_ENDPOINT_BASE === 'undefined' || !JOB_API_ENDPOINT_BASE) {
      const errorMsg = 'ERROR: Global constant JOB_API_ENDPOINT_BASE is not defined or empty in Constantes.gs. Cannot fetch data.';
      Logger.log(errorMsg);
      try { SpreadsheetApp.getUi().alert('Erro de Configuração: Constante JOB_API_ENDPOINT_BASE não definida em Constantes.gs.'); } catch(e) {}
      return;
  }
  if (typeof API_PAGE_SIZE_JOBS === 'undefined' || !API_PAGE_SIZE_JOBS) {
      const errorMsg = 'ERROR: Global constant API_PAGE_SIZE_JOBS is not defined or empty in Constantes.gs. Cannot fetch data.';
      Logger.log(errorMsg);
      try { SpreadsheetApp.getUi().alert('Erro de Configuração: Constante API_PAGE_SIZE_JOBS não definida em Constantes.gs.'); } catch(e) {}
      return;
  }
   // Verifica OWNER_ID_TO_NAME_MAP, mas não impede a execução se ausente (apenas loga)
  let localOwnerMap = {}; // Usa um mapa local
  if (typeof OWNER_ID_TO_NAME_MAP !== 'undefined' && OWNER_ID_TO_NAME_MAP) {
      localOwnerMap = OWNER_ID_TO_NAME_MAP; // Atribui se definido
  } else {
      Logger.log(`WARN: Global constant OWNER_ID_TO_NAME_MAP is not defined or accessible from Constantes.gs. Assigned To names might show IDs.`);
      // Continua a execução, mas os nomes não serão mapeados
  }

  // --- Configuração da Requisição API ---
  const headers = { 'Authorization': 'Bearer ' + API_KEY, 'Accept': 'application/json' };
  const options = { 'method': 'GET', 'headers': headers, 'muteHttpExceptions': true };

  // --- Coleta de Dados Paginada ---
  let allFetchedJobs = [];
  let currentOffset = 0;
  let hasMore = true;
  let pageCount = 0;
  const maxPages = 50; // Limite de páginas para evitar loops infinitos

  Logger.log(`Fetching jobs via pagination using SERVER-SIDE filter for Type="${TARGET_RECORD_TYPE_NAME}".`);

  // --- Loop de Paginação ---
  while (hasMore && pageCount < maxPages) {
    pageCount++;
    let apiEndpoint = `${JOB_API_ENDPOINT_BASE}?size=${API_PAGE_SIZE_JOBS}&from=${currentOffset}`;

    try {
      const filterJson = {"must":[{"term":{"record_type_name": TARGET_RECORD_TYPE_NAME}}]};
      const encodedFilter = encodeURIComponent(JSON.stringify(filterJson));
      apiEndpoint += "&filter=" + encodedFilter;
    } catch (filterError) {
        Logger.log(`WARN: Erro ao construir o filtro JSON para Jobs: ${filterError}. Tentando buscar sem filtro de servidor.`);
    }

    Logger.log(`Fetching job page ${pageCount} from: ${apiEndpoint.substring(0, 150)}...`);
    let response, responseCode, responseBody;

    try {
      response = UrlFetchApp.fetch(apiEndpoint, options);
      responseCode = response.getResponseCode();
      responseBody = response.getContentText();

      if (responseCode === 200) {
        let pageResult = JSON.parse(responseBody);
        let jobsOnPage = pageResult?.results || (Array.isArray(pageResult) ? pageResult : []);

        if (jobsOnPage.length > 0) {
          const filteredJobsOnPage = jobsOnPage.filter(job => job && job.record_type_name === TARGET_RECORD_TYPE_NAME);

          if (filteredJobsOnPage.length !== jobsOnPage.length) {
             Logger.log(`WARN: Client-side filter check. Received ${jobsOnPage.length}, kept ${filteredJobsOnPage.length} matching "${TARGET_RECORD_TYPE_NAME}" on page ${pageCount}.`);
          }

          if(filteredJobsOnPage.length > 0){
             allFetchedJobs = allFetchedJobs.concat(filteredJobsOnPage);
             Logger.log(`Fetched and filtered ${filteredJobsOnPage.length} jobs on page ${pageCount}. Total collected so far: ${allFetchedJobs.length}.`);
          } else {
             Logger.log(`No jobs matching "${TARGET_RECORD_TYPE_NAME}" found on page ${pageCount} after client-side check.`);
          }
          currentOffset += jobsOnPage.length;
        } else {
          hasMore = false;
          Logger.log(`Stopping pagination: received 0 jobs on page ${pageCount}.`);
        }

        if (jobsOnPage.length < API_PAGE_SIZE_JOBS) {
          hasMore = false;
           if (jobsOnPage.length > 0) {
             Logger.log(`Stopping pagination: received ${jobsOnPage.length} jobs (less than page size ${API_PAGE_SIZE_JOBS}). Assumed final page.`);
          }
        }
      } else {
          Logger.log(`Job API Error on page ${pageCount}: ${responseCode}. Body: ${responseBody.substring(0, 1000)}`);
          try { SpreadsheetApp.getUi().alert(`JobNimbus Job API Error: ${responseCode} on page ${pageCount}. Check logs.`); } catch(e) {}
          hasMore = false;
      }
    } catch (error) {
        Logger.log(`JOB SCRIPT ERROR during fetch/parse page ${pageCount}: ${error}\nStack: ${error.stack}`);
        try { SpreadsheetApp.getUi().alert(`Job Script Error: ${error.message}. Check logs.`); } catch(e) {}
        hasMore = false;
    }

    if (hasMore) Utilities.sleep(500);
  } // --- Fim do Loop de Paginação ---

  if (pageCount >= maxPages && hasMore) {
       Logger.log(`WARNING: Job pagination stopped after reaching max page limit (${maxPages}). Data might be incomplete.`);
       try { SpreadsheetApp.getUi().alert(`Job fetch stopped at max pages (${maxPages}). Data may be incomplete.`); } catch(e) {}
   }

  Logger.log(`Total "${TARGET_RECORD_TYPE_NAME}" jobs collected: ${allFetchedJobs.length}. Now processing for the sheet...`);

  // --- Processamento dos Dados Coletados ---
  const outputData = [HEADERS_ROW_OUTPUT]; // Inicializa com a linha de cabeçalho atualizada
  const nowMillis = new Date().getTime();

  if (allFetchedJobs.length > 0) {
    allFetchedJobs.forEach((job) => {
      if (typeof job === 'object' && job !== null) {
        try {
            // Extração dos campos existentes
            const recordTypeName = job.record_type_name || '';
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
            const assignedToName = (assignedToId && localOwnerMap && localOwnerMap[assignedToId])
                                     ? localOwnerMap[assignedToId]
                                     : (assignedToId || '');
            const jobId = job.jnid || job.id || '';
            const updatedTimestamp = job.date_updated;
            const statusChangeDate = (statusChangeTimestamp && statusChangeTimestamp > 0) ? new Date(statusChangeTimestamp * 1000) : '';
            const updatedDate = (updatedTimestamp && updatedTimestamp > 0) ? new Date(updatedTimestamp * 1000) : '';
            const description = job.description || '';
            const roofInstallDateValue = job['Roof Install Date:'] || '';
            let roofInstallDate = '';
            if (roofInstallDateValue) {
                try {
                    if (typeof roofInstallDateValue === 'number') {
                        if (roofInstallDateValue > 1000000000) { // Provavelmente timestamp em segundos
                           roofInstallDate = new Date(roofInstallDateValue * 1000);
                        } else if (roofInstallDateValue > 1000000000000) { // Provavelmente timestamp em milissegundos
                           roofInstallDate = new Date(roofInstallDateValue);
                        } else {
                            roofInstallDate = roofInstallDateValue; // Mantém como está se for um número pequeno
                        }
                    } else if (typeof roofInstallDateValue === 'string') {
                       const parsedDate = new Date(roofInstallDateValue);
                       if (!isNaN(parsedDate.getTime())) {
                           roofInstallDate = parsedDate;
                       } else {
                           roofInstallDate = roofInstallDateValue; // Mantém como string se não for data válida
                       }
                    } else {
                        roofInstallDate = roofInstallDateValue; // Mantém outros tipos como estão
                    }
                    // Verifica se a conversão resultou em uma data inválida e reverte se necessário
                    if (!(roofInstallDate instanceof Date) || isNaN(roofInstallDate.getTime())) {
                        if (roofInstallDate !== roofInstallDateValue) { // Se houve tentativa de conversão que falhou
                           Logger.log(`WARN: Could not definitively parse Roof Install Date "${roofInstallDateValue}" for Job ID ${jobId}. Reverted to original value.`);
                           roofInstallDate = roofInstallDateValue; // Reverte para o valor original
                        }
                    }
                } catch(dateErr) {
                    Logger.log(`WARN: Error parsing Roof Install Date "${roofInstallDateValue}" for Job ID ${jobId}. Keeping original value. Error: ${dateErr}`);
                    roofInstallDate = roofInstallDateValue; // Mantém como string em caso de erro
                }
            }

            // *** MODIFICADO v1.2: Extração dos novos campos de endereço e contato ***
            const addressLine1 = job.address_line1 || job.street1 || job.street_address_1 || '';
            const addressLine2 = job.address_line2 || job.street2 || job.street_address_2 || '';
            const city = job.city || '';
            const zipCode = job.zip || job.postal_code || '';

            let homeownerEmail = '';
            if (job.primary_contact && job.primary_contact.email) {
                homeownerEmail = job.primary_contact.email;
            } else if (job.custom_fields) {
                if (Array.isArray(job.custom_fields)) {
                    const emailField = job.custom_fields.find(cf => cf.name === 'Homeowner Email');
                    if (emailField) homeownerEmail = emailField.value;
                } else if (typeof job.custom_fields === 'object' && job.custom_fields['Homeowner Email']) {
                     homeownerEmail = job.custom_fields['Homeowner Email'];
                }
            }
            if (!homeownerEmail && job.email) homeownerEmail = job.email;
            if (!homeownerEmail) homeownerEmail = job.homeowner_email || '';

            let homeownerPhone = '';
            if (job.primary_contact && (job.primary_contact.phone_number || job.primary_contact.phone)) {
                homeownerPhone = job.primary_contact.phone_number || job.primary_contact.phone;
            } else if (job.custom_fields) {
                 if (Array.isArray(job.custom_fields)) {
                    const phoneField = job.custom_fields.find(cf => cf.name === 'Homeowner #' || cf.name === 'Homeowner Phone');
                    if (phoneField) homeownerPhone = phoneField.value;
                } else if (typeof job.custom_fields === 'object' && (job.custom_fields['Homeowner #'] || job.custom_fields['Homeowner Phone'])) {
                     homeownerPhone = job.custom_fields['Homeowner #'] || job.custom_fields['Homeowner Phone'];
                }
            }
            if (!homeownerPhone && job.phone) homeownerPhone = job.phone;
            if (!homeownerPhone) homeownerPhone = job.homeowner_phone || '';
            // *** Fim da Modificação v1.2 ***

            // Adiciona a linha processada ao array outputData
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
              updatedDate,        // J
              description,        // K
              roofInstallDate,    // L
              addressLine1,       // M (NOVO)
              addressLine2,       // N (NOVO)
              city,               // O (NOVO)
              homeownerEmail,     // P (NOVO)
              homeownerPhone,     // Q (NOVO)
              zipCode             // R (NOVO)
            ]);

          } catch (extractError) {
            Logger.log(`Error extracting data for job (JNID: ${job?.jnid || job?.id || 'N/A'}): ${extractError}\nJob Data: ${JSON.stringify(job).substring(0,500)}`);
             const errorRow = Array(HEADERS_ROW_OUTPUT.length).fill('');
             errorRow[0] = `EXTRACTION ERROR`;
             errorRow[7] = `Job ID: ${job?.jnid || job?.id || 'N/A'}`;
             outputData.push(errorRow);
          }
      } else {
          Logger.log(`WARNING: Skipping invalid item during processing loop: ${JSON.stringify(job)}`);
       }
    }); // --- Fim do loop forEach ---
  } // Fim if (allFetchedJobs.length > 0)

  // --- Escrita na Planilha ---
  Logger.log(`Processing complete. ${outputData.length - 1} "${TARGET_RECORD_TYPE_NAME}" jobs prepared for the sheet "${JOB_SHEET_NAME}".`);
  writeDataToMembershipSheet(JOB_SHEET_NAME, outputData);

} // --- Fim da função fetchMembershipProgramJobs ---


/**
 * Função wrapper específica para escrever na planilha "Membership Program API".
 * Chama a função genérica de escrita.
 * @param {string} sheetName O nome da planilha (vindo da constante local JOB_SHEET_NAME).
 * @param {Array<Array>} data O array 2D com os dados (incluindo cabeçalho).
 */
function writeDataToMembershipSheet(sheetName, data) {
  // *** MODIFICADO v1.2: Atualiza a lista de cabeçalhos esperados ***
  const headersRowForMembership = [
      'Date Created', 'Days In Status', 'Name', 'Type', 'Status', 'Sales Rep',
      'Assigned To', 'Job ID', 'Date Status Changed', 'Date Updated',
      'Description', 'Roof Install Date',
      'Address Line 1', 'Address Line 2', 'City', 'Homeowner Email', 'Homeowner #', 'Zip Code' // NOVOS CABEÇALHOS
  ];
  // Chama a função genérica, passando o nome da planilha e os cabeçalhos específicos.
  writeDataToSheetGeneric(sheetName, data, headersRowForMembership);
}


/**
 * Writes data to the specified Google Sheet, clearing previous content and applying formatting.
 * (Função Genérica - Permanece a mesma, pois é chamada por wrappers específicos)
 * @param {string} sheetName The name of the target sheet.
 * @param {Array<Array>} data The 2D array of data to write (including headers).
 * @param {Array} headersRowArray The array representing the header row, used for validation and column count.
 */
function writeDataToSheetGeneric(sheetName, data, headersRowArray) {
   if (!data || !Array.isArray(data)) {
       Logger.log(`ERROR: Invalid data provided for sheet "${sheetName}". Aborting write.`);
       SpreadsheetApp.getActiveSpreadsheet().toast(`Erro: Dados inválidos para ${sheetName}.`, 'Falha na Escrita', 5);
       return;
   }
   if (!headersRowArray || !Array.isArray(headersRowArray) || headersRowArray.length === 0) {
       Logger.log(`ERROR: Invalid headersRowArray provided for sheet "${sheetName}". Aborting write.`);
       SpreadsheetApp.getActiveSpreadsheet().toast(`Erro: Cabeçalhos inválidos para ${sheetName}.`, 'Falha na Escrita', 5);
       return;
   }

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
       sheet = ss.insertSheet(sheetName);
       Logger.log(`Sheet "${sheetName}" created.`);
    }

    sheet.clearContents();
    sheet.clearFormats();
    Logger.log(`Sheet "${sheetName}" cleared.`);

    if (data.length > 0) {
       const numColsToWrite = headersRowArray.length;
       const numRowsToWrite = data.length;
       const colsInDataHeader = data[0].length;

       if (colsInDataHeader !== numColsToWrite) {
          const errorMsg = `ERROR: Data header columns (${colsInDataHeader}) do not match expected header columns (${numColsToWrite}) for sheet "${sheetName}". Aborting write.`;
          Logger.log(errorMsg);
          try { SpreadsheetApp.getUi().alert(`Erro de Script: Número de colunas nos dados (${colsInDataHeader}) não corresponde aos cabeçalhos esperados (${numColsToWrite}) para ${sheetName}.`); } catch(e) {}
          return;
       }

       sheet.getRange(1, 1, numRowsToWrite, numColsToWrite).setValues(data);

       const dataRowsCount = numRowsToWrite - 1;
       Logger.log(`${dataRowsCount >= 0 ? dataRowsCount : 0} data rows written to sheet: "${sheetName}"`);

       const toastMessage = dataRowsCount > 0 ? `${dataRowsCount} itens escritos.` : (numRowsToWrite === 1 ? 'Cabeçalhos escritos, nenhum dado encontrado.' : 'Nenhum dado para escrever.');
       const toastTitle = dataRowsCount > 0 ? 'Sucesso!' : 'Informação';
       try { SpreadsheetApp.getActiveSpreadsheet().toast(toastMessage, toastTitle, 7); } catch(e){ Logger.log("Could not display Toast notification."); }

       sheet.autoResizeColumns(1, numColsToWrite);
       sheet.setFrozenRows(1);

       if (dataRowsCount > 0) {
         try {
            const dataRange = sheet.getRange(2, 1, dataRowsCount, numColsToWrite);

            // Formatação das colunas existentes
            dataRange.offset(0, 0, dataRowsCount, 1).setNumberFormat("dd/mm/yyyy hh:mm:ss"); // Col A (Date Created)
            dataRange.offset(0, 1, dataRowsCount, 1).setNumberFormat("0");                 // Col B (Days In Status)
            dataRange.offset(0, 8, dataRowsCount, 1).setNumberFormat("dd/mm/yyyy hh:mm:ss"); // Col I (Date Status Changed)
            dataRange.offset(0, 9, dataRowsCount, 1).setNumberFormat("dd/mm/yyyy hh:mm:ss");// Col J (Date Updated)
            dataRange.offset(0, 11, dataRowsCount, 1).setNumberFormat("dd/mm/yyyy hh:mm:ss"); // Col L (Roof Install Date)

            // As novas colunas (M-R) são principalmente texto.
            // Se 'Zip Code' (Coluna R, índice 18) precisar ser tratado como texto para preservar zeros à esquerda:
            // dataRange.offset(0, 17, dataRowsCount, 1).setNumberFormat("@"); // Formato de texto

         } catch (formatError) {
            Logger.log(`WARN: Could not apply all column formatting to sheet "${sheetName}": ${formatError}`);
          }
       }
    } else {
      Logger.log(`No data (not even headers) provided to write to sheet "${sheetName}". Sheet remains empty.`);
      try{ SpreadsheetApp.getActiveSpreadsheet().toast(`Nenhum dado para escrever. Planilha "${sheetName}" está vazia.`, 'Info Escrita', 5); } catch(e){}
    }
  } catch (e) {
    Logger.log(`ERROR writing to sheet "${sheetName}": ${e}\nStack: ${e.stack}`);
    try { SpreadsheetApp.getUi().alert(`Erro ao escrever dados na planilha "${sheetName}": ${e.message}. Verifique os logs.`); } catch (uiError) {}
  }
} // --- Fim da função writeDataToSheetGeneric ---
