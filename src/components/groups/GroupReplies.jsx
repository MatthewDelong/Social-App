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
  doc
} from "firebase/firestore";
import { db } from "../../firebase";

export default function GroupReplies({ commentId, currentUser, isAdmin, isModerator }) {
  const [replies, setReplies] = useState([]);
  const [content, setContent] = useState("");

  // Editing state
  const [editingReplyId, setEditingReplyId] = useState(null);
  const [editedReplyContent, setEditedReplyContent] = useState("");

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

  // Delete reply
  const handleDeleteReply = async (replyId) => {
    await deleteDoc(doc(db, "groupReplies", replyId));
  };

  // Edit handlers
  const startEditingReply = (reply) => {
    setEditingReplyId(reply.id);
    setEditedReplyContent(reply.content);
  };

  const cancelEditingReply = () => {
    setEditingReplyId(null);
    setEditedReplyContent("");
  };

  const saveEditedReply = async () => {
    if (!editedReplyContent.trim()) return;
    await updateDoc(doc(db, "groupReplies", editingReplyId), {
      content: editedReplyContent.trim(),
    });
    setEditingReplyId(null);
    setEditedReplyContent("");
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
          <div key={reply.id} className="border p-1 rounded text-sm flex items-center gap-2">
            <strong>{reply.author}</strong>:{" "}
            {editingReplyId === reply.id ? (
              <>
                <input
                  type="text"
                  value={editedReplyContent}
                  onChange={(e) => setEditedReplyContent(e.target.value)}
                  className="border rounded p-1 text-xs flex-1"
                />
                <div className="space-x-1">
                  <button onClick={saveEditedReply} className="text-green-600 text-xs">Save</button>
                  <button onClick={cancelEditingReply} className="text-red-600 text-xs">Cancel</button>
                </div>
              </>
            ) : (
              reply.content
            )}

            {(currentUser.uid === reply.uid || isAdmin || isModerator) && editingReplyId !== reply.id && (
              <span className="ml-2 space-x-1 text-xs">
                <button onClick={() => startEditingReply(reply)}>Edit</button>
                <button onClick={() => handleDeleteReply(reply.id)}>Delete</button>
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}