/**
 * Choose Your Path — One-door registration flow
 *
 * Appears when a user hasn't registered yet (replaces the old "Ready to compete?" CTA).
 * Three paths: Player, Coach, Staff.
 * Each card click triggers registration with the chosen role directly.
 */

import { useState } from 'react';
import {
  Swords, GraduationCap, Headphones,
  Loader2, ArrowRight, Sparkles, Crown,
} from '@/lib/icons';
import { TcfPlusBadge } from './tcf-plus-badge';

interface ChooseYourPathProps {
  tournamentName: string;
  tournamentType: string;
  isRankIneligible: boolean; // Divine 2+ / Immortal — can't pick Player
  registering: boolean;
  onRegisterWithRole: (role: string) => void;
  onOpenStaffModal: () => void;
  isEarlyAccess?: boolean;   // TCF+ early registration during upcoming phase
}

interface PathOption {
  role: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  description: string;
  color: string;
  disabled?: boolean;
  disabledReason?: string;
}

export function ChooseYourPath({
  tournamentName, tournamentType,
  isRankIneligible, registering, onRegisterWithRole, onOpenStaffModal,
  isEarlyAccess,
}: ChooseYourPathProps) {
  const [choosingRole, setChoosingRole] = useState<string | null>(null);

  const handleChoose = (role: string) => {
    // Staff path opens the staff modal instead of directly registering
    if (role === 'staff') {
      onOpenStaffModal();
      return;
    }

    setChoosingRole(role);
    onRegisterWithRole(role);
  };

  const isLoading = registering || choosingRole !== null;

  const paths: PathOption[] = [
    {
      role: 'player',
      icon: <Swords className="w-7 h-7" />,
      title: 'Player',
      subtitle: 'Join the fight',
      description: 'Enter the free agent pool. Coaches can invite you to their team.',
      color: '#3b82f6',
      disabled: isRankIneligible,
      disabledReason: isRankIneligible ? 'Your rank is above the eligibility threshold (Divine 2+)' : undefined,
    },
    {
      role: 'coach',
      icon: <GraduationCap className="w-7 h-7" />,
      title: 'Coach',
      subtitle: 'Build & lead a team',
      description: 'Create a team, recruit players from the free agent pool, and optionally coach in-game. No rank limit.',
      color: '#10b981',
    },
    {
      role: 'staff',
      icon: <Headphones className="w-7 h-7" />,
      title: 'Staff',
      subtitle: 'Run the show',
      description: 'Apply as a Caster, Producer, Helper, or other crew. Staff roles are exclusive — you can\'t also play.',
      color: '#f59e0b',
    },
  ];

  return (
    <div
      className="relative overflow-hidden rounded-2xl border-2 border-harvest/30 bg-card"
      style={{ boxShadow: '0 0 32px rgba(214,166,21,0.08)' }}
    >
      {/* Header */}
      <div className={`p-4 sm:p-6 border-b border-border ${
        isEarlyAccess
          ? 'bg-gradient-to-r from-harvest/15 via-kernel-gold/8 to-harvest/10'
          : 'bg-gradient-to-r from-harvest/10 via-harvest/5 to-transparent'
      }`}>
        <div className="flex items-center gap-3">
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center ${
              isEarlyAccess
                ? 'bg-gradient-to-br from-harvest to-kernel-gold shadow-lg'
                : 'bg-harvest/15'
            }`}
          >
            {isEarlyAccess
              ? <Crown className="w-6 h-6 text-white" />
              : <Sparkles className="w-6 h-6 text-harvest" />
            }
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-black text-foreground">
                {isEarlyAccess ? 'Early Access Registration' : 'Choose Your Path'}
              </h3>
              {isEarlyAccess && <TcfPlusBadge size="sm" />}
            </div>
            <p className="text-sm text-muted-foreground">
              {isEarlyAccess
                ? <>Register now before public registration opens for <span className="font-semibold text-foreground">{tournamentName}</span></>
                : <>How do you want to participate in <span className="font-semibold text-foreground">{tournamentName}</span>?</>
              }
            </p>
          </div>
        </div>
      </div>

      {/* Path Cards — 3-column on desktop */}
      <div className="p-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {paths.map((path, i) => {
            const isDisabled = path.disabled || (isLoading && choosingRole !== path.role);
            const isChoosing = choosingRole === path.role && registering;

            return (
              <button
                key={path.role}
                onClick={() => !isDisabled && !isLoading && handleChoose(path.role)}
                disabled={isDisabled || isLoading}
                className={`
                  relative text-left rounded-xl border-2 p-5 transition-all duration-200 group
                  ${isDisabled
                    ? 'opacity-40 cursor-not-allowed border-border bg-muted/50'
                    : 'border-border hover:border-opacity-60 cursor-pointer bg-card hover:bg-muted/30'
                  }
                  ${isChoosing ? 'ring-2 ring-offset-2 ring-offset-card' : ''}
                `}
                style={{
                  borderColor: isDisabled ? undefined : `${path.color}20`,
                  ...(isChoosing ? { ringColor: path.color } : {}),
                }}
              >
                {/* Icon */}
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110"
                  style={{ backgroundColor: `${path.color}12`, color: path.color }}
                >
                  {isChoosing ? <Loader2 className="w-6 h-6 animate-spin" /> : path.icon}
                </div>

                {/* Title + subtitle */}
                <h4 className="text-base font-black text-foreground mb-0.5">
                  {path.title}
                </h4>
                <p className="text-xs font-bold mb-2" style={{ color: path.color }}>
                  {path.subtitle}
                </p>

                {/* Description */}
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {path.disabled ? path.disabledReason : path.description}
                </p>

                {/* Hover arrow */}
                {!isDisabled && !isChoosing && (
                  <div
                    className="absolute top-5 right-5 w-7 h-7 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ backgroundColor: `${path.color}15`, color: path.color }}
                  >
                    <ArrowRight className="w-4 h-4" />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Hint text */}
        <p className="text-xs text-muted-foreground text-center mt-5">
          {isEarlyAccess
            ? 'TCF+ members get early registration access for all tournaments. You can change your role later.'
            : 'You can change your role later as long as the tournament hasn\'t gone live.'
          }
        </p>
      </div>
    </div>
  );
}