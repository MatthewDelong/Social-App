import { useEffect, useState, useCallback } from "react";
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
  addDoc,
} from "firebase/firestore";
import { db, storage } from "../firebase";
import { getDownloadURL, ref as storageRef, uploadBytes, uploadBytesResumable } from "firebase/storage";
import { useAppContext } from "../context/AppContext";
import { useGroupPermissions } from "../hooks/useGroupPermissions";
import RoleBadge from "../components/groups/RoleBadge";
import GroupRoleManager from "../components/groups/GroupRoleManager";
import { Image as ImageIcon, X as CloseIcon } from "lucide-react";

const MAX_IMAGES_PER_POST = 4;
const TARGET_SIZE = 512;
const MAX_UPLOAD_BYTES = 1024 * 1024; // 1 MB

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

  // New post composer state
  const [newContent, setNewContent] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]); // File[]
  const [previews, setPreviews] = useState([]); // string[]
  const [posting, setPosting] = useState(false);
  const [postProgress, setPostProgress] = useState(0);

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
        const avatarRef = storageRef(storage, "default-avatar.png");
        const bannerRef = storageRef(storage, "default-banner.jpg");
        const logoRef = storageRef(storage, "default-group-logo.png");

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
        const sref = storageRef(storage, storagePath);
        await uploadBytes(sref, file);
        const url = await getDownloadURL(sref);

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

  // Util: resize to 512x512 cover and compress under 1MB (mirrors Home)
  const resizeToSquare512 = async (file) => {
    const img = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = URL.createObjectURL(file);
    });
    const canvas = document.createElement('canvas');
    canvas.width = TARGET_SIZE;
    canvas.height = TARGET_SIZE;
    const ctx = canvas.getContext('2d');
    const scale = Math.max(TARGET_SIZE / img.width, TARGET_SIZE / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    const dx = (TARGET_SIZE - w) / 2;
    const dy = (TARGET_SIZE - h) / 2;
    ctx.drawImage(img, dx, dy, w, h);
    URL.revokeObjectURL(img.src);

    let quality = 0.92;
    let blob = await new Promise((res) => canvas.toBlob(res, 'image/webp', quality));
    while (blob && blob.size > MAX_UPLOAD_BYTES && quality > 0.5) {
      quality -= 0.08;
      blob = await new Promise((res) => canvas.toBlob(res, 'image/webp', quality));
    }
    if (!blob || blob.size > MAX_UPLOAD_BYTES) {
      // fallback to jpeg
      quality = 0.9;
      blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality));
      while (blob && blob.size > MAX_UPLOAD_BYTES && quality > 0.5) {
        quality -= 0.08;
        blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality));
      }
    }
    if (!blob || blob.size > MAX_UPLOAD_BYTES) {
      throw new Error('Image exceeds 1 MB after compression');
    }
    return blob;
  };

  // Composer: trigger file input
  const triggerComposerUpload = () => {
    const el = document.getElementById('upload-new-group-post');
    el?.click();
  };

  // Composer: on files chosen
  const handleComposerFilesChange = (fileList) => {
    if (!fileList || fileList.length === 0) return;
    const incoming = Array.from(fileList);
    const available = Math.max(0, MAX_IMAGES_PER_POST - selectedFiles.length);
    if (available <= 0) return alert(`You can attach up to ${MAX_IMAGES_PER_POST} images.`);
    const toAdd = incoming.slice(0, available);

    const nextFiles = [...selectedFiles, ...toAdd];
    const nextPreviews = [
      ...previews,
      ...toAdd.map((f) => URL.createObjectURL(f)),
    ];
    setSelectedFiles(nextFiles);
    setPreviews(nextPreviews);

    // clear input value to allow re-selecting same files
    const input = document.getElementById('upload-new-group-post');
    if (input) input.value = "";
  };

  const removeComposerFile = (index) => {
    const nextFiles = [...selectedFiles];
    const nextPreviews = [...previews];
    const [removed] = nextFiles.splice(index, 1);
    URL.revokeObjectURL(nextPreviews[index]);
    nextPreviews.splice(index, 1);
    setSelectedFiles(nextFiles);
    setPreviews(nextPreviews);
  };

  // Composer: create post then upload images
  const createNewPost = async () => {
    if (!user || !isMember) return;
    const content = newContent.trim();
    if (!content && selectedFiles.length === 0) return; // nothing to post

    setPosting(true);
    setPostProgress(0);
    try {
      const author = user.displayName || user.email || "Anonymous";
      const authorPhotoURL = user.photoURL || DEFAULT_AVATAR;
      const docRef = await addDoc(collection(db, 'groupPosts'), {
        groupId,
        uid: user.uid,
        author,
        authorPhotoURL,
        content,
        createdAt: serverTimestamp(),
        images: [],
      });

      if (selectedFiles.length > 0) {
        const uploaded = [];
        let totalBytes = 0;
        let transferred = 0;

        // Pre-resize & measure
        const blobs = [];
        for (let i = 0; i < selectedFiles.length; i++) {
          const file = selectedFiles[i];
          const blob = await resizeToSquare512(file);
          blobs.push({ blob, name: file.name });
          totalBytes += blob.size;
        }

        for (let i = 0; i < blobs.length; i++) {
          const { blob, name } = blobs[i];
          const path = `groupPosts/${docRef.id}/${Date.now()}-${i}-${name.replace(/[^a-zA-Z0-9_.-]/g, '_')}.webp`;
          const sref = storageRef(storage, path);
          const task = uploadBytesResumable(sref, blob, { contentType: blob.type || 'image/webp' });
          await new Promise((resolve, reject) => {
            task.on('state_changed', (snap) => {
              transferred = transferred + (snap.bytesTransferred - (snap._last || 0));
              snap._last = snap.bytesTransferred;
              const percent = Math.min(100, Math.round((transferred / totalBytes) * 100));
              setPostProgress(percent);
            }, reject, async () => {
              const url = await getDownloadURL(task.snapshot.ref);
              uploaded.push({ url, path, w: TARGET_SIZE, h: TARGET_SIZE });
              resolve();
            });
          });
        }

        await updateDoc(doc(db, 'groupPosts', docRef.id), { images: uploaded });
      }

      // reset composer
      setNewContent("");
      previews.forEach((p) => URL.revokeObjectURL(p));
      setPreviews([]);
      setSelectedFiles([]);
      setPostProgress(0);
    } catch (e) {
      console.error('Failed to create post', e);
      alert(e?.message || 'Failed to create post');
    } finally {
      setPosting(false);
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
        <div className="p-4">
          <div className="border rounded p-3">
            <textarea
              placeholder="Write a post..."
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              className="w-full p-2 border rounded resize-none"
              rows={3}
            />

            {/* Selected images preview */}
            {previews.length > 0 && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {previews.map((src, idx) => (
                  <div key={idx} className="relative group">
                    <img src={src} alt="preview" className="w-full aspect-square object-cover rounded" />
                    <button
                      onClick={() => removeComposerFile(idx)}
                      className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1"
                      title="Remove"
                    >
                      <CloseIcon size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-3 flex items-center gap-3">
              <button
                onClick={createNewPost}
                disabled={posting || (!newContent.trim() && selectedFiles.length === 0)}
                className="bg-blue-600 text-white px-4 py-2 text-sm rounded font-semibold disabled:opacity-50"
              >
                {posting ? `Posting ${postProgress || 0}%` : 'Post'}
              </button>

              <input
                id="upload-new-group-post"
                type="file"
                className="hidden"
                multiple
                accept="image/*"
                onChange={(e) => handleComposerFilesChange(e.target.files)}
              />
              <button
                onClick={triggerComposerUpload}
                disabled={posting || selectedFiles.length >= MAX_IMAGES_PER_POST}
                className="text-sm inline-flex items-center space-x-1 disabled:opacity-50"
                title="Add photo"
              >
                <ImageIcon size={16} className={posting ? "text-gray-400" : "text-gray-600"} />
                <span className={posting ? "text-gray-400" : "text-gray-600"}>
                  {selectedFiles.length >= MAX_IMAGES_PER_POST ? `Max ${MAX_IMAGES_PER_POST}` : 'Add photo'}
                </span>
              </button>
            </div>
          </div>
        </div>
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
