import { Link, NavLink } from 'react-router-dom';

const links = [
  { to: '/', label: 'Inicio' },
  { to: '/demo', label: 'Demo' },
  { to: '/onboarding', label: 'Onboarding' }
];

export function Navbar() {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-700 bg-slate-950/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-content items-center justify-between px-4 py-3 md:px-6">
        <Link to="/" className="flex items-center gap-2 text-white" aria-label="UBPAY home">
          <img src="/ubii-logo-dark.svg" alt="UBPAY" className="h-8 w-auto invert brightness-200" />
        </Link>
        <nav className="flex items-center gap-5" aria-label="Principal">
          {links.map((item) => (
            <NavLink
              key={item.label}
              to={item.to}
              className={({ isActive }) =>
                `text-sm font-semibold transition ${isActive ? 'text-blue-200' : 'text-slate-300 hover:text-white'}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  );
}
