import { createFileRoute, Outlet } from "@tanstack/react-router";
import { authGuard } from "./-authGuard";

export const Route = createFileRoute("/biblioteca")({
  beforeLoad: authGuard,
  component: Outlet,
});
