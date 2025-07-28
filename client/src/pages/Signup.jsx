import React from "react";
import { FcGoogle } from "react-icons/fc";
import { Link, useNavigate } from "react-router-dom"; // ✅ for routing
import logo from "../assets/location-logo-blue.png";
import "./Signup.css"; // Optional: your custom styles if any

const Signup = () => {
    const navigate = useNavigate();

  const handleContinue = () => {
    // ✅  validation here 
    navigate("/select-persona");
  };
  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <img src={logo} alt="logo" style={styles.logo} />
        <h2 style={styles.title}>LocalGenie.ai</h2>
        <p style={styles.subtitle}>Your Pocket Guide to Every Corner</p>
        <p style={styles.caption}>
          Multi-modal AI that helps you plan in confidence.
        </p>

        <input type="email" placeholder="Jdoe@email.com" style={styles.input} />
        <input type="password" placeholder="Password" style={styles.input} />

        <div style={styles.forgot}>
          <a href="/">Forgot password?</a>
        </div>

        <button style={styles.continue} onClick={handleContinue}>Continue</button>

        <p style={styles.signup}>
          Don’t have an account? <Link to="/create-account">Sign up</Link>
        </p>

        <div style={styles.orLine}>OR</div>

        <button style={styles.googleBtn}>
          <FcGoogle size={20} style={{ marginRight: "8px" }} />
          Continue with Google
        </button>
      </div>
    </div>
  );
};

const styles = {
  page: {
    backgroundColor: "#f6f8fb",
    height: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    backgroundColor: "white",
    padding: "30px",
    width: "350px",
    borderRadius: "12px",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
    textAlign: "center",
    fontFamily: "Arial, sans-serif",
  },
  logo: {
    width: "30px",
    height: "30px",
    marginBottom: "12px",
  },
  title: {
    fontSize: "22px",
    fontWeight: "bold",
    marginBottom: "4px",
  },
  subtitle: {
    fontSize: "16px",
    fontWeight: "600",
    marginBottom: "4px",
  },
  caption: {
    fontSize: "14px",
    color: "#666",
    marginBottom: "16px",
  },
  input: {
    width: "100%",
    padding: "10px",
    marginBottom: "10px",
    borderRadius: "6px",
    border: "1px solid #ccc",
    fontSize: "14px",
  },
  forgot: {
    textAlign: "left",
    marginBottom: "10px",
    fontSize: "13px",
  },
  continue: {
    width: "100%",
    backgroundColor: "#2563eb",
    color: "white",
    padding: "10px",
    border: "none",
    borderRadius: "6px",
    fontWeight: "bold",
    fontSize: "14px",
    cursor: "pointer",
    marginBottom: "14px",
  },
  signup: {
    fontSize: "13px",
    marginBottom: "8px",
  },
  orLine: {
    fontSize: "12px",
    color: "#aaa",
    marginBottom: "10px",
  },
  googleBtn: {
    width: "100%",
    backgroundColor: "#f5f5f5",
    padding: "10px",
    border: "1px solid #ddd",
    borderRadius: "6px",
    fontSize: "14px",
    cursor: "pointer",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
};

export default Signup;
