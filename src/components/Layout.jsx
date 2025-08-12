// src/components/Layout.jsx
import React from 'react';
import Footer from './Footer';

const Layout = ({ children }) => {
  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-grow">
        {children}  {/* Your page content injects here */}
      </main>
      <Footer />  {/* Auto-appears on all pages */}
    </div>
  );
};

export default Layout;