import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import {
  DayButton,
  DayPicker,
  getDefaultClassNames
} from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  const defaultClassNames = getDefaultClassNames()

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("bg-background p-3 [--cell-size:2.5rem]", className)}
      classNames={{
        root: cn("group/calendar", defaultClassNames.root),
        months: cn("relative flex flex-col gap-4 sm:flex-row", defaultClassNames.months),
        month: cn("w-full space-y-4", defaultClassNames.month),
        nav: cn("absolute top-0 flex w-full items-center justify-between gap-1 px-1", defaultClassNames.nav),
        button_previous: cn(
          buttonVariants({ variant: "ghost" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
          defaultClassNames.button_previous
        ),
        button_next: cn(
          buttonVariants({ variant: "ghost" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
          defaultClassNames.button_next
        ),
        month_caption: cn(
          "flex h-7 w-full items-center justify-center px-8 text-sm font-medium",
          defaultClassNames.month_caption
        ),
        dropdowns: cn("flex h-7 w-full items-center justify-center gap-1.5 text-sm font-medium", defaultClassNames.dropdowns),
        dropdown_root: cn("relative border border-white/10 shadow-sm", defaultClassNames.dropdown_root),
        dropdown: cn(
          "absolute inset-0 opacity-0",
          defaultClassNames.dropdown
        ),
        caption_label: cn(
          "text-sm font-medium text-white",
          defaultClassNames.caption_label
        ),
        weekdays: cn("w-full", defaultClassNames.weekdays),
        weekday: cn("w-[--cell-size] text-[0.75rem] font-medium text-muted-foreground text-center", defaultClassNames.weekday),
        week: cn("", defaultClassNames.week),
        week_number_header: cn("w-[--cell-size] text-[0.75rem] font-medium text-muted-foreground", defaultClassNames.week_number_header),
        week_number: cn("flex h-[--cell-size] w-[--cell-size] items-center justify-center text-[0.8rem] text-muted-foreground", defaultClassNames.week_number),
        day: cn(
          "group/day relative h-[--cell-size] w-[--cell-size] p-0 text-center align-middle text-sm focus-within:relative focus-within:z-20",
          defaultClassNames.day
        ),
        day_button: cn("h-[--cell-size] w-[--cell-size] p-0 font-normal", defaultClassNames.day_button),
        range_start: cn("bg-accentpurple/60 rounded-l-md rounded-r-none", defaultClassNames.range_start),
        range_middle: cn("bg-accentpurple/60 rounded-none", defaultClassNames.range_middle),
        range_end: cn("bg-accentpurple/60 rounded-r-md rounded-l-none", defaultClassNames.range_end),
        today: cn("text-white", defaultClassNames.today),
        selected: cn("text-white", defaultClassNames.selected),
        outside: cn("text-muted-foreground opacity-50", defaultClassNames.outside),
        disabled: cn("text-muted-foreground opacity-40", defaultClassNames.disabled),
        hidden: cn("invisible", defaultClassNames.hidden),
        ...classNames
      }}
      components={{
        Chevron: ({ className: iconClassName, orientation }) => {
          if (orientation === "left") {
            return <ChevronLeft className={cn("h-4 w-4", iconClassName)} />
          }
          return <ChevronRight className={cn("h-4 w-4", iconClassName)} />
        },
        DayButton: CalendarDayButton
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

function CalendarDayButton({
  className,
  day,
  modifiers,
  ...props
}: React.ComponentProps<typeof DayButton>) {
  const isRangeStart = modifiers.range_start
  const isRangeEnd = modifiers.range_end
  const isRangeMiddle = modifiers.range_middle
  const isSelected = modifiers.selected
  const isSingle = isSelected && !isRangeStart && !isRangeEnd && !isRangeMiddle
  const isOutside = modifiers.outside
  const isDisabled = modifiers.disabled
  const isToday = modifiers.today

  return (
    <DayButton
      day={day}
      modifiers={modifiers}
      className={cn(
        "flex h-[--cell-size] w-[--cell-size] items-center justify-center rounded-md text-sm transition-colors",
        isRangeMiddle && "rounded-none text-white",
        (isRangeStart || isRangeEnd) && "text-white ring-1 ring-inset ring-accentpurple/70",
        isSingle && "bg-accentpurple/60 text-white ring-1 ring-inset ring-accentpurple/70",
        isRangeStart && "rounded-l-md rounded-r-none",
        isRangeEnd && "rounded-r-md rounded-l-none",
        !isSelected && !isRangeMiddle && !isRangeStart && !isRangeEnd && !isSingle && "hover:bg-white/10",
        isOutside && "text-muted-foreground opacity-50",
        isDisabled && "text-muted-foreground opacity-40",
        isToday && !isSelected && !isRangeMiddle && !isRangeStart && !isRangeEnd && "bg-white/10 text-white",
        "group-data-[focused=true]/day:ring-2 group-data-[focused=true]/day:ring-accentpurple/60",
        className
      )}
      {...props}
    />
  )
}
CalendarDayButton.displayName = "CalendarDayButton"

export { Calendar, CalendarDayButton }
