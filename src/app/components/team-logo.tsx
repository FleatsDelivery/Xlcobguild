import React from 'react';

interface TeamLogoProps {
  logoUrl?: string | null;
  teamName: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function TeamLogo({ logoUrl, teamName, size = 'md', className = '' }: TeamLogoProps) {
  const sizeClasses = {
    sm: 'w-12 h-8 text-lg',
    md: 'w-16 h-11 text-2xl',
    lg: 'w-20 h-14 text-3xl',
    xl: 'w-32 h-22 text-5xl',
  };

  if (!logoUrl) {
    return (
      <div 
        className={`${sizeClasses[size]} rounded-lg bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-md ${className}`}
        title={`${teamName} (No logo)`}
      >
        <span className="leading-none">🌽</span>
      </div>
    );
  }

  return (
    <img
      src={logoUrl}
      alt={`${teamName} logo`}
      className={`${sizeClasses[size]} rounded-lg object-cover shadow-md ${className}`}
    />
  );
}