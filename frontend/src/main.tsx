import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { SessionProvider } from "./app/session";
import { createRouter } from "./app/router";
import "./styles.css";
createRoot(document.getElementById("root")!).render(
  <SessionProvider>
    <RouterProvider router={createRouter()} />
  </SessionProvider>,
);
