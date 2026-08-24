import * as React from 'react'

import { cn } from '#/lib/utils.ts'

function Input({
  className,
  type,
  onClick,
  ...props
}: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      onClick={(e) => {
        onClick?.(e)
        // Native date inputs only pop the calendar open when the tiny icon is
        // clicked; showPicker() makes a click anywhere in the field do it.
        if (type === 'date') {
          try {
            e.currentTarget.showPicker()
          } catch {
            // Unsupported browser or input not pickable — ignore.
          }
        }
      }}
      className={cn(
        'h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30',
        'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
        'aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40',
        type === 'date' && 'cursor-pointer',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
