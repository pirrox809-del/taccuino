'use client'

/**
 * Taccuino — renderizzazione di un singolo blocco (13 tipi).
 *
 * Il componente è React.memo: PageEditor gli passa props stabili (api di
 * identità costante, oggetto block sostituito solo per modifiche strutturali),
 * quindi un keystroke su un blocco non ri-renderizza mai gli altri.
 * I blocchi testuali sono `div[contenteditable]` NON controllati: il contenuto
 * viene scritto imperativamente solo a mount, al cambio tipo, o quando la prop
 * diverge dall'innerHTML e l'elemento non è focalizzato (mai durante la
 * digitazione, per non distruggere il caret).
 */
import * as React from 'react'
import {
  ArrowDown,
  ArrowUp,
  Copy,
  GripVertical,
  Link2,
  Loader2,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useI18n, type TranslationKey } from '@/lib/i18n'
import type { Block, BlockType } from '@/lib/types'
import { cn } from '@/lib/utils'
import { CodeBlock } from './code-block'
import type { EditorApi, ImageStatus, TextBlockType } from './editor-api'
import { EmojiPicker } from './emoji-picker'
import { updateEmptyState } from './dom'
import { TEXT_TYPES } from './editor-api'

const PLACEHOLDER_KEY: Record<TextBlockType, TranslationKey> = {
  paragraph: 'placeholderParagraph',
  heading1: 'placeholderHeading1',
  heading2: 'placeholderHeading2',
  heading3: 'placeholderHeading3',
  bullet: 'placeholderBullet',
  numbered: 'placeholderNumbered',
  checklist: 'placeholderChecklist',
  quote: 'placeholderQuote',
  callout: 'placeholderCallout',
}

const ARIA_KEY: Record<TextBlockType, TranslationKey> = {
  paragraph: 'slashBlockText',
  heading1: 'slashBlockH1',
  heading2: 'slashBlockH2',
  heading3: 'slashBlockH3',
  bullet: 'slashBlockBullet',
  numbered: 'slashBlockNumbered',
  checklist: 'slashBlockChecklist',
  quote: 'slashBlockQuote',
  callout: 'slashBlockCallout',
}

const EDITABLE_BASE = 'min-w-0 flex-1 whitespace-pre-wrap break-words outline-none'

/** Props comuni dei div editabili dei blocchi testuali (inclusi gli attributi data-*). */
type EditableDivProps = React.ComponentPropsWithoutRef<'div'> & {
  'data-editable'?: string
  'data-placeholder'?: string
  ref?: React.Ref<HTMLDivElement>
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

function plainText(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim()
}

function isTextBlockType(type: BlockType): type is TextBlockType {
  return (TEXT_TYPES as readonly BlockType[]).includes(type)
}

export interface BlockItemProps {
  block: Block
  /** Numero calcolato da PageEditor per i blocchi `numbered`. */
  number?: number
  api: EditorApi
  imageStatus?: ImageStatus
}

function BlockItemImpl({ block, number, api, imageStatus }: BlockItemProps) {
  const { t } = useI18n()
  const textRef = React.useRef<HTMLDivElement | null>(null)
  const captionRef = React.useRef<HTMLDivElement | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)
  const prevTypeRef = React.useRef<BlockType | null>(null)

  // Registro del contenitore editabile principale (focus senza rimontaggi).
  // Ref callback: React la invoca a ogni mount/unmount dell'elemento, così la
  // mappa in PageEditor resta sempre allineata al DOM reale (niente riferimenti
  // stantii dopo ristrutturazioni dell'albero, es. conversione di tipo).
  const registerTextRef = React.useCallback(
    (el: HTMLDivElement | null) => {
      textRef.current = el
      if (el) api.registerRef(block.id, el)
      else api.registerRef(block.id, null)
    },
    [api, block.id]
  )

  // Sync imperativa del contenuto testuale: (a) mount, (b) cambio tipo,
  // (c) prop ≠ innerHTML con elemento non focalizzato. Mai durante la digitazione.
  React.useLayoutEffect(() => {
    const el = textRef.current
    if (!el) return
    const prev = prevTypeRef.current
    prevTypeRef.current = block.type
    const typeChanged = prev !== null && prev !== block.type
    if (el.innerHTML !== block.content && (document.activeElement !== el || typeChanged)) {
      el.innerHTML = block.content
    }
    updateEmptyState(el)
  })

  // Sync della didascalia immagine (stessa strategia non controllata).
  React.useLayoutEffect(() => {
    const el = captionRef.current
    if (!el) return
    const html = block.caption ?? ''
    if (el.innerHTML !== html && document.activeElement !== el) {
      el.innerHTML = html
    }
    updateEmptyState(el)
  })

  // ---------------------------------------------------------------------------
  // Gestori
  // ---------------------------------------------------------------------------

  const onInputText = () => {
    const el = textRef.current
    if (el) api.handleInput(el, block)
  }

  const onKeyDownText = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const el = textRef.current
    if (el) api.handleKeyDown(e, block, el)
  }

  const onPasteText = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const el = textRef.current
    if (el) api.handlePaste(e, block, el)
  }

  const onPasteCaption = (e: React.ClipboardEvent<HTMLDivElement>) => {
    // anche nella didascalia: mai HTML grezzo negli editabili
    e.preventDefault()
    const text = e.clipboardData?.getData('text/plain') ?? ''
    if (text) document.execCommand('insertText', false, text)
  }

  const onInputCaption = (e: React.FormEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    updateEmptyState(el)
    api.updateBlock(block.id, { caption: el.innerHTML })
  }

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    const types = Array.from(e.dataTransfer?.types ?? [])
    if (!types.includes('text/block-id') && !types.includes('Files')) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const rect = e.currentTarget.getBoundingClientRect()
    const pos: 'before' | 'after' = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
    api.setDrop({ id: block.id, pos })
  }

  const onHandleDragStart = (e: React.DragEvent<HTMLButtonElement>) => {
    e.dataTransfer.setData('text/block-id', block.id)
    e.dataTransfer.effectAllowed = 'move'
    api.dragStart(block.id)
  }

  // Enter su blocchi non testuali (es. divider focalizzato) → paragraph dopo.
  const onRootKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Enter') return
    const target = e.target as HTMLElement
    if (target.closest('button, a, input, textarea, [contenteditable]')) return
    e.preventDefault()
    api.insertAfter(block.id, { type: 'paragraph', content: '' })
  }

  const promptImageUrl = () => {
    const url = window.prompt(t('toolbarLinkPrompt'))
    if (url === null) return
    const trimmed = url.trim()
    if (trimmed === '') return
    if (!/^(https?:\/\/|\/|data:image\/)/i.test(trimmed)) return
    api.updateBlock(block.id, { url: trimmed })
  }

  const promptBookmarkUrl = () => {
    const url = window.prompt(t('toolbarLinkPrompt'))
    if (url === null) return
    const trimmed = url.trim()
    if (!/^https?:\/\//i.test(trimmed)) return
    api.updateBlock(block.id, { url: trimmed })
  }

  // ---------------------------------------------------------------------------
  // Props del div editabile, per i tipi testuali
  // ---------------------------------------------------------------------------

  const editableProps = (extraClass?: string): EditableDivProps => {
    const type: TextBlockType = isTextBlockType(block.type) ? block.type : 'paragraph'
    return {
      ref: registerTextRef,
      contentEditable: true,
      suppressContentEditableWarning: true,
      role: 'textbox',
      'aria-multiline': true,
      'aria-label': t(ARIA_KEY[type]),
      'data-editable': 'text',
      'data-placeholder': t(PLACEHOLDER_KEY[type]),
      className: cn(EDITABLE_BASE, extraClass),
      onInput: onInputText,
      onKeyDown: onKeyDownText,
      onPaste: onPasteText,
      onBlur: () => api.handleBlur(block),
    }
  }

  // ---------------------------------------------------------------------------
  // Contenuto per tipo
  // ---------------------------------------------------------------------------

  let content: React.ReactNode

  switch (block.type) {
    case 'paragraph':
      content = <div {...editableProps('py-0.5 leading-7')} />
      break
    case 'heading1':
      content = <div {...editableProps('mt-8 text-3xl font-bold tracking-tight')} />
      break
    case 'heading2':
      content = <div {...editableProps('mt-6 text-2xl font-semibold tracking-tight')} />
      break
    case 'heading3':
      content = <div {...editableProps('mt-4 text-xl font-semibold tracking-tight')} />
      break
    case 'bullet':
      content = (
        <div className="flex items-start">
          <span aria-hidden className="w-6 shrink-0 select-none leading-7 text-muted-foreground">
            •
          </span>
          <div {...editableProps('py-0.5 leading-7')} />
        </div>
      )
      break
    case 'numbered':
      content = (
        <div className="flex items-start">
          <span aria-hidden className="w-6 shrink-0 select-none leading-7 text-muted-foreground">
            {number ?? 1}.
          </span>
          <div {...editableProps('py-0.5 leading-7')} />
        </div>
      )
      break
    case 'checklist':
      content = (
        <div className="flex items-start">
          <span className="w-6 shrink-0 pt-1.5" onMouseDown={(e) => e.preventDefault()}>
            <Checkbox
              checked={block.checked ?? false}
              onCheckedChange={() => api.toggleCheck(block.id)}
              aria-label={t('slashBlockChecklist')}
              className="size-4"
            />
          </span>
          <div
            {...editableProps(
              cn('py-0.5 leading-7', block.checked && 'text-muted-foreground line-through')
            )}
          />
        </div>
      )
      break
    case 'quote':
      content = (
        <div
          {...editableProps(
            'border-l-4 border-border py-0.5 pl-4 italic leading-7 text-muted-foreground'
          )}
        />
      )
      break
    case 'code':
      content = <CodeBlock block={block} api={api} />
      break
    case 'divider':
      content = (
        <hr
          role="separator"
          tabIndex={0}
          onClick={(e) => e.currentTarget.focus()}
          className="my-4 cursor-default rounded border-border outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        />
      )
      break
    case 'callout':
      content = (
        <div className="flex items-start gap-3 rounded-xl bg-amber-500/10 p-4">
          <EmojiPicker
            value={block.icon ?? null}
            onPick={(emoji) => api.updateBlock(block.id, { icon: emoji ?? undefined })}
            align="start"
          >
            <button
              type="button"
              title={t('calloutPickEmoji')}
              aria-label={t('calloutPickEmoji')}
              className="mt-0.5 shrink-0 cursor-pointer rounded-md px-1 text-lg leading-7 hover:ring-1 hover:ring-ring focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {block.icon ?? t('calloutDefaultIcon')}
            </button>
          </EmojiPicker>
          <div {...editableProps('py-0.5 leading-7')} />
        </div>
      )
      break
    case 'image':
      content = block.url ? (
        <figure className="flex flex-col items-start gap-1">
          <img
            src={block.url}
            alt={plainText(block.caption ?? '')}
            className="max-h-[480px] w-auto max-w-full rounded-xl"
          />
          <div
            ref={captionRef}
            contentEditable
            suppressContentEditableWarning
            role="textbox"
            aria-label={t('imageCaptionPlaceholder')}
            data-editable="caption"
            data-placeholder={t('imageCaptionPlaceholder')}
            className="relative min-h-6 w-full whitespace-pre-wrap break-words text-sm text-muted-foreground outline-none"
            onInput={onInputCaption}
            onKeyDown={(e) => api.handleCaptionKeyDown(e, block)}
            onPaste={onPasteCaption}
          />
        </figure>
      ) : (
        <div className="flex flex-col gap-2 rounded-xl border border-dashed p-4">
          {imageStatus?.uploading ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              {t('imageUpload')}…
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="size-4" aria-hidden />
                {t('imageUpload')}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={promptImageUrl}>
                <Link2 className="size-4" aria-hidden />
                {t('imageFromUrl')}
              </Button>
            </div>
          )}
          {imageStatus?.error ? <p className="text-sm text-destructive">{t(imageStatus.error)}</p> : null}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.currentTarget.files?.[0]
              e.currentTarget.value = ''
              if (file) api.uploadImage(file, block.id, 'card')
            }}
          />
        </div>
      )
      break
    case 'bookmark':
      content = block.url ? (
        <a
          href={block.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-xl border p-3 transition-colors hover:bg-accent"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent">
            <Link2 className="size-4 text-muted-foreground" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block font-semibold text-foreground">{domainOf(block.url)}</span>
            <span className="block break-all text-sm text-muted-foreground">{block.url}</span>
          </span>
        </a>
      ) : (
        <button
          type="button"
          onClick={promptBookmarkUrl}
          className="flex w-full cursor-pointer items-center gap-3 rounded-xl border p-3 text-left transition-colors hover:bg-accent"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent">
            <Link2 className="size-4 text-muted-foreground" aria-hidden />
          </span>
          <span className="truncate text-muted-foreground">{t('placeholderBookmark')}</span>
        </button>
      )
      break
  }

  return (
    <div
      data-block-id={block.id}
      className="group relative"
      style={{ paddingLeft: (block.indent ?? 0) * 24 }}
      onDragOver={onDragOver}
      onKeyDown={onRootKeyDown}
    >
      {/* Controlli blocco (solo desktop, visibili in hover/focus) */}
      <div className="absolute -left-14 top-0.5 hidden items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 md:flex">
        <button
          type="button"
          title={t('blockAddBelow')}
          aria-label={t('blockAddBelow')}
          onClick={() => api.insertAfter(block.id, { type: 'paragraph', content: '' })}
          className="flex size-6 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <Plus className="size-4" aria-hidden />
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              draggable
              onDragStart={onHandleDragStart}
              onDragEnd={() => api.dragEnd()}
              title={t('blockDragLabel')}
              aria-label={t('blockMenuLabel')}
              className="flex size-6 cursor-grab items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring active:cursor-grabbing"
            >
              <GripVertical className="size-4" aria-hidden />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-44">
            <DropdownMenuItem onClick={() => api.duplicateBlock(block.id)}>
              <Copy className="size-4" aria-hidden />
              {t('blockDuplicate')}
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={() => api.removeBlock(block.id)}>
              <Trash2 className="size-4" aria-hidden />
              {t('blockDelete')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => api.moveBlock(block.id, -1)}>
              <ArrowUp className="size-4" aria-hidden />
              {t('blockMoveUp')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => api.moveBlock(block.id, 1)}>
              <ArrowDown className="size-4" aria-hidden />
              {t('blockMoveDown')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {content}
    </div>
  )
}

/** Memo: la lista re-renderizza solo per operazioni strutturali. */
export const BlockItem = React.memo(BlockItemImpl)
