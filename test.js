(function () {
  const surveyId = window.location.pathname.split('/').pop();
  const app = document.getElementById('app');
  const pageTitle = document.getElementById('page-title');

  let surveyData = null;
  let currentAnswers = {};

  async function load() {
    app.innerHTML = '<p class="muted">Caricamento...</p>';
    try {
      const res = await fetch(`/api/surveys/${surveyId}/public`);
      const data = await res.json();
      if (!res.ok) {
        app.innerHTML = `<div class="card"><p class="error-msg">${data.error || 'Sondaggio non trovato'}</p></div>`;
        return;
      }
      surveyData = data;
      pageTitle.textContent = data.title || 'Sondaggio';
      if (data.status === 'closed') {
        app.innerHTML = `<div class="card"><h2>${data.title}</h2><p class="muted">Questo sondaggio è chiuso.</p></div>`;
        return;
      }
      renderQuestions();
    } catch (e) {
      app.innerHTML = '<div class="card"><p class="error-msg">Errore di connessione. Riprova.</p></div>';
    }
  }

  function renderQuestions() {
    const questionsHtml = surveyData.questions.map((q, idx) => `
      <div class="question-block">
        <div class="question-title">${idx + 1}. ${escapeHtml(q.text)}</div>
        ${q.options.map((o) => `
          <label class="option-row" data-qid="${q.id}" data-oid="${o.id}">
            <input type="radio" name="q_${q.id}" value="${o.id}" />
            <span>${escapeHtml(o.text)}</span>
          </label>
        `).join('')}
      </div>
    `).join('');

    app.innerHTML = `
      <div class="card">
        <h2>${surveyData.title}</h2>
        <p class="muted">Sondaggio anonimo: le tue risposte non saranno associate al tuo nome.</p>
        ${questionsHtml}
        <div id="submit-error" class="error-msg"></div>
        <button id="submit-btn">Invia risposte</button>
      </div>
    `;

    app.querySelectorAll('.option-row').forEach((row) => {
      row.addEventListener('click', () => {
        const qid = row.getAttribute('data-qid');
        const oid = row.getAttribute('data-oid');
        currentAnswers[qid] = oid;
        row.querySelector('input').checked = true;
        app.querySelectorAll(`.option-row[data-qid="${qid}"]`).forEach((r) => r.classList.remove('selected'));
        row.classList.add('selected');
      });
    });

    document.getElementById('submit-btn').addEventListener('click', submitSurvey);
  }

  async function submitSurvey() {
    const total = surveyData.questions.length;
    const answered = Object.keys(currentAnswers).length;
    if (answered < total) {
      const ok = confirm(`Hai risposto a ${answered} domande su ${total}. Vuoi inviare comunque?`);
      if (!ok) return;
    }
    const btn = document.getElementById('submit-btn');
    btn.disabled = true;
    btn.textContent = 'Invio in corso...';
    try {
      const res = await fetch(`/api/surveys/${surveyId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: currentAnswers })
      });
      const data = await res.json();
      if (!res.ok) {
        document.getElementById('submit-error').textContent = data.error || 'Errore durante l\'invio';
        btn.disabled = false;
        btn.textContent = 'Invia risposte';
        return;
      }
      app.innerHTML = `
        <div class="card">
          <div class="result-score">
            <p>✓</p>
            <p>Grazie per aver completato il sondaggio!</p>
          </div>
        </div>
      `;
    } catch (e) {
      document.getElementById('submit-error').textContent = 'Errore di connessione. Riprova.';
      btn.disabled = false;
      btn.textContent = 'Invia risposte';
    }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  load();
})();
