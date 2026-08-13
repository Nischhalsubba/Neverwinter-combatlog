# Widget drawer visibility regression

The base V6 drawer styles originally used `transform: translateX(24px)` and `opacity: 0`. The open animation then cleared its inline transform and opacity when it completed. Clearing those properties restored the hidden base CSS, so the drawer disappeared while the scrim remained visible.

`stability.css` makes the normal CSS state the visible state. The drawer can still animate out before removal, but clearing animation-owned inline properties now returns it to a visible, usable state instead of hiding it behind the scrim.
