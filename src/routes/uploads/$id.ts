import { createFileRoute } from "@tanstack/react-router";
import { getEveryAppUser } from "@every-app/sdk/server";
import { env } from "cloudflare:workers";
import { getUpload } from "@/server/uploads";

// An uploaded image, served only to the member who uploaded it.
export const Route = createFileRoute("/uploads/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const user = await getEveryAppUser(request, env);
        if (!user) return new Response("Unauthorized", { status: 401 });
        const upload = await getUpload(user.id, params.id);
        const object = upload ? await env.files.get(upload.key) : null;
        if (!upload || !object) {
          return new Response("Not found", { status: 404 });
        }
        return new Response(object.body, {
          headers: {
            "content-type": upload.contentType,
            "cache-control": "private, max-age=3600",
            "x-content-type-options": "nosniff",
          },
        });
      },
    },
  },
});
