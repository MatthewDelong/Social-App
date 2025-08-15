// src/components/groups/GroupRoleManager.jsx
import { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { 
  collection, 
  query, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc, 
  setDoc,
  serverTimestamp,
  where
} from 'firebase/firestore';
import { useAppContext } from '../../context/AppContext';
import useGroupPermissions, { ROLES } from '../../hooks/useGroupPermissions';
import RoleBadge from './RoleBadge';

const GroupRoleManager = ({ groupId, onClose }) => {
  const { user } = useAppContext();
  const {
    canAssignAdmins,
    canAssignModerators, 
    canManageUser,
    canAssignRole,
    getEffectiveRole,
    groupData
  } = useGroupPermissions(groupId);

  const [members, setMembers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedRole, setSelectedRole] = useState(ROLES.MEMBER);
  const [showAddUser, setShowAddUser] = useState(false);

  const defaultAvatar = 'https://firebasestorage.googleapis.com/v0/b/social-app-8a28d.firebasestorage.app/o/default-avatar.png?alt=media&token=78165d2b-f095-496c-9de2-5e143bfc41cc';

  useEffect(() => {
    if (!groupId) return;

    const fetchData = async () => {
      try {
        // Fetch group members
        const membersRef = collection(db, 'groups', groupId, 'members');
        const membersSnapshot = await getDocs(membersRef);
        const membersData = membersSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // Fetch user details for each member
        const usersRef = collection(db, 'users');
        const usersSnapshot = await getDocs(usersRef);
        const usersData = usersSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // Create user lookup map
        const userMap = {};
        usersData.forEach(userData => {
          userMap[userData.id] = userData;
        });

        // Combine member data with user details
        const enrichedMembers = membersData.map(member => ({
          ...member,
          userData: userMap[member.id] || {}
        })).sort((a, b) => {
          // Sort by role hierarchy, then by name
          const aLevel = getRoleLevel(getEffectiveRole(a.id, a.role));
          const bLevel = getRoleLevel(getEffectiveRole(b.id, b.role));
          if (aLevel !== bLevel) return bLevel - aLevel;
          
          const aName = a.userData.displayName || a.userData.email || 'Unknown';
          const bName = b.userData.displayName || b.userData.email || 'Unknown';
          return aName.localeCompare(bName);
        });

        setMembers(enrichedMembers);
        setAllUsers(usersData);
      } catch (error) {
        console.error('Error fetching group data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [groupId, getEffectiveRole]);

  const getRoleLevel = (role) => {
    const levels = {
      [ROLES.SITE_ADMIN]: 6,
      [ROLES.SITE_MODERATOR]: 5,
      [ROLES.GROUP_CREATOR]: 4,
      [ROLES.GROUP_ADMIN]: 3,
      [ROLES.GROUP_MODERATOR]: 2,
      [ROLES.MEMBER]: 1
    };
    return levels[role] || 0;
  };

  const handleRoleChange = async (memberId, newRole) => {
    try {
      const memberRef = doc(db, 'groups', groupId, 'members', memberId);
      await updateDoc(memberRef, {
        role: newRole,
        assignedBy: user.uid,
        assignedAt: serverTimestamp()
      });

      // Update local state
      setMembers(prev => prev.map(member => 
        member.id === memberId 
          ? { ...member, role: newRole, assignedBy: user.uid, assignedAt: new Date() }
          : member
      ));
    } catch (error) {
      console.error('Error updating role:', error);
      alert('Failed to update role. Please try again.');
    }
  };

  const handleRemoveMember = async (memberId) => {
    if (!confirm('Are you sure you want to remove this member from the group?')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'groups', groupId, 'members', memberId));
      setMembers(prev => prev.filter(member => member.id !== memberId));
    } catch (error) {
      console.error('Error removing member:', error);
      alert('Failed to remove member. Please try again.');
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!selectedUser) return;

    try {
      const memberRef = doc(db, 'groups', groupId, 'members', selectedUser);
      await setDoc(memberRef, {
        role: selectedRole,
        assignedBy: user.uid,
        assignedAt: serverTimestamp(),
        joinedAt: serverTimestamp()
      });

      // Find user data and add to members list
      const userData = allUsers.find(u => u.id === selectedUser);
      const newMember = {
        id: selectedUser,
        role: selectedRole,
        assignedBy: user.uid,
        assignedAt: new Date(),
        joinedAt: new Date(),
        userData: userData || {}
      };

      setMembers(prev => [...prev, newMember].sort((a, b) => {
        const aLevel = getRoleLevel(getEffectiveRole(a.id, a.role));
        const bLevel = getRoleLevel(getEffectiveRole(b.id, b.role));
        if (aLevel !== bLevel) return bLevel - aLevel;
        
        const aName = a.userData.displayName || a.userData.email || 'Unknown';
        const bName = b.userData.displayName || b.userData.email || 'Unknown';
        return aName.localeCompare(bName);
      }));

      setSelectedUser('');
      setSelectedRole(ROLES.MEMBER);
      setShowAddUser(false);
    } catch (error) {
      console.error('Error adding member:', error);
      alert('Failed to add member. Please try again.');
    }
  };

  const getAvailableRoles = (currentRole) => {
    const roles = [];
    
    // Always allow setting to member (demotion)
    roles.push({ value: ROLES.MEMBER, label: 'Member' });
    
    // Check what roles current user can assign
    if (canAssignRole(ROLES.GROUP_MODERATOR)) {
      roles.push({ value: ROLES.GROUP_MODERATOR, label: 'Group Moderator' });
    }
    
    if (canAssignRole(ROLES.GROUP_ADMIN)) {
      roles.push({ value: ROLES.GROUP_ADMIN, label: 'Group Admin' });
    }

    return roles;
  };

  const nonMembers = allUsers.filter(u => 
    !members.some(m => m.id === u.id) && u.id !== user?.uid
  );

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6">
          <div className="text-center">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold">Manage Group Roles</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl"
            >
              ×
            </button>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Group: {groupData?.name || 'Loading...'}
          </p>
        </div>

        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {/* Add User Section */}
          {(canAssignAdmins || canAssignModerators) && (
            <div className="mb-6">
              <button
                onClick={() => setShowAddUser(!showAddUser)}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                {showAddUser ? 'Cancel' : 'Add Member'}
              </button>

              {showAddUser && (
                <form onSubmit={handleAddUser} className="mt-4 p-4 bg-gray-50 rounded">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">User</label>
                      <select
                        value={selectedUser}
                        onChange={(e) => setSelectedUser(e.target.value)}
                        className="w-full p-2 border rounded"
                        required
                      >
                        <option value="">Select user...</option>
                        {nonMembers.map(user => (
                          <option key={user.id} value={user.id}>
                            {user.displayName || user.email || 'Unknown'}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Role</label>
                      <select
                        value={selectedRole}
                        onChange={(e) => setSelectedRole(e.target.value)}
                        className="w-full p-2 border rounded"
                      >
                        {getAvailableRoles().map(role => (
                          <option key={role.value} value={role.value}>
                            {role.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-end">
                      <button
                        type="submit"
                        className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                      >
                        Add Member
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Members List */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Group Members ({members.length})</h3>
            
            {members.map((member) => {
              const effectiveRole = getEffectiveRole(member.id, member.role);
              const canManageThisMember = canManageUser(effectiveRole);
              const isCreator = groupData?.creatorId === member.id;

              return (
                <div key={member.id} className="border rounded p-4 bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <img
                        src={member.userData.photoURL || defaultAvatar}
                        alt="avatar"
                        className="w-10 h-10 rounded-full object-cover"
                      />
                      <div>
                        <p className="font-medium">
                          {member.userData.displayName || member.userData.email || 'Unknown'}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <RoleBadge role={effectiveRole} />
                          {isCreator && (
                            <span className="text-xs text-gray-500">(Group Creator)</span>
                          )}
                        </div>
                        {member.assignedAt && (
                          <p className="text-xs text-gray-500 mt-1">
                            Role assigned: {new Date(member.assignedAt.toDate ? member.assignedAt.toDate() : member.assignedAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {canManageThisMember && !isCreator && (
                        <>
                          <select
                            value={member.role || ROLES.MEMBER}
                            onChange={(e) => handleRoleChange(member.id, e.target.value)}
                            className="p-1 text-sm border rounded"
                          >
                            {getAvailableRoles(member.role).map(role => (
                              <option key={role.value} value={role.value}>
                                {role.label}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => handleRemoveMember(member.id)}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            Remove
                          </button>
                        </>
                      )}
                      {(isCreator || !canManageThisMember) && (
                        <span className="text-xs text-gray-500">
                          {isCreator ? 'Creator' : 'Cannot modify'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {members.length === 0 && (
              <p className="text-gray-500 text-center py-8">No members found.</p>
            )}
          </div>
        </div>

        <div className="p-6 border-t bg-gray-50">
          <div className="text-sm text-gray-600">
            <p className="mb-2"><strong>Permission Hierarchy:</strong></p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>Site Admin → Site Moderator → Group Creator</div>
              <div>Group Creator → Group Admin → Group Moderator → Member</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GroupRoleManager;