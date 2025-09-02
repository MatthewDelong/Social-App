// src/pages/GroupPostPage.jsx
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import GroupComments from "../components/groups/GroupComments";
import { useEffect, useState } from "react";
import { doc, getDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { db, storage } from "../firebase";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { formatDistanceToNow } from "date-fns";
import { useGroupPermissions } from "../hooks/useGroupPermissions";
import RoleBadge from "../components/groups/RoleBadge";

export default function GroupPostPage() {
  const { groupId, postId } = useParams();
  const { user } = useAppContext();
  const navigate = useNavigate();

  const [post, setPost] = useState(null);
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [DEFAULT_AVATAR, setDEFAULT_AVATAR] = useState("");
  const [DEFAULT_BANNER, setDEFAULT_BANNER] = useState("");
  const [DEFAULT_LOGO, setDEFAULT_LOGO] = useState("");

  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");

  // Group permissions (viewer)
  const {
    canManageGroup,
    canEditContent,
    canDeleteContent,
    getCurrentUserRole: viewerRole,
    isMember,
    loading: permissionsLoading
  } = useGroupPermissions(groupId, user?.uid);

  // Group permissions (author) - to show author's role to all viewers
  const {
    getCurrentUserRole: authorRole,
    loading: authorPermissionsLoading
  } = useGroupPermissions(groupId, post?.uid);

  // Keep backward compatibility for banner/logo editing
  const isAdminOrMod = user?.isAdmin || user?.isModerator || canManageGroup;

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

  // Fetch post and group data from Firestore
  useEffect(() => {
    const fetchData = async () => {
      // Fetch post
      const postDoc = await getDoc(doc(db, "groupPosts", postId));
      if (postDoc.exists()) {
        let data = { id: postDoc.id, ...postDoc.data() };

        // If no avatar stored, try fetching from users/{uid}
        if (!data.authorPhotoURL && data.uid) {
          const userDoc = await getDoc(doc(db, "users", data.uid));
          if (userDoc.exists()) {
            data.authorPhotoURL = userDoc.data().photoURL || "";
          }
        }

        setPost(data);
      }

      // Fetch group data for banner and logo
      if (groupId) {
        const groupDoc = await getDoc(doc(db, "groups", groupId));
        if (groupDoc.exists()) {
          setGroup({ id: groupDoc.id, ...groupDoc.data() });
        }
      }

      setLoading(false);
    };
    fetchData();
  }, [postId, groupId]);

  if (loading || permissionsLoading || authorPermissionsLoading) return <p className="p-4">Loading post...</p>;
  if (!post) return <p className="p-4">Post not found</p>;

  // Determine permissions using group system
  const canEditThisPost = canEditContent(post.uid);
  const canDeleteThisPost = canDeleteContent(post.uid);

  // Format post date
  const formatPostDate = (timestamp) => {
    if (!timestamp) return "";
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return formatDistanceToNow(date, { addSuffix: true }).replace("about ", "");
    } catch (err) {
      console.error("Error formatting date:", err);
      return "";
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

  // Handlers
  const startEdit = () => {
    setEditContent(post.content);
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditContent("");
  };

  const saveEdit = async () => {
    if (!editContent.trim() || !canEditThisPost) return;
    try {
      await updateDoc(doc(db, "groupPosts", post.id), {
        content: editContent.trim(),
        editedAt: new Date(),
      });
      setPost((prev) => ({ ...prev, content: editContent.trim(), editedAt: new Date() }));
      setIsEditing(false);
      setEditContent("");
    } catch (error) {
      console.error("Error updating post:", error);
      alert("Failed to update post. Please try again.");
    }
  };

  const deletePost = async () => {
    if (!canDeleteThisPost) return;
    if (!window.confirm("Are you sure you want to delete this post? This action cannot be undone.")) return;
    
    try {
      await deleteDoc(doc(db, "groupPosts", post.id));
      navigate(`/groups/${groupId}`); // Go back to group page
    } catch (error) {
      console.error("Error deleting post:", error);
      alert("Failed to delete post. Please try again.");
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Group Banner & Logo */}
      {group && (
        <div className="relative">
          {/* Banner */}
          <div 
            className="w-full h-40 sm:h-56 md:h-64 overflow-hidden cursor-pointer relative group"
            onClick={() => isAdminOrMod && handleImageUpload("bannerURL")}
          >
            <img
              src={group.bannerURL || DEFAULT_BANNER}
              alt={`${group.name} banner`}
              className="w-full h-full object-cover"
            />
            {/* Camera icon for banner - only show for admins/mods */}
            {isAdminOrMod && (
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black bg-opacity-20">
                <div className="w-12 h-12 rounded-full bg-gray-600 bg-opacity-70 flex items-center justify-center">
                  <svg 
                    className="w-6 h-6 text-white" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" 
                    />
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" 
                    />
                  </svg>
                </div>
              </div>
            )}
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
              {/* Camera icon for logo - only show for admins/mods */}
              {isAdminOrMod && (
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black bg-opacity-20 rounded-full">
                  <div className="w-8 h-8 rounded-full bg-gray-600 bg-opacity-70 flex items-center justify-center">
                    <svg 
                      className="w-4 h-4 text-white" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" 
                      />
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" 
                      />
                    </svg>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="mt-20 sm:mt-16 p-4">
        {/* Group name as link back to group */}
        {group && (
          <Link 
            to={`/groups/${groupId}`}
            className="text-2xl font-bold text-gray-800 hover:underline block mb-4"
          >
            {group.name}
          </Link>
        )}

        {/* Post author info */}
        <div className="flex items-center space-x-3 mb-4">
          <img
            src={post.authorPhotoURL || DEFAULT_AVATAR}
            alt={post.author}
            className="w-10 h-10 border-2 border-white rounded-full object-cover flex-shrink-0"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-xl font-bold break-words">{post.author}</h2>
              {authorRole && <RoleBadge role={authorRole} size="xs" />}
            </div>
            {post.createdAt && (
              <p className="text-sm text-gray-500">
                {formatPostDate(post.createdAt)}
                {post.editedAt && (
                  <span className="ml-2 text-xs text-gray-400">(edited)</span>
                )}
              </p>
            )}
          </div>
        </div>

        {/* Post content */}
        {isEditing ? (
          <div className="mb-4">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={4}
              className="w-full p-2 border rounded resize-none break-words"
            />
            <div className="mt-2 space-x-2">
              <button
                onClick={saveEdit}
                className="px-4 py-2 bg-blue-600 text-white rounded"
              >
                Save
              </button>
              <button
                onClick={cancelEdit}
                className="px-4 py-2 bg-gray-400 text-white rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <p className="mb-4 whitespace-pre-wrap break-words">{post.content}</p>
        )}

        {/* Edit/Delete buttons */}
        {(canEditThisPost || canDeleteThisPost) && !isEditing && (
          <div className="mb-4 flex flex-wrap gap-2">
            {canEditThisPost && (
              <button
                onClick={startEdit}
                className="text-xs bg-yellow-500 text-black-800 px-2 py-0.5 rounded hover:bg-yellow-600 transition-colors"
              >
                Edit
              </button>
            )}
            {canDeleteThisPost && (
              <button
                onClick={deletePost}
                className="text-xs bg-red-500 text-black-800 px-2 py-0.5 rounded hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
            )}
          </div>
        )}

        {/* Comments section */}
        <GroupComments
          postId={postId}
          groupId={groupId}
          currentUser={user}
          isAdmin={user?.isAdmin}
          isModerator={user?.isModerator}
          canModerateContent={canDeleteContent}
          canEditContent={canEditContent}
          canDeleteContent={canDeleteContent}
          isMember={isMember}
        />
      </div>
    </div>
  );
}