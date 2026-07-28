(function () {
  const app = document.getElementById('app');
  let token = localStorage.getItem('adminToken') || '';
  let currentTab = 'tests';

  const BASE_URL = window.location.origin;

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  async function apiFetch(url, options = {}) {
    options.headers = options.headers || {};
    options.headers['Authorization'] = 'Bearer ' + token;
    if (options.body && !(options.body instanceof FormData)) {
      options.headers['Content-Type'] = 'application/json';
    }
    const res = await fetch(url, options);
    if (res.status === 401) {
      localStorage.removeItem('adminToken');
      token = '';
      renderLogin('Sessione scaduta, effettua di nuovo il login.');
      throw new Error('unauthorized');
    }
    return res;
  }

  // ================= LOGIN =================
  function renderLogin(errorMsg) {
    app.innerHTML = `
      <div class="card" style="max-width:400px;margin:40px auto;">
        <h2>Accesso Organizzatore</h2>
        <label>Password</label>
        <input type="password" id="login-password" placeholder="Password" />
        <div class="error-msg">${errorMsg ? escapeHtml(errorMsg) : ''}</div>
        <button id="login-btn">Accedi</button>
      </div>
    `;
    document.getElementById('login-btn').addEventListener('click', doLogin);
    document.getElementById('login-password').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') doLogin();
    });
  }

  async function doLogin() {
    const password = document.getElementById('login-password').value;
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    const data = await res.json();
    if (!res.ok) {
      renderLogin(data.error || 'Errore di accesso');
      return;
    }
    token = data.token;
    localStorage.setItem('adminToken', token);
    renderDashboard();
  }

  // ================= DASHBOARD =================
  async function renderDashboard() {
    app.innerHTML = `
      <div class="btn-row" style="justify-content: space-between; margin-bottom: 16px;">
        <div class="tabs">
          <button class="tab-btn ${currentTab === 'tests' ? 'active' : ''}" id="tab-tests">Test</button>
          <button class="tab-btn ${currentTab === 'surveys' ? 'active' : ''}" id="tab-surveys">Sondaggi</button>
        </div>
        <button class="secondary" id="logout-btn">Esci</button>
      </div>
      <div id="tab-content"></div>
    `;
    document.getElementById('tab-tests').addEventListener('click', () => { currentTab = 'tests'; renderDashboard(); });
    document.getElementById('tab-surveys').addEventListener('click', () => { currentTab = 'surveys'; renderDashboard(); });
    document.getElementById('logout-btn').addEventListener('click', () => {
      localStorage.removeItem('adminToken');
      token = '';
      renderLogin();
    });

    if (currentTab === 'tests') {
      await renderTestsList();
    } else {
      await renderSurveysList();
    }
  }

  // ================= LISTA TEST =================
  async function renderTestsList() {
    const content = document.getElementById('tab-content');
    content.innerHTML = '<p class="muted">Caricamento...</p>';
    let tests;
    try {
      const res = await apiFetch('/api/tests');
      tests = await res.json();
    } catch (e) { return; }

    content.innerHTML = `
      <div class="card">
        <div class="btn-row" style="justify-content: space-between;">
          <h2 style="margin:0;">I tuoi test</h2>
          <div class="btn-row">
            <label class="btn secondary" style="margin:0;">Importa JSON<input type="file" id="import-test-file" accept=".json" style="display:none;"></label>
            <button id="new-test-btn">+ Nuovo test</button>
          </div>
        </div>
        ${tests.length === 0 ? '<p class="muted">Nessun test creato ancora.</p>' : ''}
        ${tests.map((t) => `
          <div class="list-item">
            <div>
              <strong>${escapeHtml(t.title)}</strong>
              <span class="tag ${t.status === 'open' ? 'open' : 'closed'}">${t.status === 'open' ? 'Aperto' : 'Chiuso'}</span>
              <div class="muted">${t.numQuestions} domande &middot; ${t.submissionsCount} risposte ricevute &middot; soglia superamento ${t.passThreshold}%</div>
            </div>
            <div class="btn-row">
              <button class="secondary" data-action="view" data-id="${t.id}">Gestisci</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    document.getElementById('new-test-btn').addEventListener('click', renderTestBuilder);
    document.getElementById('import-test-file').addEventListener('change', importTestFile);
    content.querySelectorAll('[data-action="view"]').forEach((btn) => {
      btn.addEventListener('click', () => renderTestDetail(btn.getAttribute('data-id')));
    });
  }

  async function importTestFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const res = await apiFetch('/api/tests', { method: 'POST', body: JSON.stringify(json) });
      const data = await res.json();
      if (!res.ok) { alert('Errore import: ' + (data.error || '')); return; }
      renderTestsList();
    } catch (err) {
      alert('File JSON non valido: ' + err.message);
    }
  }

  // ================= BUILDER TEST =================
  let questionCounter = 0;

  function renderTestBuilder() {
    questionCounter = 0;
    const content = document.getElementById('tab-content');
    content.innerHTML = `
      <div class="card">
        <h2>Nuovo test</h2>
        <label>Titolo del test</label>
        <input type="text" id="test-title" placeholder="Es. Formazione lavoratori - Test finale" />
        <label>Soglia di superamento (%)</label>
        <input type="text" id="test-threshold" value="60" />
        <div id="questions-container"></div>
        <div class="btn-row">
          <button class="secondary" id="add-q-10">+ Aggiungi 10 domande vuote</button>
          <button class="secondary" id="add-q-1">+ Aggiungi 1 domanda</button>
        </div>
        <div id="builder-error" class="error-msg"></div>
        <div class="btn-row">
          <button id="save-test-btn">Salva test</button>
          <button class="secondary" id="cancel-test-btn">Annulla</button>
        </div>
      </div>
    `;
    document.getElementById('add-q-1').addEventListener('click', () => addQuestionBlock('test'));
    document.getElementById('add-q-10').addEventListener('click', () => { for (let i = 0; i < 10; i++) addQuestionBlock('test'); });
    document.getElementById('save-test-btn').addEventListener('click', saveTest);
    document.getElementById('cancel-test-btn').addEventListener('click', renderTestsList);
    addQuestionBlock('test');
  }

  function addQuestionBlock(kind) {
    questionCounter += 1;
    const qId = 'q' + questionCounter;
    const container = document.getElementById('questions-container');
    const div = document.createElement('div');
    div.className = 'card';
    div.style.background = '#fafcfb';
    div.id = qId;
    div.innerHTML = `
      <div class="btn-row" style="justify-content:space-between;">
        <label style="margin:0;">Domanda</label>
        <button class="secondary" data-remove="${qId}" style="padding:4px 10px;">Rimuovi</button>
      </div>
      <input type="text" class="q-text" placeholder="Testo della domanda" />
      <div class="options-list"></div>
      <button class="secondary add-option" style="padding:6px 12px; font-size:0.85rem;">+ Aggiungi opzione</button>
    `;
    container.appendChild(div);
    div.querySelector(`[data-remove="${qId}"]`).addEventListener('click', () => div.remove());
    const optionsList = div.querySelector('.options-list');
    div.querySelector('.add-option').addEventListener('click', () => addOptionRow(optionsList, qId, kind));
    // opzioni di default
    addOptionRow(optionsList, qId, kind);
    addOptionRow(optionsList, qId, kind);
  }

  function addOptionRow(optionsList, qId, kind) {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = '8px';
    row.style.marginBottom = '6px';
    row.innerHTML = kind === 'test'
      ? `<input type="radio" name="correct_${qId}" class="opt-correct" />
         <input type="text" class="opt-text" placeholder="Testo opzione" style="margin:0;" />
         <button class="secondary remove-opt" style="padding:4px 8px;">✕</button>`
      : `<input type="text" class="opt-text" placeholder="Testo opzione" style="margin:0;" />
         <button class="secondary remove-opt" style="padding:4px 8px;">✕</button>`;
    optionsList.appendChild(row);
    row.querySelector('.remove-opt').addEventListener('click', () => row.remove());
  }

  function collectQuestions(kind) {
    const blocks = document.querySelectorAll('#questions-container > .card');
    const questions = [];
    for (const block of blocks) {
      const text = block.querySelector('.q-text').value.trim();
      if (!text) continue;
      const optionRows = block.querySelectorAll('.options-list > div');
      const options = [];
      let correctIndex = -1;
      let idx = 0;
      optionRows.forEach((row) => {
        const optText = row.querySelector('.opt-text').value.trim();
        if (!optText) return;
        options.push(optText);
        if (kind === 'test') {
          const radio = row.querySelector('.opt-correct');
          if (radio && radio.checked) correctIndex = idx;
        }
        idx += 1;
      });
      const q = { text, options };
      if (kind === 'test') q.correctIndex = correctIndex;
      questions.push(q);
    }
    return questions;
  }

  async function saveTest() {
    const title = document.getElementById('test-title').value.trim();
    const passThreshold = parseInt(document.getElementById('test-threshold').value, 10) || 60;
    const errorEl = document.getElementById('builder-error');
    if (!title) { errorEl.textContent = 'Inserisci un titolo per il test.'; return; }
    const questions = collectQuestions('test');
    if (questions.length === 0) { errorEl.textContent = 'Aggiungi almeno una domanda con opzioni.'; return; }
    for (const q of questions) {
      if (q.options.length < 2) { errorEl.textContent = `La domanda "${q.text}" ha meno di 2 opzioni.`; return; }
      if (q.correctIndex < 0) { errorEl.textContent = `Seleziona la risposta corretta per la domanda "${q.text}".`; return; }
    }
    errorEl.textContent = '';
    const res = await apiFetch('/api/tests', { method: 'POST', body: JSON.stringify({ title, passThreshold, questions }) });
    const data = await res.json();
    if (!res.ok) { errorEl.textContent = data.error || 'Errore nel salvataggio'; return; }
    renderTestsList();
  }

  // ================= DETTAGLIO / RISULTATI TEST =================
  async function renderTestDetail(testId) {
    const content = document.getElementById('tab-content');
    content.innerHTML = '<p class="muted">Caricamento...</p>';
    const [testRes, resultsRes] = await Promise.all([
      apiFetch(`/api/tests/${testId}`),
      apiFetch(`/api/tests/${testId}/results`)
    ]);
    const test = await testRes.json();
    const resultsData = await resultsRes.json();
    const link = `${BASE_URL}/test/${testId}`;
    const subs = resultsData.submissions || [];
    const passedCount = subs.filter((s) => s.passed).length;

    content.innerHTML = `
      <div class="card">
        <div class="btn-row" style="justify-content:space-between;">
          <h2 style="margin:0;">${escapeHtml(test.title)}</h2>
          <span class="tag ${test.status === 'open' ? 'open' : 'closed'}">${test.status === 'open' ? 'Aperto' : 'Chiuso'}</span>
        </div>
        <p class="muted">${test.questions.length} domande &middot; soglia superamento ${test.passThreshold}%</p>
        <label>Link da condividere con i partecipanti</label>
        <div class="link-box">
          <input type="text" readonly value="${link}" id="test-link-input" />
          <button class="secondary" id="copy-link-btn" style="padding:6px 10px;">Copia</button>
        </div>
        <div class="btn-row">
          <button class="secondary" id="toggle-status-btn">${test.status === 'open' ? 'Chiudi test' : 'Riapri test'}</button>
          <a class="btn secondary" href="/api/tests/${testId}/pdf" target="_blank">Scarica versione PDF (per chi non ha accesso online)</a>
          <a class="btn secondary" href="/api/tests/${testId}/results.csv?token=${token}" target="_blank" id="csv-link">Scarica report CSV</a>
          <button class="danger" id="delete-test-btn">Elimina test</button>
          <button class="secondary" id="back-btn">Torna alla lista</button>
        </div>
      </div>

      <div class="card">
        <h3>Inserisci risposte compilate su carta</h3>
        <p class="muted">Se qualcuno ha compilato il test dal PDF stampato, inserisci qui le sue risposte per includerlo nel report.</p>
        <button class="secondary" id="manual-entry-toggle">+ Inserisci risposte manuali</button>
        <div id="manual-entry-form" style="display:none; margin-top:14px;"></div>
      </div>

      <div class="card">
        <h3>Risultati (${subs.length} partecipanti, ${passedCount} superato/i)</h3>
        ${subs.length === 0 ? '<p class="muted">Nessuna risposta ricevuta finora.</p>' : `
        <table>
          <thead><tr><th>Nome</th><th>Cognome</th><th>Corrette</th><th>%</th><th>Esito</th><th>Data</th></tr></thead>
          <tbody>
            ${subs.map((s) => `
              <tr>
                <td>${escapeHtml(s.nome)}</td>
                <td>${escapeHtml(s.cognome)}</td>
                <td>${s.correctCount}/${s.total}</td>
                <td>${s.percentage}%</td>
                <td>${s.passed ? '✅' : '❌'}</td>
                <td>${new Date(s.submittedAt).toLocaleString('it-IT')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        `}
      </div>
    `;

    document.getElementById('back-btn').addEventListener('click', renderTestsList);
    document.getElementById('copy-link-btn').addEventListener('click', () => copyToClipboard(link));
    document.getElementById('toggle-status-btn').addEventListener('click', async () => {
      const newStatus = test.status === 'open' ? 'closed' : 'open';
      await apiFetch(`/api/tests/${testId}`, { method: 'PATCH', body: JSON.stringify({ status: newStatus }) });
      renderTestDetail(testId);
    });
    document.getElementById('delete-test-btn').addEventListener('click', async () => {
      if (!confirm('Sei sicuro di voler eliminare questo test e tutti i suoi risultati?')) return;
      await apiFetch(`/api/tests/${testId}`, { method: 'DELETE' });
      renderTestsList();
    });
    document.getElementById('manual-entry-toggle').addEventListener('click', () => {
      renderManualEntryForm(test, testId);
    });
  }

  function renderManualEntryForm(test, testId) {
    const formDiv = document.getElementById('manual-entry-form');
    formDiv.style.display = 'block';
    formDiv.innerHTML = `
      <label>Nome</label>
      <input type="text" id="manual-nome" placeholder="Nome" />
      <label>Cognome</label>
      <input type="text" id="manual-cognome" placeholder="Cognome" />
      ${test.questions.map((q, idx) => `
        <div class="question-block">
          <div class="question-title">${idx + 1}. ${escapeHtml(q.text)}</div>
          ${q.options.map((o, i) => `
            <label class="option-row" data-qid="${q.id}" data-oid="${o.id}">
              <input type="radio" name="manual_q_${q.id}" value="${o.id}" />
              <span>${String.fromCharCode(65 + i)}) ${escapeHtml(o.text)}</span>
            </label>
          `).join('')}
        </div>
      `).join('')}
      <div id="manual-entry-error" class="error-msg"></div>
      <div class="btn-row">
        <button id="manual-save-btn">Salva risposte</button>
        <button class="secondary" id="manual-cancel-btn">Annulla</button>
      </div>
    `;

    const manualAnswers = {};
    formDiv.querySelectorAll('.option-row').forEach((row) => {
      row.addEventListener('click', () => {
        const qid = row.getAttribute('data-qid');
        const oid = row.getAttribute('data-oid');
        manualAnswers[qid] = oid;
        row.querySelector('input').checked = true;
        formDiv.querySelectorAll(`.option-row[data-qid="${qid}"]`).forEach((r) => r.classList.remove('selected'));
        row.classList.add('selected');
      });
    });

    document.getElementById('manual-cancel-btn').addEventListener('click', () => {
      formDiv.style.display = 'none';
      formDiv.innerHTML = '';
    });

    document.getElementById('manual-save-btn').addEventListener('click', async () => {
      const nome = document.getElementById('manual-nome').value.trim();
      const cognome = document.getElementById('manual-cognome').value.trim();
      const errorEl = document.getElementById('manual-entry-error');
      if (!nome || !cognome) { errorEl.textContent = 'Inserisci nome e cognome.'; return; }
      const res = await apiFetch(`/api/tests/${testId}/manual-submit`, {
        method: 'POST',
        body: JSON.stringify({ nome, cognome, answers: manualAnswers })
      });
      const data = await res.json();
      if (!res.ok) { errorEl.textContent = data.error || 'Errore nel salvataggio'; return; }
      renderTestDetail(testId);
    });
  }

  // Nota: il download CSV richiede autenticazione; per semplicità il token viene passato come query string.
  // Middleware aggiornato lato server per accettare anche ?token= sulle rotte CSV.

  // ================= LISTA SONDAGGI =================
  async function renderSurveysList() {
    const content = document.getElementById('tab-content');
    content.innerHTML = '<p class="muted">Caricamento...</p>';
    let surveys;
    try {
      const res = await apiFetch('/api/surveys');
      surveys = await res.json();
    } catch (e) { return; }

    content.innerHTML = `
      <div class="card">
        <div class="btn-row" style="justify-content: space-between;">
          <h2 style="margin:0;">I tuoi sondaggi</h2>
          <div class="btn-row">
            <label class="btn secondary" style="margin:0;">Importa JSON<input type="file" id="import-survey-file" accept=".json" style="display:none;"></label>
            <button id="new-survey-btn">+ Nuovo sondaggio</button>
          </div>
        </div>
        ${surveys.length === 0 ? '<p class="muted">Nessun sondaggio creato ancora.</p>' : ''}
        ${surveys.map((s) => `
          <div class="list-item">
            <div>
              <strong>${escapeHtml(s.title)}</strong>
              <span class="tag ${s.status === 'open' ? 'open' : 'closed'}">${s.status === 'open' ? 'Aperto' : 'Chiuso'}</span>
              <div class="muted">${s.numQuestions} domande &middot; ${s.submissionsCount} risposte ricevute</div>
            </div>
            <div class="btn-row">
              <button class="secondary" data-action="view" data-id="${s.id}">Gestisci</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    document.getElementById('new-survey-btn').addEventListener('click', renderSurveyBuilder);
    document.getElementById('import-survey-file').addEventListener('change', importSurveyFile);
    content.querySelectorAll('[data-action="view"]').forEach((btn) => {
      btn.addEventListener('click', () => renderSurveyDetail(btn.getAttribute('data-id')));
    });
  }

  async function importSurveyFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const res = await apiFetch('/api/surveys', { method: 'POST', body: JSON.stringify(json) });
      const data = await res.json();
      if (!res.ok) { alert('Errore import: ' + (data.error || '')); return; }
      renderSurveysList();
    } catch (err) {
      alert('File JSON non valido: ' + err.message);
    }
  }

  // ================= BUILDER SONDAGGIO =================
  function renderSurveyBuilder() {
    questionCounter = 0;
    const content = document.getElementById('tab-content');
    content.innerHTML = `
      <div class="card">
        <h2>Nuovo sondaggio</h2>
        <label>Titolo del sondaggio</label>
        <input type="text" id="survey-title" placeholder="Es. Valutazione qualità del corso" />
        <div id="questions-container"></div>
        <div class="btn-row">
          <button class="secondary" id="add-q-1">+ Aggiungi domanda</button>
        </div>
        <div id="builder-error" class="error-msg"></div>
        <div class="btn-row">
          <button id="save-survey-btn">Salva sondaggio</button>
          <button class="secondary" id="cancel-survey-btn">Annulla</button>
        </div>
      </div>
    `;
    document.getElementById('add-q-1').addEventListener('click', () => addQuestionBlock('survey'));
    document.getElementById('save-survey-btn').addEventListener('click', saveSurvey);
    document.getElementById('cancel-survey-btn').addEventListener('click', renderSurveysList);
    addQuestionBlock('survey');
  }

  async function saveSurvey() {
    const title = document.getElementById('survey-title').value.trim();
    const errorEl = document.getElementById('builder-error');
    if (!title) { errorEl.textContent = 'Inserisci un titolo per il sondaggio.'; return; }
    const questions = collectQuestions('survey');
    if (questions.length === 0) { errorEl.textContent = 'Aggiungi almeno una domanda con opzioni.'; return; }
    for (const q of questions) {
      if (q.options.length < 2) { errorEl.textContent = `La domanda "${q.text}" ha meno di 2 opzioni.`; return; }
    }
    errorEl.textContent = '';
    const res = await apiFetch('/api/surveys', { method: 'POST', body: JSON.stringify({ title, questions }) });
    const data = await res.json();
    if (!res.ok) { errorEl.textContent = data.error || 'Errore nel salvataggio'; return; }
    renderSurveysList();
  }

  // ================= DETTAGLIO / RISULTATI SONDAGGIO =================
  async function renderSurveyDetail(surveyId) {
    const content = document.getElementById('tab-content');
    content.innerHTML = '<p class="muted">Caricamento...</p>';
    const [surveyRes, resultsRes] = await Promise.all([
      apiFetch(`/api/surveys/${surveyId}`),
      apiFetch(`/api/surveys/${surveyId}/results`)
    ]);
    const survey = await surveyRes.json();
    const results = await resultsRes.json();
    const link = `${BASE_URL}/survey/${surveyId}`;

    content.innerHTML = `
      <div class="card">
        <div class="btn-row" style="justify-content:space-between;">
          <h2 style="margin:0;">${escapeHtml(survey.title)}</h2>
          <span class="tag ${survey.status === 'open' ? 'open' : 'closed'}">${survey.status === 'open' ? 'Aperto' : 'Chiuso'}</span>
        </div>
        <p class="muted">${survey.questions.length} domande &middot; ${results.totalRespondents} risposte ricevute (anonime)</p>
        <label>Link da condividere con i partecipanti</label>
        <div class="link-box">
          <input type="text" readonly value="${link}" id="survey-link-input" />
          <button class="secondary" id="copy-link-btn" style="padding:6px 10px;">Copia</button>
        </div>
        <div class="btn-row">
          <button class="secondary" id="toggle-status-btn">${survey.status === 'open' ? 'Chiudi sondaggio' : 'Riapri sondaggio'}</button>
          <a class="btn secondary" href="/api/surveys/${surveyId}/results.csv?token=${token}" target="_blank">Scarica report CSV</a>
          <button class="danger" id="delete-survey-btn">Elimina sondaggio</button>
          <button class="secondary" id="back-btn">Torna alla lista</button>
        </div>
      </div>

      <div class="card">
        <h3>Risultati aggregati</h3>
        ${results.questions.map((q) => `
          <div class="question-block">
            <div class="question-title">${escapeHtml(q.text)}</div>
            ${q.options.map((o) => `
              <div class="muted">${escapeHtml(o.text)}: <strong>${o.percentage}%</strong> (${o.count} risposte)</div>
              <progress value="${o.percentage}" max="100"></progress>
            `).join('')}
          </div>
        `).join('')}
      </div>
    `;

    document.getElementById('back-btn').addEventListener('click', renderSurveysList);
    document.getElementById('copy-link-btn').addEventListener('click', () => copyToClipboard(link));
    document.getElementById('toggle-status-btn').addEventListener('click', async () => {
      const newStatus = survey.status === 'open' ? 'closed' : 'open';
      await apiFetch(`/api/surveys/${surveyId}`, { method: 'PATCH', body: JSON.stringify({ status: newStatus }) });
      renderSurveyDetail(surveyId);
    });
    document.getElementById('delete-survey-btn').addEventListener('click', async () => {
      if (!confirm('Sei sicuro di voler eliminare questo sondaggio e tutti i suoi risultati?')) return;
      await apiFetch(`/api/surveys/${surveyId}`, { method: 'DELETE' });
      renderSurveysList();
    });
  }

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
      alert('Link copiato!');
    }).catch(() => {
      alert('Impossibile copiare automaticamente. Copia il link manualmente: ' + text);
    });
  }

  // ================= INIT =================
  if (token) {
    renderDashboard();
  } else {
    renderLogin();
  }
})();
