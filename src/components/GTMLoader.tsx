import { useEffect, useRef } from "react";
import { useRouter } from "@tanstack/react-router";
import { useAdmin } from "@/store/admin";
import { trackPageView } from "@/lib/gtm";

/**
 * Injeta o snippet do Google Tag Manager quando o admin configura
 * um GTM ID em Integrações, e dispara `page_view` em cada navegação.
 */
export function GTMLoader() {
  const gtmId = useAdmin((s) => s.integracoes.gtmId);
  const router = useRouter();
  const injetado = useRef<string | null>(null);

  // Injeta o script do GTM uma única vez por id válido
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!gtmId || !/^GTM-[A-Z0-9]+$/i.test(gtmId)) return;
    if (injetado.current === gtmId) return;

    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });

    const s = document.createElement("script");
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtm.js?id=${gtmId}`;
    document.head.appendChild(s);

    // <noscript> fallback iframe
    const ns = document.createElement("noscript");
    const ifr = document.createElement("iframe");
    ifr.src = `https://www.googletagmanager.com/ns.html?id=${gtmId}`;
    ifr.height = "0";
    ifr.width = "0";
    ifr.style.display = "none";
    ifr.style.visibility = "hidden";
    ns.appendChild(ifr);
    document.body.insertBefore(ns, document.body.firstChild);

    injetado.current = gtmId;
    // primeiro page_view
    trackPageView();
  }, [gtmId]);

  // page_view em cada mudança de rota
  useEffect(() => {
    if (!gtmId) return;
    const unsub = router.subscribe("onResolved", ({ toLocation }) => {
      trackPageView(toLocation.pathname);
    });
    return unsub;
  }, [router, gtmId]);

  return null;
}
