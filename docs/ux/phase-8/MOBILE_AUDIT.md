# Phase 8 mobile review

This is a targeted polish check, not another whole-product mobile redesign. Existing Phase7 navigation and protected workspace exits are untouched. The wider accepted application still needs the real-device regression route list in the runtime checklist.

Inspected source/static states: Quotes partial export, zero export, destructive confirmation; Orders full export and final-delete empty state; Invoices skipped deletion; New Quote customer/mode/plan guidance and Generic Trades; quote-structure name/empty confirmation; order-header template naming; recovery removal; long export failure list.

Each has checks at 1440x1000, 390x844, 320x720 and 844x390. No page-wide overflow in the 56 checked states. C66 disclosure/dismiss remain touch-sized and keyboard accessible. The newer Industry and Component Collection selects now stack below the existing sm breakpoint; data/flags/options are unchanged.

No claim is made about screen-reader timing, browser native download preferences, iOS keyboards, integrated drawer widths or real shell focus. Those require Gavin/owner runtime testing. Static fixtures use an ordinary main container rather than mocking a fully authenticated session.
