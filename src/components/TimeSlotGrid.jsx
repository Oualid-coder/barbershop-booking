export default function TimeSlotGrid({ slots, selected, onSelect }) {
  if (slots.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <div className="w-12 h-12 rounded-full bg-ivory-dark border border-ivory-border flex items-center justify-center mb-3">
          <svg className="w-5 h-5 text-warm-gray" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-warm-gray text-sm">Aucun créneau disponible</p>
        <p className="text-ivory-border text-xs mt-1">Choisissez une autre date</p>
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
            'py-3.5 rounded-xl border-2 text-sm font-semibold tracking-wide transition-all active:scale-95 font-dm',
            selected === slot
              ? 'bg-vip-black border-vip-black text-ivory'
              : 'bg-white border-ivory-border text-vip-black hover:border-gold/60',
          ].join(' ')}
        >
          {slot}
        </button>
      ))}
    </div>
  )
}
