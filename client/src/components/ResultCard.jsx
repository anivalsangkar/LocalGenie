import React, { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";

export default function ResultCard({
  item = {},
  city: cityProp,
  region: regionProp,
  // ✅ new: when true, card stretches to full width of its grid column
  fullWidth = false,
}) {
  const {
    id,
    title = "Downtown",
    rating = 5.0,
    reviews = "6.2k",
    subtitle = "Vibrant city center with nightlife",
    image = "",
    ctaUrl = "",
    // pass-through location hints if present on the card item
    city: itemCity,
    state: itemState,
    region: itemRegion,
  } = item || {};

  const navigate = useNavigate();
  const [imgErr, setImgErr] = useState(false);

  const stars = useMemo(() => {
    const r = Number(rating) || 0;
    const full = Math.min(5, Math.max(0, Math.round(r)));
    return Array(5)
      .fill(0)
      .map((_, i) => (i < full ? "★" : "☆"));
  }, [rating]);

  // Slug for the detail URL: /areas/:slug
  const slug = useMemo(() => {
    const base = (id && String(id)) || String(title);
    return base.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }, [id, title]);

  // Location hints: prefer item fields, then explicit props
  const city = itemCity || cityProp || "";
  const region = itemRegion || itemState || regionProp || "";

  const onExplore = useCallback(() => {
    navigate(`/areas/${slug}`, {
      state: {
        item,
        city,     // <— critical: send city
        region,   // <— critical: send state/region
      },
    });
  }, [navigate, slug, item, city, region]);

  const s = {
    card: {
      // ✅ stretch logic (only when fullWidth is true)
      width: fullWidth ? "100%" : undefined,
      maxWidth: fullWidth ? "100%" : 300,
      minWidth: fullWidth ? 0 : 280, // allow shrinking inside grid
      background: "#fff",
      border: "1px solid #E5E7EB",
      borderRadius: 16,
      boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
      overflow: "hidden",
    },
    imgWrap: { height: 140, background: "#F3F4F6", overflow: "hidden" },
    img: { width: "100%", height: "100%", objectFit: "cover" },
    body: { padding: 14 },
    title: { fontSize: 16, fontWeight: 600, marginBottom: 6, color: "#111827" },
    rating: {
      fontSize: 14,
      color: "#374151",
      marginBottom: 6,
      display: "flex",
      alignItems: "center",
      gap: 6,
    },
    subtitle: { fontSize: 14, color: "#4B5563" },
    actions: { display: "flex", gap: 8, marginTop: 10 },
    btnPrimary: {
      background: "#1559EA",
      color: "#fff",
      padding: "8px 12px",
      borderRadius: 10,
      fontSize: 12,
      border: "none",
      cursor: "pointer",
    },
    linkBtn: {
      display: "inline-block",
      background: "#EEF2FF",
      color: "#1E3A8A",
      padding: "8px 12px",
      borderRadius: 10,
      fontSize: 12,
      textDecoration: "none",
      border: "1px solid #C7D2FE",
    },
  };

  return (
    <div style={s.card}>
      <div style={s.imgWrap}>
        {!imgErr && image ? (
          <img src={image} alt={title} style={s.img} loading="lazy" onError={() => setImgErr(true)} />
        ) : (
          <div
            style={{
              ...s.imgWrap,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#9CA3AF",
              height: "100%",
            }}
          >
            No image
          </div>
        )}
      </div>
      <div style={s.body}>
        <div style={s.title}>{title}</div>
        <div style={s.rating}>
          <span style={{ color: "#F59E0B" }}>{stars.join(" ")}</span>
          <span>{Number(rating).toFixed(1)}</span>
          <span style={{ color: "#6B7280" }}>({reviews})</span>
        </div>
        <div style={s.subtitle}>{subtitle}</div>

        <div style={s.actions}>
          {ctaUrl && (
            <a href={ctaUrl} target="_blank" rel="noreferrer" style={s.linkBtn}>
              View details
            </a>
          )}
          <button type="button" style={s.btnPrimary} onClick={onExplore}>
            Explore more
          </button>
        </div>
      </div>
    </div>
  );
}



/*
import React, { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";

export default function ResultCard({ item = {}, city: cityProp, region: regionProp }) {
  const {
    id,
    title = "Downtown",
    rating = 5.0,
    reviews = "6.2k",
    subtitle = "Vibrant city center with nightlife",
    image = "",
    ctaUrl = "",
    // pass-through location hints if present on the card item
    city: itemCity,
    state: itemState,
    region: itemRegion,
  } = item || {};

  const navigate = useNavigate();
  const [imgErr, setImgErr] = useState(false);

  const stars = useMemo(() => {
    const r = Number(rating) || 0;
    const full = Math.min(5, Math.max(0, Math.round(r)));
    return Array(5)
      .fill(0)
      .map((_, i) => (i < full ? "★" : "☆"));
  }, [rating]);

  // Slug for the detail URL: /areas/:slug
  const slug = useMemo(() => {
    const base = (id && String(id)) || String(title);
    return base.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }, [id, title]);

  // Location hints: prefer item fields, then explicit props
  const city = itemCity || cityProp || "";
  const region = itemRegion || itemState || regionProp || "";

  const onExplore = useCallback(() => {
    navigate(`/areas/${slug}`, {
      state: {
        item,
        city,     // <— critical: send city
        region,   // <— critical: send state/region
      },
    });
  }, [navigate, slug, item, city, region]);

  const s = {
    card: {
      minWidth: 280,
      maxWidth: 300,
      background: "#fff",
      border: "1px solid #E5E7EB",
      borderRadius: 16,
      boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
      overflow: "hidden",
    },
    imgWrap: { height: 140, background: "#F3F4F6", overflow: "hidden" },
    img: { width: "100%", height: "100%", objectFit: "cover" },
    body: { padding: 14 },
    title: { fontSize: 16, fontWeight: 600, marginBottom: 6, color: "#111827" },
    rating: {
      fontSize: 14,
      color: "#374151",
      marginBottom: 6,
      display: "flex",
      alignItems: "center",
      gap: 6,
    },
    subtitle: { fontSize: 14, color: "#4B5563" },
    actions: { display: "flex", gap: 8, marginTop: 10 },
    btnPrimary: {
      background: "#1559EA",
      color: "#fff",
      padding: "8px 12px",
      borderRadius: 10,
      fontSize: 12,
      border: "none",
      cursor: "pointer",
    },
    linkBtn: {
      display: "inline-block",
      background: "#EEF2FF",
      color: "#1E3A8A",
      padding: "8px 12px",
      borderRadius: 10,
      fontSize: 12,
      textDecoration: "none",
      border: "1px solid #C7D2FE",
    },
  };

  return (
    <div style={s.card}>
      <div style={s.imgWrap}>
        {!imgErr && image ? (
          <img src={image} alt={title} style={s.img} loading="lazy" onError={() => setImgErr(true)} />
        ) : (
          <div
            style={{
              ...s.imgWrap,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#9CA3AF",
              height: "100%",
            }}
          >
            No image
          </div>
        )}
      </div>
      <div style={s.body}>
        <div style={s.title}>{title}</div>
        <div style={s.rating}>
          <span style={{ color: "#F59E0B" }}>{stars.join(" ")}</span>
          <span>{Number(rating).toFixed(1)}</span>
          <span style={{ color: "#6B7280" }}>({reviews})</span>
        </div>
        <div style={s.subtitle}>{subtitle}</div>

        <div style={s.actions}>
          {ctaUrl && (
            <a href={ctaUrl} target="_blank" rel="noreferrer" style={s.linkBtn}>
              View details
            </a>
          )}
          <button type="button" style={s.btnPrimary} onClick={onExplore}>
            Explore more
          </button>
        </div>
      </div>
    </div>
  );
}
*/



/*
import React, { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";

export default function ResultCard({ item = {}, full = false }) {
  const {
    id,
    title = "Downtown",
    rating = 5.0,
    reviews = "6.2k",
    subtitle = "Vibrant city center with nightlife",
    image = "",
    ctaUrl = "",
  } = item || {};

  const navigate = useNavigate();
  const [imgErr, setImgErr] = useState(false);

  const stars = useMemo(() => {
    const r = Number(rating) || 0;
    const fullStars = Math.min(5, Math.max(0, Math.round(r)));
    return Array(5)
      .fill(0)
      .map((_, i) => (i < fullStars ? "★" : "☆"));
  }, [rating]);

  // Slug for the detail URL: /areas/:slug
  const slug = useMemo(() => {
    const base = (id && String(id)) || String(title);
    return base.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }, [id, title]);

  const onExplore = useCallback(() => {
    navigate(`/areas/${slug}`, { state: { item } });
  }, [navigate, slug, item]);

  const s = {
    card: {
      // If full=true, make the card fill the container (fixes right empty space on ExploreMore)
      ...(full
        ? { width: "100%" }
        : { minWidth: 280, maxWidth: 300 }),
      background: "#fff",
      border: "1px solid #E5E7EB",
      borderRadius: 16,
      boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
      overflow: "hidden",
      boxSizing: "border-box",
    },
    imgWrap: { height: 140, background: "#F3F4F6", overflow: "hidden" },
    img: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
    body: { padding: 14 },
    title: { fontSize: 16, fontWeight: 600, marginBottom: 6, color: "#111827" },
    rating: {
      fontSize: 14,
      color: "#374151",
      marginBottom: 6,
      display: "flex",
      alignItems: "center",
      gap: 6,
    },
    subtitle: { fontSize: 14, color: "#4B5563" },
    actions: { display: "flex", gap: 8, marginTop: 10 },
    btnPrimary: {
      background: "#1559EA",
      color: "#fff",
      padding: "8px 12px",
      borderRadius: 10,
      fontSize: 12,
      border: "none",
      cursor: "pointer",
    },
    linkBtn: {
      display: "inline-block",
      background: "#EEF2FF",
      color: "#1E3A8A",
      padding: "8px 12px",
      borderRadius: 10,
      fontSize: 12,
      textDecoration: "none",
      border: "1px solid #C7D2FE",
    },
  };

  return (
    <div style={s.card}>
      <div style={s.imgWrap}>
        {!imgErr && image ? (
          <img src={image} alt={title} style={s.img} loading="lazy" onError={() => setImgErr(true)} />
        ) : (
          <div
            style={{
              ...s.imgWrap,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#9CA3AF",
              height: "100%",
            }}
          >
            No image
          </div>
        )}
      </div>
      <div style={s.body}>
        <div style={s.title}>{title}</div>
        <div style={s.rating}>
          <span style={{ color: "#F59E0B" }}>{stars.join(" ")}</span>
          <span>{Number(rating).toFixed(1)}</span>
          <span style={{ color: "#6B7280" }}>({reviews})</span>
        </div>
        <div style={s.subtitle}>{subtitle}</div>

        <div style={s.actions}>
          {ctaUrl && (
            <a href={ctaUrl} target="_blank" rel="noreferrer" style={s.linkBtn}>
              View details
            </a>
          )}
          <button type="button" style={s.btnPrimary} onClick={onExplore}>
            Explore more
          </button>
        </div>
      </div>
    </div>
  );
}
*/





/*
import React, { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";

export default function ResultCard({ item = {} }) {
  const {
    id,
    title = "Downtown",
    rating = 5.0,
    reviews = "6.2k",
    subtitle = "Vibrant city center with nightlife",
    image = "",
    ctaUrl = "",
  } = item || {};

  const navigate = useNavigate();
  const [imgErr, setImgErr] = useState(false);

  const stars = useMemo(() => {
    const r = Number(rating) || 0;
    const full = Math.min(5, Math.max(0, Math.round(r)));
    return Array(5)
      .fill(0)
      .map((_, i) => (i < full ? "★" : "☆"));
  }, [rating]);

  // Slug for the detail URL: /areas/:slug
  const slug = useMemo(() => {
    const base = (id && String(id)) || String(title);
    return base.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }, [id, title]);

  const onExplore = useCallback(() => {
    navigate(`/areas/${slug}`, { state: { item } });
  }, [navigate, slug, item]);

  const s = {
    card: {
      minWidth: 280,
      maxWidth: 300,
      background: "#fff",
      border: "1px solid #E5E7EB",
      borderRadius: 16,
      boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
      overflow: "hidden",
    },
    imgWrap: { height: 140, background: "#F3F4F6", overflow: "hidden" },
    img: { width: "100%", height: "100%", objectFit: "cover" },
    body: { padding: 14 },
    title: { fontSize: 16, fontWeight: 600, marginBottom: 6, color: "#111827" },
    rating: { fontSize: 14, color: "#374151", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 },
    subtitle: { fontSize: 14, color: "#4B5563" },
    actions: { display: "flex", gap: 8, marginTop: 10 },
    btnPrimary: {
      background: "#1559EA",
      color: "#fff",
      padding: "8px 12px",
      borderRadius: 10,
      fontSize: 12,
      border: "none",
      cursor: "pointer",
    },
    linkBtn: {
      display: "inline-block",
      background: "#EEF2FF",
      color: "#1E3A8A",
      padding: "8px 12px",
      borderRadius: 10,
      fontSize: 12,
      textDecoration: "none",
      border: "1px solid #C7D2FE",
    },
  };

  return (
    <div style={s.card}>
      <div style={s.imgWrap}>
        {!imgErr && image ? (
          <img src={image} alt={title} style={s.img} loading="lazy" onError={() => setImgErr(true)} />
        ) : (
          <div
            style={{
              ...s.imgWrap,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#9CA3AF",
              height: "100%",
            }}
          >
            No image
          </div>
        )}
      </div>
      <div style={s.body}>
        <div style={s.title}>{title}</div>
        <div style={s.rating}>
          <span style={{ color: "#F59E0B" }}>{stars.join(" ")}</span>
          <span>{Number(rating).toFixed(1)}</span>
          <span style={{ color: "#6B7280" }}>({reviews})</span>
        </div>
        <div style={s.subtitle}>{subtitle}</div>

        <div style={s.actions}>
          {ctaUrl && (
            <a href={ctaUrl} target="_blank" rel="noreferrer" style={s.linkBtn}>
              View details
            </a>
          )}
          <button type="button" style={s.btnPrimary} onClick={onExplore}>
            Explore more
          </button>
        </div>
      </div>
    </div>
  );
}
*/



/*
import React, { useState, useMemo } from "react";

export default function ResultCard({ item = {} }) {
  const {
    title = "Downtown",
    rating = 5.0,
    reviews = "6.2k",
    subtitle = "Vibrant city center with nightlife",
    image = "",
    ctaUrl = "",
  } = item;

  const [imgErr, setImgErr] = useState(false);

  const stars = useMemo(() => {
    const r = Number(rating) || 0;
    const full = Math.min(5, Math.max(0, Math.round(r)));
    return Array(5)
      .fill(0)
      .map((_, i) => (i < full ? "★" : "☆"));
  }, [rating]);

  const s = {
    card: {
      minWidth: 280,
      maxWidth: 300,
      background: "#fff",
      border: "1px solid #E5E7EB",
      borderRadius: 16,
      boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
      overflow: "hidden",
    },
    imgWrap: { height: 140, background: "#F3F4F6", overflow: "hidden" },
    img: { width: "100%", height: "100%", objectFit: "cover" },
    body: { padding: 14 },
    title: { fontSize: 16, fontWeight: 600, marginBottom: 6, color: "#111827" },
    rating: { fontSize: 14, color: "#374151", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 },
    subtitle: { fontSize: 14, color: "#4B5563" },
    btn: {
      marginTop: 10,
      display: "inline-block",
      background: "#1559EA",
      color: "#fff",
      padding: "8px 12px",
      borderRadius: 10,
      fontSize: 12,
      textDecoration: "none",
    },
  };

  return (
    <div style={s.card}>
      <div style={s.imgWrap}>
        {!imgErr && image ? (
          <img src={image} alt={title} style={s.img} loading="lazy" onError={() => setImgErr(true)} />
        ) : (
          <div style={{ ...s.imgWrap, display: "flex", alignItems: "center", justifyContent: "center", color: "#9CA3AF", height: "100%" }}>
            No image
          </div>
        )}
      </div>
      <div style={s.body}>
        <div style={s.title}>{title}</div>
        <div style={s.rating}>
          <span style={{ color: "#F59E0B" }}>{stars.join(" ")}</span>
          <span>{Number(rating).toFixed(1)}</span>
          <span style={{ color: "#6B7280" }}>({reviews})</span>
        </div>
        <div style={s.subtitle}>{subtitle}</div>
        {ctaUrl && (
          <a href={ctaUrl} target="_blank" rel="noreferrer" style={s.btn}>
            View details
          </a>
        )}
      </div>
    </div>
  );
}
*/