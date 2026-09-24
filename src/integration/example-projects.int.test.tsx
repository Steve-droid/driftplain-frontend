import { usageFixture } from "../usage/fixtures";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "./msw.setup";
import { Dashboard } from "../pages/Dashboard";
import { projectsFixture } from "../test/fixtures";

it("shows labelled sample dashboards without setup prompts and lets visitors switch examples", async () => {
  const base = "http://localhost:8000";
  const examples = [
    { ...projectsFixture[0], id: 91, name: "Example: Pull Request Review", isExample: true, setupComplete: false },
    { ...projectsFixture[0], id: 92, name: "Example: Security Scan", taskType: "security_analysis", isExample: true, setupComplete: false },
  ];
  let chatRequests = 0;
  server.use(
    http.get(`${base}/auth/me`, () => HttpResponse.json({ id: 7, email: "visitor@example.com", chatEnabled: false })),
    http.get(`${base}/projects`, () => HttpResponse.json(examples)),
    http.get(`${base}/projects/:id/usage/v1`, () => HttpResponse.json(usageFixture)),
    http.get(`${base}/projects/:id/chat`, () => { chatRequests++; return HttpResponse.json({ messages: [] }); }),
  );
  const create = vi.fn();
  render(<Dashboard onNewProject={create} />);
  const notice = await screen.findByRole("region", { name: "Example project" });
  expect(within(notice).getByText("Example: Pull Request Review")).toBeInTheDocument();
  expect(within(notice).getByText(/sample CI runs/)).toBeInTheDocument();
  await screen.findByText("Usage and estimated cost");
  expect(screen.queryByText("Setup incomplete")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "CI-Agent actions" }));
  expect(screen.queryByText("Edit Jenkins")).not.toBeInTheDocument();
  expect(screen.queryByText("CI setup & token")).not.toBeInTheDocument();
  expect(screen.queryByText("Re-pick model")).not.toBeInTheDocument();
  expect(screen.getByRole("menuitem", { name: "Delete CI-Agent" })).toBeInTheDocument();
  fireEvent.change(screen.getByRole("combobox", { name: "Select CI-Agent" }), { target: { value: "92" } });
  await waitFor(() => expect(within(notice).getByText("Example: Security Scan")).toBeInTheDocument());
  fireEvent.click(screen.getByRole("button", { name: "Create your own CI agent" }));
  expect(create).toHaveBeenCalledOnce();
  expect(chatRequests).toBe(0);
});
