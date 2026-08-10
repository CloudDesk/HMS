type LoadingStateProps = {
  title?: string;
  message?: string;
};

export function LoadingState({
  title = 'Checking session',
  message = 'Please wait while HMS verifies your access.',
}: LoadingStateProps) {
  return (
    <main className="app-shell app-shell--center">
      <section className="loading-panel" aria-live="polite" aria-busy="true">
        <span className="loading-spinner" aria-hidden="true" />
        <div>
          <h1>{title}</h1>
          <p>{message}</p>
        </div>
      </section>
    </main>
  );
}
