import React from 'react';

export interface PageContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  maxWidth?: 'default' | 'narrow' | 'wide' | 'full';
}

/**
 * Standardized application page container with fluid responsive width up to 1760px.
 */
export function PageContainer({
  children,
  className = '',
  maxWidth = 'default',
  ...props
}: PageContainerProps) {
  const maxWidthClass =
    maxWidth === 'narrow'
      ? 'max-w-5xl'
      : maxWidth === 'wide'
      ? 'max-w-[1760px]'
      : maxWidth === 'full'
      ? 'max-w-full'
      : 'max-w-[1760px]';

  return (
    <div
      className={`w-full ${maxWidthClass} mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-6 sm:py-8 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export default PageContainer;
