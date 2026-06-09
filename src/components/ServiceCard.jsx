const ClockIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

const CheckIcon = () => (
  <svg className="w-3 h-3 text-zinc-950" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
  </svg>
)

export default function ServiceCard({ service, selected, onSelect }) {
  return (
    <button
      onClick={onSelect}
      className={[
        'w-full text-left rounded-2xl border px-5 py-4 transition-all active:scale-[0.99]',
        selected
          ? 'border-amber-400 bg-amber-400/5'
          : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700',
      ].join(' ')}
    >
      <div className="flex justify-between items-start gap-4">
        <div className="flex-1 min-w-0">
          <p className={`font-semibold text-base ${selected ? 'text-amber-400' : 'text-white'}`}>
            {service.name}
          </p>
          {service.description && (
            <p className="text-zinc-500 text-sm mt-1 leading-relaxed">{service.description}</p>
          )}
          <div className="flex items-center gap-1.5 mt-3 text-zinc-500 text-xs">
            <ClockIcon />
            <span>{service.duration_minutes} min</span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          <span className="text-amber-400 font-bold text-xl">{service.price} €</span>
          {selected && (
            <div className="w-5 h-5 rounded-full bg-amber-400 flex items-center justify-center">
              <CheckIcon />
            </div>
          )}
        </div>
      </div>
    </button>
  )
}
