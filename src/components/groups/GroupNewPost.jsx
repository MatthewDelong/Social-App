import { useState } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";

export default function GroupNewPost({ groupId, currentUser }) {
  const [content, setContent] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;

    await addDoc(collection(db, "groupPosts"), {
      groupId,
      author: currentUser.displayName,
      authorPhotoURL: currentUser.photoURL || "",
      uid: currentUser.uid,
      content: content.trim(),
      createdAt: serverTimestamp(),
    });

    setContent("");
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Write something..."
        className="w-full p-2 border rounded"
      />
      <button type="submit" className="px-4 py-2 bg-green-500 text-white rounded">
        Post
      </button>
    </form>
  );
}
