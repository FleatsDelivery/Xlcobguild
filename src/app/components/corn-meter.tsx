import React from 'react';
import { TrendingUp, Zap } from 'lucide-react';

interface CornMeterProps {
  kernels: number;
  mvpCount?: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * CornMeter — A high-fidelity 'Gaming HUD' status badge for Guild Rank Score and stats.
 */
export const CornMeter: React.FC<CornMeterProps> = ({
  kernels,
  mvpCount,
  size = 'sm',
  className = '',
}) => {
  return (
    <div className={`relative group ${className}`}>
      {/* HUD Background with Hexagonal-ish clip */}
      <div className="relative bg-black/90 backdrop-blur-xl border border-harvest/30 p-0 rounded-xl overflow-hidden shadow-[0_0_20px_rgba(251,191,36,0.15)] group-hover:shadow-[0_0_30px_rgba(251,191,36,0.3)] transition-all duration-500 min-w-[140px]">
        
        {/* Animated Scanline Effect */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-harvest/5 to-transparent h-1/2 w-full animate-scanline pointer-events-none" />

        <div className="flex divide-x divide-harvest/20 h-full">
           {/* Column 1: Rank Score */}
           <div className="flex-1 px-4 py-2.5 flex flex-col items-center justify-center min-w-[80px]">
              <div className="flex items-center gap-1.5 mb-0.5">
                 <div className="relative">
                    <TrendingUp className="w-3 h-3 text-harvest animate-pulse" />
                 </div>
                 <span className="text-[8px] font-black text-harvest uppercase tracking-[0.2em] whitespace-nowrap">
                   SCORE
                 </span>
              </div>
              
              <div className="relative">
                 <span className="text-xl font-black text-white tabular-nums tracking-tighter drop-shadow-lg">
                   {kernels.toLocaleString()}
                 </span>
                 <div className="absolute -top-1 -left-2 -right-2 h-px bg-white/20 blur-[1px]" />
              </div>
           </div>

           {/* Column 2: MVP Count (if provided) */}
           {mvpCount !== undefined && (
              <div className="flex-1 px-4 py-2.5 flex flex-col items-center justify-center min-w-[80px] bg-white/5">
                 <div className="flex items-center gap-1.5 mb-0.5">
                    <div className="relative">
                       <Zap className="w-3 h-3 text-amber-400 group-hover:scale-110 transition-transform" />
                    </div>
                    <span className="text-[8px] font-black text-amber-400/80 uppercase tracking-[0.2em] whitespace-nowrap">
                      MVP
                    </span>
                 </div>
                 
                 <div className="relative">
                    <span className="text-xl font-black text-white tabular-nums tracking-tighter drop-shadow-lg">
                      {Number(mvpCount).toLocaleString()}
                    </span>
                    <div className="absolute -top-1 -left-2 -right-2 h-px bg-white/20 blur-[1px]" />
                 </div>
              </div>
           )}
        </div>

        {/* Decorative HUD Corners */}
        <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-harvest/50 rounded-tl-sm" />
        <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-harvest/50 rounded-br-sm" />
      </div>

      {/* Outer Glow */}
      <div className="absolute -inset-1 bg-harvest/5 blur-xl group-hover:bg-harvest/10 transition-all -z-10" />
    </div>
  );
};
