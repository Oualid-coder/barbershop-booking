import { QRCodeSVG } from 'qrcode.react'

export default function QRView() {
  const appUrl = import.meta.env.VITE_APP_URL || window.location.origin

  return (
    <div className="flex flex-col items-center">
      <p className="text-warm-gray text-sm mb-8 text-center leading-relaxed max-w-xs">
        Placez ce QR code dans votre salon pour que les clients puissent réserver depuis leur téléphone.
      </p>

      <div id="qr-print-area" className="bg-white rounded-2xl p-6 flex flex-col items-center gap-4 mb-6 shadow-sm border border-ivory-border">
        <QRCodeSVG value={appUrl} size={200} level="H" bgColor="#ffffff" fgColor="#0D0D0D" />
        <p className="text-warm-gray text-xs font-mono text-center break-all max-w-[200px]">{appUrl}</p>
      </div>

      <button
        onClick={() => window.print()}
        className="flex items-center gap-2 bg-vip-black text-ivory font-bold px-6 py-3 rounded-xl hover:bg-bordeaux active:scale-[0.99] transition-all"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
        </svg>
        Imprimer le QR Code
      </button>
      <p className="text-ivory-border text-xs text-center mt-4">L'impression n'affichera que le QR code</p>
    </div>
  )
}
