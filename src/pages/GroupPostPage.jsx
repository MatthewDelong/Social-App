import { useParams, useNavigate, Link } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import GroupComments from "../components/groups/GroupComments";
import { useEffect, useState } from "react";
import { doc, getDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { db, storage } from "../firebase";
import { getDownloadURL, ref } from "firebase/storage";
import { formatDistanceToNow } from "date-fns";

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

  if (loading) return <p className="p-4">Loading post...</p>;
  if (!post) return <p className="p-4">Post not found</p>;

  // Determine permissions
  const isOwner = user && post.uid === user.uid;
  const isAdmin = user?.isAdmin;
  const isModerator = user?.isModerator;
  const canEditOrDelete = isOwner || isAdmin || isModerator;

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
    if (!editContent.trim()) return;
    await updateDoc(doc(db, "groupPosts", post.id), {
      content: editContent.trim(),
      editedAt: new Date(),
    });
    setPost((prev) => ({ ...prev, content: editContent.trim() }));
    setIsEditing(false);
    setEditContent("");
  };

  const deletePost = async () => {
    if (!window.confirm("Are you sure you want to delete this post?")) return;
    await deleteDoc(doc(db, "groupPosts", post.id));
    navigate(-1); // Go back after deleting
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Group Banner & Logo */}
      {group && (
        <div className="relative mb-4">
          {/* Banner */}
          <div className="w-full h-32 sm:h-40 md:h-48 overflow-hidden">
            <img
              src={group.bannerURL || DEFAULT_BANNER}
              alt={`${group.name} banner`}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Logo overhang */}
          <div className="absolute -bottom-8 left-4">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-4 border-white overflow-hidden shadow-lg">
              <img
                src={group.logoURL || DEFAULT_LOGO}
                alt={`${group.name} logo`}
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          {/* Group name and back link */}
          <div className="mt-10 px-4">
            <Link 
              to={`/groups/${groupId}`}
              className="text-lg font-bold text-blue-600 hover:underline"
            >
              {group.name}
            </Link>
          </div>
        </div>
      )}

      <div className="p-4">
      <div className="flex items-center space-x-3 mb-4">
        <img
          src={post.authorPhotoURL || DEFAULT_AVATAR}
          alt={post.author}
          className="w-10 h-10 rounded-full object-cover flex-shrink-0"
        />
        <div className="flex-1">
          <h2 className="text-xl font-bold break-words">{post.author}</h2>
          {post.createdAt && (
            <p className="text-sm text-gray-500">
              {formatPostDate(post.createdAt)}
            </p>
          )}
        </div>
      </div>

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

      {canEditOrDelete && !isEditing && (
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            onClick={startEdit}
            className="text-xs bg-yellow-500 text-black-800 px-2 py-0.5 rounded"
          >
            Edit
          </button>
          <button
            onClick={deletePost}
            className="text-xs bg-red-500 text-black-800 px-2 py-0.5 rounded"
          >
            Delete
          </button>
        </div>
      )}

      <GroupComments
        postId={postId}
        currentUser={user}
        isAdmin={isAdmin}
        isModerator={isModerator}
      />
      </div>
    </div>
  );
}