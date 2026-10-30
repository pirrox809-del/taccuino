'use client'

/**
 * Taccuino — evidenziazione della sintassi leggera, basata su regex.
 *
 * Strategia: PRIMA si escapano le entità (& < >), POI si tokenizza con UNA
 * regex combinata per famiglia linguistica. L'alternanza (commenti | stringhe
 * | letterali | keyword | numeri) fa sì che ciò che sta dentro stringhe e
 * commenti venga consumato tutto in un token e non venga ri-tokenizzato.
 *
 * Le classi usate sono classi Tailwind presenti letteralmente in questo file,
 * così il compilatore le include nel CSS. Colori sanzionati dalla spec:
 * rose/emerald/amber/purple/red/orange/teal — nessun indigo/blue.
 */

const CLS = {
  comment: 'text-muted-foreground italic',
  string: 'text-emerald-700 dark:text-emerald-400',
  keyword: 'text-rose-600 dark:text-rose-400',
  number: 'text-orange-600 dark:text-orange-400',
  literal: 'text-purple-600 dark:text-purple-400',
  tag: 'text-red-600 dark:text-red-400',
  attr: 'text-amber-700 dark:text-amber-400',
  jsonKey: 'text-teal-700 dark:text-teal-300',
} as const

function span(cls: string, text: string): string {
  return `<span class="${cls}">${text}</span>`
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// ---------------------------------------------------------------------------
// JavaScript / TypeScript
// ---------------------------------------------------------------------------
const JS_RE =
  /(\/\*[\s\S]*?\*\/|\/\/[^\n]*)|(`(?:[^`\\]|\\[\s\S])*`|'(?:[^'\\\n]|\\[\s\S])*'|"(?:[^"\\\n]|\\[\s\S])*")|\b(true|false|null|undefined|NaN|Infinity)\b|\b(const|let|var|function|return|if|else|for|while|do|switch|case|default|break|continue|class|extends|new|delete|typeof|instanceof|in|of|import|export|from|as|async|await|try|catch|finally|throw|this|super|yield|void|static|get|set|interface|type|enum|implements|public|private|protected|readonly|satisfies|keyof|infer|declare|namespace|abstract)\b|(\b0[xX][\da-fA-F]+|\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)(?![\w.])/g

function jsReplacer(m: string, comment?: string, str?: string, lit?: string, kw?: string, num?: string): string {
  if (comment) return span(CLS.comment, m)
  if (str) return span(CLS.string, m)
  if (lit) return span(CLS.literal, m)
  if (kw) return span(CLS.keyword, m)
  if (num) return span(CLS.number, m)
  return m
}

// ---------------------------------------------------------------------------
// Python
// ---------------------------------------------------------------------------
const PY_RE =
  /(#[^\n]*)|('''[\s\S]*?'''|"""[\s\S]*?""")|('(?:[^'\\\n]|\\[\s\S])*'|"(?:[^"\\\n]|\\[\s\S])*")|\b(True|False|None)\b|\b(def|class|return|if|elif|else|for|while|import|from|as|try|except|finally|raise|with|lambda|pass|yield|global|nonlocal|assert|del|async|await|and|or|not|in|is)\b|(\b\d+(?:\.\d+)?)(?![\w.])/g

function pyReplacer(m: string, comment?: string, str?: string, lit?: string, kw?: string, num?: string): string {
  if (comment) return span(CLS.comment, m)
  if (str) return span(CLS.string, m)
  if (lit) return span(CLS.literal, m)
  if (kw) return span(CLS.keyword, m)
  if (num) return span(CLS.number, m)
  return m
}

// ---------------------------------------------------------------------------
// Bash
// ---------------------------------------------------------------------------
const BASH_RE =
  /(#[^\n]*)|('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")|(\$\{?[$\w]+\}?)|\b(if|then|else|elif|fi|for|in|do|done|while|until|case|esac|function|return|local|export|readonly|declare|source|alias|echo|printf|read|cd|pushd|popd|exit|set|unset|shift|trap|eval|exec)\b/g

function bashReplacer(m: string, comment?: string, str?: string, variable?: string, kw?: string): string {
  if (comment) return span(CLS.comment, m)
  if (str) return span(CLS.string, m)
  if (variable) return span(CLS.literal, variable)
  if (kw) return span(CLS.keyword, m)
  return m
}

// ---------------------------------------------------------------------------
// JSON
// ---------------------------------------------------------------------------
const JSON_RE =
  /("(?:[^"\\]|\\[\s\S])*")(\s*:)|("(?:[^"\\]|\\[\s\S])*")|\b(true|false|null)\b|(-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)(?![\w.])/g

function jsonReplacer(m: string, key?: string, colon?: string, str?: string, lit?: string, num?: string): string {
  if (key) return span(CLS.jsonKey, key) + (colon ?? '')
  if (str) return span(CLS.string, str)
  if (lit) return span(CLS.literal, lit)
  if (num) return span(CLS.number, num)
  return m
}

// ---------------------------------------------------------------------------
// CSS
// ---------------------------------------------------------------------------
const CSS_RE =
  /(\/\*[\s\S]*?\*\/)|('(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*")|(@[\w-]+)|(#[0-9a-fA-F]{3,8}\b)|((?:\b|\.)-?\d+(?:\.\d+)?(?:px|em|rem|%|vh|vw|vmin|vmax|s|ms|deg|fr|ch|pt)?)(?![\w-])|([a-zA-Z-]+)(?=\s*:)/g

function cssReplacer(
  m: string,
  comment?: string,
  str?: string,
  atRule?: string,
  hex?: string,
  num?: string,
  prop?: string
): string {
  if (comment) return span(CLS.comment, m)
  if (str) return span(CLS.string, m)
  if (atRule) return span(CLS.keyword, atRule)
  if (hex) return span(CLS.number, hex)
  if (num) return span(CLS.number, num)
  if (prop) return span(CLS.attr, prop)
  return m
}

// ---------------------------------------------------------------------------
// HTML (due passaggi: prima i tag/commenti, poi le parti interne al tag)
// ---------------------------------------------------------------------------
function highlightHtml(escaped: string): string {
  return escaped.replace(/(&lt;!--[\s\S]*?--&gt;)|(&lt;\/?[\s\S]*?&gt;)/g, (m, comment?: string, tag?: string) => {
    if (comment) return span(CLS.comment, comment)
    if (!tag) return m
    return tag.replace(
      /(&lt;\/?)([a-zA-Z][\w-]*)|([\w-]+)(?==)|("[^"]*")|(&gt;)/g,
      (m2: string, open?: string, name?: string, attr?: string, str?: string, close?: string) => {
        if (open) return span(CLS.tag, open + (name ?? ''))
        if (attr) return span(CLS.attr, attr)
        if (str) return span(CLS.string, str)
        if (close) return span(CLS.tag, close)
        return m2
      }
    )
  })
}

// ---------------------------------------------------------------------------
// Markdown (single-pass per non annidare bold dentro italic ecc.)
// ---------------------------------------------------------------------------
const MD_RE =
  /^(#{1,6} [^\n]*)$|(\*\*[^*\n]+\*\*|__[^_\n]+__)|(\*[^*\n]+\*|_[^_\n]+_)|(`[^`\n]+`)|(\[[^\]\n]+\]\([^)\n]+\))/gm

function mdReplacer(m: string, heading?: string, bold?: string, italic?: string, code?: string, link?: string): string {
  if (heading) return span(CLS.keyword, heading)
  if (bold) return span(CLS.attr, bold)
  if (italic) return span(CLS.string, italic)
  if (code) return span(CLS.number, code)
  if (link) return span(CLS.literal, link)
  return m
}

/**
 * Evidenzia `code` per il linguaggio dato e restituisce HTML sicuro
 * (l'input viene prima escapato, i token vengono avvolti in <span>).
 */
export function highlight(code: string, language: string): string {
  const escaped = escapeHtml(code)
  switch (language) {
    case 'javascript':
    case 'typescript':
      return escaped.replace(JS_RE, jsReplacer)
    case 'json':
      return escaped.replace(JSON_RE, jsonReplacer)
    case 'html':
      return highlightHtml(escaped)
    case 'css':
      return escaped.replace(CSS_RE, cssReplacer)
    case 'python':
      return escaped.replace(PY_RE, pyReplacer)
    case 'bash':
      return escaped.replace(BASH_RE, bashReplacer)
    case 'markdown':
      return escaped.replace(MD_RE, mdReplacer)
    default:
      return escaped
  }
}
