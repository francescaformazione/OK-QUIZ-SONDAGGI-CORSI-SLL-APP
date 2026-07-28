const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');

const EMPTY_DB = {
  tests: [],
  testSubmissions: [],
  surveys: [],
  surveySubmissions: []
};

function ensureDb() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(EMPTY_DB, null, 2));
  }
}

function readDb() {
  ensureDb();
  const raw = fs.readFileSync(DB_PATH, 'utf-8');
  try {
    return JSON.parse(raw);
  } catch (e) {
    return JSON.parse(JSON.stringify(EMPTY_DB));
  }
}

function writeDbRaw(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// Coda semplice per serializzare le scritture concorrenti
let queue = Promise.resolve();

function transact(mutatorFn) {
  queue = queue.then(async () => {
    const data = readDb();
    const result = await mutatorFn(data);
    writeDbRaw(data);
    return result;
  });
  return queue;
}

module.exports = { readDb, transact };
