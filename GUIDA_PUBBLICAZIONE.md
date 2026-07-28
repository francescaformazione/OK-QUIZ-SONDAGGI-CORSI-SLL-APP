# L'app è già attiva? NO — leggi qui prima di tutto

In questo momento **l'app non esiste da nessuna parte su internet**. Quello che hai scaricato è solo il "progetto": un insieme di file di codice, come un mobile Ikea ancora nella scatola. Nessuno può usarla finché non la "monti" seguendo i passaggi qui sotto.

Il montaggio si fa in **2 tappe**:
- **Tappa A**: metti i file su GitHub (è come un archivio online gratuito, serve solo come "magazzino" del codice)
- **Tappa B**: collega quell'archivio a Render (è il servizio gratuito che fa davvero "girare" l'app e le dà un indirizzo internet)

Fatto questo una volta, l'app resta accesa per sempre (salvo il piccolo dettaglio del "si addormenta" spiegato in fondo) e non devi rifare nulla, a meno che tu non voglia modificare il codice in futuro.

Tempo previsto: 10-15 minuti, solo click, quasi nessuna scrittura.

---

## TAPPA A — Carica i file su GitHub

### A1. Crea l'account
Vai su **https://github.com** → in alto a destra clicca **Sign up** → segui la procedura (email, password, nome utente). Se hai già un account, salta questo passaggio e fai solo **Sign in**.

### A2. Crea un nuovo "repository" (cioè una cartella online per il tuo progetto)
1. Una volta dentro, in alto a destra clicca il simbolo **+** → dal menu scegli **New repository**.
2. Nel campo **Repository name** scrivi ad esempio: `quiz-sondaggi-app`
3. Lascia tutto il resto come è (va bene sia "Public" che "Private").
4. In fondo alla pagina clicca il pulsante verde **Create repository**.

Ora vedi una pagina quasi vuota con delle istruzioni tecniche: **ignorale**, non ti servono i comandi da terminale.

### A3. Carica i file (drag & drop, senza terminale)
1. In quella stessa pagina, cerca il link testuale **"uploading an existing file"** (è dentro la frase "...or **uploading an existing file**."). Cliccalo.
   - Se non lo trovi: in alto ci sono dei pulsanti, clicca **Add file** → **Upload files**.
2. Si apre una zona con una casella tratteggiata "Drag files here...".
3. Sul tuo computer, apri la cartella `quiz-app` che hai scaricato da questa chat (quella dentro lo zip).
4. **Seleziona tutto il contenuto della cartella** `quiz-app` (i file `server.js`, `db.js`, `package.json`, `render.yaml`, `.gitignore`, `GUIDA_PUBBLICAZIONE.md`, `package-lock.json` e le cartelle `public` e `esempi`) — attenzione: seleziona il **contenuto**, non la cartella `quiz-app` stessa.
5. Trascina tutto quello che hai selezionato dentro la casella tratteggiata della pagina GitHub.
6. Aspetta che la barra di caricamento finisca (qualche secondo).
7. Scorri fino in fondo alla pagina e clicca il pulsante verde **Commit changes**.

✅ Fatto: il codice ora è online su GitHub (ma attenzione, **ancora non è un sito funzionante**, è solo "in magazzino"). Copia l'indirizzo della pagina che hai davanti (in alto nel browser), ad esempio `https://github.com/tuonome/quiz-sondaggi-app` — non ti serve subito ma è comodo averlo.

---

## TAPPA B — Accendi l'app su Render

### B1. Crea l'account
Vai su **https://render.com** → clicca **Get Started** (o **Sign Up**) → scegli **"Sign up with GitHub"** (più veloce, così i due servizi si parlano subito da soli). Autorizza l'accesso quando richiesto.

### B2. Crea il servizio
1. Una volta dentro Render, clicca il pulsante **New +** (di solito in alto a destra o al centro della pagina).
2. Dal menu a tendina scegli **Blueprint**.
3. Render ti mostra la lista dei tuoi repository GitHub. Se non vedi `quiz-sondaggi-app`, clicca **"Configure account"** e autorizza l'accesso a quel repository specifico (o a tutti).
4. Clicca sul repository **quiz-sondaggi-app** → poi sul pulsante **Connect**.

### B3. Un solo dato da inserire: la password
Render legge da solo il file `render.yaml` che è già dentro il progetto e prepara tutto in automatico (build, avvio, spazio per salvare i dati). Ti chiederà solo:

> **ADMIN_PASSWORD** → scrivi qui la password che vuoi usare per accedere al tuo pannello di gestione (es. `MioCorso2026!`). **Scrivila anche da parte in un posto sicuro**, te la richiederà ogni volta che apri il pannello Admin.

### B4. Avvia
Clicca **Apply** (o **Create Blueprint**, il nome del pulsante può variare leggermente). Si apre una schermata con delle righe di testo che scorrono (i "log"): è normale, significa che Render sta installando e avviando l'app. Aspetta 2-4 minuti.

Quando in alto vedi la scritta **Live** con un pallino verde, l'app è online.

### B5. Trova il tuo indirizzo internet
Sempre nella stessa pagina, in alto vicino al nome del servizio, trovi un indirizzo tipo:

```
https://quiz-sondaggi-app.onrender.com
```

Cliccalo (o copialo): quello è il "sito" della tua app, sempre raggiungibile da PC, tablet e cellulare.

---

## Ora che è accesa: primo utilizzo

1. Vai su `https://il-tuo-indirizzo.onrender.com/admin`
2. Inserisci la password scelta al punto B3.
3. Nella tab **Test**, clicca **Importa JSON** → seleziona il file `esempi/esempio-test-sicurezza-30-domande.json` (quello dentro la cartella che hai scaricato) → si crea subito un test con le domande del tuo PDF.
   - ⚠️ Le risposte corrette le ho stimate io in base alla normativa italiana standard: prima di somministrarlo davvero, apri "Gestisci" e verificale/correggile tu.
4. Fai lo stesso nella tab **Sondaggi** con `esempi/esempio-sondaggio-valutazione-corso.json`.
5. Da "Gestisci" trovi: il **link da inviare** ai partecipanti, il bottone **Scarica versione PDF** (per chi non può collegarsi), e **Scarica report CSV** con i risultati.
6. Se qualcuno ha compilato il PDF su carta, torna in "Gestisci" quel test → **"+ Inserisci risposte manuali"** → inserisci nome, cognome e le risposte date su carta: verranno unite automaticamente nel report insieme a quelle arrivate online.

---

## Domande frequenti

**Devo rifare tutto ogni volta che voglio somministrare un nuovo test?**
No. Una volta accesa, l'app resta online per sempre. Entri semplicemente nel pannello Admin e crei quanti test e sondaggi vuoi, quando vuoi.

**"Si addormenta"? Cosa significa?**
Il piano gratuito di Render, dopo circa 15 minuti senza visite, mette in pausa l'app per risparmiare risorse. Alla prima persona che apre il link dopo la pausa, il sito si "risveglia" da solo in 20-30 secondi (basta aspettare, senza fare nulla). Dalla visita successiva torna veloce come sempre, finché resta attiva.

**Dove sono salvati i dati (risposte, risultati)?**
Su un piccolo disco collegato al servizio Render (l'ho già configurato nel file `render.yaml`), quindi restano anche se il servizio si riavvia o va in pausa. Consiglio comunque di scaricare periodicamente i CSV come backup personale.

**Posso cambiare la password admin in futuro?**
Sì: su Render vai sul tuo servizio → tab **Environment** → modifica il valore di `ADMIN_PASSWORD` → **Save Changes**. Il servizio si riavvia da solo in automatico.

**Se voglio modificare il codice in futuro?**
Carichi i nuovi file nello stesso repository GitHub (Add file → Upload files, sovrascrivendo quelli vecchi) → Render se ne accorge da solo e rifà il deploy in pochi minuti, senza che tu debba toccare Render.

**Devo restare collegato a Claude per far funzionare l'app?**
No. Una volta pubblicata su Render, l'app funziona in totale autonomia. Puoi chiudere questa chat, l'app resta online e raggiungibile da chiunque abbia il link.
