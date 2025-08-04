import React from 'react';
export function Textarea({ className = '', ...props }) {
  return (
    <textarea className={`w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring ${className}`} {...props} />
  );
}