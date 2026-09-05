## Structure

- HTML the outer element must be valid html element not just `div`, like `main>section`, `nav`, `aside` etc.
- CSS class must be `clean one word`, also for the modifier but accepted for modifier to use `-` separator, but not more than 2 words
- `src/style.css` is global styling file. if it reusable or configuration find or put it in `src/lib/Styles/*.css`
- global variables written in` src/lib/Styles/variables.css`. and must be prefixed with `--app`
- components has its own specific variables. for coloring mainly driven by `--componentname-primary-color` and `--componentname-accent-color`, the other is just color mix from it. but the value itself must be inheriting from global variables, so dont edits the component styles directly if you want to override do it in the `style.css` or `variables.css`
  for example: `--input-text-color: var(--app-text-color);`

## Info

- the landing page content is in `src\content.ts` store in `HomepageContent` var
  to understand the mechanism how it build and what the output will be read `src\lib\Modules\DOMRenderer.md`

## Requirements

- website must be provide dark and light color scheme mode
- the design must be simple yet aligned with the animations that already been setup
- the target is middle to low educated people. so mostly will be viewed in standard mobile phone.
  so mobile ready is a must. also use clamp() for typography.
- dont have specific fonts related styles so you're welcome to choose which best for it.
- the main course is the multistep form, it is paragraph driven form. so it must be touched up to match the
  whole website styles.
