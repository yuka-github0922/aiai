"use client";

import { useEffect, useState } from "react";

const HEARTS = [
  { left: "4%",  size: "65px", duration: "7s",   delay: "0s",   color: "#fb7185" },
  { left: "12%", size: "45px", duration: "9s",   delay: "1.8s", color: "#f9a8d4" },
  { left: "22%", size: "85px", duration: "6.5s", delay: "3.2s", color: "#fda4af" },
  { left: "33%", size: "55px", duration: "8.5s", delay: "0.6s", color: "#f472b6" },
  { left: "44%", size: "75px", duration: "7.5s", delay: "5s",   color: "#fb7185" },
  { left: "54%", size: "45px", duration: "10s",  delay: "2.4s", color: "#fda4af" },
  { left: "63%", size: "95px", duration: "6s",   delay: "4.1s", color: "#f9a8d4" },
  { left: "72%", size: "55px", duration: "8s",   delay: "1s",   color: "#fb7185" },
  { left: "82%", size: "70px", duration: "7s",   delay: "3.8s", color: "#f472b6" },
  { left: "91%", size: "50px", duration: "9.5s", delay: "6s",   color: "#fda4af" },
  { left: "18%", size: "40px", duration: "11s",  delay: "7s",   color: "#f9a8d4" },
  { left: "58%", size: "60px", duration: "8s",   delay: "5.5s", color: "#fb7185" },
];

export default function FloatingHearts() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 10) setVisible(true);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      {HEARTS.map((h, i) => (
        <span
          key={i}
          className="heart-float absolute bottom-4 select-none pointer-events-none transition-opacity duration-700"
          style={{
            left: h.left,
            fontSize: h.size,
            color: h.color,
            animationDuration: h.duration,
            animationDelay: h.delay,
            opacity: visible ? undefined : 0,
            animationPlayState: visible ? "running" : "paused",
          }}
        >
          ♥
        </span>
      ))}
    </>
  );
}
