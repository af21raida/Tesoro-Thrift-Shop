interface FieldProps {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  errors?: string[];
  defaultValue?: string | number;
}

export function Field({
  label,
  name,
  type = "text",
  autoComplete,
  errors,
  defaultValue,
}: FieldProps): React.JSX.Element {
  const hasError = Boolean(errors?.length);
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className="font-mono text-xs uppercase tracking-wide text-ink-soft">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        aria-invalid={hasError}
        aria-describedby={hasError ? `${name}-error` : undefined}
        className={`rounded-tag border bg-paper px-3 py-2 text-sm text-ink outline-none focus-visible:border-brass ${
          hasError ? "border-stamp" : "border-line"
        }`}
      />
      {hasError && (
        <p id={`${name}-error`} className="text-xs text-stamp">
          {errors?.[0]}
        </p>
      )}
    </div>
  );
}
