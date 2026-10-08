/** Shared marketing CTAs. Glass uses the pricing-selector G-C glint surface. */
import type { ReactNode } from 'react';
import styles from './MarketingButton.module.css';

type Variant = 'primary' | 'glass' | 'ghost';

type Props = {
  href: string;
  children: ReactNode;
  variant?: Variant;
  size?: 'default' | 'large';
  className?: string;
  onClick?: () => void;
  ariaLabel?: string;
  icon?: ReactNode;
  target?: string;
  rel?: string;
};

export function MarketingButton({
  href,
  children,
  variant = 'glass',
  size = 'default',
  className = '',
  onClick,
  ariaLabel,
  icon,
  target,
  rel,
}: Props) {
  return (
    <a
      href={href}
      target={target}
      rel={rel}
      aria-label={ariaLabel}
      onClick={onClick}
      className={[styles.button, styles[variant], size === 'large' ? styles.large : '', className].filter(Boolean).join(' ')}
    >
      {icon ? <span className={styles.icon} aria-hidden="true">{icon}</span> : null}
      <span>{children}</span>
    </a>
  );
}
