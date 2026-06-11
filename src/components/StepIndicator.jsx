export default function StepIndicator({ step, steps }) {
  return (
    <div className="flex items-start justify-center gap-0 px-4 py-5">
      {steps.map((label, i) => {
        const num     = i + 1
        const isDone   = num < step
        const isActive = num === step

        return (
          <div key={num} className="flex items-center">
            {/* Step node */}
            <div className="flex flex-col items-center gap-1.5">
              <div className={[
                'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all',
                isDone   ? 'bg-gold text-vip-black'                       : '',
                isActive ? 'bg-vip-black text-ivory ring-2 ring-gold ring-offset-2 ring-offset-ivory' : '',
                !isDone && !isActive ? 'border border-ivory-border text-ivory-border' : '',
              ].filter(Boolean).join(' ')}>
                {isDone ? (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                ) : num}
              </div>
              <span className={[
                'text-[10px] tracking-widest uppercase font-medium whitespace-nowrap',
                isActive ? 'text-vip-black' : 'text-ivory-border',
              ].join(' ')}>
                {label}
              </span>
            </div>

            {/* Connector */}
            {i < steps.length - 1 && (
              <div className={[
                'w-8 sm:w-12 h-px mx-1.5 mb-5 transition-colors',
                isDone ? 'bg-gold' : 'bg-ivory-border',
              ].join(' ')} />
            )}
          </div>
        )
      })}
    </div>
  )
}
