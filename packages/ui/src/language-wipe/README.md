# Language Refresh

This directory defines the shared contract and CSS placeholder for the Liax Space language switch animation.

The animation uses the old language layer plus a new language overlay. During the transition, both layers must exist at the same time so tests can verify the intermediate state.

The overlay now uses a short opacity-only refresh. It should not move, scale, or reveal the page from the click origin.

Do not directly call `setLocale` and then play a decorative animation. Locale state should be represented by the refresh transition without whole-screen directional motion.
