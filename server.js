const express = require('express');
const path = require('path');
const crypto = require('crypto');
const PDFDocument = require('pdfkit');
const { readDb, transact } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

app.use(express.json({ limit: '2mb' }));

// I file della sottocartella "public" (se presente) vengono serviti normalmente.
// In più, per tolleranza a upload che "spianano" le cartelle su GitHub, serviamo
// anche i file statici dalla radice del progetto, bloccando però l'accesso diretto
// ai file di backend/configurazione che non devono essere scaricabili.
const ROOT_BLOCKLIST = new Set([
  '/server.js', '/db.js', '/package.json', '/package-lock.json',
  '/render.yaml', '/GUIDA_PUBBLICAZIONE.md', '/.gitignore',
  '/esempio-test-sicurezza-30-domande.json', '/esempio-sondaggio-valutazione-corso.json'
]);
app.use((req, res, next) => {
  if (ROOT_BLOCKLIST.has(req.path) || req.path.startsWith('/esempi/') || req.path.startsWith('/data/')) {
    return res.status(404).send('Not found');
  }
  next();
});
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

// ---------- AUTH ADMIN ----------
const adminTokens = new Map(); // token -> expiry timestamp
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12 ore

function requireAdmin(req, res, next) {
  const auth = req.headers.authorization || '';
  let token = auth.replace('Bearer ', '').trim();
  if (!token && req.query.token) {
    // Consente il download diretto dei CSV tramite link <a>, che non può impostare header custom
    token = String(req.query.token);
  }
  const expiry = adminTokens.get(token);
  if (!expiry || expiry < Date.now()) {
    return res.status(401).json({ error: 'Non autorizzato. Effettua di nuovo il login.' });
  }
  next();
}

app.post('/api/admin/login', (req, res) => {
  const { password } = req.body || {};
  if (password && password === ADMIN_PASSWORD) {
    const token = crypto.randomUUID();
    adminTokens.set(token, Date.now() + TOKEN_TTL_MS);
    return res.json({ token });
  }
  return res.status(401).json({ error: 'Password errata' });
});

// ---------- HELPERS ----------
function pct(part, total) {
  if (!total) return 0;
  return Math.round((part / total) * 1000) / 10; // 1 decimale
}

function csvEscape(value) {
  const s = String(value ?? '');
  if (/[",\n;]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

// =========================================================
// TEST (quiz a risposta multipla)
// =========================================================

// Crea un test
app.post('/api/tests', requireAdmin, async (req, res) => {
  const { title, passThreshold, questions } = req.body || {};
  if (!title || !Array.isArray(questions) || questions.length === 0) {
    return res.status(400).json({ error: 'Titolo e almeno una domanda sono obbligatori' });
  }
  const builtQuestions = [];
  for (const q of questions) {
    if (!q.text || !Array.isArray(q.options) || q.options.length < 2) {
      return res.status(400).json({ error: 'Ogni domanda deve avere un testo e almeno 2 opzioni' });
    }
    if (typeof q.correctIndex !== 'number' || q.correctIndex < 0 || q.correctIndex >= q.options.length) {
      return res.status(400).json({ error: 'Ogni domanda deve avere una risposta corretta valida' });
    }
    const optionObjs = q.options.map((optText) => ({ id: crypto.randomUUID(), text: String(optText) }));
    builtQuestions.push({
      id: crypto.randomUUID(),
      text: String(q.text),
      options: optionObjs,
      correctOptionId: optionObjs[q.correctIndex].id
    });
  }

  const test = {
    id: crypto.randomUUID(),
    title: String(title),
    passThreshold: typeof passThreshold === 'number' ? passThreshold : 60,
    status: 'open', // open | closed
    questions: builtQuestions,
    createdAt: new Date().toISOString()
  };

  await transact((data) => {
    data.tests.push(test);
  });

  res.json(test);
});

// Lista test (per admin, con conteggio iscritti)
app.get('/api/tests', requireAdmin, (req, res) => {
  const data = readDb();
  const list = data.tests.map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    numQuestions: t.questions.length,
    passThreshold: t.passThreshold,
    createdAt: t.createdAt,
    submissionsCount: data.testSubmissions.filter((s) => s.testId === t.id).length
  }));
  res.json(list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
});

// Dettaglio test (admin, con risposte corrette per editing)
app.get('/api/tests/:id', requireAdmin, (req, res) => {
  const data = readDb();
  const test = data.tests.find((t) => t.id === req.params.id);
  if (!test) return res.status(404).json({ error: 'Test non trovato' });
  res.json(test);
});

// Cambia stato (apri/chiudi)
app.patch('/api/tests/:id', requireAdmin, async (req, res) => {
  const { status } = req.body || {};
  if (!['open', 'closed'].includes(status)) {
    return res.status(400).json({ error: 'Stato non valido' });
  }
  const result = await transact((data) => {
    const test = data.tests.find((t) => t.id === req.params.id);
    if (!test) return null;
    test.status = status;
    return test;
  });
  if (!result) return res.status(404).json({ error: 'Test non trovato' });
  res.json(result);
});

// Elimina test
app.delete('/api/tests/:id', requireAdmin, async (req, res) => {
  await transact((data) => {
    data.tests = data.tests.filter((t) => t.id !== req.params.id);
    data.testSubmissions = data.testSubmissions.filter((s) => s.testId !== req.params.id);
  });
  res.json({ ok: true });
});

// Versione pubblica del test (senza risposte corrette) - per chi lo compila
app.get('/api/tests/:id/public', (req, res) => {
  const data = readDb();
  const test = data.tests.find((t) => t.id === req.params.id);
  if (!test) return res.status(404).json({ error: 'Test non trovato' });
  if (test.status === 'closed') {
    return res.json({ id: test.id, title: test.title, status: 'closed' });
  }
  res.json({
    id: test.id,
    title: test.title,
    status: 'open',
    questions: test.questions.map((q) => ({
      id: q.id,
      text: q.text,
      options: q.options.map((o) => ({ id: o.id, text: o.text }))
    }))
  });
});

// Versione PDF stampabile del test (senza risposte corrette) - per chi non può accedere online
app.get('/api/tests/:id/pdf', (req, res) => {
  const data = readDb();
  const test = data.tests.find((t) => t.id === req.params.id);
  if (!test) return res.status(404).send('Test non trovato');
  if (test.status === 'closed') return res.status(403).send('Il test è chiuso e non accetta più risposte');

  const filename = `${test.title.replace(/[^a-z0-9]+/gi, '_')}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  doc.pipe(res);

  doc.fontSize(16).font('Helvetica-Bold').text(test.title, { align: 'center' });
  doc.moveDown(0.8);

  doc.fontSize(11).font('Helvetica').text('Nome: _______________________________', { continued: false });
  doc.moveDown(0.3);
  doc.text('Cognome: _______________________________');
  doc.moveDown(0.6);

  doc.fontSize(9).fillColor('#555555').text(
    'Istruzioni: cerchia la lettera corrispondente alla risposta che ritieni corretta per ciascuna domanda. ' +
    'Al termine, consegna o invia questo foglio compilato all\'organizzatore del corso, che inserirà le tue risposte nel sistema.'
  );
  doc.fillColor('black');
  doc.moveDown(0.8);

  test.questions.forEach((q, idx) => {
    doc.fontSize(11).font('Helvetica-Bold').text(`${idx + 1}. ${q.text}`);
    doc.font('Helvetica').fontSize(10.5);
    q.options.forEach((o, i) => {
      const letter = String.fromCharCode(65 + i);
      doc.text(`     ${letter})  ${o.text}`);
    });
    doc.moveDown(0.6);
  });

  doc.end();
});


function scoreSubmission(test, nome, cognome, answers) {
  let correctCount = 0;
  test.questions.forEach((q) => {
    if (answers[q.id] && answers[q.id] === q.correctOptionId) correctCount += 1;
  });
  const total = test.questions.length;
  const percentage = pct(correctCount, total);
  const passed = percentage >= (test.passThreshold ?? 60);
  return {
    id: crypto.randomUUID(),
    testId: test.id,
    nome: String(nome).trim(),
    cognome: String(cognome).trim(),
    correctCount,
    total,
    percentage,
    passed,
    submittedAt: new Date().toISOString()
  };
}

// Invio risposte del partecipante (compilazione online)
app.post('/api/tests/:id/submit', async (req, res) => {
  const { nome, cognome, answers } = req.body || {};
  if (!nome || !cognome || typeof answers !== 'object') {
    return res.status(400).json({ error: 'Nome, cognome e risposte sono obbligatori' });
  }

  const data = readDb();
  const test = data.tests.find((t) => t.id === req.params.id);
  if (!test) return res.status(404).json({ error: 'Test non trovato' });
  if (test.status === 'closed') return res.status(403).json({ error: 'Il test è chiuso' });

  const submission = scoreSubmission(test, nome, cognome, answers);

  await transact((d) => {
    d.testSubmissions.push(submission);
  });

  res.json({
    correctCount: submission.correctCount,
    total: submission.total,
    percentage: submission.percentage,
    passed: submission.passed,
    passThreshold: test.passThreshold ?? 60
  });
});

// Inserimento manuale delle risposte da parte dell'organizzatore
// (usato per registrare chi ha compilato il test su carta/PDF)
app.post('/api/tests/:id/manual-submit', requireAdmin, async (req, res) => {
  const { nome, cognome, answers } = req.body || {};
  if (!nome || !cognome || typeof answers !== 'object') {
    return res.status(400).json({ error: 'Nome, cognome e risposte sono obbligatori' });
  }

  const data = readDb();
  const test = data.tests.find((t) => t.id === req.params.id);
  if (!test) return res.status(404).json({ error: 'Test non trovato' });

  const submission = scoreSubmission(test, nome, cognome, answers);

  await transact((d) => {
    d.testSubmissions.push(submission);
  });

  res.json(submission);
});


// Risultati test (admin)
app.get('/api/tests/:id/results', requireAdmin, (req, res) => {
  const data = readDb();
  const test = data.tests.find((t) => t.id === req.params.id);
  if (!test) return res.status(404).json({ error: 'Test non trovato' });
  const subs = data.testSubmissions
    .filter((s) => s.testId === req.params.id)
    .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
  res.json({ test: { id: test.id, title: test.title, passThreshold: test.passThreshold }, submissions: subs });
});

// Export CSV risultati test
app.get('/api/tests/:id/results.csv', requireAdmin, (req, res) => {
  const data = readDb();
  const test = data.tests.find((t) => t.id === req.params.id);
  if (!test) return res.status(404).send('Test non trovato');
  const subs = data.testSubmissions.filter((s) => s.testId === req.params.id);

  const rows = [
    ['Nome', 'Cognome', 'Risposte corrette', 'Totale domande', 'Percentuale', 'Superato', 'Data invio'].join(';')
  ];
  subs.forEach((s) => {
    rows.push([
      csvEscape(s.nome),
      csvEscape(s.cognome),
      s.correctCount,
      s.total,
      s.percentage + '%',
      s.passed ? 'SI' : 'NO',
      new Date(s.submittedAt).toLocaleString('it-IT')
    ].join(';'));
  });

  const filename = `risultati_${test.title.replace(/[^a-z0-9]+/gi, '_')}.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send('\uFEFF' + rows.join('\n'));
});

// =========================================================
// SONDAGGI (anonimi)
// =========================================================

app.post('/api/surveys', requireAdmin, async (req, res) => {
  const { title, questions } = req.body || {};
  if (!title || !Array.isArray(questions) || questions.length === 0) {
    return res.status(400).json({ error: 'Titolo e almeno una domanda sono obbligatori' });
  }
  const builtQuestions = [];
  for (const q of questions) {
    if (!q.text || !Array.isArray(q.options) || q.options.length < 2) {
      return res.status(400).json({ error: 'Ogni domanda deve avere un testo e almeno 2 opzioni' });
    }
    builtQuestions.push({
      id: crypto.randomUUID(),
      text: String(q.text),
      options: q.options.map((optText) => ({ id: crypto.randomUUID(), text: String(optText) }))
    });
  }

  const survey = {
    id: crypto.randomUUID(),
    title: String(title),
    status: 'open',
    questions: builtQuestions,
    createdAt: new Date().toISOString()
  };

  await transact((data) => {
    data.surveys.push(survey);
  });

  res.json(survey);
});

app.get('/api/surveys', requireAdmin, (req, res) => {
  const data = readDb();
  const list = data.surveys.map((s) => ({
    id: s.id,
    title: s.title,
    status: s.status,
    numQuestions: s.questions.length,
    createdAt: s.createdAt,
    submissionsCount: data.surveySubmissions.filter((sub) => sub.surveyId === s.id).length
  }));
  res.json(list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
});

app.get('/api/surveys/:id', requireAdmin, (req, res) => {
  const data = readDb();
  const survey = data.surveys.find((s) => s.id === req.params.id);
  if (!survey) return res.status(404).json({ error: 'Sondaggio non trovato' });
  res.json(survey);
});

app.patch('/api/surveys/:id', requireAdmin, async (req, res) => {
  const { status } = req.body || {};
  if (!['open', 'closed'].includes(status)) {
    return res.status(400).json({ error: 'Stato non valido' });
  }
  const result = await transact((data) => {
    const survey = data.surveys.find((s) => s.id === req.params.id);
    if (!survey) return null;
    survey.status = status;
    return survey;
  });
  if (!result) return res.status(404).json({ error: 'Sondaggio non trovato' });
  res.json(result);
});

app.delete('/api/surveys/:id', requireAdmin, async (req, res) => {
  await transact((data) => {
    data.surveys = data.surveys.filter((s) => s.id !== req.params.id);
    data.surveySubmissions = data.surveySubmissions.filter((s) => s.surveyId !== req.params.id);
  });
  res.json({ ok: true });
});

app.get('/api/surveys/:id/public', (req, res) => {
  const data = readDb();
  const survey = data.surveys.find((s) => s.id === req.params.id);
  if (!survey) return res.status(404).json({ error: 'Sondaggio non trovato' });
  if (survey.status === 'closed') {
    return res.json({ id: survey.id, title: survey.title, status: 'closed' });
  }
  res.json({
    id: survey.id,
    title: survey.title,
    status: 'open',
    questions: survey.questions.map((q) => ({
      id: q.id,
      text: q.text,
      options: q.options.map((o) => ({ id: o.id, text: o.text }))
    }))
  });
});

// Invio risposte sondaggio - completamente anonimo
app.post('/api/surveys/:id/submit', async (req, res) => {
  const { answers } = req.body || {};
  if (typeof answers !== 'object') {
    return res.status(400).json({ error: 'Risposte obbligatorie' });
  }
  const data = readDb();
  const survey = data.surveys.find((s) => s.id === req.params.id);
  if (!survey) return res.status(404).json({ error: 'Sondaggio non trovato' });
  if (survey.status === 'closed') return res.status(403).json({ error: 'Il sondaggio è chiuso' });

  const submission = {
    id: crypto.randomUUID(),
    surveyId: survey.id,
    answers, // { questionId: optionId }
    submittedAt: new Date().toISOString()
  };

  await transact((d) => {
    d.surveySubmissions.push(submission);
  });

  res.json({ ok: true });
});

// Risultati aggregati sondaggio (admin)
app.get('/api/surveys/:id/results', requireAdmin, (req, res) => {
  const data = readDb();
  const survey = data.surveys.find((s) => s.id === req.params.id);
  if (!survey) return res.status(404).json({ error: 'Sondaggio non trovato' });
  const subs = data.surveySubmissions.filter((s) => s.surveyId === req.params.id);
  const totalRespondents = subs.length;

  const questionsResult = survey.questions.map((q) => {
    const optionCounts = q.options.map((o) => {
      const count = subs.filter((s) => s.answers[q.id] === o.id).length;
      return { optionId: o.id, text: o.text, count, percentage: pct(count, totalRespondents) };
    });
    return { questionId: q.id, text: q.text, options: optionCounts };
  });

  res.json({ survey: { id: survey.id, title: survey.title }, totalRespondents, questions: questionsResult });
});

// Export CSV risultati sondaggio
app.get('/api/surveys/:id/results.csv', requireAdmin, (req, res) => {
  const data = readDb();
  const survey = data.surveys.find((s) => s.id === req.params.id);
  if (!survey) return res.status(404).send('Sondaggio non trovato');
  const subs = data.surveySubmissions.filter((s) => s.surveyId === req.params.id);
  const totalRespondents = subs.length;

  const rows = [['Domanda', 'Opzione', 'Numero risposte', 'Percentuale'].join(';')];
  survey.questions.forEach((q) => {
    q.options.forEach((o) => {
      const count = subs.filter((s) => s.answers[q.id] === o.id).length;
      rows.push([csvEscape(q.text), csvEscape(o.text), count, pct(count, totalRespondents) + '%'].join(';'));
    });
  });
  rows.push('');
  rows.push(['Totale partecipanti', totalRespondents].join(';'));

  const filename = `sondaggio_${survey.title.replace(/[^a-z0-9]+/gi, '_')}.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send('\uFEFF' + rows.join('\n'));
});

// =========================================================
// ROUTE PAGINE HTML (per link diretti /test/:id e /survey/:id)
// =========================================================
function sendPage(res, filename) {
  const publicPath = path.join(__dirname, 'public', filename);
  const rootPath = path.join(__dirname, filename);
  res.sendFile(publicPath, (err) => {
    if (err) res.sendFile(rootPath);
  });
}

app.get('/test/:id', (req, res) => {
  sendPage(res, 'test.html');
});
app.get('/survey/:id', (req, res) => {
  sendPage(res, 'survey.html');
});
app.get('/admin', (req, res) => {
  sendPage(res, 'admin.html');
});

app.listen(PORT, () => {
  console.log(`Server avviato sulla porta ${PORT}`);
});
