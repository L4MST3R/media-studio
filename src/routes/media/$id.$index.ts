import { createFileRoute } from "@tanstack/react-router";
import { getEveryAppUser } from "@every-app/sdk/server";
import { env } from "cloudflare:workers";
import { assetKey } from "@/server/generations";

// A generated file, served only to the member who made it.
export const Route = createFileRoute("/media/$id/$index")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const user = await getEveryAppUser(request, env);
        if (!user) return new Response("Unauthorized", { status: 401 });
        const index = Number(params.index);
        if (!Number.isInteger(index) || index < 0) return notFound();
        const key = await assetKey(user.id, params.id, index);
        if (!key) return notFound();
        const object = await env.files.get(key);
        if (!object) return notFound();
        const headers = new Headers({
          "content-type":
            object.httpMetadata?.contentType ?? "application/octet-stream",
          "cache-control": "private, max-age=3600",
          "x-content-type-options": "nosniff",
        });
        if (new URL(request.url).searchParams.has("download")) {
          const name = key.split("/").slice(-2).join("-");
          headers.set("content-disposition", `attachment; filename="${name}"`);
        }
        return new Response(object.body, { headers });
      },
    },
  },
});

function notFound() {
  return new Response("Not found", { status: 404 });
}
