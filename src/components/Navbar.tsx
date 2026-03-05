import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { PrimaryButton } from './ui/PrimaryButton';

export function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const isInside = ['/demo', '/recaudos', '/onboarding', '/done'].some((path) => location.pathname.startsWith(path));

  return (
    <header className="sticky top-0 z-30 border-b border-ubii-border bg-white/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 md:px-6">
        <Link to="/" className="flex items-center" aria-label="UbiiApp Home">
          <img src="/logo-ubiiapp-azul.svg" alt="UbiiApp" className="h-8 w-auto md:h-9" />
        </Link>

        <div className="hidden md:block" />

        {isInside ? (
          <div className="hidden md:block">
            <PrimaryButton onClick={() => navigate('/')}>Salir</PrimaryButton>
          </div>
        ) : (
          <div className="hidden md:block" />
        )}

        {isInside ? (
          <PrimaryButton className="px-3 py-2 md:hidden" onClick={() => navigate('/')}>
            Salir
          </PrimaryButton>
        ) : (
          <PrimaryButton className="px-3 py-2 md:hidden" onClick={() => setMenuOpen((prev) => !prev)} aria-label="Abrir menu">
            Menu
          </PrimaryButton>
        )}
      </div>

      {menuOpen && !isInside ? (
        <div className="border-t border-ubii-border bg-white px-4 py-3 md:hidden">
          <Link to="/demo" onClick={() => setMenuOpen(false)}>
            <PrimaryButton fullWidth>Iniciar demo</PrimaryButton>
          </Link>
        </div>
      ) : null}
    </header>
  );
}
