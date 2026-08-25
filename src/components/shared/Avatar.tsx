import React from 'react';

interface AvatarProps {
  name: string;
  role?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function Avatar({ name, role, size = 'md' }: AvatarProps) {
  const initials = name
    ? name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
    : 'U';

  const sizeClasses = {
    sm: 'w-8 h-8 text-[11px] rounded-lg',
    md: 'w-10 h-10 text-[13px] rounded-xl',
    lg: 'w-12 h-12 text-[14px] rounded-xl',
  };

  const roleGradients: Record<string, string> = {
    student: 'linear-gradient(135deg, #4F46E5, #818CF8)',
    faculty: 'linear-gradient(135deg, #0D9488, #14B8A6)',
    admin: 'linear-gradient(135deg, #D97706, #F59E0B)',
  };

  const gradient = roleGradients[role || 'student'] || 'linear-gradient(135deg, #64748B, #94A3B8)';

  return (
    <div
      className={`${sizeClasses[size]} flex items-center justify-center font-bold text-white shadow-sm shrink-0`}
      style={{ background: gradient }}
    >
      {initials}
    </div>
  );
}
