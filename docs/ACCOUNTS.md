# Accounts

PocketSoccer shares PocketFootball's and PocketBasketball's Firebase project (`blockfootball-a13c9`), so one email
and password signs in to all three. Email/Password sign-in and the authorized domain `eddyarriaga00.github.io` were
already switched on for basketball (2026-11-23).

- A PocketSoccer career is kept at `soccer/<uid>` (`{ at, dev, z: 0, data, name }`), never at basketball's
  `saves/<uid>`.
- **Rules**: `docs/firebase-rules.json` here is the full set for the shared project (basketball's rules plus the
  `soccer` node). Published on 2026-11-23 and checked: unauthenticated reads of `soccer/`, `saves/` and `chat/` all
  answer 401. **Any game that publishes rules must publish the union**, or the others lose their access.
- js/account.js: sign up, sign in, reset, sign out; the save goes up 4 s after the career saves and when the app goes
  to the background; a phone that played while the account also changed asks which save to keep.
