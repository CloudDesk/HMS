type SearchInputProps = {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
};

export function SearchInput({ label, value, placeholder, onChange }: SearchInputProps) {
  return (
    <label className="search-input">
      <span className="sr-only">{label}</span>
      <i className="ph ph-magnifying-glass" aria-hidden="true" />
      <input
        aria-label={label}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type="search"
        value={value}
      />
    </label>
  );
}
