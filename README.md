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

# Check dependencies package.json for updates-it will rewite your package.json
- npm install -g npm-check-updates
- ncu -u
- npm install

# Install dependencies
- npm install react react-dom react-router-dom firebase
- npm install -D vite @vitejs/plugin-react tailwindcss postcss autoprefixer
- npm install -D @tailwindcss/postcss (If using  Tailwind 4.1+ which dependencies are)
- npm install -g firebase-tools
- npx tailwindcss init -p

# Firebase login
- firebase login
- firebase init hosting
- firebase deploy

---

## Run Development Server
- npm run dev

## Build for Production
- npm run build

---

## :deciduous_tree: File Tree
```bash
/.
├── public/
│   └── index.html
├── src/
│   ├── components/
│   │   ├── CommentForm.jsx
│   │   ├── Comments.jsx
│   │   ├── Header.jsx
│   │   ├── LikeButton.jsx
│   │   └── Post.jsx
│   ├── context/
│   │   └── AppContext.jsx
│   ├── pages/
│   │   ├── Home.jsx
│   │   ├── Login.jsx
│   │   ├── NewPost.jsx
│   │   ├── Profile.jsx
│   │   └── Signup.jsx
│   ├── firebase.js
│   ├── App.jsx
│   └── main.jsx
├── .gitignore
├── index.html
├── package.json
├── postcss.config.cjs
├── tailwind.config.js
├── vite.config.js
└── firebase.json



---
 
## 🛠 Core Technologies  
- ![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB) - Frontend framework 
- ![JavaScript](https://img.shields.io/badge/JavaScript-323330?style=for-the-badge&logo=javascript&logoColor=F7DF1E) -scripting language
- ![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-grey?style=for-the-badge&logo=tailwind-css&logoColor=38B2AC) - CSS framework 

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