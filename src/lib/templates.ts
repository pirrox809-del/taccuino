/**
 * Taccuino — modelli di pagina pronti all'uso.
 * I contenuti demo sono in italiano (lingua primaria dell'app); i blocchi usano
 * solo i 13 tipi esistenti. `databaseProperties` è usato quando kind='database'.
 */
import type { TranslationKey } from './i18n'
import type { Block, DatabaseProperty, PageKind } from './types'

export interface PageTemplate {
  id: string
  icon: string
  titleKey: TranslationKey
  descKey: TranslationKey
  kind?: PageKind
  blocks?: Block[]
  databaseProperties?: DatabaseProperty[]
}

const b = (id: string, type: Block['type'], content: string, extra: Partial<Block> = {}): Block => ({
  id,
  type,
  content,
  ...extra,
})

const MEETING_BLOCKS: Block[] = [
  b('tpl-meet-1', 'heading2', 'Partecipanti'),
  b('tpl-meet-2', 'bullet', ''),
  b('tpl-meet-3', 'bullet', ''),
  b('tpl-meet-4', 'bullet', ''),
  b('tpl-meet-5', 'heading2', 'Decisioni'),
  b('tpl-meet-6', 'bullet', ''),
  b('tpl-meet-7', 'bullet', ''),
  b('tpl-meet-8', 'heading2', 'Azioni'),
  b('tpl-meet-9', 'checklist', '', { checked: false }),
  b('tpl-meet-10', 'checklist', '', { checked: false }),
  b('tpl-meet-11', 'checklist', '', { checked: false }),
]

const TASKS_BLOCKS: Block[] = [
  b('tpl-task-1', 'checklist', 'Preparare la scaletta', { checked: true }),
  b('tpl-task-2', 'checklist', '', { checked: false }),
  b('tpl-task-3', 'checklist', '', { checked: false }),
  b('tpl-task-4', 'checklist', '', { checked: false }),
  b('tpl-task-5', 'checklist', '', { checked: false }),
  b('tpl-task-6', 'callout', 'Suggerimento: usa ⋮⋮ a sinistra di un blocco per trascinarlo, duplicarlo o eliminarlo.', {
    icon: '💡',
  }),
]

const JOURNAL_BLOCKS: Block[] = [
  b('tpl-journal-1', 'heading3', 'Oggi'),
  b('tpl-journal-2', 'paragraph', 'Com\u2019è andata la giornata? Raccontala in tre righe.'),
  b('tpl-journal-3', 'quote', '“Non serve essere perfetti, solo presenti.”'),
  b('tpl-journal-4', 'checklist', 'Gratitudine: una cosa di cui sei grato/a', { checked: false }),
  b('tpl-journal-5', 'checklist', '', { checked: false }),
  b('tpl-journal-6', 'checklist', '', { checked: false }),
]

const BRAINSTORM_BLOCKS: Block[] = [
  b('tpl-brain-1', 'callout', 'Scrivi tutte le idee che ti vengono, anche quelle strane: la quantità prima della qualità.', {
    icon: '🧠',
  }),
  b('tpl-brain-2', 'bullet', ''),
  b('tpl-brain-3', 'bullet', ''),
  b('tpl-brain-4', 'bullet', ''),
  b('tpl-brain-5', 'bullet', ''),
  b('tpl-brain-6', 'bullet', ''),
  b('tpl-brain-7', 'bullet', ''),
]

export const DATABASE_TEMPLATE_PROPERTIES: DatabaseProperty[] = [
  {
    id: 'tpl-db-prop-stato',
    name: 'Stato',
    type: 'select',
    options: [
      { id: 'tpl-db-opt-todo', label: 'Da fare', color: 'gray' },
      { id: 'tpl-db-opt-doing', label: 'In corso', color: 'orange' },
      { id: 'tpl-db-opt-done', label: 'Fatto', color: 'green' },
    ],
  },
  { id: 'tpl-db-prop-scadenza', name: 'Scadenza', type: 'date' },
  { id: 'tpl-db-prop-fatto', name: 'Fatto', type: 'checkbox' },
  { id: 'tpl-db-prop-link', name: 'Link', type: 'url' },
]

export const PAGE_TEMPLATES: PageTemplate[] = [
  {
    id: 'blank',
    icon: '📄',
    titleKey: 'templateBlankTitle',
    descKey: 'templateBlankDesc',
  },
  {
    id: 'meeting',
    icon: '📝',
    titleKey: 'templateMeetingTitle',
    descKey: 'templateMeetingDesc',
    blocks: MEETING_BLOCKS,
  },
  {
    id: 'tasks',
    icon: '✅',
    titleKey: 'templateTasksTitle',
    descKey: 'templateTasksDesc',
    blocks: TASKS_BLOCKS,
  },
  {
    id: 'journal',
    icon: '📓',
    titleKey: 'templateJournalTitle',
    descKey: 'templateJournalDesc',
    blocks: JOURNAL_BLOCKS,
  },
  {
    id: 'brainstorm',
    icon: '🧠',
    titleKey: 'templateBrainstormTitle',
    descKey: 'templateBrainstormDesc',
    blocks: BRAINSTORM_BLOCKS,
  },
  {
    id: 'database',
    icon: '📊',
    titleKey: 'templateDatabaseTitle',
    descKey: 'templateDatabaseDesc',
    kind: 'database',
    databaseProperties: DATABASE_TEMPLATE_PROPERTIES,
  },
]
