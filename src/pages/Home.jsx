import React, { useState, useEffect } from "react";
import { db } from "../firebase"; // Adjust path based on your structure
import {
  collection,
  query,
  orderBy,
  limit,
  startAfter,
  getDocs,
  doc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
} from "firebase/firestore";
import HomeComments from "./HomeComments";
import { formatDistanceToNow } from "date-fns";
import { ThumbsUp } from "lucide-react";

export default function Home({ user, usersMap = {}, goToProfile, safeFormatDate }) {
  console.log("Home props:", { user, usersMap, goToProfile, safeFormatDate }); // Debug all props
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastVisible, setLastVisible] = useState(null);
  const [editingPostId, setEditingPostId] = useState(null); // State for editing post
  const [editContent, setEditContent] = useState("");
  const DEFAULT_AVATAR =
    "https://firebasestorage.googleapis.com/v0/b/social-app-8a28d.firebasestorage.app/o/default-avatar.png?alt=media&token=78165d2b-f095-496c-9de2-5e143bfc41cc";

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      console.log("Fetching posts, db:", db); // Debug db availability
      if (!db) throw new Error("Firestore db is not initialized");
      setLoading(true);
      const postsRef = collection(db, "posts");
      let q = query(postsRef, orderBy("createdAt", "desc"), limit(5));
      if (lastVisible) {
        q = query(q, startAfter(lastVisible)); // Add startAfter only if lastVisible exists
      }
      console.log("Query constructed:", q); // Debug query object
      const querySnapshot = await getDocs(q);
      console.log("Query snapshot:", querySnapshot.docs); // Debug fetched data
      const newPosts = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
      }));
      console.log("New posts:", newPosts); // Debug parsed posts
      setPosts((prevPosts) => [...prevPosts, ...newPosts]);
      setLastVisible(querySnapshot.docs[querySnapshot.docs.length - 1]);
    } catch (error) {
      console.error("Error fetching posts:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async (postId, likes) => {
    if (!user) return;
    const postRef = doc(db, "posts", postId);
    const updatedLikes = likes.includes(user.uid)
      ? likes.filter((uid) => uid !== user.uid)
      : [...likes, user.uid];
    await updateDoc(postRef, { likes: updatedLikes });
    setPosts((prevPosts) =>
      prevPosts.map((post) =>
        post.id === postId ? { ...post, likes: updatedLikes } : post
      )
    );
  };

  const handleDeletePost = async (postId) => {
    if (!window.confirm("Are you sure you want to delete this post?")) return;
    const postRef = doc(db, "posts", postId);
    await updateDoc(postRef, { deleted: true, deletedAt: serverTimestamp() });
    setPosts((prevPosts) => prevPosts.filter((post) => post.id !== postId));
  };

  const handleSaveEdit = async (postId) => {
    if (!editContent.trim()) return;
    const postRef = doc(db, "posts", postId);
    await updateDoc(postRef, {
      text: editContent.trim(),
      editedAt: serverTimestamp(),
    });
    setPosts((prevPosts) =>
      prevPosts.map((post) =>
        post.id === postId ? { ...post, text: editContent, editedAt: serverTimestamp() } : post
      )
    );
    setEditingPostId(null);
    setEditContent("");
  };

  // Debug wrapper for goToProfile
  const debugGoToProfile = (uid) => {
    console.log("goToProfile called with UID:", uid); // Log the UID being passed
    if (uid) goToProfile(uid); // Only call if uid is valid
  };

  return (
    <div className="container mx-auto p-4">
      {posts.length > 0 ? (
        posts.map((post) => {
          console.log("Processing post:", post, "usersMap:", usersMap); // Debug post and usersMap
          const postUser = usersMap[post.uid] || {}; // Fallback to empty object if undefined
          const isEditable =
            user && (user.uid === post.uid || user.isAdmin || user.isModerator);
          return (
            <div
              key={post.id}
              className="border p-4 mb-4 rounded-lg bg-white shadow"
            >
              <div className="flex items-center mb-2">
                <img
                  src={postUser.photoURL || DEFAULT_AVATAR}
                  alt={postUser.displayName || post.author || "Unknown User"}
                  className="w-10 h-10 rounded-full mr-2"
                  onClick={() => post.uid && debugGoToProfile(post.uid)} // Use debug wrapper
                />
                <div>
                  <strong
                    className="cursor-pointer"
                    onClick={() => post.uid && debugGoToProfile(post.uid)} // Use debug wrapper
                  >
                    {usersMap[post.uid]?.displayName || post.author || "Unknown User"}
                    {postUser.isAdmin && (
                      <span className="ml-2 bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded">
                        Admin
                      </span>
                    )}
                    {postUser.isModerator && (
                      <span className="ml-2 bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded">
                        Moderator
                      </span>
                    )}
                  </strong>
                  <p className="text-sm text-gray-500">
                    {safeFormatDate(post.createdAt)}
                    {post.editedAt && " (edited)"}
                  </p>
                </div>
              </div>
              {editingPostId === post.id ? (
                <div>
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full p-2 border rounded mb-2"
                  />
                  <button
                    onClick={() => handleSaveEdit(post.id)}
                    className="px-3 py-1 bg-blue-500 text-white rounded mr-2"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setEditingPostId(null);
                      setEditContent("");
                    }}
                    className="px-3 py-1 bg-gray-500 text-white rounded"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <p className="mb-2">{post.text}</p>
              )}
              <div className="flex items-center gap-4 text-sm">
                <button
                  onClick={() => handleLike(post.id, post.likes || [])}
                  className={`flex items-center gap-1 ${
                    (post.likes || []).includes(user?.uid)
                      ? "text-blue-600 font-semibold"
                      : "text-gray-600"
                  }`}
                >
                  <ThumbsUp size={16} />
                  {post.likes?.includes(user?.uid) ? "Liked" : "Like"}
                </button>
                {post.likes?.length > 0 && (
                  <span className="text-gray-500">
                    {post.likes.length}{" "}
                    {post.likes.length === 1 ? "Like" : "Likes"}
                  </span>
                )}
                {isEditable && editingPostId !== post.id && (
                  <>
                    <button
                      onClick={() => {
                        setEditingPostId(post.id);
                        setEditContent(post.text);
                      }}
                      className="text-blue-600 hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeletePost(post.id)}
                      className="text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
              <HomeComments
                post={post}
                postUser={postUser}
                postAvatar={postUser.photoURL || DEFAULT_AVATAR}
                user={user}
                usersMap={usersMap}
                handleDeletePost={handleDeletePost}
                goToProfile={goToProfile}
                safeFormatDate={safeFormatDate}
              />
            </div>
          );
        })
      ) : (
        <p>No posts available. Try adding a new post!</p>
      )}
      {loading && <p>Loading more posts...</p>}
      {!loading && lastVisible && (
        <button
          onClick={fetchPosts}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded"
        >
          Load More
        </button>
      )}
    </div>
  );
}