import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';

type ButtonProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: 'primary' | 'ghost' | 'outline';
    fullWidth?: boolean;
  }
>;

const stylesByVariant: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'bg-primary text-white hover:bg-primaryDark focus-visible:ring-primary/40',
  ghost: 'bg-transparent text-primary hover:bg-primary/10 focus-visible:ring-primary/20',
  outline: 'bg-white text-textMain border border-borderSoft hover:border-primary focus-visible:ring-primary/20'
};

export function Button({ children, variant = 'primary', fullWidth, className = '', ...props }: ButtonProps) {
  return (
    <button
      className={[
        'inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold transition',
        'focus-visible:outline-none focus-visible:ring-4 disabled:cursor-not-allowed disabled:opacity-60',
        stylesByVariant[variant],
        fullWidth ? 'w-full' : '',
        className
      ]
        .join(' ')
        .trim()}
      {...props}
    >
      {children}
    </button>
  );
}
