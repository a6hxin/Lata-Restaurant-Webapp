import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup }
  from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
  apiKey:            "AIzaSyCYzxD0F9jg89u_loGzCfVoCTD8VNVPuVE",
  authDomain:        "my-project-0ecd7.firebaseapp.com",
  projectId:         "my-project-0ecd7",
  storageBucket:     "my-project-0ecd7.firebasestorage.app",
  messagingSenderId: "201711814600",
  appId:             "1:201711814600:web:e808ad2fd3d7223809a2fd",
  measurementId:     "G-NW2EX4K9ZF"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);

export function googleLogin() {
  const provider = new GoogleAuthProvider();

  signInWithPopup(auth, provider)
    .then(async (result) => {
      const user = result.user;
      console.log("Google user:", user.displayName, user.email);

      // ── Get Firebase ID Token ──
      const firebaseToken = await user.getIdToken();

      // ── Send to our backend ──
      const res = await fetch("http://localhost:5001/api/auth/google-firebase", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ firebaseToken }),
      });

      const data = await res.json();
      console.log("Backend response:", data);

      if (!res.ok) throw new Error(data.message || "Backend login failed");

      // ── Save JWT token from our backend ──
      localStorage.setItem("lata_token", data.token);
      localStorage.setItem("lata_name",  data.user.name);
      localStorage.setItem("lata_email", data.user.email);

      // ── Also save Firebase user info ──
      localStorage.setItem("user", JSON.stringify({
        name:  data.user.name,
        email: data.user.email,
        photo: data.user.avatar || user.photoURL,
      }));

      // ── Redirect to homepage ──
      window.location.href = "index.html";
    })
    .catch((error) => {
      // Ignore popup closed by user
      if (error.code === "auth/popup-closed-by-user")    return;
      if (error.code === "auth/cancelled-popup-request") return;

      console.error("Google login error:", error);
      alert("Google sign-in failed. Please try again.");
    });
}
