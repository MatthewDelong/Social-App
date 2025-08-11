import { useEffect, useState } from "react";
import { collection, addDoc, query, where, orderBy, onSnapshot, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";

export default function GroupReplies({ commentId, currentUser }) {
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
            <strong>{reply.author}</strong>: {reply.content}
          </div>
        ))}
      </div>
    </div>
  );
}
