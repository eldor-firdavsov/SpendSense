import React from 'react';
import Image from 'next/image';

interface SpendSenseLogoProps {
  /**
   * 'icon': Faqat ramz (S monogrami)
   * 'full': To‘liq logo (S ramzi + SpendSense matni)
   */
  variant?: 'icon' | 'full';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  priority?: boolean;
}

export default function SpendSenseLogo({
  variant = 'icon',
  size = 'md',
  className = '',
  priority = true,
}: SpendSenseLogoProps) {
  if (variant === 'full') {
    const sizeClasses = {
      sm: 'h-8 w-auto',
      md: 'h-10 w-auto',
      lg: 'h-14 w-auto',
      xl: 'h-20 w-auto',
    };

    return (
      <div className={`inline-flex items-center justify-center ${className}`}>
        <Image
          src="/spendsense-logo-transparent.png"
          alt="SpendSense AI"
          width={180}
          height={180}
          priority={priority}
          className={`${sizeClasses[size]} object-contain`}
        />
      </div>
    );
  }

  // Variant: icon
  const containerSizes = {
    sm: 'h-7 w-7',
    md: 'h-9 w-9',
    lg: 'h-12 w-12',
    xl: 'h-16 w-16',
  };

  const imageSizes = {
    sm: 28,
    md: 36,
    lg: 48,
    xl: 64,
  };

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${containerSizes[size]} ${className}`}
    >
      <Image
        src="/spendsense-icon-transparent.png"
        alt="SpendSense AI"
        width={imageSizes[size]}
        height={imageSizes[size]}
        priority={priority}
        className="w-full h-full object-contain"
      />
    </div>
  );
}
