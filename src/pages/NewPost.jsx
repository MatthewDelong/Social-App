import { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAppContext } from '../context/AppContext';
import Textarea from '../components/ui/textarea';
import Button from '../components/ui/button';
import { useNavigate } from 'react-router-dom';

export default function NewPost() {
  const [content, setContent] = useState('');
  const { user } = useAppContext();
  const navigate = useNavigate();

  const handlePost = async () => {
    await addDoc(collection(db, 'posts'), {
      content,
      author: user.email,
      uid: user.uid,
      createdAt: serverTimestamp(),
      likes: [],
      comments: []
    });
    navigate('/');
  };

  return (
    <div className="max-w-xl mx-auto mt-10">
      <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="What's on your mind?" />
      <Button onClick={handlePost}>Post</Button>
    </div>
  );
}
