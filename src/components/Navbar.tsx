import { Link, NavLink } from 'react-router-dom';

const links = [
  { to: '/', label: 'Productos' },
  { to: '/', label: 'Consultas' },
  { to: '/', label: 'Contacto' },
  { to: '/', label: 'Preguntas Frecuentes' },
  { to: '/demo', label: 'Demo' }
];

export function Navbar() {
  return (
    <header className="sticky top-0 z-20 border-b border-borderSoft bg-surfaceMuted/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-content items-center justify-between px-4 py-3 md:px-6">
        <Link to="/" className="flex items-center" aria-label="Ubii Home">
          <img src="/ubii-logo-dark.svg" alt="Ubii Pagos" className="h-8 w-auto md:h-9" />
        </Link>
        <nav className="hidden items-center gap-10 md:flex" aria-label="Principal">
          {links.map((item) => (
            <NavLink
              key={`${item.label}-${item.to}`}
              to={item.to}
              className="text-sm font-semibold text-slate-500 transition hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="w-8 md:w-9" />
      </div>
    </header>
  );
}
