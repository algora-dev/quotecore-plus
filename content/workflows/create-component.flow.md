---
workflow: create-component
screen: components
trade: any
title: Create a component
description: Walks a user through creating their first reusable component.
---

# Create a component

step: Open the Components page
ui: nav-components
until: route:components
say: This is where you manage every reusable component used in your quotes.

step: Start a new component
ui: add-component
until: exists:component-name
say: Click "+ Add Component" to begin. Components are the building blocks of every quote.

step: Name the component
ui: component-name
until: input_non_empty:component-name
say: Give it a recognisable name, e.g. "Roofing Iron" or "Building Paper".

step: Choose the component type
ui: component-type
until: exists:component-measurement
say: Pick "Main Component" for core materials, or "Extra" for one-off items.

step: Choose the measurement type
ui: component-measurement
until: selected:component-measurement
say: How is it measured — area, lineal, quantity, or fixed?

step: Set the material rate
ui: component-rates
until: input_non_empty:component-rates
say: Enter the price per unit so quotes auto-calculate material totals.

step: Save the component
ui: component-save
until: clicked:component-save
say: Save it to your library. You can edit it any time.
