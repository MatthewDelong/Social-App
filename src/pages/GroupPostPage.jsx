import { useParams, useNavigate } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import GroupComments from "../components/groups/GroupComments";
import { useEffect, useState } from "react";
import { doc, getDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { db, storage } from "../firebase";
import { getDownloadURL, ref } from "firebase/storage";

export default function GroupPostPage() {
  const { groupId, postId } = useParams();
  const { user } = useAppContext();
  const navigate = useNavigate();

  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [DEFAULT_AVATAR, setDEFAULT_AVATAR] = useState("");

  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");

  // Load default avatar from storage
  useEffect(() => {
    const loadDefaultAvatar = async () => {
      try {
        const defaultRef = ref(storage, "default-avatar.png");
        const url = await getDownloadURL(defaultRef);
        setDEFAULT_AVATAR(url);
      } catch (err) {
        console.error("Error loading default avatar:", err);
      }
    };
    loadDefaultAvatar();
  }, []);

  // Fetch post from Firestore
  useEffect(() => {
    const fetchPost = async () => {
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
      setLoading(false);
    };
    fetchPost();
  }, [postId]);

  if (loading) return <p className="p-4">Loading post...</p>;
  if (!post) return <p className="p-4">Post not found</p>;

  // Determine permissions
  const isOwner = user && post.uid === user.uid;
  const isAdmin = user?.isAdmin;
  const isModerator = user?.isModerator;
  const canEditOrDelete = isOwner || isAdmin || isModerator;

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
    <div className="p-4 max-w-2xl mx-auto">
      <div className="flex items-center space-x-3 mb-4">
        <img
          src={post.authorPhotoURL || DEFAULT_AVATAR}
          alt={post.author}
          className="w-10 h-10 rounded-full object-cover"
        />
        <h2 className="text-xl font-bold">{post.author}</h2>
      </div>

      {isEditing ? (
        <div className="mb-4">
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={4}
            className="w-full p-2 border rounded resize-none"
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
        <p className="mb-4 whitespace-pre-wrap">{post.content}</p>
      )}

      {canEditOrDelete && !isEditing && (
        <div className="mb-4 flex gap-2">
          <button
            onClick={startEdit}
            className="px-4 py-2 bg-yellow-500 text-white rounded"
          >
            Edit
          </button>
          <button
            onClick={deletePost}
            className="px-4 py-2 bg-red-600 text-white rounded"
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
  );
}