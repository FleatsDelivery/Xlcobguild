/**
 * Terms of Service Page
 *
 * Comprehensive TOS covering Discord OAuth, guild system, Kernel Kup tournaments,
 * Secret Shop (Stripe payments, TCF+ subscriptions), and community standards.
 * Written in plain language while still being legally protective.
 */

import { FileText, ShieldCheck, Users, Trophy, ShoppingBag, AlertTriangle, Scale, Mail } from 'lucide-react';
import { Footer } from '@/app/components/footer';

const EFFECTIVE_DATE = 'March 2, 2026';
const CONTACT_DISCORD = 'https://discord.gg/rHYPrdYGGh';

interface SectionProps {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}

function Section({ icon, title, children }: SectionProps) {
  return (
    <div className="bg-card rounded-2xl p-4 sm:p-6 border-2 border-border">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-harvest/10 flex items-center justify-center flex-shrink-0">
          {icon}
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-foreground">{title}</h2>
      </div>
      <div className="space-y-3 text-sm sm:text-base text-muted-foreground leading-relaxed">
        {children}
      </div>
    </div>
  );
}

export function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-background px-3 sm:px-4 py-4">
      <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-br from-harvest/10 to-harvest/5 rounded-2xl sm:rounded-3xl p-4 sm:p-8 border-2 border-harvest/20">
          <div className="flex items-center gap-3 sm:gap-4 mb-2">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-harvest flex items-center justify-center flex-shrink-0">
              <FileText className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Terms of Service</h1>
              <p className="text-muted-foreground text-xs sm:text-sm">
                Effective: {EFFECTIVE_DATE}
              </p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-3">
            Welcome to The Corn Field ("TCF", "we", "us", "our"). These Terms of Service ("Terms") govern
            your use of our web application at thecornfield.app and all related services. By creating an
            account or using our platform, you agree to these Terms. If you don't agree, please don't use the service.
          </p>
        </div>

        {/* 1. Eligibility & Accounts */}
        <Section icon={<ShieldCheck className="w-5 h-5 text-harvest" />} title="1. Eligibility & Accounts">
          <p>
            <strong className="text-foreground">Age Requirement:</strong> You must be at least 13 years old to use The Corn Field.
            If you are under 18, you represent that a parent or guardian has reviewed and agrees to these Terms on your behalf.
          </p>
          <p>
            <strong className="text-foreground">Discord Authentication:</strong> You sign in using your Discord account via OAuth.
            We do not create or store a separate password for you. Your Discord username, avatar, and user ID are used to
            identify you within the platform. You are responsible for maintaining the security of your Discord account.
          </p>
          <p>
            <strong className="text-foreground">One Account Per Person:</strong> Each person may only maintain one TCF account.
            Creating duplicate or alternate accounts to manipulate rankings, giveaways, tournament registrations, or any
            other system is prohibited and may result in permanent suspension.
          </p>
          <p>
            <strong className="text-foreground">Accurate Information:</strong> Any information you provide (Steam ID, OpenDota
            profile, etc.) must be accurate and belong to you. Connecting someone else's gaming profiles to your account is
            a violation of these Terms.
          </p>
        </Section>

        {/* 2. The Guild System */}
        <Section icon={<Users className="w-5 h-5 text-harvest" />} title="2. The Guild System">
          <p>
            The Corn Field operates a guild ranking system with 11 ranks and a prestige system (levels 0–5).
            Members progress by earning MVP awards in Dota 2 matches played with fellow guild members.
          </p>
          <p>
            <strong className="text-foreground">MVP Submissions:</strong> You may submit screenshots of your MVP awards for
            officer review. Submissions must be genuine — fabricated, edited, or misleading screenshots will result in
            denial and may lead to disciplinary action including rank resets or account suspension.
          </p>
          <p>
            <strong className="text-foreground">Officer Discretion:</strong> Guild officers and administrators have the authority
            to approve or deny MVP submissions, adjust ranks, issue de-ranks, and enforce guild rules at their discretion.
            We strive to be fair, but all ranking decisions are final unless overturned by the guild owner.
          </p>
          <p>
            <strong className="text-foreground">No Guaranteed Progression:</strong> Ranks, prestige levels, and all guild
            privileges are provided as part of a community experience and may be modified, reset, or restructured at any
            time without prior notice.
          </p>
        </Section>

        {/* 3. Tournaments (Kernel Kup) */}
        <Section icon={<Trophy className="w-5 h-5 text-harvest" />} title="3. Tournaments (Kernel Kup)">
          <p>
            The Corn Field organizes Dota 2 tournaments ("Kernel Kup" and related events). By registering for a tournament:
          </p>
          <ul className="list-disc ml-5 space-y-1.5">
            <li>You agree to follow the specific rules of that tournament as published on its tournament hub page.</li>
            <li>You understand that team formation, roster locks, and scheduling are managed through the platform and Discord.</li>
            <li>You agree to play your matches in good faith and complete the tournament schedule if your team advances.</li>
            <li>Tournament Directors ("TDs") and staff have the authority to make rulings on disputes, interpret rules, and
              enforce fair play during their assigned tournaments.</li>
          </ul>
          <p>
            <strong className="text-foreground">Withdrawals:</strong> If you or your team needs to withdraw from a tournament,
            please do so through the platform as early as possible. Repeated no-shows or last-minute withdrawals may affect
            your eligibility for future tournaments.
          </p>
          <p>
            <strong className="text-foreground">Prizes:</strong> Tournament prizes (if any) are distributed at the discretion of
            the tournament organizers. Prize amounts, formats, and distribution timelines are specified on a per-tournament basis.
            Prize payouts may be processed through Stripe Connect and are subject to Stripe's terms and any applicable tax obligations.
          </p>
        </Section>

        {/* 4. Secret Shop & Payments */}
        <Section icon={<ShoppingBag className="w-5 h-5 text-harvest" />} title="4. Secret Shop & Payments">
          <p>
            The Secret Shop is our storefront for purchasing digital goods and services. All payments are processed through
            Stripe. We do not directly store your credit card or payment details — that's handled entirely by Stripe in
            accordance with{' '}
            <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-harvest hover:underline font-semibold">
              Stripe's Privacy Policy
            </a>.
          </p>

          <div className="bg-muted rounded-xl p-4 border border-border space-y-3">
            <p className="font-semibold text-foreground text-sm">Products & Services:</p>
            <ul className="list-disc ml-5 space-y-1.5 text-sm">
              <li>
                <strong className="text-foreground">KKUP Tickets:</strong> Digital tickets used for tournament registration.
                Tickets are non-transferable and are consumed when used. Unused tickets remain on your account.
              </li>
              <li>
                <strong className="text-foreground">TCF+ Membership:</strong> An annual subscription that provides premium
                features and perks (visual badges, priority access, etc.). TCF+ auto-renews yearly unless cancelled.
                Cancellation takes effect at the end of your paid period — you keep your benefits for the time you've already paid for.
              </li>
              <li>
                <strong className="text-foreground">Donations:</strong> Voluntary contributions to support the community and
                prize pools. Donations are not purchases of goods or services and are non-refundable.
              </li>
              <li>
                <strong className="text-foreground">Merchandise:</strong> Physical goods fulfilled through third-party
                providers (e.g., Printful). Merch orders are subject to the fulfillment partner's shipping and return policies.
              </li>
            </ul>
          </div>

          <p>
            <strong className="text-foreground">Refund Policy:</strong> Digital goods (tickets, TCF+ subscriptions) are generally
            non-refundable once delivered or activated. If you believe a charge was made in error, contact us through Discord within
            14 days and we'll work with you to resolve it. We reserve the right to issue refunds on a case-by-case basis.
          </p>
          <p>
            <strong className="text-foreground">Price Changes:</strong> We may change prices at any time. Existing subscriptions
            will be honored at their current rate until renewal, at which point the new price applies.
          </p>
        </Section>

        {/* 5. Community Conduct */}
        <Section icon={<Scale className="w-5 h-5 text-harvest" />} title="5. Community Conduct">
          <p>
            The Corn Field is a community-first platform. We expect all members to treat each other with respect. You agree not to:
          </p>
          <ul className="list-disc ml-5 space-y-1.5">
            <li>Harass, bully, threaten, or discriminate against other members.</li>
            <li>Cheat, exploit bugs, or manipulate any system (rankings, giveaways, tournaments, etc.).</li>
            <li>Impersonate other users, officers, or administrators.</li>
            <li>Share content that is illegal, harmful, or violates the rights of others.</li>
            <li>Attempt to access other users' accounts or private data.</li>
            <li>Use the platform for commercial advertising or spam without permission.</li>
            <li>Reverse-engineer, scrape, or interfere with the platform's operation.</li>
          </ul>
          <p>
            Violations may result in warnings, temporary suspensions, permanent bans, rank resets, forfeiture of prizes,
            or any other action deemed appropriate by guild leadership.
          </p>
        </Section>

        {/* 6. Intellectual Property */}
        <Section icon={<FileText className="w-5 h-5 text-harvest" />} title="6. Intellectual Property">
          <p>
            The Corn Field name, logo, brand assets, and all original content on this platform are the property of
            The Corn Field and its creators. You may not use our branding, logos, or content for commercial purposes
            without written permission.
          </p>
          <p>
            Dota 2, its heroes, items, and related content are trademarks and copyrights of Valve Corporation. The Corn Field
            is a fan community and is not endorsed by, affiliated with, or sponsored by Valve Corporation.
          </p>
          <p>
            Content you submit (MVP screenshots, team logos, etc.) remains yours, but you grant us a non-exclusive,
            royalty-free license to display it within the platform (e.g., on leaderboards, tournament pages, galleries).
          </p>
        </Section>

        {/* 7. Third-Party Services */}
        <Section icon={<ShieldCheck className="w-5 h-5 text-harvest" />} title="7. Third-Party Services">
          <p>
            Our platform integrates with several third-party services. Your use of these services is governed by their
            respective terms and privacy policies:
          </p>
          <ul className="list-disc ml-5 space-y-1.5">
            <li><strong className="text-foreground">Discord</strong> — Authentication, community hub, notifications</li>
            <li><strong className="text-foreground">Stripe</strong> — Payment processing, subscriptions, prize payouts</li>
            <li><strong className="text-foreground">Supabase</strong> — Database and backend infrastructure</li>
            <li><strong className="text-foreground">OpenDota API</strong> — Dota 2 match and player statistics</li>
            <li><strong className="text-foreground">Steam Web API</strong> — Player identity and game data</li>
            <li><strong className="text-foreground">Printful</strong> — Merchandise fulfillment (when applicable)</li>
          </ul>
          <p>
            We are not responsible for the availability, accuracy, or policies of these third-party services.
          </p>
        </Section>

        {/* 8. Disclaimers & Limitations */}
        <Section icon={<AlertTriangle className="w-5 h-5 text-harvest" />} title="8. Disclaimers & Limitations">
          <p>
            <strong className="text-foreground">As-Is Service:</strong> The Corn Field is provided "as is" and "as available"
            without warranties of any kind, express or implied. We do not guarantee that the platform will be uninterrupted,
            error-free, or secure at all times.
          </p>
          <p>
            <strong className="text-foreground">Limitation of Liability:</strong> To the maximum extent permitted by law,
            The Corn Field, its creators, officers, and staff shall not be liable for any indirect, incidental, special,
            consequential, or punitive damages arising from your use of the platform, including but not limited to loss of
            data, loss of rankings, tournament outcomes, or payment processing issues.
          </p>
          <p>
            <strong className="text-foreground">Indemnification:</strong> You agree to indemnify and hold harmless
            The Corn Field and its team from any claims, damages, or expenses arising from your violation of these Terms
            or your use of the platform.
          </p>
        </Section>

        {/* 9. Termination */}
        <Section icon={<ShieldCheck className="w-5 h-5 text-harvest" />} title="9. Account Termination">
          <p>
            <strong className="text-foreground">By You:</strong> You can stop using the platform at any time. If you'd like
            your account data deleted, contact us through Discord and we'll handle it.
          </p>
          <p>
            <strong className="text-foreground">By Us:</strong> We may suspend or terminate your account at any time for
            violations of these Terms, disruptive behavior, or at our discretion. If you have an active TCF+ subscription,
            we will honor the remainder of your paid period unless termination was due to a serious violation (fraud,
            abuse, etc.).
          </p>
        </Section>

        {/* 10. Changes to Terms */}
        <Section icon={<FileText className="w-5 h-5 text-harvest" />} title="10. Changes to These Terms">
          <p>
            We may update these Terms from time to time. When we do, we'll update the "Effective" date at the top and
            may notify you through the platform or Discord. Continued use of the platform after changes constitutes
            acceptance of the new Terms.
          </p>
          <p>
            For significant changes (especially those affecting payments or your rights), we'll make reasonable efforts
            to provide advance notice.
          </p>
        </Section>

        {/* 11. Contact */}
        <Section icon={<Mail className="w-5 h-5 text-harvest" />} title="11. Contact Us">
          <p>
            Questions, concerns, or feedback about these Terms? Reach out to us:
          </p>
          <div className="bg-muted rounded-xl p-4 border border-border">
            <ul className="space-y-2 text-sm">
              <li>
                <strong className="text-foreground">Discord:</strong>{' '}
                <a href={CONTACT_DISCORD} target="_blank" rel="noopener noreferrer" className="text-harvest hover:underline font-semibold">
                  The Corn Field Discord Server
                </a>
              </li>
              <li>
                <strong className="text-foreground">Website:</strong>{' '}
                <span className="text-foreground">thecornfield.app</span>
              </li>
            </ul>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            These Terms are governed by the laws of the United States. Any disputes shall be resolved through good-faith
            discussion first, and if necessary, through binding arbitration.
          </p>
        </Section>
      </div>

      <Footer />
    </div>
  );
}