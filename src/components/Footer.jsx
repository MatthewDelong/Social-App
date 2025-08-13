// src/components/Footer.jsx
import React from 'react';

const Footer = () => {
  return (
    <footer className="bg-gray-800 text-white mt-auto">
      <div className="container mx-auto px-4 py-6">
        <div className="text-center space-y-3">
          <div className="text-sm sm:text-base">
            © 2025 Social-App part of{" "}
            <a 
              href="https://matthews-world.netlify.app/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-300 hover:text-blue-200 hover:underline transition-colors duration-200"
            >
              Matthews-World
            </a>. All rights reserved.
          </div>
          
          <div className="text-sm text-gray-300">
            MIT License
          </div>
          
          <div className="text-xs sm:text-sm text-gray-400">
            Site content licensed under{" "}
            <a 
              href="https://creativecommons.org/licenses/by/4.0/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-300 hover:text-blue-200 hover:underline transition-colors duration-200"
            >
              CC BY 4.0
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;