import type { PropsWithChildren, ReactNode } from 'react';

type CardProps = PropsWithChildren<{
  title?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}>;

export function Card({ title, description, action, className = '', children }: CardProps) {
  return (
    <section className={`card ${className}`.trim()}>
      {(title || description || action) && (
        <div className="card-header">
          <div>
            {title ? <h3>{title}</h3> : null}
            {description ? <p>{description}</p> : null}
          </div>
          {action ? <div className="card-header__action">{action}</div> : null}
        </div>
      )}
      {children}
    </section>
  );
}
