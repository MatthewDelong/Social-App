import { useEffect, useState } from 'react';
import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
  onSnapshot
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useAppContext } from '../context/AppContext';
import { updateProfile } from 'firebase/auth';
import Card from '../components/ui/card';

export default function Profile() {
  const { user } = useAppContext();
  const [posts, setPosts] = useState([]);
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [website, setWebsite] = useState('');
  const [message, setMessage] = useState('');

  // User profile preview data
  const [profileData, setProfileData] = useState({
    displayName: user.displayName || '',
    bio: '',
    location: '',
    website: ''
  });

  useEffect(() => {
    const loadUserProfile = async () => {
      const ref = doc(db, 'users', user.uid);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data();
        setBio(data.bio || '');
        setLocation(data.location || '');
        setWebsite(data.website || '');
        setProfileData({
          displayName: data.displayName || user.displayName || '',
          bio: data.bio || '',
          location: data.location || '',
          website: data.website || ''
        });
      } else {
        await setDoc(ref, {
          displayName: user.displayName,
          bio: '',
          location: '',
          website: ''
        });
      }
    };

    if (user) loadUserProfile();
  }, [user]);

  useEffect(() => {
    const q = query(collection(db, 'posts'), where('uid', '==', user.uid));
    const unsub = onSnapshot(q, (snapshot) => {
      setPosts(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, [user.uid]);

  const handleUpdate = async () => {
    try {
      if (name.trim()) {
        await updateProfile(auth.currentUser, {
          displayName: name
        });
        await updateDoc(doc(db, 'users', user.uid), {
          displayName: name
        });
      }

      await updateDoc(doc(db, 'users', user.uid), {
        bio,
        location,
        website
      });

      setProfileData({
        displayName: name || user.displayName || '',
        bio,
        location,
        website
      });

      setMessage('Profile updated successfully!');
      setName('');
    } catch (error) {
      console.error('Error updating profile:', error);
      setMessage('Failed to update profile.');
    }
  };

  return (
    <div className="max-w-2xl mx-auto mt-10 px-4 space-y-10">
      <h2 className="text-2xl font-bold">Edit Profile</h2>

      <div className="space-y-3">
        <input
          type="text"
          placeholder="Display Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border border-gray-300 p-2 rounded"
        />
        <textarea
          placeholder="Bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          className="w-full border border-gray-300 p-2 rounded h-20"
        />
        <input
          type="text"
          placeholder="Location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="w-full border border-gray-300 p-2 rounded"
        />
        <input
          type="text"
          placeholder="Website"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          className="w-full border border-gray-300 p-2 rounded"
        />
        <button
          onClick={handleUpdate}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Save Changes
        </button>
        {message && <p className="text-green-600 text-sm">{message}</p>}
      </div>

      {/* Profile Preview */}
      <div className="bg-white border rounded p-4 shadow">
        <h2 className="text-xl font-semibold mb-4">Profile Preview</h2>
        <p><span className="font-bold">Name:</span> {profileData.displayName}</p>
        {profileData.bio && (
          <p className="mt-1"><span className="font-bold">Bio:</span> {profileData.bio}</p>
        )}
        {profileData.location && (
          <p className="mt-1"><span className="font-bold">Location:</span> {profileData.location}</p>
        )}
        {profileData.website && (
          <p className="mt-1">
            <span className="font-bold">Website:</span>{' '}
            <a href={profileData.website} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
              {profileData.website}
            </a>
          </p>
        )}
      </div>

      {/* User's posts */}
      <div>
        <h2 className="text-xl font-bold mb-4">Your Posts</h2>
        {posts.length === 0 && <p className="text-gray-600">No posts yet.</p>}
        {posts.map((post) => (
          <Card key={post.id}>
            <p className="font-bold">{post.author}</p>
            <p>{post.content}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
