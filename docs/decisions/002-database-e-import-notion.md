# Decisione 002 — Database semplici e import Notion

Data: 2026-10-30 · Stato: accettata · Fase 2 del piano di progetto

## Contesto

Il documento di progetto (sezione 4, Priorità 2) richiede: «Database semplici:
collezioni di righe con proprietà (testo, numero, data, selezione, casella,
link) e viste **tabella** e **kanban**», più link tra pagine con backlink,
importazione da Notion (ZIP Markdown/CSV) e template di pagina.

La visione finale del documento (sezione 5.4) prevede che «ogni riga è a sua
volta una pagina» su un modello CRDT/Yjs. Quell'architettura non esiste ancora:
l'MVP usa un modello documentale (Page/Block su SQLite) con autosave debounced.

## Scelta

1. **Database come pagina speciale.** `Page.kind = 'database'`: la pagina non
   ha blocchi ma uno schema (`Database.properties`, JSON) e righe (`Row`).
   Coerente col modello dati del documento («un database è una pagina speciale
   che contiene uno schema di proprietà e righe»), riutilizza albero, cestino,
   preferiti, copertine e ricerca esistenti.

2. **Righe come record, non come pagine.** Per questa fase le righe sono
   record con `title` + `properties` (JSON chiave→valore primitivo). Le
   righe-pagine (apribili, annidabili, cercabili come documenti) restano
   nell'obiettivo per la fase sync/CRDT: il contratto `RowProperties` è già
   progettato per estendersi con un campo `pageId` opzionale.

3. **Tipi di proprietà**: testo, numero, selezione (opzioni con 8 colori
   fissi), data (ISO), casella, URL. Niente formule/relazioni/rollup (fuori
   scopo esplicito dal documento).

4. **Viste**: Tabella (griglia modificabile inline) e Kanban (raggruppamento
   per proprietà di selezione con drag&drop). La vista scelta è persistita in
   localStorage per pagina. Calendario/galleria (Priorità 2, punto 14) restano
   in backlog: richiedono più lavoro di layout e non sono nell'uscita di Fase 2.

5. **Schema gestito lato client, validato lato server.** Il frontend invia
   l'array completo di proprietà (PUT /api/pages/[id]/database) con debounce;
   il server sanifica (zod, max 50 proprietà, opzioni deduplicate). I valori
   delle righe non vengono riscritti al cambio schema: la vista decide come
   mostrarli (approccio «schema-light»).

6. **Link tra pagine.** Inline: `<a data-page-id="...">` dentro il contenuto
   HTML dei blocchi (inserito con `[[` + picker di ricerca). Export Markdown:
   `[testo](taccuino://page/<id>)`; import: round-trip inverso. Backlink:
   query LIKE su `data-page-id="<id>"` (sufficiente su SQLite locale; un
   indice dedicato `link` arriverà con la fase sync, come da modello dati).

7. **Import Notion.** L'importatore ZIP esistente (alberi di cartelle + `.md`,
   pulizia dei suffissi hash di 32 caratteri) è esteso ai `.csv`: ogni CSV
   diventa una pagina-database con inferenza dei tipi (numero, data ISO,
   casella, URL, altrimenti testo) e prima colonna = titolo. L'export
   dell'workspace produce per i database file `.csv` con BOM (compatibili con
   l'export/import Notion e con Excel/LibreOffice).

8. **Copertine.** `Page.cover` accetta `gradient:<nome>` (8 preset definiti in
   `src/lib/covers.ts`) o URL immagine consentiti (http(s) / allegati locali).
   Non entra nell'export Markdown (metadato di presentazione).

9. **Template di pagina.** Definiti lato client (`src/lib/templates.ts`):
   6 modelli (Vuota, Nota riunione, Attività, Journal, Brainstorm, Database).
   La creazione passa dal TemplateDialog; nessun servizio lato server.

## Alternative considerate

- **Righe come pagine subito**: rifiutata per ora — raddoppia la complessità
  dell'albero e della ricerca prima che l'esperienza base sia solida.
- **Editor tabella esterno (TanStack Table)**: già presente nelle dipendenze
  ma inutilizzato; una `<table>` nativa con celle contenteditable è più
  leggera e coerente col resto dell'editor scritto a mano.
- **Colonne di layout (multi-colonna)**: fuori da questa fase, richiede
  ridisegno del modello a blocchi (alberi annidati).

## Conseguenze

- Ricerca estesa alle righe (titolo + valori delle celle).
- Il flush dei PUT schema avviene anche con `keepalive` prima della chiusura.
- L'export ZIP di un database è un CSV: l'export Markdown di una pagina
  database non è previsto (non ha blocchi); l'API risponde con CSV.
- Le versioni (snapshot) restano limitate ai documenti a blocchi.
