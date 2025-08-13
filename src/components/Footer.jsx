// src/components/Footer.jsx
import React from "react";

const Footer = () => {
  return (
    <footer className="bg-gray-800 text-white mt-auto">
      <div className="container mx-auto px-2 py-0">
        <div className="text-center space-y-0">
          <div className="text-sm sm:text-base">
            © 2025 Social-App. All rights reserved.
          </div>

          <div className="text-xs">
            <a
              href="https://github.com/MatthewDelong/README.md/blob/main/LICENSE"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-300 hover:text-blue-200 hover:underline transition-colors duration-200"
            >
              MIT License
            </a>
          </div>

          <div className="text-xs">
            <span className="small">
              Site content licensed under{" "}
              <a
                href="https://creativecommons.org/licenses/by/4.0/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-300 hover:text-blue-200 hover:underline transition-colors duration-200"
              >
                CC BY 4.0
              </a>
              <a
                href="https://creativecommons.org/licenses/by/4.0/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white ms-1"
              >
                <img
                  src="https://mirrors.creativecommons.org/presskit/icons/cc.svg"
                  alt="Creative Commons"
                  className="h-4 align-text-top inline-block"
                />

                <img
                  src="https://mirrors.creativecommons.org/presskit/icons/by.svg"
                  alt="Attribution"
                  className="h-4 align-text-top inline-block"
                />
              </a>
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;