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
    <header className="sticky top-0 z-50 w-full px-2 py-1 border-b border-border flex-shrink-0 bg-surface">
      <div className="flex items-center justify-between">
        {/* Left side - Breadcrumb Navigation */}
        <div className="flex items-center">
          <Link href="/dashboard">
            <span className="font-semibold text-primary cursor-pointer hover:text-primary-hover text-sm">
              Cohort Builder
            </span>
          </Link>
          <ChevronRight className="h-3 w-3 mx-1 text-text-tertiary" />
          {breadcrumbs.map((crumb, index) => (
            <div key={crumb.href} className="flex items-center">
              {index < breadcrumbs.length - 1 ? (
                <>
                  <Link href={crumb.href}>
                    <span className="text-text-secondary hover:text-primary cursor-pointer text-sm">
                      {crumb.label}
                    </span>
                  </Link>
                  <ChevronRight className="h-3 w-3 mx-1 text-text-tertiary" />
                </>
              ) : (
                <span className="text-text font-medium text-sm">{crumb.label}</span>
              )}
            </div>
          ))}
        </div>

        {/* Right side - User Profile and Actions */}
        <div className="flex items-center justify-end gap-2">
          {/* User Profile Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-2 px-2 py-1 rounded-sm transition-all duration-200 hover:bg-background"
            >
              <div className="flex items-center justify-center w-7 h-7 rounded-full text-white font-semibold text-xs bg-primary">
                {initials}
              </div>
              <span className="text-sm text-text-secondary hidden sm:block">
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
                <div className="absolute right-0 mt-2 w-48 bg-surface rounded-sm shadow-lg border border-border py-1 z-20">
                  <button
                    onClick={() => {
                      router.push('/profile');
                      setIsDropdownOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-text hover:bg-background transition-colors"
                  >
                    Profile
                  </button>
                  <button
                    onClick={() => {
                      router.push('/dashboard');
                      setIsDropdownOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-text hover:bg-background transition-colors"
                  >
                    Dashboard
                  </button>
                  <div className="border-t border-border my-1"></div>
                  <button
                    onClick={async () => {
                      await logout();
                      router.push('/login');
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-error hover:bg-error-bg transition-colors"
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
