// src/hooks/useGroupPermissions.js
import { useEffect, useState } from 'react';
import { db } from '../firebase';
import { doc, getDoc, onSnapshot, collection, query, where } from 'firebase/firestore';
import { useAppContext } from '../context/AppContext';

export const ROLES = {
  SITE_ADMIN: 'site_admin',
  SITE_MODERATOR: 'site_moderator', 
  GROUP_CREATOR: 'group_creator',
  GROUP_ADMIN: 'group_admin',
  GROUP_MODERATOR: 'group_moderator',
  MEMBER: 'member'
};

// Permission hierarchy (higher number = more permissions)
const ROLE_HIERARCHY = {
  [ROLES.SITE_ADMIN]: 6,
  [ROLES.SITE_MODERATOR]: 5,
  [ROLES.GROUP_CREATOR]: 4,
  [ROLES.GROUP_ADMIN]: 3,
  [ROLES.GROUP_MODERATOR]: 2,
  [ROLES.MEMBER]: 1
};

export const useGroupPermissions = (groupId, targetUserId = null) => {
  const { user } = useAppContext();
  const [groupData, setGroupData] = useState(null);
  const [userGroupRole, setUserGroupRole] = useState(null);
  const [targetUserRole, setTargetUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid || !groupId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    // Listen to group data
    const groupRef = doc(db, 'groups', groupId);
    const unsubscribeGroup = onSnapshot(groupRef, (snapshot) => {
      if (snapshot.exists()) {
        setGroupData({ id: snapshot.id, ...snapshot.data() });
      } else {
        setGroupData(null);
      }
    });

    // Listen to current user's group membership
    const userMemberRef = doc(db, 'groups', groupId, 'members', user.uid);
    const unsubscribeUserMember = onSnapshot(userMemberRef, (snapshot) => {
      if (snapshot.exists()) {
        setUserGroupRole(snapshot.data().role || ROLES.MEMBER);
      } else {
        setUserGroupRole(null);
      }
    });

    // Listen to target user's group membership if specified
    let unsubscribeTargetUser = null;
    if (targetUserId) {
      const targetMemberRef = doc(db, 'groups', groupId, 'members', targetUserId);
      unsubscribeTargetUser = onSnapshot(targetMemberRef, (snapshot) => {
        if (snapshot.exists()) {
          setTargetUserRole(snapshot.data().role || ROLES.MEMBER);
        } else {
          setTargetUserRole(null);
        }
      });
    }

    setLoading(false);

    return () => {
      unsubscribeGroup();
      unsubscribeUserMember();
      if (unsubscribeTargetUser) unsubscribeTargetUser();
    };
  }, [groupId, user?.uid, targetUserId]);

  // Get user's effective role (considering site-wide permissions)
  const getEffectiveRole = (userId = user?.uid, groupRole = userGroupRole) => {
    if (!userId || !user) return ROLES.MEMBER;

    // Site admins override everything
    if (user.isAdmin) return ROLES.SITE_ADMIN;
    if (user.isModerator) return ROLES.SITE_MODERATOR;

    // Group creator check
    if (groupData?.creatorId === userId) return ROLES.GROUP_CREATOR;

    // Return group-specific role or default to member
    return groupRole || ROLES.MEMBER;
  };

  const getCurrentUserRole = () => getEffectiveRole();
  const getTargetUserRole = () => getEffectiveRole(targetUserId, targetUserRole);

  // Permission checking functions
  const hasPermission = (requiredRole, userRole = getCurrentUserRole()) => {
    const userLevel = ROLE_HIERARCHY[userRole] || 0;
    const requiredLevel = ROLE_HIERARCHY[requiredRole] || 0;
    return userLevel >= requiredLevel;
  };

  const canManageGroup = () => hasPermission(ROLES.GROUP_CREATOR);
  const canAssignAdmins = () => hasPermission(ROLES.GROUP_CREATOR);
  const canAssignModerators = () => hasPermission(ROLES.GROUP_ADMIN);
  const canModerateContent = () => hasPermission(ROLES.GROUP_MODERATOR);
  const canDeleteGroup = () => hasPermission(ROLES.GROUP_CREATOR);

  // Check if current user can manage target user
  const canManageUser = (targetRole = getTargetUserRole()) => {
    const currentRole = getCurrentUserRole();
    const currentLevel = ROLE_HIERARCHY[currentRole] || 0;
    const targetLevel = ROLE_HIERARCHY[targetRole] || 0;
    
    // Can only manage users with lower hierarchy level
    return currentLevel > targetLevel;
  };

  // Check if user can assign a specific role
  const canAssignRole = (roleToAssign) => {
    const currentRole = getCurrentUserRole();
    
    switch (roleToAssign) {
      case ROLES.GROUP_ADMIN:
        return hasPermission(ROLES.GROUP_CREATOR, currentRole);
      case ROLES.GROUP_MODERATOR:
        return hasPermission(ROLES.GROUP_ADMIN, currentRole);
      default:
        return false;
    }
  };

  // Check if user can perform action on a specific post/content
  const canEditContent = (contentAuthorId) => {
    if (!contentAuthorId) return false;
    
    // Own content
    if (contentAuthorId === user?.uid) return true;
    
    // Moderator or higher can edit any content
    return canModerateContent();
  };

  const canDeleteContent = (contentAuthorId) => {
    if (!contentAuthorId) return false;
    
    // Own content
    if (contentAuthorId === user?.uid) return true;
    
    // Moderator or higher can delete any content
    return canModerateContent();
  };

  const isMember = () => userGroupRole !== null;
  const isGroupCreator = () => groupData?.creatorId === user?.uid;
  const isGroupAdmin = () => userGroupRole === ROLES.GROUP_ADMIN || isGroupCreator();
  const isGroupModerator = () => userGroupRole === ROLES.GROUP_MODERATOR || isGroupAdmin();

  return {
    // Data
    groupData,
    userGroupRole,
    targetUserRole,
    loading,

    // Role getters
    getCurrentUserRole,
    getTargetUserRole,
    getEffectiveRole,

    // Permission checks
    hasPermission,
    canManageGroup,
    canAssignAdmins,
    canAssignModerators,
    canModerateContent,
    canDeleteGroup,
    canManageUser,
    canAssignRole,
    canEditContent,
    canDeleteContent,

    // Status checks
    isMember,
    isGroupCreator,
    isGroupAdmin,
    isGroupModerator,

    // Constants
    ROLES,
    ROLE_HIERARCHY
  };
};

export default useGroupPermissions;