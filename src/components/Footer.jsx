// src/components/Footer.jsx
import React from 'react';

const Footer = () => {
  return (
    <footer className="bg-gray-800 text-white p-4 mt-auto">
      <div className="container mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="mb-4 md:mb-0">
            <p>
              © 2025 Social-App part of{" "}
              <a 
                href="https://matthews-world.netlify.app/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-white hover:underline hover:text-gray-300 transition duration-200"
              >
                Matthews-World
              </a>. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;