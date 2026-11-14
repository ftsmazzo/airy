type Props = {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
  /** Só a chave (sem faixa de texto) — cards MCP */
  compact?: boolean;
};

/** Chave liga/desliga — verde aceso / apagado. */
export function ToggleSwitch({
  checked,
  onChange,
  label,
  hint,
  disabled,
  compact,
}: Props) {
  if (compact) {
    return (
      <button
        type="button"
        className="toggle-compact"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
      >
        <span className={`toggle-track ${checked ? "on" : "off"}`} aria-hidden>
          <span className="toggle-knob" />
        </span>
      </button>
    );
  }
  return (
    <button
      type="button"
      className={`toggle-row ${checked ? "is-on" : "is-off"}`}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span className="toggle-row-text">
        <span className="toggle-row-label">{label}</span>
        {hint ? <span className="toggle-row-hint">{hint}</span> : null}
      </span>
      <span className={`toggle-track ${checked ? "on" : "off"}`} aria-hidden>
        <span className="toggle-knob" />
      </span>
    </button>
  );
}
