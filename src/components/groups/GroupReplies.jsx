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

export default function GroupReplies({ commentId, currentUser, isAdmin, isModerator }) {
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

  const startEditing = (reply) => {
    setEditingReplyId(reply.id);
    setEditingContent(reply.content);
  };

  const cancelEditing = () => {
    setEditingReplyId(null);
    setEditingContent("");
  };

  const saveEdit = async (replyId) => {
    if (!editingContent.trim()) return;
    const replyRef = doc(db, "groupReplies", replyId);
    await updateDoc(replyRef, { content: editingContent.trim() });
    setEditingReplyId(null);
    setEditingContent("");
  };

  const deleteReply = async (replyId) => {
    const replyRef = doc(db, "groupReplies", replyId);
    await deleteDoc(replyRef);
  };

  // Helper: check if current user can edit/delete this reply
  const canModify = (reply) => {
    return (
      isAdmin ||
      isModerator ||
      (currentUser && currentUser.uid === reply.uid)
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
        <button type="submit" className="px-2 py-1 bg-gray-500 text-white rounded text-sm">
          Reply
        </button>
      </form>

      <div className="mt-2 space-y-1">
        {replies.map((reply) => (
          <div key={reply.id} className="border p-1 rounded text-sm">
            <strong>{reply.author}</strong>:
            {editingReplyId === reply.id ? (
              <>
                <input
                  className="ml-1 border rounded p-1 text-sm w-full"
                  value={editingContent}
                  onChange={(e) => setEditingContent(e.target.value)}
                />
                <div className="flex gap-2 mt-1">
                  <button
                    onClick={() => saveEdit(reply.id)}
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
              <span className="ml-1">{reply.content}</span>
            )}

            {canModify(reply) && editingReplyId !== reply.id && (
              <div className="mt-1 space-x-2 text-xs text-gray-600">
                <button
                  onClick={() => startEditing(reply)}
                  className="underline hover:text-blue-600"
                  type="button"
                >
                  Edit
                </button>
                <button
                  onClick={() => deleteReply(reply.id)}
                  className="underline hover:text-red-600"
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