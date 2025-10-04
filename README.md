# :speech_balloon: Social-App (Windows OS)
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

# npm.ps1 cannot be loaded because running scripts is disabled 
- Open Powershell (As Administrator)
- Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Firebase login
- firebase login
- firebase init hosting (If you ever need to reset or reconfigure)

# Firebase Functions
- install NVM for Windows https://github.com/coreybutler/nvm-windows
- once installed open a command prompt as admin
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
| Login     | ![Login](https://github.com/user-attachments/assets/e1d8d78b-235e-4468-84e7-550d9ccfbed6) |
| Posts     | ![Posts](https://github.com/user-attachments/assets/a008963f-a0cf-48e1-907a-37f0a7c77a9b) |
| Profile   | ![Profile](https://github.com/user-attachments/assets/43124624-0d5d-4275-913b-040066cc4761) |
| Admin     | ![Admin](https://github.com/user-attachments/assets/5e94160b-4810-4110-8f18-a0ef08afcb77) |
| Group Page| ![Group Page](https://github.com/user-attachments/assets/42a12ce4-ef71-4a93-a2f2-9b1dabade2c9) |
| Group Posts| ![Group Posts](https://github.com/user-attachments/assets/f114b90a-a48d-4f4e-9b73-05b519e41392) |
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
