import type { ButtonHTMLAttributes } from "react";

const variants = {
  primary: "bg-rose-500 text-white hover:bg-rose-400",
  secondary: "bg-white/10 text-white hover:bg-white/15",
  ghost: "bg-transparent text-zinc-200 hover:bg-white/10",
  danger: "bg-transparent text-red-300 hover:bg-red-500/10",
};

export function Button({
  variant = "primary",
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof variants }) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
