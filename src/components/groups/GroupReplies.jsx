import { useEffect, useState } from "react";
import { collection, addDoc, query, where, orderBy, onSnapshot, serverTimestamp, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "../../firebase";

export default function GroupReplies({ commentId, currentUser }) {
  const [replies, setReplies] = useState([]);
  const [content, setContent] = useState("");
  const [editId, setEditId] = useState("");
  const [editContent, setEditContent] = useState("");

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

  const handleStartEdit = (reply) => {
    setEditId(reply.id);
    setEditContent(reply.content || "");
  };

  const handleCancelEdit = () => {
    setEditId("");
    setEditContent("");
  };

  const handleSaveEdit = async (replyId) => {
    if (!editContent.trim()) return;
    await updateDoc(doc(db, "groupReplies", replyId), {
      content: editContent.trim(),
    });
    setEditId("");
    setEditContent("");
  };

  const handleDeleteReply = async (replyId) => {
    if (!window.confirm("Delete this reply?")) return;
    await deleteDoc(doc(db, "groupReplies", replyId));
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
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <strong>{reply.author}</strong>:
                {editId === reply.id ? (
                  <div className="mt-1 flex gap-2">
                    <input
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="flex-1 p-1 border rounded text-sm"
                    />
                  </div>
                ) : (
                  <span> {reply.content}</span>
                )}
              </div>

              {reply.uid === currentUser.uid && (
                <div className="ml-4 flex items-center gap-2">
                  {editId === reply.id ? (
                    <>
                      <button
                        onClick={() => handleSaveEdit(reply.id)}
                        className="px-2 py-1 bg-blue-500 text-white rounded text-sm"
                      >
                        Save
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="px-2 py-1 bg-gray-300 rounded text-sm"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => handleStartEdit(reply)}
                        className="text-blue-500 text-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteReply(reply.id)}
                        className="text-red-500 text-sm"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}