// src/pages/AdminPanel.jsx
import { useAppContext } from '../context/AppContext';
import { db } from '../firebase';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';

export default function AdminPanel() {
  const { isAdmin, allUsers, user } = useAppContext();

  if (!isAdmin) return <p>You do not have access.</p>;

  const toggleAdmin = async (uid, currentStatus) => {
    await updateDoc(doc(db, 'users', uid), {
      isAdmin: !currentStatus
    });
    window.location.reload(); // or refetch users cleanly
  };

  const deleteUser = async (uid) => {
    if (window.confirm('Delete this user and all their posts?')) {
      await deleteDoc(doc(db, 'users', uid));
      // You may also want to delete their posts here
      window.location.reload();
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-4">
      <h2 className="text-xl font-bold mb-4">Admin Panel</h2>
      <table className="w-full border">
        <thead>
          <tr className="bg-gray-100">
            <th className="border p-2 text-left">Display Name</th>
            <th className="border p-2 text-left">Email</th>
            <th className="border p-2 text-left">Admin</th>
            <th className="border p-2 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {allUsers.map((u) => (
            <tr key={u.id}>
              <td className="border p-2">{u.displayName || 'N/A'}</td>
              <td className="border p-2">{u.email}</td>
              <td className="border p-2">{u.isAdmin ? 'Yes' : 'No'}</td>
              <td className="border p-2">
                {u.id !== user.uid && (
                  <>
                    <button
                      onClick={() => toggleAdmin(u.id, u.isAdmin)}
                      className="mr-2 px-2 py-1 text-sm bg-blue-500 text-white rounded"
                    >
                      {u.isAdmin ? 'Demote' : 'Promote'}
                    </button>
                    <button
                      onClick={() => deleteUser(u.id)}
                      className="px-2 py-1 text-sm bg-red-500 text-white rounded"
                    >
                      Delete
                    </button>
                  </>
                )}
                {u.id === user.uid && (
                  <span className="text-gray-500 italic text-sm">(You)</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}