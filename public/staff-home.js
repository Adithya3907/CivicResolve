(function () {
  "use strict";

  function addHomeLink() {
    if (document.getElementById("staff-home-link")) return;

    const link = document.createElement("a");
    link.id = "staff-home-link";
    link.href = "/";
    link.textContent = "â† Return to Home";

    Object.assign(link.style, {
      position: "fixed",
      bottom: "20px",
      left: "20px",
      zIndex: "2147483647",
      display: "inline-flex",
      padding: "13px 19px",
      borderRadius: "10px",
      background: "#172a45",
      color: "#ffffff",
      textDecoration: "none",
      fontFamily: "Inter, Segoe UI, Arial, sans-serif",
      fontSize: "14px",
      fontWeight: "700",
      boxShadow: "0 5px 18px rgba(0,0,0,.2)"
    });

    document.body.appendChild(link);
  }

  addHomeLink();

  const observer = new window.MutationObserver(addHomeLink);
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  window.addEventListener("load", addHomeLink);
})();
