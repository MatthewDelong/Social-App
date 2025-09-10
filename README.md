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

# Install dependencies in package.json, npm install
- npm install react react-dom react-router-dom react-icons firebase
- npm install date-fns
- npm install firebase storage
- npm install emoji-picker-react
- npm install -D vite @vitejs/plugin-react tailwindcss postcss autoprefixer
# Global and init, seperate from package.json
- npx tailwindcss init -p
- npm install -g firebase-tools

# Setup for CORS policy (No Errors) Google Cloud SDK
- https://cloud.google.com/sdk/docs/install
- Change to directory the cors.json is in the root of project.
- gcloud config set project social-app-8a28d
- gcloud storage buckets update gs://social-app-8a28d.firebasestorage.app --cors-file=cors.json

# Firebase login
- firebase login
- firebase init hosting (If you ever need to reset or reconfigure)

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

## Build and Deploy
- npm run deploy (Builds and Deploys)
- npm run build
- firebase deploy

---

### Core Technologies  
- ![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB) - Frontend Framework 
- ![JavaScript](https://img.shields.io/badge/JavaScript-323330?style=for-the-badge&logo=javascript&logoColor=F7DF1E) - Scripting Language
- ![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-grey?style=for-the-badge&logo=tailwind-css&logoColor=38B2AC) - CSS Framework
- ![Firebase](https://img.shields.io/badge/firebase-ffca28?style=for-the-badge&logo=firebase&logoColor=black) - Backend Services
- ![Google Cloud](https://img.shields.io/badge/Google_Cloud-4285F4?style=for-the-badge&logo=google-cloud&logoColor=white) - Backend Services

---

## :deciduous_tree: Core File Tree
```
├── .firebaserc
├── .gitignore
├── LICENSE
├── README.md
├── cors.json
├── firebase.json
├── index.html
├── package-lock.json
├── package.json
├── postcss.config.js
├── tailwind.config.js
├── vite.config.mjs
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
    │   ├── FriendList.jsx
    │   ├── FriendRequestsInbox.jsx
    │   ├── Layout.jsx
    │   ├── MembersList
    │   ├── Navbar.jsx
    │   ├── groups/
    │   │   ├── GroupComments.jsx
    │   │   ├── GroupNewPost.jsx
    │   │   ├── GroupReplies.jsx
    │   │   ├── GroupRoleManager.jsx
    │   │   └── RoleBadge.jsx
    │   ├── nav/
    │   │   └── FriendRequestsMenu.jsx
    │   └── ui/
    │       ├── button.jsx
    │       ├── card.jsx
    │       ├── input.jsx
    │       ├── textarea.jsx
    │       └── Toaster.jsx     
    ├── context/
    │   └── AppContext.jsx
    ├── hooks/
    │   ├── useFriendship.js     
    │   ├── useGroupPermissions.jsx
    │   ├── usePresence.js
    │   └── useToasts.js
    ├── lib/
    │   └── friends.js
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
| Login     | ![Login](https://github.com/user-attachments/assets/d2955bf1-f447-409f-83cf-ba2a0887b251) |
| Posts     | ![Posts](https://github.com/user-attachments/assets/79ea29b9-97ce-4fc7-ad4d-b7b2fe494176) |
| Profile   | ![Profile](https://github.com/user-attachments/assets/80fbaa7e-7ce5-4ee7-9906-18d5492aa1c6) |
| Admin     | ![Admin](https://github.com/user-attachments/assets/ccd7e211-8c2d-4fdb-ab12-dc5bf816500d) |
| Group Page| ![Group Page](https://github.com/user-attachments/assets/2e352d5d-79af-4ec6-adbc-580b81d0317d) |
| Group Posts| ![Group Post](https://github.com/user-attachments/assets/5ccae4d7-6d0b-4eda-a178-e823fe06b343) |
---
 
## 📜 License  
- **Code (MIT License)**:  
  - Covers all original source code (React, Vite CSS, JavaScript)  
  - [View MIT License](LICENSE)  
- **Content (CC BY 4.0)**:  
  - Applies to original text, graphics, and media created for Matthews-World-Social 
  - [View Creative Commons License](https://creativecommons.org/licenses/by/4.0/)  

  ---

## 👨‍💻 Developer  
**Matthew Delong**  
[GitHub Profile](https://github.com/MatthewDelong)  
