import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { AuctionEditForm } from "@/components/auctions/auction-edit-form";

interface PageProps {
  params: { id: string };
}

/** "2026-08-20T18:30" — the exact shape <input type="datetime-local"> expects back, from the server's local time (see lib/validation/auction.ts's note on why that's the right timezone here). */
function toLocalInputValue(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default async function EditAuctionPage({ params }: PageProps): Promise<React.JSX.Element> {
  const user = await getCurrentUser();
  if (!user || !user.roles.includes("ADMIN")) {
    redirect(`/login?redirectTo=/admin/auctions/${params.id}/edit`);
  }

  const auction = await prisma.auction.findUnique({
    where: { id: params.id },
    include: { product: true, _count: { select: { bids: true } } },
  });
  if (!auction) notFound();

    // PENDING (awaiting admin approval) is editable alongside UPCOMING —
  // same window update-auction.ts enforces on submit.
  const editable = (auction.status === "UPCOMING" || auction.status === "PENDING") && auction._count.bids === 0;

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <span className="tag-badge text-ink-soft">Auctions</span>
      <h1 className="mt-2 text-2xl">{auction.product.name}</h1>

      {!editable ? (
        <p className="mt-4 rounded-tag border border-brass bg-brass/5 px-3 py-2 text-xs text-brass-dark">
          This auction can no longer be edited — it has{" "}
          {auction._count.bids > 0 ? "at least one bid" : "already started"}.
        </p>
      ) : (
        <div className="mt-6">
          <AuctionEditForm
            auctionId={auction.id}
            defaultValues={{
              startingPrice: auction.startingPrice.toString(),
              minIncrement: auction.minIncrement.toString(),
              startTime: toLocalInputValue(auction.startTime),
              endTime: toLocalInputValue(auction.endTime),
            }}
          />
        </div>
      )}
    </div>
  );
}
