import { Link } from 'react-router-dom'

function Section({ title, children }) {
  return (
    <section className="mb-8">
      <h2 className="font-playfair text-lg font-semibold text-vip-black mb-3">{title}</h2>
      <div className="space-y-2 text-warm-gray text-sm leading-relaxed">{children}</div>
    </section>
  )
}

export default function PrivacyPage() {
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
          <p className="text-gold text-xs font-medium tracking-[0.3em] uppercase mb-2">RGPD</p>
          <h1 className="font-playfair text-3xl font-bold text-vip-black">
            Politique de confidentialité
          </h1>
          <p className="text-warm-gray text-sm mt-2">Dernière mise à jour : juin 2026</p>
        </div>

        <Section title="1. Responsable du traitement">
          <p>
            Le responsable du traitement des données personnelles collectées via ce site est :
          </p>
          <div className="bg-white border border-ivory-border rounded-xl px-4 py-3 mt-2 not-italic">
            <p className="font-semibold text-vip-black">VIP Cut's</p>
            <p>86 rue Joseph de Maistre</p>
            <p>75018 Paris, France</p>
          </div>
        </Section>

        <Section title="2. Données collectées">
          <p>Dans le cadre de la prise de rendez-vous en ligne, nous collectons :</p>
          <ul className="list-disc list-inside space-y-1 ml-1">
            <li>Votre <strong className="text-vip-black">prénom et nom</strong></li>
            <li>Votre <strong className="text-vip-black">numéro de téléphone</strong></li>
            <li>La <strong className="text-vip-black">date et l'heure</strong> du rendez-vous choisi</li>
            <li>Le <strong className="text-vip-black">service</strong> sélectionné</li>
          </ul>
          <p className="mt-2">
            Nous ne collectons aucune donnée de paiement, aucune adresse email client,
            et n'utilisons aucun cookie tiers ni outil de tracking.
          </p>
        </Section>

        <Section title="3. Finalité du traitement">
          <p>
            Les données collectées sont utilisées <strong className="text-vip-black">uniquement</strong> pour :
          </p>
          <ul className="list-disc list-inside space-y-1 ml-1">
            <li>Gérer et confirmer votre réservation</li>
            <li>Permettre au barbier de vous identifier à votre arrivée</li>
            <li>Vous contacter si nécessaire en cas de modification ou d'annulation</li>
          </ul>
          <p className="mt-2">
            Vos données ne sont <strong className="text-vip-black">jamais vendues ni partagées</strong> avec des tiers
            à des fins commerciales ou publicitaires.
          </p>
        </Section>

        <Section title="4. Durée de conservation">
          <p>
            Vos données sont conservées pendant une durée maximale de{' '}
            <strong className="text-vip-black">12 mois</strong> à compter de la date du rendez-vous,
            puis supprimées automatiquement.
          </p>
        </Section>

        <Section title="5. Base légale">
          <p>
            Le traitement est fondé sur l'<strong className="text-vip-black">exécution d'un contrat</strong> au
            sens de l'article 6(1)(b) du RGPD — la réservation constitue un engagement contractuel
            entre vous et le salon.
          </p>
        </Section>

        <Section title="6. Vos droits RGPD">
          <p>
            Conformément au Règlement Général sur la Protection des Données (RGPD) et à la loi
            Informatique et Libertés, vous disposez des droits suivants sur vos données :
          </p>
          <ul className="list-disc list-inside space-y-1 ml-1">
            <li><strong className="text-vip-black">Droit d'accès</strong> — obtenir une copie de vos données</li>
            <li><strong className="text-vip-black">Droit de rectification</strong> — corriger des données inexactes</li>
            <li><strong className="text-vip-black">Droit à l'effacement</strong> — demander la suppression de vos données</li>
            <li><strong className="text-vip-black">Droit à la limitation</strong> — restreindre le traitement</li>
            <li><strong className="text-vip-black">Droit d'opposition</strong> — vous opposer au traitement</li>
          </ul>
          <p className="mt-2">
            Pour exercer ces droits, contactez-nous directement au salon ou par courrier à
            l'adresse indiquée ci-dessus. Nous répondrons dans un délai d'un mois.
          </p>
          <p className="mt-2">
            Vous pouvez également introduire une réclamation auprès de la{' '}
            <strong className="text-vip-black">CNIL</strong> (Commission Nationale de l'Informatique
            et des Libertés) — <span className="text-ivory-border">www.cnil.fr</span>.
          </p>
        </Section>

        <Section title="7. Hébergement et sous-traitants">
          <p>Vos données sont hébergées par :</p>
          <div className="space-y-3 mt-2">
            <div className="bg-white border border-ivory-border rounded-xl px-4 py-3">
              <p className="font-semibold text-vip-black text-sm">Vercel Inc.</p>
              <p className="text-xs mt-0.5">440 N Barranca Ave #4133, Covina, CA 91723, États-Unis</p>
              <p className="text-xs mt-0.5">Hébergement de l'application web (frontend)</p>
              <p className="text-xs mt-0.5 text-ivory-border">Transfert encadré par les clauses contractuelles types (CCT) de l'UE</p>
            </div>
            <div className="bg-white border border-ivory-border rounded-xl px-4 py-3">
              <p className="font-semibold text-vip-black text-sm">Supabase Inc.</p>
              <p className="text-xs mt-0.5">970 Toa Payoh North, Singapour — serveurs en <strong className="text-vip-black">Irlande (UE)</strong></p>
              <p className="text-xs mt-0.5">Base de données et authentification</p>
              <p className="text-xs mt-0.5 text-ivory-border">Données stockées dans l'Union Européenne (région eu-west-1)</p>
            </div>
          </div>
        </Section>

        <Section title="8. Cookies et traceurs">
          <p>
            Ce site <strong className="text-vip-black">n'utilise aucun cookie tiers</strong>, aucun outil
            d'analyse d'audience (Google Analytics, etc.) et aucun pixel de tracking publicitaire.
          </p>
          <p>
            Un cookie technique de session est utilisé uniquement pour maintenir la connexion de
            l'espace professionnel (barbier). Il est strictement nécessaire au fonctionnement du
            service et n'est pas soumis au consentement.
          </p>
        </Section>

      </main>

      <footer className="border-t border-ivory-border px-5 py-5 max-w-2xl mx-auto flex items-center justify-between">
        <span className="text-ivory-border text-xs">© 2026 VIP Cut's</span>
        <div className="flex items-center gap-4">
          <Link to="/legal" className="text-warm-gray text-xs hover:text-vip-black transition-colors">
            Mentions légales
          </Link>
          <Link to="/" className="text-warm-gray text-xs hover:text-vip-black transition-colors">
            Réserver
          </Link>
        </div>
      </footer>
    </div>
  )
}
