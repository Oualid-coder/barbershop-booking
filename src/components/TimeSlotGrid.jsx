export default function TimeSlotGrid({ slots, selected, onSelect }) {
  if (slots.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <div className="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-3">
          <svg className="w-5 h-5 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-zinc-500 text-sm">Aucun créneau disponible</p>
        <p className="text-zinc-600 text-xs mt-1">Choisissez une autre date</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      {slots.map((slot) => (
        <button
          key={slot}
          onClick={() => onSelect(slot)}
          className={[
            'py-3.5 rounded-xl border text-sm font-semibold tracking-wide transition-all active:scale-95',
            selected === slot
              ? 'bg-amber-400 border-amber-400 text-zinc-950'
              : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-600',
          ].join(' ')}
        >
          {slot}
        </button>
      ))}
    </div>
  )
}
