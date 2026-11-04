export function Brand({
  light = false,
  large = false,
}: {
  light?: boolean;
  large?: boolean;
}) {
  return (
    <div
      aria-label="MenChat · Memes e Nerds"
      className={`menchat-brand ${light ? "text-white" : "text-[var(--ink)]"} ${large ? "brand-large" : ""}`}
    >
      <span className="brand-mark">
        <svg
          width={large ? 36 : 25}
          height={large ? 36 : 25}
          viewBox="0 0 40 40"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M13 10c-6-1-8 5-9 13-1 6 3 8 8 3h10l6 6v-6c8 0 9-3 8-8-1-6-4-10-9-8-5 2-8 2-14 0Z" />
          <path d="M12 15v7m-3.5-3.5h7" />
          <circle cx="27" cy="16" r="1" fill="currentColor" stroke="none" />
          <circle cx="30" cy="20" r="1" fill="currentColor" stroke="none" />
        </svg>
      </span>
      <span className="brand-word">Men</span>
    </div>
  );
}
