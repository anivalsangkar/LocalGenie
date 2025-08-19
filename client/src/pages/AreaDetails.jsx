// src/pages/AreaDetails.jsx
import React, { useEffect, useState, useMemo } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import "./AreaDetails.css";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:5050";

export default function AreaDetails() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { slug } = useParams();

  // Helper: Title from slug if nothing else provided
  const fallbackTitle = slug
    ? slug.replace(/-/g, " ").replace(/\b\w/g, (m) => m.toUpperCase())
    : "Area";

  // Normalized inputs coming from anywhere in state
  const navItem = state?.item || {};
  const areaTitle = navItem.title || navItem.name || fallbackTitle;

  // ✅ Pick the hero image that came from the card (with a localStorage fallback)
  const incomingHeroImage =
    state?.image ||
    state?.heroImage ||
    navItem?.image ||
    localStorage.getItem("lastHeroImage") ||
    null;

  // Try to find city/region from many possible keys
  const rawCity =
    state?.city ||
    navItem.city ||
    state?.location ||
    state?.place ||
    state?.query ||
    "";

  let region =
    state?.region ||
    state?.state ||
    navItem.region ||
    navItem.state ||
    "";

  let city = rawCity || "";

  // If user typed "Chicago, Illinois" split it
  if (!region && typeof rawCity === "string" && rawCity.includes(",")) {
    const [c, r] = rawCity.split(",").map((s) => s.trim());
    if (c) city = c;
    if (r) region = r;
  }

  const tagsFromNav = Array.isArray(navItem.tags) ? navItem.tags : [];

  // Enriched payload only (no base placeholder)
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let ignore = false;

    (async () => {
      try {
        setLoading(true);
        setErr("");

        // City/region can be empty; they simply steer the LLM
        const cacheKey = `area:${slug}|${areaTitle}|${city}|${region}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);

          // ✅ Ensure the incoming hero image is the first image even for cached data
          if (incomingHeroImage) {
            parsed.heroImages = Array.isArray(parsed.heroImages) ? parsed.heroImages.slice() : [];
            const alreadyFirst = parsed.heroImages[0] === incomingHeroImage;
            const existsSomewhere = parsed.heroImages.includes(incomingHeroImage);
            if (!alreadyFirst) {
              if (existsSomewhere) {
                parsed.heroImages = [incomingHeroImage, ...parsed.heroImages.filter((u) => u !== incomingHeroImage)];
              } else {
                parsed.heroImages = [incomingHeroImage, ...parsed.heroImages];
              }
            }
          }

          if (!ignore) setData(parsed);
          return;
        }

        const res = await fetch(`${API_BASE}/api/areas/enrich`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            name: areaTitle,
            city: city || undefined,
            state: region || undefined,
            tags: tagsFromNav,
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
        if (!res.ok) throw new Error(json?.error || "Failed to enrich area");

        // Guardrails / fill-ins
        json.title ||= areaTitle;
        json.description ||= `${areaTitle} overview.`;
        json.tags = Array.isArray(json.tags) && json.tags.length ? json.tags : tagsFromNav;
        if (!Array.isArray(json.heroImages) || json.heroImages.length === 0) {
          json.heroImages = [
            "https://images.unsplash.com/photo-1467269204594-9661b134dd2b?q=80&w=1800&auto=format&fit=crop",
          ];
        }

        // ✅ Put the incoming hero image first if we have one
        if (incomingHeroImage) {
          const arr = Array.isArray(json.heroImages) ? json.heroImages.slice() : [];
          const alreadyFirst = arr[0] === incomingHeroImage;
          const existsSomewhere = arr.includes(incomingHeroImage);
          json.heroImages = alreadyFirst
            ? arr
            : existsSomewhere
            ? [incomingHeroImage, ...arr.filter((u) => u !== incomingHeroImage)]
            : [incomingHeroImage, ...arr];
        }

        localStorage.setItem(cacheKey, JSON.stringify(json));
        if (!ignore) setData(json);
      } catch (e) {
        if (!ignore) setErr(String(e.message || e));
      } finally {
        if (!ignore) setLoading(false);
      }
    })();

    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, areaTitle, city, region, tagsFromNav.join("|"), incomingHeroImage]);

  const TopBar = () => (
    <div className="ad-topbar">
      <button className="ad-icon-btn" onClick={() => navigate(-1)} aria-label="Back">
        ←
      </button>
      <div className="ad-status">9:41</div>
      <div className="ad-system-icons">◧ ● ◌</div>
    </div>
  );

  if (loading) {
    return (
      <div className="ad-wrap">
        <TopBar />
        <div className="ad-hero">
          <div
            style={{
              height: 240,
              width: "100%",
              background: "#e5e7eb",
              borderRadius: 12,
              animation: "pulse 1.5s ease-in-out infinite",
            }}
          />
        </div>
        <div className="ad-body">
          <div className="ad-title-row">
            <div
              style={{
                height: 28,
                width: "60%",
                background: "#e5e7eb",
                borderRadius: 8,
                animation: "pulse 1.5s ease-in-out infinite",
              }}
            />
            <div style={{ height: 32, width: 32, background: "#eef2ff", borderRadius: 12 }} />
          </div>
          <div
            style={{
              height: 80,
              background: "#e5e7eb",
              borderRadius: 12,
              animation: "pulse 1.5s ease-in-out infinite",
            }}
          />
        </div>
        <style>{`
          @keyframes pulse { 0%{opacity:1} 50%{opacity:.55} 100%{opacity:1} }
        `}</style>
      </div>
    );
  }

  if (err || !data) {
    return (
      <div className="ad-wrap">
        <TopBar />
        <div className="ad-body">
          <h1 className="ad-title">{areaTitle}</h1>
          <div
            style={{
              padding: 12,
              border: "1px solid #fecaca",
              background: "#fff1f2",
              color: "#7f1d1d",
              borderRadius: 12,
            }}
          >
            {err || "Failed to load details."}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ad-wrap">
      <TopBar />
      <AreaDetailsView slug={slug} data={data} state={state} />
    </div>
  );
}

/* ---------- Child view ---------- */
function AreaDetailsView({ slug, data, state }) {
  const navigate = useNavigate();

  const images = data.heroImages;
  const [imgIndex, setImgIndex] = React.useState(0);
  const next = () => setImgIndex((i) => (images.length ? (i + 1) % images.length : 0));
  const prev = () => setImgIndex((i) => (images.length ? (i - 1 + images.length) % images.length : 0));

  useEffect(() => {
    if (imgIndex >= images.length) setImgIndex(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images.length]);

  const bullets = useMemo(
    () =>
      images.map((_, i) => (
        <span
          key={i}
          className={`ad-dot ${i === imgIndex ? "active" : ""}`}
          onClick={() => setImgIndex(i)}
        />
      )),
    [images, imgIndex]
  );

  return (
    <>
      <div className="ad-hero">
        <img src={images[imgIndex]} alt={data.title} />
        {images.length > 1 && (
          <>
            <button className="ad-hero-nav left" onClick={prev} aria-label="Prev">
              ‹
            </button>
            <button className="ad-hero-nav right" onClick={next} aria-label="Next">
              ›
            </button>
            <div className="ad-dots">{bullets}</div>
          </>
        )}
      </div>

      <div className="ad-body">
        <div className="ad-title-row">
          <h1 className="ad-title">{data.title}</h1>
          <button className="ad-icon-badge" title="Compare to similar areas">
            👤
          </button>
        </div>

        <p className="ad-desc">{data.description}</p>

        <div className="ad-chips">
          {(data.tags || []).map((t, i) => (
            <span className="ad-chip" key={`${t}-${i}`}>
              {t}
            </span>
          ))}
        </div>

        <SectionHeader>Safety</SectionHeader>
        <div className="ad-grid-2">
          <MetricCard label="Crime Rate" value={data.metrics?.safety?.crime ?? "—"} />
          <MetricCard label="Safety Rating" value={data.metrics?.safety?.score ?? "—"} />
        </div>

        <SectionHeader>Schools</SectionHeader>
        <div className="ad-grid-2">
          <MetricCard label="Average Rating" value={data.metrics?.schools?.avg ?? "—"} />
          <MetricCard label="Number of Schools" value={data.metrics?.schools?.count ?? "—"} />
        </div>

        <SectionHeader>Rent</SectionHeader>
        <MetricWide label="Average Rent" value={data.metrics?.rent?.avg ?? "—"} />

        <SectionHeader>Commute</SectionHeader>
        <div className="ad-grid-2">
          <MetricCard label="Downtown" value={data.metrics?.commute?.downtown ?? "—"} />
          <MetricCard label="Airport" value={data.metrics?.commute?.airport ?? "—"} />
        </div>

        <details className="ad-accordion">
          <summary>Seasonal & Event Awareness</summary>
          <div className="ad-accordion-body">
            Expect heavier traffic and higher short-term rents during major events and peak tourist seasons. Plan moves and lease starts accordingly.
          </div>
        </details>

        <div className="ad-actions">
          <button
            className="ad-btn ghost"
            onClick={() => navigate(`/areas/${slug}/compare`, { state })}
          >
            Compare Areas
          </button>
          <button
            className="ad-btn primary"
            onClick={() =>
              navigate(`/areas/${slug}/explore`, {
                // ✅ Forward the exact hero image the user is looking at now
                state: { ...state, heroImage: data.heroImages?.[imgIndex] },
              })
            }
          >
            Explore More
          </button>
        </div>
      </div>
    </>
  );
}

function SectionHeader({ children }) {
  return <h2 className="ad-section">{children}</h2>;
}
function MetricCard({ label, value }) {
  return (
    <div className="ad-card">
      <div className="ad-card-label">{label}</div>
      <div className="ad-card-value">{value}</div>
    </div>
  );
}
function MetricWide({ label, value }) {
  return (
    <div className="ad-card wide">
      <div className="ad-card-label">{label}</div>
      <div className="ad-card-value">{value}</div>
    </div>
  );
}






/*
// src/pages/AreaDetails.jsx
import React, { useEffect, useState, useMemo } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import "./AreaDetails.css";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:5050";

export default function AreaDetails() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { slug } = useParams();

  // Helper: Title from slug if nothing else provided
  const fallbackTitle = slug
    ? slug.replace(/-/g, " ").replace(/\b\w/g, (m) => m.toUpperCase())
    : "Area";

  // Normalized inputs coming from anywhere in state
  const navItem = state?.item || {};
  const areaTitle = navItem.title || navItem.name || fallbackTitle;

  // Try to find city/region from many possible keys
  const rawCity =
    state?.city ||
    navItem.city ||
    state?.location ||
    state?.place ||
    state?.query ||
    "";

  let region =
    state?.region ||
    state?.state ||
    navItem.region ||
    navItem.state ||
    "";

  let city = rawCity || "";

  // If user typed "Chicago, Illinois" split it
  if (!region && typeof rawCity === "string" && rawCity.includes(",")) {
    const [c, r] = rawCity.split(",").map((s) => s.trim());
    if (c) city = c;
    if (r) region = r;
  }

  const tagsFromNav = Array.isArray(navItem.tags) ? navItem.tags : [];

  // Enriched payload only (no base placeholder)
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let ignore = false;

    (async () => {
      try {
        setLoading(true);
        setErr("");

        // City/region can be empty; they simply steer the LLM
        const cacheKey = `area:${slug}|${areaTitle}|${city}|${region}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (!ignore) setData(parsed);
          return;
        }

        const res = await fetch(`${API_BASE}/api/areas/enrich`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            name: areaTitle,
            city: city || undefined,
            state: region || undefined,
            tags: tagsFromNav,
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
        if (!res.ok) throw new Error(json?.error || "Failed to enrich area");

        // Guardrails / fill-ins
        json.title ||= areaTitle;
        json.description ||= `${areaTitle} overview.`;
        json.tags = Array.isArray(json.tags) && json.tags.length ? json.tags : tagsFromNav;
        if (!Array.isArray(json.heroImages) || json.heroImages.length === 0) {
          json.heroImages = [
            "https://images.unsplash.com/photo-1467269204594-9661b134dd2b?q=80&w=1800&auto=format&fit=crop",
          ];
        }

        localStorage.setItem(cacheKey, JSON.stringify(json));
        if (!ignore) setData(json);
      } catch (e) {
        if (!ignore) setErr(String(e.message || e));
      } finally {
        if (!ignore) setLoading(false);
      }
    })();

    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, areaTitle, city, region, tagsFromNav.join("|")]);

  const TopBar = () => (
    <div className="ad-topbar">
      <button className="ad-icon-btn" onClick={() => navigate(-1)} aria-label="Back">
        ←
      </button>
      <div className="ad-status">9:41</div>
      <div className="ad-system-icons">◧ ● ◌</div>
    </div>
  );

  if (loading) {
    return (
      <div className="ad-wrap">
        <TopBar />
        <div className="ad-hero">
          <div
            style={{
              height: 240,
              width: "100%",
              background: "#e5e7eb",
              borderRadius: 12,
              animation: "pulse 1.5s ease-in-out infinite",
            }}
          />
        </div>
        <div className="ad-body">
          <div className="ad-title-row">
            <div
              style={{
                height: 28,
                width: "60%",
                background: "#e5e7eb",
                borderRadius: 8,
                animation: "pulse 1.5s ease-in-out infinite",
              }}
            />
            <div style={{ height: 32, width: 32, background: "#eef2ff", borderRadius: 12 }} />
          </div>
          <div
            style={{
              height: 80,
              background: "#e5e7eb",
              borderRadius: 12,
              animation: "pulse 1.5s ease-in-out infinite",
            }}
          />
        </div>
        <style>{`
          @keyframes pulse { 0%{opacity:1} 50%{opacity:.55} 100%{opacity:1} }
        `}</style>
      </div>
    );
  }

  if (err || !data) {
    return (
      <div className="ad-wrap">
        <TopBar />
        <div className="ad-body">
          <h1 className="ad-title">{areaTitle}</h1>
          <div
            style={{
              padding: 12,
              border: "1px solid #fecaca",
              background: "#fff1f2",
              color: "#7f1d1d",
              borderRadius: 12,
            }}
          >
            {err || "Failed to load details."}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ad-wrap">
      <TopBar />
      <AreaDetailsView slug={slug} data={data} state={state} />
    </div>
  );
}


function AreaDetailsView({ slug, data, state }) {
  const navigate = useNavigate();

  const images = data.heroImages;
  const [imgIndex, setImgIndex] = React.useState(0);
  const next = () => setImgIndex((i) => (images.length ? (i + 1) % images.length : 0));
  const prev = () => setImgIndex((i) => (images.length ? (i - 1 + images.length) % images.length : 0));

  useEffect(() => {
    if (imgIndex >= images.length) setImgIndex(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images.length]);

  const bullets = useMemo(
    () =>
      images.map((_, i) => (
        <span
          key={i}
          className={`ad-dot ${i === imgIndex ? "active" : ""}`}
          onClick={() => setImgIndex(i)}
        />
      )),
    [images, imgIndex]
  );

  return (
    <>
      <div className="ad-hero">
        <img src={images[imgIndex]} alt={data.title} />
        {images.length > 1 && (
          <>
            <button className="ad-hero-nav left" onClick={prev} aria-label="Prev">
              ‹
            </button>
            <button className="ad-hero-nav right" onClick={next} aria-label="Next">
              ›
            </button>
            <div className="ad-dots">{bullets}</div>
          </>
        )}
      </div>

      <div className="ad-body">
        <div className="ad-title-row">
          <h1 className="ad-title">{data.title}</h1>
          <button className="ad-icon-badge" title="Compare to similar areas">
            👤
          </button>
        </div>

        <p className="ad-desc">{data.description}</p>

        <div className="ad-chips">
          {(data.tags || []).map((t, i) => (
            <span className="ad-chip" key={`${t}-${i}`}>
              {t}
            </span>
          ))}
        </div>

        <SectionHeader>Safety</SectionHeader>
        <div className="ad-grid-2">
          <MetricCard label="Crime Rate" value={data.metrics?.safety?.crime ?? "—"} />
          <MetricCard label="Safety Rating" value={data.metrics?.safety?.score ?? "—"} />
        </div>

        <SectionHeader>Schools</SectionHeader>
        <div className="ad-grid-2">
          <MetricCard label="Average Rating" value={data.metrics?.schools?.avg ?? "—"} />
          <MetricCard label="Number of Schools" value={data.metrics?.schools?.count ?? "—"} />
        </div>

        <SectionHeader>Rent</SectionHeader>
        <MetricWide label="Average Rent" value={data.metrics?.rent?.avg ?? "—"} />

        <SectionHeader>Commute</SectionHeader>
        <div className="ad-grid-2">
          <MetricCard label="Downtown" value={data.metrics?.commute?.downtown ?? "—"} />
          <MetricCard label="Airport" value={data.metrics?.commute?.airport ?? "—"} />
        </div>

        <details className="ad-accordion">
          <summary>Seasonal & Event Awareness</summary>
          <div className="ad-accordion-body">
            Expect heavier traffic and higher short-term rents during major events and peak tourist seasons. Plan moves and lease starts accordingly.
          </div>
        </details>

        <div className="ad-actions">
          <button
            className="ad-btn ghost"
            onClick={() => navigate(`/areas/${slug}/compare`, { state })}
          >
            Compare Areas
          </button>
          <button
            className="ad-btn primary"
            onClick={() =>
              navigate(`/areas/${slug}/explore`, {
                state: { ...state, heroImage: data.heroImages?.[0] },
              })
            }
          >
            Explore More
          </button>
        </div>
      </div>
    </>
  );
}

function SectionHeader({ children }) {
  return <h2 className="ad-section">{children}</h2>;
}
function MetricCard({ label, value }) {
  return (
    <div className="ad-card">
      <div className="ad-card-label">{label}</div>
      <div className="ad-card-value">{value}</div>
    </div>
  );
}
function MetricWide({ label, value }) {
  return (
    <div className="ad-card wide">
      <div className="ad-card-label">{label}</div>
      <div className="ad-card-value">{value}</div>
    </div>
  );
}
*/


/*
// src/pages/AreaDetails.jsx
import React, { useEffect, useState, useMemo } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import "./AreaDetails.css";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:5050";

export default function AreaDetails() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { slug } = useParams();

  // Helper: Title from slug if nothing else provided
  const fallbackTitle = slug
    ? slug.replace(/-/g, " ").replace(/\b\w/g, (m) => m.toUpperCase())
    : "Area";

  // Normalized inputs coming from anywhere in state
  const navItem = state?.item || {};
  const areaTitle = navItem.title || navItem.name || fallbackTitle;

  // Try to find city/region from many possible keys
  const rawCity =
    state?.city ||
    navItem.city ||
    state?.location ||
    state?.place ||
    state?.query ||
    "";

  let region =
    state?.region ||
    state?.state ||
    navItem.region ||
    navItem.state ||
    "";

  let city = rawCity || "";

  // If user typed "Chicago, Illinois" split it
  if (!region && typeof rawCity === "string" && rawCity.includes(",")) {
    const [c, r] = rawCity.split(",").map((s) => s.trim());
    if (c) city = c;
    if (r) region = r;
  }

  const tagsFromNav = Array.isArray(navItem.tags) ? navItem.tags : [];

  // Enriched payload only (no base placeholder)
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let ignore = false;

    (async () => {
      try {
        setLoading(true);
        setErr("");

        // City/region can be empty; they simply steer the LLM
        const cacheKey = `area:${slug}|${areaTitle}|${city}|${region}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (!ignore) setData(parsed);
          return;
        }

        const res = await fetch(`${API_BASE}/api/areas/enrich`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            name: areaTitle,
            city: city || undefined,
            state: region || undefined,
            tags: tagsFromNav,
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
        if (!res.ok) throw new Error(json?.error || "Failed to enrich area");

        // Guardrails / fill-ins
        json.title ||= areaTitle;
        json.description ||= `${areaTitle} overview.`;
        json.tags = Array.isArray(json.tags) && json.tags.length ? json.tags : tagsFromNav;
        if (!Array.isArray(json.heroImages) || json.heroImages.length === 0) {
          json.heroImages = [
            "https://images.unsplash.com/photo-1467269204594-9661b134dd2b?q=80&w=1800&auto=format&fit=crop",
          ];
        }

        localStorage.setItem(cacheKey, JSON.stringify(json));
        if (!ignore) setData(json);
      } catch (e) {
        if (!ignore) setErr(String(e.message || e));
      } finally {
        if (!ignore) setLoading(false);
      }
    })();

    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, areaTitle, city, region, tagsFromNav.join("|")]);

  const TopBar = () => (
    <div className="ad-topbar">
      <button className="ad-icon-btn" onClick={() => navigate(-1)} aria-label="Back">
        ←
      </button>
      <div className="ad-status">9:41</div>
      <div className="ad-system-icons">◧ ● ◌</div>
    </div>
  );

  if (loading) {
    return (
      <div className="ad-wrap">
        <TopBar />
        <div className="ad-hero">
          <div
            style={{
              height: 240,
              width: "100%",
              background: "#e5e7eb",
              borderRadius: 12,
              animation: "pulse 1.5s ease-in-out infinite",
            }}
          />
        </div>
        <div className="ad-body">
          <div className="ad-title-row">
            <div
              style={{
                height: 28,
                width: "60%",
                background: "#e5e7eb",
                borderRadius: 8,
                animation: "pulse 1.5s ease-in-out infinite",
              }}
            />
            <div style={{ height: 32, width: 32, background: "#eef2ff", borderRadius: 12 }} />
          </div>
          <div
            style={{
              height: 80,
              background: "#e5e7eb",
              borderRadius: 12,
              animation: "pulse 1.5s ease-in-out infinite",
            }}
          />
        </div>
        <style>{`
          @keyframes pulse { 0%{opacity:1} 50%{opacity:.55} 100%{opacity:1} }
        `}</style>
      </div>
    );
  }

  if (err || !data) {
    return (
      <div className="ad-wrap">
        <TopBar />
        <div className="ad-body">
          <h1 className="ad-title">{areaTitle}</h1>
          <div
            style={{
              padding: 12,
              border: "1px solid #fecaca",
              background: "#fff1f2",
              color: "#7f1d1d",
              borderRadius: 12,
            }}
          >
            {err || "Failed to load details."}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ad-wrap">
      <TopBar />
      <AreaDetailsView slug={slug} data={data} state={state} />
    </div>
  );
}


function AreaDetailsView({ slug, data, state }) {
  const navigate = useNavigate();

  const images = data.heroImages;
  const [imgIndex, setImgIndex] = React.useState(0);
  const next = () => setImgIndex((i) => (images.length ? (i + 1) % images.length : 0));
  const prev = () => setImgIndex((i) => (images.length ? (i - 1 + images.length) % images.length : 0));

  useEffect(() => {
    if (imgIndex >= images.length) setImgIndex(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images.length]);

  const bullets = useMemo(
    () =>
      images.map((_, i) => (
        <span
          key={i}
          className={`ad-dot ${i === imgIndex ? "active" : ""}`}
          onClick={() => setImgIndex(i)}
        />
      )),
    [images, imgIndex]
  );

  return (
    <>
      <div className="ad-hero">
        <img src={images[imgIndex]} alt={data.title} />
        {images.length > 1 && (
          <>
            <button className="ad-hero-nav left" onClick={prev} aria-label="Prev">
              ‹
            </button>
            <button className="ad-hero-nav right" onClick={next} aria-label="Next">
              ›
            </button>
            <div className="ad-dots">{bullets}</div>
          </>
        )}
      </div>

      <div className="ad-body">
        <div className="ad-title-row">
          <h1 className="ad-title">{data.title}</h1>
          <button className="ad-icon-badge" title="Compare to similar areas">
            👤
          </button>
        </div>

        <p className="ad-desc">{data.description}</p>

        <div className="ad-chips">
          {(data.tags || []).map((t, i) => (
            <span className="ad-chip" key={`${t}-${i}`}>
              {t}
            </span>
          ))}
        </div>

        <SectionHeader>Safety</SectionHeader>
        <div className="ad-grid-2">
          <MetricCard label="Crime Rate" value={data.metrics?.safety?.crime ?? "—"} />
          <MetricCard label="Safety Rating" value={data.metrics?.safety?.score ?? "—"} />
        </div>

        <SectionHeader>Schools</SectionHeader>
        <div className="ad-grid-2">
          <MetricCard label="Average Rating" value={data.metrics?.schools?.avg ?? "—"} />
          <MetricCard label="Number of Schools" value={data.metrics?.schools?.count ?? "—"} />
        </div>

        <SectionHeader>Rent</SectionHeader>
        <MetricWide label="Average Rent" value={data.metrics?.rent?.avg ?? "—"} />

        <SectionHeader>Commute</SectionHeader>
        <div className="ad-grid-2">
          <MetricCard label="Downtown" value={data.metrics?.commute?.downtown ?? "—"} />
          <MetricCard label="Airport" value={data.metrics?.commute?.airport ?? "—"} />
        </div>

        <details className="ad-accordion">
          <summary>Seasonal & Event Awareness</summary>
          <div className="ad-accordion-body">
            Expect heavier traffic and higher short-term rents during major events and peak tourist seasons. Plan moves and lease starts accordingly.
          </div>
        </details>

        <div className="ad-actions">
          <button
            className="ad-btn ghost"
            onClick={() => navigate(`/areas/${slug}/compare`, { state })}
          >
            Compare Areas
          </button>
          <button
            className="ad-btn primary"
            onClick={() => navigate(`/areas/${slug}/explore`, { state })}
          >
            Explore More
          </button>
        </div>
      </div>
    </>
  );
}

function SectionHeader({ children }) {
  return <h2 className="ad-section">{children}</h2>;
}
function MetricCard({ label, value }) {
  return (
    <div className="ad-card">
      <div className="ad-card-label">{label}</div>
      <div className="ad-card-value">{value}</div>
    </div>
  );
}
function MetricWide({ label, value }) {
  return (
    <div className="ad-card wide">
      <div className="ad-card-label">{label}</div>
      <div className="ad-card-value">{value}</div>
    </div>
  );
}
*/




/*
// src/pages/AreaDetails.jsx
import React, { useEffect, useState, useMemo } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import "./AreaDetails.css";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:5050";

export default function AreaDetails() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { slug } = useParams();

  const fallbackTitle = slug
    ? slug.replace(/-/g, " ").replace(/\b\w/g, (m) => m.toUpperCase())
    : "Area";
  const areaTitle = state?.item?.title || state?.item?.name || fallbackTitle;
  const cityHint = state?.city || "Los Angeles";
  const baseTags = Array.isArray(state?.item?.tags) ? state.item.tags : [];

  const [data, setData] = useState(null);  // enriched payload only
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // Fetch enriched data first; no placeholder content
  useEffect(() => {
    let ignore = false;

    (async () => {
      try {
        setLoading(true);
        setErr("");

        const cacheKey = `area:${slug}|${areaTitle}|${cityHint}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (!ignore) setData(parsed);
          return;
        }

        const res = await fetch(`${API_BASE}/api/areas/enrich`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ name: areaTitle, city: cityHint, state: "CA", tags: baseTags }),
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
        if (!res.ok) throw new Error(json?.error || "Failed to enrich area");

        // guardrails
        json.title ||= areaTitle;
        json.description ||= `${areaTitle} overview.`;
        json.tags = Array.isArray(json.tags) && json.tags.length ? json.tags : baseTags;
        if (!Array.isArray(json.heroImages) || json.heroImages.length === 0) {
          json.heroImages = [
            "https://images.unsplash.com/photo-1467269204594-9661b134dd2b?q=80&w=1800&auto=format&fit=crop",
          ];
        }

        localStorage.setItem(cacheKey, JSON.stringify(json));
        if (!ignore) setData(json);
      } catch (e) {
        if (!ignore) setErr(String(e.message || e));
      } finally {
        if (!ignore) setLoading(false);
      }
    })();

    return () => { ignore = true; };
  }, [slug, areaTitle, cityHint, baseTags]);

  // Top bar (shared)
  const TopBar = () => (
    <div className="ad-topbar">
      <button className="ad-icon-btn" onClick={() => navigate(-1)} aria-label="Back">←</button>
      <div className="ad-status">9:41</div>
      <div className="ad-system-icons">◧ ● ◌</div>
    </div>
  );

  // Loading skeleton (no hooks here)
  if (loading) {
    return (
      <div className="ad-wrap">
        <TopBar />
        <div className="ad-hero">
          <div style={{height:240, width:"100%", background:"#e5e7eb", borderRadius:12, animation:"pulse 1.5s ease-in-out infinite"}} />
        </div>
        <div className="ad-body">
          <div className="ad-title-row">
            <div style={{height:28, width:"60%", background:"#e5e7eb", borderRadius:8, animation:"pulse 1.5s ease-in-out infinite"}} />
            <div style={{height:32, width:32, background:"#eef2ff", borderRadius:12}} />
          </div>
          <div style={{height:80, background:"#e5e7eb", borderRadius:12, animation:"pulse 1.5s ease-in-out infinite"}} />
        </div>
        <style>{`
          @keyframes pulse { 0%{opacity:1} 50%{opacity:.55} 100%{opacity:1} }
        `}</style>
      </div>
    );
  }

  // Error card (no hooks here)
  if (err || !data) {
    return (
      <div className="ad-wrap">
        <TopBar />
        <div className="ad-body">
          <h1 className="ad-title">{areaTitle}</h1>
          <div style={{padding:12, border:"1px solid #fecaca", background:"#fff1f2", color:"#7f1d1d", borderRadius:12}}>
            {err || "Failed to load details."}
          </div>
        </div>
      </div>
    );
  }

  // Actual view with carousel hooks lives in a child component
  return (
    <div className="ad-wrap">
      <TopBar />
      <AreaDetailsView slug={slug} data={data} state={state} />
    </div>
  );
}



function AreaDetailsView({ slug, data, state }) {
  const navigate = useNavigate();

  // Carousel hooks (always called because this component only renders after data exists)
  const images = data.heroImages;
  const [imgIndex, setImgIndex] = useState(0);
  const next = () => setImgIndex((i) => (images.length ? (i + 1) % images.length : 0));
  const prev = () => setImgIndex((i) => (images.length ? (i - 1 + images.length) % images.length : 0));

  useEffect(() => {
    if (imgIndex >= images.length) setImgIndex(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images.length]);

  const bullets = useMemo(
    () =>
      images.map((_, i) => (
        <span
          key={i}
          className={`ad-dot ${i === imgIndex ? "active" : ""}`}
          onClick={() => setImgIndex(i)}
        />
      )),
    [images, imgIndex]
  );

  return (
    <>
     
      <div className="ad-hero">
        <img src={images[imgIndex]} alt={data.title} />
        {images.length > 1 && (
          <>
            <button className="ad-hero-nav left" onClick={prev} aria-label="Prev">‹</button>
            <button className="ad-hero-nav right" onClick={next} aria-label="Next">›</button>
            <div className="ad-dots">{bullets}</div>
          </>
        )}
      </div>

    
      <div className="ad-body">
        <div className="ad-title-row">
          <h1 className="ad-title">{data.title}</h1>
          <button className="ad-icon-badge" title="Compare to similar areas">👤</button>
        </div>

        <p className="ad-desc">{data.description}</p>

        <div className="ad-chips">
          {(data.tags || []).map((t, i) => (
            <span className="ad-chip" key={`${t}-${i}`}>{t}</span>
          ))}
        </div>

     
        <SectionHeader>Safety</SectionHeader>
        <div className="ad-grid-2">
          <MetricCard label="Crime Rate" value={data.metrics?.safety?.crime ?? "—"} />
          <MetricCard label="Safety Rating" value={data.metrics?.safety?.score ?? "—"} />
        </div>

       
        <SectionHeader>Schools</SectionHeader>
        <div className="ad-grid-2">
          <MetricCard label="Average Rating" value={data.metrics?.schools?.avg ?? "—"} />
          <MetricCard label="Number of Schools" value={data.metrics?.schools?.count ?? "—"} />
        </div>

     
        <SectionHeader>Rent</SectionHeader>
        <MetricWide label="Average Rent" value={data.metrics?.rent?.avg ?? "—"} />

      
        <SectionHeader>Commute</SectionHeader>
        <div className="ad-grid-2">
          <MetricCard label="Downtown" value={data.metrics?.commute?.downtown ?? "—"} />
          <MetricCard label="Airport" value={data.metrics?.commute?.airport ?? "—"} />
        </div>

     
        <details className="ad-accordion">
          <summary>Seasonal & Event Awareness</summary>
          <div className="ad-accordion-body">
            Expect heavier traffic and higher short-term rents during major events and peak tourist seasons. Plan moves and lease starts accordingly.
          </div>
        </details>

       
        <div className="ad-actions">
          <button
            className="ad-btn ghost"
            onClick={() => navigate(`/areas/${slug}/compare`, { state })}
          >
            Compare Areas
          </button>
          <button
            className="ad-btn primary"
            onClick={() => navigate(`/areas/${slug}/explore`, { state })}
          >
            Explore More
          </button>
        </div>
      </div>
    </>
  );
}



function SectionHeader({ children }) {
  return <h2 className="ad-section">{children}</h2>;
}

function MetricCard({ label, value }) {
  return (
    <div className="ad-card">
      <div className="ad-card-label">{label}</div>
      <div className="ad-card-value">{value}</div>
    </div>
  );
}

function MetricWide({ label, value }) {
  return (
    <div className="ad-card wide">
      <div className="ad-card-label">{label}</div>
      <div className="ad-card-value">{value}</div>
    </div>
  );
}
*/



/*
import React, { useMemo, useState, useEffect } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import "./AreaDetails.css";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:5050";

export default function AreaDetails() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { slug } = useParams();

  const inferredTitle = slug
    ? slug.replace(/-/g, " ").replace(/\b\w/g, (m) => m.toUpperCase())
    : "Area";

  // ---- Base data from navigation (neutral defaults)
  const base = state?.item || {};
  const {
    title: baseTitle = base?.name || inferredTitle,
    description: baseDescRaw,
    tags: baseTags = ["beachy", "walkable"],
    heroImages: baseImages = [
      "https://images.unsplash.com/photo-1467269204594-9661b134dd2b?q=80&w=1800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1494526585095-c41746248156?q=80&w=1800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?q=80&w=1800&auto=format&fit=crop",
    ],
    metrics: baseMetrics = {
      safety: { crime: "Low", score: "9/10" },
      schools: { avg: "8/10", count: "5" },
      rent: { avg: "$2,500" },
      commute: { downtown: "20 min", airport: "30 min" },
    },
  } = base;

  // Neutral fallback sentence (area-specific, not “Greenwood …”)
  const baseDesc =
    baseDescRaw ||
    `${baseTitle} is a neighborhood with a mix of residential character and access to city amenities. This page personalizes details for ${baseTitle} as more info loads.`;

  // ---- Enrichment
  const [enriched, setEnriched] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const cityHint = state?.city || "Los Angeles";
  const vibeTags = Array.isArray(baseTags) ? baseTags : [];

  useEffect(() => {
    let ignore = false;

    async function fetchEnriched() {
      try {
        setLoading(true);
        setErr("");

        // Strong cache key so one area’s data never bleeds into another
        const cacheKey = `area:${slug}|${baseTitle}|${cityHint}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (!ignore) setEnriched(parsed);
          return;
        }

        // IMPORTANT: call the real API base (not the React dev server)
        const res = await fetch(`${API_BASE}/api/areas/enrich`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            name: baseTitle,
            city: cityHint,
            state: "CA",
            tags: vibeTags,
          }),
        });

        const text = await res.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch {
          throw new Error(
            "Could not parse API response. Check API base URL / proxy. " +
              "Response starts with: " +
              text.slice(0, 60)
          );
        }

        if (!res.ok) throw new Error(data?.error || "Failed to enrich area");

        localStorage.setItem(cacheKey, JSON.stringify(data));
        if (!ignore) setEnriched(data);
      } catch (e) {
        console.error("Area enrich failed:", e);
        if (!ignore) setErr(String(e.message || e));
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    fetchEnriched();
    return () => {
      ignore = true;
    };
  }, [slug, baseTitle, cityHint]); // refetch when navigating to a different area

  // Use enriched data if available
  const final = enriched || {
    title: baseTitle,
    description: baseDesc,
    tags: baseTags,
    heroImages: baseImages,
    metrics: baseMetrics,
  };

  // ---- Carousel
  const images =
    Array.isArray(final.heroImages) && final.heroImages.length > 0
      ? final.heroImages
      : baseImages;
  const [imgIndex, setImgIndex] = useState(0);
  const next = () => setImgIndex((i) => (images.length ? (i + 1) % images.length : 0));
  const prev = () =>
    setImgIndex((i) => (images.length ? (i - 1 + images.length) % images.length : 0));

  useEffect(() => {
    if (imgIndex >= images.length) setImgIndex(0);
  }, [images.length, imgIndex]);

  const bullets = useMemo(
    () =>
      images.map((_, i) => (
        <span
          key={i}
          className={`ad-dot ${i === imgIndex ? "active" : ""}`}
          onClick={() => setImgIndex(i)}
        />
      )),
    [images, imgIndex]
  );

  return (
    <div className="ad-wrap">
      
      <div className="ad-topbar">
        <button className="ad-icon-btn" onClick={() => navigate(-1)} aria-label="Back">
          ←
        </button>
        <div className="ad-status">9:41</div>
        <div className="ad-system-icons">◧ ● ◌</div>
      </div>

     
      <div className="ad-hero">
        <img src={images[imgIndex]} alt={final.title} />
        {images.length > 1 && (
          <>
            <button className="ad-hero-nav left" onClick={prev} aria-label="Prev">
              ‹
            </button>
            <button className="ad-hero-nav right" onClick={next} aria-label="Next">
              ›
            </button>
            <div className="ad-dots">{bullets}</div>
          </>
        )}
      </div>

     
      <div className="ad-body">
        <div className="ad-title-row">
          <h1 className="ad-title">{final.title}</h1>
          <button className="ad-icon-badge" title="Compare to similar areas">👤</button>
        </div>

        {loading && <div style={{ padding: 8, fontSize: 13, opacity: 0.7 }}>Personalizing…</div>}
        {err && (
          <div style={{ padding: 8, fontSize: 12, color: "#b91c1c" }}>
            {err}
          </div>
        )}

        <p className="ad-desc">{final.description}</p>

        <div className="ad-chips">
          {(final.tags || []).map((t, i) => (
            <span className="ad-chip" key={`${t}-${i}`}>
              {t}
            </span>
          ))}
        </div>

       
        <SectionHeader>Safety</SectionHeader>
        <div className="ad-grid-2">
          <MetricCard label="Crime Rate" value={final.metrics?.safety?.crime ?? "—"} />
          <MetricCard label="Safety Rating" value={final.metrics?.safety?.score ?? "—"} />
        </div>

       
        <SectionHeader>Schools</SectionHeader>
        <div className="ad-grid-2">
          <MetricCard label="Average Rating" value={final.metrics?.schools?.avg ?? "—"} />
          <MetricCard label="Number of Schools" value={final.metrics?.schools?.count ?? "—"} />
        </div>

       
        <SectionHeader>Rent</SectionHeader>
        <MetricWide label="Average Rent" value={final.metrics?.rent?.avg ?? "—"} />

       
        <SectionHeader>Commute</SectionHeader>
        <div className="ad-grid-2">
          <MetricCard label="Downtown" value={final.metrics?.commute?.downtown ?? "—"} />
          <MetricCard label="Airport" value={final.metrics?.commute?.airport ?? "—"} />
        </div>

        
        <details className="ad-accordion">
          <summary>Seasonal & Event Awareness</summary>
          <div className="ad-accordion-body">
            Expect heavier traffic and higher short-term rents during major events and peak tourist seasons. Plan moves and lease starts accordingly.
          </div>
        </details>

       
        <div className="ad-actions">
          <button
            className="ad-btn ghost"
            onClick={() => navigate(`/areas/${slug}/compare`, { state })}
          >
            Compare Areas
          </button>
          <button
            className="ad-btn primary"
            onClick={() => navigate(`/areas/${slug}/explore`, { state })}
          >
            Explore More
          </button>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ children }) {
  return <h2 className="ad-section">{children}</h2>;
}

function MetricCard({ label, value }) {
  return (
    <div className="ad-card">
      <div className="ad-card-label">{label}</div>
      <div className="ad-card-value">{value}</div>
    </div>
  );
}

function MetricWide({ label, value }) {
  return (
    <div className="ad-card wide">
      <div className="ad-card-label">{label}</div>
      <div className="ad-card-value">{value}</div>
    </div>
  );
}
*/



/*
// src/pages/AreaDetails.jsx
import React, { useMemo, useState, useEffect } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import "./AreaDetails.css";

export default function AreaDetails() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { slug } = useParams();

  // ---- Base data from navigation (fallbacks so page still renders immediately)
  const base = state?.item || {};
  const {
    title: baseTitle = "Greenwood",
    description: baseDesc =
      "Greenwood is a vibrant neighborhood known for its friendly community, excellent schools, and beautiful parks. It offers a mix of residential charm and convenient access to urban amenities.",
    tags: baseTags = ["Kid-Friendly", "Budget Friendly", "Artsy"],
    heroImages: baseImages = [
      "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?q=80&w=1800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1467269204594-9661b134dd2b?q=80&w=1800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1494526585095-c41746248156?q=80&w=1800&auto=format&fit=crop",
    ],
    metrics: baseMetrics = {
      safety: { crime: "Low", score: "9/10" },
      schools: { avg: "8/10", count: "5" },
      rent: { avg: "$2,500" },
      commute: { downtown: "20 min", airport: "30 min" },
    },
  } = base;

  // ---- Enriched data from backend (OpenAI historic knowledge)
  const [enriched, setEnriched] = useState(null);
  const [loading, setLoading] = useState(false);

  // We’ll pass city hint if present from the results page
  const cityHint = state?.city || "Los Angeles";
  const vibeTags = Array.isArray(baseTags) ? baseTags : [];

  useEffect(() => {
    let ignore = false;

    async function fetchEnriched() {
      try {
        setLoading(true);

        // Simple localStorage cache while navigating around
        const cacheKey = `area:${slug}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (!ignore) setEnriched(parsed);
          return;
        }

        const res = await fetch("/api/areas/enrich", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: baseTitle,
            city: cityHint,
            state: "CA",
            tags: vibeTags,
            // Optionally include budget/familySize if you collect them
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Failed to enrich area");

        localStorage.setItem(cacheKey, JSON.stringify(data));
        if (!ignore) setEnriched(data);
      } catch (e) {
        console.error("Area enrich failed:", e);
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    fetchEnriched();
    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // Use enriched data if available, else fall back to base
  const final = enriched || {
    title: baseTitle,
    description: baseDesc,
    tags: baseTags,
    heroImages: baseImages,
    metrics: baseMetrics,
  };

  // ---- Carousel state (driven by whatever images are currently shown)
  const images =
    Array.isArray(final.heroImages) && final.heroImages.length > 0
      ? final.heroImages
      : baseImages;
  const [imgIndex, setImgIndex] = useState(0);
  const next = () =>
    setImgIndex((i) => (images.length ? (i + 1) % images.length : 0));
  const prev = () =>
    setImgIndex((i) => (images.length ? (i - 1 + images.length) % images.length : 0));

  // Re-clamp index if images array length changes after enrichment
  useEffect(() => {
    if (imgIndex >= images.length) setImgIndex(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images.length]);

  const bullets = useMemo(
    () =>
      images.map((_, i) => (
        <span
          key={i}
          className={`ad-dot ${i === imgIndex ? "active" : ""}`}
          onClick={() => setImgIndex(i)}
        />
      )),
    [images, imgIndex]
  );

  return (
    <div className="ad-wrap">
    
      <div className="ad-topbar">
        <button className="ad-icon-btn" onClick={() => navigate(-1)} aria-label="Back">
          ←
        </button>
        <div className="ad-status">9:41</div>
        <div className="ad-system-icons">◧ ● ◌</div>
      </div>

 
      <div className="ad-hero">
        <img src={images[imgIndex]} alt={final.title} />
        {images.length > 1 && (
          <>
            <button className="ad-hero-nav left" onClick={prev} aria-label="Prev">
              ‹
            </button>
            <button className="ad-hero-nav right" onClick={next} aria-label="Next">
              ›
            </button>
            <div className="ad-dots">{bullets}</div>
          </>
        )}
      </div>

     
      <div className="ad-body">
        <div className="ad-title-row">
          <h1 className="ad-title">{final.title}</h1>
        <button className="ad-icon-badge" title="Compare to similar areas">👤</button>
        </div>

        {loading && (
          <div style={{ padding: 8, fontSize: 13, opacity: 0.7 }}>Personalizing…</div>
        )}

        <p className="ad-desc">{final.description}</p>

        <div className="ad-chips">
          {(final.tags || []).map((t, i) => (
            <span className="ad-chip" key={`${t}-${i}`}>{t}</span>
          ))}
        </div>

       
        <SectionHeader>Safety</SectionHeader>
        <div className="ad-grid-2">
          <MetricCard label="Crime Rate" value={final.metrics?.safety?.crime ?? "—"} />
          <MetricCard label="Safety Rating" value={final.metrics?.safety?.score ?? "—"} />
        </div>

       
        <SectionHeader>Schools</SectionHeader>
        <div className="ad-grid-2">
          <MetricCard label="Average Rating" value={final.metrics?.schools?.avg ?? "—"} />
          <MetricCard label="Number of Schools" value={final.metrics?.schools?.count ?? "—"} />
        </div>

       
        <SectionHeader>Rent</SectionHeader>
        <MetricWide label="Average Rent" value={final.metrics?.rent?.avg ?? "—"} />

       
        <SectionHeader>Commute</SectionHeader>
        <div className="ad-grid-2">
          <MetricCard label="Downtown" value={final.metrics?.commute?.downtown ?? "—"} />
          <MetricCard label="Airport" value={final.metrics?.commute?.airport ?? "—"} />
        </div>

    
        <details className="ad-accordion">
          <summary>Seasonal & Event Awareness</summary>
          <div className="ad-accordion-body">
            Expect heavier traffic and higher short-term rents during major events and peak tourist seasons. Plan moves and lease starts accordingly.
          </div>
        </details>

       
        <div className="ad-actions">
          <button
            className="ad-btn ghost"
            onClick={() => navigate(`/areas/${slug}/compare`, { state })}
          >
            Compare Areas
          </button>
          <button
            className="ad-btn primary"
            onClick={() => navigate(`/areas/${slug}/explore`, { state })}
          >
            Explore More
          </button>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ children }) {
  return <h2 className="ad-section">{children}</h2>;
}

function MetricCard({ label, value }) {
  return (
    <div className="ad-card">
      <div className="ad-card-label">{label}</div>
      <div className="ad-card-value">{value}</div>
    </div>
  );
}

function MetricWide({ label, value }) {
  return (
    <div className="ad-card wide">
      <div className="ad-card-label">{label}</div>
      <div className="ad-card-value">{value}</div>
    </div>
  );
}
*/



/*
// src/pages/AreaDetails.jsx
import React, { useMemo, useState, useEffect } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import "./AreaDetails.css";

export default function AreaDetails() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { slug } = useParams();

  // ---- Base data from navigation (fallbacks so page still renders immediately)
  const base = state?.item || {};
  const {
    title: baseTitle = "Greenwood",
    description: baseDesc =
      "Greenwood is a vibrant neighborhood known for its friendly community, excellent schools, and beautiful parks. It offers a mix of residential charm and convenient access to urban amenities.",
    tags: baseTags = ["Kid-Friendly", "Budget Friendly", "Artsy"],
    heroImages: baseImages = [
      "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?q=80&w=1800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1467269204594-9661b134dd2b?q=80&w=1800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1494526585095-c41746248156?q=80&w=1800&auto=format&fit=crop",
    ],
    metrics: baseMetrics = {
      safety: { crime: "Low", score: "9/10" },
      schools: { avg: "8/10", count: "5" },
      rent: { avg: "$2,500" },
      commute: { downtown: "20 min", airport: "30 min" },
    },
  } = base;

  // ---- Enriched data from backend (OpenAI historic knowledge)
  const [enriched, setEnriched] = useState(null);
  const [loading, setLoading] = useState(false);

  // We’ll pass city hint if present from the results page
  const cityHint = state?.city || "Los Angeles";
  const vibeTags = Array.isArray(baseTags) ? baseTags : [];

  useEffect(() => {
    let ignore = false;

    async function fetchEnriched() {
      try {
        setLoading(true);

        // Simple localStorage cache while navigating around
        const cacheKey = `area:${slug}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (!ignore) setEnriched(parsed);
          return;
        }

        const res = await fetch("/api/areas/enrich", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: baseTitle,
            city: cityHint,
            state: "CA",
            tags: vibeTags,
            // Optionally include budget/familySize if you collect them
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Failed to enrich area");

        localStorage.setItem(cacheKey, JSON.stringify(data));
        if (!ignore) setEnriched(data);
      } catch (e) {
        console.error("Area enrich failed:", e);
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    fetchEnriched();
    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // Use enriched data if available, else fall back to base
  const final = enriched || {
    title: baseTitle,
    description: baseDesc,
    tags: baseTags,
    heroImages: baseImages,
    metrics: baseMetrics,
  };

  // ---- Carousel state (driven by whatever images are currently shown)
  const images =
    Array.isArray(final.heroImages) && final.heroImages.length > 0
      ? final.heroImages
      : baseImages;
  const [imgIndex, setImgIndex] = useState(0);
  const next = () =>
    setImgIndex((i) => (images.length ? (i + 1) % images.length : 0));
  const prev = () =>
    setImgIndex((i) => (images.length ? (i - 1 + images.length) % images.length : 0));

  // Re-clamp index if images array length changes after enrichment
  useEffect(() => {
    if (imgIndex >= images.length) setImgIndex(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images.length]);

  const bullets = useMemo(
    () =>
      images.map((_, i) => (
        <span
          key={i}
          className={`ad-dot ${i === imgIndex ? "active" : ""}`}
          onClick={() => setImgIndex(i)}
        />
      )),
    [images, imgIndex]
  );

  return (
    <div className="ad-wrap">
      
      <div className="ad-topbar">
        <button className="ad-icon-btn" onClick={() => navigate(-1)} aria-label="Back">
          ←
        </button>
        <div className="ad-status">9:41</div>
        <div className="ad-system-icons">◧ ● ◌</div>
      </div>

      
      <div className="ad-hero">
        <img src={images[imgIndex]} alt={final.title} />
        {images.length > 1 && (
          <>
            <button className="ad-hero-nav left" onClick={prev} aria-label="Prev">
              ‹
            </button>
            <button className="ad-hero-nav right" onClick={next} aria-label="Next">
              ›
            </button>
            <div className="ad-dots">{bullets}</div>
          </>
        )}
      </div>

      
      <div className="ad-body">
        <div className="ad-title-row">
          <h1 className="ad-title">{final.title}</h1>
          <button className="ad-icon-badge" title="Compare to similar areas">👤</button>
        </div>

        {loading && (
          <div style={{ padding: 8, fontSize: 13, opacity: 0.7 }}>Personalizing…</div>
        )}

        <p className="ad-desc">{final.description}</p>

        <div className="ad-chips">
          {(final.tags || []).map((t, i) => (
            <span className="ad-chip" key={`${t}-${i}`}>{t}</span>
          ))}
        </div>

       
        <SectionHeader>Safety</SectionHeader>
        <div className="ad-grid-2">
          <MetricCard label="Crime Rate" value={final.metrics?.safety?.crime ?? "—"} />
          <MetricCard label="Safety Rating" value={final.metrics?.safety?.score ?? "—"} />
        </div>

        
        <SectionHeader>Schools</SectionHeader>
        <div className="ad-grid-2">
          <MetricCard label="Average Rating" value={final.metrics?.schools?.avg ?? "—"} />
          <MetricCard label="Number of Schools" value={final.metrics?.schools?.count ?? "—"} />
        </div>

    
        <SectionHeader>Rent</SectionHeader>
        <MetricWide label="Average Rent" value={final.metrics?.rent?.avg ?? "—"} />

       
        <SectionHeader>Commute</SectionHeader>
        <div className="ad-grid-2">
          <MetricCard label="Downtown" value={final.metrics?.commute?.downtown ?? "—"} />
          <MetricCard label="Airport" value={final.metrics?.commute?.airport ?? "—"} />
        </div>

       
        <details className="ad-accordion">
          <summary>Seasonal & Event Awareness</summary>
          <div className="ad-accordion-body">
            Expect heavier traffic and higher short-term rents during major events and peak tourist seasons. Plan moves and lease starts accordingly.
          </div>
        </details>

       
        <div className="ad-actions">
          <button className="ad-btn ghost" onClick={() => navigate(-1)}>
            Compare Areas
          </button>
          <button
            className="ad-btn primary"
            onClick={() => navigate(`/areas/${slug}/explore`, { state })}
          >
            Explore More
          </button>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ children }) {
  return <h2 className="ad-section">{children}</h2>;
}

function MetricCard({ label, value }) {
  return (
    <div className="ad-card">
      <div className="ad-card-label">{label}</div>
      <div className="ad-card-value">{value}</div>
    </div>
  );
}

function MetricWide({ label, value }) {
  return (
    <div className="ad-card wide">
      <div className="ad-card-label">{label}</div>
      <div className="ad-card-value">{value}</div>
    </div>
  );
}
*/



/*
// src/pages/AreaDetails.jsx
import React, { useMemo, useState, useEffect } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import "./AreaDetails.css";

export default function AreaDetails() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { slug } = useParams();

  // ---- Base data from navigation (fallbacks so page still renders immediately)
  const base = state?.item || {};
  const {
    title: baseTitle = "Greenwood",
    description: baseDesc =
      "Greenwood is a vibrant neighborhood known for its friendly community, excellent schools, and beautiful parks. It offers a mix of residential charm and convenient access to urban amenities.",
    tags: baseTags = ["Kid-Friendly", "Budget Friendly", "Artsy"],
    heroImages: baseImages = [
      "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?q=80&w=1800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1467269204594-9661b134dd2b?q=80&w=1800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1494526585095-c41746248156?q=80&w=1800&auto=format&fit=crop",
    ],
    metrics: baseMetrics = {
      safety: { crime: "Low", score: "9/10" },
      schools: { avg: "8/10", count: "5" },
      rent: { avg: "$2,500" },
      commute: { downtown: "20 min", airport: "30 min" },
    },
  } = base;

  // ---- Enriched data from backend (OpenAI historic knowledge)
  const [enriched, setEnriched] = useState(null);
  const [loading, setLoading] = useState(false);

  // We’ll pass city hint if present from the results page
  const cityHint = state?.city || "Los Angeles";
  const vibeTags = Array.isArray(baseTags) ? baseTags : [];

  useEffect(() => {
    let ignore = false;

    async function fetchEnriched() {
      try {
        setLoading(true);

        // Simple localStorage cache while navigating around
        const cacheKey = `area:${slug}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (!ignore) setEnriched(parsed);
          return;
        }

        const res = await fetch("/api/areas/enrich", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: baseTitle,
            city: cityHint,
            state: "CA",
            tags: vibeTags,
            // Optionally include budget/familySize if you collect them
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Failed to enrich area");

        localStorage.setItem(cacheKey, JSON.stringify(data));
        if (!ignore) setEnriched(data);
      } catch (e) {
        console.error("Area enrich failed:", e);
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    fetchEnriched();
    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // Use enriched data if available, else fall back to base
  const final = enriched || {
    title: baseTitle,
    description: baseDesc,
    tags: baseTags,
    heroImages: baseImages,
    metrics: baseMetrics,
  };

  // ---- Carousel state (driven by whatever images are currently shown)
  const images = Array.isArray(final.heroImages) && final.heroImages.length > 0 ? final.heroImages : baseImages;
  const [imgIndex, setImgIndex] = useState(0);
  const next = () => setImgIndex((i) => (images.length ? (i + 1) % images.length : 0));
  const prev = () => setImgIndex((i) => (images.length ? (i - 1 + images.length) % images.length : 0));

  // Re-clamp index if images array length changes after enrichment
  useEffect(() => {
    if (imgIndex >= images.length) setImgIndex(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images.length]);

  const bullets = useMemo(
    () =>
      images.map((_, i) => (
        <span
          key={i}
          className={`ad-dot ${i === imgIndex ? "active" : ""}`}
          onClick={() => setImgIndex(i)}
        />
      )),
    [images, imgIndex]
  );

  return (
    <div className="ad-wrap">
     
      <div className="ad-topbar">
        <button className="ad-icon-btn" onClick={() => navigate(-1)} aria-label="Back">
          ←
        </button>
        <div className="ad-status">9:41</div>
        <div className="ad-system-icons">◧ ● ◌</div>
      </div>

    
      <div className="ad-hero">
        <img src={images[imgIndex]} alt={final.title} />
        {images.length > 1 && (
          <>
            <button className="ad-hero-nav left" onClick={prev} aria-label="Prev">
              ‹
            </button>
            <button className="ad-hero-nav right" onClick={next} aria-label="Next">
              ›
            </button>
            <div className="ad-dots">{bullets}</div>
          </>
        )}
      </div>

     
      <div className="ad-body">
        <div className="ad-title-row">
          <h1 className="ad-title">{final.title}</h1>
          <button className="ad-icon-badge" title="Compare to similar areas">
            👤
          </button>
        </div>

        {loading && (
          <div style={{ padding: 8, fontSize: 13, opacity: 0.7 }}>Personalizing…</div>
        )}

        <p className="ad-desc">{final.description}</p>

        <div className="ad-chips">
          {(final.tags || []).map((t, i) => (
            <span className="ad-chip" key={`${t}-${i}`}>
              {t}
            </span>
          ))}
        </div>

       
        <SectionHeader>Safety</SectionHeader>
        <div className="ad-grid-2">
          <MetricCard label="Crime Rate" value={final.metrics?.safety?.crime ?? "—"} />
          <MetricCard label="Safety Rating" value={final.metrics?.safety?.score ?? "—"} />
        </div>

       
        <SectionHeader>Schools</SectionHeader>
        <div className="ad-grid-2">
          <MetricCard label="Average Rating" value={final.metrics?.schools?.avg ?? "—"} />
          <MetricCard label="Number of Schools" value={final.metrics?.schools?.count ?? "—"} />
        </div>

       
        <SectionHeader>Rent</SectionHeader>
        <MetricWide label="Average Rent" value={final.metrics?.rent?.avg ?? "—"} />

       
        <SectionHeader>Commute</SectionHeader>
        <div className="ad-grid-2">
          <MetricCard label="Downtown" value={final.metrics?.commute?.downtown ?? "—"} />
          <MetricCard label="Airport" value={final.metrics?.commute?.airport ?? "—"} />
        </div>

       
        <details className="ad-accordion">
          <summary>Seasonal & Event Awareness</summary>
          <div className="ad-accordion-body">
            Expect heavier traffic and higher short-term rents during major events and peak tourist seasons. Plan moves and lease starts accordingly.
          </div>
        </details>

      
        <div className="ad-actions">
          <button className="ad-btn ghost" onClick={() => navigate(-1)}>
            Compare Areas
          </button>
          <button className="ad-btn primary">Explore More</button>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ children }) {
  return <h2 className="ad-section">{children}</h2>;
}

function MetricCard({ label, value }) {
  return (
    <div className="ad-card">
      <div className="ad-card-label">{label}</div>
      <div className="ad-card-value">{value}</div>
    </div>
  );
}

function MetricWide({ label, value }) {
  return (
    <div className="ad-card wide">
      <div className="ad-card-label">{label}</div>
      <div className="ad-card-value">{value}</div>
    </div>
  );
}
*/


/*
// src/pages/AreaDetails.jsx
import React, { useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import "./AreaDetails.css";

export default function AreaDetails() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { slug } = useParams();

  // Data from navigation state (or sensible defaults)
  const data = state?.item || {};
  const {
    title = "Greenwood",
    description = "Greenwood is a vibrant neighborhood known for its friendly community, excellent schools, and beautiful parks. It offers a mix of residential charm and convenient access to urban amenities.",
    tags = ["Kid-Friendly", "Budget Friendly", "Artsy"],
    heroImages = [
      "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?q=80&w=1800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1467269204594-9661b134dd2b?q=80&w=1800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1494526585095-c41746248156?q=80&w=1800&auto=format&fit=crop"
    ],
    metrics = {
      safety: { crime: "Low", score: "9/10" },
      schools: { avg: "8/10", count: "5" },
      rent: { avg: "$2,500" },
      commute: { downtown: "20 min", airport: "30 min" }
    }
  } = data;

  const [imgIndex, setImgIndex] = useState(0);
  const next = () => setImgIndex((i) => (i + 1) % heroImages.length);
  const prev = () => setImgIndex((i) => (i - 1 + heroImages.length) % heroImages.length);

  const bullets = useMemo(
    () =>
      heroImages.map((_, i) => (
        <span key={i} className={`ad-dot ${i === imgIndex ? "active" : ""}`} onClick={() => setImgIndex(i)} />
      )),
    [heroImages, imgIndex]
  );

  return (
    <div className="ad-wrap">
 
      <div className="ad-topbar">
        <button className="ad-icon-btn" onClick={() => navigate(-1)} aria-label="Back">←</button>
        <div className="ad-status">9:41</div>
        <div className="ad-system-icons">◧ ● ◌</div>
      </div>


      <div className="ad-hero">
        <img src={heroImages[imgIndex]} alt={title} />
        <button className="ad-hero-nav left" onClick={prev} aria-label="Prev">‹</button>
        <button className="ad-hero-nav right" onClick={next} aria-label="Next">›</button>
        <div className="ad-dots">{bullets}</div>
      </div>


      <div className="ad-body">
        <div className="ad-title-row">
          <h1 className="ad-title">{title}</h1>
          <button className="ad-icon-badge" title="Compare to similar areas">👤</button>
        </div>

        <p className="ad-desc">{description}</p>

        <div className="ad-chips">
          {tags.map((t, i) => (
            <span className="ad-chip" key={`${t}-${i}`}>{t}</span>
          ))}
        </div>

     
        <SectionHeader>Safety</SectionHeader>
        <div className="ad-grid-2">
          <MetricCard label="Crime Rate" value={metrics.safety?.crime ?? "—"} />
          <MetricCard label="Safety Rating" value={metrics.safety?.score ?? "—"} />
        </div>

 
        <SectionHeader>Schools</SectionHeader>
        <div className="ad-grid-2">
          <MetricCard label="Average Rating" value={metrics.schools?.avg ?? "—"} />
          <MetricCard label="Number of Schools" value={metrics.schools?.count ?? "—"} />
        </div>

  
        <SectionHeader>Rent</SectionHeader>
        <MetricWide label="Average Rent" value={metrics.rent?.avg ?? "—"} />


        <SectionHeader>Commute</SectionHeader>
        <div className="ad-grid-2">
          <MetricCard label="Downtown" value={metrics.commute?.downtown ?? "—"} />
          <MetricCard label="Airport" value={metrics.commute?.airport ?? "—"} />
        </div>


        <details className="ad-accordion">
          <summary>Seasonal & Event Awareness</summary>
          <div className="ad-accordion-body">
            Expect heavier traffic and higher short-term rents during major events and peak tourist seasons. Plan moves and lease starts accordingly.
          </div>
        </details>

    
        <div className="ad-actions">
          <button className="ad-btn ghost" onClick={() => navigate("/results")}>Compare Areas</button>
          <button className="ad-btn primary">Explore More</button>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ children }) {
  return <h2 className="ad-section">{children}</h2>;
}

function MetricCard({ label, value }) {
  return (
    <div className="ad-card">
      <div className="ad-card-label">{label}</div>
      <div className="ad-card-value">{value}</div>
    </div>
  );
}

function MetricWide({ label, value }) {
  return (
    <div className="ad-card wide">
      <div className="ad-card-label">{label}</div>
      <div className="ad-card-value">{value}</div>
    </div>
  );
}
*/