import { useEffect, useState } from "react";
import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  doc,
  deleteDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../firebase";

export default function GroupPosts({ groupId, currentUser }) {
  const [posts, setPosts] = useState([]);
  const [content, setContent] = useState("");
  const [editPostId, setEditPostId] = useState(null);
  const [editContent, setEditContent] = useState("");

  useEffect(() => {
    if (!groupId) return;

    const q = query(
      collection(db, "groupPosts"),
      where("groupId", "==", groupId),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPosts(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });

    return () => unsubscribe();
  }, [groupId]);

  const canEditOrDelete = (post) => {
    if (!currentUser) return false;
    const isOwner = post.uid === currentUser.uid;
    return isOwner || currentUser.isAdmin || currentUser.isModerator;
  };

  const handleAddPost = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;

    await addDoc(collection(db, "groupPosts"), {
      groupId,
      uid: currentUser.uid,
      author: currentUser.displayName,
      authorPhotoURL: currentUser.photoURL || "",
      content: content.trim(),
      createdAt: serverTimestamp(),
    });

    setContent("");
  };

  const handleDeletePost = async (postId) => {
    if (window.confirm("Are you sure you want to delete this post?")) {
      await deleteDoc(doc(db, "groupPosts", postId));
    }
  };

  const handleEditPost = (post) => {
    setEditPostId(post.id);
    setEditContent(post.content);
  };

  const handleUpdatePost = async (e) => {
    e.preventDefault();
    if (!editContent.trim()) return;

    await updateDoc(doc(db, "groupPosts", editPostId), {
      content: editContent.trim(),
      editedAt: serverTimestamp(),
    });

    setEditPostId(null);
    setEditContent("");
  };

  const handleCancelEdit = () => {
    setEditPostId(null);
    setEditContent("");
  };

  return (
    <div className="mt-4">
      <form onSubmit={handleAddPost} className="flex gap-2 mb-4">
        <input
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write a new post..."
          className="flex-1 p-2 border rounded"
        />
        <button type="submit" className="px-3 py-1 bg-green-600 text-white rounded">
          Post
        </button>
      </form>

      <div className="space-y-4">
        {posts.map((post) => (
          <div key={post.id} className="border p-3 rounded">
            <div className="flex items-center gap-3 mb-2">
              <img
                src={post.authorPhotoURL || "/default-avatar.png"}
                alt={post.author}
                className="w-8 h-8 rounded-full object-cover"
              />
              <strong>{post.author}</strong>
            </div>

            {editPostId === post.id ? (
              <form onSubmit={handleUpdatePost} className="flex gap-2">
                <input
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="flex-1 p-1 border rounded"
                />
                <button type="submit" className="px-3 py-1 bg-blue-600 text-white rounded">
                  Save
                </button>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="px-3 py-1 bg-gray-400 text-white rounded"
                >
                  Cancel
                </button>
              </form>
            ) : (
              <p>{post.content}</p>
            )}

            {canEditOrDelete(post) && editPostId !== post.id && (
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => handleEditPost(post)}
                  className="px-3 py-1 bg-yellow-500 text-white rounded"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDeletePost(post.id)}
                  className="px-3 py-1 bg-red-600 text-white rounded"
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}