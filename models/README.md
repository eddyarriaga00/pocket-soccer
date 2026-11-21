# Player models

- `player.glb`: the skeleton and the movement clips (idle, walk, jog, sprint, jump...). From Quaternius's Universal
  Animation Library (CC0 1.0, https://quaternius.com), trimmed by PocketBasketball's `tools/model.mjs`.
- `body.glb`: the pocket player body (with its hair, beards and faces as tagged parts), built in Blender by
  PocketBasketball's `tools/body.py`. Shared with PocketBasketball so the pocket games have one family look.

The soccer kit (short-sleeved shirt, shorts, long socks, boots) is painted onto `body.glb` by the kit shader in
`js/model.js`; nothing in the files themselves is soccer-specific.
