# :speech_balloon: Social-App

# Requirements
- Node.js v16+
- Firebase project: (https://console.firebase.google.com/)
- Enable Email/Password authentication
- Firestore database
- Firestore rules to allow authenticated users to read/write posts
- Firebase CLI installed (npm install -g firebase-tools)

- Run firebase init hosting in project root (Select build directory dist)
- Replace placeholders in firebase.js and .firebaserc

# Install dependencies
- npm install react react-dom react-router-dom firebase
- npm install -D vite @vitejs/plugin-react tailwindcss postcss autoprefixer
- npm install -g firebase-tools
- npx tailwindcss init -p

# Firebase login
- firebase login
- firebase init hosting (If you ever need to reset or reconfigure)
- npm run build
- firebase deploy

---

## Run Development Server
- npm run dev

## Build for Production
- npm run build

---

### Core Technologies  
- ![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB) - Frontend framework 
- ![JavaScript](https://img.shields.io/badge/JavaScript-323330?style=for-the-badge&logo=javascript&logoColor=F7DF1E) -scripting language
- ![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-grey?style=for-the-badge&logo=tailwind-css&logoColor=38B2AC) - CSS framework

---

## :deciduous_tree: File Tree
```
├── firebase.json
├── .firebaserc
├── index.html
├── package.json
├── package-lock.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── .gitignore
├── README.md
├── LICENSE
├── public/
│   ├── favicon.ico
│   └── logo.png
│   └── apple-touch-icon.png
└── src/
    ├── main.jsx
    ├── index.css
    ├── firebase.js
    ├── App.jsx
    ├── context/
    │   └── AppContext.jsx
    ├── components/
    │   ├── ui/
    │   │   ├── button.jsx
    │   │   ├── input.jsx
    │   │   ├── textarea.jsx
    │   │   └── card.jsx
    │   └─ Navbar.jsx
    └── pages/
        ├── Login.jsx
        ├── Signup.jsx
        ├── Home.jsx
        ├── Profile.jsx
        ├── NewPost.jsx
        └── ProfileSettings.jsx
  ```
---
 
## 📜 License  
- **Code (MIT License)**:  
  - Covers all original source code (HTML, CSS, JavaScript)  
  - [View MIT License](LICENSE)  
- **Content (CC BY 4.0)**:  
  - Applies to original text, graphics, and media created for Matthews-World-Social 
  - [View Creative Commons License](https://creativecommons.org/licenses/by/4.0/)  

  ---

## 👨‍💻 Developer  
**Matthew Delong**  
[GitHub Profile](https://github.com/MatthewDelong)  
