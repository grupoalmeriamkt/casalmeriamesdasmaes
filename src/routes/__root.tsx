import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { GTMLoader } from "@/components/GTMLoader";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Cestas Dia das Mães | Casa Almeria — Brasília" },
      {
        name: "description",
        content:
          "Presenteie sua mãe com uma cesta de café da manhã artesanal do Casa Almeria. Entrega ou retirada em Brasília. Encomende agora!",
      },
      { name: "author", content: "Casa Almeria" },
      { property: "og:title", content: "Cestas Dia das Mães | Casa Almeria — Brasília" },
      {
        property: "og:description",
        content: "Cestas artesanais de café da manhã para o Dia das Mães. Brasília-DF.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Cestas Dia das Mães | Casa Almeria — Brasília" },
      { name: "description", content: "Casa Almeria: Dia das Mães é um aplicativo web para criar e gerenciar pedidos de cestas." },
      { property: "og:description", content: "Casa Almeria: Dia das Mães é um aplicativo web para criar e gerenciar pedidos de cestas." },
      { name: "twitter:description", content: "Casa Almeria: Dia das Mães é um aplicativo web para criar e gerenciar pedidos de cestas." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/2b433d44-fead-43f1-8ead-79f75f583583/id-preview-7c874be3--04fe0105-ba1b-4822-b617-60997fa8a4f3.lovable.app-1777258903227.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/2b433d44-fead-43f1-8ead-79f75f583583/id-preview-7c874be3--04fe0105-ba1b-4822-b617-60997fa8a4f3.lovable.app-1777258903227.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500;1,600&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&family=Dancing+Script:wght@600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <>
      <GTMLoader />
      <Outlet />
    </>
  );
}
