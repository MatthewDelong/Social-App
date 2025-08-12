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
  getDoc,
  deleteDoc,
  updateDoc,
} from "firebase/firestore";
import { db, storage } from "../../firebase";
import { getDownloadURL, ref } from "firebase/storage";
import GroupReplies from "./GroupReplies";

export default function GroupComments({ postId, currentUser, isAdmin, isModerator }) {
  const [comments, setComments] = useState([]);
  const [content, setContent] = useState("");
  const [DEFAULT_AVATAR, setDEFAULT_AVATAR] = useState("");
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingContent, setEditingContent] = useState("");

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

  useEffect(() => {
    if (!postId) return;
    const q = query(
      collection(db, "groupComments"),
      where("postId", "==", postId),
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(q, async (snapshot) => {
      const docs = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));

      // Fetch missing avatars from users/{uid}
      const updated = await Promise.all(
        docs.map(async (c) => {
          if (!c.authorPhotoURL && c.uid) {
            const userDoc = await getDoc(doc(db, "users", c.uid));
            if (userDoc.exists()) {
              return { ...c, authorPhotoURL: userDoc.data().photoURL || "" };
            }
          }
          return c;
        })
      );

      setComments(updated);
    });
    return () => unsub();
  }, [postId]);

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;

    await addDoc(collection(db, "groupComments"), {
      postId,
      uid: currentUser.uid,
      author: currentUser.displayName,
      authorPhotoURL: currentUser.photoURL || "",
      content: content.trim(),
      createdAt: serverTimestamp(),
    });

    setContent("");
  };

  const startEditing = (comment) => {
    setEditingCommentId(comment.id);
    setEditingContent(comment.content);
  };

  const cancelEditing = () => {
    setEditingCommentId(null);
    setEditingContent("");
  };

  const saveEdit = async (commentId) => {
    if (!editingContent.trim()) return;
    const commentRef = doc(db, "groupComments", commentId);
    await updateDoc(commentRef, { content: editingContent.trim() });
    setEditingCommentId(null);
    setEditingContent("");
  };

  const deleteComment = async (commentId) => {
    const commentRef = doc(db, "groupComments", commentId);
    await deleteDoc(commentRef);
    // Optionally, delete related replies here
  };

  // Helper: check if current user can edit/delete this comment
  const canModify = (comment) => {
    return (
      isAdmin ||
      isModerator ||
      (currentUser && currentUser.uid === comment.uid)
    );
  };

  return (
    <div className="mt-4">
      <form onSubmit={handleAddComment} className="flex gap-2">
        <input
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write a comment..."
          className="flex-1 p-2 border rounded"
        />
        <button type="submit" className="px-3 py-1 bg-blue-500 text-white rounded">
          Post
        </button>
      </form>

      <div className="mt-4 space-y-3">
        {comments.map((comment) => (
          <div key={comment.id} className="border p-2 rounded flex items-start gap-2">
            <img
              src={comment.authorPhotoURL || DEFAULT_AVATAR}
              alt={comment.author}
              className="w-8 h-8 rounded-full object-cover"
            />
            <div className="flex-1">
              <strong>{comment.author}</strong>:
              {editingCommentId === comment.id ? (
                <>
                  <textarea
                    className="w-full border rounded p-1 mt-1 text-sm"
                    value={editingContent}
                    onChange={(e) => setEditingContent(e.target.value)}
                  />
                  <div className="flex gap-2 mt-1">
                    <button
                      onClick={() => saveEdit(comment.id)}
                      className="px-2 py-1 bg-green-500 text-white rounded text-sm"
                      type="button"
                    >
                      Save
                    </button>
                    <button
                      onClick={cancelEditing}
                      className="px-2 py-1 bg-gray-300 rounded text-sm"
                      type="button"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <span className="ml-1">{comment.content}</span>
              )}

              {canModify(comment) && editingCommentId !== comment.id && (
                <div className="mt-1 space-x-2 text-xs text-gray-600">
                  <button
                    onClick={() => startEditing(comment)}
                    className="underline hover:text-blue-600"
                    type="button"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteComment(comment.id)}
                    className="underline hover:text-red-600"
                    type="button"
                  >
                    Delete
                  </button>
                </div>
              )}

              <GroupReplies
                commentId={comment.id}
                currentUser={currentUser}
                isAdmin={isAdmin}
                isModerator={isModerator}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}