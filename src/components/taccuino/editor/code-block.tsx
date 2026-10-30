'use client'

/**
 * Taccuino — blocco codice.
 *
 * Overlay classico: un <pre> assolutamente posizionato con l'HTML evidenziato
 * (aria-hidden, non interattivo) e sopra una <textarea> trasparente che è la
 * fonte di verità. pre e textarea condividono font/padding/leading/whitespace
 * per l'allineamento perfetto; l'altezza della textarea si adatta al contenuto
 * e lo scroll orizzontale viene replicato sul pre.
 */
import * as React from 'react'
import { Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useI18n } from '@/lib/i18n'
import type { Block } from '@/lib/types'
import type { EditorApi } from './editor-api'
import { highlight } from './highlight'

const LANGUAGES = ['plain', 'javascript', 'typescript', 'python', 'json', 'html', 'css', 'bash', 'markdown'] as const

export function CodeBlock({ block, api }: { block: Block; api: EditorApi }) {
  const { t } = useI18n()
  const taRef = React.useRef<HTMLTextAreaElement>(null)
  const preRef = React.useRef<HTMLPreElement>(null)
  const [copied, setCopied] = React.useState(false)

  React.useLayoutEffect(() => {
    const el = taRef.current
    if (el) api.registerRef(block.id, el)
    return () => api.registerRef(block.id, null)
  }, [api, block.id])

  const autoResize = React.useCallback(() => {
    const el = taRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [])

  React.useEffect(() => {
    autoResize()
  }, [autoResize, block.content])

  const onScroll = () => {
    const ta = taRef.current
    const pre = preRef.current
    if (ta && pre) {
      pre.scrollLeft = ta.scrollLeft
      pre.scrollTop = ta.scrollTop
    }
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget
    if (e.key === 'Tab') {
      // dentro un code block Tab inserisce due spazi (niente indent di blocco)
      e.preventDefault()
      el.setRangeText('  ', el.selectionStart, el.selectionEnd, 'end')
      api.updateBlock(block.id, { content: el.value })
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      api.escapeCode(block.id)
      return
    }
    if (e.key === 'Backspace' && el.selectionStart === 0 && el.selectionEnd === 0) {
      // Backspace con caret all'inizio assoluto: converte in paragraph
      e.preventDefault()
      api.convertFromCode(block.id)
      return
    }
    if (e.key === 'ArrowUp' && !el.value.slice(0, el.selectionStart).includes('\n')) {
      if (api.focusSiblingText(block.id, -1)) e.preventDefault()
      return
    }
    if (e.key === 'ArrowDown' && !el.value.slice(el.selectionEnd).includes('\n')) {
      if (api.focusSiblingText(block.id, 1)) e.preventDefault()
    }
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(block.content)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard non disponibile (contesto non sicuro): silenzioso
    }
  }

  const lang = block.language ?? 'plain'

  return (
    <div className="my-1 rounded-xl border bg-muted/40">
      <div className="flex items-center justify-between gap-2 border-b px-2 py-1.5">
        <Select
          value={lang}
          onValueChange={(v) => api.updateBlock(block.id, { language: v === 'plain' ? undefined : v })}
        >
          <SelectTrigger
            size="sm"
            aria-label={t('codeLanguage')}
            className="h-7 border-none bg-transparent px-2 text-xs shadow-none dark:bg-transparent dark:hover:bg-input/50"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LANGUAGES.map((l) => (
              <SelectItem key={l} value={l} className="text-xs">
                {l === 'plain' ? t('codeLangPlain') : l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={copy}
          title={t('codeCopy')}
          aria-label={t('codeCopy')}
        >
          {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
        </Button>
      </div>
      <div className="relative">
        <pre
          ref={preRef}
          aria-hidden
          className="pointer-events-none absolute inset-0 m-0 overflow-hidden p-4 font-mono text-sm leading-6 whitespace-pre text-foreground"
          dangerouslySetInnerHTML={{ __html: `${highlight(block.content, lang)}\n` }}
        />
        <textarea
          ref={taRef}
          value={block.content}
          rows={1}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          aria-label={t('placeholderCode')}
          onChange={(e) => api.updateBlock(block.id, { content: e.target.value })}
          onKeyDown={onKeyDown}
          onScroll={onScroll}
          className="relative block w-full resize-none overflow-hidden whitespace-pre border-0 bg-transparent p-4 font-mono text-sm leading-6 text-transparent caret-foreground outline-none selection:bg-primary/20"
        />
      </div>
    </div>
  )
}
