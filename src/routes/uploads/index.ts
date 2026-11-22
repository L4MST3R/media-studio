import { createFileRoute } from "@tanstack/react-router";
import { getEveryAppUser } from "@every-app/sdk/server";
import { env } from "cloudflare:workers";
import { MAX_UPLOAD_BYTES } from "@/shared/options";
import { saveUpload, UploadError } from "@/server/uploads";
import { rememberUser } from "@/server/users";

// A member uploads a reference or start image; the body is the file itself.
export const Route = createFileRoute("/uploads/")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await getEveryAppUser(request, env);
        if (!user) return new Response("Unauthorized", { status: 401 });
        const length = Number(request.headers.get("content-length") ?? 0);
        if (length > MAX_UPLOAD_BYTES) {
          return Response.json(
            { error: "Images can be up to 8 MB." },
            { status: 413 },
          );
        }
        const type = (request.headers.get("content-type") ?? "")
          .split(";")[0]!
          .trim();
        try {
          await rememberUser(user);
          const saved = await saveUpload(
            user.id,
            type,
            await request.arrayBuffer(),
          );
          return Response.json(saved, { status: 201 });
        } catch (error) {
          if (error instanceof UploadError) {
            return Response.json({ error: error.message }, { status: 400 });
          }
          throw error;
        }
      },
    },
  },
});
