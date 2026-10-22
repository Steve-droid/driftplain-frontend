import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { WelcomeSection } from "../home/WelcomeSection";

it("keeps decorative home motion paused without a toggle or disabling navigation", () => {
  const open = vi.fn();
  render(<WelcomeSection onCreateAgent={vi.fn()} onViewAgents={open} />);
  expect(screen.getByRole("main")).toHaveAttribute("data-motion", "paused");
  expect(screen.queryByRole("button", { name: /animations/i })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "View my CI agents" }));
  expect(open).toHaveBeenCalledOnce();
});
