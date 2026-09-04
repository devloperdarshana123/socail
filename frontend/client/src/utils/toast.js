export const showToast = (message, type = "success") => {
  const el = document.createElement("div");
  el.textContent = message;
  Object.assign(el.style, {
    position: "fixed",
    bottom: "24px",
    left: "50%",
    transform: "translateX(-50%)",
    background: type === "success" ? "#1e3a5f" : "#ef4444",
    color: "#fff",
    padding: "12px 28px",
    borderRadius: "50px",
    fontSize: "14px",
    fontWeight: "600",
    zIndex: "99999",
    boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
    animation: "fadeInUp .3s ease",
  });

  const style = document.createElement("style");
  style.textContent = `@keyframes fadeInUp { from { opacity:0; transform:translateX(-50%) translateY(12px) } to { opacity:1; transform:translateX(-50%) translateY(0) } }`;
  document.head.appendChild(style);
  document.body.appendChild(el);

  setTimeout(() => el.remove(), 3000);
};