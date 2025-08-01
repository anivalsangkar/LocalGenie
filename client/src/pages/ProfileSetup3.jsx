import { useState } from "react";
import { FiX } from "react-icons/fi";
import { FaMapMarkerAlt } from "react-icons/fa";
import ProfileSetup2 from "./ProfileSetup2";

function ProfileSetup3() {
  const [isVisible, setIsVisible] = useState(true);
  const [location, setLocation] = useState("");
  const [step, setStep] = useState(3);
  const styles = {
    modal: {
      backgroundColor: "#ffffff",
      borderRadius: "16px",
      padding: "40px 32px",
      boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
      maxWidth: "600px",
      margin: "80px auto",
      fontFamily: "Arial, sans-serif",
      position: "relative",
    },
    closeButton: {
      position: "absolute",
      top: "16px",
      right: "16px",
      fontSize: "20px",
      fontWeight: "bold",
      cursor: "pointer",
      color: "#999",
    },
    stepTitle: {
      fontSize: "14px",
      fontWeight: 600,
      color: "#111827",
      marginBottom: "15px",
    },
    stepText: {
      fontSize: "13px",
      color: "#6B7280",
      marginBottom: "6px",
    },
    progressBarContainer: {
      backgroundColor: "#e5e7eb",
      borderRadius: "6px",
      height: "4px",
      width: "100%",
      marginBottom: "20px",
    },
    progressBar: {
      backgroundColor: "#1559EA",
      height: "4px",
      borderRadius: "6px",
      width: "100%",
    },
    centerIcon: {
      textAlign: "center",
      fontSize: "20px",
      marginBottom: "10px",
      color: "#000",
    },
    title: {
      fontSize: "16px",
      fontWeight: "bold",
      marginBottom: "15px",
      textAlign: "center",
    },
    subtitle: {
      fontSize: "14px",
      color: "#6B7280",
      marginBottom: "80px",
      textAlign: "center",
    },
    inputBox: {
      border: "1px solid #E5E7EB",
      borderRadius: "12px",
      padding: "12px 16px",
      fontSize: "14px",
      color: "#111827",
      width: "100%",
      marginBottom: "100px",
      outline: "none",
    },
    buttonGroup: {
      display: "flex",
      justifyContent: "space-between",
      gap: "12px",
    },
    backButton: {
      flex: 1,
      backgroundColor: "#ffffff",
      border: "1px solid #E5E7EB",
      color: "#1F2937",
      padding: "14px",
      borderRadius: "12px",
      fontWeight: 600,
      cursor: "pointer",
      fontSize: "14px",
    },
    nextButton: {
      flex: 1,
      backgroundColor: "#1559EA",
      color: "#ffffff",
      padding: "14px",
      borderRadius: "12px",
      fontWeight: 600,
      cursor: "pointer",
      fontSize: "14px",
    },
  };

  if (!isVisible) return null;
  if (step === 2) return <ProfileSetup2 />;

  return (
    <div style={styles.modal}>
      <div style={styles.closeButton} onClick={() => setIsVisible(false)}>
        <FiX />
      </div>
      <div style={styles.stepTitle}>Tailor your experience</div>
      <div style={styles.stepText}>Step 3 of 3</div>
      <div style={styles.progressBarContainer}>
        <div style={styles.progressBar}></div>
      </div>
      <div style={styles.centerIcon}>
        <FaMapMarkerAlt size={22} />
      </div>
      <div style={styles.title}>Destination</div>
      <div style={styles.subtitle}>Where are you planning to relocate?</div>
      <input
        type="text"
        style={styles.inputBox}
        placeholder="Location or zip code"
        value={location}
        onChange={(e) => setLocation(e.target.value)}
      />
      <div style={styles.buttonGroup}>
        <button style={styles.backButton} onClick={() => setStep(2)}>
          Back
        </button>
        <button
          style={{
            ...styles.nextButton,
            backgroundColor: location ? "#1559EA" : "#d1d5db",
            color: location ? "#ffffff" : "#9ca3af",
            cursor: location ? "pointer" : "not-allowed",
          }}
          onClick={() => alert("Complete Setup Page")}
        >
          Complete Setup
        </button>
      </div>
    </div>
  );
}
export default ProfileSetup3;
