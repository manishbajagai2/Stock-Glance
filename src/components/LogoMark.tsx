type LogoMarkProps = {
  className?: string;
  size?: number;
};

export function LogoMark({ className, size = 40 }: LogoMarkProps) {
  return (
    <img
      src="/favicon.svg"
      alt=""
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    />
  );
}
