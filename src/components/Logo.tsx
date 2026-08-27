import React from 'react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  theme?: 'light' | 'dark';
}

export default function Logo({ className = '', size = 'md', theme = 'light' }: LogoProps) {
  const sizes = {
    sm: 'text-2xl',
    md: 'text-4xl',
    lg: 'text-5xl'
  };

  const currentSize = sizes[size];
  
  const firstPartColor = theme === 'light' ? 'text-[#0047AB]' : 'text-blue-400';
  const secondPartColor = theme === 'light' ? 'text-slate-900' : 'text-white';

  return (
    <div className={`flex items-center justify-center font-bold tracking-tight ${currentSize} ${className}`}>
      <span className={`${firstPartColor} transition-colors`}>CREDI</span>
      <span className={`${secondPartColor} transition-colors`}>CEL</span>
    </div>
  );
}
