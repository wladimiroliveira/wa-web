import { createBrowserRouter } from "react-router-dom";
import { LoginPage } from "@/features/auth/LoginPage";
import { RequireSession } from "@/features/auth/RequireSession";
import { HomePage } from "@/features/home/HomePage";

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  {
    element: <RequireSession />,
    children: [{ path: "/", element: <HomePage /> }],
  },
]);
