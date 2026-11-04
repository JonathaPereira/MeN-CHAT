export function Brand({
  light = false,
  large = false,
}: {
  light?: boolean;
  large?: boolean;
}) {
  return (
    <div
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
          <path d="M12 10h16c5 0 7 5 8 14 1 6-3 8-7 3l-3-3H14l-3 3c-4 5-8 3-7-3 1-9 3-14 8-14Z" />
          <path d="M12 15v7m-3.5-3.5h7M18 28v5l6-5" />
          <circle cx="27" cy="16" r="1" fill="currentColor" stroke="none" />
          <circle cx="30" cy="20" r="1" fill="currentColor" stroke="none" />
        </svg>
      </span>
      <span className="brand-word">
        Men<span className="text-[0.55em]">Chat</span>
      </span>
    </div>
  );
}
