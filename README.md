# :speech_balloon: Social-App
**Last Updated**: September 04, 2025 

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
- npm install react react-dom react-router-dom react-icons firebase
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

# Firebase Functions
- install NVM for Windows https://github.com/coreybutler/nvm-windows
- nvm install 20.18.0
- nvm use 20.18.0
- firebase deploy --only "functions:adminDeleteUser"

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
- ![Google Cloud](https://img.shields.io/badge/Google_Cloud-4285F4?style=for-the-badge&logo=google-cloud&logoColor=white) - Backend Services

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
├── functions/
│   ├── .eslint.js
│   ├── .gcloudignore
│   ├── .gitignore
│   ├── functions.yaml
│   ├── index.js
│   ├── package-lock.json
│   └── package.json
├── public/
│   ├── apple-touch-icon.png
│   ├── favicon-ico
│   ├── favicon-32x32.png
│   └── images/
│       ├── login&signup.png
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
| Login     | ![Login](https://github.com/user-attachments/assets/8d6f1399-c8f9-49e1-8b69-272d8b536c68) |
| Posts     | ![Posts](https://github.com/user-attachments/assets/52a5534a-0ec8-4bd3-81b2-b3afb4e06b0f) |
| Profile   | ![Profile](https://github.com/user-attachments/assets/d2d0530f-072f-4bc1-bf1e-f589419dc783) |
| Admin     | ![Admin](https://github.com/user-attachments/assets/ccd7e211-8c2d-4fdb-ab12-dc5bf816500d) |
| Group Page| ![Group Page](https://github.com/user-attachments/assets/f00173d1-bfd6-4bc3-ac72-0b778dcec4d0) |
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
