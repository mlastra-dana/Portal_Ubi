import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { PrimaryButton } from './ui/PrimaryButton';

const links = [
  { to: '/', label: 'Productos' },
  { to: '/', label: 'Consultas' },
  { to: '/', label: 'Pagos' },
  { to: '/', label: 'Gestiones' }
];

export function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-ubii-border bg-white/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 md:px-6">
        <Link to="/" className="flex items-center" aria-label="Ubii Pagos Home">
          <img src="/logo-ubiiapp-azul.svg" alt="Ubii Pagos" className="h-8 w-auto md:h-9" />
        </Link>

        <nav className="hidden items-center gap-8 md:flex" aria-label="Principal">
          {links.map((item) => (
            <NavLink key={item.label} to={item.to} className="text-sm font-semibold text-gray-600">
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden md:block">
          <Link to="/demo">
            <PrimaryButton>Iniciar demo</PrimaryButton>
          </Link>
        </div>

        <PrimaryButton className="px-3 py-2 md:hidden" onClick={() => setMenuOpen((prev) => !prev)} aria-label="Abrir menu">
          Menu
        </PrimaryButton>
      </div>

      {menuOpen ? (
        <div className="border-t border-ubii-border bg-white px-4 py-3 md:hidden">
          <nav className="mb-3 grid gap-2" aria-label="Menu movil">
            {links.map((item) => (
              <NavLink
                key={`${item.label}-mobile`}
                to={item.to}
                onClick={() => setMenuOpen(false)}
                className="rounded-lg px-2 py-2 text-sm font-semibold text-gray-700"
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <Link to="/demo" onClick={() => setMenuOpen(false)}>
            <PrimaryButton fullWidth>Iniciar demo</PrimaryButton>
          </Link>
        </div>
      ) : null}
    </header>
  );
}
