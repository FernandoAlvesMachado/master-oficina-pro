"use client";

import React from "react";

/**
 * Ícone Oficial GIRAVO
 * Letra 'G' estilizada com seta de rotação no topo direito (simbolizando o 'girar' do negócio)
 * Cor oficial: #9EE824 (Lime Neon vibrante de alta conversão)
 */
export function GiravoIcon({
  size = 32,
  className = "",
  style,
  color = "#9EE824",
}: {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  color?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0, ...style }}
    >
      {/* Símbolo G com seta de rotação horário */}
      <path
        d="M 83 20 
           L 68 15 
           L 70 24 
           C 64 21, 56 19, 48 19 
           C 30.9 19, 17 32.9, 17 50 
           C 17 67.1, 30.9 81, 48 81 
           C 65.1 81, 79 67.1, 79 50 
           L 46 50 
           L 46 62 
           L 66.5 62 
           C 62.5 69.5, 55.8 72, 48 72 
           C 35.8 72, 26 62.2, 26 50 
           C 26 37.8, 35.8 28, 48 28 
           C 54.8 28, 60.8 30.8, 65 35 
           L 74 27 
           L 75 35 
           Z"
        fill={color}
      />
    </svg>
  );
}

/**
 * Logo Completo GIRAVO (Ícone + Tipografia + Slogan Opcional)
 */
export function GiravoLogo({
  size = 32,
  showTagline = false,
  taglineText = "Gestão que faz seu negócio girar.",
  textColor = "#FFFFFF",
  iconColor = "#9EE824",
  variant = "horizontal",
}: {
  size?: number;
  showTagline?: boolean;
  taglineText?: string;
  textColor?: string;
  iconColor?: string;
  variant?: "horizontal" | "vertical" | "compact";
}) {
  const iconSize = size;
  const fontSize = Math.round(size * 0.72);

  if (variant === "compact") {
    return (
      <div style={{ display: "inline-flex", alignItems: "center", gap: Math.round(size * 0.28) }}>
        <GiravoIcon size={iconSize} color={iconColor} />
        <span
          style={{
            fontFamily: "var(--font-sans), 'Plus Jakarta Sans', sans-serif",
            fontSize: `${fontSize}px`,
            fontWeight: 900,
            letterSpacing: "0.02em",
            color: textColor,
            lineHeight: 1,
            textTransform: "uppercase",
          }}
        >
          GIRAVO
        </span>
      </div>
    );
  }

  if (variant === "vertical") {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: "10px" }}>
        <div
          style={{
            width: `${size * 1.5}px`,
            height: `${size * 1.5}px`,
            borderRadius: "22px",
            background: "#0D111A",
            border: "1px solid #1E2738",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 10px 30px rgba(0,0,0,0.5), 0 0 25px rgba(158, 232, 36, 0.15)",
          }}
        >
          <GiravoIcon size={size * 1.05} color={iconColor} />
        </div>
        <div>
          <h1
            style={{
              fontFamily: "var(--font-sans), 'Plus Jakarta Sans', sans-serif",
              fontSize: `${fontSize * 1.2}px`,
              fontWeight: 900,
              letterSpacing: "0.03em",
              color: textColor,
              margin: 0,
              lineHeight: 1.1,
              textTransform: "uppercase",
            }}
          >
            GIRAVO
          </h1>
          {showTagline && (
            <p
              style={{
                fontSize: "12px",
                color: "var(--text-muted, #94A3B8)",
                margin: "4px 0 0 0",
                fontWeight: 500,
                letterSpacing: "-0.01em",
              }}
            >
              {taglineText}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "inline-flex", flexDirection: "column", gap: "2px" }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: Math.round(size * 0.28) }}>
        <GiravoIcon size={iconSize} color={iconColor} />
        <span
          style={{
            fontFamily: "var(--font-sans), 'Plus Jakarta Sans', sans-serif",
            fontSize: `${fontSize}px`,
            fontWeight: 900,
            letterSpacing: "0.03em",
            color: textColor,
            lineHeight: 1,
            textTransform: "uppercase",
          }}
        >
          GIRAVO
        </span>
      </div>
      {showTagline && (
        <span
          style={{
            fontSize: `${Math.max(10, Math.round(fontSize * 0.45))}px`,
            color: "var(--text-muted, #94A3B8)",
            fontWeight: 500,
            letterSpacing: "-0.01em",
            marginTop: "2px",
          }}
        >
          {taglineText}
        </span>
      )}
    </div>
  );
}

/**
 * App Icon Card / Badge no estilo do mockup (ícone sobre pedra/card escuro com bordas arredondadas)
 */
export function GiravoAppBadge({ size = 48 }: { size?: number }) {
  return (
    <div
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: `${Math.round(size * 0.28)}px`,
        background: "linear-gradient(145deg, #131A26, #0A0E15)",
        border: "1px solid rgba(158, 232, 36, 0.2)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 8px 24px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)",
        flexShrink: 0,
      }}
    >
      <GiravoIcon size={Math.round(size * 0.65)} color="#9EE824" />
    </div>
  );
}
