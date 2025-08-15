// src/components/groups/RoleBadge.jsx
import { ROLES } from '../../hooks/useGroupPermissions';

const RoleBadge = ({ role, showSiteRoles = true, size = 'sm' }) => {
  if (!role) return null;

  const getRoleInfo = (role) => {
    switch (role) {
      case ROLES.SITE_ADMIN:
        return {
          label: 'Site Admin',
          className: 'bg-red-100 text-red-800 border-red-200',
          icon: '👑'
        };
      case ROLES.SITE_MODERATOR:
        return {
          label: 'Site Moderator',
          className: 'bg-purple-100 text-purple-800 border-purple-200',
          icon: '🛡️'
        };
      case ROLES.GROUP_CREATOR:
        return {
          label: 'Creator',
          className: 'bg-yellow-100 text-yellow-800 border-yellow-200',
          icon: '⭐'
        };
      case ROLES.GROUP_ADMIN:
        return {
          label: 'Group Admin',
          className: 'bg-blue-100 text-blue-800 border-blue-200',
          icon: '🔧'
        };
      case ROLES.GROUP_MODERATOR:
        return {
          label: 'Moderator',
          className: 'bg-green-100 text-green-800 border-green-200',
          icon: '🛡️'
        };
      case ROLES.MEMBER:
        return null; // Don't show badge for regular members
      default:
        return null;
    }
  };

  const roleInfo = getRoleInfo(role);
  
  // Don't show site roles if disabled
  if (!showSiteRoles && (role === ROLES.SITE_ADMIN || role === ROLES.SITE_MODERATOR)) {
    return null;
  }

  if (!roleInfo) return null;

  const sizeClasses = {
    xs: 'text-xs px-1 py-0.5',
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2 py-1',
    lg: 'text-base px-3 py-1'
  };

  return (
    <span 
      className={`
        inline-flex items-center gap-1 rounded-full border font-medium
        ${roleInfo.className}
        ${sizeClasses[size]}
      `}
      title={`Role: ${roleInfo.label}`}
    >
      <span>{roleInfo.icon}</span>
      <span>{roleInfo.label}</span>
    </span>
  );
};

export default RoleBadge;