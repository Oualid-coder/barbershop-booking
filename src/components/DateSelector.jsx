import { formatDateShort } from '../lib/bookingUtils'

export default function DateSelector({ dates, selected, onSelect }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory">
      {dates.map((date) => {
        const { day, num, month } = formatDateShort(date)
        const isSelected = date === selected

        return (
          <button
            key={date}
            onClick={() => onSelect(date)}
            className={[
              'flex-shrink-0 snap-start flex flex-col items-center justify-center w-14 py-3 rounded-xl border transition-all active:scale-95',
              isSelected
                ? 'bg-amber-400 border-amber-400'
                : 'bg-zinc-900 border-zinc-800 hover:border-zinc-600',
            ].join(' ')}
          >
            <span className={`text-xs capitalize font-medium ${isSelected ? 'text-zinc-800' : 'text-zinc-500'}`}>
              {day}
            </span>
            <span className={`text-lg font-bold leading-tight mt-0.5 ${isSelected ? 'text-zinc-950' : 'text-white'}`}>
              {num}
            </span>
            <span className={`text-xs capitalize mt-0.5 ${isSelected ? 'text-zinc-800' : 'text-zinc-500'}`}>
              {month}
            </span>
          </button>
        )
      })}
    </div>
  )
}
