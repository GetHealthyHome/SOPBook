"use client";

import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Home, Search, ShieldCheck } from 'lucide-react';

export default function MobileLayout({ children, userRole = 'admin' }: { children: React.ReactNode, userRole?: string }) {
  const pathname = usePathname();
  const router = useRouter();

  const navItems = [
    { label: 'Home', icon: Home, path: '/dashboard' },
    { label: 'Search', icon: Search, path: '/search' },
  ];

  if (userRole === 'admin') {
    navItems.push({ label: 'Admin', icon: ShieldCheck, path: '/admin' });
  }

  return (
    <div className="flex justify-center w-full min-h-screen bg-gray-50 text-gray-900 antialiased">
      {/* Mobile viewport constraint */}
      <div className="relative flex flex-col w-full max-w-md min-h-screen bg-white shadow-xl pb-20">
        
        {/* Main Content Area */}
        <main className="flex-1 w-full overflow-y-auto px-4 pt-4">
          {children}
        </main>

        {/* Google-Inspired Bottom Navigation */}
        <nav className="absolute bottom-0 left-0 right-0 h-16 bg-white border-t border-gray-100 flex items-center justify-around px-2 z-50">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => router.push(item.path)}
                className="flex flex-col items-center justify-center flex-1 h-full py-2 relative group"
              >
                <Icon size={24} className={isActive ? 'text-blue-600' : 'text-gray-400'} />
                <span className={`text-[11px] font-medium mt-0.5 ${isActive ? 'text-blue-600 font-semibold' : 'text-gray-500'}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>

      </div>
    </div>
  );
}