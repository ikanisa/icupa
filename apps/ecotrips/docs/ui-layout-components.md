# Layout and Content Components Reference

This reference documents the core layout and typography widgets exposed in the Ecotrips design system. It consolidates default props, usage snippets, and inline annotations to make pairing the UI kit with Supabase data straightforward.

## Box

Flexible container for layout and surface styling.

**Usage**

```tsx
<Box padding={4} background="surface-secondary">
  <Text value="Content" />
</Box>
```

| Prop          | Description                                                               | Type                                                                                                     | Default |
| ------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------- |
| `children`    | Child components rendered inside the container.                           | `WidgetComponent[]`                                                                                      | –       |
| `direction`   | Flex direction for content within this container.                         | `"row" \| "col"`                                                                                         | `"col"` |
| `align`       | Cross-axis alignment of children.                                         | `"start" \| "center" \| "end" \| "baseline" \| "stretch"`                                                | –       |
| `justify`     | Main-axis distribution of children.                                       | `"start" \| "center" \| "end" \| "stretch" \| "between" \| "around" \| "evenly"`                         | –       |
| `wrap`        | Wrap behavior for flex items.                                             | `"nowrap" \| "wrap" \| "wrap-reverse"`                                                                   | –       |
| `flex`        | Flex growth/shrink factor.                                                | `string \| number`                                                                                       | –       |
| `gap`         | Gap between direct children; accepts a spacing unit or a CSS string.      | `string \| number`                                                                                       | –       |
| `padding`     | Inner padding; accepts a spacing unit, CSS string, or padding object.     | `string \| number \| object`                                                                             | –       |
| `border`      | Border applied to the container; accepts a numeric pixel value or object. | `number \| object`                                                                                       | –       |
| `background`  | Surface or primitive background color.                                    | `string \| object`                                                                                       | –       |
| `height`      | Explicit height.                                                          | `string \| number`                                                                                       | –       |
| `width`       | Explicit width.                                                           | `string \| number`                                                                                       | –       |
| `size`        | Shorthand for width and height.                                           | `string \| number`                                                                                       | –       |
| `minHeight`   | Minimum height constraint.                                                | `string \| number`                                                                                       | –       |
| `minWidth`    | Minimum width constraint.                                                 | `string \| number`                                                                                       | –       |
| `minSize`     | Shorthand for `minWidth` and `minHeight`.                                 | `string \| number`                                                                                       | –       |
| `maxHeight`   | Maximum height constraint.                                                | `string \| number`                                                                                       | –       |
| `maxWidth`    | Maximum width constraint.                                                 | `string \| number`                                                                                       | –       |
| `maxSize`     | Shorthand for `maxWidth` and `maxHeight`.                                 | `string \| number`                                                                                       | –       |
| `aspectRatio` | Aspect ratio of the box (e.g. `16/9`).                                    | `string \| number`                                                                                       | –       |
| `radius`      | Border radius token.                                                      | `"sm" \| "md" \| "lg" \| "full" \| "xl" \| "2xl" \| "2xs" \| "xs" \| "3xl" \| "4xl" \| "100%" \| "none"` | –       |
| `margin`      | Outer margin.                                                             | `string \| number \| object`                                                                             | –       |

## Row

Horizontal flex layout container.

**Usage**

```tsx
<Row gap={2}>{/* children */}</Row>
```

| Prop          | Description                                     | Type                                                                                                     | Default |
| ------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------- |
| `children`    | Child components rendered inside the container. | `WidgetComponent[]`                                                                                      | –       |
| `align`       | Cross-axis alignment of children.               | `"start" \| "center" \| "end" \| "baseline" \| "stretch"`                                                | –       |
| `justify`     | Main-axis distribution of children.             | `"start" \| "center" \| "end" \| "stretch" \| "between" \| "around" \| "evenly"`                         | –       |
| `wrap`        | Wrap behavior for flex items.                   | `"nowrap" \| "wrap" \| "wrap-reverse"`                                                                   | –       |
| `flex`        | Flex growth/shrink factor.                      | `string \| number`                                                                                       | –       |
| `gap`         | Gap between direct children.                    | `string \| number`                                                                                       | –       |
| `padding`     | Inner padding.                                  | `string \| number \| object`                                                                             | –       |
| `border`      | Border styling.                                 | `number \| object`                                                                                       | –       |
| `background`  | Background color token or CSS string.           | `string \| object`                                                                                       | –       |
| `height`      | Explicit height.                                | `string \| number`                                                                                       | –       |
| `width`       | Explicit width.                                 | `string \| number`                                                                                       | –       |
| `size`        | Shorthand for width and height.                 | `string \| number`                                                                                       | –       |
| `minHeight`   | Minimum height constraint.                      | `string \| number`                                                                                       | –       |
| `minWidth`    | Minimum width constraint.                       | `string \| number`                                                                                       | –       |
| `minSize`     | Shorthand for `minWidth` and `minHeight`.       | `string \| number`                                                                                       | –       |
| `maxHeight`   | Maximum height constraint.                      | `string \| number`                                                                                       | –       |
| `maxWidth`    | Maximum width constraint.                       | `string \| number`                                                                                       | –       |
| `maxSize`     | Shorthand for `maxWidth` and `maxHeight`.       | `string \| number`                                                                                       | –       |
| `aspectRatio` | Aspect ratio for the container.                 | `string \| number`                                                                                       | –       |
| `radius`      | Border radius token.                            | `"sm" \| "md" \| "lg" \| "full" \| "xl" \| "2xl" \| "2xs" \| "xs" \| "3xl" \| "4xl" \| "100%" \| "none"` | –       |
| `margin`      | Outer margin.                                   | `string \| number \| object`                                                                             | –       |

## Col

Vertical flex layout container.

**Usage**

```tsx
<Col gap={2}>{/* children */}</Col>
```

| Prop          | Description                                     | Type                                                                                                     | Default |
| ------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------- |
| `children`    | Child components rendered inside the container. | `WidgetComponent[]`                                                                                      | –       |
| `align`       | Cross-axis alignment of children.               | `"start" \| "center" \| "end" \| "baseline" \| "stretch"`                                                | –       |
| `justify`     | Main-axis distribution of children.             | `"start" \| "center" \| "end" \| "stretch" \| "between" \| "around" \| "evenly"`                         | –       |
| `wrap`        | Wrap behavior for flex items.                   | `"nowrap" \| "wrap" \| "wrap-reverse"`                                                                   | –       |
| `flex`        | Flex growth/shrink factor.                      | `string \| number`                                                                                       | –       |
| `gap`         | Gap between direct children.                    | `string \| number`                                                                                       | –       |
| `padding`     | Inner padding.                                  | `string \| number \| object`                                                                             | –       |
| `border`      | Border styling.                                 | `number \| object`                                                                                       | –       |
| `background`  | Background color token or CSS string.           | `string \| object`                                                                                       | –       |
| `height`      | Explicit height.                                | `string \| number`                                                                                       | –       |
| `width`       | Explicit width.                                 | `string \| number`                                                                                       | –       |
| `size`        | Shorthand for width and height.                 | `string \| number`                                                                                       | –       |
| `minHeight`   | Minimum height constraint.                      | `string \| number`                                                                                       | –       |
| `minWidth`    | Minimum width constraint.                       | `string \| number`                                                                                       | –       |
| `minSize`     | Shorthand for `minWidth` and `minHeight`.       | `string \| number`                                                                                       | –       |
| `maxHeight`   | Maximum height constraint.                      | `string \| number`                                                                                       | –       |
| `maxWidth`    | Maximum width constraint.                       | `string \| number`                                                                                       | –       |
| `maxSize`     | Shorthand for `maxWidth` and `maxHeight`.       | `string \| number`                                                                                       | –       |
| `aspectRatio` | Aspect ratio for the container.                 | `string \| number`                                                                                       | –       |
| `radius`      | Border radius token.                            | `"sm" \| "md" \| "lg" \| "full" \| "xl" \| "2xl" \| "2xs" \| "xs" \| "3xl" \| "4xl" \| "100%" \| "none"` | –       |
| `margin`      | Outer margin.                                   | `string \| number \| object`                                                                             | –       |

## Spacer

Flexible space to separate content within a layout.

```tsx
<Row>
  <Badge label="Left" />
  <Spacer minSize={16} />
  <Badge label="Right" />
</Row>
```

| Prop      | Description                                     | Type               | Default  |
| --------- | ----------------------------------------------- | ------------------ | -------- |
| `minSize` | Minimum size occupied along the flex direction. | `string \| number` | `"auto"` |

## Divider

Separates content with a thin line.

```tsx
<Divider spacing={2} />
```

| Prop      | Description                                        | Type               | Default     |
| --------- | -------------------------------------------------- | ------------------ | ----------- |
| `color`   | Border color token or CSS string.                  | `string \| object` | `"default"` |
| `size`    | Thickness of the divider line.                     | `string \| number` | `1`         |
| `spacing` | Outer spacing applied above and below the divider. | `string \| number` | –           |
| `flush`   | Remove surrounding padding when true.              | `boolean`          | `false`     |

## Text

Display body copy with size, weight, and color options.

```tsx
<Text value="Hello world" size="md" />
```

| Prop          | Description                                  | Type                                           | Default    |
| ------------- | -------------------------------------------- | ---------------------------------------------- | ---------- |
| `value`       | Text content to display.                     | `string`                                       | –          |
| `size`        | Text size token.                             | `"xs" \| "sm" \| "md" \| "lg" \| "xl"`         | `"md"`     |
| `weight`      | Font weight token.                           | `"normal" \| "medium" \| "semibold" \| "bold"` | `"normal"` |
| `streaming`   | Enables streaming-friendly transitions.      | `boolean`                                      | `false`    |
| `italic`      | Render text italicized.                      | `boolean`                                      | –          |
| `lineThrough` | Apply line-through decoration.               | `boolean`                                      | –          |
| `width`       | Constrain text container width.              | `string \| number`                             | –          |
| `minLines`    | Reserve space for a minimum number of lines. | `number`                                       | –          |
| `editable`    | Enable inline editing.                       | `false \| object`                              | `false`    |
| `textAlign`   | Horizontal alignment.                        | `"start" \| "center" \| "end"`                 | `"start"`  |
| `truncate`    | Truncate overflow with ellipsis.             | `boolean`                                      | `false`    |
| `maxLines`    | Clamp to a maximum number of lines.          | `number`                                       | –          |

## Title

Section headings with scalable sizes and weights.

```tsx
<Title value="Section title" size="lg" />
```

| Prop        | Description                                                     | Type                                                               | Default    |
| ----------- | --------------------------------------------------------------- | ------------------------------------------------------------------ | ---------- |
| `value`     | Title text content.                                             | `string`                                                           | –          |
| `size`      | Title size token.                                               | `"sm" \| "md" \| "lg" \| "xl" \| "2xl" \| "3xl" \| "4xl" \| "5xl"` | `"md"`     |
| `weight`    | Font weight token.                                              | `"normal" \| "medium" \| "semibold" \| "bold"`                     | `"medium"` |
| `color`     | Text color token, primitive, CSS string, or theme-aware object. | `string \| object`                                                 | `"prose"`  |
| `textAlign` | Horizontal alignment.                                           | `"start" \| "center" \| "end"`                                     | `"start"`  |
| `truncate`  | Truncate overflow with ellipsis.                                | `boolean`                                                          | `false`    |
| `maxLines`  | Clamp to a maximum number of lines.                             | `number`                                                           | –          |

## Caption

Supplemental text for descriptions or hints.

```tsx
<Caption value="Helpful hint" size="md" />
```

| Prop        | Description                                                     | Type                                           | Default       |
| ----------- | --------------------------------------------------------------- | ---------------------------------------------- | ------------- |
| `value`     | Caption text content.                                           | `string`                                       | –             |
| `size`      | Caption size token.                                             | `"sm" \| "md" \| "lg"`                         | `"md"`        |
| `weight`    | Font weight token.                                              | `"normal" \| "medium" \| "semibold" \| "bold"` | `"normal"`    |
| `color`     | Text color token, primitive, CSS string, or theme-aware object. | `string \| object`                             | `"secondary"` |
| `textAlign` | Horizontal alignment.                                           | `"start" \| "center" \| "end"`                 | `"start"`     |
| `truncate`  | Truncate overflow with ellipsis.                                | `boolean`                                      | `false`       |
| `maxLines`  | Clamp to a maximum number of lines.                             | `number`                                       | –             |

## Label

Accessible label for a form field.

```tsx
<Label value="Email" fieldName="email" />
```

| Prop        | Description                                                     | Type                                           | Default    |
| ----------- | --------------------------------------------------------------- | ---------------------------------------------- | ---------- |
| `value`     | Text content of the label.                                      | `string`                                       | –          |
| `fieldName` | Name of the field the label describes.                          | `string`                                       | –          |
| `size`      | Text size token.                                                | `"xs" \| "sm" \| "md" \| "lg" \| "xl"`         | `"sm"`     |
| `weight`    | Font weight token.                                              | `"normal" \| "medium" \| "semibold" \| "bold"` | `"medium"` |
| `textAlign` | Horizontal alignment.                                           | `"start" \| "center" \| "end"`                 | `"start"`  |
| `color`     | Text color token, primitive, CSS string, or theme-aware object. | `string \| object`                             | –          |

## Markdown

Render rich formatted content from a markdown source string.

```tsx
<Markdown value={"**Bold** and _italic_."} />
```

| Prop        | Description                           | Type      | Default |
| ----------- | ------------------------------------- | --------- | ------- |
| `value`     | Markdown source string.               | `string`  | –       |
| `streaming` | Apply streaming-friendly transitions. | `boolean` | `false` |

## Image

Display remote images with optional framing and object-fit.

```tsx
<Image src="https://cdn.example.com/blue-chair.png" alt="Blue chair" frame />
```

| Prop          | Description                               | Type                                                                                                                 | Default    |
| ------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ---------- |
| `src`         | Image URL source.                         | `string`                                                                                                             | –          |
| `alt`         | Alternate text for accessibility.         | `string`                                                                                                             | –          |
| `frame`       | Draw a subtle frame around the image.     | `boolean`                                                                                                            | `false`    |
| `fit`         | How the image fits inside the container.  | `"none" \| "cover" \| "contain" \| "fill" \| "scale-down"`                                                           | `"cover"`  |
| `position`    | Focal position of the image.              | `"center" \| "top" \| "bottom" \| "left" \| "right" \| "top left" \| "top right" \| "bottom left" \| "bottom right"` | `"center"` |
| `flush`       | Remove surrounding padding.               | `boolean`                                                                                                            | `false`    |
| `height`      | Explicit height.                          | `string \| number`                                                                                                   | –          |
| `width`       | Explicit width.                           | `string \| number`                                                                                                   | –          |
| `size`        | Shorthand for width and height.           | `string \| number`                                                                                                   | –          |
| `minHeight`   | Minimum height constraint.                | `string \| number`                                                                                                   | –          |
| `minWidth`    | Minimum width constraint.                 | `string \| number`                                                                                                   | –          |
| `minSize`     | Shorthand for `minWidth` and `minHeight`. | `string \| number`                                                                                                   | –          |
| `maxHeight`   | Maximum height constraint.                | `string \| number`                                                                                                   | –          |
| `maxWidth`    | Maximum width constraint.                 | `string \| number`                                                                                                   | –          |
| `maxSize`     | Shorthand for `maxWidth` and `maxHeight`. | `string \| number`                                                                                                   | –          |
| `aspectRatio` | Aspect ratio of the box (e.g. `16/9`).    | `string \| number`                                                                                                   | –          |
| `radius`      | Border radius token.                      | `"sm" \| "md" \| "lg" \| "full" \| "xl" \| "2xl" \| "2xs" \| "xs" \| "3xl" \| "4xl" \| "100%" \| "none"`             | –          |
| `margin`      | Outer margin.                             | `string \| number \| object`                                                                                         | –          |

## Icon

Vector icons sourced from the design system.

| Prop    | Description                                                     | Type                                                     | Default   |
| ------- | --------------------------------------------------------------- | -------------------------------------------------------- | --------- |
| `name`  | Icon to display (see supported names below).                    | `string`                                                 | –         |
| `color` | Text color token, primitive, CSS string, or theme-aware object. | `string \| object`                                       | `"prose"` |
| `size`  | Icon size token.                                                | `"xs" \| "sm" \| "md" \| "lg" \| "xl" \| "2xl" \| "3xl"` | `"md"`    |

Supported icon names include: `agent`, `analytics`, `atom`, `batch`, `bolt`, `book-open`, `book-closed`, `book-clock`, `bug`, `calendar`, `chart`, `check`, `check-circle`, `check-circle-filled`, `chevron-left`, `chevron-right`, `circle-question`, `compass`, `confetti`, `cube`, `desktop`, `document`, `dot`, `dots-horizontal`, `dots-vertical`, `empty-circle`, `external-link`, `globe`, `keys`, `lab`, `images`, `info`, `lifesaver`, `lightbulb`, `mail`, `map-pin`, `maps`, `mobile`, `name`, `notebook`, `notebook-pencil`, `page-blank`, `phone`, `play`, `plus`, `profile`, `profile-card`, `reload`, `star`, `star-filled`, `search`, `sparkle`, `sparkle-double`, `square-code`, `square-image`, `square-text`, `suitcase`, `settings-slider`, `user`, `wreath`, `write`, `write-alt`, and `write-alt2`.

## Chart

Render simple bar, line, and area charts from tabular data.

```tsx
<Chart
  data={[{ date: "2025-01-01", Desktop: 100, Mobile: 200 }]}
  series={[{ type: "bar", dataKey: "Desktop" }]}
  xAxis="date"
  height={240}
/>
```

### Shared chart props

| Prop             | Description                                                | Type                                           | Default |
| ---------------- | ---------------------------------------------------------- | ---------------------------------------------- | ------- |
| `data`           | Tabular dataset; each object represents a data row.        | `Array<unknown>`                               | –       |
| `series`         | Series definitions describing how to read and render data. | `Array<BarSeries \| LineSeries \| AreaSeries>` | –       |
| `xAxis`          | Data key or config for the x-axis.                         | `string \| object`                             | –       |
| `showYAxis`      | Show a left y-axis with tick labels.                       | `boolean`                                      | `false` |
| `showLegend`     | Display a legend describing the series.                    | `boolean`                                      | `true`  |
| `showTooltip`    | Display a tooltip on hover.                                | `boolean`                                      | `true`  |
| `barGap`         | Gap size (px) between bars in the same category.           | `number`                                       | –       |
| `barCategoryGap` | Gap size (px) between bar categories.                      | `string`                                       | –       |
| `flex`           | Flex growth/shrink factor.                                 | `string \| number`                             | –       |
| `height`         | Explicit height.                                           | `string \| number`                             | –       |
| `width`          | Explicit width.                                            | `string \| number`                             | –       |
| `size`           | Shorthand for width and height.                            | `string \| number`                             | –       |
| `minSize`        | Shorthand for min width and height.                        | `string \| number`                             | –       |
| `maxSize`        | Shorthand for max width and height.                        | `string \| number`                             | –       |
| `maxHeight`      | Maximum height constraint.                                 | `string \| number`                             | –       |
| `maxWidth`       | Maximum width constraint.                                  | `string \| number`                             | –       |
| `minHeight`      | Minimum height constraint.                                 | `string \| number`                             | –       |
| `minWidth`       | Minimum width constraint.                                  | `string \| number`                             | –       |
| `aspectRatio`    | Aspect ratio of the box (e.g. `16/9`).                     | `string \| number`                             | –       |

### Series-specific props

**BarSeries**

| Prop      | Description                                                      | Type               |
| --------- | ---------------------------------------------------------------- | ------------------ |
| `type`    | Literal `"bar"`.                                                 | `"bar"`            |
| `dataKey` | Key to read numeric values from.                                 | `string`           |
| `label`   | Label for legends and tooltips.                                  | `string`           |
| `color`   | Chart color token, primitive, CSS string, or theme-aware object. | `string \| object` |
| `stack`   | Group bars together by stack id.                                 | `string`           |

**LineSeries**

| Prop        | Description                                                      | Type                                                                                                                                                                                                      | Default     |
| ----------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| `type`      | Literal `"line"`.                                                | `"line"`                                                                                                                                                                                                  | –           |
| `dataKey`   | Key to read numeric values from.                                 | `string`                                                                                                                                                                                                  | –           |
| `label`     | Label for legends and tooltips.                                  | `string`                                                                                                                                                                                                  | –           |
| `color`     | Chart color token, primitive, CSS string, or theme-aware object. | `string \| object`                                                                                                                                                                                        | –           |
| `curveType` | Curve interpolation type.                                        | `"basis" \| "basisClosed" \| "basisOpen" \| "bumpX" \| "bumpY" \| "bump" \| "linear" \| "linearClosed" \| "natural" \| "monotoneX" \| "monotoneY" \| "monotone" \| "step" \| "stepBefore" \| "stepAfter"` | `"natural"` |

**AreaSeries**

| Prop        | Description                                                      | Type                                                                                                                                                                                                      | Default     |
| ----------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| `type`      | Literal `"area"`.                                                | `"area"`                                                                                                                                                                                                  | –           |
| `dataKey`   | Key to read numeric values from.                                 | `string`                                                                                                                                                                                                  | –           |
| `label`     | Label for legends and tooltips.                                  | `string`                                                                                                                                                                                                  | –           |
| `color`     | Chart color token, primitive, CSS string, or theme-aware object. | `string \| object`                                                                                                                                                                                        | –           |
| `curveType` | Curve interpolation type.                                        | `"basis" \| "basisClosed" \| "basisOpen" \| "bumpX" \| "bumpY" \| "bump" \| "linear" \| "linearClosed" \| "natural" \| "monotoneX" \| "monotoneY" \| "monotone" \| "step" \| "stepBefore" \| "stepAfter"` | `"natural"` |
| `stack`     | Group areas together by stack id.                                | `string`                                                                                                                                                                                                  | –           |

## Badge

Emphasize status or metadata with a pill component.

```tsx
<Badge label="Success" color="success" size="md" />
```

| Prop      | Description                         | Type                                                                         | Default       |
| --------- | ----------------------------------- | ---------------------------------------------------------------------------- | ------------- |
| `label`   | Text inside the badge.              | `string`                                                                     | –             |
| `color`   | Badge color token.                  | `"info" \| "secondary" \| "discovery" \| "success" \| "warning" \| "danger"` | `"secondary"` |
| `variant` | Visual style.                       | `"solid" \| "soft" \| "outline"`                                             | `"soft"`      |
| `size`    | Badge size token.                   | `"sm" \| "md" \| "lg"`                                                       | `"sm"`        |
| `pill`    | Fully rounded pill shape when true. | `boolean`                                                                    | `true`        |

## Transition

Animate layout changes for a single child component.

```tsx
<Transition>
  <Text value="Content" />
</Transition>
```

| Prop       | Description                 | Type              |
| ---------- | --------------------------- | ----------------- |
| `children` | Child component to animate. | `WidgetComponent` |

## Pattern Examples

### Order summary card

```tsx
<Card size="sm">
  <Col>
    {items.map((item) => (
      <Row key={item.title} align="center">
        <Image src={item.image} size={48} />
        <Col>
          <Text value={item.title} size="md" weight="semibold" color="emphasis" />
          <Text value={item.subtitle} size="sm" color="secondary" />
        </Col>
      </Row>
    ))}
  </Col>

  <Divider flush />

  <Col>
    <Row>
      <Text value="Subtotal" size="sm" />
      <Spacer />
      <Text value={subTotal} size="sm" />
    </Row>
    <Row>
      <Text value={`Sales tax (${taxPct})`} size="sm" />
      <Spacer />
      <Text value={tax} size="sm" />
    </Row>
    <Row>
      <Text value="Total with tax" weight="semibold" size="sm" />
      <Spacer />
      <Text value={total} weight="semibold" size="sm" />
    </Row>
  </Col>

  <Divider flush />

  <Col>
    <Button label="Purchase" onClickAction={{ type: "purchase" }} style="primary" block />
    <Button label="Add to cart" onClickAction={{ type: "add_to_cart" }} style="secondary" block />
  </Col>
</Card>
```

```json
{
  "items": [
    {
      "image": "https://cdn.openai.com/API/storybook/blacksugar.png",
      "title": "Black Sugar Hoick Latte",
      "subtitle": "16oz Iced · Boba · $6.50"
    },
    {
      "image": "https://cdn.openai.com/API/storybook/classic.png",
      "title": "Classic Milk Tea",
      "subtitle": "16oz Iced · Double Boba · $6.75"
    },
    {
      "image": "https://cdn.openai.com/API/storybook/matcha.png",
      "title": "Matcha Latte",
      "subtitle": "16oz Iced · Boba · $6.50"
    }
  ],
  "subTotal": "$19.75",
  "taxPct": "8.75%",
  "tax": "$1.72",
  "total": "$21.47"
}
```

### Notification confirmation card

```tsx
<Card>
  <Col align="center" gap={4} padding={4}>
    <Box background="green-400" radius="full" padding={3}>
      <Icon name="check" size="3xl" color="white" />
    </Box>
    <Col align="center" gap={1}>
      <Title value={title} />
      <Text value={description} color="secondary" />
    </Col>
  </Col>

  <Row>
    <Button
      label="Yes"
      block
      onClickAction={{
        type: "notification.settings",
        payload: { enable: true },
      }}
    />
    <Button
      label="No"
      block
      variant="outline"
      onClickAction={{
        type: "notification.settings",
        payload: { enable: true },
      }}
    />
  </Row>
</Card>
```

```json
{
  "title": "Enable notification",
  "description": "Notify me when this item ships"
}
```

### Purchase confirmation card

```tsx
<Card size="sm">
  <Col gap={3}>
    <Row align="center" gap={2}>
      <Icon name="check-circle-filled" color="success" />
      <Text size="sm" value="Purchase complete" color="success" />
    </Row>
    <Divider color="subtle" flush />

    <Row gap={3}>
      <Image src={product.image} alt="Blue folding chair" size={80} frame />
      <Col gap={1}>
        <Title value={product.name} maxLines={2} />
        <Text value="Free delivery • 14-day returns" size="sm" color="secondary" />
      </Col>
    </Row>
  </Col>
  <Col gap={2} padding={{ y: 2 }}>
    <Row>
      <Text value="Estimated delivery" size="sm" color="secondary" />
      <Spacer />
      <Text value="Thursday, Oct 8" size="sm" />
    </Row>
    <Row>
      <Text value="Sold by" size="sm" color="secondary" />
      <Spacer />
      <Text value="OpenAI" size="sm" />
    </Row>
    <Row>
      <Text value="Paid" size="sm" color="secondary" />
      <Spacer />
      <Text value="$20.00" size="sm" />
    </Row>
  </Col>

  <Button
    label="View details"
    onClickAction={{ type: "order.view_details" }}
    variant="outline"
    pill
    block
  />
</Card>
```

```json
{
  "product": {
    "name": "Blue folding chair",
    "image": "/blue-chair.png"
  }
}
```
