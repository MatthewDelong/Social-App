import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

export default function Home() {
  const { posts, likePost, commentPost } = useApp();
  const [commentText, setCommentText] = useState({});

  return (
    <div className="p-4 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Feed</h1>
      {posts.map(p => (
        <Card key={p.id} className="mb-4">
          <CardContent>
            <div className="text-gray-600 text-sm">{p.author}</div>
            <div className="mt-2">{p.content}</div>
            <div className="flex gap-3 mt-2">
              <Button size="sm" onClick={() => likePost(p.id)}>❤️ {p.likes}</Button>
            </div>
            <div className="mt-2">
              {p.comments?.map((c,i) => (
                <div key={i} className="text-sm">💬 [{c.author}]: {c.text}</div>
              ))}
            </div>
            <div className="flex mt-2 gap-2">
              <Input
                placeholder="Add comment"
                value={commentText[p.id] || ''}
                onChange={e => setCommentText({...commentText, [p.id]: e.target.value})}
              />
              <Button size="sm" onClick={() => {
                commentPost(p.id, commentText[p.id]);
                setCommentText({...commentText, [p.id]: ''});
              }}>Post</Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}