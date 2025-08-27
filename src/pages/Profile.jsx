// Profile.jsx
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
  const [DEFAULT_AVATAR, setDEFAULT_AVATAR] = useState('');

  const [profileData, setProfileData] = useState({
    displayName: user.displayName || '',
    bio: '',
    location: '',
    website: '',
    photoURL: user.photoURL || '',
    bannerURL: ''
  });

  const [newAvatarFile, setNewAvatarFile] = useState(null);
  const [newAvatarPreview, setNewAvatarPreview] = useState(null);
  const [newBannerFile, setNewBannerFile] = useState(null);
  const [newBannerPreview, setNewBannerPreview] = useState(null);

  useEffect(() => {
    const loadDefaultAvatar = async () => {
      try {
        const defaultRef = ref(storage, 'default-avatar.png');
        const url = await getDownloadURL(defaultRef);
        setDEFAULT_AVATAR(url);
        setProfileData((prev) => ({
          ...prev,
          photoURL: prev.photoURL || url
        }));
      } catch (error) {
        console.error('Error loading default avatar:', error);
      }
    };
    loadDefaultAvatar();
  }, []);

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
          photoURL: data.photoURL || user.photoURL || DEFAULT_AVATAR,
          bannerURL: data.bannerURL || ''
        });
      } else {
        await setDoc(refUser, {
          displayName: user.displayName,
          bio: '',
          location: '',
          website: '',
          photoURL: user.photoURL || DEFAULT_AVATAR,
          bannerURL: ''
        });
      }
    };

    if (user) loadUserProfile();
  }, [user, DEFAULT_AVATAR]);

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

  // ✅ File selection with resize + compression
  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setMessage('File is too large. Please select an image under 5MB.');
      return;
    }

    const img = new Image();
    img.onload = () => {
      const maxDim = 512;
      let { width, height } = img;

      if (width > maxDim || height > maxDim) {
        const scale = Math.min(maxDim / width, maxDim / height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      // Convert to JPEG @ 80% quality for compression
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            setMessage('Error processing image.');
            return;
          }
          const resizedFile = new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
          setNewAvatarFile(resizedFile);
          setNewAvatarPreview(URL.createObjectURL(resizedFile));
        },
        'image/jpeg',
        0.8 // compression quality
      );
    };

    img.src = URL.createObjectURL(file);
  };

  const handleCancelImage = () => {
    setNewAvatarFile(null);
    setNewAvatarPreview(null);
  };

  const handleImageSave = async () => {
    if (!newAvatarFile) return;
    setUploading(true);
    try {
      const storageRef = ref(storage, `avatars/${user.uid}`);
      await uploadBytes(storageRef, newAvatarFile);
      const downloadURL = await getDownloadURL(storageRef);

      await updateProfile(auth.currentUser, { photoURL: downloadURL });
      await updateDoc(doc(db, 'users', user.uid), { photoURL: downloadURL });

      const postsSnap = await getDocs(query(collection(db, 'posts'), where('uid', '==', user.uid)));
      postsSnap.forEach(async (docSnap) => {
        await updateDoc(doc(db, 'posts', docSnap.id), { authorPhotoURL: downloadURL });
      });

      const commentsSnap = await getDocs(query(collection(db, 'comments'), where('uid', '==', user.uid)));
      commentsSnap.forEach(async (docSnap) => {
        await updateDoc(doc(db, 'comments', docSnap.id), { authorPhotoURL: downloadURL });
      });

      const repliesSnap = await getDocs(query(collection(db, 'replies'), where('uid', '==', user.uid)));
      repliesSnap.forEach(async (docSnap) => {
        await updateDoc(doc(db, 'replies', docSnap.id), { authorPhotoURL: downloadURL });
      });

      setProfileData((prev) => ({ ...prev, photoURL: downloadURL }));
      setMessage('Profile picture updated!');
      setNewAvatarFile(null);
      setNewAvatarPreview(null);
    } catch (error) {
      console.error('Error uploading image:', error);
      setMessage('Failed to upload image.');
    }
    setUploading(false);
  };

  // ✅ Banner file selection with resize + compression
  const handleBannerSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setMessage('File is too large. Please select an image under 2MB.');
      return;
    }

    const img = new Image();
    img.onload = () => {
      const maxWidth = 1200;
      const maxHeight = 400;
      let { width, height } = img;

      // Maintain aspect ratio but fit within banner dimensions
      if (width > maxWidth || height > maxHeight) {
        const scale = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      // Convert to JPEG @ 80% quality for compression
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            setMessage('Error processing banner image.');
            return;
          }
          const resizedFile = new File([blob], 'banner.jpg', { type: 'image/jpeg' });
          setNewBannerFile(resizedFile);
          setNewBannerPreview(URL.createObjectURL(resizedFile));
        },
        'image/jpeg',
        0.8 // compression quality
      );
    };

    img.src = URL.createObjectURL(file);
  };

  const handleCancelBanner = () => {
    setNewBannerFile(null);
    setNewBannerPreview(null);
  };

  const handleBannerSave = async () => {
    if (!newBannerFile) return;
    setUploading(true);
    try {
      const storageRef = ref(storage, `banners/${user.uid}`);
      await uploadBytes(storageRef, newBannerFile);
      const downloadURL = await getDownloadURL(storageRef);

      await updateDoc(doc(db, 'users', user.uid), { bannerURL: downloadURL });

      setProfileData((prev) => ({ ...prev, bannerURL: downloadURL }));
      setMessage('Banner updated!');
      setNewBannerFile(null);
      setNewBannerPreview(null);
    } catch (error) {
      console.error('Error uploading banner:', error);
      setMessage('Failed to upload banner.');
    }
    setUploading(false);
  };

  return (
    <div className="max-w-2xl mx-auto mt-10 px-4 space-y-10">
      <h2 className="text-2xl font-bold">Edit Profile</h2>

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

      <div className="flex items-center space-x-4">
        <img
          src={newAvatarPreview || profileData.photoURL || DEFAULT_AVATAR}
          alt="Profile Avatar"
          className="w-20 h-20 rounded-full object-cover"
        />
        <label className="cursor-pointer bg-gray-200 px-3 py-1 rounded hover:bg-gray-300">
          Select Picture
          <input type="file" accept="image/*" hidden onChange={handleImageSelect} />
        </label>
        <span className="text-xs text-gray-500">Max: 512×512px 1MB</span>
      </div>

      {newAvatarPreview && (
        <div className="flex space-x-2 mt-2">
          <button
            onClick={handleImageSave}
            disabled={uploading}
            className="bg-blue-500 text-white px-4 py-1 rounded hover:bg-blue-600"
          >
            {uploading ? 'Saving...' : 'Save Changes'}
          </button>
          <button
            onClick={handleCancelImage}
            className="bg-gray-300 px-4 py-1 rounded hover:bg-gray-400"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Banner Upload Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Profile Banner</h3>
        
        {(newBannerPreview || profileData.bannerURL) && (
          <div className="relative w-full h-32 bg-gray-200 rounded-lg overflow-hidden">
            <img
              src={newBannerPreview || profileData.bannerURL}
              alt="Profile Banner"
              className="w-full h-full object-cover"
            />
          </div>
        )}
        
        <div className="flex items-center space-x-4">
          <label className="cursor-pointer bg-gray-200 px-3 py-1 rounded hover:bg-gray-300">
            {profileData.bannerURL ? 'Change Banner' : 'Add Banner'}
            <input type="file" accept="image/*" hidden onChange={handleBannerSelect} />
          </label>
          <span className="text-xs text-gray-500">Max: 1200×400px 2MB</span>
        </div>

        {newBannerPreview && (
          <div className="flex space-x-2 mt-2">
            <button
              onClick={handleBannerSave}
              disabled={uploading}
              className="bg-blue-500 text-white px-4 py-1 rounded hover:bg-blue-600"
            >
              {uploading ? 'Saving...' : 'Save Banner'}
            </button>
            <button
              onClick={handleCancelBanner}
              className="bg-gray-300 px-4 py-1 rounded hover:bg-gray-400"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      <button
        onClick={handleUpdate}
        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 mt-4"
      >
        Save Profile Details
      </button>

      {message && <p className="text-green-600 text-sm">{message}</p>}

      <div className="bg-white border rounded shadow mt-6 overflow-hidden">
        <h2 className="text-xl font-semibold mb-4 p-4 pb-0">Profile Preview</h2>
        
        {/* Banner and Avatar Section */}
        <div className="relative">
          {/* Banner */}
          {profileData.bannerURL && (
            <div className="w-full h-40 sm:h-56 md:h-64 bg-gradient-to-r from-blue-400 to-purple-600 overflow-hidden">
              <img
                src={profileData.bannerURL}
                alt="Profile Banner"
                className="w-full h-full object-cover"
              />
            </div>
          )}
          
          {/* Avatar overhang - positioned like group logo */}
          <div className={`${profileData.bannerURL ? 'absolute -bottom-12 left-4' : 'p-4'}`}>
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-4 border-white overflow-hidden shadow-lg">
              <img
                src={profileData.photoURL || DEFAULT_AVATAR}
                alt="Profile Avatar"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
        
        {/* Profile Info */}
        <div className={`p-4 ${profileData.bannerURL ? 'mt-20 sm:mt-16' : 'mt-0'}`}>
          <h3 className="text-2xl font-bold">{profileData.displayName}</h3>
          {profileData.bio && <p className="mt-2 text-gray-700">{profileData.bio}</p>}
          {profileData.location && <p className="mt-1 text-gray-600">{profileData.location}</p>}
          {profileData.website && (
            <a href={profileData.website} target="_blank" rel="noopener noreferrer" className="mt-1 block text-blue-500 hover:underline">
              {profileData.website}
            </a>
          )}
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold mb-4">Your Posts</h2>
        {posts.length === 0 && <p className="text-gray-600">No posts yet.</p>}
        {posts.map((post) => (
          <Card key={post.id}>
            <div className="flex items-center space-x-2">
              <img src={profileData.photoURL || DEFAULT_AVATAR} alt="Author" className="w-8 h-8 rounded-full" />
              <p className="font-bold">{post.author}</p>
            </div>
            <p>{post.content}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}