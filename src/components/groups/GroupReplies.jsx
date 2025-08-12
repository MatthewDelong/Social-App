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

  const handleEditReply = async (replyId, newContent) => {
    if (!newContent.trim()) return;
    await updateDoc(doc(db, "groupReplies", replyId), {
      content: newContent.trim(),
    });
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
            <strong>{reply.author}</strong>: {reply.content}

            {(isAdmin || isModerator || currentUser.uid === reply.uid) && (
              <div className="ml-auto space-x-2 text-xs text-gray-600">
                <button
                  onClick={() => {
                    const newContent = prompt("Edit your reply:", reply.content);
                    if (newContent !== null) {
                      handleEditReply(reply.id, newContent);
                    }
                  }}
                  className="text-blue-500 hover:underline"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteReply(reply.id)}
                  className="text-red-500 hover:underline"
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