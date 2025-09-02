// src/hooks/useGroupPermissions.jsx
import { useEffect, useState, useMemo } from "react";
import {
  doc,
  onSnapshot,
  collection,
} from "firebase/firestore";
import { db } from "../firebase";

// Role hierarchy levels for easy comparison
const ROLE_LEVELS = {
  member: 1,
  moderator: 2,
  admin: 3,
  creator: 4,
};

export function useGroupPermissions(groupId, userId, injectedIsSiteAdmin = undefined) {
  const [groupData, setGroupData] = useState(null);
  const [members, setMembers] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Site Admin flag (from users/{uid}.isAdmin) unless explicitly injected
  const [siteAdminFromDoc, setSiteAdminFromDoc] = useState(false);
  const isSiteAdmin = injectedIsSiteAdmin ?? siteAdminFromDoc;

  // Listen to current user profile to get isAdmin (site-wide admin)
  useEffect(() => {
    if (!userId || injectedIsSiteAdmin !== undefined) return; // skip if injected is provided

    const userRef = doc(db, "users", userId);
    const unsub = onSnapshot(
      userRef,
      (snap) => {
        if (snap.exists()) {
          setSiteAdminFromDoc(Boolean(snap.data()?.isAdmin));
        } else {
          setSiteAdminFromDoc(false);
        }
      },
      () => setSiteAdminFromDoc(false)
    );

    return () => unsub();
  }, [userId, injectedIsSiteAdmin]);

  // Listen to group data
  useEffect(() => {
    if (!groupId) {
      setLoading(false);
      return;
    }

    const groupRef = doc(db, "groups", groupId);
    const unsubscribe = onSnapshot(
      groupRef,
      (docSnap) => {
        if (docSnap.exists()) {
          setGroupData({ id: docSnap.id, ...docSnap.data() });
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
        snapshot.docs.forEach((d) => {
          membersData[d.id] = { id: d.id, ...d.data() };
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

  // Current user's in-group role (null if not a member)
  const getCurrentUserRole = useMemo(() => {
    if (!userId || !members[userId]) return null;
    return members[userId].role || "member";
  }, [userId, members]);

  // Effective role: if site admin, treat as top-level override
  const getEffectiveRole = useMemo(() => {
    if (isSiteAdmin) return "site_admin";
    return getCurrentUserRole;
  }, [isSiteAdmin, getCurrentUserRole]);

  // Is member: site admin should be treated as member for UI availability
  const isMember = useMemo(() => {
    return Boolean(userId && members[userId]) || Boolean(isSiteAdmin);
  }, [userId, members, isSiteAdmin]);

  // Get a specific user's role in the group
  const getUserRole = useMemo(
    () => (targetUserId) => {
      if (!targetUserId || !members[targetUserId]) return null;
      return members[targetUserId].role || "member";
    },
    [members]
  );

  // Permission helpers with Site Admin override (short-circuit)
  const canEditContent = useMemo(
    () => (authorId) => {
      if (isSiteAdmin) return true;
      if (!userId || !isMember) return false;
      if (authorId === userId) return true;
      const userRole = getCurrentUserRole;
      return userRole && ROLE_LEVELS[userRole] >= ROLE_LEVELS.moderator;
    },
    [isSiteAdmin, userId, isMember, getCurrentUserRole]
  );

  const canDeleteContent = useMemo(
    () => (authorId) => {
      if (isSiteAdmin) return true;
      if (!userId || !isMember) return false;
      if (authorId === userId) return true;
      const userRole = getCurrentUserRole;
      return userRole && ROLE_LEVELS[userRole] >= ROLE_LEVELS.moderator;
    },
    [isSiteAdmin, userId, isMember, getCurrentUserRole]
  );

  const canManageGroup = useMemo(() => {
    if (isSiteAdmin) return true;
    const userRole = getCurrentUserRole;
    return userRole && ROLE_LEVELS[userRole] >= ROLE_LEVELS.admin;
  }, [isSiteAdmin, getCurrentUserRole]);

  const canAssignAdmins = useMemo(() => {
    if (isSiteAdmin) return true;
    return getCurrentUserRole === "creator";
  }, [isSiteAdmin, getCurrentUserRole]);

  const canAssignModerators = useMemo(() => {
    if (isSiteAdmin) return true;
    const userRole = getCurrentUserRole;
    return userRole && ROLE_LEVELS[userRole] >= ROLE_LEVELS.admin;
  }, [isSiteAdmin, getCurrentUserRole]);

  const canRemoveMember = useMemo(
    () => (targetUserId) => {
      const targetRole = getUserRole(targetUserId);
      if (isSiteAdmin) return targetRole !== "creator";
      if (!userId || !isMember) return false;
      if (targetUserId === userId) return true; // self-leave
      const userRole = getCurrentUserRole;
      if (!userRole || !targetRole) return false;
      return ROLE_LEVELS[userRole] > ROLE_LEVELS[targetRole]; // only lower roles
    },
    [isSiteAdmin, userId, isMember, getCurrentUserRole, getUserRole]
  );

  const canAssignRole = useMemo(
    () => (targetUserId, newRole) => {
      const targetRole = getUserRole(targetUserId);

      // Never allow creating/demoting a "creator" from client
      if (targetRole === "creator" || newRole === "creator") return false;

      if (isSiteAdmin) {
        // Site Admin can set any non-creator role
        return true;
      }

      if (!userId || !isMember) return false;

      const userRole = getCurrentUserRole;
      if (!userRole) return false;

      // Only creator can assign admin roles
      if (newRole === "admin" && userRole !== "creator") return false;

      // Admins and creators can assign moderator roles
      if (newRole === "moderator" && ROLE_LEVELS[userRole] < ROLE_LEVELS.admin)
        return false;

      // Can only manage users with lower roles
      if (targetRole && ROLE_LEVELS[userRole] <= ROLE_LEVELS[targetRole])
        return false;

      return true;
    },
    [isSiteAdmin, userId, isMember, getCurrentUserRole, getUserRole]
  );

  return {
    // Data
    groupData,
    members,
    loading,
    error,

    // Current user status
    isMember,
    isSiteAdmin,
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