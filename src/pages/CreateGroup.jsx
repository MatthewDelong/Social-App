import { useState } from "react";
import { addDoc, collection, serverTimestamp, updateDoc, doc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function CreateGroup() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [coverPhoto, setCoverPhoto] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);

    try {
      // Create initial group doc
      const groupRef = await addDoc(collection(db, "groups"), {
        name: name.trim(),
        description: description.trim(),
        coverPhotoURL: null,
        createdBy: currentUser.uid,
        createdAt: serverTimestamp(),
        members: [currentUser.uid],
      });

      let coverURL = null;
      if (coverPhoto) {
        const coverRef = ref(storage, `groupImages/${groupRef.id}/cover_${Date.now()}_${coverPhoto.name}`);
        await uploadBytes(coverRef, coverPhoto);
        coverURL = await getDownloadURL(coverRef);

        await updateDoc(doc(db, "groups", groupRef.id), {
          coverPhotoURL: coverURL,
        });
      }

      navigate(`/groups/${groupRef.id}`);
    } catch (err) {
      console.error("Error creating group:", err);
    }

    setLoading(false);
  };

  return (
    <div className="max-w-lg mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Create Group</h1>
      <form onSubmit={handleCreate} className="space-y-4">
        <input
          type="text"
          placeholder="Group Name"
          className="w-full border rounded-lg p-2"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <textarea
          placeholder="Description"
          className="w-full border rounded-lg p-2"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        ></textarea>

        <input
          type="file"
          accept="image/*"
          onChange={(e) => setCoverPhoto(e.target.files[0])}
        />

        <button
          type="submit"
          disabled={loading}
          className="bg-blue-500 text-white px-4 py-2 rounded-lg disabled:opacity-50"
        >
          {loading ? "Creating..." : "Create Group"}
        </button>
      </form>
    </div>
  );
}
