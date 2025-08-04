import React from 'react';
export function Input({ className = '', ...props }) {
  return (
    <input className={`w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring ${className}`} {...props} />
  );
}