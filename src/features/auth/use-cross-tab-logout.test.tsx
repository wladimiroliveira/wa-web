import { act, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test } from "vitest";
import { Route, Routes } from "react-router-dom";
import { useCrossTabLogout } from "@/features/auth/use-cross-tab-logout";
import { REFRESH_TOKEN_KEY, clearSession, getAccessToken, setAccessToken, setRefreshToken } from "@/lib/tokens";
import { renderWithProviders } from "@/tests/render";

function Watcher() {
  useCrossTabLogout();
  return <p>protected content</p>;
}

function renderWatcher() {
  return renderWithProviders(
    <Routes>
      <Route path="/" element={<Watcher />} />
      <Route path="/login" element={<p>login screen</p>} />
    </Routes>,
    { route: "/" },
  );
}

/** jsdom does not emit `storage` for same-window writes; dispatch it directly. */
function emitStorage(key: string, newValue: string | null) {
  act(() => {
    window.dispatchEvent(new StorageEvent("storage", { key, newValue }));
  });
}

beforeEach(() => {
  clearSession();
});

describe("useCrossTabLogout", () => {
  test("drops the local session when another tab logs out", async () => {
    setAccessToken("access-1");
    setRefreshToken("refresh-1");

    renderWatcher();
    emitStorage(REFRESH_TOKEN_KEY, null);

    expect(await screen.findByText("login screen")).toBeInTheDocument();
    expect(getAccessToken()).toBeNull();
  });

  test("ignores a rotation in another tab — this tab's access token is still valid", () => {
    setAccessToken("access-1");
    setRefreshToken("refresh-1");

    renderWatcher();
    emitStorage(REFRESH_TOKEN_KEY, "refresh-2");

    expect(screen.getByText("protected content")).toBeInTheDocument();
    expect(getAccessToken()).toBe("access-1");
  });

  test("ignores unrelated storage keys", () => {
    setAccessToken("access-1");
    setRefreshToken("refresh-1");

    renderWatcher();
    emitStorage("some.other.key", null);

    expect(screen.getByText("protected content")).toBeInTheDocument();
  });

  test("stops listening once the component unmounts", () => {
    setAccessToken("access-1");
    setRefreshToken("refresh-1");

    const { unmount } = renderWatcher();
    unmount();
    emitStorage(REFRESH_TOKEN_KEY, null);

    // If the listener were still attached, this would have cleared the token.
    expect(getAccessToken()).toBe("access-1");
  });
});
