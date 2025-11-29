'use client';

import { useAuth } from '@/app/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import Link from 'next/link';

export default function Header() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  if (!user) return null;

  const initials =
    user.first_name && user.last_name
      ? `${user.first_name[0]}${user.last_name[0]}`.toUpperCase()
      : user.username[0].toUpperCase();

  // Determine breadcrumb based on current path
  const getBreadcrumbs = () => {
    if (pathname === '/dashboard') {
      return [{ label: 'Dashboard', href: '/dashboard' }];
    }
    if (pathname === '/cohorts') {
      return [{ label: 'Cohorts', href: '/cohorts' }];
    }
    if (pathname === '/profile') {
      return [
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Profile', href: '/profile' },
      ];
    }
    if (pathname.startsWith('/chat')) {
      return [
        { label: 'Cohorts', href: '/cohorts' },
        { label: 'Chat', href: pathname },
      ];
    }
    if (pathname.startsWith('/analyze')) {
      return [
        { label: 'Cohorts', href: '/cohorts' },
        { label: 'Analyze', href: pathname },
      ];
    }
    return [{ label: 'Dashboard', href: '/dashboard' }];
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <header className="sticky top-0 z-50 w-full px-4 py-2 border-b border-gray-200 flex-shrink-0 bg-white shadow-sm">
      <div className="flex items-center justify-between h-8">
        {/* Left side - Breadcrumb Navigation */}
        <div className="flex items-center gap-1">
          <Link href="/dashboard" className="flex items-center">
            <span className="font-semibold text-purple-500 cursor-pointer hover:text-purple-600 text-sm leading-none">
              Cohort Builder
            </span>
          </Link>
          <div className="flex items-center">
            <ChevronRight className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
          </div>
          {breadcrumbs.map((crumb, index) => (
            <div key={crumb.href} className="flex items-center gap-1">
              {index < breadcrumbs.length - 1 ? (
                <>
                  <Link href={crumb.href} className="flex items-center">
                    <span className="text-gray-500 hover:text-purple-500 cursor-pointer text-sm leading-none">
                      {crumb.label}
                    </span>
                  </Link>
                  <div className="flex items-center">
                    <ChevronRight className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                  </div>
                </>
              ) : (
                <span className="text-gray-700 font-medium text-sm leading-none">{crumb.label}</span>
              )}
            </div>
          ))}
        </div>

        {/* Right side - User Profile and Actions */}
        <div className="flex items-center justify-end gap-2">
          {/* User Profile Dropdown */}
          <div className="relative flex items-center">
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-2 px-2 py-1 rounded-sm transition-all duration-200 hover:bg-gray-50"
            >
              <div className="flex items-center justify-center w-7 h-7 rounded-full text-white font-semibold text-xs bg-purple-500">
                {initials}
              </div>
              <span className="text-sm text-gray-600 hidden sm:block leading-none">
                {user.first_name && user.last_name
                  ? `${user.first_name} ${user.last_name}`
                  : user.username}
              </span>
            </button>

            {isDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setIsDropdownOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-sm shadow-lg border border-gray-200 py-1 z-20">
                  <button
                    onClick={() => {
                      router.push('/profile');
                      setIsDropdownOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Profile
                  </button>
                  <button
                    onClick={() => {
                      router.push('/dashboard');
                      setIsDropdownOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Dashboard
                  </button>
                  <div className="border-t border-gray-200 my-1"></div>
                  <button
                    onClick={async () => {
                      await logout();
                      router.push('/login');
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors"
                  >
                    Logout
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
