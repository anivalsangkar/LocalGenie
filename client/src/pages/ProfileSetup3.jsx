import { useState, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { FiX } from "react-icons/fi";
import { FaMapMarkerAlt } from "react-icons/fa";

const API_BASE =
  process.env.REACT_APP_API_BASE?.replace(/\/$/, "") || "http://localhost:5050";

function ProfileSetup3() {
  const navigate = useNavigate();
  const routerState = useLocation().state || {}; // { familySize, accommodation, destination?, initialQuery? }

  const [destination, setDestination] = useState(routerState.destination || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const cityTrimmed = useMemo(() => (destination || "").trim(), [destination]);

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
    chip: {
      position: "absolute",
      top: "16px",
      left: "16px",
      fontSize: "12px",
      background: "#F3F4F6",
      border: "1px solid #E5E7EB",
      color: "#374151",
      padding: "6px 10px",
      borderRadius: "9999px",
      maxWidth: "60%",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
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
    stepTitle: { fontSize: "14px", fontWeight: 600, color: "#111827", marginBottom: "15px" },
    stepText: { fontSize: "13px", color: "#6B7280", marginBottom: "6px" },
    progressBarContainer: {
      backgroundColor: "#e5e7eb",
      borderRadius: "6px",
      height: "4px",
      width: "100%",
      marginBottom: "20px",
    },
    progressBar: { backgroundColor: "#1559EA", height: "4px", borderRadius: "6px", width: "100%" },
    centerIcon: { textAlign: "center", fontSize: "20px", marginBottom: "10px", color: "#000" },
    title: { fontSize: "16px", fontWeight: "bold", marginBottom: "15px", textAlign: "center" },
    subtitle: { fontSize: "14px", color: "#6B7280", marginBottom: "80px", textAlign: "center" },
    inputBox: {
      border: "1px solid #E5E7EB",
      borderRadius: "12px",
      padding: "12px 16px",
      fontSize: "14px",
      color: "#111827",
      width: "100%",
      marginBottom: "8px",
      outline: "none",
    },
    error: { fontSize: "12px", color: "#dc2626", marginBottom: "80px" },
    buttonGroup: { display: "flex", justifyContent: "space-between", gap: "12px" },
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
    nextDisabled: {
      backgroundColor: "#d1d5db",
      color: "#9ca3af",
      cursor: "not-allowed",
    },
  };

  const goClose = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate("/home");
  };

  const goBack = () => {
    navigate("/profile-setup-2", { state: { ...routerState, destination } });
  };

  const completeSetup = async () => {
    if (!cityTrimmed || loading) return;
    setError("");
    setLoading(true);

    const payload = {
      destination: cityTrimmed,
      familySize: routerState.familySize,
      accommodation: routerState.accommodation,
      initialQuery: routerState.initialQuery,
    };

    try {
      const res = await axios.post(`${API_BASE}/api/relocation/recommend`, payload);
      const items = Array.isArray(res.data?.items) ? res.data.items : [];
      navigate("/relocation-results", { state: { ...payload, results: items } });
    } catch (e) {
      console.error("recommend error", e);
      const msg =
        e?.response?.data?.error === "failed_to_generate"
          ? "Could not generate recommendations. Check your OPENAI_API_KEY on the server."
          : "Server error. Please try again.";
      setError(msg);
      // still navigate with empty results so the UX continues
      navigate("/relocation-results", { state: { ...payload, results: [] } });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.modal}>
      {routerState.destination && <div style={styles.chip}>Destination: {routerState.destination}</div>}

      <div
        style={styles.closeButton}
        onClick={goClose}
        aria-label="Close wizard"
        role="button"
        tabIndex={0}
      >
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
        value={destination}
        onChange={(e) => setDestination(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && cityTrimmed) {
            e.preventDefault();
            completeSetup();
          }
        }}
      />
      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.buttonGroup}>
        <button style={styles.backButton} onClick={goBack} disabled={loading}>
          Back
        </button>
        <button
          style={{ ...styles.nextButton, ...(cityTrimmed ? {} : styles.nextDisabled) }}
          onClick={completeSetup}
          disabled={!cityTrimmed || loading}
        >
          {loading ? "Generating…" : "Complete Setup"}
        </button>
      </div>
    </div>
  );
}

export default ProfileSetup3;


/*
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
*/