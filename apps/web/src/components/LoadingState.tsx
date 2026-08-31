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
    <main className="app-shell app-shell--center" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
      <section className="loading-panel" aria-live="polite" aria-busy="true" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.08)', padding: '2rem 3rem' }}>
        <MedicalLoader size="large" text={title} subtext={message} />
      </section>
    </main>
  );
}
