import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  size?: 'sm' | 'default' | 'lg';
  style?: React.CSSProperties;
}

export function Card({ children, className, size, style }: CardProps) {
  const sizeClass = size === 'sm' ? ' card-sm' : size === 'lg' ? ' card-lg' : '';
  return (
    <div className={`card${sizeClass}${className ? ` ${className}` : ''}`} style={style}>
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function CardHeader({ title, subtitle, actions }: CardHeaderProps) {
  return (
    <div className="card-header">
      <div>
        <div className="card-title">{title}</div>
        {subtitle && <div className="card-subtitle">{subtitle}</div>}
      </div>
      {actions && <div>{actions}</div>}
    </div>
  );
}
