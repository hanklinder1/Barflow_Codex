interface LogoProps {
  className?: string;
  showText?: boolean;
  size?: "sm" | "md" | "lg";
}

export default function Logo({ className = "", showText = true, size = "md" }: LogoProps) {
  const sizeClasses = {
    sm: "logo-text-sm",
    md: "logo-text-md",
    lg: "logo-text-lg"
  };

  const iconSize = size === "sm" ? 24 : size === "md" ? 32 : 48;

  return (
    <div className={`logo-wrap ${className}`}>
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="logo-icon"
        style={{ width: iconSize, height: iconSize }}
      >
        <path
          d="M16 2C10.477 2 6 6.477 6 12C6 18 16 30 16 30C16 30 26 18 26 12C26 6.477 21.523 2 16 2Z"
          fill="#F75500"
        />
        <circle cx="16" cy="12" r="3.5" fill="#FFFFFF" />

        <path
          d="M10 20L6 18M22 20L26 18M16 24L16 28"
          stroke="#FFFFFF"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeOpacity="0.7"
        />
        <path
          d="M11 21L7 19M21 21L25 19"
          stroke="#FFFFFF"
          strokeWidth="1"
          strokeLinecap="round"
          strokeOpacity="0.5"
        />
      </svg>
      {showText ? <span className={`logo-text ${sizeClasses[size]}`}>BarFlow</span> : null}
    </div>
  );
}
