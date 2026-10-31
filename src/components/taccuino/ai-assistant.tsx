'use client'

/**
 * Taccuino — Assistente AI (pannello laterale).
 * Chat con accesso agli strumenti del workspace: l'assistente può cercare,
 * leggere, creare, modificare e aprire pagine. La cronologia resta in
 * localStorage: local-first, come il resto dell'app.
 */
import * as React from 'react'
import { ArrowUp, Eraser, FilePen, FilePlus2, Mic, Square, SquareArrowOutUpRight, Sparkles, Volume2 } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Riconoscimento vocale (Web Speech API): tipi minimi, nessuna dipendenza.
// ---------------------------------------------------------------------------
interface SpeechRecognitionAlternativeLike {
  transcript: string
}
interface SpeechRecognitionResultLike {
  0: SpeechRecognitionAlternativeLike
  isFinal: boolean
}
interface SpeechRecognitionEventLike {
  resultIndex: number
  results: { length: number; [index: number]: SpeechRecognitionResultLike }
}
interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  start(): void
  stop(): void
  abort(): void
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

/** Azione eseguita dall'assistente sull'interfaccia. */
export interface UiAction {
  type: 'open' | 'created' | 'updated'
  pageId: string
  title?: string
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  actions?: UiAction[]
}

export interface AiAssistantProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentPage: { id: string; title: string } | null
  onOpenPage: (pageId: string) => void
  onPagesChanged: () => void
}

const STORAGE_KEY = 'taccuino-ai-chat-v1'
const MAX_STORED_MESSAGES = 40
const MAX_SENT_MESSAGES = 12

function loadHistory(): ChatMessage[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (m): m is ChatMessage =>
        typeof m === 'object' &&
        m !== null &&
        'role' in m &&
        'content' in m &&
        (m.role === 'user' || m.role === 'assistant') &&
        typeof m.content === 'string'
    )
  } catch {
    return []
  }
}

function ActionChip({ action, label }: { action: UiAction; label: string }) {
  const Icon = action.type === 'created' ? FilePlus2 : action.type === 'updated' ? FilePen : SquareArrowOutUpRight
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-[11px] text-muted-foreground">
      <Icon className="size-3 shrink-0" aria-hidden />
      <span className="truncate">{label}</span>
    </span>
  )
}

export function AiAssistant({ open, onOpenChange, currentPage, onOpenPage, onPagesChanged }: AiAssistantProps) {
  const { t, lang } = useI18n()
  const [messages, setMessages] = React.useState<ChatMessage[]>([])
  const [input, setInput] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [listening, setListening] = React.useState(false)
  const [speakingIndex, setSpeakingIndex] = React.useState<number | null>(null)
  const [sttSupported] = React.useState(() => getSpeechRecognition() !== null)
  const listRef = React.useRef<HTMLDivElement | null>(null)
  const recognitionRef = React.useRef<SpeechRecognitionLike | null>(null)
  const loadedRef = React.useRef(false)

  // ---- cronologia: caricamento una tantum + persistenza locale ----
  React.useEffect(() => {
    if (loadedRef.current) return
    loadedRef.current = true
    setMessages(loadHistory())
  }, [])

  React.useEffect(() => {
    if (!loadedRef.current) return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_STORED_MESSAGES)))
    } catch {
      // storage pieno o non disponibile: la chat vive solo in memoria
    }
  }, [messages])

  // ---- auto-scroll in fondo ----
  React.useEffect(() => {
    const list = listRef.current
    if (list) list.scrollTop = list.scrollHeight
  }, [messages, loading])

  // ---- voce: pulizia alla chiusura del pannello e allo smontaggio ----
  const stopListening = React.useCallback(() => {
    recognitionRef.current?.stop()
    recognitionRef.current = null
    setListening(false)
  }, [])

  const stopSpeaking = React.useCallback(() => {
    window.speechSynthesis?.cancel()
    setSpeakingIndex(null)
  }, [])

  React.useEffect(() => {
    if (open) return
    stopListening()
    stopSpeaking()
  }, [open, stopListening, stopSpeaking])

  React.useEffect(
    () => () => {
      recognitionRef.current?.abort()
      window.speechSynthesis?.cancel()
    },
    []
  )

  const startListening = React.useCallback(() => {
    const Ctor = getSpeechRecognition()
    if (!Ctor || loading) return
    window.speechSynthesis?.cancel() // il microfono non deve ascoltare la sintesi vocale
    setSpeakingIndex(null)
    const recognition = new Ctor()
    recognition.lang = lang === 'it' ? 'it-IT' : 'en-US'
    recognition.continuous = false
    recognition.interimResults = true
    let finalText = ''
    recognition.onresult = (event) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        const text = result[0]?.transcript ?? ''
        if (result.isFinal) finalText += text
        else interim += text
      }
      setInput((finalText + interim).replace(/^\s+/, ''))
    }
    recognition.onend = () => {
      recognitionRef.current = null
      setListening(false)
    }
    recognition.onerror = () => {
      recognitionRef.current = null
      setListening(false)
    }
    recognitionRef.current = recognition
    setListening(true)
    try {
      recognition.start()
    } catch {
      recognitionRef.current = null
      setListening(false)
    }
  }, [lang, loading])

  const send = React.useCallback(
    async (text: string) => {
      const content = text.trim()
      if (!content || loading) return

      const userMessage: ChatMessage = { role: 'user', content }
      const sentMessages = [...messages, userMessage].slice(-MAX_SENT_MESSAGES)
      setMessages((prev) => [...prev, userMessage])
      setInput('')
      setLoading(true)

      try {
        const res = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: sentMessages.map((m) => ({ role: m.role, content: m.content })),
            locale: lang,
            currentPageId: currentPage?.id ?? null,
          }),
        })
        const data: { reply?: string; actions?: UiAction[]; error?: string } = await res.json().catch(() => ({}))

        if (!res.ok || typeof data.reply !== 'string') {
          setMessages((prev) => [...prev, { role: 'assistant', content: t('aiError') }])
          return
        }

        const actions = Array.isArray(data.actions) ? data.actions : []
        setMessages((prev) => [...prev, { role: 'assistant', content: data.reply as string, actions }])

        // applica le azioni all'interfaccia: apri le pagine toccate, aggiorna la sidebar
        let touchedWorkspace = false
        for (const action of actions) {
          if (action.type === 'open' || action.type === 'created') {
            touchedWorkspace = true
            onOpenPage(action.pageId)
          } else if (action.type === 'updated') {
            touchedWorkspace = true
            if (currentPage && action.pageId === currentPage.id) onOpenPage(action.pageId)
          }
        }
        if (touchedWorkspace) onPagesChanged()
      } catch {
        setMessages((prev) => [...prev, { role: 'assistant', content: t('aiError') }])
      } finally {
        setLoading(false)
      }
    },
    [currentPage, lang, loading, messages, onOpenPage, onPagesChanged, t]
  )

  const clearChat = React.useCallback(() => {
    if (loading) return
    setMessages([])
  }, [loading])

  const speakMessage = React.useCallback(
    (index: number, text: string) => {
      if (!('speechSynthesis' in window)) return
      window.speechSynthesis.cancel()
      if (speakingIndex === index) {
        setSpeakingIndex(null)
        return
      }
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = lang === 'it' ? 'it-IT' : 'en-US'
      utterance.onend = () => setSpeakingIndex((cur) => (cur === index ? null : cur))
      utterance.onerror = () => setSpeakingIndex((cur) => (cur === index ? null : cur))
      setSpeakingIndex(index)
      window.speechSynthesis.speak(utterance)
    },
    [lang, speakingIndex]
  )

  const suggestions = [t('aiSuggestion1'), t('aiSuggestion2'), t('aiSuggestion3'), t('aiSuggestion4')]

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex h-full w-full flex-col gap-0 p-0 sm:max-w-md"
        aria-describedby={undefined}
      >
        <SheetHeader className="flex-row items-center gap-2 space-y-0 border-b pr-14">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="size-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <SheetTitle className="text-sm">{t('aiAssistant')}</SheetTitle>
            <SheetDescription className="truncate text-xs">{t('aiPanelTagline')}</SheetDescription>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 cursor-pointer text-muted-foreground"
            onClick={clearChat}
            disabled={loading || messages.length === 0}
            aria-label={t('aiNewChat')}
            title={t('aiNewChat')}
          >
            <Eraser className="size-4" aria-hidden />
          </Button>
        </SheetHeader>

        {/* Messaggi */}
        <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4" role="log" aria-live="polite">
          {messages.length === 0 && !loading ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 px-2 text-center">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Sparkles className="size-6" aria-hidden />
              </span>
              <div>
                <p className="text-sm font-semibold">{t('aiWelcomeTitle')}</p>
                <p className="mt-1 max-w-xs text-balance text-xs leading-relaxed text-muted-foreground">
                  {t('aiWelcomeBody')}
                </p>
              </div>
              <div className="flex w-full flex-col gap-2">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => void send(suggestion)}
                    className="cursor-pointer rounded-xl border bg-card px-3 py-2 text-left text-xs leading-snug text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={
                    message.role === 'user'
                      ? 'flex justify-end'
                      : 'flex flex-col items-stretch justify-start gap-1.5'
                  }
                >
                  <div
                    className={
                      message.role === 'user'
                        ? 'max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-primary px-3.5 py-2.5 text-sm leading-relaxed text-primary-foreground'
                        : 'max-w-[92%] whitespace-pre-wrap rounded-2xl rounded-bl-md bg-muted px-3.5 py-2.5 text-sm leading-relaxed'
                    }
                  >
                    {message.content}
                  </div>
                  {message.actions && message.actions.length > 0 ? (
                    <div className="flex max-w-[92%] flex-wrap gap-1.5">
                      {message.actions.map((action, i) => (
                        <ActionChip
                          key={`${index}-${i}`}
                          action={action}
                          label={
                            (action.type === 'created'
                              ? t('aiChipCreated')
                              : action.type === 'updated'
                                ? t('aiChipUpdated')
                                : t('aiChipOpened')) +
                            (action.title ? `: ${action.title}` : '')
                          }
                        />
                      ))}
                    </div>
                  ) : null}
                  {message.role === 'assistant' && 'speechSynthesis' in window ? (
                    <button
                      type="button"
                      onClick={() => speakMessage(index, message.content)}
                      aria-label={speakingIndex === index ? t('aiStopSpeaking') : t('aiSpeak')}
                      title={speakingIndex === index ? t('aiStopSpeaking') : t('aiSpeak')}
                      aria-pressed={speakingIndex === index}
                      className={cn(
                        'flex size-6 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
                        speakingIndex === index && 'bg-accent text-foreground'
                      )}
                    >
                      {speakingIndex === index ? (
                        <Square className="size-3" aria-hidden />
                      ) : (
                        <Volume2 className="size-3.5" aria-hidden />
                      )}
                    </button>
                  ) : null}
                </div>
              ))}
              {loading ? (
                <div className="flex justify-start">
                  <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md bg-muted px-4 py-3" aria-label={t('aiThinking')}>
                    <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/70 [animation-delay:0ms]" />
                    <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/70 [animation-delay:150ms]" />
                    <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/70 [animation-delay:300ms]" />
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>

        {/* Compositore */}
        <div className="shrink-0 border-t p-3">
          <div className="flex items-end gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void send(input)
                }
              }}
              rows={1}
              placeholder={listening ? t('aiMicActive') : t('aiPlaceholder')}
              aria-label={t('aiPlaceholder')}
              className="max-h-32 min-h-10 flex-1 resize-none bg-muted/50 text-sm"
              disabled={loading}
            />
            {sttSupported ? (
              <Button
                variant={listening ? 'destructive' : 'ghost'}
                size="icon"
                className={cn(
                  'size-10 shrink-0 cursor-pointer',
                  listening ? 'animate-pulse' : 'text-muted-foreground hover:text-foreground'
                )}
                onClick={listening ? stopListening : startListening}
                disabled={loading}
                aria-label={listening ? t('aiMicStop') : t('aiMicStart')}
                title={listening ? t('aiMicStop') : t('aiMicStart')}
                aria-pressed={listening}
              >
                <Mic className="size-4" aria-hidden />
              </Button>
            ) : null}
            <Button
              size="icon"
              className="size-10 shrink-0 cursor-pointer"
              onClick={() => void send(input)}
              disabled={loading || input.trim() === ''}
              aria-label={t('aiSend')}
            >
              <ArrowUp className="size-4" aria-hidden />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
