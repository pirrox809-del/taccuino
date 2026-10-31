/**
 * Taccuino — dizionario i18n (italiano + inglese).
 * Unica fonte di verità per tutte le stringhe dell'interfaccia.
 * La lingua è persistita in localStorage ("taccuino-lang"), default: italiano.
 */
'use client'

import { useCallback } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Lang = 'it' | 'en'

const it = {
  // App
  appName: 'Taccuino',
  appTagline: 'Appunti a blocchi, gratis e solo tuoi',
  loading: 'Caricamento…',

  // Sidebar
  search: 'Cerca',
  searchPlaceholder: 'Cerca pagine e contenuti…',
  newPage: 'Nuova pagina',
  pagesSection: 'Pagine',
  favoritesSection: 'Preferiti',
  trashSection: 'Cestino',
  importAction: 'Importa (Markdown/ZIP)',
  exportAllAction: 'Esporta workspace (ZIP)',
  noPagesYet: 'Nessuna pagina. Creane una!',
  toggleSidebar: 'Mostra o nascondi la barra laterale',
  sidebarSectionPages: 'Sezione Pagine',

  // Pagina
  untitled: 'Senza titolo',
  addIcon: 'Aggiungi un\u2019icona',
  changeIcon: 'Cambia icona',
  removeIcon: 'Rimuovi icona',
  pickIcon: 'Scegli un\u2019icona',
  moreActions: 'Altre azioni',
  favoriteAction: 'Aggiungi ai preferiti',
  unfavoriteAction: 'Togli dai preferiti',
  duplicateAction: 'Duplica pagina',
  exportPageAction: 'Esporta in Markdown',
  historyAction: 'Cronologia versioni',
  trashAction: 'Sposta nel cestino',
  breadcrumbsRoot: 'Workspace',

  // Editor — segnaposto
  placeholderParagraph: 'Scrivi qualcosa, oppure premi / per i comandi…',
  placeholderHeading1: 'Titolo 1',
  placeholderHeading2: 'Titolo 2',
  placeholderHeading3: 'Titolo 3',
  placeholderBullet: 'Voce di elenco',
  placeholderNumbered: 'Voce numerata',
  placeholderChecklist: 'Cosa da fare',
  placeholderQuote: 'Citazione',
  placeholderCode: 'Codice',
  placeholderCallout: 'Scrivi una nota…',
  placeholderImage: 'Aggiungi un\u2019immagine',
  placeholderBookmark: 'Incolla o scrivi un link…',

  // Editor — menu "/"
  slashMenuTitle: 'Inserisci un blocco',
  slashMenuNoResults: 'Nessun blocco trovato',
  slashBlockText: 'Testo',
  slashBlockTextDesc: 'Inizia a scrivere con testo semplice.',
  slashBlockH1: 'Titolo 1',
  slashBlockH1Desc: 'Titolo di sezione grande.',
  slashBlockH2: 'Titolo 2',
  slashBlockH2Desc: 'Titolo di sezione medio.',
  slashBlockH3: 'Titolo 3',
  slashBlockH3Desc: 'Titolo di sezione piccolo.',
  slashBlockBullet: 'Elenco puntato',
  slashBlockBulletDesc: 'Crea un semplice elenco.',
  slashBlockNumbered: 'Elenco numerato',
  slashBlockNumberedDesc: 'Crea un elenco numerato.',
  slashBlockChecklist: 'Checklist',
  slashBlockChecklistDesc: 'Spunta le attività da fare.',
  slashBlockQuote: 'Citazione',
  slashBlockQuoteDesc: 'Cattura una citazione.',
  slashBlockCode: 'Codice',
  slashBlockCodeDesc: 'Cattura un frammento di codice.',
  slashBlockDivider: 'Divisore',
  slashBlockDividerDesc: 'Separa visivamente i blocchi.',
  slashBlockCallout: 'Callout',
  slashBlockCalloutDesc: 'Metti in evidenza una nota.',
  slashBlockImage: 'Immagine',
  slashBlockImageDesc: 'Carica o collega un\u2019immagine.',
  slashBlockBookmark: 'Segnalibro',
  slashBlockBookmarkDesc: 'Salva un link web come scheda.',

  // Editor — toolbar di selezione
  toolbarBold: 'Grassetto',
  toolbarItalic: 'Corsivo',
  toolbarUnderline: 'Sottolineato',
  toolbarStrike: 'Barrato',
  toolbarCode: 'Codice inline',
  toolbarLink: 'Link',
  toolbarLinkPrompt: 'URL del link (lascia vuoto per rimuovere)',
  toolbarClear: 'Rimuovi formattazione',

  // Editor — menu blocco (handle)
  blockMenuLabel: 'Azioni blocco',
  blockDuplicate: 'Duplica',
  blockDelete: 'Elimina',
  blockMoveUp: 'Sposta su',
  blockMoveDown: 'Sposta giù',
  blockAddBelow: 'Aggiungi blocco sotto',
  blockDragLabel: 'Trascina per riordinare',

  // Editor — blocco codice
  codeLanguage: 'Linguaggio',
  codeCopy: 'Copia',
  codeCopied: 'Copiato!',
  codeLangPlain: 'Testo semplice',

  // Editor — immagine
  imageUpload: 'Carica un\u2019immagine',
  imageFromUrl: 'Da URL…',
  imageUploadTooBig: 'Immagine troppo grande (massimo 4 MB)',
  imageInvalidType: 'Formato non valido: usa PNG, JPEG, GIF o WebP',
  imageUploadFailed: 'Caricamento non riuscito',
  imageCaptionPlaceholder: 'Scrivi una didascalia…',

  // Editor — callout
  calloutPickEmoji: 'Scegli un\u2019emoji',
  calloutDefaultIcon: '💡',

  // Ricerca (Ctrl/Cmd+K)
  searchActionsGroup: 'Azioni rapide',
  searchResultsGroup: 'Pagine',
  searchNoResults: 'Nessun risultato',
  searchNewPage: 'Nuova pagina',
  searchGoTrash: 'Apri il cestino',
  searchExportZip: 'Esporta workspace (ZIP)',
  searchImportFile: 'Importa Markdown o ZIP',
  searchToggleTheme: 'Cambia tema chiaro/scuro',
  searchToggleLang: 'Switch to English',
  searchHint: 'digita per cercare tra le pagine',

  // Cronologia versioni
  historyTitle: 'Cronologia versioni',
  historyDescription: 'Istantanee automatiche del contenuto, salvate di tanto in tempo mentre scrivi.',
  historyEmpty: 'Nessuna versione salvata. Continua a scrivere: le istantanee arrivano da sole.',
  historyRestore: 'Ripristina',
  historyRestoreConfirmTitle: 'Ripristinare questa versione?',
  historyRestoreConfirmBody: 'Il contenuto attuale della pagina verrà sostituito con l\u2019istantanea selezionata.',
  historyRestored: 'Versione ripristinata',
  historyBlocks: 'blocchi',
  historyCurrentLabel: 'salvata',

  // Cestino
  trashTitle: 'Cestino',
  trashDescription: 'Le pagine eliminate restano qui finché non le elimini per sempre.',
  trashEmpty: 'Il cestino è vuoto',
  trashRestore: 'Ripristina',
  trashDeleteForever: 'Elimina per sempre',
  trashEmptyAll: 'Svuota cestino',
  trashEmptyConfirmTitle: 'Svuotare il cestino?',
  trashEmptyConfirmBody: 'Tutte le pagine nel cestino verranno eliminate definitivamente. Azione irreversibile.',
  trashedPage: 'Pagina spostata nel cestino',
  restoredPage: 'Pagina ripristinata',
  deletedForever: 'Pagina eliminata per sempre',
  trashEmptied: 'Cestino svuotato',

  // Import / export
  importTitle: 'Importa in Taccuino',
  importDescription: 'Carica un file .md oppure uno ZIP di pagine Markdown (compatibile con gli export di Notion).',
  importChoose: 'Scegli un file',
  importStarted: 'Importazione…',
  importDone: 'Importate {n} pagine',
  importError: 'Importazione non riuscita: {msg}',
  exportStarted: 'Preparo il download…',

  // Stato / salvataggio
  statusSaving: 'Salvataggio…',
  statusSaved: 'Salvato',
  statusSaveError: 'Errore di salvataggio — riprovo al prossimo cambio',
  statusWords: 'parole',
  statusBlocks: 'blocchi',

  // Benvenuto
  welcomeTitle: 'Benvenuto in Taccuino',
  welcomeSubtitle: 'Appunti a blocchi, gratuiti e solo tuoi. Nessun account, nessun lock-in: i tuoi dati restano sempre esportabili.',
  welcomeCta: 'Crea la tua prima pagina',
  welcomeOr: 'oppure',
  welcomeHint: 'premi Ctrl+K per cercare, / per i blocchi',
  welcomeFeature1Title: 'Tuo, davvero',
  welcomeFeature1Body: 'Esporta tutto in Markdown o ZIP quando vuoi. Zero lock-in.',
  welcomeFeature2Title: 'Veloce',
  welcomeFeature2Body: 'Ricerca istantanea e salvataggio automatico, anche su pagine grandi.',
  welcomeFeature3Title: 'Privato',
  welcomeFeature3Body: 'Nessun account, nessun tracciamento, nessun costo nascosto.',

  // Database — toolbar e schema
  dbViewTable: 'Tabella',
  dbViewKanban: 'Kanban',
  dbNewRow: 'Nuova riga',
  dbAddRow: 'Nuova',
  dbColumnName: 'Nome',
  dbAddProperty: 'Aggiungi proprietà',
  dbPropertyName: 'Nome proprietà',
  dbPropertyType: 'Tipo',
  dbAddPropertyCreate: 'Aggiungi',
  dbEmpty: 'Nessuna riga. Creane una con “+ Nuova riga”.',
  dbRowsCount: 'righe',
  dbRowTitleAria: 'Titolo della riga',
  dbRowMenu: 'Azioni riga',
  dbRename: 'Rinomina',
  dbChangeType: 'Cambia tipo',
  dbDeleteProperty: 'Elimina proprietà',
  dbChangeTypeConfirmTitle: 'Cambiare il tipo della proprietà?',
  dbChangeTypeConfirmBody: 'I valori non compatibili con il nuovo tipo verranno rimossi dalle righe.',
  dbDeletePropertyConfirmTitle: 'Eliminare questa proprietà?',
  dbDeletePropertyConfirmBody: 'La colonna e tutti i suoi valori verranno rimossi da tutte le righe.',
  dbDeleteRowConfirmTitle: 'Eliminare questa riga?',
  dbDeleteRowConfirmBody: 'L’azione non può essere annullata.',
  dbRowDeleted: 'Riga eliminata',
  dbTypeText: 'Testo',
  dbTypeNumber: 'Numero',
  dbTypeSelect: 'Selezione',
  dbTypeDate: 'Data',
  dbTypeCheckbox: 'Checkbox',
  dbTypeUrl: 'URL',

  // Database — celle e opzioni
  dbEmptyCell: 'Vuoto',
  dbNewOption: 'Nuova opzione…',
  dbAddOption: 'Aggiungi',
  dbOptionColor: 'Colore dell’opzione',
  dbOpenUrl: 'Apri il link',

  // Database — kanban
  dbKanbanGroupBy: 'Raggruppa per',
  dbKanbanNoSelect: 'Questo database non ha una proprietà di tipo selezione da usare come colonne.',
  dbKanbanCreateSelect: 'Crea proprietà selezione',
  dbNoValue: 'Senza valore',
  dbKanbanOptTodo: 'Da fare',
  dbKanbanOptDoing: 'In corso',
  dbKanbanOptDone: 'Fatto',

  // Copertina
  coverChange: 'Cambia copertina',
  coverRemove: 'Rimuovi copertina',
  coverPick: 'Scegli una copertina',
  coverUrlLabel: 'Oppure incolla l’URL di un’immagine',
  coverUrlPlaceholder: 'https://…',
  coverUrlApply: 'Applica',
  coverUrlInvalid: 'URL immagine non valido',
  coverPageImage: 'Immagine di copertina',

  // Collegamenti (backlink)
  backlinksTitle: 'Collegamenti',
  backlinksNone: 'Nessun collegamento in entrata. Cita questa pagina con [[ … ]].',
  backlinksCountOne: '1 collegamento',
  backlinksCountMany: '{n} collegamenti',

  // Link tra pagine [[…]]
  pageLinkSearch: 'Cerca una pagina da collegare…',
  pageLinkNoResults: 'Nessuna pagina trovata',
  rowBadge: 'riga',

  // Modelli di pagina
  templateDialogTitle: 'Nuova pagina da modello',
  templateDialogDescription: 'Scegli un modello di partenza: potrai modificarlo liberamente dopo la creazione.',
  templateBlankTitle: 'Vuota',
  templateBlankDesc: 'Una pagina bianca, pronta da riempire.',
  templateMeetingTitle: 'Nota riunione',
  templateMeetingDesc: 'Partecipanti, decisioni e azioni da svolgere.',
  templateTasksTitle: 'Attività',
  templateTasksDesc: 'Una checklist pronta con un suggerimento rapido.',
  templateJournalTitle: 'Journal',
  templateJournalDesc: 'Diario della giornata: riflessioni e gratitudine.',
  templateBrainstormTitle: 'Brainstorm',
  templateBrainstormDesc: 'Idee libere, senza filtri.',
  templateDatabaseTitle: 'Database',
  templateDatabaseDesc: 'Tabella con stato, scadenza, spunta e link.',
  templateNameLabel: 'Nome della pagina',
  templateCreate: 'Crea pagina',
  templateCreating: 'Creazione…',

  // Comuni
  cancel: 'Annulla',
  confirm: 'Conferma',
  close: 'Chiudi',
  delete: 'Elimina',
  retry: 'Riprova',
  errorGeneric: 'Si è verificato un errore. Riprova.',
  pageCreated: 'Pagina creata',
  pageDuplicated: 'Pagina duplicata',

  // ---- Funzioni uniche (non in Notion) ----

  // Vista grafo
  graphTitle: 'Vista grafo',
  graphDescription: 'La mappa del workspace: ogni cerchio è una pagina, ogni linea un legame.',
  graphEmpty: 'Non c’è ancora niente da mappare: crea qualche pagina.',
  graphLegendTree: 'Gerarchia (genitore → figlia)',
  graphLegendLink: 'Collegamento [[…]]',
  graphHint: 'Trascina i nodi · rotella per lo zoom · clic per aprire la pagina',
  graphZoomIn: 'Aumenta zoom',
  graphZoomOut: 'Riduci zoom',
  graphZoomReset: 'Reimposta vista',
  graphCounts: '{pages} pagine · {links} collegamenti',
  graphCurrentPage: 'Pagina corrente',

  // Modalità focus
  focusMode: 'Modalità focus',
  focusExit: 'Esci dalla modalità focus',
  focusTypewriter: 'Scrittura centrata',
  focusTypewriterHint: 'Mantiene il cursore al centro dello schermo',
  focusReadingTimeOne: '1 min di lettura',
  focusReadingTimeMany: '{n} min di lettura',
  statsChars: 'caratteri',

  // Pannello struttura
  outlineTitle: 'Struttura',
  outlineEmpty: 'Aggiungi titoli con # per vedere qui l’indice della pagina.',
  outlineAria: 'Indice della pagina',

  // Diff versioni
  diffCompare: 'Confronta',
  diffBack: 'Torna all’elenco',
  diffHeading: 'Differenze con la versione attuale',
  diffSnapshot: 'Snapshot',
  diffCurrent: 'Attuale',
  diffWordsAdded: '+{n} parole',
  diffWordsRemoved: '−{n} parole',
  diffIdentical: 'Nessuna differenza: il contenuto attuale è identico a questa snapshot.',
  diffLegendAdded: 'aggiunta',
  diffLegendRemoved: 'rimossa',

  // Attività di scrittura
  activityTitle: 'Attività di scrittura',
  activityStreakLabel: 'Serie attuale',
  activityStreakDays: '{n} giorni',
  activityStreakOne: '1 giorno',
  activityTodayLabel: 'Parole oggi',
  activityGoalLabel: 'Obiettivo giornaliero',
  activityGoalReached: 'Obiettivo raggiunto!',
  activitySetGoal: 'Imposta obiettivo (parole al giorno)',
  activityLast14: 'Ultimi 14 giorni',
  activityNoData: 'Scrivi qualcosa: le tue parole compariranno qui.',

  // Accento colore
  accentTitle: 'Colore accento',
  accentTerracotta: 'Terracotta',
  accentSage: 'Salvia',
  accentAmber: 'Ambra',
  accentRose: 'Rosa',
  accentViolet: 'Viola',
  accentTeal: 'Teal',

  // Foglio scorciatoie
  shortcutsTitle: 'Scorciatoie da tastiera',
  shortcutsDescription: 'Taccuino si usa tutto dalla tastiera: ecco i comandi principali.',
  shortcutsSearch: 'Cerca pagine e contenuti',
  shortcutsSlash: 'Menu dei blocchi (in un blocco vuoto)',
  shortcutsMarkdown: 'Scorciatoie Markdown: # - [] > ``` ---',
  shortcutsFocus: 'Modalità focus',
  shortcutsGraph: 'Vista grafo',
  shortcutsOutline: 'Pannello struttura',
  shortcutsSheet: 'Questo foglio',
  shortcutsEscape: 'Chiudi finestre / esci dalla modalità focus',
  shortcutsNewBlock: 'Nuovo blocco sotto',
  shortcutsBold: 'Grassetto (selezione)',
  shortcutsItalic: 'Corsivo (selezione)',

  // Tema / lingua
  themeToggle: 'Cambia tema',
  themeLight: 'Chiaro',
  themeDark: 'Scuro',
  langToggle: 'Cambia lingua',

  // Assistente AI
  aiAssistant: 'Assistente AI',
  aiPanelTagline: 'Cerca, crea e organizza le pagine per te',
  aiWelcomeTitle: 'Ciao! Sono l\u2019assistente di Taccuino',
  aiWelcomeBody: 'Posso cercare nei tuoi appunti, creare pagine, scriverci dentro e aprirle. Prova una di queste:',
  aiPlaceholder: 'Chiedi qualcosa o dai un comando…',
  aiSend: 'Invia messaggio',
  aiNewChat: 'Nuova conversazione',
  aiThinking: 'Sta pensando…',
  aiError: 'Assistente non disponibile in questo momento. Riprova più tardi.',
  aiChipCreated: 'Creata',
  aiChipUpdated: 'Aggiornata',
  aiChipOpened: 'Aperta',
  aiSuggestion1: 'Crea una pagina “Brainstorming” con 5 idee di progetti open source',
  aiSuggestion2: 'Riassumi i punti chiave di questa pagina',
  aiSuggestion3: 'Cerca tutte le pagine che parlano di progetti',
  aiSuggestion4: 'Aggiungi una checklist “Prossimi passi” a questa pagina',
  shortcutsAi: 'Apri l\u2019assistente AI',

  // Assistente AI — voce
  aiMicStart: 'Dettatura vocale',
  aiMicStop: 'Ferma la dettatura',
  aiMicUnsupported: 'Dettatura non supportata da questo browser',
  aiMicActive: 'Ti sto ascoltando…',
  aiSpeak: 'Leggi ad alta voce',
  aiStopSpeaking: 'Ferma la lettura',

  // Lettore vocale pagina
  readerTitle: 'Lettore vocale',
  readerPlay: 'Riproduci la pagina',
  readerPause: 'Pausa',
  readerStop: 'Ferma',
  readerPrev: 'Blocco precedente',
  readerNext: 'Blocco successivo',
  readerNoContent: 'Niente da leggere in questa pagina.',
  readerSpeed: 'Velocità di lettura',
  readerHighlightLabel: 'Blocco in lettura',

  // Acquisizione rapida
  quickCaptureTitle: 'Acquisizione rapida',
  quickCaptureDesc: 'Un pensiero, un task, un\u2019idea: finisce nella pagina Inbox, senza interrompere quello che stai facendo.',
  quickCapturePlaceholder: 'Scrivi qui… (Invio per salvare)',
  quickCaptureSend: 'Salva nell\u2019Inbox',
  quickCaptureSaved: 'Salvato nell\u2019Inbox',
  quickCaptureOpen: 'Apri Inbox',
  quickCaptureError: 'Salvataggio non riuscito. Riprova.',
  shortcutsQuickCapture: 'Acquisizione rapida (Inbox)',

  // Timer di concentrazione
  timerTitle: 'Timer di concentrazione',
  timerStart: 'Avvia',
  timerPause: 'Pausa',
  timerReset: 'Azzera',
  timerDone: 'Tempo scaduto! Pausa meritata ☕',
  timerRemaining: 'Tempo rimasto',

  // Accessibilità / footer
  mainContentLabel: 'Contenuto principale',
  footerLicense: 'Open source · AGPL-3.0',
  footerVersion: '0.4',
  skipToContent: 'Salta al contenuto',
} as const

/** Dizionario: stesse chiavi di `it`, valori stringa liberi (le traduzioni differiscono). */
type Dict = { [K in keyof typeof it]: string }

const en: Dict = {
  // App
  appName: 'Taccuino',
  appTagline: 'Block notes — free and truly yours',
  loading: 'Loading…',

  // Sidebar
  search: 'Search',
  searchPlaceholder: 'Search pages and contents…',
  newPage: 'New page',
  pagesSection: 'Pages',
  favoritesSection: 'Favorites',
  trashSection: 'Trash',
  importAction: 'Import (Markdown/ZIP)',
  exportAllAction: 'Export workspace (ZIP)',
  noPagesYet: 'No pages yet. Create one!',
  toggleSidebar: 'Show or hide the sidebar',
  sidebarSectionPages: 'Pages section',

  // Page
  untitled: 'Untitled',
  addIcon: 'Add an icon',
  changeIcon: 'Change icon',
  removeIcon: 'Remove icon',
  pickIcon: 'Pick an icon',
  moreActions: 'More actions',
  favoriteAction: 'Add to favorites',
  unfavoriteAction: 'Remove from favorites',
  duplicateAction: 'Duplicate page',
  exportPageAction: 'Export to Markdown',
  historyAction: 'Version history',
  trashAction: 'Move to trash',
  breadcrumbsRoot: 'Workspace',

  // Editor — placeholders
  placeholderParagraph: 'Start writing, or press / for commands…',
  placeholderHeading1: 'Heading 1',
  placeholderHeading2: 'Heading 2',
  placeholderHeading3: 'Heading 3',
  placeholderBullet: 'List item',
  placeholderNumbered: 'Numbered item',
  placeholderChecklist: 'To-do',
  placeholderQuote: 'Quote',
  placeholderCode: 'Code',
  placeholderCallout: 'Write a note…',
  placeholderImage: 'Add an image',
  placeholderBookmark: 'Paste or type a link…',

  // Editor — "/" menu
  slashMenuTitle: 'Insert a block',
  slashMenuNoResults: 'No blocks found',
  slashBlockText: 'Text',
  slashBlockTextDesc: 'Start writing with plain text.',
  slashBlockH1: 'Heading 1',
  slashBlockH1Desc: 'Big section heading.',
  slashBlockH2: 'Heading 2',
  slashBlockH2Desc: 'Medium section heading.',
  slashBlockH3: 'Heading 3',
  slashBlockH3Desc: 'Small section heading.',
  slashBlockBullet: 'Bulleted list',
  slashBlockBulletDesc: 'Create a simple list.',
  slashBlockNumbered: 'Numbered list',
  slashBlockNumberedDesc: 'Create a numbered list.',
  slashBlockChecklist: 'Checklist',
  slashBlockChecklistDesc: 'Track to-dos.',
  slashBlockQuote: 'Quote',
  slashBlockQuoteDesc: 'Capture a quote.',
  slashBlockCode: 'Code',
  slashBlockCodeDesc: 'Capture a code snippet.',
  slashBlockDivider: 'Divider',
  slashBlockDividerDesc: 'Visually separate blocks.',
  slashBlockCallout: 'Callout',
  slashBlockCalloutDesc: 'Highlight a note.',
  slashBlockImage: 'Image',
  slashBlockImageDesc: 'Upload or link an image.',
  slashBlockBookmark: 'Web bookmark',
  slashBlockBookmarkDesc: 'Save a web link as a card.',

  // Editor — selection toolbar
  toolbarBold: 'Bold',
  toolbarItalic: 'Italic',
  toolbarUnderline: 'Underline',
  toolbarStrike: 'Strikethrough',
  toolbarCode: 'Inline code',
  toolbarLink: 'Link',
  toolbarLinkPrompt: 'Link URL (leave empty to remove)',
  toolbarClear: 'Clear formatting',

  // Editor — block menu (handle)
  blockMenuLabel: 'Block actions',
  blockDuplicate: 'Duplicate',
  blockDelete: 'Delete',
  blockMoveUp: 'Move up',
  blockMoveDown: 'Move down',
  blockAddBelow: 'Add block below',
  blockDragLabel: 'Drag to reorder',

  // Editor — code block
  codeLanguage: 'Language',
  codeCopy: 'Copy',
  codeCopied: 'Copied!',
  codeLangPlain: 'Plain text',

  // Editor — image
  imageUpload: 'Upload an image',
  imageFromUrl: 'From URL…',
  imageUploadTooBig: 'Image too large (4 MB max)',
  imageInvalidType: 'Invalid format: use PNG, JPEG, GIF or WebP',
  imageUploadFailed: 'Upload failed',
  imageCaptionPlaceholder: 'Write a caption…',

  // Editor — callout
  calloutPickEmoji: 'Pick an emoji',
  calloutDefaultIcon: '💡',

  // Search (Ctrl/Cmd+K)
  searchActionsGroup: 'Quick actions',
  searchResultsGroup: 'Pages',
  searchNoResults: 'No results',
  searchNewPage: 'New page',
  searchGoTrash: 'Open trash',
  searchExportZip: 'Export workspace (ZIP)',
  searchImportFile: 'Import Markdown or ZIP',
  searchToggleTheme: 'Toggle light/dark theme',
  searchToggleLang: 'Passa all\u2019italiano',
  searchHint: 'type to search across pages',

  // Version history
  historyTitle: 'Version history',
  historyDescription: 'Automatic snapshots of the content, saved every so often while you write.',
  historyEmpty: 'No versions saved yet. Keep writing: snapshots will appear on their own.',
  historyRestore: 'Restore',
  historyRestoreConfirmTitle: 'Restore this version?',
  historyRestoreConfirmBody: 'The current page content will be replaced with the selected snapshot.',
  historyRestored: 'Version restored',
  historyBlocks: 'blocks',
  historyCurrentLabel: 'saved',

  // Trash
  trashTitle: 'Trash',
  trashDescription: 'Deleted pages stay here until you remove them forever.',
  trashEmpty: 'The trash is empty',
  trashRestore: 'Restore',
  trashDeleteForever: 'Delete forever',
  trashEmptyAll: 'Empty trash',
  trashEmptyConfirmTitle: 'Empty the trash?',
  trashEmptyConfirmBody: 'All pages in the trash will be permanently deleted. This cannot be undone.',
  trashedPage: 'Page moved to trash',
  restoredPage: 'Page restored',
  deletedForever: 'Page deleted forever',
  trashEmptied: 'Trash emptied',

  // Import / export
  importTitle: 'Import into Taccuino',
  importDescription: 'Upload a .md file or a ZIP of Markdown pages (compatible with Notion exports).',
  importChoose: 'Choose a file',
  importStarted: 'Importing…',
  importDone: 'Imported {n} pages',
  importError: 'Import failed: {msg}',
  exportStarted: 'Preparing download…',

  // Status / saving
  statusSaving: 'Saving…',
  statusSaved: 'Saved',
  statusSaveError: 'Save error — will retry on next change',
  statusWords: 'words',
  statusBlocks: 'blocks',

  // Welcome
  welcomeTitle: 'Welcome to Taccuino',
  welcomeSubtitle: 'Block notes — free and truly yours. No account, no lock-in: your data always stays exportable.',
  welcomeCta: 'Create your first page',
  welcomeOr: 'or',
  welcomeHint: 'press Ctrl+K to search, / for blocks',
  welcomeFeature1Title: 'Yours, truly',
  welcomeFeature1Body: 'Export everything to Markdown or ZIP anytime. Zero lock-in.',
  welcomeFeature2Title: 'Fast',
  welcomeFeature2Body: 'Instant search and autosave, even on large pages.',
  welcomeFeature3Title: 'Private',
  welcomeFeature3Body: 'No account, no tracking, no hidden costs.',

  // Database — toolbar and schema
  dbViewTable: 'Table',
  dbViewKanban: 'Kanban',
  dbNewRow: 'New row',
  dbAddRow: 'New',
  dbColumnName: 'Name',
  dbAddProperty: 'Add property',
  dbPropertyName: 'Property name',
  dbPropertyType: 'Type',
  dbAddPropertyCreate: 'Add',
  dbEmpty: 'No rows yet. Create one with “+ New row”.',
  dbRowsCount: 'rows',
  dbRowTitleAria: 'Row title',
  dbRowMenu: 'Row actions',
  dbRename: 'Rename',
  dbChangeType: 'Change type',
  dbDeleteProperty: 'Delete property',
  dbChangeTypeConfirmTitle: 'Change the property type?',
  dbChangeTypeConfirmBody: 'Values incompatible with the new type will be removed from the rows.',
  dbDeletePropertyConfirmTitle: 'Delete this property?',
  dbDeletePropertyConfirmBody: 'The column and all its values will be removed from every row.',
  dbDeleteRowConfirmTitle: 'Delete this row?',
  dbDeleteRowConfirmBody: 'This action cannot be undone.',
  dbRowDeleted: 'Row deleted',
  dbTypeText: 'Text',
  dbTypeNumber: 'Number',
  dbTypeSelect: 'Select',
  dbTypeDate: 'Date',
  dbTypeCheckbox: 'Checkbox',
  dbTypeUrl: 'URL',

  // Database — cells and options
  dbEmptyCell: 'Empty',
  dbNewOption: 'New option…',
  dbAddOption: 'Add',
  dbOptionColor: 'Option color',
  dbOpenUrl: 'Open link',

  // Database — kanban
  dbKanbanGroupBy: 'Group by',
  dbKanbanNoSelect: 'This database has no select property to use as columns.',
  dbKanbanCreateSelect: 'Create select property',
  dbNoValue: 'No value',
  dbKanbanOptTodo: 'To do',
  dbKanbanOptDoing: 'In progress',
  dbKanbanOptDone: 'Done',

  // Cover
  coverChange: 'Change cover',
  coverRemove: 'Remove cover',
  coverPick: 'Pick a cover',
  coverUrlLabel: 'Or paste an image URL',
  coverUrlPlaceholder: 'https://…',
  coverUrlApply: 'Apply',
  coverUrlInvalid: 'Invalid image URL',
  coverPageImage: 'Cover image',

  // Links (backlinks)
  backlinksTitle: 'Links',
  backlinksNone: 'No backlinks yet. Mention this page with [[ … ]].',
  backlinksCountOne: '1 backlink',
  backlinksCountMany: '{n} backlinks',

  // Page links [[…]]
  pageLinkSearch: 'Search for a page to link…',
  pageLinkNoResults: 'No pages found',
  rowBadge: 'row',

  // Page templates
  templateDialogTitle: 'New page from template',
  templateDialogDescription: 'Pick a starting template: you can edit everything after it is created.',
  templateBlankTitle: 'Blank',
  templateBlankDesc: 'An empty page, ready to fill.',
  templateMeetingTitle: 'Meeting notes',
  templateMeetingDesc: 'Attendees, decisions and action items.',
  templateTasksTitle: 'Tasks',
  templateTasksDesc: 'A ready-made checklist with a quick tip.',
  templateJournalTitle: 'Journal',
  templateJournalDesc: 'A daily log: thoughts and gratitude.',
  templateBrainstormTitle: 'Brainstorm',
  templateBrainstormDesc: 'Free-form ideas, no filters.',
  templateDatabaseTitle: 'Database',
  templateDatabaseDesc: 'A table with status, due date, checkbox and link.',
  templateNameLabel: 'Page name',
  templateCreate: 'Create page',
  templateCreating: 'Creating…',

  // Common
  cancel: 'Cancel',
  confirm: 'Confirm',
  close: 'Close',
  delete: 'Delete',
  retry: 'Retry',
  errorGeneric: 'Something went wrong. Please retry.',
  pageCreated: 'Page created',
  pageDuplicated: 'Page duplicated',

  // ---- Unique features (not in Notion) ----

  // Graph view
  graphTitle: 'Graph view',
  graphDescription: 'A map of your workspace: every circle is a page, every line a connection.',
  graphEmpty: 'Nothing to map yet: create a few pages first.',
  graphLegendTree: 'Hierarchy (parent → child)',
  graphLegendLink: '[[…]] link',
  graphHint: 'Drag nodes · scroll to zoom · click to open the page',
  graphZoomIn: 'Zoom in',
  graphZoomOut: 'Zoom out',
  graphZoomReset: 'Reset view',
  graphCounts: '{pages} pages · {links} links',
  graphCurrentPage: 'Current page',

  // Focus mode
  focusMode: 'Focus mode',
  focusExit: 'Exit focus mode',
  focusTypewriter: 'Typewriter scrolling',
  focusTypewriterHint: 'Keeps the caret centered on screen',
  focusReadingTimeOne: '1 min read',
  focusReadingTimeMany: '{n} min read',
  statsChars: 'characters',

  // Outline panel
  outlineTitle: 'Outline',
  outlineEmpty: 'Add headings with # to see the page outline here.',
  outlineAria: 'Page outline',

  // Version diff
  diffCompare: 'Compare',
  diffBack: 'Back to list',
  diffHeading: 'Differences from the current version',
  diffSnapshot: 'Snapshot',
  diffCurrent: 'Current',
  diffWordsAdded: '+{n} words',
  diffWordsRemoved: '−{n} words',
  diffIdentical: 'No differences: the current content is identical to this snapshot.',
  diffLegendAdded: 'added',
  diffLegendRemoved: 'removed',

  // Writing activity
  activityTitle: 'Writing activity',
  activityStreakLabel: 'Current streak',
  activityStreakDays: '{n} days',
  activityStreakOne: '1 day',
  activityTodayLabel: 'Words today',
  activityGoalLabel: 'Daily goal',
  activityGoalReached: 'Goal reached!',
  activitySetGoal: 'Set goal (words per day)',
  activityLast14: 'Last 14 days',
  activityNoData: 'Write something: your words will show up here.',

  // Accent color
  accentTitle: 'Accent color',
  accentTerracotta: 'Terracotta',
  accentSage: 'Sage',
  accentAmber: 'Amber',
  accentRose: 'Rose',
  accentViolet: 'Violet',
  accentTeal: 'Teal',

  // Shortcuts sheet
  shortcutsTitle: 'Keyboard shortcuts',
  shortcutsDescription: 'Taccuino is built to be used entirely from the keyboard.',
  shortcutsSearch: 'Search pages and content',
  shortcutsSlash: 'Block menu (in an empty block)',
  shortcutsMarkdown: 'Markdown shortcuts: # - [] > ``` ---',
  shortcutsFocus: 'Focus mode',
  shortcutsGraph: 'Graph view',
  shortcutsOutline: 'Outline panel',
  shortcutsSheet: 'This sheet',
  shortcutsEscape: 'Close dialogs / exit focus mode',
  shortcutsNewBlock: 'New block below',
  shortcutsBold: 'Bold (selection)',
  shortcutsItalic: 'Italic (selection)',

  // Theme / language
  themeToggle: 'Toggle theme',
  themeLight: 'Light',
  themeDark: 'Dark',
  langToggle: 'Switch language',

  // AI assistant
  aiAssistant: 'AI assistant',
  aiPanelTagline: 'Search, create and organize pages for you',
  aiWelcomeTitle: 'Hi! I\u2019m Taccuino\u2019s assistant',
  aiWelcomeBody: 'I can search your notes, create pages, write into them and open them. Try one of these:',
  aiPlaceholder: 'Ask something or give a command…',
  aiSend: 'Send message',
  aiNewChat: 'New conversation',
  aiThinking: 'Thinking…',
  aiError: 'The assistant is unavailable right now. Please try again later.',
  aiChipCreated: 'Created',
  aiChipUpdated: 'Updated',
  aiChipOpened: 'Opened',
  aiSuggestion1: 'Create a “Brainstorming” page with 5 open source project ideas',
  aiSuggestion2: 'Summarize the key points of this page',
  aiSuggestion3: 'Find all pages that mention projects',
  aiSuggestion4: 'Add a “Next steps” checklist to this page',
  shortcutsAi: 'Open the AI assistant',

  // AI assistant — voice
  aiMicStart: 'Voice dictation',
  aiMicStop: 'Stop dictation',
  aiMicUnsupported: 'Dictation is not supported in this browser',
  aiMicActive: 'Listening…',
  aiSpeak: 'Read aloud',
  aiStopSpeaking: 'Stop reading',

  // Page reader
  readerTitle: 'Read aloud',
  readerPlay: 'Play page',
  readerPause: 'Pause',
  readerStop: 'Stop',
  readerPrev: 'Previous block',
  readerNext: 'Next block',
  readerNoContent: 'Nothing to read on this page.',
  readerSpeed: 'Reading speed',
  readerHighlightLabel: 'Block being read',

  // Quick capture
  quickCaptureTitle: 'Quick capture',
  quickCaptureDesc: 'A thought, a task, an idea: it lands in your Inbox page without interrupting what you are doing.',
  quickCapturePlaceholder: 'Type here… (Enter to save)',
  quickCaptureSend: 'Save to Inbox',
  quickCaptureSaved: 'Saved to Inbox',
  quickCaptureOpen: 'Open Inbox',
  quickCaptureError: 'Could not save. Please try again.',
  shortcutsQuickCapture: 'Quick capture (Inbox)',

  // Focus timer
  timerTitle: 'Focus timer',
  timerStart: 'Start',
  timerPause: 'Pause',
  timerReset: 'Reset',
  timerDone: 'Time\u2019s up! Take a break ☕',
  timerRemaining: 'Time remaining',

  // Accessibility / footer
  mainContentLabel: 'Main content',
  footerLicense: 'Open source · AGPL-3.0',
  footerVersion: '0.4',
  skipToContent: 'Skip to content',
}

export const dictionaries = { it, en }
export type TranslationKey = keyof typeof it

interface LangState {
  lang: Lang
  setLang: (lang: Lang) => void
}

export const useLangStore = create<LangState>()(
  persist(
    (set) => ({
      lang: 'it',
      setLang: (lang) => set({ lang }),
    }),
    { name: 'taccuino-lang' }
  )
)

export function useI18n() {
  const lang = useLangStore((s) => s.lang)
  const setLang = useLangStore((s) => s.setLang)

  const t = useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>): string => {
      let s: string = dictionaries[lang][key] ?? dictionaries.it[key] ?? key
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          s = s.replaceAll(`{${k}}`, String(v))
        }
      }
      return s
    },
    [lang]
  )

  return { lang, setLang, t }
}
