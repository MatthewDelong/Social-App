import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  updateDoc,
  setDoc,
  deleteDoc,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import { db, storage } from "../firebase";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { useAppContext } from "../context/AppContext";
import GroupNewPost from "../components/groups/GroupNewPost";
import { useGroupPermissions } from "../hooks/useGroupPermissions";
import RoleBadge from "../components/groups/RoleBadge";
import GroupRoleManager from "../components/groups/GroupRoleManager";

export default function GroupPage() {
  const { groupId } = useParams();
  const { user } = useAppContext();
  const navigate = useNavigate();

  const [group, setGroup] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [DEFAULT_AVATAR, setDEFAULT_AVATAR] = useState("");
  const [DEFAULT_BANNER, setDEFAULT_BANNER] = useState("");
  const [DEFAULT_LOGO, setDEFAULT_LOGO] = useState("");

  const [isMember, setIsMember] = useState(false);
  const [members, setMembers] = useState([]);

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const [showRoleManager, setShowRoleManager] = useState(false);

  // Group permissions
  const {
    canManageGroup,
    canAssignAdmins,
    canDeleteContent,
    canEditContent,
    getCurrentUserRole,
    isMember: isPermissionMember,
    getUserRole
  } = useGroupPermissions(groupId, user?.uid);

  const isAdminOrMod = user?.isAdmin || user?.isModerator;
  const isCreator = group?.creatorId === user?.uid || group?.createdBy === user?.uid;
  const currentUserRole = getCurrentUserRole;

  // Load default images from storage
  useEffect(() => {
    const loadDefaults = async () => {
      try {
        const avatarRef = ref(storage, "default-avatar.png");
        const bannerRef = ref(storage, "default-banner.jpg");
        const logoRef = ref(storage, "default-group-logo.png");

        setDEFAULT_AVATAR(await getDownloadURL(avatarRef));
        setDEFAULT_BANNER(await getDownloadURL(bannerRef));
        setDEFAULT_LOGO(await getDownloadURL(logoRef));
      } catch (err) {
        console.error("Error loading default images:", err);
      }
    };
    loadDefaults();
  }, []);

  // Fetch group data, posts, and members
  useEffect(() => {
    const fetchGroup = async () => {
      const groupDoc = await getDoc(doc(db, "groups", groupId));
      if (groupDoc.exists()) {
        setGroup({ id: groupDoc.id, ...groupDoc.data() });
        setEditName(groupDoc.data().name || "");
        setEditDescription(groupDoc.data().description || "");
      }
    };
    fetchGroup();

    // Posts listener
    const postsQuery = query(
      collection(db, "groupPosts"),
      where("groupId", "==", groupId),
      orderBy("createdAt", "desc")
    );

    const unsubPosts = onSnapshot(postsQuery, async (snapshot) => {
      const rawPosts = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      const enrichedPosts = await Promise.all(
        rawPosts.map(async (post) => {
          if (!post.authorPhotoURL && post.uid) {
            try {
              const userDoc = await getDoc(doc(db, "users", post.uid));
              if (userDoc.exists()) {
                return {
                  ...post,
                  authorPhotoURL: userDoc.data().photoURL || DEFAULT_AVATAR,
                };
              }
            } catch (err) {
              console.error("Error fetching user photoURL:", err);
            }
          }
          return post;
        })
      );

      setPosts(enrichedPosts);
      setLoading(false);
    });

    // Members listener for real-time updates
    const membersQuery = collection(db, "groups", groupId, "members");
    const unsubMembers = onSnapshot(membersQuery, (snapshot) => {
      const membersData = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMembers(membersData);
      
      if (user) {
        const userMember = membersData.find(m => m.id === user.uid);
        setIsMember(!!userMember);
      }
    });

    return () => {
      unsubPosts();
      unsubMembers();
    };

  }, [groupId, user, DEFAULT_AVATAR]);

  // Join group
  const joinGroup = async () => {
    if (!user) return;
    try {
      await setDoc(doc(db, "groups", groupId, "members", user.uid), {
        userId: user.uid,
        displayName: user.displayName || "Anonymous",
        email: user.email,
        photoURL: user.photoURL || DEFAULT_AVATAR,
        role: "member",
        joinedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error joining group:", error);
      alert("Failed to join group. Please try again.");
    }
  };

  // Leave group
  const leaveGroup = async () => {
    if (!user) return;
    
    // Prevent creator from leaving their own group
    if (isCreator) {
      alert("Group creators cannot leave their own group. Transfer ownership or delete the group instead.");
      return;
    }
    
    if (!confirm("Are you sure you want to leave this group?")) return;
    
    try {
      await deleteDoc(doc(db, "groups", groupId, "members", user.uid));
    } catch (error) {
      console.error("Error leaving group:", error);
      alert("Failed to leave group. Please try again.");
    }
  };

  // Banner / logo uploader
  const handleImageUpload = async (type) => {
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/*";
    fileInput.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const storagePath = `groups/${groupId}/${type}-${Date.now()}.jpg`;
        const storageRef = ref(storage, storagePath);
        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);

        await updateDoc(doc(db, "groups", groupId), { [type]: url });
        setGroup((prev) => ({ ...prev, [type]: url }));
      } catch (err) {
        console.error(`Error uploading ${type}:`, err);
      }
    };
    fileInput.click();
  };

  // Save group edits
  const saveEdits = async () => {
    try {
      await updateDoc(doc(db, "groups", groupId), {
        name: editName,
        description: editDescription,
      });
      setGroup((prev) => ({
        ...prev,
        name: editName,
        description: editDescription,
      }));
      setEditing(false);
    } catch (err) {
      console.error("Error updating group:", err);
    }
  };

  // Delete post
  const deletePost = async (postId, authorId) => {
    if (!canDeleteContent(authorId)) {
      alert("You don't have permission to delete this post.");
      return;
    }
    
    if (!confirm("Are you sure you want to delete this post?")) return;
    
    try {
      await deleteDoc(doc(db, "groupPosts", postId));
    } catch (error) {
      console.error("Error deleting post:", error);
      alert("Failed to delete post. Please try again.");
    }
  };

  // Delete group
  const deleteGroup = async () => {
    if (!canManageGroup) {
      alert("You don't have permission to delete this group.");
      return;
    }
    
    if (!window.confirm("Are you sure you want to delete this group? This action cannot be undone.")) {
      return;
    }
    try {
      await deleteDoc(doc(db, "groups", groupId));
      navigate("/groups"); // redirect after deletion
    } catch (err) {
      console.error("Error deleting group:", err);
    }
  };

  if (!group) return <p className="p-4">Group not found</p>;
  if (loading) return <p className="p-4">Loading posts...</p>;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Group Banner & Logo */}
      {group && (
        <div className="relative">
          {/* Banner */}
          <div 
            className="w-full h-40 border-4 border-white sm:h-56 md:h-64 overflow-hidden cursor-pointer relative group"
            onClick={() => isAdminOrMod && handleImageUpload("bannerURL")}
          >
            <img
              src={group.bannerURL || DEFAULT_BANNER}
              alt={`${group.name} banner`}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Logo overhang */}
          <div
            className="absolute -bottom-12 left-4 cursor-pointer group"
            onClick={() => isAdminOrMod && handleImageUpload("logoURL")}
          >
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-4 border-white overflow-hidden shadow-lg relative">
              <img
                src={group.logoURL || DEFAULT_LOGO}
                alt={`${group.name} logo`}
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      )}

      {/* Name, Description, Join/Leave */}
      <div className="mt-20 sm:mt-16 p-4">
        {editing ? (
          <div className="space-y-2">
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full border rounded p-2"
            />
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              className="w-full border rounded p-2"
            />
            <div className="flex gap-2">
              <button
                onClick={saveEdits}
                className="px-4 py-2 bg-green-500 text-white rounded"
              >
                Save
              </button>
              <button
                onClick={() => setEditing(false)}
                className="px-4 py-2 bg-gray-400 text-white rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold">{group.name}</h1>
            <p className="mb-4">{group.description}</p>
            <div className="flex items-center gap-4 mb-4">
              {user && (
                <>
                  {isMember ? (
                    <button
                      onClick={leaveGroup}
                      className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                      disabled={isCreator}
                    >
                      {isCreator ? "Creator" : "Leave Group"}
                    </button>
                  ) : (
                    <button
                      onClick={joinGroup}
                      className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                    >
                      Join Group
                    </button>
                  )}
                  
                  {currentUserRole && (
                    <RoleBadge role={currentUserRole} size="sm" />
                  )}
                </>
              )}
              
              <span className="text-sm text-gray-600">
                {members.length} member{members.length !== 1 ? 's' : ''}
              </span>
            </div>
            
            {/* Management buttons */}
            <div className="flex flex-wrap gap-3">
              {canManageGroup && (
                <button
                  onClick={() => setEditing(true)}
                  className="px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600 transition-colors"
                >
                  Settings
                </button>
              )}
              
              {canAssignAdmins && (
                <button
                  onClick={() => setShowRoleManager(true)}
                  className="px-3 py-1 bg-purple-500 text-white rounded hover:bg-purple-600 transition-colors"
                >
                  Manage Roles
                </button>
              )}
              
              {(canManageGroup || isAdminOrMod) && (
                <button
                  onClick={deleteGroup}
                  className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                >
                  Delete Group
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* New Post - Only for members */}
      {isMember && (
        <GroupNewPost groupId={groupId} currentUser={user} />
      )}

      {/* Posts list */}
      <div className="space-y-4 mt-4 p-4">
        {posts.length === 0 ? (
          <p>No posts yet.</p>
        ) : (
          posts.map((post) => (
            <div
              key={post.id}
              className="border p-3 rounded flex items-center gap-3"
            >
              <img
                src={post.authorPhotoURL || DEFAULT_AVATAR}
                alt={post.author}
                className="w-8 h-8 border-2 border-white rounded-full object-cover"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-semibold">{post.author}</p>
                  <RoleBadge role={getUserRole ? getUserRole(post.uid) : null} size="xs" />
                </div>
                <p className="mb-2">{post.content}</p>
                <div className="flex items-center gap-3">
                  <Link
                    to={`/groups/${groupId}/post/${post.id}`}
                    className="text-blue-500 hover:text-blue-700 text-sm"
                  >
                    View Comments
                  </Link>
                  
                  {canDeleteContent(post.uid) && (
                    <button
                      onClick={() => deletePost(post.id, post.uid)}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Members list */}
      <div className="mt-8 p-4 border rounded">
        <h2 className="text-lg font-semibold mb-3">Members ({members.length})</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {members
            .sort((a, b) => {
              // Sort by role hierarchy: creator > admin > moderator > member
              const roleOrder = { creator: 1, admin: 2, moderator: 3, member: 4 };
              return (roleOrder[a.role] || 4) - (roleOrder[b.role] || 4);
            })
            .map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-3 hover:bg-gray-100 p-2 rounded transition-colors"
              >
                <Link
                  to={`/profile/${m.id}`}
                  className="flex items-center gap-3 flex-1"
                >
                  <img
                    src={m.photoURL || DEFAULT_AVATAR}
                    alt={m.displayName || 'Member'}
                    className="w-10 h-10 border-2 border-white rounded-full object-cover"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{m.displayName || 'Unknown'}</span>
                      {m.role === 'creator' && (
                        <span className="text-xs text-yellow-600 font-medium">Creator</span>
                      )}
                    </div>
                    <RoleBadge role={m.role} size="xs" />
                  </div>
                </Link>
              </div>
            ))}
        </div>
      </div>
      
      {/* Role Manager Modal */}
      {showRoleManager && (
        <GroupRoleManager
          groupId={groupId}
          currentUser={user}
          isOpen={showRoleManager}
          onClose={() => setShowRoleManager(false)}
        />
      )}
    </div>
  );
}