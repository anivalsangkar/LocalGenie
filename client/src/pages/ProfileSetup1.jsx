import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FiUsers } from "react-icons/fi";

function ProfileSetup1() {
  const navigate = useNavigate();
  const routerState = useLocation().state || {}; // { destination?, initialQuery?, familySize? }
  const [selected, setSelected] = useState(routerState.familySize || "");

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
    stepText: { fontSize: "13px", color: "#6B7280", marginBottom: "4px" },
    stepTitle: { fontSize: "14px", fontWeight: 600, marginBottom: "10px", color: "#111827" },
    progressBarContainer: {
      backgroundColor: "#e5e7eb",
      borderRadius: "6px",
      height: "4px",
      width: "100%",
      marginBottom: "16px",
    },
    progressBar: { backgroundColor: "#1559EA", height: "4px", borderRadius: "6px", width: "33.3333%" },
    centerIcon: { display: "flex", justifyContent: "center", alignItems: "center", marginBottom: "10px" },
    title: { fontSize: "16px", fontWeight: "bold", marginBottom: "6px", textAlign: "center" },
    subtitle: { fontSize: "14px", color: "#6B7280", marginBottom: "24px", textAlign: "center" },
    optionsGrid: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: "12px",
      marginBottom: "50px",
    },
    option: (isSelected) => ({
      backgroundColor: isSelected ? "#E3EDFF" : "#ffffff",
      border: isSelected ? "2px solid #1D4ED8" : "1px solid #E5E7EB",
      borderRadius: "12px",
      padding: "16px 12px",
      textAlign: "center",
      cursor: "pointer",
      fontWeight: 500,
      fontSize: "14px",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "6px",
      color: "#1F2937",
    }),
    nextButton: (enabled) => ({
      backgroundColor: enabled ? "#1559EA" : "#d1d5db",
      color: enabled ? "white" : "#9ca3af",
      padding: "14px",
      borderRadius: "12px",
      textAlign: "center",
      fontWeight: 600,
      cursor: enabled ? "pointer" : "not-allowed",
      fontSize: "14px",
    }),
    emoji: { fontSize: "20px" },
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
  };

  const options = [
    { label: "Just me", emoji: "🧍‍♂️" },
    { label: "Couple", emoji: "👫" },
    { label: "3–5 people", emoji: "👨‍👩‍👧" },
    { label: "6+ people", emoji: "👨‍👩‍👧‍👦" },
  ];

  const goClose = () => {
    // behave like closing a modal: go back if possible, else home
    if (window.history.length > 1) navigate(-1);
    else navigate("/home");
  };

  const goNext = () => {
    if (!selected) return;
    navigate("/profile-setup-2", {
      state: { ...routerState, familySize: selected },
    });
  };

  return (
    <div style={styles.modal}>
      {/* destination chip (if we have a prefill from Home) */}
      {routerState.destination && (
        <div style={styles.chip}>Destination: {routerState.destination}</div>
      )}

      <div style={styles.closeButton} onClick={goClose} aria-label="Close wizard" role="button" tabIndex={0}>
        ×
      </div>

      <div style={styles.stepTitle}>Tailor your experience</div>
      <div style={styles.stepText}>Step 1 of 3</div>
      <div style={styles.progressBarContainer}>
        <div style={styles.progressBar}></div>
      </div>

      <div style={styles.centerIcon}>
        <FiUsers size={22} />
      </div>
      <div style={styles.title}>Family Structure</div>
      <div style={styles.subtitle}>Help us understand your relocation situation</div>

      <div style={styles.optionsGrid}>
        {options.map(({ label, emoji }) => (
          <div
            key={label}
            style={styles.option(selected === label)}
            onClick={() => setSelected(label)}
          >
            <div style={styles.emoji}>{emoji}</div>
            {label}
          </div>
        ))}
      </div>

      <div style={styles.nextButton(!!selected)} onClick={goNext}>
        Next
      </div>
    </div>
  );
}

export default ProfileSetup1;


/*
import { useState } from "react";
import { FiUsers } from "react-icons/fi";
import ProfileSetup2 from "./ProfileSetup2";

function ProfileSetup1() {
  const [selected, setSelected] = useState("");
  const [showStep1, setShowStep1] = useState(true);

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
    stepText: {
      fontSize: "13px",
      color: "#6B7280",
      marginBottom: "4px",
    },
    stepTitle: {
      fontSize: "14px",
      fontWeight: 600,
      marginBottom: "10px",
      color: "#111827",
    },
    progressBarContainer: {
      backgroundColor: "#e5e7eb",
      borderRadius: "6px",
      height: "4px",
      width: "100%",
      marginBottom: "16px",
    },
    progressBar: {
      backgroundColor: "#1559EA",
      height: "4px",
      borderRadius: "6px",
      width: "33.3333%",
    },
    centerIcon: {
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      marginBottom: "10px",
    },
    title: {
      fontSize: "16px",
      fontWeight: "bold",
      marginBottom: "6px",
      textAlign: "center",
    },
    subtitle: {
      fontSize: "14px",
      color: "#6B7280",
      marginBottom: "24px",
      textAlign: "center",
    },
    optionsGrid: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: "12px",
      marginBottom: "50px",
    },
    option: (isSelected) => ({
      backgroundColor: isSelected ? "#E3EDFF" : "#ffffff",
      border: isSelected ? "2px solid #1D4ED8" : "1px solid #E5E7EB",
      borderRadius: "12px",
      padding: "16px 12px",
      textAlign: "center",
      cursor: "pointer",
      fontWeight: 500,
      fontSize: "14px",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "6px",
      color: "#1F2937",
    }),
    nextButton: (enabled) => ({
      backgroundColor: enabled ? "#1559EA" : "#d1d5db",
      color: enabled ? "white" : "#9ca3af",
      padding: "14px",
      borderRadius: "12px",
      textAlign: "center",
      fontWeight: 600,
      cursor: enabled ? "pointer" : "not-allowed",
      fontSize: "14px",
    }),
    emoji: {
      fontSize: "20px",
    },
  };

  const options = [
    { label: "Just me", emoji: "🧍‍♂️" },
    { label: "Couple", emoji: "👫" },
    { label: "3-5 people", emoji: "👨‍👩‍👧" },
    { label: "6+ people", emoji: "👨‍👩‍👧‍👦" },
  ];

  if (!showStep1) return <ProfileSetup2 />;

  return (
    <div style={styles.modal}>
      <div style={styles.closeButton} onClick={() => setShowStep1(false)}>
        ×
      </div>
      <div style={styles.stepTitle}>Tailor your experience</div>
      <div style={styles.stepText}>Step 1 of 3</div>
      <div style={styles.progressBarContainer}>
        <div style={styles.progressBar}></div>
      </div>
      <div style={styles.centerIcon}>
        <FiUsers size={22} />
      </div>
      <div style={styles.title}>Family Structure</div>
      <div style={styles.subtitle}>
        Help us understand your relocation situation
      </div>
      <div style={styles.optionsGrid}>
        {options.map(({ label, emoji }) => (
          <div
            key={label}
            style={styles.option(selected === label)}
            onClick={() => setSelected(label)}
          >
            <div style={styles.emoji}>{emoji}</div>
            {label}
          </div>
        ))}
      </div>
      <div
        style={styles.nextButton(!!selected)}
        onClick={() => selected && setShowStep1(false)}
      >
        Next
      </div>
    </div>
  );
}
export default ProfileSetup1;
*/