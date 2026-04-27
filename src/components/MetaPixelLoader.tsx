import { useEffect, useRef } from "react";
import { useRouter } from "@tanstack/react-router";
import { useAdmin } from "@/store/admin";
import { fbqTrack, isPixelReady, newEventId, sendCapiEvent } from "@/lib/metaPixel";

/**
 * Injeta o Meta Pixel quando o admin configura um Pixel ID em Integrações
 * e dispara PageView (Pixel + Conversions API com deduplicação) em cada navegação.
 */
export function MetaPixelLoader() {
  const pixelId = useAdmin((s) => s.integracoes.metaPixelId);
  const accessToken = useAdmin((s) => s.integracoes.metaAccessToken);
  const testEventCode = useAdmin((s) => s.integracoes.metaTestEventCode);
  const router = useRouter();
  const injetado = useRef<string | null>(null);

  // Injeta o snippet base do Pixel
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!pixelId || !/^\d{6,20}$/.test(pixelId)) return;
    if (injetado.current === pixelId) return;

    // Snippet oficial (compactado)
    /* eslint-disable */
    (function (f: any, b: Document, e: string, v: string) {
      if (f.fbq) return;
      const n: any = (f.fbq = function () {
        n.callMethod
          ? n.callMethod.apply(n, arguments)
          : n.queue.push(arguments);
      });
      if (!f._fbq) f._fbq = n;
      n.push = n;
      n.loaded = true;
      n.version = "2.0";
      n.queue = [];
      const t = b.createElement(e) as HTMLScriptElement;
      t.async = true;
      t.src = v;
      const s = b.getElementsByTagName(e)[0];
      s.parentNode?.insertBefore(t, s);
    })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
    /* eslint-enable */

    window.fbq!("init", pixelId);
    injetado.current = pixelId;

    // Primeiro PageView
    const eventId = newEventId("pv");
    fbqTrack("PageView", {}, eventId);
    void sendCapiEvent({
      pixelId,
      accessToken,
      testEventCode,
      eventName: "PageView",
      eventId,
    });
  }, [pixelId, accessToken, testEventCode]);

  // PageView em cada mudança de rota
  useEffect(() => {
    if (!pixelId) return;
    const unsub = router.subscribe("onResolved", () => {
      if (!isPixelReady()) return;
      const eventId = newEventId("pv");
      fbqTrack("PageView", {}, eventId);
      void sendCapiEvent({
        pixelId,
        accessToken,
        testEventCode,
        eventName: "PageView",
        eventId,
      });
    });
    return unsub;
  }, [router, pixelId, accessToken, testEventCode]);

  return null;
}
