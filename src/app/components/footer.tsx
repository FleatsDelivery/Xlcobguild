// ─── SVG paths ───────────────────────────────────────────
const DiscordSvg = () => (
  <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
  </svg>
);

const YouTubeSvg = () => (
  <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
);

const SteamSvg = () => (
  <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
    <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.5 1.009 2.455-.397.957-1.497 1.41-2.454 1.012H7.54zm11.415-9.303a3.015 3.015 0 0 0-3.016-3.016 3.015 3.015 0 0 0-3.014 3.016 3.015 3.015 0 0 0 3.014 3.014 3.016 3.016 0 0 0 3.016-3.014zm-5.273-.005c0-1.248 1.013-2.26 2.26-2.26 1.246 0 2.26 1.013 2.26 2.26 0 1.247-1.014 2.26-2.26 2.26-1.248 0-2.26-1.013-2.26-2.26z"/>
  </svg>
);

const TwitchSvg = () => (
  <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
    <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/>
  </svg>
);

// ─── Social link data ─────────────────────────────────────
const SOCIAL_LINKS = [
  { href: 'https://discord.gg/rHYPrdYGGh',                    label: 'Discord', Icon: DiscordSvg },
  { href: 'https://www.youtube.com/@TheCornField_',            label: 'YouTube', Icon: YouTubeSvg },
  { href: 'https://steamcommunity.com/groups/TheCornField',    label: 'Steam',   Icon: SteamSvg  },
] as const;

const TWITCH_LINKS = [
  { href: 'https://www.twitch.tv/kernelkup_tv1', label: 'KK TV1', Icon: TwitchSvg },
  { href: 'https://www.twitch.tv/kernelkup_tv2', label: 'KK TV2', Icon: TwitchSvg },
  { href: 'https://www.twitch.tv/kernelkup_tv3', label: 'KK TV3', Icon: TwitchSvg },
  { href: 'https://www.twitch.tv/kernelkup_tv4', label: 'KK TV4', Icon: TwitchSvg },
] as const;

// ─── Footer ───────────────────────────────────────────────
export function Footer() {
  return (
    <footer className="mt-12 sm:mt-24">
      {/* Social links — above the divider */}
      <div className="pb-6 px-4">
        <div className="flex items-start justify-center gap-2 sm:gap-3 flex-wrap">
          {/* Discord / YouTube / Steam */}
          {SOCIAL_LINKS.map(({ href, label, Icon }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              title={label}
              className="group flex flex-col items-center gap-1"
            >
              <div className="w-10 h-10 rounded-xl bg-soil flex items-center justify-center shadow-sm hover:shadow-md hover:scale-110 transition-all">
                <Icon />
              </div>
              <span className="text-[9px] font-bold text-muted-foreground tracking-wide uppercase">{label}</span>
            </a>
          ))}

          {/* Vertical divider */}
          <div className="w-px h-10 bg-border mx-0.5 self-start mt-0" />

          {/* KK TV1–4 */}
          {TWITCH_LINKS.map(({ href, label, Icon }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              title={`Twitch – Kernel Kup ${label}`}
              className="group flex flex-col items-center gap-1"
            >
              <div className="w-10 h-10 rounded-xl bg-soil flex items-center justify-center shadow-sm hover:shadow-md hover:scale-110 transition-all">
                <Icon />
              </div>
              <span className="text-[9px] font-bold text-muted-foreground tracking-wide uppercase">{label}</span>
            </a>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="max-w-4xl mx-auto mb-6 px-4">
        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      </div>

      {/* Bottom links + credit */}
      <div className="pb-6 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-center gap-4 mb-3">
            <a href="#transparency" className="text-xs font-medium text-muted-foreground hover:text-harvest transition-colors uppercase tracking-wide">
              Transparency
            </a>
            <div className="w-1 h-1 rounded-full bg-border" />
            <a href="#privacy" className="text-xs font-medium text-muted-foreground hover:text-harvest transition-colors uppercase tracking-wide">
              Privacy
            </a>
            <div className="w-1 h-1 rounded-full bg-border" />
            <a href="#terms" className="text-xs font-medium text-muted-foreground hover:text-harvest transition-colors uppercase tracking-wide">
              Terms
            </a>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground/60 font-light">
              Made with 🌽 by <span className="font-medium text-harvest/70">Kernel</span>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}