import { Crown, Shield, Star, Wrench } from "lucide-react";

const ROLE_CONFIG = {
  creator: {
    label: "Creator",
    color: "bg-yellow-100 text-yellow-800 border-yellow-200",
    icon: Crown,
  },
  admin: {
    label: "Admin", 
    color: "bg-blue-100 text-blue-800 border-blue-200",
    icon: Wrench,
  },
  moderator: {
    label: "Mod",
    color: "bg-green-100 text-green-800 border-green-200", 
    icon: Shield,
  },
  member: {
    label: "Member",
    color: "bg-gray-100 text-gray-600 border-gray-200",
    icon: null,
  }
};

const SITE_ROLE_CONFIG = {
  isAdmin: {
    label: "Site Admin",
    color: "bg-red-100 text-red-800 border-red-200",
    icon: Crown,
  },
  isModerator: {
    label: "Site Mod",
    color: "bg-purple-100 text-purple-800 border-purple-200",
    icon: Shield,
  }
};

const SIZE_CONFIG = {
  xs: "px-1.5 py-0.5 text-xs",
  sm: "px-2 py-1 text-xs", 
  md: "px-2.5 py-1 text-sm",
  lg: "px-3 py-1.5 text-sm"
};

const ICON_SIZES = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16
};

export default function RoleBadge({ 
  role, 
  size = "sm", 
  isAdmin = false, 
  isModerator = false,
  showIcon = true 
}) {
  // Don't render anything if no role
  if (!role && !isAdmin && !isModerator) return null;
  
  // Prioritize site-wide roles
  let config;
  if (isAdmin) {
    config = SITE_ROLE_CONFIG.isAdmin;
  } else if (isModerator) {
    config = SITE_ROLE_CONFIG.isModerator;
  } else if (role && ROLE_CONFIG[role]) {
    config = ROLE_CONFIG[role];
  } else {
    return null;
  }

  const Icon = config.icon;
  const iconSize = ICON_SIZES[size];
  const sizeClasses = SIZE_CONFIG[size];

  return (
    <span
      className={`
        inline-flex items-center gap-1 rounded-full border font-medium
        ${config.color} ${sizeClasses}
      `}
    >
      {showIcon && Icon && <Icon size={iconSize} />}
      {config.label}
    </span>
  );
}