import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAppContext } from '../context/AppContext';
import Card from '../components/ui/card';

export default function Profile() {
  const { user } = useAppContext();
  const [posts, setPosts] = useState([]);

  useEffect(() => {
    const q = query(collection(db, 'posts'), where('uid', '==', user.uid));
    const unsub = onSnapshot(q, (snapshot) => {
      setPosts(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, [user.uid]);

  return (
    <div className="max-w-xl mx-auto mt-10">
      {posts.map((post) => (
        <Card key={post.id}>
          <p className="font-bold">{post.author}</p>
          <p>{post.content}</p>
        </Card>
      ))}
    </div>
  );
}
