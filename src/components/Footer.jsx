// src/components/Footer.jsx
import React from 'react';

const Footer = () => {
  return (
    <footer className="bg-gray-800 text-white p-4">
      <div className="container mx-auto text-center">
        <div className="mb-2">
          © 2025 Social-App part of{" "}
          <a 
            href="https://matthews-world.netlify.app/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-white hover:underline"
          >
            Matthews-World
          </a>. All rights reserved.
        </div>
        
        <div className="mb-2">
          MIT License
        </div>
        
        <div className="text-sm">
          Site content licensed under{" "}
          <a 
            href="https://creativecommons.org/licenses/by/4.0/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-white hover:underline"
          >
            CC BY 4.0
          </a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;