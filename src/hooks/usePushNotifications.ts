import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

function isStandalone(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;
}

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function usePushNotifications() {
  const [suportado, setSuportado] = useState(false);
  const [precisaInstalar, setPrecisaInstalar] = useState(false);
  const [permissao, setPermissao] = useState<NotificationPermission | "indisponivel">("indisponivel");
  const [ativando, setAtivando] = useState(false);

  useEffect(() => {
    const temSuporte = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setSuportado(temSuporte);
    if (!temSuporte) return;

    // No iPhone, a API de notificação só existe quando o site foi instalado
    // (Adicionar à Tela de Início) e aberto pelo ícone — fora disso, nem
    // tenta, só sinaliza que precisa instalar primeiro.
    if (isIos() && !isStandalone()) {
      setPrecisaInstalar(true);
      return;
    }

    setPermissao(Notification.permission);
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  const ativarNotificacoes = async () => {
    if (!VAPID_PUBLIC_KEY) {
      throw new Error("VITE_VAPID_PUBLIC_KEY não configurada.");
    }
    setAtivando(true);
    try {
      const permission = await Notification.requestPermission();
      setPermissao(permission);
      if (permission !== "granted") return false;

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      const json = subscription.toJSON();
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Sessão inválida");

      const { error } = await (supabase as any).from("push_subscriptions").upsert({
        user_id: userId,
        endpoint: json.endpoint,
        p256dh: json.keys?.p256dh,
        auth: json.keys?.auth,
      }, { onConflict: "endpoint" });
      if (error) throw error;

      return true;
    } finally {
      setAtivando(false);
    }
  };

  return { suportado, precisaInstalar, permissao, ativando, ativarNotificacoes };
}
