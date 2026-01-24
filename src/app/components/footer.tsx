export function Footer() {
  return (
    <footer className="mt-24">
      {/* Separator */}
      <div className="max-w-4xl mx-auto mb-8 px-4">
        <div className="h-px bg-gradient-to-r from-transparent via-[#0f172a]/10 to-transparent"></div>
      </div>

      <div className="pb-6 px-4">
        <div className="max-w-2xl mx-auto">
          {/* Links */}
          <div className="flex items-center justify-center gap-4 mb-3">
            <a
              href="https://discord.gg/rHYPrdYGGh"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-[#0f172a]/50 hover:text-[#f97316] transition-colors uppercase tracking-wide"
            >
              Discord
            </a>
            <div className="w-1 h-1 rounded-full bg-[#0f172a]/20"></div>
            <a
              href="/privacy"
              className="text-xs font-medium text-[#0f172a]/50 hover:text-[#f97316] transition-colors uppercase tracking-wide"
            >
              Privacy
            </a>
            <div className="w-1 h-1 rounded-full bg-[#0f172a]/20"></div>
            <a
              href="/terms"
              className="text-xs font-medium text-[#0f172a]/50 hover:text-[#f97316] transition-colors uppercase tracking-wide"
            >
              TOS
            </a>
          </div>

          {/* Made by */}
          <div className="text-center">
            <p className="text-xs text-[#0f172a]/30 font-light">
              Made with 🌽 by <span className="font-medium text-[#f97316]/70">Kernel</span>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}