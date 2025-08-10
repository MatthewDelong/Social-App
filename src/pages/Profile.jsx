import { useEffect, useState } from 'react';
import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
  onSnapshot,
  getDocs
} from 'firebase/firestore';
import { db, auth, storage } from '../firebase';
import { useAppContext } from '../context/AppContext';
import { updateProfile } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import Card from '../components/ui/card';

export default function Profile() {
  const { user } = useAppContext();
  const [posts, setPosts] = useState([]);
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [website, setWebsite] = useState('');
  const [message, setMessage] = useState('');
  const [uploading, setUploading] = useState(false);

  const DEFAULT_AVATAR =
    'https://firebasestorage.googleapis.com/v0/b/social-app-8a28d.firebasestorage.app/o/default-avatar.png?alt=media&token=78165d2b-f095-496c-9de2-5e143bfc41cc';

  const [profileData, setProfileData] = useState({
    displayName: user.displayName || '',
    bio: '',
    location: '',
    website: '',
    photoURL: user.photoURL || DEFAULT_AVATAR
  });

  useEffect(() => {
    const loadUserProfile = async () => {
      const refUser = doc(db, 'users', user.uid);
      const snap = await getDoc(refUser);
      if (snap.exists()) {
        const data = snap.data();
        setBio(data.bio || '');
        setLocation(data.location || '');
        setWebsite(data.website || '');
        setProfileData({
          displayName: data.displayName || user.displayName || '',
          bio: data.bio || '',
          location: data.location || '',
          website: data.website || '',
          photoURL: data.photoURL || user.photoURL || DEFAULT_AVATAR
        });
      } else {
        await setDoc(refUser, {
          displayName: user.displayName,
          bio: '',
          location: '',
          website: '',
          photoURL: user.photoURL || DEFAULT_AVATAR
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
        await updateProfile(auth.currentUser, { displayName: name });
        await updateDoc(doc(db, 'users', user.uid), { displayName: name });
      }

      await updateDoc(doc(db, 'users', user.uid), {
        bio,
        location,
        website
      });

      setProfileData((prev) => ({
        ...prev,
        displayName: name || user.displayName || '',
        bio,
        location,
        website
      }));

      setMessage('Profile updated successfully!');
      setName('');
    } catch (error) {
      console.error('Error updating profile:', error);
      setMessage('Failed to update profile.');
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const storageRef = ref(storage, `avatars/${user.uid}`);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);

      // Update auth
      await updateProfile(auth.currentUser, { photoURL: downloadURL });

      // Update user doc
      await updateDoc(doc(db, 'users', user.uid), { photoURL: downloadURL });

      // Update all posts by this user
      const postsSnap = await getDocs(query(collection(db, 'posts'), where('uid', '==', user.uid)));
      postsSnap.forEach(async (docSnap) => {
        await updateDoc(doc(db, 'posts', docSnap.id), { authorPhotoURL: downloadURL });
      });

      // Update comments
      const commentsSnap = await getDocs(query(collection(db, 'comments'), where('uid', '==', user.uid)));
      commentsSnap.forEach(async (docSnap) => {
        await updateDoc(doc(db, 'comments', docSnap.id), { authorPhotoURL: downloadURL });
      });

      // Update replies
      const repliesSnap = await getDocs(query(collection(db, 'replies'), where('uid', '==', user.uid)));
      repliesSnap.forEach(async (docSnap) => {
        await updateDoc(doc(db, 'replies', docSnap.id), { authorPhotoURL: downloadURL });
      });

      setProfileData((prev) => ({ ...prev, photoURL: downloadURL }));
      setMessage('Profile picture updated!');
    } catch (error) {
      console.error('Error uploading image:', error);
      setMessage('Failed to upload image.');
    }
    setUploading(false);
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

        {/* Upload Profile Picture */}
        <div className="flex items-center space-x-4">
          <img
            src={profileData.photoURL || DEFAULT_AVATAR}
            alt="Profile Avatar"
            className="w-20 h-20 rounded-full object-cover"
          />
          <label className="cursor-pointer bg-gray-200 px-3 py-1 rounded hover:bg-gray-300">
            {uploading ? 'Uploading...' : 'Upload Picture'}
            <input type="file" accept="image/*" hidden onChange={handleImageUpload} />
          </label>
        </div>

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
        <img
          src={profileData.photoURL || DEFAULT_AVATAR}
          alt="Profile Avatar"
          className="w-24 h-24 rounded-full object-cover mb-4"
        />
        <p><span className="font-bold">Name:</span> {profileData.displayName}</p>
        {profileData.bio && <p className="mt-1"><span className="font-bold">Bio:</span> {profileData.bio}</p>}
        {profileData.location && <p className="mt-1"><span className="font-bold">Location:</span> {profileData.location}</p>}
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
            <div className="flex items-center space-x-2">
              <img src={post.authorPhotoURL || DEFAULT_AVATAR} alt="Author" className="w-8 h-8 rounded-full" />
              <p className="font-bold">{post.author}</p>
            </div>
            <p>{post.content}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}