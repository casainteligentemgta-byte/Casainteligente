'use client';

import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';

const items = [
  { label: 'Empresas', href: '/empresas' },
];

export default function MenuDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          padding: '0.5rem 1rem',
          background: 'var(--surface)',
          borderRadius: '8px',
          border: '1px solid var(--border)',
          color: 'inherit',
          cursor: 'pointer',
          font: 'inherit',
        }}
      >
        Menú
      </button>
      {open && (
        <ul
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: '0.25rem',
            listStyle: 'none',
            minWidth: '10rem',
            background: 'var(--surface)',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            padding: '0.25rem',
            zIndex: 10,
          }}
        >
          {items.map(({ label, href }) => (
            <li key={href}>
              <Link
                href={href}
                onClick={() => setOpen(false)}
                style={{
                  display: 'block',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '6px',
                  color: 'inherit',
                  textDecoration: 'none',
                }}
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
