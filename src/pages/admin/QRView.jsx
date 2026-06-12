import { useRef } from 'react'
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react'

export default function QRView() {
  const appUrl       = import.meta.env.VITE_APP_URL || window.location.origin
  const canvasWrapRef = useRef(null)

  function handleDownload() {
    const canvas = canvasWrapRef.current?.querySelector('canvas')
    if (!canvas) return
    const link = document.createElement('a')
    link.download = 'vipcuts-qrcode.png'
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  return (
    <div className="flex flex-col items-center">

      {/* ── Print styles ────────────────────────────────────────────── */}
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 2cm; }
          body * { visibility: hidden; }
          #qr-print-area, #qr-print-area * { visibility: visible; }
          #qr-print-area {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 12cm;
            min-height: 14cm;
            border: 2px solid #C9A84C !important;
            border-radius: 16px;
            padding: 36px !important;
            background: #ffffff !important;
            display: flex !important;
            flex-direction: column;
            align-items: center;
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          #qr-print-area svg {
            width: 10cm !important;
            height: 10cm !important;
          }
        }
      `}</style>

      <p className="text-warm-gray text-sm mb-8 text-center leading-relaxed max-w-xs">
        Placez ce QR code dans votre salon pour que les clients puissent réserver depuis leur téléphone.
      </p>

      {/* ── Print card ──────────────────────────────────────────────── */}
      <div
        id="qr-print-area"
        className="bg-white rounded-2xl border border-ivory-border p-8 flex flex-col items-center mb-6 shadow-sm"
      >
        {/* Gold accent */}
        <div className="w-10 h-0.5 bg-gold mb-5" />

        {/* Salon name */}
        <p
          className="text-vip-black font-bold text-2xl tracking-wide mb-1.5"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          VIP Cut's
        </p>

        {/* Subtitle */}
        <p className="text-warm-gray text-[10px] tracking-[0.28em] uppercase mb-7">
          Scannez pour réserver
        </p>

        {/* QR code */}
        <QRCodeSVG
          value={appUrl}
          size={280}
          level="H"
          bgColor="#ffffff"
          fgColor="#0D0D0D"
        />

        {/* Address */}
        <p className="text-warm-gray text-xs mt-6 tracking-wide">
          86 rue Joseph de Maistre · Paris 18e
        </p>
      </div>

      {/* ── Action buttons ──────────────────────────────────────────── */}
      <div className="flex gap-3 flex-wrap justify-center">
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 bg-vip-black text-ivory text-sm font-bold px-5 py-3 rounded-xl hover:bg-bordeaux active:scale-[0.99] transition-all"
        >
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Imprimer
        </button>

        <button
          onClick={handleDownload}
          className="flex items-center gap-2 border border-ivory-border text-vip-black text-sm font-bold px-5 py-3 rounded-xl hover:border-gold hover:text-gold active:scale-[0.99] transition-all"
        >
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Télécharger PNG
        </button>
      </div>

      <p className="text-ivory-border text-xs text-center mt-4">
        L'impression n'affichera que le QR code
      </p>

      {/* ── Off-screen canvas for PNG export (600 px — haute résolution) ── */}
      <div
        ref={canvasWrapRef}
        style={{ position: 'fixed', left: '-9999px', top: '-9999px', pointerEvents: 'none' }}
        aria-hidden="true"
      >
        <QRCodeCanvas
          value={appUrl}
          size={600}
          level="H"
          bgColor="#ffffff"
          fgColor="#0D0D0D"
          marginSize={2}
        />
      </div>

    </div>
  )
}
