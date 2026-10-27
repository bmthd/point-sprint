# Recovery code reissue implementation plan

**Goal:** Implement #235 from current origin/main, retaining passkeys, sessions, and encrypted records.

**Architecture:** Keep the master secret sealed by the device encryption key when unlocking. Reissue wraps that same secret with a fresh code and atomically updates the authenticated account’s verifier and wrap. Never send the code or secret. Existing devices without a sealed secret can recover it via their passkey PRF; devices without either source cannot reconstruct it.

**Alternatives:** Reusing the old code does not address loss. Re-encrypting records would disrupt other devices. Rewrapping the existing master preserves their keys.

- [x] Add behavioral tests for rotation, old code rejection (including a previously opened login dialog), preserved data/passkeys/sessions, authorization, and update failure.
- [x] Keep a sealed master in local sync metadata. Add a session-authorized, account-bound atomic recovery update and client rotation flow.
- [x] Add confirmation and reuse the code-saving dialog, resetting its acknowledgement for each code.
- [ ] Run checks and browser verification, review the final diff, create the PR using the template, and confirm Preview links return 200. Do not merge.

**Review focus:** Wrong account cookies; no local keys; legacy metadata; stale recovery wraps; failed or concurrent updates. A lost network response may leave a newly issued code unknown: the device retains its keys and can reissue again.

**Confirmed limitation:** When a legacy device cannot recover the root via PRF, explain why reissue is unavailable. The user approved this behavior.
