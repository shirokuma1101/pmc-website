const embedded = new URLSearchParams(window.location.search).get("embedded") === "1";

if (embedded) {
  document.documentElement.classList.add("pmc-bluemap-embedded");
}
