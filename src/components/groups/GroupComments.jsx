import { useEffect, useState } from "react";
import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  deleteDoc,
  doc,
  updateDoc,
  getDoc,
} from "firebase/firestore";
import { db, storage } from "../../firebase";
import { getDownloadURL, ref } from "firebase/storage";
import GroupReplies from "./GroupReplies";

export default function GroupComments({ postId, currentUser }) {
  const [comments, setComments] = useState([]);
  const [content, setContent] = useState("");
  const [DEFAULT_AVATAR, setDEFAULT_AVATAR] = useState("");
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editContent, setEditContent] = useState("");

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

  const canEditOrDeleteComment = (comment) => {
    if (!currentUser) return false;
    if (currentUser.isAdmin || currentUser.isModerator) return true;
    return comment.uid === currentUser.uid;
  };

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

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm("Are you sure you want to delete this comment?")) return;
    await deleteDoc(doc(db, "groupComments", commentId));
  };

  const startEditingComment = (comment) => {
    setEditingCommentId(comment.id);
    setEditContent(comment.content);
  };

  const cancelEditing = () => {
    setEditingCommentId(null);
    setEditContent("");
  };

  const saveEditedComment = async () => {
    if (!editContent.trim()) return;
    await updateDoc(doc(db, "groupComments", editingCommentId), {
      content: editContent.trim(),
      editedAt: serverTimestamp(),
    });
    setEditingCommentId(null);
    setEditContent("");
  };

  return (
    <div className="mt-4 ml-6">
      <form onSubmit={handleAddComment} className="flex gap-2 mb-4">
        <input
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write a comment..."
          className="flex-1 p-2 border rounded"
        />
        <button
          type="submit"
          className="px-3 py-1 bg-blue-500 text-white rounded"
        >
          Post
        </button>
      </form>

      <div className="space-y-3">
        {comments.map((comment) => (
          <div
            key={comment.id}
            className="border p-2 rounded flex items-start gap-2"
          >
            <img
              src={comment.authorPhotoURL || DEFAULT_AVATAR}
              alt={comment.author}
              className="w-8 h-8 rounded-full object-cover"
            />
            <div className="flex-1">
              <strong>{comment.author}</strong>
              {editingCommentId === comment.id ? (
                <>
                  <textarea
                    className="w-full p-2 border rounded my-1"
                    rows={3}
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                  />
                  <div className="space-x-2">
                    <button
                      onClick={saveEditedComment}
                      className="text-green-600 hover:underline"
                    >
                      Save
                    </button>
                    <button
                      onClick={cancelEditing}
                      className="text-red-600 hover:underline"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <p>{comment.content}</p>
              )}

              {(currentUser && canEditOrDeleteComment(comment)) && editingCommentId !== comment.id && (
                <div className="space-x-2 text-sm mt-1">
                  <button
                    onClick={() => startEditingComment(comment)}
                    className="text-blue-600 hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteComment(comment.id)}
                    className="text-red-600 hover:underline"
                  >
                    Delete
                  </button>
                </div>
              )}

              <GroupReplies commentId={comment.id} currentUser={currentUser} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}