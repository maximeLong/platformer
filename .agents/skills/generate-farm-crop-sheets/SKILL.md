---
name: generate-farm-crop-sheets
description: Generate or regenerate standardized raster sprite sheets for Sunpatch Farm crops. Use whenever creating new farm crop art, replacing existing crop atlases, expanding the crop library, or preparing four-stage cultivated-plant sprites for the game's billboard renderer.
---

# Generate Farm Crop Sheets

Create crop atlases with this contract. Do not change the grid, state order, separate universal-seedling treatment, or harvest-state treatment unless the user explicitly changes the specification.

## Sheet contract

- Produce exactly one square 4×4 grid containing 16 isolated assets.
- Include exactly four crop types. Give each crop one complete row.
- Order each row from state 1 in column 1 through state 4 in column 4.
- Do not render seedlings anywhere in a crop sheet. The universal seedling is a separate shared asset outside the 4×4 crop sheets.
- Keep every asset centered inside an equal-sized cell with generous padding.
- Keep scale, camera angle, lighting, edge treatment, and ground contact consistent across rows and sheets.
- Do not include text, labels, grid lines, borders, UI, tools, pots, people, animals, or decorative props.

## Required state progression

1. **Juvenile growth:** Show a small crop-specific juvenile plant rooted in a small dirt mound. It must be clearly beyond the universal two-leaf seedling.
2. **Midway growth:** Show a substantially larger crop-specific plant midway to maturity, rooted in a small dirt mound.
3. **Ready crop:** Show the fully grown crop visibly attached to its plant and still rooted in a small dirt mound. This is the ready-to-harvest state shown on the plot.
4. **Harvest pickup:** Show only the harvested produce as a clean, free-floating standalone asset. Show no dirt, roots in soil, mound, ground plane, pot, leaves that imply the whole rooted plant, or cast shadow. Preserve characteristic edible foliage when it belongs to the picked item, such as carrot tops.

Before state 1, render a separate shared universal seedling asset. State 4 is launched out of the plot as a physics pickup and must read as a collectible, not as another growth stage.

## Style and background

- Match the established polished hand-painted storybook style: vibrant color, readable silhouette, subtle painterly texture, and warm sunny lighting.
- Use a perfectly uniform flat `#ff00ff` chroma-key background.
- Do not use magenta in any asset.
- Require crisp separated edges and no cast shadows, floor, reflections, gradients, or lighting variation in the background.
- Remove the chroma key locally and save a validated RGBA PNG in `assets/farm/`.

## Prompt template

Use this structure and replace the four crop names and state-specific produce descriptions:

```text
Use case: stylized-concept
Asset type: exact 4 by 4 crop-state sprite atlas for Sunpatch Farm
Primary request: Create exactly four crop types, one per row. For every row show: column 1 crop-specific juvenile growth in a small dirt mound; column 2 crop-specific midway growth in a small dirt mound; column 3 the fully grown crop visibly attached to its plant in a small dirt mound; column 4 only the detached harvested produce as a free-floating standalone pickup with absolutely no dirt or ground. Do not render seedlings anywhere in the sheet.
Subject order: Row 1 <crop>; Row 2 <crop>; Row 3 <crop>; Row 4 <crop>.
Scene/backdrop: perfectly flat solid #ff00ff chroma-key background
Style/medium: polished hand-painted 2D storybook game sprites matching Sunpatch Farm
Composition/framing: exact evenly spaced 4-column by 4-row grid; one centered isolated asset per equal cell; generous padding; nothing crosses a cell boundary
Constraints: exactly 16 assets; states progress left to right; columns 1-3 contain dirt; column 1 is juvenile and must not be a tiny seedling; column 2 is midway growth; column 3 is fully grown and attached; column 4 must contain zero dirt, zero ground, and only the picked produce; no text, labels, dividers, shadows, watermark, or extra objects
Avoid: any seedling in the sheet, dirt in column 4, rooted whole plants in column 4, pots, tools, UI, photorealism, magenta asset details
```

## Validation checklist

- Count exactly 16 isolated assets.
- Verify each row contains one crop and exactly four states.
- Verify the sheet contains no tiny seedlings or generic seedling cells.
- Verify every state-1 cell is recognizable crop-specific juvenile growth.
- Verify every state-2 cell is visibly larger and midway to maturity.
- Verify every state-3 cell is fully grown, visibly attached to its plant, and rooted in dirt.
- Verify every state-4 cell contains harvested produce only and zero dirt pixels or implied ground.
- Verify no asset crosses cell boundaries.
- Verify the final file is RGBA, has transparent corners, and retains solid subject interiors.
- Maintain the universal seedling as a separate shared transparent asset outside the sheets.
- Update the game's atlas list and crop cell mappings when replacing or adding sheets.
