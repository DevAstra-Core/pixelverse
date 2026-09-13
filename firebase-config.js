
  // Import the functions you need from the SDKs you need
import { initializeApp } from 
"https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";

import { getAuth } from 
"https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";


const firebaseConfig = {
    apiKey: "AIzaSyCnLFIFJdOois_vP7DCAHeGnkWU6aP060M",
    authDomain: "pixelverse-ec2ff.firebaseapp.com",
    projectId: "pixelverse-ec2ff",
    storageBucket: "pixelverse-ec2ff.firebasestorage.app",
    messagingSenderId: "692588794459",
    appId: "1:692588794459:web:1966f77e923a2eb94f657e",
    measurementId: "G-49BSVNGWYK"
};


// Initialize Firebase
const app = initializeApp(firebaseConfig);


// Initialize Firebase Authentication
const auth = getAuth(app);


// Export auth so other JS files can use it
export { auth };