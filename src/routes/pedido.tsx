import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/pedido")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
});
