import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';

type PrimaryButtonProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    fullWidth?: boolean;
  }
>;

export function PrimaryButton({ children, fullWidth, className = '', type = 'button', ...props }: PrimaryButtonProps) {
  return (
    <button
      type={type}
      className={[
        className,
        'inline-flex items-center justify-center rounded-lg border border-ubii-blue bg-ubii-blue px-5 py-2.5 text-sm font-semibold text-white',
        'focus-visible:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-100',
        fullWidth ? 'w-full' : ''
      ]
        .join(' ')
        .trim()}
      {...props}
    >
      {children}
    </button>
  );
}
