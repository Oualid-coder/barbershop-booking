import { formatDateShort } from '../lib/bookingUtils'

export default function DateSelector({ dates, selected, onSelect }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 -mx-5 px-5 snap-x snap-mandatory">
      {dates.map((date) => {
        const { day, num, month } = formatDateShort(date)
        const isSelected = date === selected

        return (
          <button
            key={date}
            onClick={() => onSelect(date)}
            className={[
              'flex-shrink-0 snap-start flex flex-col items-center justify-center w-14 py-3 rounded-xl border-2 transition-all active:scale-95',
              isSelected
                ? 'bg-vip-black border-vip-black'
                : 'bg-white border-ivory-border hover:border-gold/60',
            ].join(' ')}
          >
            <span className={`text-xs capitalize font-medium ${isSelected ? 'text-gold' : 'text-warm-gray'}`}>
              {day}
            </span>
            <span className={`text-lg font-playfair font-bold leading-tight mt-0.5 ${isSelected ? 'text-ivory' : 'text-vip-black'}`}>
              {num}
            </span>
            <span className={`text-xs capitalize mt-0.5 ${isSelected ? 'text-gold/70' : 'text-warm-gray'}`}>
              {month}
            </span>
          </button>
        )
      })}
    </div>
  )
}
