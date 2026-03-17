'use client';

import { useState } from 'react';
import { Package, Wrench, FolderKanban, ShoppingCart, Settings, Menu, X } from 'lucide-react';
import Link from 'next/link';

export default function OperacionesLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const navItems = [
    { label: 'Inventario', icon: Package, href: '/operaciones/inventario' },
    { label: 'Herramientas', icon: Wrench, href: '/operaciones/herramientas' },
    { label: 'Proyectos', icon: FolderKanban, href: '/operaciones/proyectos' },
    { label: 'Compras', icon: ShoppingCart, href: '/operaciones/compras' },
    { label: 'Administración', icon: Settings, href: '/operaciones/admin' },
  ];

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100">
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 md:hidden" 
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-slate-950 border-r border-gray-200 dark:border-slate-800 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="h-16 flex items-center justify-between px-6 border-b border-gray-200 dark:border-slate-800">
          <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-500 bg-clip-text text-transparent">
            Casa Inteligente
          </span>
          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <nav className="p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.label} href={item.href} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <Icon className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                <span className="font-medium text-sm text-slate-700 dark:text-slate-300">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col w-full overflow-hidden">
        <header className="h-16 flex items-center px-4 md:px-6 bg-white dark:bg-slate-950 border-b border-gray-200 dark:border-slate-800">
          <button onClick={() => setIsSidebarOpen(true)} className="md:hidden mr-4">
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex-1" />
        </header>
        
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
