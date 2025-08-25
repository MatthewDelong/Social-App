import { useEffect, useState } from "react";
import { collection, onSnapshot, query, orderBy, getDocs, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "../firebase";
import { useAppContext } from "../context/AppContext";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";
import { ThumbsUp } from "lucide-react";
import HomeComments from "./HomeComments";

export default function Home() {
  const [posts, setPosts] = useState([]);
  const [usersMap, setUsersMap] = useState({});
  const [editingPostId, setEditingPostId] = useState(null);
  const [editedContent, setEditedContent] = useState("");
  const { user, theme } = useAppContext();
  const navigate = useNavigate();

  const DEFAULT_AVATAR =
    "https://firebasestorage.googleapis.com/v0/b/social-app-8a28d.firebasestorage.app/o/default-avatar.png?alt=media&token=78165d2b-f095-496c-9de2-5e143bfc41cc";

  const safeFormatDate = (dateValue) => {
    if (!dateValue) return "";
    try {
      const date = dateValue.toDate ? dateValue.toDate() : new Date(dateValue);
      return formatDistanceToNow(date, { addSuffix: true }).replace("about ", "");
    } catch (err) {
      console.error("Error formatting date:", err);
      return "";
    }
  };

  const fetchUsers = async () => {
    const snap = await getDocs(collection(db, "users"));
    const map = {};
    snap.forEach((d) => {
      map[d.id] = d.data();
    });
    setUsersMap(map);
  };

  useEffect(() => {
    fetchUsers();
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map((d) => {
        let data = { id: d.id, likes: d.data().likes || [], comments: d.data().comments || [], ...d.data() };
        if (!data.authorPhotoURL && data.uid) {
          const userData = usersMap[data.uid] || {};
          data.authorPhotoURL = userData.photoURL || DEFAULT_AVATAR;
        }
        return data;
      });
      setPosts(docs);
    });
    return () => unsub();
  }, [usersMap]);

  const handleLikePost = async (id) => {
    const postRef = doc(db, "posts", id);
    const post = posts.find((p) => p.id === id);
    const likes = new Set(post.likes || []);
    likes.has(user?.uid) ? likes.delete(user?.uid) : likes.add(user?.uid);
    await updateDoc(postRef, { likes: Array.from(likes) });
  };

  const handleDeletePost = async (postId) => {
    if (!window.confirm("Are you sure you want to delete this post?")) return;
    await deleteDoc(doc(db, "posts", postId));
  };

  const handleEditPost = async (postId) => {
    if (!editedContent.trim()) return;
    const postRef = doc(db, "posts", postId);
    await updateDoc(postRef, {
      content: editedContent.trim(),
      editedAt: new Date(),
    });
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, content: editedContent.trim() } : p))
    );
    setEditingPostId(null);
    setEditedContent("");
  };

  const goToProfile = (uid) => {
    if (!uid) return;
    navigate(`/profile/${uid}`);
  };

  return (
    <div className="max-w-xl mx-auto mt-10" style={{ backgroundColor: theme.backgroundColor, color: theme.textColor }}>
      {posts.map((post) => {
        const postUser = usersMap[post.uid] || {};
        const isOwner = user && post.uid === user.uid;
        const canEditOrDelete = isOwner || user?.isAdmin || user?.isModerator;

        return (
          <div key={post.id} className="border p-4 rounded mb-4 bg-white shadow-sm">
            <div className="flex items-center space-x-3 mb-4">
              <img
                src={post.authorPhotoURL || DEFAULT_AVATAR}
                alt={post.author}
                className="w-10 h-10 rounded-full object-cover flex-shrink-0"
              />
              <div className="flex-1">
                <h2 className="text-xl font-bold break-words">
                  {postUser.displayName || post.author || "Unknown User"}
                  {postUser.isAdmin && <span className="ml-2 bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded">Admin</span>}
                  {postUser.isModerator && <span className="ml-2 bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded">Moderator</span>}
                </h2>
                {post.createdAt && <p className="text-sm text-gray-500">{safeFormatDate(post.createdAt)}</p>}
              </div>
              {canEditOrDelete && !editingPostId && (
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      setEditingPostId(post.id);
                      setEditedContent(post.content);
                    }}
                    className="text-xs bg-yellow-500 text-black px-2 py-0.5 rounded"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeletePost(post.id)}
                    className="text-xs bg-red-500 text-black px-2 py-0.5 rounded"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>

            <div className="mb-4">
              {editingPostId === post.id ? (
                <div>
                  <textarea
                    value={editedContent}
                    onChange={(e) => setEditedContent(e.target.value)}
                    rows={4}
                    className="w-full p-2 border rounded resize-none break-words"
                  />
                  <div className="mt-2 space-x-2">
                    <button
                      onClick={() => handleEditPost(post.id)}
                      className="px-4 py-2 bg-blue-600 text-white rounded"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setEditingPostId(null);
                        setEditedContent("");
                      }}
                      className="px-4 py-2 bg-gray-400 text-white rounded"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <p className="whitespace-pre-wrap break-words">{post.content}</p>
              )}
            </div>

            <div className="flex items-center space-x-4">
              <button
                onClick={() => handleLikePost(post.id)}
                className={`flex items-center gap-1 text-sm text-gray-600 hover:underline ${post.likes.includes(user?.uid) ? "text-blue-600 font-semibold" : ""}`}
              >
                <ThumbsUp size={14} />
                {post.likes.includes(user?.uid) ? "Liked" : "Like"} {post.likes.length > 0 && `(${post.likes.length})`}
              </button>
            </div>
            <HomeComments
              postId={post.id}
              currentUser={user}
              isAdmin={user?.isAdmin}
              isModerator={user?.isModerator}
            />
          </div>
        );
      })}
    </div>
  );
}