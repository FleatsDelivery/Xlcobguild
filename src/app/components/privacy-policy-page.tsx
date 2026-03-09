/**
 * Privacy Policy Page
 *
 * Comprehensive privacy policy covering Discord OAuth, Steam/OpenDota data,
 * Stripe payments, Supabase storage, cookies/localStorage, and user rights.
 * Written in plain language while meeting legal requirements.
 */

import { Shield, Database, Eye, Cookie, UserX, RefreshCw, Bell, Mail } from 'lucide-react';
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
        <div className="w-10 h-10 rounded-full bg-[#3b82f6]/10 flex items-center justify-center flex-shrink-0">
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

export function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-background px-3 sm:px-4 py-4">
      <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-br from-[#3b82f6]/10 to-[#3b82f6]/5 rounded-2xl sm:rounded-3xl p-4 sm:p-8 border-2 border-[#3b82f6]/20">
          <div className="flex items-center gap-3 sm:gap-4 mb-2">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-[#3b82f6] flex items-center justify-center flex-shrink-0">
              <Shield className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Privacy Policy</h1>
              <p className="text-muted-foreground text-xs sm:text-sm">
                Effective: {EFFECTIVE_DATE}
              </p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-3">
            The Corn Field ("TCF", "we", "us", "our") respects your privacy. This Privacy Policy explains what
            information we collect, how we use it, who we share it with, and what rights you have. We've written
            this in plain English because nobody likes reading walls of legalese.
          </p>
          <div className="bg-card rounded-xl p-3 mt-3 border border-border">
            <p className="text-xs text-muted-foreground">
              <strong className="text-foreground">TL;DR:</strong> We collect what we need to run the platform (your Discord
              profile, optional gaming stats, payment info via Stripe). We don't sell your data. We don't track you across
              the internet. We store things securely. You can ask us to delete your data anytime.
            </p>
          </div>
        </div>

        {/* 1. What We Collect */}
        <Section icon={<Database className="w-5 h-5 text-[#3b82f6]" />} title="1. Information We Collect">
          <p className="font-semibold text-foreground">Information you provide directly:</p>
          <div className="bg-muted rounded-xl p-4 border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 pr-4 font-bold text-foreground">Data</th>
                  <th className="text-left py-2 font-bold text-foreground">Why</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr>
                  <td className="py-2 pr-4 font-medium text-foreground">Discord username, avatar, user ID</td>
                  <td className="py-2">Your identity on the platform. Collected via Discord OAuth when you sign in.</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-foreground">Steam ID</td>
                  <td className="py-2">Optional. Links your Dota 2 profile for stats, tournament history, and rank verification.</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-foreground">MVP screenshots</td>
                  <td className="py-2">Submitted by you for rank advancement. Reviewed by officers.</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-foreground">Team logos & gallery images</td>
                  <td className="py-2">Uploaded for tournament teams and event galleries.</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="font-semibold text-foreground mt-2">Information collected automatically:</p>
          <div className="bg-muted rounded-xl p-4 border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 pr-4 font-bold text-foreground">Data</th>
                  <th className="text-left py-2 font-bold text-foreground">Why</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr>
                  <td className="py-2 pr-4 font-medium text-foreground">OpenDota / Steam stats</td>
                  <td className="py-2">Pulled from public APIs when you link your Steam ID. Includes Dota 2 rank, top heroes, win/loss data.</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-foreground">Activity logs</td>
                  <td className="py-2">Actions you take on the platform (registrations, team joins, submissions). Visible in your Inbox.</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-foreground">Supabase auth session</td>
                  <td className="py-2">Managed by Supabase for authentication. Includes session tokens (not passwords).</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="font-semibold text-foreground mt-2">Payment information:</p>
          <p>
            When you make a purchase through the Secret Shop, payment is processed entirely by{' '}
            <a href="https://stripe.com" target="_blank" rel="noopener noreferrer" className="text-[#3b82f6] hover:underline font-semibold">
              Stripe
            </a>.
            We <strong className="text-foreground">never</strong> see, store, or have access to your full credit card number.
            We receive from Stripe: a customer ID, transaction status, subscription status, and basic receipt information
            (amount, date, product). This is stored in our database for order history and account status.
          </p>

          <p className="font-semibold text-foreground mt-2">What we do NOT collect:</p>
          <ul className="list-disc ml-5 space-y-1">
            <li>Your real name (unless you choose to share it)</li>
            <li>Your physical address (merch orders handle shipping through Stripe/Printful directly)</li>
            <li>Your email address for marketing (we use Discord for all communication)</li>
            <li>Browsing activity on other websites</li>
            <li>Location data, device fingerprints, or advertising identifiers</li>
          </ul>
        </Section>

        {/* 2. How We Use It */}
        <Section icon={<Eye className="w-5 h-5 text-[#3b82f6]" />} title="2. How We Use Your Information">
          <p>We use the information we collect to:</p>
          <ul className="list-disc ml-5 space-y-1.5">
            <li><strong className="text-foreground">Provide the service</strong> — authenticate you, display your profile, track your guild rank and tournament history.</li>
            <li><strong className="text-foreground">Run tournaments</strong> — manage registrations, team rosters, match results, and prize distribution.</li>
            <li><strong className="text-foreground">Process payments</strong> — fulfill Secret Shop purchases, manage TCF+ subscriptions, distribute prize payouts.</li>
            <li><strong className="text-foreground">Show relevant stats</strong> — pull your Dota 2 data from OpenDota to display on your profile, tournament cards, and leaderboards.</li>
            <li><strong className="text-foreground">Send notifications</strong> — team invites, approval decisions, tournament updates (all in-app, not email).</li>
            <li><strong className="text-foreground">Maintain community health</strong> — officer tools for reviewing submissions, managing conduct, and admin logs.</li>
            <li><strong className="text-foreground">Improve the platform</strong> — understand usage patterns to build better features (we don't use third-party analytics trackers).</li>
          </ul>
          <p>
            <strong className="text-foreground">We do not sell, rent, or trade your personal information to anyone.</strong> Period.
          </p>
        </Section>

        {/* 3. Who We Share With */}
        <Section icon={<Shield className="w-5 h-5 text-[#3b82f6]" />} title="3. Who We Share Information With">
          <p>
            We share your information only with the services needed to operate the platform:
          </p>
          <div className="bg-muted rounded-xl p-4 border border-border space-y-3">
            <div>
              <p className="font-semibold text-foreground text-sm">Supabase</p>
              <p className="text-sm">Our database and authentication provider. Stores your account data, guild data, and session info. Hosted in the US.</p>
            </div>
            <div className="border-t border-border pt-3">
              <p className="font-semibold text-foreground text-sm">Stripe</p>
              <p className="text-sm">Payment processor. Receives your payment details when you make a purchase. We only receive transaction confirmations and customer IDs back from Stripe.</p>
            </div>
            <div className="border-t border-border pt-3">
              <p className="font-semibold text-foreground text-sm">Discord</p>
              <p className="text-sm">Authentication provider. We read your public profile info (username, avatar, ID) during sign-in via OAuth. We also use Discord webhooks for tournament notifications.</p>
            </div>
            <div className="border-t border-border pt-3">
              <p className="font-semibold text-foreground text-sm">OpenDota API / Steam Web API</p>
              <p className="text-sm">Public APIs. We send your Steam ID to retrieve publicly available Dota 2 match data and rank information. These APIs don't receive any TCF account data.</p>
            </div>
            <div className="border-t border-border pt-3">
              <p className="font-semibold text-foreground text-sm">Printful (when applicable)</p>
              <p className="text-sm">Merchandise fulfillment. If you order merch, your shipping address is provided to Printful for order fulfillment — we do not store your address ourselves.</p>
            </div>
          </div>
          <p>
            <strong className="text-foreground">Public visibility:</strong> Your Discord username, avatar, guild rank, prestige level,
            tournament stats, and Dota 2 rank are visible to other authenticated members on leaderboards, tournament pages,
            and team rosters. This is core to how the community works.
          </p>
        </Section>

        {/* 4. Cookies & Local Storage */}
        <Section icon={<Cookie className="w-5 h-5 text-[#3b82f6]" />} title="4. Cookies & Local Storage">
          <p>
            We use minimal browser storage — only what's required for the app to function. No tracking cookies, no analytics
            cookies, no advertising pixels.
          </p>
          <div className="bg-muted rounded-xl p-4 border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 pr-4 font-bold text-foreground">Storage Key</th>
                  <th className="text-left py-2 font-bold text-foreground">Purpose</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr>
                  <td className="py-2 pr-4 font-mono text-xs text-foreground">sb-*-auth-token</td>
                  <td className="py-2">Supabase authentication session (keeps you logged in).</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-mono text-xs text-foreground">tcf_theme</td>
                  <td className="py-2">Your light/dark mode preference.</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-mono text-xs text-foreground">tcf_current_hash</td>
                  <td className="py-2">Remembers which page you were on (navigation state).</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            That's it. No Google Analytics, no Facebook Pixel, no advertising networks. We don't track you across websites.
          </p>
        </Section>

        {/* 5. Data Storage & Security */}
        <Section icon={<Database className="w-5 h-5 text-[#3b82f6]" />} title="5. Data Storage & Security">
          <p>
            Your data is stored in Supabase's infrastructure (PostgreSQL database, edge functions, and file storage).
            Supabase provides enterprise-grade security including:
          </p>
          <ul className="list-disc ml-5 space-y-1">
            <li>Encryption in transit (TLS/HTTPS everywhere)</li>
            <li>Encryption at rest for database storage</li>
            <li>Row-level security policies on database tables</li>
            <li>API authentication via JWT tokens</li>
          </ul>
          <p>
            Uploaded files (MVP screenshots, team logos, gallery images) are stored in private Supabase Storage buckets
            and served via signed URLs with expiration.
          </p>
          <p>
            <strong className="text-foreground">No system is 100% secure.</strong> While we take reasonable measures to protect
            your data, we cannot guarantee absolute security. If you become aware of a security vulnerability, please report
            it to us through Discord immediately.
          </p>
        </Section>

        {/* 6. Data Retention */}
        <Section icon={<RefreshCw className="w-5 h-5 text-[#3b82f6]" />} title="6. Data Retention">
          <p>
            We retain your data for as long as your account is active. Specific retention details:
          </p>
          <ul className="list-disc ml-5 space-y-1.5">
            <li><strong className="text-foreground">Account data</strong> — kept until you request deletion or your account is terminated.</li>
            <li><strong className="text-foreground">Activity logs</strong> — automatically pruned after 90 days (you can "freeze" important entries to keep them longer).</li>
            <li><strong className="text-foreground">Notifications</strong> — dismissed notifications are deleted; unread ones are kept until dismissed or pruned.</li>
            <li><strong className="text-foreground">Tournament history</strong> — kept indefinitely as part of the community's historical record (Kernel Kup archives).</li>
            <li><strong className="text-foreground">Payment records</strong> — order history is kept for accounting and dispute resolution purposes, as required by law.</li>
            <li><strong className="text-foreground">Admin logs</strong> — kept for accountability and audit trail purposes.</li>
          </ul>
        </Section>

        {/* 7. Your Rights */}
        <Section icon={<UserX className="w-5 h-5 text-[#3b82f6]" />} title="7. Your Rights">
          <p>
            You have the following rights regarding your data:
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="bg-muted rounded-xl p-4 border border-border">
              <p className="font-semibold text-foreground text-sm mb-1">Access</p>
              <p className="text-sm">You can view most of your data directly in the app (profile, activity log, order history).</p>
            </div>
            <div className="bg-muted rounded-xl p-4 border border-border">
              <p className="font-semibold text-foreground text-sm mb-1">Correction</p>
              <p className="text-sm">Your Discord info syncs from Discord. For other data, contact us to correct inaccuracies.</p>
            </div>
            <div className="bg-muted rounded-xl p-4 border border-border">
              <p className="font-semibold text-foreground text-sm mb-1">Deletion</p>
              <p className="text-sm">Contact us through Discord to request full account deletion. We'll remove your data within 30 days.</p>
            </div>
            <div className="bg-muted rounded-xl p-4 border border-border">
              <p className="font-semibold text-foreground text-sm mb-1">Data Export</p>
              <p className="text-sm">Contact us to request an export of your data. We'll provide it in a reasonable format.</p>
            </div>
          </div>
          <p>
            <strong className="text-foreground">Note on tournament records:</strong> If you request deletion, your personal
            info will be removed, but anonymized tournament match results may be retained as part of the community's historical
            record (e.g., "Player withdrew" instead of your name).
          </p>
        </Section>

        {/* 8. Children's Privacy */}
        <Section icon={<Shield className="w-5 h-5 text-[#3b82f6]" />} title="8. Children's Privacy">
          <p>
            The Corn Field is not intended for children under 13. We do not knowingly collect personal information from
            anyone under 13 years of age. If you are a parent or guardian and believe your child under 13 has provided
            us with personal information, please contact us through Discord and we will promptly delete it.
          </p>
          <p>
            Users between 13 and 18 should use the platform with parental awareness. The payment features (Secret Shop)
            may have additional age requirements per Stripe's terms.
          </p>
        </Section>

        {/* 9. Changes to Policy */}
        <Section icon={<Bell className="w-5 h-5 text-[#3b82f6]" />} title="9. Changes to This Policy">
          <p>
            We may update this Privacy Policy as the platform evolves. When we make changes:
          </p>
          <ul className="list-disc ml-5 space-y-1">
            <li>We'll update the "Effective" date at the top of this page.</li>
            <li>For significant changes, we'll post a notification in our Discord server.</li>
            <li>Continued use of the platform after changes constitutes acceptance of the updated policy.</li>
          </ul>
        </Section>

        {/* 10. Contact */}
        <Section icon={<Mail className="w-5 h-5 text-[#3b82f6]" />} title="10. Contact Us">
          <p>
            If you have questions about this Privacy Policy, want to exercise your data rights, or have concerns about
            how your information is handled:
          </p>
          <div className="bg-muted rounded-xl p-4 border border-border">
            <ul className="space-y-2 text-sm">
              <li>
                <strong className="text-foreground">Discord:</strong>{' '}
                <a href={CONTACT_DISCORD} target="_blank" rel="noopener noreferrer" className="text-[#3b82f6] hover:underline font-semibold">
                  The Corn Field Discord Server
                </a>
                {' '}— message any officer or admin
              </li>
              <li>
                <strong className="text-foreground">Website:</strong>{' '}
                <span className="text-foreground">thecornfield.app</span>
              </li>
            </ul>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            For users in the European Economic Area (EEA), you have additional rights under GDPR including the right
            to lodge a complaint with your local data protection authority. For California residents, you have additional
            rights under the CCPA. Contact us to exercise any of these rights.
          </p>
        </Section>
      </div>

      <Footer />
    </div>
  );
}