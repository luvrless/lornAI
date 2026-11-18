// FlairGPT mark — a stylized flame/spark in the brand blue.
export default function Logo({ size = 28, animated = false, className = "" }) {
  return (
    <svg className={`logo ${animated ? "logo-animated" : ""} ${className}`} width={size} height={size} viewBox="0 0 64 64" aria-label="FlairGPT">
      <defs>
        <linearGradient id="flair-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8495ff" />
          <stop offset="1" stopColor="#3552f5" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill="url(#flair-g)" />
      <path
        className="logo-flame"
        d="M33.5 10c1.6 7.4-2.2 10.6-6 14.6-3.6 3.8-6.5 7.6-6.5 13.4C21 46.3 26.4 53 33 53s12-5.4 12-13.2c0-5.2-2.3-8.6-4.6-11.4-.4 3.4-1.9 5.6-4.2 6.6 1.3-6.8-.1-15.6-2.7-25z"
        fill="#fff"
      />
      <circle className="logo-core" cx="33" cy="42" r="4.5" fill="#4d6bfe" />
    </svg>
  );
}
