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
- npm install date-fns
- npm install firebase storage
- npm install emoji-picker-react
- npx tailwindcss init -p
- npm install lucide-react

# Setup for CORS policy (No Errors) Google Cloud SDK

- https://cloud.google.com/sdk/docs/install
- Change to directory the cors.json is in the root of project.
- gcloud config set project social-app-8a28d
- gcloud storage buckets update gs://social-app-8a28d.firebasestorage.app --cors-file=cors.json

# Firebase login/Deploy
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
- ![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB) - Frontend Framework 
- ![JavaScript](https://img.shields.io/badge/JavaScript-323330?style=for-the-badge&logo=javascript&logoColor=F7DF1E) - Scripting Language
- ![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-grey?style=for-the-badge&logo=tailwind-css&logoColor=38B2AC) - CSS Framework
- ![Firebase](https://img.shields.io/badge/firebase-ffca28?style=for-the-badge&logo=firebase&logoColor=black) - Backend Services

---

## :deciduous_tree: File Tree
```
├── .firebaserc
├── .gitignore
├── LICENSE
├── README.md
├── firebase.json
├── index.html
├── package-lock.json
├── package.json
├── postcss.config.js
├── tailwind.config.js
├── vite.config.js
├── public/
│   ├── apple-touch-icon.png
│   ├── favicon-ico
│   ├── favicon-32x32.png
│   └── images/
│       └── logo.png
└── src/
    ├── App.jsx
    ├── firebase.js
    ├── index.css
    ├── main.jsx
    ├── components/
    │   ├── Footer.jsx
    │   ├── Layout.jsx
    │   ├── MembersList
    │   ├── Navbar.jsx
    │   ├── groups/
    │   │   ├── GroupComments.jsx
    │   │   ├── GroupNewPost.jsx
    │   │   ├── GroupReplies.jsx
    │   │   ├── GroupRoleManager.jsx
    │   │   └── RoleBadge.jsx
    │   └── ui/
    │       ├── button.jsx
    │       ├── card.jsx
    │       ├── input.jsx
    │       └── textarea.jsx
    ├── context/
    │   └── AppContext.jsx
    ├── hooks/
    │   └── useGroupPermissions.jsx
    └── pages/
        ├── AdminDashboard.jsx
        ├── CreateGroup.jsx
        ├── GroupList.jsx
        ├── GroupPage.jsx
        ├── GroupPostPage.jsx
        ├── Home.jsx
        ├── Login.jsx
        ├── NewPost.jsx
        ├── Profile.jsx
        ├── ProfileSettings.jsx
        ├── Signup.jsx
        └── UserProfiles.jsx
  ```
---

## 🖥 Screenshots  

| Page      | Preview |
|-----------|---------|
| Login     | ![Login](https://github.com/user-attachments/assets/4ea1359c-b1a9-4447-94a0-65f51ba063be) |
| Posts     | ![Posts](https://github.com/user-attachments/assets/57826956-d3c7-474c-8bd4-82123af5e599) |
| Profile   | ![Profile](https://github.com/user-attachments/assets/00d6174e-2c3a-4d57-afdf-3a7bd5902bc1) |


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
