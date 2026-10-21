import { requireAuth } from "@/lib/supabase/auth-guard";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ClearCacheButton } from "@/components/admin/clear-cache-button";

export default async function CachePage() {
  await requireAuth();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold">Cache Management</h1>
        <p className="text-sm text-muted-foreground">
          Force the public site to rebuild when changes aren&apos;t showing up.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Clear All Cache</CardTitle>
          <CardDescription>
            Flushes Next.js route and data caches for every page (products,
            events, testimonials, class info, gallery, home banner). The next visit to the
            public site will rebuild from the database. Saves and uploads
            already invalidate their own cache automatically — use this only
            when something looks stale.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ClearCacheButton />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Still seeing the old image?</CardTitle>
          <CardDescription>
            If clearing the cache doesn&apos;t help, the image is likely cached
            by your browser or a CDN edge node.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            <strong className="text-foreground">Browser:</strong> hard refresh
            with <kbd className="rounded border border-border px-1">Cmd/Ctrl + Shift + R</kbd>{" "}
            or open the page in an incognito window.
          </p>
          <p>
            <strong className="text-foreground">Mobile:</strong> close the tab
            and reopen, or pull-to-refresh.
          </p>
          <p>
            <strong className="text-foreground">CDN:</strong> Vercel&apos;s edge
            cache picks up the rebuild on the next request after this button is
            pressed, usually within a few seconds.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
