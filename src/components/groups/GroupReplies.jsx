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
  updateDoc,
  doc,
} from "firebase/firestore";
import { db } from "../../firebase";

export default function GroupReplies({
  commentId,
  currentUser,
  isAdmin,
  isModerator,
}) {
  const [replies, setReplies] = useState([]);
  const [content, setContent] = useState("");
  const [editingReplyId, setEditingReplyId] = useState(null);
  const [editingContent, setEditingContent] = useState("");

  useEffect(() => {
    if (!commentId) return;
    const q = query(
      collection(db, "groupReplies"),
      where("commentId", "==", commentId),
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(q, (snapshot) => {
      setReplies(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, [commentId]);

  const handleAddReply = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;

    await addDoc(collection(db, "groupReplies"), {
      commentId,
      uid: currentUser.uid,
      author: currentUser.displayName,
      authorPhotoURL: currentUser.photoURL || "",
      content: content.trim(),
      createdAt: serverTimestamp(),
    });

    setContent("");
  };

  const handleDeleteReply = async (replyId) => {
    if (!window.confirm("Are you sure you want to delete this reply?")) return;
    await deleteDoc(doc(db, "groupReplies", replyId));
  };

  const startEditing = (reply) => {
    setEditingReplyId(reply.id);
    setEditingContent(reply.content);
  };

  const cancelEditing = () => {
    setEditingReplyId(null);
    setEditingContent("");
  };

  const saveEdit = async () => {
    if (!editingContent.trim()) return;
    const replyRef = doc(db, "groupReplies", editingReplyId);
    await updateDoc(replyRef, { content: editingContent.trim() });
    setEditingReplyId(null);
    setEditingContent("");
  };

  const canEditOrDelete = (reply) => {
    return (
      currentUser &&
      (isAdmin || isModerator || currentUser.uid === reply.uid)
    );
  };

  return (
    <div className="mt-2 ml-6">
      <form onSubmit={handleAddReply} className="flex gap-2">
        <input
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write a reply..."
          className="flex-1 p-1 border rounded text-sm"
        />
        <button
          type="submit"
          className="px-2 py-1 bg-gray-500 text-white rounded text-sm"
        >
          Reply
        </button>
      </form>

      <div className="mt-2 space-y-1">
        {replies.map((reply) => (
          <div
            key={reply.id}
            className="border p-1 rounded text-sm flex items-center gap-2"
          >
            <strong>{reply.author}</strong>:

            {editingReplyId === reply.id ? (
              <>
                <input
                  className="flex-1 p-1 border rounded text-sm"
                  value={editingContent}
                  onChange={(e) => setEditingContent(e.target.value)}
                />
                <div className="space-x-1">
                  <button
                    onClick={saveEdit}
                    className="px-2 py-1 bg-green-500 text-white rounded text-xs"
                    type="button"
                  >
                    Save
                  </button>
                  <button
                    onClick={cancelEditing}
                    className="px-2 py-1 bg-gray-300 rounded text-xs"
                    type="button"
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <span className="flex-1 ml-1">{reply.content}</span>
            )}

            {canEditOrDelete(reply) && editingReplyId !== reply.id && (
              <div className="space-x-2 text-xs flex-shrink-0">
                <button
                  onClick={() => startEditing(reply)}
                  className="text-blue-600 hover:underline"
                  type="button"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteReply(reply.id)}
                  className="text-red-600 hover:underline"
                  type="button"
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