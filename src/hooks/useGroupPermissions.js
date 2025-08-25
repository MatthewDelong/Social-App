import { useEffect, useState, useMemo } from "react";
import { doc, onSnapshot, collection, query, where } from "firebase/firestore";
import { db } from "../firebase";

// Role hierarchy levels for easy comparison
const ROLE_LEVELS = {
  member: 1,
  moderator: 2,
  admin: 3,
  creator: 4,
};

export function useGroupPermissions(groupId, userId) {
  const [groupData, setGroupData] = useState(null);
  const [members, setMembers] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Listen to group data
  useEffect(() => {
    if (!groupId) {
      setLoading(false);
      return;
    }

    const groupRef = doc(db, "groups", groupId);
    const unsubscribe = onSnapshot(
      groupRef,
      (doc) => {
        if (doc.exists()) {
          setGroupData({ id: doc.id, ...doc.data() });
        } else {
          setError("Group not found");
        }
        setLoading(false);
      },
      (err) => {
        console.error("Error listening to group:", err);
        setError("Failed to load group data");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [groupId]);

  // Listen to group members
  useEffect(() => {
    if (!groupId) return;

    const membersRef = collection(db, "groups", groupId, "members");
    const unsubscribe = onSnapshot(
      membersRef,
      (snapshot) => {
        const membersData = {};
        snapshot.docs.forEach((doc) => {
          membersData[doc.id] = { id: doc.id, ...doc.data() };
        });
        setMembers(membersData);
      },
      (err) => {
        console.error("Error listening to members:", err);
        setError("Failed to load members data");
      }
    );

    return () => unsubscribe();
  }, [groupId]);

  // Get current user's role in the group
  const getCurrentUserRole = useMemo(() => {
    if (!userId || !members[userId]) return null;
    return members[userId].role || "member";
  }, [userId, members]);

  // Get effective role (considers site-wide permissions)
  const getEffectiveRole = useMemo(() => {
    // This would need to be passed from your auth context
    // For now, assuming site-wide admin/moderator status is available
    // You should pass these as additional parameters to the hook
    return getCurrentUserRole;
  }, [getCurrentUserRole]);

  // Check if user is a member
  const isMember = useMemo(() => {
    return Boolean(userId && members[userId]);
  }, [userId, members]);

  // Get any user's role
  const getUserRole = useMemo(
    () => (targetUserId) => {
      if (!targetUserId || !members[targetUserId]) return null;
      return members[targetUserId].role || "member";
    },
    [members]
  );

  // Permission functions
  const canEditContent = useMemo(
    () => (authorId) => {
      if (!userId || !isMember) return false;
      // Own content
      if (authorId === userId) return true;
      // Moderators and above can edit any content
      const userRole = getCurrentUserRole;
      return userRole && ROLE_LEVELS[userRole] >= ROLE_LEVELS.moderator;
    },
    [userId, isMember, getCurrentUserRole]
  );

  const canDeleteContent = useMemo(
    () => (authorId) => {
      if (!userId || !isMember) return false;
      // Own content
      if (authorId === userId) return true;
      // Moderators and above can delete any content
      const userRole = getCurrentUserRole;
      return userRole && ROLE_LEVELS[userRole] >= ROLE_LEVELS.moderator;
    },
    [userId, isMember, getCurrentUserRole]
  );

  const canManageGroup = useMemo(() => {
    const userRole = getCurrentUserRole;
    return userRole && ROLE_LEVELS[userRole] >= ROLE_LEVELS.admin;
  }, [getCurrentUserRole]);

  const canAssignAdmins = useMemo(() => {
    return getCurrentUserRole === "creator";
  }, [getCurrentUserRole]);

  const canAssignModerators = useMemo(() => {
    const userRole = getCurrentUserRole;
    return userRole && ROLE_LEVELS[userRole] >= ROLE_LEVELS.admin;
  }, [getCurrentUserRole]);

  const canRemoveMember = useMemo(
    () => (targetUserId) => {
      if (!userId || !isMember) return false;
      if (targetUserId === userId) return true; // Can always leave
      
      const userRole = getCurrentUserRole;
      const targetRole = getUserRole(targetUserId);
      
      if (!userRole || !targetRole) return false;
      
      // Can only remove members with lower roles
      return ROLE_LEVELS[userRole] > ROLE_LEVELS[targetRole];
    },
    [userId, isMember, getCurrentUserRole, getUserRole]
  );

  const canAssignRole = useMemo(
    () => (targetUserId, newRole) => {
      if (!userId || !isMember) return false;
      
      const userRole = getCurrentUserRole;
      const targetRole = getUserRole(targetUserId);
      
      if (!userRole) return false;
      
      // Can't change creator role
      if (targetRole === "creator" || newRole === "creator") return false;
      
      // Only creator can assign admin roles
      if (newRole === "admin" && userRole !== "creator") return false;
      
      // Admins and creators can assign moderator roles
      if (newRole === "moderator" && ROLE_LEVELS[userRole] < ROLE_LEVELS.admin) return false;
      
      // Can only manage users with lower roles
      if (targetRole && ROLE_LEVELS[userRole] <= ROLE_LEVELS[targetRole]) return false;
      
      return true;
    },
    [userId, isMember, getCurrentUserRole, getUserRole]
  );

  return {
    // Data
    groupData,
    members,
    loading,
    error,
    
    // Current user status
    isMember,
    getCurrentUserRole,
    getEffectiveRole,
    
    // User role functions
    getUserRole,
    
    // Permission functions
    canEditContent,
    canDeleteContent,
    canManageGroup,
    canAssignAdmins,
    canAssignModerators,
    canRemoveMember,
    canAssignRole,
  };
}