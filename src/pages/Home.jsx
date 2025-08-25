import { useEffect, useState } from "react";
import { collection, onSnapshot, query, orderBy, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { useAppContext } from "../context/AppContext";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";
import { ThumbsUp } from "lucide-react";
import HomeComments from "./HomeComments";

export default function Home() {
  const [posts, setPosts] = useState([]);
  const [usersMap, setUsersMap] = useState({});
  const { user, theme } = useAppContext();
  const navigate = useNavigate();

  const DEFAULT_AVATAR =
    "https://firebasestorage.googleapis.com/v0/b/social-app-8a28d.firebasestorage.app/o/default-avatar.png?alt=media&token=78165d2b-f095-496c-9de2-5e143bfc41cc";

  const safeFormatDate = (dateValue) => {
    if (!dateValue) return "";
    try {
      let date;
      if (typeof dateValue.toDate === "function") {
        date = dateValue.toDate();
      } else if (dateValue?.seconds) {
        date = new Date(dateValue.seconds * 1000);
      } else {
        date = new Date(dateValue);
      }
      if (isNaN(date.getTime())) return "";
      return formatDistanceToNow(date, { addSuffix: true });
    } catch {
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
      const docs = snapshot.docs.map((d) => ({
        id: d.id,
        likes: d.data().likes || [],
        comments: d.data().comments || [],
        ...d.data(),
      }));
      setPosts(docs);
    });
    return () => unsub();
  }, []);

  const handleLikePost = async (id) => {
    const postRef = doc(db, "posts", id);
    const post = posts.find((p) => p.id === id);
    const likes = new Set(post.likes || []);
    likes.has(user.uid) ? likes.delete(user.uid) : likes.add(user.uid);
    await updateDoc(postRef, { likes: Array.from(likes) });
  };

  const handleDeletePost = async (postId) => {
    await deleteDoc(doc(db, "posts", postId));
  };

  const goToProfile = (uid) => {
    if (!uid) return;
    navigate(`/profile/${uid}`);
  };

  return (
    <div
      className="max-w-xl mx-auto mt-10"
      style={{ backgroundColor: theme.backgroundColor, color: theme.textColor }}
    >
      {posts.map((post) => {
        const postUser = usersMap[post.uid];
        const postAvatar = postUser?.photoURL || DEFAULT_AVATAR;
        return (
          <div
            key={post.id}
            className="border p-4 rounded mb-4 bg-white shadow-sm sm:p-2"
          >
            <div className="flex justify-between">
              <div className="flex items-center space-x-2">
                <img
                  src={postAvatar}
                  alt="avatar"
                  className="w-8 h-8 rounded-full object-cover cursor-pointer sm:w-6 sm:h-6"
                  onClick={() => goToProfile(post.uid)}
                />
                <p
                  className="font-bold text-gray-800 cursor-pointer"
                  onClick={() => goToProfile(post.uid)}
                >
                  {postUser?.displayName || post.author || "Unknown User"}
                  {usersMap[post.uid]?.isAdmin && (
                    <span className="ml-2 bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded">
                      Admin
                    </span>
                  )}
                  {usersMap[post.uid]?.isModerator && (
                    <span className="ml-2 bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded">
                      Moderator
                    </span>
                  )}
                </p>
              </div>
              {(post.uid === user.uid ||
                user.role === "admin" ||
                user.role === "moderator") && (
                <div className="space-x-2">
                  <button
                    onClick={() => {
                      setEditingPostId(post.id);
                      setEditedContent(post.content);
                    }}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeletePost(post.id)}
                    className="text-xs text-red-500 hover:underline"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
            <div className="mt-2 text-gray-900 sm:mt-1">
              {editingPostId === post.id ? (
                <div>
                  <textarea
                    value={editedContent}
                    onChange={(e) => setEditedContent(e.target.value)}
                    className="border p-2 w-full rounded sm:p-1"
                  />
                  <button
                    onClick={() => handleEditPost(post.id)}
                    className="mt-1 text-sm bg-blue-500 text-white px-2 py-1 rounded sm:mt-0.5 sm:px-1 sm:py-0.5"
                  >
                    Save
                  </button>
                </div>
              ) : (
                <p>{post.content}</p>
              )}
            </div>

            <div className="flex items-center space-x-4 mt-2 sm:space-x-2 sm:mt-1">
              <button
                onClick={() => handleLikePost(post.id)}
                className={`flex items-center gap-1 text-sm text-gray-600 hover:underline ${
                  post.likes.includes(user?.uid) ? "text-blue-600 font-semibold" : ""
                }`}
              >
                <ThumbsUp size={14} />
                {post.likes.includes(user?.uid) ? "Liked" : "Like"}
                {post.likes.length > 0 && ` (${post.likes.length})`}
              </button>
              <span className="text-xs text-gray-500">
                {safeFormatDate(post.createdAt)}
              </span>
            </div>

            <HomeComments
              post={post}
              postUser={postUser}
              postAvatar={postAvatar}
              user={user}
              usersMap={usersMap}
              handleDeletePost={handleDeletePost}
              goToProfile={goToProfile}
              safeFormatDate={safeFormatDate}
            />
          </div>
        );
      })}
    </div>
  );
}