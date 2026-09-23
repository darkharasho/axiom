# Release Notes

Version v0.3.23 — September 23, 2026

## The front page wears its name

The app list now opens under a gold masthead carrying the AxiOM wordmark. Sub-views keep the plain header — they're interiors, and only the front page gets the title card.

Rows are cards now, and each app's icon sits in a tile that takes on the colour of its state: gold when an update is waiting, green while the app is running, red if something went wrong. The verdict reads straight down the column of icons without having to read a word of it.

## Fixes

- The row menu no longer opens off the bottom of the window. Opening it from one of the last apps in the list used to push it under the edge of the scrolling area, where it was cut off; it now checks the room beneath itself and hangs above the row when there isn't enough.
- Long arcdps plugin descriptions no longer push a row out of shape — they trim, with the full text on hover.
- A Guild Wars 2 path too long for the window shows its last two folders instead of breaking across lines mid-word. Hover for the whole path.
