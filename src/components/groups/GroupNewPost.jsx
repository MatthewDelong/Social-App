import { useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../../firebase";

export default function GroupNewPost({ groupId, currentUser }) {
  const [content, setContent] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [loading, setLoading] = useState(false);

  const handlePost = async (e) => {
    e.preventDefault();
    if (!content.trim() && !imageFile) return;
    setLoading(true);

    try {
      let imageURL = null;
      if (imageFile) {
        const imageRef = ref(
          storage,
          `groupImages/${groupId}/${Date.now()}_${imageFile.name}`
        );
        await uploadBytes(imageRef, imageFile);
        imageURL = await getDownloadURL(imageRef);
      }

      await addDoc(collection(db, "groupPosts"), {
        groupId,
        uid: currentUser.uid,
        author: currentUser.displayName || "Anonymous",
        authorPhotoURL: currentUser.photoURL || null,
        content: content.trim(),
        imageURL: imageURL,
        createdAt: serverTimestamp(),
      });

      setContent("");
      setImageFile(null);
    } catch (err) {
      console.error("Error posting:", err);
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handlePost} className="bg-white p-4 rounded-lg shadow space-y-3">
      <textarea
        className="w-full border rounded-lg p-2"
        placeholder="Write something..."
        value={content}
        onChange={(e) => setContent(e.target.value)}
      ></textarea>

      <input
        type="file"
        accept="image/*"
        onChange={(e) => setImageFile(e.target.files[0])}
      />

      <button
        type="submit"
        disabled={loading}
        className="bg-blue-500 text-white px-4 py-2 rounded-lg disabled:opacity-50"
      >
        {loading ? "Posting..." : "Post"}
      </button>
    </form>
  );
}
