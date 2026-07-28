(function () {
  const testId = window.location.pathname.split('/').pop();
  const app = document.getElementById('app');
  const pageTitle = document.getElementById('page-title');

  let testData = null;
  let currentAnswers = {};
  let participant = { nome: '', cognome: '' };

  async function load() {
    app.innerHTML = '<p class="muted">Caricamento...</p>';
    try {
      const res = await fetch(`/api/tests/${testId}/public`);
      const data = await res.json();
      if (!res.ok) {
        app.innerHTML = `<div class="card"><p class="error-msg">${data.error || 'Test non trovato'}</p></div>`;
        return;
      }
      testData = data;
      pageTitle.textContent = data.title || 'Test';
      if (data.status === 'closed') {
        app.innerHTML = `<div class="card"><h2>${data.title}</h2><p class="muted">Questo test è chiuso e non accetta più risposte.</p></div>`;
        return;
      }
      renderRegisterForm();
    } catch (e) {
      app.innerHTML = '<div class="card"><p class="error-msg">Errore di connessione. Riprova.</p></div>';
    }
  }

  function renderRegisterForm() {
    app.innerHTML = `
      <div class="card">
        <h2>${testData.title}</h2>
        <p class="muted">${testData.questions.length} domande. Inserisci i tuoi dati per iniziare.</p>
        <label>Nome</label>
        <input type="text" id="nome" placeholder="Nome" />
        <label>Cognome</label>
        <input type="text" id="cognome" placeholder="Cognome" />
        <div id="register-error" class="error-msg"></div>
        <button id="start-btn">Inizia il test</button>
      </div>
    `;
    document.getElementById('start-btn').addEventListener('click', () => {
      const nome = document.getElementById('nome').value.trim();
      const cognome = document.getElementById('cognome').value.trim();
      if (!nome || !cognome) {
        document.getElementById('register-error').textContent = 'Inserisci nome e cognome per continuare.';
        return;
      }
      participant = { nome, cognome };
      renderQuestions();
    });
  }

  function renderQuestions() {
    currentAnswers = {};
    const questionsHtml = testData.questions.map((q, idx) => `
      <div class="question-block">
        <div class="question-title">${idx + 1}. ${escapeHtml(q.text)}</div>
        ${q.multiSelect ? '<div class="muted" style="margin-bottom:8px;">(sono possibili più risposte corrette)</div>' : ''}
        ${q.options.map((o) => `
          <label class="option-row" data-qid="${q.id}" data-oid="${o.id}" data-multi="${q.multiSelect ? '1' : '0'}">
            <input type="${q.multiSelect ? 'checkbox' : 'radio'}" name="q_${q.id}" value="${o.id}" />
            <span>${escapeHtml(o.text)}</span>
          </label>
        `).join('')}
      </div>
    `).join('');

    app.innerHTML = `
      <div class="card">
        <h2>${testData.title}</h2>
        <p class="muted">Ciao ${escapeHtml(participant.nome)}, rispondi a tutte le domande.</p>
        ${questionsHtml}
        <div id="submit-error" class="error-msg"></div>
        <button id="submit-btn">Invia risposte</button>
      </div>
    `;

    app.querySelectorAll('.option-row').forEach((row) => {
      row.addEventListener('click', () => {
        const qid = row.getAttribute('data-qid');
        const oid = row.getAttribute('data-oid');
        const isMulti = row.getAttribute('data-multi') === '1';
        const input = row.querySelector('input');

        if (isMulti) {
          input.checked = !input.checked;
          const current = Array.isArray(currentAnswers[qid]) ? currentAnswers[qid] : [];
          if (input.checked) {
            currentAnswers[qid] = [...current, oid];
          } else {
            currentAnswers[qid] = current.filter((id) => id !== oid);
          }
          row.classList.toggle('selected', input.checked);
        } else {
          currentAnswers[qid] = oid;
          input.checked = true;
          app.querySelectorAll(`.option-row[data-qid="${qid}"]`).forEach((r) => r.classList.remove('selected'));
          row.classList.add('selected');
        }
      });
    });

    document.getElementById('submit-btn').addEventListener('click', submitTest);
  }

  async function submitTest() {
    const total = testData.questions.length;
    const answered = Object.values(currentAnswers).filter((a) => (Array.isArray(a) ? a.length > 0 : !!a)).length;
    if (answered < total) {
      const ok = confirm(`Hai risposto a ${answered} domande su ${total}. Vuoi inviare comunque?`);
      if (!ok) return;
    }
    const btn = document.getElementById('submit-btn');
    btn.disabled = true;
    btn.textContent = 'Invio in corso...';
    try {
      const res = await fetch(`/api/tests/${testId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: participant.nome, cognome: participant.cognome, answers: currentAnswers })
      });
      const data = await res.json();
      if (!res.ok) {
        document.getElementById('submit-error').textContent = data.error || 'Errore durante l\'invio';
        btn.disabled = false;
        btn.textContent = 'Invia risposte';
        return;
      }
      renderResult(data);
    } catch (e) {
      document.getElementById('submit-error').textContent = 'Errore di connessione. Riprova.';
      btn.disabled = false;
      btn.textContent = 'Invia risposte';
    }
  }

  function renderResult(result) {
    const passed = result.passed;
    app.innerHTML = `
      <div class="card">
        <div class="result-score ${passed ? '' : 'fail'}">
          <div class="pct">${result.percentage}%</div>
          <p>${result.correctCount} risposte corrette su ${result.total}</p>
          <p class="tag ${passed ? 'open' : 'closed'}">${passed ? 'Superato' : 'Non superato'}</p>
        </div>
        <p class="muted" style="text-align:center">Grazie ${escapeHtml(participant.nome)}, il risultato è stato registrato.</p>
      </div>
    `;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  load();
})();
