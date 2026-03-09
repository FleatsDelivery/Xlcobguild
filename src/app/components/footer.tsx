export function Footer() {
  return (
    <footer className="mt-12 sm:mt-24">
      {/* Separator */}
      <div className="max-w-4xl mx-auto mb-8 px-4">
        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent"></div>
      </div>

      <div className="pb-6 px-4">
        <div className="max-w-2xl mx-auto">
          {/* Links */}
          <div className="flex items-center justify-center gap-4 mb-3">
            <a
              href="#transparency"
              className="text-xs font-medium text-muted-foreground hover:text-harvest transition-colors uppercase tracking-wide"
            >
              Transparency
            </a>
            <div className="w-1 h-1 rounded-full bg-border"></div>
            <a
              href="#privacy"
              className="text-xs font-medium text-muted-foreground hover:text-harvest transition-colors uppercase tracking-wide"
            >
              Privacy
            </a>
            <div className="w-1 h-1 rounded-full bg-border"></div>
            <a
              href="#terms"
              className="text-xs font-medium text-muted-foreground hover:text-harvest transition-colors uppercase tracking-wide"
            >
              Terms
            </a>
          </div>

          {/* Made by */}
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