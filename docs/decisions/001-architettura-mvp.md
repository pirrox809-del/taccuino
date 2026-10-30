# Decisione 001 — Architettura dell'MVP (Fasi 0–1)

**Stato**: accettata · **Data**: 2026-10-30 · **Fase**: 0–1 (MVP)

## Contesto

Il piano di progetto prevede un'app di appunti a blocchi local-first.
L'ambiente di sviluppo disponibile è Next.js 16 (App Router) con TypeScript,
Tailwind 4, shadcn/ui e Prisma/SQLite. Il piano originale indicava
React+Vite, TipTap, Yjs e SQLite WASM su OPFS.

## Decisione

Per l'MVP usiamo lo stack dell'ambiente ospitante, adattando i principi:

1. **Editor scritto da zero** su `contenteditable` (nessun TipTap/BlockNote):
   - dipendenze zero per l'editor → nessun rischio di licenza (BlockNote XL
     è vietato dal piano);
   - architettura «uncontrolled»: il keystroke NON passa da React; lo stato
     vive in un ref, il render scatta solo per operazioni strutturali
     (add/delete/move/type-change);
   - ogni blocco è `React.memo`; conversioni di tipo → remount (`key` include
     il tipo) per evitare il riuso del DOM editabile come wrapper.
2. **Persistenza**: Prisma + SQLite lato server (invece di SQLite WASM su
   OPFS): il piano prevede local-first puro, ma nell'ambiente sandbox il
   server locale *è* il dispositivo. Il modello dati (page/block/version)
   resta proiettabile su storage client in una fase successiva.
3. **Cestino, versioni, import/export, ricerca** come API REST in
   `src/app/api/**` con validazione zod: contratto semplice, testabile con
   curl, riutilizzabile da un client locale futuro.
4. **Ricerca**: `contains` su SQLite (LIKE case-insensitive ASCII) con
   snippet calcolato in memoria: sufficiente per ≤ qualche migliaio di
   pagine; FTS5 resta l'opzione di Fase 3 per dataset grandi.
5. **i18n**: dizionario unico IT/EN (`src/lib/i18n.ts`) con store Zustand
   persistito; niente dipendenze i18n.
6. **PWA**: manifest + service worker passthrough (installabilità);
   la cache offline vera è rimandata alla fase dedicata.

## Alternative considerate

- **TipTap**: scartato per l'MVP — ottimo prodotto, ma l'editor custom evita
  dipendenze pesanti e rispetta il vincolo «dipendenze minime, licenze
  permissive» con pieno controllo del modello a blocchi.
- **Yjs subito**: rimandato alla Fase 4 (sincronizzazione) — nell'MVP non c'è
  multi-dispositivo, e il CRDT aggiungerebbe complessità non richiesta.
- **NextAuth**: non richiesto — nessun account per l'MVP.

## Conseguenze

- Il costo dell'editor custom è la manutenzione della logica caret/DOM
  (vedi il bug `splitContentAtCaret` trovato e corretto in verifica).
- La migrazione verso local-first puro (Fase successiva) potrà riusare
  il layer API come contratto e l'editor così com'è.
