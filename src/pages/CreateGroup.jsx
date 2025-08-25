import { useState } from "react";
import { collection, addDoc, serverTimestamp, doc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../context/AppContext";

export default function CreateGroup() {
  const { user } = useAppContext();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Group name is required");
      return;
    }

    if (name.trim().length < 3) {
      setError("Group name must be at least 3 characters");
      return;
    }

    if (name.trim().length > 50) {
      setError("Group name must be 50 characters or less");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Create the group document
      const groupRef = await addDoc(collection(db, "groups"), {
        name: name.trim(),
        description: description.trim(),
        createdBy: user.uid,
        creatorId: user.uid, // For permission checking
        createdAt: serverTimestamp(),
      });

      // Add creator as group member with creator role
      await setDoc(doc(db, "groups", groupRef.id, "members", user.uid), {
        userId: user.uid,
        displayName: user.displayName || user.email,
        email: user.email,
        photoURL: user.photoURL || "",
        role: "creator",
        joinedAt: serverTimestamp(),
        assignedBy: user.uid,
        assignedAt: serverTimestamp()
      });

      navigate("/groups");
    } catch (err) {
      console.error("Error creating group:", err);
      setError("Failed to create group. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 max-w-md mx-auto">
      <h2 className="text-xl font-bold mb-4">Create New Group</h2>
      
      {/* Creator privileges explanation */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-semibold text-blue-800 mb-2">As Group Creator, you'll be able to:</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Assign group admins and moderators</li>
          <li>• Delete any posts in the group</li>
          <li>• Remove members from the group</li>
          <li>• Manage all group settings</li>
        </ul>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {error}
          </div>
        )}
        
        <div>
          <label htmlFor="groupName" className="block text-sm font-medium text-gray-700 mb-1">
            Group Name *
          </label>
          <input
            id="groupName"
            type="text"
            placeholder="Enter group name (3-50 characters)"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError("");
            }}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            maxLength={50}
            disabled={loading}
          />
          <div className="text-xs text-gray-500 mt-1">
            {name.length}/50 characters
          </div>
        </div>
        
        <div>
          <label htmlFor="groupDescription" className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            id="groupDescription"
            placeholder="Describe what your group is about (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-20 resize-none"
            maxLength={500}
            disabled={loading}
          />
          <div className="text-xs text-gray-500 mt-1">
            {description.length}/500 characters
          </div>
        </div>
        
        <button 
          type="submit" 
          disabled={loading || !name.trim()}
          className="w-full px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "Creating Group..." : "Create Group"}
        </button>
      </form>
    </div>
  );
}