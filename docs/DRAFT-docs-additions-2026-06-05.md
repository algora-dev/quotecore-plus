# DRAFT — Docs additions 2026-06-05
**Status:** Draft for Shaun's proofreading. Do not publish directly.
**Writer:** Gavin (subagent). Read actual source code for every UI detail.

---

## INDEX

| # | Type | Target file | Summary |
|---|------|-------------|---------|
| 1 | NEW | `content/docs/catalog/overview.mdx` | Catalog Library overview |
| 2 | NEW | `content/docs/catalog/uploading-a-catalog.mdx` | CSV upload wizard |
| 3 | NEW | `content/docs/catalog/column-maps.mdx` | Column maps & multi-map |
| 4 | NEW | `content/docs/catalog/using-catalog-items.mdx` | Using catalog items in quotes & orders |
| 5 | NEW | `content/docs/attachments/overview.mdx` | Attachment Library overview |
| 6 | NEW | `content/docs/attachments/library-and-defaults.mdx` | Library management & template defaults |
| 7 | NEW | `content/docs/attachments/sending-attachments.mdx` | Sending attachments to customers |
| 8 | NEW | `content/docs/help/meet-q.mdx` | Meet Q (the AI assistant) |
| 9 | NEW | `content/docs/help/guide-me.mdx` | Guide Me walkthroughs |
| 10 | REWRITE | `content/docs/help/copilot.mdx` | Rewrite to describe Q / Guide Me |
| 11 | NEW | `content/docs/material-orders/order-layouts.mdx` | Order layout picker overview |
| 12 | NEW | `content/docs/material-orders/line-by-line-editor.mdx` | Line-by-line order editor |
| 13 | NEW | `content/docs/material-orders/order-from-a-quote.mdx` | Create an order from a quote |
| 14 | NEW | `content/docs/follow-ups/follow-ups.mdx` | Automated follow-ups |
| 15 | EDIT | `content/docs/material-orders/creating-orders.mdx` | Add layout-picker note |
| 16 | EDIT | `content/docs/flashings/flashings.mdx` | Add generic-trade aside |
| 17 | EDIT | `content/docs/customer-facing/sending-and-acceptance.mdx` | Add attachment cross-link |
| 18 | EDIT | `content/docs/templates/email-templates.mdx` | Add default attachment note |
| 19 | EDIT | `content/docs/help/changelog.mdx` | New changelog block |

---

---

## NEW DOCS

---

### DOC 1

**Target file:** `content/docs/catalog/overview.mdx`

```mdx
---
title: Catalog Library
description: Upload supplier price lists, custom quote items, stored material or labor rates as CSV files and search them to easily add to quotes or orders.
order: 1
status: published
updated: 2026-06-05
---

# Catalog Library

The Catalog Library lets you upload your own CSV file — and search specific data from each row to add custom lines to quotes and orders. Pick an item from search results and it drops straight onto the quote with the mapped description and price already filled in for you to leave as is or edit further, saving a lot of time typing, or copy/pasting from other docs.

<Callout type="note">
Catalog Library is available on **Pro and above**. On Starter and Growth the Catalogs tab in the Resource Library opens an upgrade prompt.
</Callout>

## Where to find it

**Resource Library > Catalogs tab.**

## What the catalog list shows

Each catalog you've uploaded appears as a row with:

- **Name** — the label you gave it.
- **Rows / size** — how many data rows and how much storage it uses.
- **Status** — Ready, Importing, Archived, or Error.
- **Last activity** — when it was last updated.

Click a catalog row to edit it. Use the icon buttons on hover to archive or delete it.

## Plan limits

Your plan allows a set number of active catalogs. The page shows how many you've used. Archiving a catalog frees a slot; the data is kept and the catalog can be reinstated later.

## Related

- [Uploading a catalog](/docs/catalog/uploading-a-catalog)
- [Column maps](/docs/catalog/column-maps)
- [Using catalog items in quotes](/docs/catalog/using-catalog-items)
```

---

### DOC 2

**Target file:** `content/docs/catalog/uploading-a-catalog.mdx`

```mdx
---
title: Uploading a catalog
description: Import a CSV price list into the Catalog Library in four steps.
order: 2
status: published
updated: 2026-06-05
---

# Uploading a catalog

Go to **Resource Library > Catalogs**, then click **Upload catalog**. A four-step wizard opens.

## Step 1 — Choose a CSV file

Drop your file onto the upload area, or click it to browse. Only CSV files are accepted.

<!-- VERIFY: The wizard UI text says "Up to 20,000 rows" but the code enforces a 35,000-row limit. Confirm which cap is correct before publishing. -->
change wizard to say 35,000

- Maximum **35,000 data rows** per catalog. If your file has more, only the first 35,000 are imported and a warning appears.
- The wizard detects whether row 1 is a header row automatically. If your file has no headers, columns are labelled A, B, C and so on.

**Tips for clean imports:**

- Give columns clear names if possible (e.g. Description, Price, Pack Size).
- One item per row.
- Currency symbols (£, $, €) in price columns are stripped automatically — no need to clean them out first.

## Step 2 — Name your catalog

The wizard pre-fills the catalog name from your filename. Edit it to anything that helps you find it later, for example "Supplier Name — 2026".

The screen also shows a summary: row count, column count, and the original filename. If the wizard spotted any issues (e.g. too many rows), a warning box appears here.

## Step 3 — Preview and map columns

You'll see a preview of the first five rows of your file, with your columns laid out.

Map your columns to three optional fields:

| Field | What it does |
|-------|-------------|
| **Item / Description** | The primary line text added to the quote. |
| **Description / Quantity** | Secondary text appended after the primary (e.g. pack size). |
| **Price** | The amount inserted on the quote line. |

The wizard tries to auto-detect the right columns from your header names. Check the preview — highlighted columns show which mapping has been applied.

All three mappings are optional. Columns you leave unmapped are still stored; you can remap them later without re-uploading.

> **Tip:** You can add extra column maps over this same file after saving — no re-upload needed. See [Column maps](/docs/catalog/column-maps).

## Step 4 — Save

Review the summary (name, row count, and how each field is mapped) then click **Save catalog**. A progress bar tracks the import. Large catalogs may take a few seconds.

When the import finishes the catalog appears in the list with a **Ready** status.

## Editing a catalog after import

Click any catalog row to open the edit modal. Three tabs are available:

- **Rename** — change the catalog name.
- **Column mapping** — update which columns map to each field without re-uploading.
- **Maps** — manage multiple named column maps over the same file. See [Column maps](/docs/catalog/column-maps).

## Archiving and deleting

- **Archive** — hides the catalog from the active list and from search. The data is kept and storage still counts toward your plan. You can reinstate it at any time.
- **Delete** — permanently removes the catalog and all its rows. This frees storage. Cannot be undone.

## Related

- [Column maps](/docs/catalog/column-maps)
- [Using catalog items in quotes](/docs/catalog/using-catalog-items)
- [Catalog Library overview](/docs/catalog/overview)
```

---

### DOC 3

**Target file:** `content/docs/catalog/column-maps.mdx`

```mdx
---
title: Column maps
description: Add multiple named column mappings to one catalog — no re-upload needed.
order: 3
status: published
updated: 2026-06-05
---

# Column maps

A column map tells the app which columns in your CSV file correspond to the item description, quantity text, and price that will show on your quote/order. Every catalog has at least one map (the default). You can add more named maps over the same file without re-uploading it or using extra storage.

## Why you'd use multiple maps

Your supplier might use the same price list file but you want to search it two ways — for example, one map that pulls in retail prices and one for trade prices from different columns. Create a separate map for each. Or perhaps you pull information from certain columns for quoting, and other columns, like product code/key for ordering as an example.

## Where to find it

Click a catalog row in **Resource Library > Catalogs** to open the edit modal, then open the **Maps** tab.

## What you'll see

A list of all maps for that catalog. The **default** map is the one created when you uploaded the file. It cannot be deleted (but it can be renamed and remapped).

Each row shows the map name and two action buttons: **Edit** and **Delete** (non-default maps only).

## Adding a map

1. Click **+ Add extra map for this catalog**.
2. Give the map a name (e.g. "Trade prices").
3. Use the column-mapping dropdowns to assign your columns to Item / Description, Description / Quantity, and Price.
4. A file preview shows the first few rows so you can check you've picked the right columns.
5. Click **Save**.

## How maps appear in search

When you open the catalog search in a quote or order, a **Catalog** dropdown appears if you have more than one catalog or map. Each named map shows up as a separate option. Selecting a map applies its column interpretation to search results.

## Related

- [Uploading a catalog](/docs/catalog/uploading-a-catalog)
- [Using catalog items in quotes](/docs/catalog/using-catalog-items)
```

---

### DOC 4

**Target file:** `content/docs/catalog/using-catalog-items.mdx`

```mdx
---
title: Using catalog items in quotes and orders
description: Search your uploaded catalogs and add items directly to quote or order lines.
order: 4
status: published
updated: 2026-06-05
---

# Using catalog items in quotes and orders

Once you've uploaded at least one catalog, you can search it while building a quote or a line-by-line order and add items with one click.

## Where to find it

Open a quote in the customer editor, or open a line-by-line order editor. Click **+ Add New Line** — a modal opens with three tabs: **Custom**, **Add a component**, and **Search catalog**. Select the **Search catalog** tab.

<!-- VERIFY: Confirm the exact button label is "+ Add New Line" on both the quote editor and the line-by-line order editor. -->

## Searching the catalog

1. If you have more than one catalog or multiple maps, a **Catalog** dropdown appears at the top. Pick which catalog or map you want to search against.
2. Type in the search box. Results appear as you type (up to 50 shown).
3. Each result shows the item description, secondary text (e.g. pack size), and price — based on the column map you selected.
4. Click a result to add it as a line on the quote or order. The line is created with the mapped description and price pre-filled.

## What gets added to the line

- The **Item / Description** column value becomes the line text.
- If a **Description / Quantity** column is mapped, its value is appended to the line text (separated by a dash).
- The **Price** column value becomes the line amount. If no price column is mapped, or the value can't be parsed as a number, the line is added with a zero amount.

## If you have no catalogs

The search modal shows a prompt to upload a catalog first. Go to **Resource Library > Catalogs** and upload a CSV file.

## Related

- [Catalog Library overview](/docs/catalog/overview)
- [Uploading a catalog](/docs/catalog/uploading-a-catalog)
- [Column maps](/docs/catalog/column-maps)
```

---

### DOC 5

**Target file:** `content/docs/attachments/overview.mdx`

```mdx
---
title: Attachment Library
description: Upload files once and reuse them across quotes, orders, and email templates.
order: 1
status: published
updated: 2026-06-05
---

# Attachment Library

The Attachment Library is a central store for files you send to customers — technical drawings, terms and conditions, specific details requests, or anything else you want to include with a quote or order.

Upload a file once. Attach it to any quote or order at send time, or bake it into an email template so it's always pre-selected.

<Callout type="note">
The Attachment Library is available on **Pro and above**. On Starter and Growth the Attachments tab in the Resource Library shows an upgrade prompt. Quote-specific file uploads (from within a quote) are not affected — those work on all plans.
</Callout>

## Where to find it

**Resource Library > Attachments tab.**

## Supported file types

- PDF
- Images (JPEG, PNG, and other common image formats)
- ZIP archives

Maximum file size: **50 MB** per file.

## What the library shows

Each file in your library is listed with:

- **Name** — the display name you gave it (not the original filename).
- **File** — the original filename, shown below the name.
- **Size** — file size.

Active files appear first. Archived files appear below with an Archived badge.

## Plan limits

Your plan allows a set number of library files. The Attachments tab shows how many you've used.

## Related

- [Managing your attachment library](/docs/attachments/library-and-defaults)
- [Sending attachments to customers](/docs/attachments/sending-attachments)
```

---

### DOC 6

**Target file:** `content/docs/attachments/library-and-defaults.mdx`

```mdx
---
title: Managing your attachment library
description: Upload, rename, archive, and set template defaults for your attachment files.
order: 2
status: published
updated: 2026-06-05
---

# Managing your attachment library

## Uploading a file

Go to **Resource Library > Attachments** and click **Upload file**. A modal opens:

1. Click the upload area (or drag a file onto it) to choose a file. Accepted: PDF, images, ZIP. Maximum 50 MB.
2. Give the file a **name** — this is what customers see when they receive it. The name is pre-filled from the filename; change it to something descriptive (e.g. "Terms and Conditions 2026" rather than "TC_v3_final.pdf").
3. Click **Save**.

The file uploads and appears in your library.

## Renaming a file

Hover over a file row and click the pencil (rename) icon. Enter a new name and click **Save**.

## Archiving and reinstating

- **Archive** — hover over a file row and click the archive icon. The file moves to the bottom of the list with an Archived badge. It won't appear in the send picker or the template default selector while archived.
- **Reinstate** — hover over an archived file and click the reinstate icon (circular arrow) to make it active again.

## Deleting a file

Hover over a file row and click the delete (bin) icon, then confirm.

<Callout type="warning">
Deleting a file is permanent. It removes the file from storage, clears it from any email template that uses it as a default, and **breaks existing download links** on any quotes or orders that have already been sent with that file attached.
</Callout>

## Baking a default into an email template

You can pre-select one library file per email template. When that template is used to send to a recipient, the file is already ticked in the send picker — the sender can still change it or untick it before sending.

To set a default:

1. Go to **Resource Library > Message** tab.
2. Edit (or create) an email template.
3. Scroll to the **Default attachment** section.
4. Pick a file from the dropdown (active library files only).
5. Save the template.

> The file must be in your active library. If it's archived or deleted, the default is cleared automatically.

## Related

- [Attachment Library overview](/docs/attachments/overview)
- [Sending attachments to customers](/docs/attachments/sending-attachments)
- [Email templates](/docs/templates/email-templates)
```

---

### DOC 7

**Target file:** `content/docs/attachments/sending-attachments.mdx`

```mdx
---
title: Sending attachments to customers/recipients
description: Attach files to a quote or order when sending, and how customers download them.
order: 3
status: published
updated: 2026-06-05
---

# Sending attachments to customers

When you send a quote or order to a customer, you can attach files for them to download.

## Where to find it

Open the **Send quote** or **Send order** modal. The **Attachments** section appears below the email fields.

## Picking which files to attach

The picker shows a dropdown summary ("2 files attached" / "Select files"). Click it to open the file list.

Two sources are available:

- **This quote's files** — any files you uploaded directly to that quote.
- **Attachment library** — files from your [Attachment Library](/docs/attachments/overview) (Pro and above).

Tick any files you want to include. Untick to remove them. Click **Clear** to remove all selections.

If a template default attachment was set on the email template you chose, it will already be ticked when the modal opens. You can untick it or add more files before sending.

## What the customer sees

After the customer opens their quote or order link, an **Attachments** section appears on the page listing all attached files. Each file has two buttons:

- **View** — opens the file in a new browser tab.
- **Download** — saves the file directly to their device.

If there are multiple files, a **Download All** button appears at the top of the attachments section to download them one after another.

Download links are tied to the quote's access token — they only work while the quote link is valid.

## Related

- [Attachment Library overview](/docs/attachments/overview)
- [Managing your attachment library](/docs/attachments/library-and-defaults)
- [Sending and acceptance](/docs/customer-facing/sending-and-acceptance)
```

---

### DOC 8

**Target file:** `content/docs/help/meet-q.mdx`

```mdx
---
title: Meet Q
description: Q is the in-app AI assistant that answers questions about QuoteCore+.
order: 2
status: published
updated: 2026-06-05
---

# Meet Q

Q is the AI chat assistant built into QuoteCore+. Ask it questions about the app and it answers in plain language. Switch to Guide Me mode and it walks you through tasks step by step, pointing at the exact control you need to click.

## Where to find it

A small circular button with Q's face appears in the **bottom-right corner** of every page. Click it to open the chat panel.

## Two modes

The chat panel has a mode toggle in the header bar:

- **Respond** — ask Q any question about the app. It searches the help docs and gives you a direct answer.
- **Guide me** — Q walks you through how to do something on the current page. Switch to this mode and Q automatically starts a walkthrough for where you are.

## Highlights

In Guide Me mode a **Highlights** toggle appears next to the mode switcher. When on, Q visually points to the exact control you need to interact with — the element glows on screen. When off, Q describes where to find it in text instead.

## Conversations

- The panel is draggable — click and drag the header bar to reposition it anywhere on screen.
- While the panel is open you can click **Hide** (top-right of the panel) to collapse it back to the launcher button. Your conversation is kept; click the launcher to reopen it at the same point.
- A small orange dot on the launcher button means there's an existing conversation to return to.
- Click **New conversation** (if shown) to start fresh.

## Hiding Q completely

If you don't want the launcher button to appear at all, go to **Account > Show the Chat Assistant (Q)** and turn the toggle off. The button and chat panel are hidden everywhere in the app. Turn the toggle back on to show it again.

## Related

- [Guide Me walkthroughs](/docs/help/guide-me)
```

---

### DOC 9

**Target file:** `content/docs/help/guide-me.mdx`

```mdx
---
title: Guide Me walkthroughs
description: Let Q walk you step by step through any task in QuoteCore+.
order: 3
status: published
updated: 2026-06-05
---

# Guide Me walkthroughs

Guide Me is Q's walkthrough mode. Instead of answering a one-off question, Q coaches you through a task one step at a time — narrating what to do, pointing at the right control, and moving to the next step when you're ready.

## Starting a walkthrough

1. Open Q (the circular button, bottom-right corner).
2. Switch to **Guide me** using the toggle in the panel header.
3. Q automatically starts a walkthrough for the page you're on. If there's a relevant guide for your current screen, Q sends the first step immediately.
4. If you want guidance on something else, type what you want to do — for example "How do I upload a catalog?" — and Q picks the right walkthrough.

## Highlights

In Guide Me mode the **Highlights** toggle appears. When it's on, Q visually highlights the control it's talking about — a glow or pulse appears around the element on screen. This makes it easy to spot exactly what Q is pointing at.

When Highlights is off, Q describes where to find the control in text instead.

## Cross-page guidance

Q can guide you across multiple pages. If a task requires you to navigate to a different screen, Q will tell you what page to go to and continue guiding you once you get there.

## Turning off Guide Me

Switch back to **Respond** mode at any time using the mode toggle. Your current walkthrough state is cleared on the next new conversation.

## Related

- [Meet Q](/docs/help/meet-q)
```

---

### DOC 10 — REWRITE OF `content/docs/help/copilot.mdx`

**Target file:** `content/docs/help/copilot.mdx`
*(Full replacement — the old Copilot runtime has been removed; this page should now describe Q.)*

```mdx
---
title: Chat Assistant (Q)
description: Q is the in-app AI assistant that answers questions and guides you through tasks.
order: 1
status: published
updated: 2026-06-05
---

# Chat Assistant (Q)

Q is the AI assistant built into QuoteCore+. It lives in the bottom-right corner of every page as a small circular button with Q's face.

## What Q can do

- **Answer questions** — ask Q anything about the app in plain language. It draws on the QuoteCore+ help documentation to give accurate answers.
- **Walk you through tasks** — switch to Guide Me mode and Q coaches you step by step, highlighting the exact controls to use.

## Opening Q

Click the **Q launcher button** in the bottom-right corner of any page. The chat panel opens.

## Two modes

Use the toggle in the panel header to switch between:

| Mode | What it does |
|------|-------------|
| **Respond** | Answers your questions about the app. |
| **Guide me** | Walks you through a task step by step, with optional visual highlights on screen. |

For more on Guide Me, see [Guide Me walkthroughs](/docs/help/guide-me).

## Hiding Q

- **Temporarily:** click **Hide** in the panel header. Q collapses to the launcher button; your conversation is preserved.
- **Permanently:** go to **Account** and turn off the **Show the Chat Assistant (Q)** toggle. The launcher button disappears from the whole app. Turn the toggle on again to bring it back.

## Related

- [Meet Q](/docs/help/meet-q)
- [Guide Me walkthroughs](/docs/help/guide-me)
```

---

### DOC 11

**Target file:** `content/docs/material-orders/order-layouts.mdx`

```mdx
---
title: Order layouts
description: Choose how your material order looks before you start editing — Line by Line, Single Column, or Double Column.
order: 2
status: published
updated: 2026-06-05
---

# Order layouts

When you create a new material order you must pick a layout before editing begins. The layout controls the overall structure of the order document. You can't switch layouts after creation, so pick the one you want up front.

## The three layouts

A "Choose an order layout" screen appears with three cards:

### Line by Line

A clean text list — item, description, quantity, and price per line. Each line can be shown or hidden, priced or unpriced, and included or excluded from the total independently.

Best for simple orders where you want a priced, itemised list that matches the style of a customer quote.

### Single Column

Item blocks stacked in one column, each block containing the component name, associated drawings or images, and measurements. This is the same as the original Components & Images order editor.

### Double Column

The same item blocks as Single Column, arranged two per row. Useful for longer orders where you want to fit more on each printed page.

## Changing the layout after creation

You can't change a Line by Line order to Single or Double Column, or vice versa, after it's been saved. If you need a different layout, create a new order.

Within Single and Double Column, you can toggle between the two column modes inside the editor at any time.

## Related

- [Creating material orders](/docs/material-orders/creating-orders)
- [Line-by-line order editor](/docs/material-orders/line-by-line-editor)
- [Order from a quote](/docs/material-orders/order-from-a-quote)
```

---

### DOC 12

**Target file:** `content/docs/material-orders/line-by-line-editor.mdx`

```mdx
---
title: Line-by-line order editor
description: Add, edit, and control priced lines in a Line by Line material order.
order: 3
status: published
updated: 2026-06-05
---

# Line-by-line order editor

The line-by-line editor is the editor for orders created with the **Line by Line** layout. It works similarly to the customer quote editor — each line has a description, an optional price, and per-line controls for visibility and totalling.

## Layout

The editor is split into two panels:

- **Left — Order items:** the line list, footer, and tax controls.
- **Right — Preview:** a live preview of how the order will look when sent or printed.

You can collapse the left panel using the collapse button to give the preview more space.

## Adding lines

Click **+ Add New Line** at the bottom of the order items panel. A modal opens with three tabs:

- **Custom** — type an item description, optional quantity/detail text, and a price.
- **Add a component** — pick a component from your library. The line lands with the component name pre-filled; you set the price in the preview.
- **Search catalog** — search your uploaded catalog files. See [Using catalog items in quotes](/docs/catalog/using-catalog-items).

## Per-line controls

Each line has the following controls:

| Control | What it does |
|---------|-------------|
| **Edit** | Opens the line edit form to change the description, quantity text, or price. |
| **Show** | Tick to include the line in the order; untick to hide it from the preview, PDF, and customer copy. |
| **Price** | Tick to show the line's price; untick to hide the price on this line only. |
| **In total** | Tick to include this line in the order subtotal; untick to show the line but exclude it from the total. |
| **▲ / ▼** | Move the line up or down in the list. |

## Hide all prices

The **Hide all prices** checkbox at the top of the order items panel overrides all per-line price settings with a single click. When ticked, no prices, subtotals, or totals appear anywhere in the preview or on the sent order. Untick to restore individual line settings.

This is useful if you want a "labour order" or quantities-only version without manually unticking every line.

## Footer

Below the line list is a free-text footer field. The footer appears at the bottom of the order document — use it for delivery notes, supplier references, or any other instructions.

## Taxes (optional)

Optional tax lines can be added below the footer. You can type a custom tax name and rate, or apply one of your company's saved default taxes.

## Order number

Orders are numbered automatically in the format **ON-0NNNN** (e.g. ON-01234). The number is shown on the order preview and on the order list page.

## Related

- [Order layouts](/docs/material-orders/order-layouts)
- [Order from a quote](/docs/material-orders/order-from-a-quote)
- [Using catalog items in quotes](/docs/catalog/using-catalog-items)
```

---

### DOC 13

**Target file:** `content/docs/material-orders/order-from-a-quote.mdx`

```mdx
---
title: Order from a quote
description: Create a material order pre-populated from an existing quote's priced lines.
order: 4
status: published
updated: 2026-06-05
---

# Order from a quote

When you create an order linked to a quote, the order can be pre-populated with the quote's priced lines. This saves re-entering items you've already priced.

## How to start

From the **Material Orders** page, click **New order** (or the equivalent create button). When asked to pick a source, select an existing quote. <!-- VERIFY: Confirm the exact UI for starting an order from a quote — the "New order from quote" entry point. -->

Then choose your [order layout](/docs/material-orders/order-layouts). The Line by Line layout pre-populates the priced lines from the quote; Single and Double Column layouts pre-populate components as before.

## What gets pre-filled (Line by Line)

When you choose the Line by Line layout and link it to a quote:

- All visible, priced lines from the customer quote are copied across as order lines.
- The footer text from the quote is copied to the order footer.
- Tax lines from the quote are included.

You can then edit, add, remove, or reorder lines as needed.

## Hiding prices on a supplier order

If you don't want the supplier to see prices, tick **Hide all prices** in the order items panel. This hides all pricing from the preview and the sent/printed order in one click.

## Editing after creation

Everything in the order is editable regardless of how it was created. Changes to the order don't affect the original quote.

## Related

- [Order layouts](/docs/material-orders/order-layouts)
- [Line-by-line order editor](/docs/material-orders/line-by-line-editor)
- [Creating material orders](/docs/material-orders/creating-orders)
```

---

### DOC 14

**Target file:** `content/docs/follow-ups/follow-ups.mdx`

```mdx
---
title: Automated follow-ups
description: Schedule automatic chase emails for your quotes/orders — set it once and the app sends at the right time.
order: 1
status: published
updated: 2026-06-05
---

# Automated follow-ups

Automated follow-ups let you schedule a chase email for a quote. You pick the template, the trigger, and the wait time — the app sends the email automatically at the calculated time.

<Callout type="note">
Automated follow-ups are available on **Pro and above**.
</Callout>

## Where to find it

Open a quote and go to its **summary page**. In the **Activity** card, switch to the **Scheduled** tab, then click **Schedule follow-up**.

## Setting up a follow-up

The "Schedule a follow-up" modal has the following fields:

### Email template

Pick which [email template](/docs/templates/email-templates) to send. You need at least one template saved before you can schedule a follow-up. Templates are managed under **Resource Library > Message**.

### Trigger

Choose when the clock starts:

| Trigger | When it fires |
|---------|--------------|
| After the quote was sent | Relative to the first time you sent the quote (only available after at least one send). |
| After the customer accepts | Fires when the customer accepts the quote, plus your wait time. Can be scheduled before acceptance happens — the app parks it and activates it when the event occurs. |
| After the customer declines | Same as above, but triggered by a decline. |
| Starting now | Starts counting from the moment you schedule it. |

### Wait

Set how many **hours** or **days** after the trigger the email should send.

The modal shows a projected send time so you can see exactly when the email would go out.

### Recipient

Pre-filled from the most recent send for this quote. Change the email address and name if needed.

### Safety options

Two optional safety toggles appear below the recipient:

- **Cancel automatically if the customer accepts, declines, or requests a change first** — recommended. If the customer responds before the scheduled time, the app cancels the follow-up so it doesn't fire after they've already replied. Available for "After quote sent" and "Starting now" triggers only.
- **Avoid evenings (8pm–8am) and weekends** — if the calculated send time falls in a quiet window, the app pushes it to the next allowed slot.

> The app will show a heads-up if your delay is 2 days or less. Most contractors find 5–7 days works best for a first follow-up.

Click **Schedule send** to confirm.

## Viewing and managing follow-ups

Scheduled follow-ups appear in the **Scheduled** tab of the Activity card on the quote summary.

Each follow-up row shows:

- Status badge (Scheduled, Sent, Cancelled, Suppressed, Failed)
- Template name and recipient
- When it will fire (or "Waiting for acceptance / decline" for pre-event rules)
- Trigger label

Active (Scheduled) follow-ups have two action buttons:

- **Send now** — sends the email immediately instead of waiting. Useful if you want to fire the follow-up right away.
- **Cancel** — cancels the scheduled send. The row moves to the history section.

Past follow-ups are collapsed under a "Show N past follow-ups" link to keep the panel tidy.

## What each status means

| Status | Meaning |
|--------|---------|
| **Scheduled** | Waiting to fire at the calculated time. |
| **Sent** | Email was sent successfully. |
| **Cancelled** | Cancelled — either by you, or automatically because the customer responded (if the safety toggle was on). |
| **Suppressed** | Not sent because the recipient is on the suppression list (They unsubscribed from our emails or similar) |
| **Failed** | Send attempted but an error occurred. |

## Related

- [Sending and acceptance](/docs/customer-facing/sending-and-acceptance)
- [Email templates](/docs/templates/email-templates)
```

---
---

## EDITS TO EXISTING DOCS

---

### EDIT 1 — `content/docs/material-orders/creating-orders.mdx`

**Where:** Add a new section after the introductory callout (before "Tier limits") to introduce the layout picker. Also update the "Custom orders" and "Order from quote" sections to reference the layout choice.

**Add this section before "## Tier limits":**

```md
## Choosing a layout

Before you start editing, the app asks you to choose an order layout. There are three options:

- **Line by Line** — a priced itemised list, like a customer quote.
- **Single Column** — item blocks with images/drawings and measurements, one per row.
- **Double Column** — the same item blocks, two per row.

The layout is locked once you save. See [Order layouts](/docs/material-orders/order-layouts) for details on each.
```

**Also add to the "## Related" section:**

```md
- [Order layouts](/docs/material-orders/order-layouts)
- [Line-by-line order editor](/docs/material-orders/line-by-line-editor)
```

---

### EDIT 2 — `content/docs/flashings/flashings.mdx`

**Where:** Add a note near the top (after the page H1 or after the first paragraph) for non-roofing trades.

**Add this callout:**

```md
<Callout type="note">
On non-roofing trades, **Flashings** is your **Drawings & Images** library. The same tool — draw or upload any technical drawing or image you want to attach to components or material orders.
</Callout>
```

---

### EDIT 3 — `content/docs/customer-facing/sending-and-acceptance.mdx`

**Where:** Add a note at the end of the "## Sending options" section, before "## What happens after they respond".

**Add:**

```md
### Attaching files

When sending you can include downloadable files — technical drawings, product sheets, terms and conditions — for the customer to access on their quote page. See [Sending attachments to customers](/docs/attachments/sending-attachments).
```

**Also add to the "## Related" section:**

```md
- [Sending attachments to customers](/docs/attachments/sending-attachments)
```

---

### EDIT 4 — `content/docs/templates/email-templates.mdx`

**Where:** Add to the "## What you can configure" list and to the "## Related" section.

**Add to the bullet list under "## What you can configure":**

```md
- **Default attachment** (Pro and above) — bake one file from your [Attachment Library](/docs/attachments/overview) into the template. It's pre-selected each time this template is used to send a quote or order; the sender can still change it per send.
```

**Add to the "## Related" section:**

```md
- [Attachment Library](/docs/attachments/overview)
- [Sending attachments to customers](/docs/attachments/sending-attachments)
```

---
---

## CHANGELOG ENTRY

**Target file:** `content/docs/help/changelog.mdx`

**Add this block at the top of the changelog body (before the existing `## 2026-05-18` entry):**

```md
## 2026-06-05 — Catalog Library, Attachments, Q assistant, order layouts, and follow-ups

### Catalog Library

Upload your supplier price lists as CSV files (up to 35,000 rows) and search them when building quotes or orders. Add an item from the results and it drops straight onto the line with description and price filled in.

- **Multiple column maps per catalog** — create named maps over the same file to use different column interpretations (e.g. retail vs. trade prices) without re-uploading.
- Available on **Pro and above**. Found in **Resource Library > Catalogs**.

### Attachment Library

Upload files (PDFs, images, ZIPs — up to 50 MB each) once and reuse them across any quote or order at send time. Customers get View and Download buttons per file on their quote page.

- **Template defaults** — bake a default attachment into an email template so it's pre-selected every time that template is used.
- Available on **Pro and above**. Found in **Resource Library > Attachments**.

### AI Assistant — Q and Guide Me

Q is the new in-app AI assistant, replacing the previous Copilot.

- **Respond mode** — ask Q questions about the app and get plain-language answers drawn from the help docs.
- **Guide Me mode** — Q walks you through tasks step by step. Switch to Guide Me on any page and Q auto-starts a walkthrough for where you are. With Highlights on, Q visually points at the exact control to use.
- The floating Q launcher appears in the bottom-right corner. Hide it temporarily with the **Hide** button in the panel, or turn it off completely in **Account > Show the Chat Assistant (Q)**.

### Material order layouts

Three layout choices are now available when creating a new material order:

- **Line by Line** — a priced, itemised text list with per-line show/hide/price/total controls. Uses the same line style as a customer quote. Supports custom lines, component lines, and catalog search.
- **Single Column** — the existing Components & Images editor, stacked.
- **Double Column** — Components & Images, two blocks per row.

The layout is chosen at creation and locked. Creating an order from a quote in Line by Line layout pre-populates the order with the quote's priced lines and footer.

### Automated follow-ups

Schedule chase emails for any quote. Set a trigger (quote sent, customer accepted/declined, or starting now), a wait time (hours or days), and an email template. The app sends automatically at the right time.

- Safety toggle: auto-cancel the follow-up if the customer responds first (recommended for "after quote sent" chases).
- Quiet-hours option: avoid evenings and weekends.
- Manage, cancel, or send early from the **Scheduled** tab on the quote's Activity card.
- Available on **Pro and above**.
```

---
---

## VERIFY FLAGS SUMMARY

The following items need manual verification before publishing:

| # | File | Flag | Notes |
|---|------|------|-------|
| 1 | `uploading-a-catalog.mdx` | Row limit | Wizard UI text says "Up to 20,000 rows" but `MAX_ROWS` constant is `35_000`. Doc currently says 35,000. Confirm the correct limit. |
| 2 | `using-catalog-items.mdx` | Button label | Confirm "+ Add New Line" is the exact button label in both the quote editor and the line-by-line order editor. |
| 3 | `order-from-a-quote.mdx` | Entry point | Confirm the exact UI for starting an order from a quote (e.g., is there a "New order from quote" button, or does the user pick a quote inside the create flow?). |
| 4 | `meet-q.mdx` | Account location | The "Show the Chat Assistant (Q)" toggle is in Settings (`/settings`). The launcher tooltip says "go to Account > Notifications" but the actual section is `AssistantSection` in `settings/page.tsx`. Confirm the correct navigation path to tell users (`Account` vs `Settings`). |
| 5 | `follow-ups/follow-ups.mdx` | Plan tier | Feature flag is `feat_followups`. Confirm this is Pro and above (not just Professional — i.e., Pro Plus and Premium also include it). |

---
*End of draft. Shaun to review and correct VERIFY flags before publishing.*
