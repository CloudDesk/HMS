type MobileSidebarBackdropProps = {
  open: boolean;
  onClose: () => void;
};

export function MobileSidebarBackdrop({ open, onClose }: MobileSidebarBackdropProps) {
  return (
    <button
      aria-label="Close navigation"
      className={`sidebar-backdrop${open ? ' open' : ''}`}
      onClick={onClose}
      type="button"
    />
  );
}
