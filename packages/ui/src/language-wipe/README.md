# Language Wipe

This directory defines the shared contract and CSS placeholder for the Liax Space language switch animation.

The animation uses the old language layer plus a new language overlay. During the transition, both layers must exist at the same time so tests can verify the intermediate state.

The overlay uses `clip-path: circle(...)` to reveal the new language from the user interaction origin.

Do not directly call `setLocale` and then play a decorative animation. Locale state should be committed only after the wipe transition has represented the change with both layers.

