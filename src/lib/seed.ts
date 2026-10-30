/**
 * Taccuino — first-run workspace seed (English demo content).
 */
import { db } from '@/lib/db'
import { blockToRowData } from '@/lib/blocks-db'
import { Block, BlockType } from '@/lib/types'

function b(type: BlockType, content: string, extra: Partial<Block> = {}): Block {
  return { id: crypto.randomUUID(), type, content, checked: false, indent: 0, ...extra }
}

const welcomeBlocks: Block[] = [
  b(
    'paragraph',
    'Welcome to <strong>Taccuino</strong>, your block-based notebook: write, organize and find your ideas back without the fluff. Use <em>inline formatting</em>, trigger commands like <code>Ctrl+K</code>, and link external resources like the <a href="https://github.com" rel="noopener noreferrer nofollow" target="_blank">GitHub home page</a>.',
  ),
  b('heading2', 'Why Taccuino'),
  b('bullet', '<strong>Your data</strong>: notes stay on your device and can always be exported to Markdown or ZIP.'),
  b('bullet', '<strong>Free</strong>: open source project, no subscriptions and no artificial limits.'),
  b('bullet', '<strong>Privacy</strong>: no account required, no tracking.'),
  b('heading2', 'Try it right now'),
  b('numbered', 'Type something on an empty line: it already is a paragraph.'),
  b('numbered', 'Press <code>/</code> on a line to open the block menu.'),
  b('numbered', 'Press <code>Ctrl+K</code> to search across all pages.'),
  b('checklist', 'Create your first page', { checked: false }),
  b('checklist', 'Tick an item in a checklist', { checked: true }),
  b('checklist', 'Export a page to Markdown', { checked: false }),
  b('quote', 'Writing an idea down is like planting a seed: sooner or later it grows into a tree of thoughts.'),
  b(
    'callout',
    'Drag the handle on the left of a block to reorder it, or hold <code>Shift</code> to select several at once.',
    { icon: '💡' },
  ),
  b('heading2', 'A bit of code'),
  b(
    'code',
    `export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\\u0300-\\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}`,
    { language: 'typescript' },
  ),
  b('divider', ''),
  b('bookmark', '', { url: 'https://github.com/topics/local-first' }),
]

const guideBlocks: Block[] = [
  b('paragraph', 'All the essential shortcuts to move fast between blocks.'),
  b('bullet', '<code>Ctrl+K</code>: global search across pages.'),
  b('bullet', '<code>/</code>: block menu on the current line.'),
  b(
    'bullet',
    'At the start of a line: <code>#</code> heading, <code>-</code> list, <code>[]</code> checklist, <code>&gt;</code> quote.',
  ),
  b('bullet', '<code>Tab</code> and <code>Shift+Tab</code>: indent or outdent the block.'),
  b('bullet', 'Three backticks in a row open a code block, <code>---</code> a divider line.'),
  b('checklist', 'Turn a paragraph into a quote with <code>&gt;</code>', { checked: true }),
  b('checklist', 'Search for a word with <code>Ctrl+K</code>', { checked: false }),
  b('checklist', 'Export the whole workspace to a single ZIP', { checked: false }),
]

const projectBlocks: Block[] = [
  b('paragraph', 'The log of work in progress: goals, roadmap and ideas to grow Taccuino, one phase at a time.'),
]

const roadmapBlocks: Block[] = [
  b('checklist', '<strong>Phase 0 — Foundations</strong>: block editor and local persistence', { checked: true }),
  b('checklist', '<strong>Phase 1 — MVP</strong>: pages, search, versions and trash', { checked: true }),
  b('checklist', '<strong>Phase 2 — Databases & Notion import</strong>: databases with table/kanban views, [[page]] links with backlinks, templates and covers, ZIP Markdown/CSV import', { checked: true }),
  b('checklist', '<strong>Phase 3 — AI</strong>: semantic search and automatic summaries', { checked: false }),
  b('checklist', '<strong>Phase 4 — Sync</strong>: end-to-end encrypted sync between devices', { checked: false }),
  b('checklist', '<strong>Phase 5 — Collaboration</strong>: shared pages and comments', { checked: false }),
  b('checklist', '<strong>Phase 6 — Desktop</strong>: native app with auto updates', { checked: false }),
]

const ideasBlocks: Block[] = [
  b('bullet', 'Direct import from Notion and Evernote.'),
  b('bullet', 'Kanban view for project pages.'),
  b('bullet', 'Backlinks and graph of connections between pages.'),
  b('bullet', 'Light/dark themes and focus mode.'),
  b('bullet', 'Offline PWA: Taccuino always at your fingertips.'),
]

// Demo database of the seed
const readingDbProperties = [
  {
    id: 'stato',
    name: 'Status',
    type: 'select',
    options: [
      { id: 'da-leggere', label: 'To read', color: 'gray' },
      { id: 'in-lettura', label: 'Reading', color: 'orange' },
      { id: 'letto', label: 'Finished', color: 'green' },
    ],
  },
  { id: 'voto', name: 'Rating', type: 'number' },
  { id: 'autore', name: 'Author', type: 'text' },
  { id: 'finito-il', name: 'Finished on', type: 'date' },
  { id: 'consigliato', name: 'Recommended', type: 'checkbox' },
] as const

const readingRows: Array<{ title: string; icon: string | null; properties: Record<string, unknown> }> = [
  { title: 'The Name of the Rose', icon: '🌹', properties: { stato: 'letto', voto: 5, autore: 'Umberto Eco', 'finito-il': '2026-03-14', consigliato: true } },
  { title: 'Foundation', icon: '🤖', properties: { stato: 'letto', voto: 4, autore: 'Isaac Asimov', 'finito-il': '2026-05-02', consigliato: true } },
  { title: "Zeno's Conscience", icon: '🐛', properties: { stato: 'in-lettura', voto: null, autore: 'Italo Svevo', 'finito-il': null, consigliato: false } },
  { title: 'Dune', icon: '🏜', properties: { stato: 'da-leggere', voto: null, autore: 'Frank Herbert', 'finito-il': null, consigliato: true } },
]

let inflight: Promise<void> | null = null

/**
 * Esegue il seed solo se il database non contiene pagine (count === 0).
 * Il controllo avviene a ogni chiamata; un'eventuale semina già in corso viene
 * attesa, per non creare doppioni su richieste simultanee. Se la semina
 * fallisce, verrà ritentata alla prossima chiamata.
 */
export function seedIfEmpty(): Promise<void> {
  return (async () => {
    const count = await db.page.count()
    if (count > 0) return
    if (inflight) return inflight
    inflight = runSeed().finally(() => {
      inflight = null
    })
    return inflight
  })()
}

async function runSeed(): Promise<void> {
  await db.$transaction(async (tx) => {
    const welcome = await tx.page.create({
      data: {
        title: 'Welcome to Taccuino',
        icon: '📒',
        position: 0,
        blocks: { create: welcomeBlocks.map((block, i) => blockToRowData(block, i)) },
      },
    })
    const guida = await tx.page.create({
      data: {
        title: 'Quick guide',
        icon: '⚡',
        position: 1,
        blocks: { create: guideBlocks.map((block, i) => blockToRowData(block, i)) },
      },
    })
    const progetto = await tx.page.create({
      data: {
        title: 'Project',
        icon: '🗂',
        position: 2,
        blocks: { create: projectBlocks.map((block, i) => blockToRowData(block, i)) },
      },
    })
    const roadmap = await tx.page.create({
      data: {
        title: 'Roadmap',
        icon: '🗺',
        parentId: progetto.id,
        position: 0,
        blocks: { create: roadmapBlocks.map((block, i) => blockToRowData(block, i)) },
      },
    })
    await tx.page.create({
      data: {
        title: 'Ideas',
        icon: '💡',
        parentId: progetto.id,
        position: 1,
        blocks: { create: ideasBlocks.map((block, i) => blockToRowData(block, i)) },
      },
    })
    await tx.page.create({
      data: {
        title: 'Reading list 2026',
        icon: '📚',
        position: 3,
        kind: 'database',
        database: {
          create: {
            properties: JSON.stringify(readingDbProperties),
            rows: {
              create: readingRows.map((row, i) => ({
                title: row.title,
                icon: row.icon,
                properties: JSON.stringify(row.properties),
                position: i,
              })),
            },
          },
        },
      },
    })

    // [[…]] links between demo pages: they enrich the graph view and backlinks
    const pageLink = (id: string, label: string) =>
      `<a data-page-id="${id}" href="#" class="page-link">${label}</a>`
    await tx.block.updateMany({
      where: { pageId: welcome.id, position: 0 },
      data: {
        content: `${welcomeBlocks[0].content} Shortcuts are summarized in the ${pageLink(guida.id, 'Quick guide')}, while goals and work status live in the ${pageLink(progetto.id, 'Project')} page.`,
      },
    })
    await tx.block.create({
      data: {
        ...blockToRowData(
          b('paragraph', `From here you can go back to the ${pageLink(welcome.id, 'welcome page')} or browse the project ideas.`),
          roadmapBlocks.length
        ),
        pageId: roadmap.id,
      },
    })
  })
}
