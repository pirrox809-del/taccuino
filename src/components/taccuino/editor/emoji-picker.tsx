'use client'

/**
 * Taccuino — selettore emoji (riusato anche dalla shell per l'icona pagina).
 * Griglia di ~64 emoji curate (Unicode ufficiali, nessun logo/brand) +
 * voce finale "✕" che azzera la selezione con onPick(null).
 */
import * as React from 'react'
import { X } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'

const EMOJIS = [
  // Volti
  '😀', '😄', '😅', '🤣', '😂', '🙂', '😉', '😊',
  '😍', '🤩', '😘', '😜', '🤪', '🤨', '🧐', '🤓',
  '😎', '🥳', '😏', '🤔', '😴', '🥺', '😭', '😡',
  '😱', '🤯', '🤗', '🤫', '🤭', '🥲', '😤', '🙃',
  // Mani e corpo
  '👍', '👎', '👏', '🙌', '🤝', '💪', '🙏', '👀',
  // Cuori
  '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍',
  // Simboli
  '💯', '✨', '🔥', '⭐', '⚡', '🎯', '🚀', '🎉',
  // Oggetti
  '💡', '📌', '📝', '📚', '📅', '⏰', '🔔', '🔑',
] as const

export interface EmojiPickerProps {
  value: string | null
  onPick: (emoji: string | null) => void
  children: React.ReactNode
  align?: 'start' | 'center' | 'end'
}

export function EmojiPicker({ value, onPick, children, align = 'center' }: EmojiPickerProps) {
  const { t } = useI18n()
  const [open, setOpen] = React.useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align={align} className="w-64 p-2">
        <div aria-label={t('pickIcon')} className="grid grid-cols-8 gap-0.5">
          {EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              aria-label={emoji}
              className={cn(
                'flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-lg hover:bg-accent',
                'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                value === emoji && 'bg-accent'
              )}
              onClick={() => {
                onPick(emoji)
                setOpen(false)
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
        <div className="mt-1 border-t pt-1">
          <button
            type="button"
            className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            onClick={() => {
              onPick(null)
              setOpen(false)
            }}
          >
            <X className="size-3.5" aria-hidden />
            {t('removeIcon')}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
