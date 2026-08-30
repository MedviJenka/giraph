import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { ChangesPanel } from "./ChangesPanel";
import { current, previous } from "../data/blueprint";
import { diffBlueprints } from "../lib/diff";
import { detectWarnings } from "../lib/rules";

const changes = diffBlueprints(previous, current);
const warnings = detectWarnings(current);

function setup(selectedId: string | null = null) {
  const onSelect = vi.fn();
  render(
    <ChangesPanel
      changes={changes}
      warnings={warnings}
      selectedId={selectedId}
      onSelect={onSelect}
    />,
  );
  return { onSelect };
}

describe("ChangesPanel", () => {
  it("lists every changed node once", () => {
    setup();
    expect(screen.getAllByTestId("change-item")).toHaveLength(3);
  });

  it("renders the added node with the added change kind", () => {
    setup();
    const added = screen
      .getAllByTestId("change-item")
      .find((el) => el.getAttribute("data-node-id") === "tokenService")!;
    expect(added).toHaveAttribute("data-change", "added");
    expect(added).toHaveTextContent("TokenService");
  });

  it("selects a node when its row is clicked", () => {
    const { onSelect } = setup();
    const row = screen
      .getAllByTestId("change-item")
      .find((el) => el.getAttribute("data-node-id") === "authService")!;
    fireEvent.click(row);
    expect(onSelect).toHaveBeenCalledWith("authService");
  });

  it("renders each architecture warning and selects its first node on click", () => {
    const { onSelect } = setup();
    const items = screen.getAllByTestId("warning-item");
    expect(items).toHaveLength(1);
    fireEvent.click(items[0]);
    expect(onSelect).toHaveBeenCalledWith("authRouter");
  });

  it("highlights the currently selected row", () => {
    setup("tokenService");
    const row = screen
      .getAllByTestId("change-item")
      .find((el) => el.getAttribute("data-node-id") === "tokenService")!;
    expect(within(row).getByText("TokenService")).toBeInTheDocument();
    expect(row).toHaveStyle({ fontWeight: "600" });
  });
});
