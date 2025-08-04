import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Textarea } from '../components/ui/textarea';
import { Button } from '../components/ui/button';
import { useNavigate } from 'react-router-dom';

export default function NewPost() {
  const [content, setContent] = useState('');
  const { addPost } = useApp();
  const nav = useNavigate();

  const submit = async () => {
    if (!content.trim()) return;
    await addPost(content);
    nav('/');
  };

  return (
    <div className="p-4 max-w-xl mx-auto">
      <h1 className="text-xl font-bold mb-4">New Post</h1>
      <Textarea value={content} onChange={e => setContent(e.target.value)} rows={5} />
      <Button onClick={submit} className="mt-4 w-full">Post</Button>
    </div>
  );
}
