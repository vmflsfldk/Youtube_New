import test from "node:test";
import assert from "node:assert/strict";

import { __resolvePlaylistTitleForTests as resolvePlaylistTitle } from "../src/worker";

test("resolvePlaylistTitle accepts name as a fallback", () => {
  const title = resolvePlaylistTitle({ name: "  새 플레이리스트  " });
  assert.equal(title, "새 플레이리스트");
});

test("resolvePlaylistTitle rejects blank titles", () => {
  assert.throws(() => resolvePlaylistTitle({ title: "   " }), {
    message: "title is required"
  });
});

test("resolvePlaylistTitle enforces maximum length", () => {
  const longTitle = "a".repeat(201);
  assert.throws(() => resolvePlaylistTitle({ title: longTitle }), {
    message: "title must be 200 characters or fewer"
  });
});
