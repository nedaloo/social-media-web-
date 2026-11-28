(() => {
  const SPEED_BADGE_CLASS = "hive-net-speed";

  function ensureSpeedBadge() {
    const brandContainer =
      document.querySelector(".topbar .brand") ||
      document.querySelector(".topbar .nav-left") ||
      document.querySelector(".navbar .nav-left");

    if (!brandContainer) return null;

    let badge = brandContainer.querySelector(`.${SPEED_BADGE_CLASS}`);
    if (!badge) {
      badge = document.createElement("span");
      badge.className = SPEED_BADGE_CLASS;
      badge.style.cssText = [
        "color: #ffb800",
        "font-size: 12px",
        "font-weight: 700",
        "margin-left: 8px",
        "padding: 2px 8px",
        "border-radius: 999px",
        "background: rgba(255, 184, 0, 0.12)",
        "border: 1px solid rgba(255, 184, 0, 0.35)",
        "white-space: nowrap",
        "letter-spacing: 0.2px",
      ].join(";");
      brandContainer.appendChild(badge);
    }

    return badge;
  }

  function applyRotationSpeed(mbPerSec) {
    const icons = document.querySelectorAll(".hive-icon, .logo-icon");
    const safeSpeed = Math.max(0.05, Number(mbPerSec) || 0.05);

    // كل ما السرعة (MB/s) تزيد، مدة اللفة الواحدة تقل من 8s لحد 0.5s
    const rawDuration = 4.0 / safeSpeed;
    const durationSec = Math.min(8, Math.max(0.5, rawDuration));

    icons.forEach((icon) => {
      icon.style.animationName = "rotate";
      icon.style.animationTimingFunction = "linear";
      icon.style.animationIterationCount = "infinite";
      icon.style.animationDuration = `${durationSec.toFixed(2)}s`;
    });
  }

  function updateSpeedUI(mbPerSec) {
    const badge = ensureSpeedBadge();
    const formatted = `${Number(mbPerSec).toFixed(2)} MB/s`;
    if (badge) {
      badge.textContent = formatted;
    }
    applyRotationSpeed(mbPerSec);
  }

  async function measureWithFetch() {
    const probeUrl = `blank-profile-pic.png?t=${Date.now()}`;
    const start = performance.now();
    const res = await fetch(probeUrl, { cache: "no-store" });
    const blob = await res.blob();
    const elapsedSec = Math.max((performance.now() - start) / 1000, 0.01);
    const megabytes = blob.size / (1024 * 1024);
    return megabytes / elapsedSec;
  }

  async function measureNetSpeed() {
    const conn =
      navigator.connection ||
      navigator.mozConnection ||
      navigator.webkitConnection;

    if (conn && typeof conn.downlink === "number" && conn.downlink > 0) {
      // downlink بالميجابت/ثانية (Mbps) -> نقسم على 8 للتحويل إلى MB/s
      const mbps = conn.downlink / 8;
      updateSpeedUI(mbps);
      return;
    }

    try {
      const speedMBs = await measureWithFetch();
      if (Number.isFinite(speedMBs) && speedMBs > 0) {
        updateSpeedUI(speedMBs);
        return;
      }
    } catch (_) {
      // في حالة فتح الملف مباشرة من file:// أو فشل الطلب
    }

    updateSpeedUI(1.5);
  }

  document.addEventListener("DOMContentLoaded", () => {
    measureNetSpeed();
    setInterval(measureNetSpeed, 4000);

    const conn =
      navigator.connection ||
      navigator.mozConnection ||
      navigator.webkitConnection;
    if (conn && typeof conn.addEventListener === "function") {
      conn.addEventListener("change", measureNetSpeed);
    }
  });
})();