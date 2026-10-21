---
title: Installing trail-code on macOS with broken CLT SDK
author: Matt
date: 2026-10-21
branch: main
cost: { minutes: 1, tokens: 41809 }
---

## Decided
Install with `SDKROOT=<Xcode-26.app>/Contents/Developer/Platforms/MacOSX.platform/Developer/SDKs/MacOSX26.5.sdk npm install -g @trailhq/trail-code`, then `trail init --agents claude`.

## Tried and ruled out
Plain `npm install -g @trailhq/trail-code` fails building tree-sitter-kotlin: the Command Line Tools SDK MacOSX27.0.sdk has malformed .tbd files ("tapi error: malformed file").

## Watch out
npm warns that install scripts (tree-sitter grammars, trail postinstall) are not covered by allowScripts; init still built the graph, but grammar loading for every language was not verified.
