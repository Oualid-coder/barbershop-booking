import { Link } from 'react-router-dom'

function Section({ title, children }) {
  return (
    <section className="mb-8">
      <h2 className="font-playfair text-lg font-semibold text-vip-black mb-3">{title}</h2>
      <div className="space-y-2 text-warm-gray text-sm leading-relaxed">{children}</div>
    </section>
  )
}

export default function LegalPage() {
  return (
    <div className="min-h-screen bg-ivory font-dm text-vip-black">

      {/* Header */}
      <header className="border-b border-ivory-border px-5 py-5">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link to="/" className="font-playfair font-bold text-vip-black hover:text-gold transition-colors">
            VIP Cut's
          </Link>
          <Link to="/" className="text-warm-gray text-xs hover:text-vip-black transition-colors">
            ← Retour
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-5 py-10">

        <div className="mb-10">
          <p className="text-gold text-xs font-medium tracking-[0.3em] uppercase mb-2">Légal</p>
          <h1 className="font-playfair text-3xl font-bold text-vip-black">
            Mentions légales
          </h1>
          <p className="text-warm-gray text-sm mt-2">Conformément à la loi n° 2004-575 du 21 juin 2004 (LCEN)</p>
        </div>

        <Section title="1. Éditeur du site">
          <div className="bg-white border border-ivory-border rounded-xl px-4 py-3">
            <p className="font-semibold text-vip-black">VIP Cut's</p>
            <p>Salon de coiffure barbier</p>
            <p>86 rue Joseph de Maistre</p>
            <p>75018 Paris, France</p>
          </div>
        </Section>

        <Section title="2. Directeur de la publication">
          <p>
            Le directeur de la publication est le gérant de l'établissement VIP Cut's,
            domicilié à l'adresse indiquée ci-dessus.
          </p>
        </Section>

        <Section title="3. Hébergement">
          <div className="space-y-3">
            <div className="bg-white border border-ivory-border rounded-xl px-4 py-3">
              <p className="font-semibold text-vip-black text-sm">Vercel Inc. — Frontend</p>
              <p className="text-xs mt-0.5">440 N Barranca Ave #4133</p>
              <p className="text-xs">Covina, CA 91723, États-Unis</p>
              <p className="text-xs mt-0.5 text-ivory-border">vercel.com</p>
            </div>
            <div className="bg-white border border-ivory-border rounded-xl px-4 py-3">
              <p className="font-semibold text-vip-black text-sm">Supabase Inc. — Base de données</p>
              <p className="text-xs mt-0.5">970 Toa Payoh North, Singapour</p>
              <p className="text-xs">Serveurs hébergés en Irlande (Union Européenne)</p>
              <p className="text-xs mt-0.5 text-ivory-border">supabase.com</p>
            </div>
          </div>
        </Section>

        <Section title="4. Propriété intellectuelle">
          <p>
            L'ensemble des éléments composant ce site — textes, graphismes, logo, icônes,
            mise en page — est la propriété exclusive de VIP Cut's ou de ses ayants droit.
          </p>
          <p>
            Toute reproduction, représentation, modification, publication ou adaptation,
            totale ou partielle, de ces éléments est interdite sans l'autorisation écrite
            préalable de VIP Cut's, sous peine de poursuites judiciaires.
          </p>
        </Section>

        <Section title="5. Limitation de responsabilité">
          <p>
            VIP Cut's s'efforce d'assurer l'exactitude et la mise à jour des informations
            publiées sur ce site. Cependant, VIP Cut's ne peut garantir l'exactitude, la
            précision ou l'exhaustivité des informations mises à disposition.
          </p>
          <p>
            VIP Cut's décline toute responsabilité pour toute imprécision, inexactitude ou
            omission portant sur des informations disponibles sur ce site.
          </p>
        </Section>

        <Section title="6. Protection des données personnelles">
          <p>
            La collecte et le traitement des données personnelles effectués via ce site sont
            détaillés dans notre{' '}
            <Link to="/privacy" className="text-vip-black underline hover:text-gold transition-colors">
              Politique de confidentialité
            </Link>.
          </p>
        </Section>

        <Section title="7. Droit applicable">
          <p>
            Les présentes mentions légales sont soumises au droit français. En cas de litige,
            les tribunaux français seront seuls compétents.
          </p>
        </Section>

      </main>

      <footer className="border-t border-ivory-border px-5 py-5 max-w-2xl mx-auto flex items-center justify-between">
        <span className="text-ivory-border text-xs">© 2026 VIP Cut's</span>
        <div className="flex items-center gap-4">
          <Link to="/privacy" className="text-warm-gray text-xs hover:text-vip-black transition-colors">
            Confidentialité
          </Link>
          <Link to="/" className="text-warm-gray text-xs hover:text-vip-black transition-colors">
            Réserver
          </Link>
        </div>
      </footer>
    </div>
  )
}
