import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';

export default function Profile() {
  const { posts, currentUser, editPost, deletePost } = useApp();
  const [editState, setEditState] = useState({});

  const userPosts = posts.filter(p => p.author === currentUser.email);

  return (
    <div className="p-4 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">My Posts</h1>
      {userPosts.map(p => (
        <Card key={p.id} className="mb-4">
          <CardContent>
            {editState[p.id] !== undefined ? (
              <>
                <Textarea
                  rows={3}
                  value={editState[p.id]}
                  onChange={e => setEditState({...editState, [p.id]: e.target.value})}
                />
                <div className="flex gap-2 mt-2">
                  <Button size="sm" onClick={() => {
                    editPost(p.id, editState[p.id]);
                    setEditState({...editState, [p.id]: undefined});
                  }}>Save</Button>
                  <Button size="sm" onClick={() => setEditState({...editState, [p.id]: undefined})}>
                    Cancel
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div>{p.content}</div>
                <div className="flex gap-2 mt-2">
                  <Button size="sm" onClick={() => setEditState({...editState, [p.id]: p.content})}>
                    Edit
                  </Button>
                  <Button size="sm" onClick={() => deletePost(p.id)}>Delete</Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
