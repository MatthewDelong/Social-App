// src/pages/ProfileSettings.jsx
import { useState } from 'react';
import { updateProfile } from 'firebase/auth';
import { useAppContext } from '../context/AppContext';

export default function ProfileSettings() {
  const { user } = useAppContext();
  const [displayName, setDisplayName] = useState(user.displayName || '');
  const [status, setStatus] = useState('');

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      await updateProfile(user, { displayName });
      setStatus('✅ Name updated successfully!');
    } catch (err) {
      console.error(err);
      setStatus('❌ Failed to update name.');
    }
  };

  return (
    <div className="max-w-md mx-auto mt-10 p-6 border rounded shadow">
      <h2 className="text-xl font-bold mb-4">Profile Settings</h2>

      <form onSubmit={handleUpdate}>
        <label className="block mb-2 text-sm font-medium text-gray-700">
          Display Name
        </label>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="w-full border p-2 rounded mb-4"
          placeholder="Enter your display name"
          required
        />

        <button
          type="submit"
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Save Changes
        </button>
      </form>

      {status && (
        <p className="mt-4 text-sm text-gray-700">{status}</p>
      )}
    </div>
  );
}
