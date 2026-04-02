"use client";

import { useEffect, useRef } from "react";

const TRIGGER_SEQUENCE = "tw";
const SEQUENCE_TIMEOUT_MS = 1000;

export function EasterEggListener() {
  const bufferRef = useRef("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ignore when typing in inputs/textareas
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if ((e.target as HTMLElement)?.isContentEditable) return;

      bufferRef.current += e.key.toLowerCase();

      // Reset buffer after timeout
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        bufferRef.current = "";
      }, SEQUENCE_TIMEOUT_MS);

      // Check if buffer ends with the trigger sequence
      if (bufferRef.current.endsWith(TRIGGER_SEQUENCE)) {
        bufferRef.current = "";
        document.querySelectorAll(".cubing-icon").forEach((el) => {
          el.classList.remove("easter-spin");
          void (el as HTMLElement).offsetWidth;
          el.classList.add("easter-spin");
        });
      }

      // Prevent buffer from growing indefinitely
      if (bufferRef.current.length > TRIGGER_SEQUENCE.length * 2) {
        bufferRef.current = bufferRef.current.slice(-TRIGGER_SEQUENCE.length);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      clearTimeout(timerRef.current);
    };
  }, []);

  return null;
}
