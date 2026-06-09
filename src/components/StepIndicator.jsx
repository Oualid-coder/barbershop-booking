const CheckIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
  </svg>
)

export default function StepIndicator({ step, steps }) {
  return (
    <div className="flex items-center justify-center px-4 py-6">
      {steps.map((label, i) => {
        const num = i + 1
        const isDone = num < step
        const isActive = num === step

        return (
          <div key={num} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className={[
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all',
                  isDone ? 'bg-amber-400 text-zinc-950' : '',
                  isActive ? 'border-2 border-amber-400 text-amber-400' : '',
                  !isDone && !isActive ? 'border border-zinc-700 text-zinc-600' : '',
                ].join(' ')}
              >
                {isDone ? <CheckIcon /> : num}
              </div>
              <span
                className={`text-xs tracking-wide ${
                  isActive ? 'text-amber-400' : 'text-zinc-600'
                }`}
              >
                {label}
              </span>
            </div>

            {i < steps.length - 1 && (
              <div
                className={`w-10 h-px mx-2 mb-5 transition-colors ${
                  isDone ? 'bg-amber-400' : 'bg-zinc-800'
                }`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
