# Repository guidelines

## Code

- Use clear, conventional names and small modules with focused responsibilities.
- Use native Magpie plugin hooks. Avoid unnecessary dependencies, duplicate logic, and speculative defensive branches; validate external inputs at their boundaries.
- Do not add code comments or test code. Use template files for generated code instead of inline code strings.
- Keep image assets in the package and generate Magpie's embedded icon from the local SVG.

## Documentation

- Write documentation in English. Describe current behavior and usage; exclude development history, progress reports, and debugging narratives.
- Keep README concise and focused on Magpie users. Omit installation, development, and license sections.

## Provider behavior

- Keep credentials out of source, documentation, logs, and package contents.
- Keep Builder Plan and PAYG credentials and billing separate. Never switch billing plans automatically.
- Preserve streaming, cancellation, tool calls, and upstream errors when forwarding requests.

- Select from the model's advertised ZenMux APIs and Magpie's supported protocols before applying model-family preferences. Use Magpie's Agent configuration and protocol conversion for client compatibility; check output-modality constraints separately.
- Prefer Messages for Claude, Responses for GPT, and Gemini for Gemini models. Prefer Chat Completions for Chinese open models unless the model vendor explicitly recommends another protocol.
- Match model families by naming conventions that cover future versions and variants, not lists of released model IDs.
- Treat ZenMux as the authority for model availability and capabilities. Supplementary metadata must not override explicit ZenMux capability restrictions.

## Validation

- Run `npm run format`, `npm run check`, and `npm pack --dry-run` for relevant changes, plus targeted manual checks for changed behavior.
