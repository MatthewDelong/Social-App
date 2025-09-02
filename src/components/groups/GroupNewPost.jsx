// src/components/groups/GroupNewPost.jsx
import { useState, useEffect } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db, storage } from "../../firebase";
import { getDownloadURL, ref } from "firebase/storage";
import { useGroupPermissions } from "../../hooks/useGroupPermissions";

export default function GroupNewPost({ groupId, currentUser }) {
  const [content, setContent] = useState("");
  const [DEFAULT_AVATAR, setDEFAULT_AVATAR] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Use permissions to gate posting (must be a member or Site Admin)
  const { isMember, isSiteAdmin } = useGroupPermissions(
    groupId,
    currentUser?.uid,
    currentUser?.isAdmin === true
  );

  useEffect(() => {
    const loadDefaultAvatar = async () => {
      try {
        const defaultRef = ref(storage, "default-avatar.png");
        const url = await getDownloadURL(defaultRef);
        setDEFAULT_AVATAR(url);
      } catch (err) {
        // Optional asset; not a blocker
        console.warn("Default avatar not found:", err?.message || err);
      }
    };
    loadDefaultAvatar();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const text = content.trim();
    if (!text) return;

    if (!currentUser?.uid) {
      setError("You must be signed in to post.");
      return;
    }
    if (!groupId) {
      setError("Missing group context.");
      return;
    }
    if (!isSiteAdmin && !isMember) {
      setError("Join the group to post.");
      return;
    }

    setSubmitting(true);
    try {
      await addDoc(collection(db, "groupPosts"), {
        groupId,
        uid: currentUser.uid,
        author: currentUser.displayName || currentUser.email || "Member",
        authorPhotoURL: currentUser.photoURL || DEFAULT_AVATAR || "",
        content: text,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setContent(""); // only clear on success
    } catch (err) {
      console.error("Error creating post:", err);
      setError(err?.message || "Failed to create post. Check your permissions.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isSiteAdmin && !isMember) {
    return (
      <div className="p-2 text-sm text-gray-600 border rounded">
        Join this group to post.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      {error && (
        <div className="p-2 text-sm bg-red-50 border border-red-200 text-red-700 rounded">
          {error}
        </div>
      )}
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Write something..."
        className="w-full p-2 border rounded"
        disabled={submitting}
      />
      <button
        type="submit"
        disabled={submitting || !content.trim()}
        className="px-4 py-2 bg-green-500 text-white rounded disabled:opacity-50"
      >
        {submitting ? "Posting..." : "Post"}
      </button>
    </form>
  );
}