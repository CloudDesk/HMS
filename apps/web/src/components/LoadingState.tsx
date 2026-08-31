import { MedicalLoader } from './ui/MedicalLoader';

type LoadingStateProps = {
  title?: string;
  message?: string;
};

export function LoadingState({
  title = 'Verifying access & session',
  message = 'Please wait while HMS synchronizes your clinical workspace',
}: LoadingStateProps) {
  return (
    <main className="app-shell app-shell--center" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'transparent' }}>
      <section className="loading-panel" aria-live="polite" aria-busy="true" style={{ background: 'transparent', border: 'none', boxShadow: 'none', padding: '0' }}>
        <MedicalLoader size="large" text={title} subtext={message} />
      </section>
    </main>
  );
}
