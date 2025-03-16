
import React from 'react';
import { Network } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  iconClassName?: string;
  textClassName?: string;
}

const Logo: React.FC<LogoProps> = ({ 
  className, 
  iconClassName,
  textClassName
}) => {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Network className={cn('text-primary size-6 animate-pulse-subtle', iconClassName)} />
      <span className={cn('font-medium tracking-tight text-xl', textClassName)}>
        SubnetSlicer
      </span>
    </div>
  );
};

export default Logo;
