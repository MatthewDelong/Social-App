import { useState, useEffect } from "react";
import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  updateDoc,
  query,
  where,
  getDocs 
} from "firebase/firestore";
import { db } from "../../firebase";
import { X, UserPlus, Trash2 } from "lucide-react";
import { useGroupPermissions } from "../../hooks/useGroupPermissions";
import RoleBadge from "./RoleBadge";

const ROLE_OPTIONS = [
  { value: "member", label: "Member" },
  { value: "moderator", label: "Moderator" },
  { value: "admin", label: "Admin" },
];

export default function GroupRoleManager({ 
  groupId, 
  currentUser, 
  isOpen, 
  onClose 
}) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [selectedRole, setSelectedRole] = useState("member");

  const {
    canAssignAdmins,
    canAssignModerators,
    canRemoveMember,
    canAssignRole,
    getUserRole,
    members: memberData
  } = useGroupPermissions(groupId, currentUser?.uid);

  // Load members when component opens
  useEffect(() => {
    if (isOpen && groupId) {
      loadMembers();
    }
  }, [isOpen, groupId, memberData]);

  const loadMembers = () => {
    if (!memberData) return;
    
    // Convert members object to array and sort by role hierarchy
    const memberArray = Object.values(memberData).sort((a, b) => {
      const roleOrder = { creator: 4, admin: 3, moderator: 2, member: 1 };
      return (roleOrder[b.role] || 1) - (roleOrder[a.role] || 1);
    });
    
    setMembers(memberArray);
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!newMemberEmail.trim()) return;

    setLoading(true);
    setError("");

    try {
      // Find user by email
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("email", "==", newMemberEmail.trim()));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setError("User not found with that email address");
        setLoading(false);
        return;
      }

      const userData = querySnapshot.docs[0].data();
      const userId = querySnapshot.docs[0].id;

      // Check if already a member
      if (memberData[userId]) {
        setError("User is already a member of this group");
        setLoading(false);
        return;
      }

      // Add to group members
      await setDoc(doc(db, "groups", groupId, "members", userId), {
        role: selectedRole,
        displayName: userData.displayName || userData.email,
        photoURL: userData.photoURL || "",
        joinedAt: new Date(),
        assignedBy: currentUser.uid,
        assignedAt: new Date(),
      });

      setNewMemberEmail("");
      setSelectedRole("member");
    } catch (err) {
      console.error("Error adding member:", err);
      setError("Failed to add member. Please try again.");
    }

    setLoading(false);
  };

  const handleRoleChange = async (memberId, newRole) => {
    if (!canAssignRole(memberId, newRole)) {
      setError("You don't have permission to assign this role");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await updateDoc(doc(db, "groups", groupId, "members", memberId), {
        role: newRole,
        assignedBy: currentUser.uid,
        assignedAt: new Date(),
      });
    } catch (err) {
      console.error("Error updating role:", err);
      setError("Failed to update role. Please try again.");
    }

    setLoading(false);
  };

  const handleRemoveMember = async (memberId) => {
    if (!canRemoveMember(memberId)) {
      setError("You don't have permission to remove this member");
      return;
    }

    if (!window.confirm("Are you sure you want to remove this member?")) return;

    setLoading(true);
    setError("");

    try {
      await deleteDoc(doc(db, "groups", groupId, "members", memberId));
    } catch (err) {
      console.error("Error removing member:", err);
      setError("Failed to remove member. Please try again.");
    }

    setLoading(false);
  };

  const getAvailableRoles = (memberId) => {
    const currentRole = getUserRole ? getUserRole(memberId) : null;
    
    return ROLE_OPTIONS.filter(option => {
      // Creator can assign any role except creator
      if (canAssignAdmins) return option.value !== "creator";
      
      // Admins can only assign moderator and member roles
      if (canAssignModerators) return ["moderator", "member"].includes(option.value);
      
      return false;
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg max-w-2xl w-full mx-4 max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-semibold">Manage Group Roles</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Error message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded">
              {error}
            </div>
          )}

          {/* Add new member */}
          {(canAssignAdmins || canAssignModerators) && (
            <div className="border rounded-lg p-4">
              <h3 className="font-medium mb-3 flex items-center gap-2">
                <UserPlus size={18} />
                Add New Member
              </h3>
              <form onSubmit={handleAddMember} className="space-y-3">
                <div>
                  <input
                    type="email"
                    value={newMemberEmail}
                    onChange={(e) => setNewMemberEmail(e.target.value)}
                    placeholder="Enter user's email address"
                    className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                <div className="flex gap-3">
                  <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value)}
                    className="px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {getAvailableRoles("").map(role => (
                      <option key={role.value} value={role.value}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    disabled={loading || !newMemberEmail.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    {loading ? "Adding..." : "Add Member"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Member list */}
          <div className="border rounded-lg">
            <h3 className="font-medium p-3 border-b">Current Members ({members.length})</h3>
            <div className="max-h-80 overflow-y-auto">
              {members.map((member) => (
                <div key={member.id} className="flex items-center justify-between p-3 border-b last:border-b-0">
                  <div className="flex items-center gap-3">
                    <img
                      src={member.photoURL || "/api/placeholder/32/32"}
                      alt={member.displayName}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                    <div>
                      <div className="font-medium">{member.displayName}</div>
                      <div className="flex items-center gap-2">
                        <RoleBadge role={member.role} size="xs" />
                        {member.role === "creator" && (
                          <span className="text-xs text-gray-500">(Cannot be changed)</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Role selector */}
                    {member.role !== "creator" && canAssignRole(member.id, "member") && (
                      <select
                        value={member.role}
                        onChange={(e) => handleRoleChange(member.id, e.target.value)}
                        disabled={loading}
                        className="text-sm px-2 py-1 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        {getAvailableRoles(member.id).map(role => (
                          <option key={role.value} value={role.value}>
                            {role.label}
                          </option>
                        ))}
                      </select>
                    )}

                    {/* Remove button */}
                    {member.role !== "creator" && canRemoveMember(member.id) && (
                      <button
                        onClick={() => handleRemoveMember(member.id)}
                        disabled={loading}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                        title="Remove member"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Role descriptions */}
          <div className="text-sm text-gray-600 space-y-1">
            <div><strong>Creator:</strong> Full control over the group (cannot be changed)</div>
            <div><strong>Admin:</strong> Can assign moderators and manage group settings</div>
            <div><strong>Moderator:</strong> Can moderate content and comments</div>
            <div><strong>Member:</strong> Can participate in discussions</div>
          </div>
        </div>

        <div className="flex-shrink-0 p-4 border-t bg-gray-50 flex justify-between items-center">
          <div className="text-sm text-gray-600">
            💡 Tip: Click outside to close this modal
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}