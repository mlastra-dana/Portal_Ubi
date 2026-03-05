import { Link, NavLink } from 'react-router-dom';
import { Button } from './Button';

const links = [
  { to: '/', label: 'Productos' },
  { to: '/', label: 'Consultas' },
  { to: '/', label: 'Pagos' },
  { to: '/', label: 'Gestiones' }
];

export function Navbar() {
  return (
    <header className="sticky top-0 z-20 border-b border-borderSoft bg-white/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-content items-center justify-between px-4 py-3 md:px-6">
        <Link to="/" className="text-xl font-bold text-primary" aria-label="Ubii Home">
          Portalito Ubii
        </Link>
        <nav className="hidden items-center gap-5 md:flex" aria-label="Principal">
          {links.map((item) => (
            <NavLink
              key={`${item.label}-${item.to}`}
              to={item.to}
              className="text-sm font-medium text-textMain transition hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <Link to="/demo">
          <Button>Comenzar</Button>
        </Link>
      </div>
    </header>
  );
}
