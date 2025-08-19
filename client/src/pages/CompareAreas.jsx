// src/pages/CompareAreas.jsx
import React, { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import "./CompareAreas.css";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:5050"; // <-- ensures it hits Node API

export default function CompareAreas() {
  const navigate = useNavigate();
  const { slug } = useParams();
  const { state } = useLocation();

  // ✅ selected item from previous page (contains the Unsplash image you showed on the card)
  const selectedItem = state?.item || null;
  const selectedImage =
    selectedItem?.image || selectedItem?.img || selectedItem?.photo || null;

  const area1 = state?.item?.title || (slug ? slug.replace(/-/g, " ") : "Santa Monica");
  const city  = state?.city || "Los Angeles";

  const [area2, setArea2] = useState(""); // leave empty to let server pick a random contrasting area
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // ✅ Persist the hero image & title so AreaDetails / ExploreMore can read it reliably
  useEffect(() => {
    if (selectedImage) localStorage.setItem("lastHeroImage", selectedImage);
    if (area1) localStorage.setItem("lastAreaTitle", area1);
  }, [selectedImage, area1]);

  // (Optional) If you later add buttons here, these helpers already pass the same image via router state
  const goDetails = () =>
    navigate("/area/details", {
      state: {
        id: selectedItem?.id,
        title: area1,
        city,
        image: selectedImage,
      },
    });

  const goExplore = () =>
    navigate("/area/explore", {
      state: {
        id: selectedItem?.id,
        title: area1,
        city,
        image: selectedImage,
      },
    });

  useEffect(() => {
    let ignore = false;

    async function run() {
      try {
        setLoading(true);
        setErr("");

        const body = {
          city,
          area1Name: area1,
          // IMPORTANT: if area2 is blank, we omit it so the server chooses a random/contrasting area
          ...(area2.trim() ? { area2Name: area2.trim() } : {})
        };

        const res = await fetch(`${API_BASE}/api/areas/compare`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(body),
        });

        // If the server returned HTML (like an index.html), show a clearer error
        const text = await res.text();
        let json;
        try {
          json = JSON.parse(text);
        } catch {
          throw new Error(
            "Could not parse response from API. Check API URL / proxy. " +
            "Response starts with: " + text.slice(0, 60)
          );
        }

        if (!res.ok) throw new Error(json?.error || "compare failed");
        if (!ignore) setData(json);
      } catch (e) {
        console.error(e);
        if (!ignore) {
          setErr(String(e.message || e));
          setData(null);
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    run();
    return () => { ignore = true; };
  }, [area1, city, area2]);

  const d = data || {
    title: "Comparison Analysis",
    area1: area1,
    area2: area2 || "Area 2",
    rows: [],
    overall: { area1: 0, area2: 0 },
    recommendation: { name: area1, rationale: "", tags: [] },
    vibe: {}
  };

  return (
    <div className="cmp-wrap">
      {/* Top bar */}
      <div className="cmp-topbar">
        <button className="cmp-icon" onClick={() => navigate(-1)} aria-label="Back">←</button>
        <div className="cmp-title">Comparison Analysis</div>
        <div className="cmp-chat">💬</div>
      </div>

      {/* Picker */}
      <div className="cmp-picker">
        <label>
          Compare <b>{area1}</b> with:
        </label>
        <input
          className="cmp-input"
          placeholder="(optional) type another area"
          value={area2}
          onChange={(e) => setArea2(e.target.value)}
        />
        <div style={{ fontSize: 12, color: "#64748b" }}>
          Leave blank to compare with a <b>random contrasting area</b>.
        </div>
      </div>

      {loading && <div className="cmp-note">Analyzing…</div>}
      {err && <div className="cmp-err">{err}</div>}

      {/* Table */}
      <div className="cmp-table">
        <div className="cmp-row cmp-head">
          <div className="cmp-cell">Criteria</div>
          <div className="cmp-cell">{d.area1}</div>
          <div className="cmp-cell">{d.area2}</div>
        </div>

        {(d.rows || []).map((r, i) => (
          <div className={`cmp-row ${i % 2 ? "alt" : ""}`} key={i}>
            <div className="cmp-cell">{r.label}</div>
            <div className="cmp-cell" style={{ whiteSpace: "pre-wrap" }}>{r.area1}</div>
            <div className="cmp-cell" style={{ whiteSpace: "pre-wrap" }}>{r.area2}</div>
          </div>
        ))}

        <div className="cmp-row alt">
          <div className="cmp-cell">Overall Score</div>
          <div className="cmp-cell"><span className="star">★</span> {d.overall?.area1 ?? 0}</div>
          <div className="cmp-cell"><span className="star">★</span> {d.overall?.area2 ?? 0}</div>
        </div>

        <div className="cmp-row">
          <div className="cmp-cell">Vibe</div>
          <div className="cmp-cell">{d.vibe?.area1 || "—"}</div>
          <div className="cmp-cell">{d.vibe?.area2 || "—"}</div>
        </div>
      </div>

      {/* Recommendation */}
      <div className="cmp-reco">
        <div className="cmp-reco-head">✅ Recommendation:</div>
        <div className="cmp-reco-name">{d.recommendation?.name || area1}</div>
        <p className="cmp-reco-text">{d.recommendation?.rationale || ""}</p>
        <div className="cmp-tags">
          {(d.recommendation?.tags || []).map((t, i) => (
            <span key={i} className="cmp-tag">{t}</span>
          ))}
        </div>
      </div>
    </div>
  );
}




/*
// src/pages/CompareAreas.jsx
import React, { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import "./CompareAreas.css";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:5050"; // <-- ensures it hits Node API

export default function CompareAreas() {
  const navigate = useNavigate();
  const { slug } = useParams();
  const { state } = useLocation();

  const area1 = state?.item?.title || (slug ? slug.replace(/-/g, " ") : "Santa Monica");
  const city  = state?.city || "Los Angeles";

  const [area2, setArea2] = useState(""); // leave empty to let server pick a random contrasting area
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    let ignore = false;

    async function run() {
      try {
        setLoading(true);
        setErr("");

        const body = {
          city,
          area1Name: area1,
          // IMPORTANT: if area2 is blank, we omit it so the server chooses a random/contrasting area
          ...(area2.trim() ? { area2Name: area2.trim() } : {})
        };

        const res = await fetch(`${API_BASE}/api/areas/compare`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(body),
        });

        // If the server returned HTML (like an index.html), show a clearer error
        const text = await res.text();
        let json;
        try {
          json = JSON.parse(text);
        } catch {
          throw new Error(
            "Could not parse response from API. Check API URL / proxy. " +
            "Response starts with: " + text.slice(0, 60)
          );
        }

        if (!res.ok) throw new Error(json?.error || "compare failed");
        if (!ignore) setData(json);
      } catch (e) {
        console.error(e);
        if (!ignore) {
          setErr(String(e.message || e));
          setData(null);
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    run();
    return () => { ignore = true; };
  }, [area1, city, area2]);

  const d = data || {
    title: "Comparison Analysis",
    area1: area1,
    area2: area2 || "Area 2",
    rows: [],
    overall: { area1: 0, area2: 0 },
    recommendation: { name: area1, rationale: "", tags: [] },
    vibe: {}
  };

  return (
    <div className="cmp-wrap">
    
      <div className="cmp-topbar">
        <button className="cmp-icon" onClick={() => navigate(-1)} aria-label="Back">←</button>
        <div className="cmp-title">Comparison Analysis</div>
        <div className="cmp-chat">💬</div>
      </div>

    
      <div className="cmp-picker">
        <label>
          Compare <b>{area1}</b> with:
        </label>
        <input
          className="cmp-input"
          placeholder="(optional) type another area"
          value={area2}
          onChange={(e) => setArea2(e.target.value)}
        />
        <div style={{ fontSize: 12, color: "#64748b" }}>
          Leave blank to compare with a <b>random contrasting area</b>.
        </div>
      </div>

      {loading && <div className="cmp-note">Analyzing…</div>}
      {err && <div className="cmp-err">{err}</div>}

     
      <div className="cmp-table">
        <div className="cmp-row cmp-head">
          <div className="cmp-cell">Criteria</div>
          <div className="cmp-cell">{d.area1}</div>
          <div className="cmp-cell">{d.area2}</div>
        </div>

        {(d.rows || []).map((r, i) => (
          <div className={`cmp-row ${i % 2 ? "alt" : ""}`} key={i}>
            <div className="cmp-cell">{r.label}</div>
            <div className="cmp-cell" style={{ whiteSpace: "pre-wrap" }}>{r.area1}</div>
            <div className="cmp-cell" style={{ whiteSpace: "pre-wrap" }}>{r.area2}</div>
          </div>
        ))}

        <div className="cmp-row alt">
          <div className="cmp-cell">Overall Score</div>
          <div className="cmp-cell"><span className="star">★</span> {d.overall?.area1 ?? 0}</div>
          <div className="cmp-cell"><span className="star">★</span> {d.overall?.area2 ?? 0}</div>
        </div>

        <div className="cmp-row">
          <div className="cmp-cell">Vibe</div>
          <div className="cmp-cell">{d.vibe?.area1 || "—"}</div>
          <div className="cmp-cell">{d.vibe?.area2 || "—"}</div>
        </div>
      </div>

     
      <div className="cmp-reco">
        <div className="cmp-reco-head">✅ Recommendation:</div>
        <div className="cmp-reco-name">{d.recommendation?.name || area1}</div>
        <p className="cmp-reco-text">{d.recommendation?.rationale || ""}</p>
        <div className="cmp-tags">
          {(d.recommendation?.tags || []).map((t, i) => (
            <span key={i} className="cmp-tag">{t}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
*/