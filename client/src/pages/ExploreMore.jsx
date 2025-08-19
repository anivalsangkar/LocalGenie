// src/pages/ExploreMore.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import ResultCard from "../components/ResultCard";
import "./ExploreMore.css";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:5050";
const UNSPLASH_KEY = process.env.REACT_APP_UNSPLASH_KEY || "";

// simple debounce
function useDebounced(value, delay = 400) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

const CATS = ["Groceries", "Food & Drinks", "Schools", "Parks", "Activities"];

/** 🔎 Fetch a landscape Unsplash image for a query, with localStorage cache */
async function fetchUnsplashImage(query) {
  const key = `uns:${query}`;
  const cached = localStorage.getItem(key);
  if (cached) {
    try {
      const url = JSON.parse(cached);
      if (url) return url;
    } catch {}
  }
  if (!UNSPLASH_KEY) return ""; // no key → skip

  try {
    const url =
      "https://api.unsplash.com/search/photos?" +
      new URLSearchParams({
        query,
        per_page: "1",
        orientation: "landscape",
        content_filter: "high",
        client_id: UNSPLASH_KEY,
      }).toString();

    const res = await fetch(url);
    if (!res.ok) throw new Error("unsplash error");
    const json = await res.json();
    const img =
      json?.results?.[0]?.urls?.regular ||
      json?.results?.[0]?.urls?.full ||
      json?.results?.[0]?.urls?.small ||
      "";
    if (img) localStorage.setItem(key, JSON.stringify(img));
    return img || "";
  } catch {
    return "";
  }
}

export default function ExploreMore() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { slug } = useParams();

  // derive area + city from where we came from
  const areaTitle =
    state?.item?.title ||
    state?.item?.name ||
    (slug ? slug.replace(/-/g, " ").replace(/\b\w/g, (m) => m.toUpperCase()) : "Area");

  const city =
    state?.city ||
    state?.item?.city ||
    state?.location ||
    state?.place ||
    state?.query ||
    "Los Angeles";

  // Fallback image (in case Unsplash fails)
  const heroImage =
    state?.heroImage ||
    state?.image ||
    state?.item?.image ||
    localStorage.getItem("lastHeroImage") ||
    "";

  useEffect(() => {
    if (heroImage) localStorage.setItem("lastHeroImage", heroImage);
  }, [heroImage]);

  // ui state
  const [category, setCategory] = useState(CATS[0]);
  const [q, setQ] = useState("");
  const dq = useDebounced(q, 350);

  // data state
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // build a stable cache key
  const cacheKey = useMemo(
    () => `poi:${areaTitle}|${city}|${category}|${dq}`,
    [areaTitle, city, category, dq]
  );

  useEffect(() => {
    let ignore = false;

    async function fetchPOI() {
      try {
        setLoading(true);
        setErr("");

        // 1) Get POIs (from local cache or API)
        const cached = localStorage.getItem(cacheKey);
        let baseItems;
        if (cached) {
          const parsed = JSON.parse(cached);
          baseItems = parsed.items || [];
        } else {
          const res = await fetch(`${API_BASE}/api/areas/poi`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({
              name: areaTitle,
              city,
              state: "CA",
              category,
              query: dq,
              limit: 12,
            }),
          });

          const text = await res.text();
          let json;
          try {
            json = JSON.parse(text);
          } catch {
            throw new Error(
              "Could not parse API response. Check API base URL / proxy. " +
                "Response starts with: " + text.slice(0, 60)
            );
          }

          if (!res.ok) throw new Error(json?.error || "poi fetch failed");
          localStorage.setItem(cacheKey, JSON.stringify(json));
          baseItems = json.items || [];
        }

        // 2) For each POI, fetch a relevant Unsplash image (with caching)
        const enriched = await Promise.all(
          (baseItems || []).map(async (it) => {
            const query = `${areaTitle} ${city} ${it.title}`; // e.g., "Lincoln Park Chicago Trader Joe's"
            const img = await fetchUnsplashImage(query);
            return {
              ...it,
              image: img || heroImage || "", // fallback to hero if Unsplash yields nothing
            };
          })
        );

        if (!ignore) setItems(enriched);
      } catch (e) {
        console.error(e);
        if (!ignore) {
          setErr(String(e.message || e));
          setItems([]);
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    fetchPOI();
    return () => {
      ignore = true;
    };
  }, [API_BASE, cacheKey, areaTitle, city, heroImage]);

  return (
    <div className="ex-wrap">
      <div className="ex-topbar">
        <button className="ex-icon" onClick={() => navigate(-1)} aria-label="Back">←</button>
        <div className="ex-clock">9:41</div>
        <div className="ex-icons">◧ ● ◌</div>
      </div>

      <div className="ex-head">
        <div className="ex-title">explore more</div>
        <div className="ex-bubble">💬</div>
      </div>

      <div className="ex-search">
        <input
          className="ex-input"
          placeholder="Type"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button className="ex-mic" title="Voice">🎤</button>
      </div>

      <div className="ex-pills">
        {CATS.map((c) => (
          <button
            key={c}
            className={`ex-pill ${category === c ? "active" : ""}`}
            onClick={() => setCategory(c)}
          >
            {c}
          </button>
        ))}
      </div>

      {err && <div className="ex-err">{err}</div>}

      {loading ? (
        <div className="ex-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="ex-skel"
              style={{ height: 260, borderRadius: 14, animation: "pulse 1.5s ease-in-out infinite" }}
            />
          ))}
        </div>
      ) : items.length ? (
        <div className="ex-grid">
          {items.map((it, idx) => (
            <ResultCard
            fullWidth   // 👈 makes the card fill the grid column (no right gap)
            item={{
              title: it.title,
              rating: it.rating ?? 5.0,
              reviews: it.reviews ?? "",
              subtitle: it.subtitle,
              image: it.image,
              ctaUrl: "",
            }}
          />
          
          ))}
        </div>
      ) : (
        <div className="ex-empty">No results. Try a different search.</div>
      )}

      <style>{`
        .ex-wrap { padding: 16px; }
        .ex-topbar { display:flex; align-items:center; justify-content:space-between; }
        .ex-icon { background:none; border:none; font-size:20px; }
        .ex-head { display:flex; align-items:center; justify-content:space-between; margin-top:8px; }
        .ex-title { font-size:24px; font-weight:700; color:#374151; text-transform:lowercase; }
        .ex-bubble { background:#eef2ff; border-radius:12px; padding:6px 10px; }
        .ex-search { display:flex; gap:8px; margin-top:12px; }
        .ex-input { flex:1; padding:12px 14px; border:1px solid #e5e7eb; border-radius:12px; font-size:16px; }
        .ex-mic { border:none; background:#f3f4f6; border-radius:12px; padding:0 12px; font-size:18px; }
        .ex-pills { display:flex; gap:12px; overflow:auto; padding:12px 2px; }
        .ex-pill { padding:12px 18px; border-radius:18px; border:1px solid #e5e7eb; background:#fff; font-weight:600; }
        .ex-pill.active { background:#1d4ed8; color:#fff; border-color:#1d4ed8; }
        .ex-grid { display:grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap:16px; margin-top:8px; }
        .ex-empty { padding:40px 8px; text-align:center; color:#94a3b8; }
        .ex-err { margin:8px 0; color:#b91c1c; font-size:14px; }
        .ex-skel { background:#e5e7eb; }
        @keyframes pulse { 0%{opacity:1} 50%{opacity:.55} 100%{opacity:1} }
      `}</style>
    </div>
  );
}




/*
// src/pages/ExploreMore.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import ResultCard from "../components/ResultCard";
import "./ExploreMore.css";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:5050";

// simple debounce
function useDebounced(value, delay = 400) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

const CATS = ["Groceries", "Food & Drinks", "Schools", "Parks", "Activities"];

export default function ExploreMore() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { slug } = useParams();

  // derive area + city from where we came from
  const areaTitle =
    state?.item?.title ||
    state?.item?.name ||
    (slug ? slug.replace(/-/g, " ").replace(/\b\w/g, (m) => m.toUpperCase()) : "Area");

  // pull city from multiple possible keys from previous page
  const city =
    state?.city ||
    state?.item?.city ||
    state?.location ||
    state?.place ||
    state?.query ||
    "Los Angeles";

  // ✅ get the same hero image as first page / details, with a robust fallback
  const heroImage =
    state?.heroImage ||
    state?.image ||
    state?.item?.image ||
    localStorage.getItem("lastHeroImage") ||
    "";

  // ✅ persist so refreshes still show the same image
  useEffect(() => {
    if (heroImage) localStorage.setItem("lastHeroImage", heroImage);
  }, [heroImage]);

  // ui state
  const [category, setCategory] = useState(CATS[0]);
  const [q, setQ] = useState("");
  const dq = useDebounced(q, 350);

  // data state
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // build a stable cache key
  const cacheKey = useMemo(
    () => `poi:${areaTitle}|${city}|${category}|${dq}`,
    [areaTitle, city, category, dq]
  );

  useEffect(() => {
    let ignore = false;

    async function fetchPOI() {
      try {
        setLoading(true);
        setErr("");

        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (!ignore) setItems(parsed.items || []);
          return;
        }

        const res = await fetch(`${API_BASE}/api/areas/poi`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            name: areaTitle,
            city,
            state: "CA",
            category,
            query: dq,
            limit: 12,
          }),
        });

        const text = await res.text();
        let json;
        try {
          json = JSON.parse(text);
        } catch {
          throw new Error(
            "Could not parse API response. Check API base URL / proxy. " +
              "Response starts with: " + text.slice(0, 60)
          );
        }

        if (!res.ok) throw new Error(json?.error || "poi fetch failed");

        localStorage.setItem(cacheKey, JSON.stringify(json));
        if (!ignore) setItems(json.items || []);
      } catch (e) {
        console.error(e);
        if (!ignore) {
          setErr(String(e.message || e));
          setItems([]);
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    fetchPOI();
    return () => {
      ignore = true;
    };
  }, [API_BASE, cacheKey]); // cacheKey captures areaTitle, city, category, dq

  return (
    <div className="ex-wrap">
      <div className="ex-topbar">
        <button className="ex-icon" onClick={() => navigate(-1)} aria-label="Back">←</button>
        <div className="ex-clock">9:41</div>
        <div className="ex-icons">◧ ● ◌</div>
      </div>

      <div className="ex-head">
        <div className="ex-title">explore more</div>
        <div className="ex-bubble">💬</div>
      </div>

      <div className="ex-search">
        <input
          className="ex-input"
          placeholder="Type"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button className="ex-mic" title="Voice">🎤</button>
      </div>

      <div className="ex-pills">
        {CATS.map((c) => (
          <button
            key={c}
            className={`ex-pill ${category === c ? "active" : ""}`}
            onClick={() => setCategory(c)}
          >
            {c}
          </button>
        ))}
      </div>

      {err && <div className="ex-err">{err}</div>}

      {loading ? (
        <div className="ex-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="ex-skel"
              style={{ height: 260, borderRadius: 14, animation: "pulse 1.5s ease-in-out infinite" }}
            />
          ))}
        </div>
      ) : items.length ? (
        <div className="ex-grid">
          {items.map((it, idx) => (
            <ResultCard
              key={`${it.title}-${idx}`}
              item={{
                title: it.title,
                rating: it.rating ?? 5.0,
                reviews: it.reviews ?? "",
                subtitle: it.subtitle,
                // ✅ force the same image for ALL cards on this page
                image: heroImage,
                ctaUrl: "",
              }}
            />
          ))}
        </div>
      ) : (
        <div className="ex-empty">No results. Try a different search.</div>
      )}

      <style>{`
        .ex-wrap { padding: 16px; }
        .ex-topbar { display:flex; align-items:center; justify-content:space-between; }
        .ex-icon { background:none; border:none; font-size:20px; }
        .ex-head { display:flex; align-items:center; justify-content:space-between; margin-top:8px; }
        .ex-title { font-size:24px; font-weight:700; color:#374151; text-transform:lowercase; }
        .ex-bubble { background:#eef2ff; border-radius:12px; padding:6px 10px; }
        .ex-search { display:flex; gap:8px; margin-top:12px; }
        .ex-input { flex:1; padding:12px 14px; border:1px solid #e5e7eb; border-radius:12px; font-size:16px; }
        .ex-mic { border:none; background:#f3f4f6; border-radius:12px; padding:0 12px; font-size:18px; }
        .ex-pills { display:flex; gap:12px; overflow:auto; padding:12px 2px; }
        .ex-pill { padding:12px 18px; border-radius:18px; border:1px solid #e5e7eb; background:#fff; font-weight:600; }
        .ex-pill.active { background:#1d4ed8; color:#fff; border-color:#1d4ed8; }
        .ex-grid { display:grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap:16px; margin-top:8px; }
        .ex-empty { padding:40px 8px; text-align:center; color:#94a3b8; }
        .ex-err { margin:8px 0; color:#b91c1c; font-size:14px; }
        .ex-skel { background:#e5e7eb; }
        @keyframes pulse { 0%{opacity:1} 50%{opacity:.55} 100%{opacity:1} }
      `}</style>
    </div>
  );
}
*/



/*
// src/pages/ExploreMore.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import ResultCard from "../components/ResultCard";
import "./ExploreMore.css";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:5050";

// simple debounce
function useDebounced(value, delay = 400) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

const CATS = ["Groceries", "Food & Drinks", "Schools", "Parks", "Activities"];

export default function ExploreMore() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { slug } = useParams();

  // derive area + city from where we came from
  const areaTitle =
    state?.item?.title ||
    state?.item?.name ||
    (slug ? slug.replace(/-/g, " ").replace(/\b\w/g, (m) => m.toUpperCase()) : "Area");

  // ⬅️ changed: pull city from multiple possible keys from previous page
  const city =
    state?.city ||
    state?.item?.city ||
    state?.location ||
    state?.place ||
    state?.query ||
    "Los Angeles";

  // ui state
  const [category, setCategory] = useState(CATS[0]);
  const [q, setQ] = useState("");
  const dq = useDebounced(q, 350);

  // data state
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // build a stable cache key
  const cacheKey = useMemo(
    () => `poi:${areaTitle}|${city}|${category}|${dq}`,
    [areaTitle, city, category, dq]
  );

  useEffect(() => {
    let ignore = false;

    async function fetchPOI() {
      try {
        setLoading(true);
        setErr("");

        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (!ignore) setItems(parsed.items || []);
          return;
        }

        const res = await fetch(`${API_BASE}/api/areas/poi`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            name: areaTitle,
            city,
            state: "CA",
            category,
            query: dq,
            limit: 12,
          }),
        });

        const text = await res.text();
        let json;
        try {
          json = JSON.parse(text);
        } catch {
          throw new Error(
            "Could not parse API response. Check API base URL / proxy. " +
              "Response starts with: " + text.slice(0, 60)
          );
        }

        if (!res.ok) throw new Error(json?.error || "poi fetch failed");

        localStorage.setItem(cacheKey, JSON.stringify(json));
        if (!ignore) setItems(json.items || []);
      } catch (e) {
        console.error(e);
        if (!ignore) {
          setErr(String(e.message || e));
          setItems([]);
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    fetchPOI();
    return () => {
      ignore = true;
    };
  }, [API_BASE, cacheKey]); // cacheKey captures areaTitle, city, category, dq

  return (
    <div className="ex-wrap">
     
      <div className="ex-topbar">
        <button className="ex-icon" onClick={() => navigate(-1)} aria-label="Back">←</button>
        <div className="ex-clock">9:41</div>
        <div className="ex-icons">◧ ● ◌</div>
      </div>

      <div className="ex-head">
        <div className="ex-title">explore more</div>
        <div className="ex-bubble">💬</div>
      </div>

     
      <div className="ex-search">
        <input
          className="ex-input"
          placeholder="Type"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button className="ex-mic" title="Voice">🎤</button>
      </div>

     
      <div className="ex-pills">
        {CATS.map((c) => (
          <button
            key={c}
            className={`ex-pill ${category === c ? "active" : ""}`}
            onClick={() => setCategory(c)}
          >
            {c}
          </button>
        ))}
      </div>

   
      {err && (
        <div className="ex-err">
          {err}
        </div>
      )}

    
      {loading ? (
        <div className="ex-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="ex-skel"
              style={{ height: 260, borderRadius: 14, animation: "pulse 1.5s ease-in-out infinite" }}
            />
          ))}
        </div>
      ) : items.length ? (
        <div className="ex-grid">
          {items.map((it, idx) => (
            <ResultCard
              key={`${it.title}-${idx}`}
              item={{
                title: it.title,
                rating: it.rating ?? 5.0,
                reviews: it.reviews ?? "",
                subtitle: it.subtitle,
                // ⬅️ changed: fall back to hero image sent from AreaDetails
                image: it.image || state?.heroImage || "",
                ctaUrl: "",
              }}
            />
          ))}
        </div>
      ) : (
        <div className="ex-empty">No results. Try a different search.</div>
      )}

      <style>{`
        .ex-wrap { padding: 16px; }
        .ex-topbar { display:flex; align-items:center; justify-content:space-between; }
        .ex-icon { background:none; border:none; font-size:20px; }
        .ex-head { display:flex; align-items:center; justify-content:space-between; margin-top:8px; }
        .ex-title { font-size:24px; font-weight:700; color:#374151; text-transform:lowercase; }
        .ex-bubble { background:#eef2ff; border-radius:12px; padding:6px 10px; }
        .ex-search { display:flex; gap:8px; margin-top:12px; }
        .ex-input { flex:1; padding:12px 14px; border:1px solid #e5e7eb; border-radius:12px; font-size:16px; }
        .ex-mic { border:none; background:#f3f4f6; border-radius:12px; padding:0 12px; font-size:18px; }
        .ex-pills { display:flex; gap:12px; overflow:auto; padding:12px 2px; }
        .ex-pill { padding:12px 18px; border-radius:18px; border:1px solid #e5e7eb; background:#fff; font-weight:600; }
        .ex-pill.active { background:#1d4ed8; color:#fff; border-color:#1d4ed8; }
        .ex-grid { display:grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap:16px; margin-top:8px; }
        .ex-empty { padding:40px 8px; text-align:center; color:#94a3b8; }
        .ex-err { margin:8px 0; color:#b91c1c; font-size:14px; }
        .ex-skel { background:#e5e7eb; }
        @keyframes pulse { 0%{opacity:1} 50%{opacity:.55} 100%{opacity:1} }
      `}</style>
    </div>
  );
}
*/


/*
// src/pages/ExploreMore.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import ResultCard from "../components/ResultCard";
import "./ExploreMore.css";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:5050";

// simple debounce
function useDebounced(value, delay = 400) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

const CATS = ["Groceries", "Food & Drinks", "Schools", "Parks", "Activities"];

export default function ExploreMore() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { slug } = useParams();

  // derive area + city from where we came from
  const areaTitle =
    state?.item?.title ||
    state?.item?.name ||
    (slug ? slug.replace(/-/g, " ").replace(/\b\w/g, (m) => m.toUpperCase()) : "Area");

  const city = state?.city || "Los Angeles";

  // ui state
  const [category, setCategory] = useState(CATS[0]);
  const [q, setQ] = useState("");
  const dq = useDebounced(q, 350);

  // data state
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // build a stable cache key
  const cacheKey = useMemo(
    () => `poi:${areaTitle}|${city}|${category}|${dq}`,
    [areaTitle, city, category, dq]
  );

  useEffect(() => {
    let ignore = false;

    async function fetchPOI() {
      try {
        setLoading(true);
        setErr("");

        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (!ignore) setItems(parsed.items || []);
          return;
        }

        const res = await fetch(`${API_BASE}/api/areas/poi`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            name: areaTitle,
            city,
            state: "CA",
            category,
            query: dq,
            limit: 12,
          }),
        });

        const text = await res.text();
        let json;
        try {
          json = JSON.parse(text);
        } catch {
          throw new Error(
            "Could not parse API response. Check API base URL / proxy. " +
              "Response starts with: " + text.slice(0, 60)
          );
        }

        if (!res.ok) throw new Error(json?.error || "poi fetch failed");

        localStorage.setItem(cacheKey, JSON.stringify(json));
        if (!ignore) setItems(json.items || []);
      } catch (e) {
        console.error(e);
        if (!ignore) {
          setErr(String(e.message || e));
          setItems([]);
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    fetchPOI();
    return () => {
      ignore = true;
    };
  }, [API_BASE, cacheKey]); // cacheKey captures areaTitle, city, category, dq

  return (
    <div className="ex-wrap">
     
      <div className="ex-topbar">
        <button className="ex-icon" onClick={() => navigate(-1)} aria-label="Back">←</button>
        <div className="ex-clock">9:41</div>
        <div className="ex-icons">◧ ● ◌</div>
      </div>

      <div className="ex-head">
        <div className="ex-title">explore more</div>
        <div className="ex-bubble">💬</div>
      </div>

     
      <div className="ex-search">
        <input
          className="ex-input"
          placeholder="Type"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button className="ex-mic" title="Voice">🎤</button>
      </div>

     
      <div className="ex-pills">
        {CATS.map((c) => (
          <button
            key={c}
            className={`ex-pill ${category === c ? "active" : ""}`}
            onClick={() => setCategory(c)}
          >
            {c}
          </button>
        ))}
      </div>

   
      {err && (
        <div className="ex-err">
          {err}
        </div>
      )}

    
      {loading ? (
        <div className="ex-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="ex-skel"
              style={{ height: 260, borderRadius: 14, animation: "pulse 1.5s ease-in-out infinite" }}
            />
          ))}
        </div>
      ) : items.length ? (
        <div className="ex-grid">
          {items.map((it, idx) => (
            <ResultCard
              key={`${it.title}-${idx}`}
              item={{
                title: it.title,
                rating: it.rating ?? 5.0,
                reviews: it.reviews ?? "",
                subtitle: it.subtitle,
                image: it.image,
                ctaUrl: "", // optional external link; left blank
              }}
            />
          ))}
        </div>
      ) : (
        <div className="ex-empty">No results. Try a different search.</div>
      )}

      <style>{`
        .ex-wrap { padding: 16px; }
        .ex-topbar { display:flex; align-items:center; justify-content:space-between; }
        .ex-icon { background:none; border:none; font-size:20px; }
        .ex-head { display:flex; align-items:center; justify-content:space-between; margin-top:8px; }
        .ex-title { font-size:24px; font-weight:700; color:#374151; text-transform:lowercase; }
        .ex-bubble { background:#eef2ff; border-radius:12px; padding:6px 10px; }
        .ex-search { display:flex; gap:8px; margin-top:12px; }
        .ex-input { flex:1; padding:12px 14px; border:1px solid #e5e7eb; border-radius:12px; font-size:16px; }
        .ex-mic { border:none; background:#f3f4f6; border-radius:12px; padding:0 12px; font-size:18px; }
        .ex-pills { display:flex; gap:12px; overflow:auto; padding:12px 2px; }
        .ex-pill { padding:12px 18px; border-radius:18px; border:1px solid #e5e7eb; background:#fff; font-weight:600; }
        .ex-pill.active { background:#1d4ed8; color:#fff; border-color:#1d4ed8; }
        .ex-grid { display:grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap:16px; margin-top:8px; }
        .ex-empty { padding:40px 8px; text-align:center; color:#94a3b8; }
        .ex-err { margin:8px 0; color:#b91c1c; font-size:14px; }
        .ex-skel { background:#e5e7eb; }
        @keyframes pulse { 0%{opacity:1} 50%{opacity:.55} 100%{opacity:1} }
      `}</style>
    </div>
  );
}
*/



/*
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import "./ExploreMore.css";

const CATEGORIES = ["Groceries", "Food & Drinks", "Schools", "Parks", "Activities"];

export default function ExploreMore() {
  const navigate = useNavigate();
  const { slug } = useParams();
  const { state } = useLocation();
  const area = state?.item || {};
  const areaName = area?.title || "Santa Monica";
  const city = state?.city || "Los Angeles";

  const [active, setActive] = useState(CATEGORIES[0]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);

  // fetch from backend (GPT; historic knowledge only)
  const fetchCategory = useCallback(async (category, q = "") => {
    setLoading(true);
    try {
      // simple cache per slug+category+query to avoid repeat calls
      const key = `poi:${slug}:${category}:${q.trim().toLowerCase()}`;
      const cached = sessionStorage.getItem(key);
      if (cached) {
        setItems(JSON.parse(cached));
        setLoading(false);
        return;
      }

      const res = await fetch("/api/areas/poi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: areaName, city, state: "CA",
          category, query: q, limit: 12
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "fetch failed");
      sessionStorage.setItem(key, JSON.stringify(data.items || []));
      setItems(data.items || []);
    } catch (e) {
      console.error(e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [areaName, city, slug]);

  useEffect(() => { fetchCategory(active, ""); }, [active, fetchCategory]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(x =>
      x.title.toLowerCase().includes(q) ||
      (x.subtitle || "").toLowerCase().includes(q)
    );
  }, [items, query]);

  return (
    <div className="ex-wrap">
      
      <div className="ex-topbar">
        <button className="ex-icon" onClick={() => navigate(-1)} aria-label="Back">←</button>
        <div className="ex-status">9:41</div>
        <div className="ex-sys">◧ ● ◌</div>
      </div>

      <div className="ex-header">
        <h1 className="ex-title">explore more</h1>
        <div className="ex-bubble">💬</div>
      </div>

     
      <div className="ex-search">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type"
        />
        <button className="ex-mic" title="voice">🎤</button>
      </div>

      
      <div className="ex-tabs">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            className={`ex-tab ${active === cat ? "active" : ""}`}
            onClick={() => setActive(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

    
      <div className="ex-grid">
        {loading && <div className="ex-loading">Finding {active.toLowerCase()}…</div>}
        {!loading && filtered.map((x, i) => (
          <Card key={`${x.title}-${i}`} item={x} />
        ))}
        {!loading && filtered.length === 0 && (
          <div className="ex-empty">No results. Try a different search.</div>
        )}
      </div>
    </div>
  );
}

function Card({ item }) {
  const {
    title = "Downtown",
    subtitle = "Vibrant city center with nightlife…",
    rating = 5.0,
    image = "https://images.unsplash.com/photo-1467269204594-9661b134dd2b?q=80&w=1200&auto=format&fit=crop",
  } = item || {};
  return (
    <div className="ex-card">
      <div className="ex-imgwrap">
        <img src={image} alt={title} />
        <button className="ex-heart" aria-label="save">♡</button>
      </div>
      <div className="ex-card-body">
        <div className="ex-card-title">{title}</div>
        <div className="ex-card-sub">{subtitle}</div>
        <div className="ex-card-row">
          <span className="ex-rate">{Number(rating).toFixed(1)}</span>
          <span className="ex-star">★</span>
        </div>
      </div>
    </div>
  );
}
*/