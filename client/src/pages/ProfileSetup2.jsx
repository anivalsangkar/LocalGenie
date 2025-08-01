import { useState } from "react";
import { FaHome } from "react-icons/fa";
import { FiX } from "react-icons/fi";
import ProfileSetup1 from "./ProfileSetup1";
import ProfileSetup3 from "./ProfileSetup3";

function ProfileSetup2() {
  const [isVisible, setIsVisible] = useState(true);
  const [details, setDetails] = useState("");
  const [step, setStep] = useState(2);

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
      width: "66.6666%",
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
  if (step === 1) return <ProfileSetup1 />;
  if (step === 3) return <ProfileSetup3 />;

  return (
    <div style={styles.modal}>
      <div style={styles.closeButton} onClick={() => setIsVisible(false)}>
        <FiX />
      </div>
      <div style={styles.stepTitle}>Tailor your experience</div>
      <div style={styles.stepText}>Step 2 of 3</div>
      <div style={styles.progressBarContainer}>
        <div style={styles.progressBar}></div>
      </div>
      <div style={styles.centerIcon}>
        <FaHome size={22} />
      </div>
      <div style={styles.title}>Preferred Accommodation</div>
      <div style={styles.subtitle}>
        eg: rent/buy, shared/owned, budget = $3000, size - 2b2b, etc...
      </div>
      <input
        type="text"
        style={styles.inputBox}
        placeholder="Details"
        value={details}
        onChange={(e) => setDetails(e.target.value)}
      />
      <div style={styles.buttonGroup}>
        <button style={styles.backButton} onClick={() => setStep(1)}>
          Back
        </button>
        <button
          style={{
            ...styles.nextButton,
            backgroundColor: details ? "#1559EA" : "#d1d5db",
            color: details ? "#ffffff" : "#9ca3af",
            cursor: details ? "pointer" : "not-allowed",
          }}
          onClick={() => details && setStep(3)}
          disabled={!details}
        >
          Next
        </button>
      </div>
    </div>
  );
}
export default ProfileSetup2;
