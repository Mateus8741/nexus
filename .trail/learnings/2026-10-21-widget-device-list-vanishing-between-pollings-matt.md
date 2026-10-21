---
title: Widget device list vanishing between pollings
author: Matt
date: 2026-10-21
branch: main
cost: { minutes: 1, tokens: 44582 }
touches:
  - apps/desktop/src/renderer/widget/main.ts
---

## Decided
In apps/desktop/src/renderer/widget/main.ts renderList: update cards in place every poll, and only build sections/grids and move (append) cards into them when the layout string changes, right before list.replaceChildren.

## Tried and ruled out
Building sections and appending cards to new grids on every render, then skipping replaceChildren when layout was unchanged: the cards get reparented into detached grids, so the visible group is left with an empty grid (title shown, devices gone, summary count still right).

## Watch out
Any "don't remount to keep clicks alive" optimization must not reparent the cached cards (cards Map) unless the new container is actually mounted. Not verified in the running app, only typechecked.
