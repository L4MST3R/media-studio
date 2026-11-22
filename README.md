# Media Studio

Make images, short videos and speech from text prompts, start from shared prompt templates, and keep everything you make in a private library.

Inspired by https://halaiapp.ai

Built with [oss.new](https://oss.new) for [EveryApp](https://github.com/every-app/every-app).

## Features

- Generate one to four images from a prompt, a model, an aspect ratio and up to three reference images.
- Generate a 5 or 10 second video from a prompt and an optional start image, and follow it until it's ready.
- Turn up to 4,000 characters of text into speech with a choice of voice and speed.
- Browse, filter, download, reuse and delete everything you've generated; nobody else can see it.
- Start from prompt templates by category and fill in their blanks; admins add, edit and remove templates.

Left out: accounts and sign-in, which your Gateway handles; plans, credits and payments; the specialised studios; agents, MCP and a public API; community and creator programmes; voice cloning and avatars; store integrations; mobile apps.

## Setup

- Install: `pnpm install`, then `pnpm everyapp install <this repository's URL>` onto your Gateway, or `pnpm run deploy` from a checkout.
- Run locally: `pnpm dev`. Put provider keys in `.dev.vars` to try the generators without a Gateway.
- Test: `pnpm test` for the query tests; `checks/` holds the release checks, which answer provider calls with a stand-in Gateway, so real provider calls and video downloads are not covered by them.
- Each generator is an optional feature and is off until its key is set on the Gateway (`pnpm everyapp configure media-studio`):
  - `OPENROUTER_API_KEY` (OpenRouter): image generation.
  - `OPENAI_API_KEY` (OpenAI): speech.
  - `REPLICATE_API_TOKEN` (Replicate): video generation.
- There are no other secrets or settings. The database, file storage and the video workflow are created on deploy.

## Limitations

- Every generation is billed to the provider account behind the Gateway's key; the app sets no limits of its own.
- Image and speech requests wait for the model, so a set of four images can take a minute.
- A video still unfinished after about half an hour is marked failed.
- Reference and start images can be PNG, JPEG or WebP up to 8 MB.
