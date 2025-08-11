import { useState, useEffect } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db, storage } from "../../firebase";
import { getDownloadURL, ref } from "firebase/storage";

export default function GroupNewPost({ groupId, currentUser }) {
  const [content, setContent] = useState("");
  const [DEFAULT_AVATAR, setDEFAULT_AVATAR] = useState("");

  // Load default avatar from storage once
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;

    await addDoc(collection(db, "groupPosts"), {
      groupId,
      author: currentUser.displayName,
      authorPhotoURL: currentUser.photoURL || DEFAULT_AVATAR,
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
      <button
        type="submit"
        className="px-4 py-2 bg-green-500 text-white rounded"
      >
        Post
      </button>
    </form>
  );
}