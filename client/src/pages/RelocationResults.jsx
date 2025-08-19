import React, { useMemo, useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import ResultCard from "../components/ResultCard";

export default function RelocationResults() {
  const { state } = useLocation();
  const navigate = useNavigate();

  // Load state from localStorage if not in navigation state
  const savedState = JSON.parse(localStorage.getItem("relocationPrefs") || "{}");

  const destination = state?.destination || savedState.destination || "";
  const familySize = state?.familySize || savedState.familySize || "";
  const accommodation = state?.accommodation || savedState.accommodation || "";
  const initialQuery = state?.initialQuery || savedState.initialQuery || "";

  const [results, setResults] = useState(
    Array.isArray(state?.results) ? state.results :
    Array.isArray(savedState?.results) ? savedState.results : []
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const hasPayload = Boolean(destination || familySize || accommodation);

  // Save preferences to localStorage when state changes
  useEffect(() => {
    if (hasPayload || results.length > 0) {
      localStorage.setItem("relocationPrefs", JSON.stringify({
        destination,
        familySize,
        accommodation,
        initialQuery,
        results
      }));
    }
  }, [destination, familySize, accommodation, initialQuery, results, hasPayload]);

  const summary = useMemo(() => {
    const bits = [];
    if (destination) bits.push(`for ${destination}`);
    if (familySize) bits.push(`(${familySize})`);
    if (accommodation) bits.push(accommodation);
    return bits.join(" · ");
  }, [destination, familySize, accommodation]);

  const regenerate = async () => {
    if (!destination) {
      setError("Missing destination. Start over to provide your details.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const payload = { destination, familySize, accommodation, initialQuery };
      const res = await axios.post("http://localhost:5050/api/relocation/recommend", payload);
      setResults(res.data?.items || []);
    } catch (e) {
      console.error(e);
      setError("Couldn’t fetch new recommendations. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Auto-fetch on mount if we have payload but no results
  useEffect(() => {
    if (hasPayload && results.length === 0) {
      regenerate();
    }
  }, []); // Run only on first render

  // ---------- styles ----------
  const s = {
    page: { background: "#F3F6FB", minHeight: "100vh", display: "flex", justifyContent: "center" },
    shell: { width: "100%", maxWidth: 420, padding: "24px 16px 28px" },
    header: { textAlign: "center", fontWeight: 600, fontSize: 18, color: "#1F2937", marginBottom: 16 },
    bubbleRow: { display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 },
    bubbleUser: {
      alignSelf: "flex-end",
      background: "#E7F0FF",
      padding: "14px 16px",
      borderRadius: 16,
      color: "#1F2937",
      maxWidth: "85%",
    },
    bubbleBot: {
      alignSelf: "flex-start",
      background: "#E7F0FF",
      padding: "14px 16px",
      borderRadius: 16,
      color: "#1F2937",
      maxWidth: "85%",
    },
    cardScrollerWrap: {
      background: "#FFFFFF",
      border: "1px solid #E5E7EB",
      borderRadius: 16,
      padding: 12,
      boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
      marginBottom: 16,
    },
    scroller: { display: "flex", gap: 12, overflowX: "auto", paddingBottom: 4 },
    empty: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      height: 120,
      color: "#6B7280",
      fontSize: 13,
    },
    followUp: {
      background: "#FFFFFF",
      border: "1px solid #E5E7EB",
      borderRadius: 16,
      padding: 14,
      color: "#1F2937",
      marginTop: 8,
    },
    followText: { fontSize: 14, color: "#374151", marginBottom: 10 },
    btnRow: { display: "flex", gap: 8 },
    btn: {
      border: "1px solid #E5E7EB",
      background: "#fff",
      padding: "8px 12px",
      borderRadius: 10,
      fontSize: 13,
      cursor: "pointer",
    },
    btnPrimary: {
      border: "1px solid #1559EA",
      background: "#1559EA",
      color: "#fff",
      padding: "8px 12px",
      borderRadius: 10,
      fontSize: 13,
      cursor: "pointer",
    },
    smallNote: { fontSize: 12, color: "#EF4444", marginTop: 6 },
  };

  if (!hasPayload && results.length === 0) {
    return (
      <div style={s.page}>
        <div style={s.shell}>
          <div style={s.header}>Let’s tailor your experience</div>
          <div style={s.followUp}>
            <div style={s.followText}>
              We didn’t get your preferences. Start the quick 3-step setup to see recommendations.
            </div>
            <button style={s.btnPrimary} onClick={() => navigate("/profile-setup-1")}>Start over</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={s.page}>
      <div style={s.shell}>
        <div style={s.header}>{destination || "Selected area"}</div>
        <div style={s.bubbleRow}>
          {initialQuery && <div style={s.bubbleUser}>{initialQuery}</div>}
          <div style={s.bubbleBot}>
            Great! Let’s help you get started – here are some options for <b>{destination || "your area"}</b>{" "}
            based on your preferences{summary ? <> ({summary})</> : null}.
          </div>
        </div>
        <div style={s.cardScrollerWrap}>
          {loading ? (
            <div style={s.empty}>Generating recommendations…</div>
          ) : results.length === 0 ? (
            <div style={s.empty}>No results yet. Try “Regenerate” or adjust your details.</div>
          ) : (
            <div style={s.scroller}>
              {results.map((item, i) => (
                <ResultCard key={item.id || i} item={item} />
              ))}
            </div>
          )}
        </div>
        <div style={s.followUp}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={s.btn} onClick={() => navigate("/profile-setup-1")}>Start over</button>
              <button style={s.btn} onClick={() => navigate(-1)}>Back</button>
            </div>
            <button
              style={s.btn}
              onClick={regenerate}
              disabled={loading || !destination}
              title={!destination ? "Add a destination to regenerate" : "Regenerate"}
            >
              {loading ? "Generating…" : "Regenerate"}
            </button>
          </div>
          <div style={s.followText}>Would you like me to search based on a specific vibe?</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {["Quiet", "Artsy", "Near parks", "Walkable", "Nightlife"].map((t) => (
              <span key={t} style={{ ...s.btn, cursor: "default" }}>{t}</span>
            ))}
          </div>
          {error && <div style={s.smallNote}>{error}</div>}
        </div>
      </div>
    </div>
  );
}
