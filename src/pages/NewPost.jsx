import { useState, useEffect } from 'react';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAppContext } from '../context/AppContext';
import Textarea from '../components/ui/textarea';
import Button from '../components/ui/button';
import { useNavigate } from 'react-router-dom';

export default function NewPost() {
  const [content, setContent] = useState('');
  const [userData, setUserData] = useState(null);
  const { user } = useAppContext();
  const navigate = useNavigate();

  // Fetch full user record from Firestore
  useEffect(() => {
    const fetchUserData = async () => {
      if (user?.uid) {
        const userRef = doc(db, 'users', user.uid);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          setUserData(snap.data());
        } else {
          setUserData({});
        }
      }
    };
    fetchUserData();
  }, [user]);

  const handlePost = async () => {
    if (!content.trim() || !user) return;

    await addDoc(collection(db, 'posts'), {
      content,
      author: user.displayName || user.email || 'Unknown',
      authorEmail: user.email,
      uid: user.uid,
      isAdmin: userData?.isAdmin || false,
      isModerator: userData?.isModerator || false,
      createdAt: serverTimestamp(),
      likes: [],
      comments: [],
    });

    setContent('');
    navigate('/');
  };

  return (
    <div className="max-w-xl mx-auto mt-10">
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="What's on your mind?"
      />
      <Button onClick={handlePost}>Post</Button>
    </div>
  );
}