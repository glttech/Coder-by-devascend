import Link from 'next/link';
import React from 'react';

type Accent = 'blue' | 'purple' | 'cyan' | 'green' | 'red' | 'amber' | 'slate' | 'indigo';

interface MetricCardProps {
  label: string;
  value: number | string;
  sub?: string;
  accent?: Accent;
  href?: string;
}

export function MetricCard({ label, value, sub, accent = 'indigo', href }: MetricCardProps) {
  const inner = (
    <div className={`metric-card metric-card--${accent}`}>
      <div className="metric-card-label">{label}</div>
      <div className="metric-card-value">{value}</div>
      {sub && <div className="metric-card-sub">{sub}</div>}
    </div>
  );

  if (href) {
    return (
      <Link href={href} style={{ textDecoration: 'none', display: 'flex', flex: 1 }}>
        {inner}
      </Link>
    );
  }
  return inner;
}
